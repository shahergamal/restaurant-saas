import { BadRequestException, Body, Controller, Get, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { AuditService } from '../../common/audit.service';
import { CryptoService } from '../../common/crypto.service';
import { RequirePermissions } from '../../common/decorators';
import { DbService } from '../../common/prisma.service';
import { ctx, currentBranchId } from '../../common/tenant-context';
import { ZodPipe } from '../../common/zod.pipe';

const createSchema = z.object({
  guestName: z.string().trim().min(2).max(80),
  phone: z.string().regex(/^(\+9665|05)\d{8}$/, 'Saudi mobile number'),
  guests: z.number().int().min(1).max(40),
  section: z.enum(['family', 'single']).default('family'),
  at: z.string().datetime(),
  tableId: z.string().uuid().optional(),
  notes: z.string().max(200).optional(),
});
const statusSchema = z.object({ status: z.enum(['booked', 'seated', 'cancelled', 'no_show']) });

const mask = (phone: string) => phone.slice(0, 4) + '•••' + phone.slice(-3);

@Injectable()
class ReservationsService {
  constructor(
    private readonly db: DbService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
  ) {}

  async list() {
    const rows = await this.db.client.reservation.findMany({
      where: { branchId: currentBranchId(), at: { gte: new Date(Date.now() - 6 * 3_600_000) } },
      orderBy: { at: 'asc' },
      take: 100,
    });
    const tables = await this.db.client.diningTable.findMany({ where: { id: { in: rows.map((r) => r.tableId).filter((x): x is string => !!x) } } });
    return rows.map(({ phoneEnc, ...r }) => ({
      ...r,
      phoneMasked: phoneEnc ? mask(this.crypto.decrypt(phoneEnc)) : null,
      tableLabel: tables.find((t) => t.id === r.tableId)?.label ?? null,
    }));
  }

  async create(input: z.infer<typeof createSchema>) {
    const at = new Date(input.at);
    if (at.getTime() < Date.now() - 5 * 60_000) throw new BadRequestException('reservation_in_past');
    if (input.tableId) {
      const t = await this.db.client.diningTable.findFirst({ where: { id: input.tableId, floor: { branchId: currentBranchId() } } });
      if (!t) throw new BadRequestException('table_invalid');
      if (t.seats < input.guests) throw new BadRequestException('table_too_small');
    }
    const r = await this.db.client.reservation.create({
      data: {
        organizationId: ctx().orgId!, branchId: currentBranchId(), guestName: input.guestName, phoneEnc: this.crypto.encrypt(input.phone),
        guests: input.guests, section: input.section, at, tableId: input.tableId, notes: input.notes,
      },
    });
    await this.audit.log('reservation.create', 'reservation', r.id, { guests: input.guests, at: input.at });
    return { id: r.id };
  }

  async setStatus(id: string, status: z.infer<typeof statusSchema>['status']) {
    const r = await this.db.client.reservation.findFirst({ where: { id, branchId: currentBranchId() } });
    if (!r) throw new NotFoundException('reservation_not_found');
    await this.db.client.reservation.update({ where: { id }, data: { status } });
    await this.audit.log('reservation.status', 'reservation', id, { status });
    return { ok: true };
  }
}

@ApiTags('reservations')
@Controller('reservations')
class ReservationsController {
  constructor(private readonly svc: ReservationsService) {}

  @Get()
  @RequirePermissions('tables.view')
  list() {
    return this.svc.list();
  }

  @Post()
  @RequirePermissions('tables.manage')
  create(@Body(new ZodPipe(createSchema)) body: z.infer<typeof createSchema>) {
    return this.svc.create(body);
  }

  @Patch(':id')
  @RequirePermissions('tables.manage')
  status(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(statusSchema)) body: z.infer<typeof statusSchema>) {
    return this.svc.setStatus(id, body.status);
  }
}

@Module({ controllers: [ReservationsController], providers: [ReservationsService] })
export class ReservationsModule {}
