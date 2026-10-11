import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TableStatus } from '@prisma/client';
import { elapsedMinutes } from '@sufra/shared';
import { AuditService } from '../../common/audit.service';
import { EventsService } from '../../common/events.service';
import { DbService } from '../../common/prisma.service';
import { ctx, currentBranchId } from '../../common/tenant-context';

@Injectable()
export class TablesService {
  constructor(
    private readonly db: DbService,
    private readonly audit: AuditService,
    private readonly events: EventsService,
  ) {}

  floors() {
    return this.db.client.floor.findMany({
      where: { branchId: currentBranchId() },
      orderBy: { sort: 'asc' },
      include: {
        tables: {
          orderBy: { label: 'asc' },
          select: { id: true, label: true, seats: true, x: true, y: true, shape: true, status: true, section: true, needsAttention: true },
        },
      },
    });
  }

  async summary() {
    const tables = await this.db.client.diningTable.groupBy({
      by: ['status'],
      where: { floor: { branchId: currentBranchId() } },
      _count: { _all: true },
    });
    const count = (s: TableStatus) => tables.find((t) => t.status === s)?._count._all ?? 0;
    const total = tables.reduce((s, t) => s + t._count._all, 0);
    return {
      total,
      occupied: count('occupied'),
      available: count('available'),
      cleaning: count('cleaning'),
      outOfService: count('out_of_service'),
    };
  }

  async detail(id: string) {
    const table = await this.db.client.diningTable.findFirst({ where: { id, floor: { branchId: currentBranchId() } } });
    if (!table) throw new NotFoundException('table_not_found');
    const [waiter, order] = await Promise.all([
      table.waiterId ? this.db.client.user.findUnique({ where: { id: table.waiterId }, select: { id: true, nameAr: true, nameEn: true } }) : null,
      this.db.client.order.findFirst({
        where: { tableId: id, status: { in: ['in_progress', 'ready', 'served'] } },
        orderBy: { openedAt: 'desc' },
        include: {
          items: { include: { menuItem: { select: { nameAr: true, nameEn: true, image: true } } } },
          tickets: { select: { estimatedMin: true, createdAt: true, status: true } },
        },
      }),
    ]);
    const now = new Date();
    let estimatedMin: number | null = null;
    if (order && order.status === 'in_progress') {
      const remaining = order.tickets
        .filter((t) => t.status === 'cooking')
        .map((t) => t.estimatedMin - elapsedMinutes(t.createdAt, now));
      estimatedMin = remaining.length ? Math.max(1, ...remaining) : null;
    }
    return {
      id: table.id,
      label: table.label,
      seats: table.seats,
      status: table.status,
      section: table.section,
      guests: table.guests,
      occupiedSince: table.occupiedSince,
      waiter,
      order: order && {
        id: order.id,
        number: order.number,
        status: order.status,
        estimatedMin,
        total: order.totalHalala,
        items: order.items.map((i) => ({
          id: i.id, nameAr: i.menuItem.nameAr, nameEn: i.menuItem.nameEn, image: i.menuItem.image, qty: i.qty, lineTotal: i.unitPrice * i.qty,
        })),
      },
    };
  }

  async update(id: string, patch: { status?: TableStatus; waiterId?: string | null; x?: number; y?: number }) {
    const table = await this.db.client.diningTable.findFirst({ where: { id, floor: { branchId: currentBranchId() } } });
    if (!table) throw new NotFoundException('table_not_found');
    if (patch.waiterId) {
      const waiter = await this.db.client.user.findUnique({ where: { id: patch.waiterId } });
      if (!waiter) throw new BadRequestException('waiter_invalid');
    }
    if (patch.status && patch.status !== 'occupied') {
      const open = await this.db.client.order.count({ where: { tableId: id, status: { in: ['in_progress', 'ready', 'served'] } } });
      if (open > 0) throw new BadRequestException('table_has_open_order');
    }
    const updated = await this.db.client.diningTable.update({
      where: { id },
      data: {
        ...patch,
        ...(patch.status && patch.status !== 'occupied' ? { guests: null, occupiedSince: null, needsAttention: false } : {}),
      },
    });
    await this.audit.log('table.update', 'table', id, patch);
    this.events.emitToBranch(ctx().orgId!, currentBranchId(), 'table.updated', { id });
    return updated;
  }

  /** Moves the open order (and guests) to another available table. */
  async move(id: string, toTableId: string) {
    if (id === toTableId) throw new BadRequestException('same_table');
    const branchId = currentBranchId();
    await this.db.tx(async (tx) => {
      const [from, to] = await Promise.all([
        tx.diningTable.findFirst({ where: { id, floor: { branchId } } }),
        tx.diningTable.findFirst({ where: { id: toTableId, floor: { branchId } } }),
      ]);
      if (!from || !to) throw new NotFoundException('table_not_found');
      if (to.status !== 'available') throw new BadRequestException('target_not_available');
      await tx.order.updateMany({ where: { tableId: id, status: { in: ['in_progress', 'ready', 'served'] } }, data: { tableId: toTableId } });
      await tx.diningTable.update({
        where: { id: toTableId },
        data: { status: 'occupied', guests: from.guests, occupiedSince: from.occupiedSince, waiterId: from.waiterId },
      });
      await tx.diningTable.update({ where: { id }, data: { status: 'cleaning', guests: null, occupiedSince: null, needsAttention: false } });
      await this.audit.log('table.move', 'table', id, { to: toTableId }, tx);
    });
    this.events.emitToBranch(ctx().orgId!, branchId, 'table.updated', { id });
    return { ok: true };
  }

  waiters() {
    return this.db.client.user.findMany({
      where: { active: true, roles: { some: { role: 'waiter' } } },
      select: { id: true, nameAr: true, nameEn: true },
      orderBy: { nameEn: 'asc' },
    });
  }
}
