import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { config } from '../config';
import { currentOrgId } from './tenant-context';

function createTenantClient(base: PrismaClient) {
  return base.$extends({
    name: 'rls',
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const orgId = currentOrgId();
          const [, result] = await base.$transaction([
            base.$executeRaw`SELECT set_config('app.org_id', ${orgId}, TRUE)`,
            query(args),
          ]);
          return result;
        },
      },
    },
  });
}

export type TenantClient = ReturnType<typeof createTenantClient>;
export type TxClient = Prisma.TransactionClient;

/**
 * Tenant database access. Connects as the non-privileged `sufra_app` role, so PostgreSQL
 * Row-Level Security limits every statement to the organization of the current request.
 */
@Injectable()
export class DbService implements OnModuleDestroy {
  private readonly base = new PrismaClient({ datasources: { db: { url: config().DATABASE_URL_APP } } });
  readonly client: TenantClient = createTenantClient(this.base);

  /** Interactive transaction (and raw SQL) scoped to the current organization. */
  async tx<T>(fn: (tx: TxClient) => Promise<T>, opts?: { timeout?: number }): Promise<T> {
    const orgId = currentOrgId();
    return this.base.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.org_id', ${orgId}, TRUE)`;
        return fn(tx);
      },
      { timeout: opts?.timeout ?? 10_000 },
    );
  }

  async onModuleDestroy() {
    await this.base.$disconnect();
  }
}

/**
 * Privileged access (owner role, bypasses RLS). Only for pre-tenant operations:
 * login lookup by e-mail, refresh-token sessions, and health checks. Never inject into feature modules.
 */
@Injectable()
export class SystemDbService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({ datasources: { db: { url: config().DATABASE_URL } } });
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
