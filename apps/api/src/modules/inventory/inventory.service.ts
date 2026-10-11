import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { planFefo, stockStatus, type StockStatus } from '@sufra/shared';
import { AuditService } from '../../common/audit.service';
import { DbService } from '../../common/prisma.service';
import { ctx, currentBranchId } from '../../common/tenant-context';
import { pctChange } from '../../common/time';

const DAY = 86_400_000;
export const INGREDIENT_CATEGORIES = ['produce', 'meat', 'seafood', 'dairy', 'dry_goods', 'beverages'] as const;

interface Row {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  unit: string;
  category: string;
  image: string | null;
  qtyMilli: number;
  qtyWeekAgoMilli: number;
  valueHalala: number;
  status: StockStatus;
  statusWeekAgo: StockStatus;
  minLevelMilli: number;
  reorderLevelMilli: number;
  updatedAt: Date | null;
  expiringSoon: boolean;
  expiringWeekAgo: boolean;
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly db: DbService,
    private readonly audit: AuditService,
  ) {}

  /** Stock position per ingredient for the current branch, plus the same position 7 days ago. */
  private async rows(): Promise<Row[]> {
    const branchId = currentBranchId();
    const now = Date.now();
    const weekAgo = new Date(now - 7 * DAY);
    const [ingredients, lots, recent, lastMove] = await Promise.all([
      this.db.client.ingredient.findMany({ orderBy: { nameEn: 'asc' } }),
      this.db.client.stockLot.findMany({ where: { branchId } }),
      this.db.client.stockMovement.groupBy({ by: ['ingredientId'], where: { branchId, at: { gte: weekAgo } }, _sum: { qtyMilli: true } }),
      this.db.client.stockMovement.groupBy({ by: ['ingredientId'], where: { branchId, type: { not: 'sale' } }, _max: { at: true } }),
    ]);
    return ingredients.map((i) => {
      const own = lots.filter((l) => l.ingredientId === i.id);
      const qty = own.reduce((s, l) => s + l.qtyMilli, 0);
      const delta = recent.find((r) => r.ingredientId === i.id)?._sum.qtyMilli ?? 0;
      const qtyWeekAgo = qty - delta;
      const soon = (ref: number) =>
        own.some((l) => l.qtyMilli > 0 && l.expiresAt && l.expiresAt.getTime() >= ref && l.expiresAt.getTime() <= ref + 3 * DAY && l.receivedAt.getTime() <= ref);
      return {
        id: i.id,
        slug: i.slug,
        nameAr: i.nameAr,
        nameEn: i.nameEn,
        unit: i.unit,
        category: i.category,
        image: i.image,
        qtyMilli: qty,
        qtyWeekAgoMilli: qtyWeekAgo,
        valueHalala: own.reduce((s, l) => s + Math.round((Math.max(0, l.qtyMilli) * l.costPerUnit) / 1000), 0),
        status: stockStatus(qty, i.minLevelMilli, i.reorderLevelMilli),
        statusWeekAgo: stockStatus(qtyWeekAgo, i.minLevelMilli, i.reorderLevelMilli),
        minLevelMilli: i.minLevelMilli,
        reorderLevelMilli: i.reorderLevelMilli,
        updatedAt: lastMove.find((m) => m.ingredientId === i.id)?._max.at ?? null,
        expiringSoon: soon(now),
        expiringWeekAgo: soon(weekAgo.getTime()),
      };
    });
  }

  async summary() {
    const rows = await this.rows();
    const low = rows.filter((r) => r.status === 'low' || r.status === 'critical').length;
    const lowPrev = rows.filter((r) => r.statusWeekAgo === 'low' || r.statusWeekAgo === 'critical').length;
    const exp = rows.filter((r) => r.expiringSoon).length;
    const expPrev = rows.filter((r) => r.expiringWeekAgo).length;
    const value = rows.reduce((s, r) => s + r.valueHalala, 0);
    const valuePrev = rows.reduce((s, r) => s + (r.qtyMilli > 0 ? Math.round((r.valueHalala * r.qtyWeekAgoMilli) / r.qtyMilli) : 0), 0);
    const counts = (k: StockStatus) => rows.filter((r) => r.status === k).length;
    return {
      totalItems: rows.length,
      totalItemsDeltaPct: 0,
      lowStock: low,
      lowStockDeltaPct: pctChange(low, lowPrev),
      expiringSoon: exp,
      expiringSoonDeltaPct: pctChange(exp, expPrev),
      totalValue: value,
      totalValueDeltaPct: pctChange(value, valuePrev),
      overview: { in_stock: counts('in_stock'), low: counts('low'), critical: counts('critical'), out: counts('out') },
      categories: INGREDIENT_CATEGORIES.map((c) => ({ key: c, count: rows.filter((r) => r.category === c).length })),
    };
  }

  async list(q: { category?: string; page: number; pageSize: number; q?: string; status?: StockStatus }) {
    let rows = await this.rows();
    if (q.category) rows = rows.filter((r) => r.category === q.category);
    if (q.status) rows = rows.filter((r) => r.status === q.status);
    if (q.q) {
      const needle = q.q.toLowerCase();
      rows = rows.filter((r) => r.nameEn.toLowerCase().includes(needle) || r.nameAr.includes(q.q!));
    }
    // Most recently touched first, matching the "Last Updated" column.
    rows.sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0));
    const total = rows.length;
    const items = rows.slice((q.page - 1) * q.pageSize, q.page * q.pageSize).map((r) => ({
      id: r.id, nameAr: r.nameAr, nameEn: r.nameEn, unit: r.unit, category: r.category, image: r.image,
      qtyMilli: r.qtyMilli, status: r.status, updatedAt: r.updatedAt, valueHalala: r.valueHalala,
      minLevelMilli: r.minLevelMilli, reorderLevelMilli: r.reorderLevelMilli,
    }));
    return { total, page: q.page, pageSize: q.pageSize, items };
  }

  async activity(limit = 5) {
    const branchId = currentBranchId();
    const [moves, alerts] = await Promise.all([
      this.db.client.stockMovement.findMany({
        where: { branchId, type: { in: ['purchase', 'adjust', 'waste'] } },
        orderBy: { at: 'desc' },
        take: limit,
        include: { ingredient: { select: { nameAr: true, nameEn: true, unit: true } } },
      }),
      this.db.client.activityEvent.findMany({ where: { branchId, kind: 'low_stock' }, orderBy: { at: 'desc' }, take: limit }),
    ]);
    const ingredients = await this.db.client.ingredient.findMany({
      where: { id: { in: alerts.map((a) => (a.data as { ingredientId?: string }).ingredientId).filter((x): x is string => !!x) } },
      select: { id: true, nameAr: true, nameEn: true, unit: true },
    });
    const merged = [
      ...moves.map((m) => ({
        id: m.id,
        kind: m.type === 'purchase' ? ('added' as const) : ('updated' as const),
        nameAr: m.ingredient.nameAr,
        nameEn: m.ingredient.nameEn,
        unit: m.ingredient.unit,
        qtyMilli: m.qtyMilli,
        at: m.at,
      })),
      ...alerts.map((a) => {
        const d = a.data as { ingredientId: string; qtyMilli: number };
        const ing = ingredients.find((i) => i.id === d.ingredientId);
        return { id: a.id, kind: 'low' as const, nameAr: ing?.nameAr ?? '', nameEn: ing?.nameEn ?? '', unit: ing?.unit ?? '', qtyMilli: d.qtyMilli, at: a.at };
      }),
    ];
    return merged.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit);
  }

  /** The single most urgent ingredient to reorder, for the "Action needed" card. */
  async actionNeeded() {
    const rows = (await this.rows()).filter((r) => r.status === 'critical' || r.status === 'out');
    rows.sort((a, b) => a.qtyMilli / Math.max(1, a.minLevelMilli) - b.qtyMilli / Math.max(1, b.minLevelMilli));
    const r = rows[0];
    return r ? { ingredientId: r.id, nameAr: r.nameAr, nameEn: r.nameEn, qtyMilli: r.qtyMilli, unit: r.unit, status: r.status } : null;
  }

  async createIngredient(input: {
    nameAr: string; nameEn: string; unit: string; category: string; minLevel: number; reorderLevel: number; qty: number; unitCost: string;
  }) {
    const c = ctx();
    const branchId = currentBranchId();
    if (input.reorderLevel < input.minLevel) throw new BadRequestException('reorder_below_min');
    const [whole = '0', frac = ''] = input.unitCost.split('.');
    const unitCost = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
    const slug = input.nameEn.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `item-${Date.now()}`;
    return this.db.tx(async (tx) => {
      const ing = await tx.ingredient.create({
        data: {
          organizationId: c.orgId!, slug, nameAr: input.nameAr, nameEn: input.nameEn, unit: input.unit, category: input.category,
          minLevelMilli: Math.round(input.minLevel * 1000), reorderLevelMilli: Math.round(input.reorderLevel * 1000), avgCostHalala: unitCost,
        },
      });
      if (input.qty > 0) {
        const qtyMilli = Math.round(input.qty * 1000);
        await tx.stockLot.create({ data: { organizationId: c.orgId!, branchId, ingredientId: ing.id, qtyMilli, costPerUnit: unitCost } });
        await tx.stockMovement.create({
          data: { organizationId: c.orgId!, branchId, ingredientId: ing.id, qtyMilli, costHalala: Math.round((qtyMilli * unitCost) / 1000), type: 'purchase', reason: 'opening' },
        });
      }
      await this.audit.log('ingredient.create', 'ingredient', ing.id, input, tx);
      return ing;
    });
  }

  /** Waste or manual adjustment. Negative quantities are taken FEFO. */
  async move(input: { ingredientId: string; type: 'waste' | 'adjust'; qty: number; reason: string }) {
    const c = ctx();
    const branchId = currentBranchId();
    const qtyMilli = Math.round(input.qty * 1000);
    if (input.type === 'waste' && qtyMilli <= 0) throw new BadRequestException('waste_must_be_positive');
    const signed = input.type === 'waste' ? -qtyMilli : qtyMilli;
    await this.db.tx(async (tx) => {
      const ing = await tx.ingredient.findUnique({ where: { id: input.ingredientId } });
      if (!ing) throw new NotFoundException('ingredient_not_found');
      if (signed < 0) {
        const lots = await tx.stockLot.findMany({ where: { branchId, ingredientId: ing.id, qtyMilli: { gt: 0 } } });
        let plan;
        try {
          plan = planFefo(lots, -signed);
        } catch {
          throw new BadRequestException('insufficient_stock');
        }
        for (const step of plan) await tx.stockLot.update({ where: { id: step.lotId! }, data: { qtyMilli: { decrement: step.qtyMilli } } });
      } else {
        await tx.stockLot.create({ data: { organizationId: c.orgId!, branchId, ingredientId: ing.id, qtyMilli: signed, costPerUnit: ing.avgCostHalala } });
      }
      await tx.stockMovement.create({
        data: {
          organizationId: c.orgId!, branchId, ingredientId: ing.id, qtyMilli: signed, type: input.type, reason: input.reason,
          costHalala: Math.round((Math.abs(signed) * ing.avgCostHalala) / 1000),
        },
      });
      await this.audit.log(`stock.${input.type}`, 'ingredient', ing.id, input, tx);
    });
    return { ok: true };
  }

  async createPurchaseOrder(ingredientIds: string[]) {
    const c = ctx();
    const branchId = currentBranchId();
    const rows = (await this.rows()).filter((r) => ingredientIds.includes(r.id));
    if (rows.length !== new Set(ingredientIds).size) throw new BadRequestException('ingredient_invalid');
    return this.db.tx(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${c.orgId! + ':po'}))`;
      const last = await tx.purchaseOrder.findFirst({ orderBy: { number: 'desc' }, select: { number: true } });
      const ingredients = await tx.ingredient.findMany({ where: { id: { in: ingredientIds } } });
      const po = await tx.purchaseOrder.create({
        data: {
          organizationId: c.orgId!, branchId, number: (last?.number ?? 1000) + 1, createdById: c.userId,
          supplierId: ingredients[0]?.supplierId ?? null,
          lines: {
            create: rows.map((r) => ({
              organizationId: c.orgId!,
              ingredientId: r.id,
              // Bring stock back to twice the reorder level.
              qtyMilli: Math.max(r.reorderLevelMilli * 2 - Math.max(0, r.qtyMilli), r.reorderLevelMilli),
              unitCost: ingredients.find((i) => i.id === r.id)!.avgCostHalala,
            })),
          },
        },
        include: { lines: true },
      });
      await this.audit.log('purchase_order.create', 'purchase_order', po.id, { ingredientIds }, tx);
      return { id: po.id, number: po.number, lines: po.lines.length, status: po.status };
    });
  }

  async receivePurchaseOrder(id: string) {
    const c = ctx();
    const branchId = currentBranchId();
    await this.db.tx(async (tx) => {
      const po = await tx.purchaseOrder.findFirst({ where: { id, branchId }, include: { lines: true } });
      if (!po) throw new NotFoundException('po_not_found');
      if (po.status === 'received' || po.status === 'cancelled') throw new BadRequestException('po_closed');
      for (const l of po.lines) {
        const lots = await tx.stockLot.findMany({ where: { ingredientId: l.ingredientId } });
        const onHand = lots.reduce((s, x) => s + Math.max(0, x.qtyMilli), 0);
        const ing = await tx.ingredient.findUniqueOrThrow({ where: { id: l.ingredientId } });
        const avg = Math.round((onHand * ing.avgCostHalala + l.qtyMilli * l.unitCost) / Math.max(1, onHand + l.qtyMilli));
        await tx.ingredient.update({ where: { id: l.ingredientId }, data: { avgCostHalala: avg } });
        await tx.stockLot.create({ data: { organizationId: c.orgId!, branchId, ingredientId: l.ingredientId, qtyMilli: l.qtyMilli, costPerUnit: l.unitCost } });
        await tx.stockMovement.create({
          data: {
            organizationId: c.orgId!, branchId, ingredientId: l.ingredientId, qtyMilli: l.qtyMilli, type: 'purchase', refId: po.id,
            costHalala: Math.round((l.qtyMilli * l.unitCost) / 1000),
          },
        });
      }
      await tx.purchaseOrder.update({ where: { id }, data: { status: 'received', receivedAt: new Date() } });
      await this.audit.log('purchase_order.receive', 'purchase_order', id, null, tx);
    });
    return { ok: true };
  }

  listPurchaseOrders() {
    return this.db.client.purchaseOrder.findMany({
      where: { branchId: currentBranchId() },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { supplier: { select: { name: true } }, lines: { include: { ingredient: { select: { nameAr: true, nameEn: true, unit: true } } } } },
    });
  }

  async csv(): Promise<string> {
    const rows = await this.rows();
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [
      ['Item', 'الصنف', 'Category', 'Quantity', 'Unit', 'Status', 'Value (SAR)', 'Last updated'].map(esc).join(','),
      ...rows.map((r) =>
        [r.nameEn, r.nameAr, r.category, (r.qtyMilli / 1000).toFixed(2), r.unit, r.status, (r.valueHalala / 100).toFixed(2), r.updatedAt?.toISOString() ?? '']
          .map(esc)
          .join(','),
      ),
    ];
    return '﻿' + lines.join('\r\n');
  }
}
