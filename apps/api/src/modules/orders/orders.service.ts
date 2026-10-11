import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Channel, OrderStatus, Prisma } from '@prisma/client';
import { computeTotals, deriveOrderStatus, elapsedMinutes, planFefo, recipeCost, splitEven, vatFromInclusive } from '@sufra/shared';
import { AuditService } from '../../common/audit.service';
import { EventsService } from '../../common/events.service';
import { DbService, TxClient } from '../../common/prisma.service';
import { ctx, currentBranchId } from '../../common/tenant-context';

export interface CreateOrderInput {
  channel: Channel;
  tableId?: string;
  guests?: number;
  notes?: string;
  items: { menuItemId: string; qty: number; modifiers?: string[]; notes?: string }[];
  discountBp?: number;
}

const ACTIVE: OrderStatus[] = ['in_progress', 'ready'];

@Injectable()
export class OrdersService {
  constructor(
    private readonly db: DbService,
    private readonly audit: AuditService,
    private readonly events: EventsService,
  ) {}

  private async threshold() {
    const org = await this.db.client.organization.findFirstOrThrow({ select: { delayThresholdMin: true } });
    return org.delayThresholdMin;
  }

  async list(q: { status: 'all' | 'in_progress' | 'ready' | 'delayed'; area?: string; page: number; pageSize: number; q?: string }) {
    const branchId = currentBranchId();
    const now = new Date();
    const threshold = await this.threshold();
    const delayedBefore = new Date(now.getTime() - threshold * 60_000);
    const where: Prisma.OrderWhereInput = { branchId, status: { in: ACTIVE } };
    if (q.area) where.table = { floorId: q.area };
    if (q.q) {
      const n = Number(q.q.replace('#', ''));
      where.OR = [
        ...(Number.isInteger(n) ? [{ number: n }] : []),
        { items: { some: { menuItem: { OR: [{ nameEn: { contains: q.q, mode: 'insensitive' as const } }, { nameAr: { contains: q.q } }] } } } },
      ];
    }
    const byStatus: Record<string, Prisma.OrderWhereInput> = {
      all: {},
      in_progress: { status: 'in_progress', openedAt: { gte: delayedBefore } },
      ready: { status: 'ready' },
      delayed: { status: 'in_progress', openedAt: { lt: delayedBefore } },
    };
    const [counts, rows, total] = await Promise.all([
      Promise.all(
        (['all', 'in_progress', 'ready', 'delayed'] as const).map((k) =>
          this.db.client.order.count({ where: { ...where, ...byStatus[k] } }),
        ),
      ),
      this.db.client.order.findMany({
        where: { ...where, ...byStatus[q.status] },
        orderBy: { openedAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: {
          table: { select: { label: true, floorId: true } },
          items: { include: { menuItem: { select: { nameAr: true, nameEn: true, image: true } } } },
        },
      }),
      this.db.client.order.count({ where: { ...where, ...byStatus[q.status] } }),
    ]);
    return {
      counts: { all: counts[0], in_progress: counts[1], ready: counts[2], delayed: counts[3] },
      thresholdMin: threshold,
      total,
      page: q.page,
      pageSize: q.pageSize,
      items: rows.map((o) => ({
        id: o.id,
        number: o.number,
        channel: o.channel,
        platform: o.platform,
        table: o.table ? { label: o.table.label } : null,
        guests: o.guests,
        status: deriveOrderStatus(o.status, o.openedAt, now, threshold),
        openedAt: o.openedAt,
        elapsedMin: elapsedMinutes(o.openedAt, now),
        total: o.totalHalala,
        items: o.items.map((i) => ({ nameAr: i.menuItem.nameAr, nameEn: i.menuItem.nameEn, image: i.menuItem.image, qty: i.qty })),
      })),
    };
  }

  async get(id: string) {
    const o = await this.db.client.order.findFirst({
      where: { id, branchId: currentBranchId() },
      include: {
        table: { select: { label: true } },
        items: { include: { menuItem: { select: { nameAr: true, nameEn: true, image: true } } } },
        payments: true,
      },
    });
    if (!o) throw new NotFoundException('order_not_found');
    const threshold = await this.threshold();
    return {
      ...o,
      status: deriveOrderStatus(o.status, o.openedAt, new Date(), threshold),
      elapsedMin: elapsedMinutes(o.openedAt, new Date()),
    };
  }

  private async nextNumber(tx: TxClient, branchId: string) {
    // Serialise numbering per branch inside the transaction.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${branchId}))`;
    const last = await tx.order.findFirst({ where: { branchId }, orderBy: { number: 'desc' }, select: { number: true } });
    return (last?.number ?? 1000) + 1;
  }

  async create(input: CreateOrderInput) {
    const c = ctx();
    const branchId = currentBranchId();
    if (input.channel === 'dine_in' && !input.tableId) throw new BadRequestException('table_required');
    const order = await this.db.tx(async (tx) => {
      const org = await tx.organization.findFirstOrThrow({ select: { serviceChargeBp: true } });
      const menu = await tx.menuItem.findMany({
        where: { id: { in: input.items.map((i) => i.menuItemId) }, active: true },
        include: { recipe: { include: { ingredient: { select: { avgCostHalala: true } } } } },
      });
      const byId = new Map(menu.map((m) => [m.id, m]));
      if (byId.size !== new Set(input.items.map((i) => i.menuItemId)).size) throw new BadRequestException('menu_item_invalid');

      if (input.tableId) {
        const table = await tx.diningTable.findFirst({ where: { id: input.tableId, floor: { branchId } } });
        if (!table) throw new BadRequestException('table_invalid');
        if (table.status === 'out_of_service') throw new BadRequestException('table_out_of_service');
      }

      const totals = computeTotals({
        lines: input.items.map((i) => ({ unitPrice: byId.get(i.menuItemId)!.priceHalala, qty: i.qty })),
        discount: input.discountBp ? { type: 'percent', bp: input.discountBp } : { type: 'none' },
        serviceChargeBp: input.channel === 'dine_in' ? org.serviceChargeBp : 0,
      });
      const lineCost = (id: string) =>
        recipeCost(byId.get(id)!.recipe.map((r) => ({ qtyMilli: r.qtyMilli, wasteBp: r.wasteBp, unitCost: r.ingredient.avgCostHalala })));

      const number = await this.nextNumber(tx, branchId);
      const now = new Date();
      const created = await tx.order.create({
        data: {
          organizationId: c.orgId!,
          branchId,
          number,
          channel: input.channel,
          tableId: input.tableId,
          guests: input.guests,
          waiterId: c.userId,
          notes: input.notes,
          subtotalHalala: totals.itemsTotal,
          discountHalala: totals.discount,
          serviceHalala: totals.serviceCharge,
          vatHalala: totals.vat,
          totalHalala: totals.total,
          costHalala: input.items.reduce((s, i) => s + lineCost(i.menuItemId) * i.qty, 0),
          openedAt: now,
          items: {
            create: input.items.map((i) => ({
              organizationId: c.orgId!,
              menuItemId: i.menuItemId,
              stationId: byId.get(i.menuItemId)!.stationId,
              qty: i.qty,
              unitPrice: byId.get(i.menuItemId)!.priceHalala,
              unitCost: lineCost(i.menuItemId),
              modifiers: i.modifiers ?? [],
              notes: i.notes,
              status: 'cooking',
              firedAt: now,
            })),
          },
        },
      });
      const stationIds = [...new Set(input.items.map((i) => byId.get(i.menuItemId)!.stationId).filter((s): s is string => !!s))];
      for (const stationId of stationIds) {
        await tx.kitchenTicket.create({ data: { organizationId: c.orgId!, orderId: created.id, stationId } });
      }
      if (input.tableId) {
        await tx.diningTable.update({
          where: { id: input.tableId },
          data: { status: 'occupied', occupiedSince: now, guests: input.guests ?? null, waiterId: c.userId },
        });
      }
      await tx.activityEvent.create({
        data: { organizationId: c.orgId!, branchId, kind: 'order_created', data: { number, items: input.items.length, tableId: input.tableId ?? null } },
      });
      await this.audit.log('order.create', 'order', created.id, { number, total: totals.total }, tx);
      return created;
    });
    this.events.emitToBranch(c.orgId!, branchId, 'ticket.created', { orderId: order.id });
    return { id: order.id, number: order.number, total: order.totalHalala };
  }

  async addItems(orderId: string, items: CreateOrderInput['items']) {
    const c = ctx();
    const branchId = currentBranchId();
    await this.db.tx(async (tx) => {
      const order = await tx.order.findFirst({ where: { id: orderId, branchId }, include: { items: true } });
      if (!order) throw new NotFoundException('order_not_found');
      if (!ACTIVE.includes(order.status)) throw new BadRequestException('order_closed');
      const menu = await tx.menuItem.findMany({
        where: { id: { in: items.map((i) => i.menuItemId) }, active: true },
        include: { recipe: { include: { ingredient: { select: { avgCostHalala: true } } } } },
      });
      const byId = new Map(menu.map((m) => [m.id, m]));
      if (byId.size !== new Set(items.map((i) => i.menuItemId)).size) throw new BadRequestException('menu_item_invalid');
      const now = new Date();
      for (const i of items) {
        const m = byId.get(i.menuItemId)!;
        const unitCost = recipeCost(m.recipe.map((r) => ({ qtyMilli: r.qtyMilli, wasteBp: r.wasteBp, unitCost: r.ingredient.avgCostHalala })));
        await tx.orderItem.create({
          data: {
            organizationId: c.orgId!, orderId, menuItemId: m.id, stationId: m.stationId, qty: i.qty, unitPrice: m.priceHalala,
            unitCost, modifiers: i.modifiers ?? [], notes: i.notes, status: 'cooking', firedAt: now,
          },
        });
        if (m.stationId) {
          const open = await tx.kitchenTicket.findFirst({ where: { orderId, stationId: m.stationId, status: 'cooking' } });
          if (!open) await tx.kitchenTicket.create({ data: { organizationId: c.orgId!, orderId, stationId: m.stationId } });
        }
      }
      await this.recalc(tx, orderId);
      await tx.order.update({ where: { id: orderId }, data: { status: 'in_progress' } });
      await this.audit.log('order.add_items', 'order', orderId, { items }, tx);
    });
    this.events.emitToBranch(c.orgId!, branchId, 'ticket.created', { orderId });
    return this.get(orderId);
  }

  private async recalc(tx: TxClient, orderId: string) {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    const org = await tx.organization.findFirstOrThrow({ select: { serviceChargeBp: true } });
    const discountBp = order.subtotalHalala > 0 ? Math.round((order.discountHalala * 10_000) / order.subtotalHalala) : 0;
    const t = computeTotals({
      lines: order.items.map((i) => ({ unitPrice: i.unitPrice, qty: i.qty })),
      discount: discountBp ? { type: 'percent', bp: discountBp } : { type: 'none' },
      serviceChargeBp: order.channel === 'dine_in' ? org.serviceChargeBp : 0,
    });
    await tx.order.update({
      where: { id: orderId },
      data: {
        subtotalHalala: t.itemsTotal, discountHalala: t.discount, serviceHalala: t.serviceCharge, vatHalala: t.vat, totalHalala: t.total,
        costHalala: order.items.reduce((s, i) => s + i.unitCost * i.qty, 0),
      },
    });
  }

  async markReady(orderId: string) {
    const c = ctx();
    const branchId = currentBranchId();
    await this.db.tx(async (tx) => {
      const order = await tx.order.findFirst({ where: { id: orderId, branchId } });
      if (!order) throw new NotFoundException('order_not_found');
      if (order.status !== 'in_progress') throw new BadRequestException('order_not_in_progress');
      const now = new Date();
      await tx.order.update({ where: { id: orderId }, data: { status: 'ready', readyAt: now } });
      await tx.kitchenTicket.updateMany({ where: { orderId, status: 'cooking' }, data: { status: 'ready', readyAt: now } });
      await tx.orderItem.updateMany({ where: { orderId, status: { in: ['queued', 'cooking'] } }, data: { status: 'ready', readyAt: now } });
      await tx.activityEvent.create({ data: { organizationId: c.orgId!, branchId, kind: 'order_ready', data: { number: order.number } } });
      await this.audit.log('order.ready', 'order', orderId, null, tx);
    });
    this.events.emitToBranch(c.orgId!, branchId, 'ticket.updated', { orderId });
    return { ok: true };
  }

  async serve(orderId: string) {
    const branchId = currentBranchId();
    const order = await this.db.client.order.findFirst({ where: { id: orderId, branchId } });
    if (!order) throw new NotFoundException('order_not_found');
    if (!ACTIVE.includes(order.status)) throw new BadRequestException('order_closed');
    await this.db.client.order.update({ where: { id: orderId }, data: { status: 'served' } });
    await this.db.client.kitchenTicket.updateMany({ where: { orderId }, data: { status: 'served' } });
    await this.audit.log('order.serve', 'order', orderId);
    this.events.emitToBranch(ctx().orgId!, branchId, 'ticket.updated', { orderId });
    return { ok: true };
  }

  /** Preview of an equal split. Each part becomes its own simplified tax invoice when paid. */
  async splitPreview(orderId: string, parts: number) {
    const order = await this.get(orderId);
    return {
      total: order.totalHalala,
      parts: splitEven(order.totalHalala, parts).map((amount) => ({ amount, vat: vatFromInclusive(amount) })),
    };
  }

  async cancel(orderId: string, reason: string) {
    const c = ctx();
    const branchId = currentBranchId();
    await this.db.tx(async (tx) => {
      const order = await tx.order.findFirst({ where: { id: orderId, branchId } });
      if (!order) throw new NotFoundException('order_not_found');
      if (order.status === 'paid' || order.status === 'cancelled') throw new BadRequestException('order_closed');
      await tx.order.update({ where: { id: orderId }, data: { status: 'cancelled', closedAt: new Date(), notes: reason } });
      await tx.kitchenTicket.deleteMany({ where: { orderId, status: 'cooking' } });
      if (order.tableId) await tx.diningTable.update({ where: { id: order.tableId }, data: { status: 'cleaning', guests: null, occupiedSince: null } });
      await this.audit.log('order.cancel', 'order', orderId, { reason }, tx);
    });
    this.events.emitToBranch(c.orgId!, branchId, 'ticket.updated', { orderId });
    return { ok: true };
  }

  /**
   * Takes payment and closes the order: consumes ingredients FEFO by recipe, records stock movements,
   * and creates the simplified invoice record (ZATCA reporting is handled by the e-invoicing module, phase 3).
   */
  async pay(orderId: string, payments: { method: 'cash' | 'mada' | 'card' | 'apple_pay' | 'stc_pay'; amount: number }[]) {
    const c = ctx();
    const branchId = currentBranchId();
    return this.db.tx(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, branchId },
        include: { items: { include: { menuItem: { include: { recipe: true } } } } },
      });
      if (!order) throw new NotFoundException('order_not_found');
      if (order.status === 'paid' || order.status === 'cancelled') throw new BadRequestException('order_closed');
      const paid = payments.reduce((s, p) => s + p.amount, 0);
      if (paid !== order.totalHalala) throw new BadRequestException('payment_total_mismatch');
      const now = new Date();
      for (const p of payments) {
        await tx.payment.create({ data: { organizationId: c.orgId!, orderId, method: p.method, amountHalala: p.amount, at: now } });
      }

      const need = new Map<string, number>();
      for (const item of order.items) {
        for (const r of item.menuItem.recipe) {
          const q = Math.round((r.qtyMilli * (10_000 + r.wasteBp) * item.qty) / 10_000);
          need.set(r.ingredientId, (need.get(r.ingredientId) ?? 0) + q);
        }
      }
      let actualCost = 0;
      for (const [ingredientId, qty] of need) {
        const lots = await tx.stockLot.findMany({ where: { branchId, ingredientId, qtyMilli: { gt: 0 } } });
        const plan = planFefo(lots, qty, true);
        for (const step of plan) {
          const lot = lots.find((l) => l.id === step.lotId);
          if (lot) await tx.stockLot.update({ where: { id: lot.id }, data: { qtyMilli: { decrement: step.qtyMilli } } });
          const ing = await tx.ingredient.findUniqueOrThrow({ where: { id: ingredientId }, select: { avgCostHalala: true } });
          const cost = Math.round(((lot?.costPerUnit ?? ing.avgCostHalala) * step.qtyMilli) / 1000);
          actualCost += cost;
          await tx.stockMovement.create({
            data: { organizationId: c.orgId!, branchId, ingredientId, qtyMilli: -step.qtyMilli, costHalala: cost, type: 'sale', refId: orderId, at: now },
          });
        }
      }

      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${c.orgId! + ':icv'}))`;
      const last = await tx.invoice.findFirst({ orderBy: { icv: 'desc' }, select: { icv: true } });
      await tx.invoice.create({
        data: {
          organizationId: c.orgId!, orderId, type: 'simplified', icv: (last?.icv ?? 0) + 1, uuid: crypto.randomUUID(),
          status: 'pending', totalHalala: order.totalHalala, vatHalala: order.vatHalala, issuedAt: now,
        },
      });
      await tx.order.update({ where: { id: orderId }, data: { status: 'paid', closedAt: now, costHalala: actualCost } });
      if (order.tableId) await tx.diningTable.update({ where: { id: order.tableId }, data: { status: 'cleaning', guests: null, occupiedSince: null } });
      await this.audit.log('order.pay', 'order', orderId, { payments, total: order.totalHalala }, tx);
      return { ok: true, total: order.totalHalala, cost: actualCost };
    }, { timeout: 20_000 });
  }
}
