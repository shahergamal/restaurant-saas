import { Injectable } from '@nestjs/common';
import { stockStatus } from '@sufra/shared';
import { DbService } from '../../common/prisma.service';
import { ctx, currentBranchId } from '../../common/tenant-context';
import { pctChange, riyadhHour, startOfRiyadhDay } from '../../common/time';

@Injectable()
export class DashboardService {
  constructor(private readonly db: DbService) {}

  async summary() {
    const branchId = currentBranchId();
    const now = new Date();
    const today = startOfRiyadhDay(now);
    const yesterday = startOfRiyadhDay(now, -1);
    const sameTimeYesterday = new Date(now.getTime() - 86_400_000);
    const hourAgo = new Date(now.getTime() - 3_600_000);
    const org = await this.db.client.organization.findFirstOrThrow({ select: { delayThresholdMin: true } });
    const delayedBefore = new Date(now.getTime() - org.delayThresholdMin * 60_000);

    const [user, tables, active, delayed, todayOrders, yOrders, readyToday, cookingTickets, activity] = await Promise.all([
      this.db.client.user.findUniqueOrThrow({ where: { id: ctx().userId! }, select: { nameAr: true, nameEn: true } }),
      this.db.client.diningTable.groupBy({ by: ['status'], where: { floor: { branchId } }, _count: { _all: true } }),
      this.db.client.order.count({ where: { branchId, status: { in: ['in_progress', 'ready'] } } }),
      this.db.client.order.count({ where: { branchId, status: 'in_progress', openedAt: { lt: delayedBefore } } }),
      this.db.client.order.findMany({ where: { branchId, openedAt: { gte: today }, status: { not: 'cancelled' } }, select: { totalHalala: true, openedAt: true } }),
      this.db.client.order.aggregate({
        where: { branchId, openedAt: { gte: yesterday, lt: sameTimeYesterday }, status: { not: 'cancelled' } },
        _sum: { totalHalala: true },
      }),
      this.db.client.order.findMany({ where: { branchId, readyAt: { gte: today } }, select: { openedAt: true, readyAt: true } }),
      this.db.client.kitchenTicket.findMany({
        where: { station: { branchId }, status: 'cooking', createdAt: { lt: delayedBefore } },
        select: { station: { select: { key: true, nameAr: true, nameEn: true, sort: true } } },
      }),
      this.db.client.activityEvent.findMany({ where: { branchId }, orderBy: { at: 'desc' }, take: 5 }),
    ]);

    const ingIds = activity
      .map((a) => (a.data as Record<string, unknown> | null)?.ingredientId)
      .filter((v): v is string => typeof v === 'string');
    const ingNames = new Map(
      (ingIds.length ? await this.db.client.ingredient.findMany({ where: { id: { in: ingIds } }, select: { id: true, nameAr: true, nameEn: true, unit: true } }) : []).map((i) => [i.id, i]),
    );
    const total = tables.reduce((s, t) => s + t._count._all, 0);
    const occupied = tables.find((t) => t.status === 'occupied')?._count._all ?? 0;
    const prepAvg = (rows: typeof readyToday) =>
      rows.length ? Math.round(rows.reduce((s, r) => s + (r.readyAt!.getTime() - r.openedAt.getTime()), 0) / rows.length / 60_000) : 0;
    const prepNow = prepAvg(readyToday.filter((r) => r.readyAt! >= hourAgo));
    const prepBefore = prepAvg(readyToday.filter((r) => r.readyAt! < hourAgo));
    const revenueToday = todayOrders.reduce((s, o) => s + o.totalHalala, 0);
    const revenueY = yOrders._sum.totalHalala ?? 0;

    const hourly = Array.from({ length: 12 }, (_, i) => i + 10).map((hour) => ({
      hour,
      total: todayOrders.filter((o) => riyadhHour(o.openedAt) === hour).reduce((s, o) => s + o.totalHalala, 0),
    }));

    const byStation = new Map<string, { key: string; nameAr: string; nameEn: string; sort: number; count: number }>();
    for (const t of cookingTickets) {
      const e = byStation.get(t.station.key) ?? { ...t.station, count: 0 };
      e.count += 1;
      byStation.set(t.station.key, e);
    }
    const busiest = [...byStation.values()].sort((a, b) => b.count - a.count)[0];

    return {
      user,
      now,
      cards: {
        occupiedTables: occupied,
        totalTables: total,
        activeOrders: active,
        avgPrepMin: prepNow || prepBefore,
        avgPrepDeltaMin: prepNow && prepBefore ? prepNow - prepBefore : 0,
        revenueToday,
        revenueDeltaPct: pctChange(revenueToday, revenueY),
        delayedOrders: delayed,
      },
      hourlySales: hourly,
      insight:
        cookingTickets.length > 0 && busiest
          ? { kind: 'kitchen_congestion', waiting: cookingTickets.length, thresholdMin: org.delayThresholdMin, station: busiest }
          : null,
      activity: activity.map((a) => {
        const d = (a.data ?? {}) as Record<string, unknown>;
        const ing = typeof d.ingredientId === 'string' ? ingNames.get(d.ingredientId) : undefined;
        return { id: a.id, kind: a.kind, data: ing ? { ...d, nameAr: ing.nameAr, nameEn: ing.nameEn, unit: ing.unit } : d, at: a.at };
      }),
    };
  }

  async notifications() {
    const branchId = currentBranchId();
    const org = await this.db.client.organization.findFirstOrThrow({ select: { delayThresholdMin: true } });
    const delayedBefore = new Date(Date.now() - org.delayThresholdMin * 60_000);
    const [delayed, ingredients, lots] = await Promise.all([
      this.db.client.order.findMany({
        where: { branchId, status: 'in_progress', openedAt: { lt: delayedBefore } },
        select: { id: true, number: true, openedAt: true },
        orderBy: { openedAt: 'asc' },
        take: 10,
      }),
      this.db.client.ingredient.findMany({ select: { id: true, nameAr: true, nameEn: true, unit: true, minLevelMilli: true, reorderLevelMilli: true } }),
      this.db.client.stockLot.groupBy({ by: ['ingredientId'], where: { branchId }, _sum: { qtyMilli: true } }),
    ]);
    const critical = ingredients
      .map((i) => ({ ...i, qtyMilli: lots.find((l) => l.ingredientId === i.id)?._sum.qtyMilli ?? 0 }))
      .filter((i) => ['critical', 'out'].includes(stockStatus(i.qtyMilli, i.minLevelMilli, i.reorderLevelMilli)));
    return {
      count: delayed.length + critical.length,
      items: [
        ...delayed.map((o) => ({ kind: 'order_delayed' as const, id: o.id, number: o.number, at: o.openedAt })),
        ...critical.map((i) => ({ kind: 'stock_critical' as const, id: i.id, nameAr: i.nameAr, nameEn: i.nameEn, qtyMilli: i.qtyMilli, unit: i.unit })),
      ],
    };
  }

  async search(q: string) {
    const branchId = currentBranchId();
    const n = Number(q.replace('#', ''));
    const isNum = Number.isInteger(n) && n > 0;
    const [orders, tables, menu, ingredients] = await Promise.all([
      isNum ? this.db.client.order.findMany({ where: { branchId, number: n }, take: 5, select: { id: true, number: true, status: true } }) : [],
      isNum && n < 1000
        ? this.db.client.diningTable.findMany({ where: { floor: { branchId }, label: n }, take: 5, select: { id: true, label: true, status: true } })
        : [],
      this.db.client.menuItem.findMany({
        where: { OR: [{ nameEn: { contains: q, mode: 'insensitive' } }, { nameAr: { contains: q } }] },
        take: 5,
        select: { id: true, nameAr: true, nameEn: true, image: true, priceHalala: true },
      }),
      this.db.client.ingredient.findMany({
        where: { OR: [{ nameEn: { contains: q, mode: 'insensitive' } }, { nameAr: { contains: q } }] },
        take: 5,
        select: { id: true, nameAr: true, nameEn: true, image: true },
      }),
    ]);
    return { orders, tables, menu, ingredients };
  }
}
