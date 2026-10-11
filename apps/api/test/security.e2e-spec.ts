/**
 * Phase 0 acceptance: login, tenant isolation (API + database RLS), RBAC, CSRF origin check and refresh rotation.
 * Requires a migrated + seeded database (pnpm db:migrate && pnpm db:seed).
 */
import { INestApplication, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';

try {
  process.loadEnvFile('.env');
} catch {
  /* CI provides env */
}

const PASSWORD = process.env.SEED_PASSWORD ?? 'Qidr@Demo2026';
const ORIGIN = 'http://localhost:3000';

describe('security & tenancy', () => {
  let app: INestApplication;
  const owner = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
  const appRole = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL_APP } } });

  const login = async (email: string) => {
    const res = await request(app.getHttpServer()).post('/v1/auth/login').set('origin', ORIGIN).send({ email, password: PASSWORD }).expect(200);
    return res.get('set-cookie') as unknown as string[];
  };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.use(cookieParser());
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await owner.$disconnect();
    await appRole.$disconnect();
  });

  it('rejects unauthenticated requests', async () => {
    await request(app.getHttpServer()).get('/v1/orders').expect(401);
  });

  it('rejects bad credentials without revealing whether the account exists', async () => {
    const a = await request(app.getHttpServer()).post('/v1/auth/login').send({ email: 'nobody@x.sa', password: 'wrong-password' });
    const b = await request(app.getHttpServer()).post('/v1/auth/login').send({ email: 'chef@qidr.demo', password: 'wrong-password' });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.message).toBe(b.body.message);
  });

  it('isolates organizations at the API layer', async () => {
    const olive = await login('manager@qidr.demo');
    const palm = await login('owner@palm.demo');
    const oliveOrders = await request(app.getHttpServer()).get('/v1/orders').set('Cookie', olive).expect(200);
    expect(oliveOrders.body.total).toBeGreaterThan(0);
    const someOliveOrder = oliveOrders.body.items[0].id as string;

    const palmOrders = await request(app.getHttpServer()).get('/v1/orders').set('Cookie', palm).expect(200);
    expect(palmOrders.body.total).toBe(0);
    await request(app.getHttpServer()).get(`/v1/orders/${someOliveOrder}`).set('Cookie', palm).expect(404);

    const palmFloors = await request(app.getHttpServer()).get('/v1/floors').set('Cookie', palm).expect(200);
    expect(palmFloors.body).toHaveLength(1);

    // Branch header cannot be used to reach another tenant's branch.
    const oliveMe = await request(app.getHttpServer()).get('/v1/auth/me').set('Cookie', olive).expect(200);
    await request(app.getHttpServer()).get('/v1/orders').set('Cookie', palm).set('x-branch-id', oliveMe.body.branchId).expect(403);
  });

  it('enforces Row-Level Security in PostgreSQL for the app role', async () => {
    const palm = await owner.organization.findFirstOrThrow({ where: { nameEn: 'Palm Kitchen' } });
    const total = await owner.order.count();
    expect(total).toBeGreaterThan(0);
    // No tenant set: fail closed.
    const [unset] = await appRole.$queryRaw<{ c: bigint }[]>`SELECT count(*)::bigint AS c FROM orders`;
    expect(Number(unset!.c)).toBe(0);
    // Tenant set to Palm: sees none of the Olive orders.
    const [scoped] = await appRole.$transaction([
      appRole.$queryRaw<{ c: bigint }[]>`SELECT set_config('app.org_id', ${palm.id}, TRUE), (SELECT count(*) FROM orders)::bigint AS c`,
    ]);
    expect(Number(scoped[0]!.c)).toBe(0);
    // Cannot write rows for another organization.
    const olive = await owner.organization.findFirstOrThrow({ where: { nameEn: 'The Olive Restaurant' } });
    await expect(
      appRole.$transaction([
        appRole.$executeRaw`SELECT set_config('app.org_id', ${palm.id}, TRUE)`,
        appRole.$executeRaw`INSERT INTO audit_logs (id, organization_id, action, entity) VALUES (gen_random_uuid(), ${olive.id}::uuid, 'x', 'y')`,
      ]),
    ).rejects.toThrow();
  });

  it('enforces role permissions', async () => {
    const chef = await login('chef@qidr.demo');
    await request(app.getHttpServer()).get('/v1/kitchen/board').set('Cookie', chef).expect(200);
    await request(app.getHttpServer()).get('/v1/food-cost/overview').set('Cookie', chef).expect(403);
    await request(app.getHttpServer()).patch('/v1/settings/organization').set('Cookie', chef).set('origin', ORIGIN).send({}).expect(403);
  });

  it('blocks cross-site state-changing requests', async () => {
    const m = await login('manager@qidr.demo');
    await request(app.getHttpServer()).post('/v1/auth/mfa/setup').set('Cookie', m).set('origin', 'https://evil.example').expect(403);
  });

  it('rotates refresh tokens and revokes the family on reuse', async () => {
    const cookies = await login('cashier@qidr.demo');
    const rt = cookies.find((c) => c.startsWith('sufra_rt='))!.split(';')[0]!;
    const first = await request(app.getHttpServer()).post('/v1/auth/refresh').set('Cookie', [rt]).set('origin', ORIGIN).expect(200);
    const rt2 = (first.get('set-cookie') as unknown as string[]).find((c) => c.startsWith('sufra_rt='))!.split(';')[0]!;
    await request(app.getHttpServer()).post('/v1/auth/refresh').set('Cookie', [rt]).set('origin', ORIGIN).expect(401); // reuse
    await request(app.getHttpServer()).post('/v1/auth/refresh').set('Cookie', [rt2]).set('origin', ORIGIN).expect(401); // family revoked
  });

  it('computes order totals on the server and decrements stock by recipe when paid', async () => {
    const m = await login('manager@qidr.demo');
    const menu = await request(app.getHttpServer()).get('/v1/menu/items').set('Cookie', m).expect(200);
    const salad = menu.body.find((i: { slug: string }) => i.slug === 'caesar-salad');
    const created = await request(app.getHttpServer())
      .post('/v1/orders')
      .set('Cookie', m)
      .set('origin', ORIGIN)
      .send({ channel: 'takeaway', items: [{ menuItemId: salad.id, qty: 2 }] })
      .expect(201);
    expect(created.body.total).toBe(salad.priceHalala * 2);

    const oliveOrg = await owner.organization.findFirstOrThrow({ where: { nameEn: 'The Olive Restaurant' } });
    const lettuce = await owner.ingredient.findFirstOrThrow({ where: { slug: 'lettuce', organizationId: oliveOrg.id } });
    const me = await request(app.getHttpServer()).get('/v1/auth/me').set('Cookie', m).expect(200);
    const lotWhere = { ingredientId: lettuce.id, branchId: me.body.branchId as string };
    const before = await owner.stockLot.aggregate({ where: lotWhere, _sum: { qtyMilli: true } });
    await request(app.getHttpServer())
      .post(`/v1/orders/${created.body.id}/pay`)
      .set('Cookie', m)
      .set('origin', ORIGIN)
      .send({ payments: [{ method: 'mada', amount: created.body.total - 1 }] })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/v1/orders/${created.body.id}/pay`)
      .set('Cookie', m)
      .set('origin', ORIGIN)
      .send({ payments: [{ method: 'mada', amount: created.body.total }] })
      .expect(200);
    const after = await owner.stockLot.aggregate({ where: lotWhere, _sum: { qtyMilli: true } });
    // 180 g x (1 + 15% waste) x 2 portions = 414 g
    expect((before._sum.qtyMilli ?? 0) - (after._sum.qtyMilli ?? 0)).toBe(414);
    const audit = await owner.auditLog.findFirst({ where: { entityId: created.body.id, action: 'order.pay' } });
    expect(audit).not.toBeNull();
  });
});
