import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { netFromInclusive } from '@sufra/shared';
import { DbService } from '../../common/prisma.service';
import { pctChange, riyadhDateKey, riyadhHour } from '../../common/time';
import { dayKeys, groupOf, Period } from './range';

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

@Injectable()
export class ReportsService {
  constructor(private readonly db: DbService) {}

  private orders(from: Date, to: Date, branchId?: string) {
    return this.db.client.order.findMany({
      where: { openedAt: { gte: from, lt: to }, status: { not: 'cancelled' }, ...(branchId ? { branchId } : {}) },
      select: {
        id: true, branchId: true, channel: true, guests: true, totalHalala: true, vatHalala: true, costHalala: true,
        openedAt: true, readyAt: true, status: true,
      },
    });
  }

  private async wastePct(from: Date, to: Date, branchId?: string) {
    const rows = await this.db.client.stockMovement.groupBy({
      by: ['type'],
      where: { at: { gte: from, lt: to }, type: { in: ['sale', 'waste'] }, ...(branchId ? { branchId } : {}) },
      _sum: { costHalala: true },
    });
    const waste = rows.find((r) => r.type === 'waste')?._sum.costHalala ?? 0;
    const sale = rows.find((r) => r.type === 'sale')?._sum.costHalala ?? 0;
    return waste + sale > 0 ? Math.round((waste / (waste + sale)) * 1000) / 10 : 0;
  }

  async overview(p: Period, branchId?: string) {
    const [cur, prev, wasteNow, wastePrev] = await Promise.all([
      this.orders(p.from, p.to, branchId),
      this.orders(p.prevFrom, p.prevTo, branchId),
      this.wastePct(p.from, p.to, branchId),
      this.wastePct(p.prevFrom, p.prevTo, branchId),
    ]);
    const revenue = (os: typeof cur) => sum(os.map((o) => o.totalHalala));
    const customers = (os: typeof cur) => sum(os.map((o) => (o.channel === 'dine_in' ? (o.guests ?? 1) : 1)));
    const prep = (os: typeof cur) => {
      const done = os.filter((o) => o.readyAt);
      return done.length ? Math.round(sum(done.map((o) => (o.readyAt!.getTime() - o.openedAt.getTime()) / 60_000)) / done.length) : 0;
    };

    const keys = dayKeys(p);
    const daily = keys.map((k) => ({ day: k, revenue: revenue(cur.filter((o) => riyadhDateKey(o.openedAt) === k)) }));
    // Weekly: 7-day buckets ending today over the last 8 weeks.
    const weeklyOrders = await this.orders(new Date(p.to.getTime() - 56 * 86_400_000), p.to, branchId);
    const weekly = Array.from({ length: 8 }, (_, i) => {
      const end = p.to.getTime() - (7 - i) * 7 * 86_400_000;
      const start = end - 7 * 86_400_000;
      return {
        weekStart: riyadhDateKey(new Date(start)),
        revenue: revenue(weeklyOrders.filter((o) => o.openedAt.getTime() >= start && o.openedAt.getTime() < end)),
      };
    });

    const trend = keys.map((k) => {
      const os = cur.filter((o) => riyadhDateKey(o.openedAt) === k);
      return { day: k, dineIn: os.filter((o) => o.channel === 'dine_in').length, takeaway: os.filter((o) => o.channel !== 'dine_in').length };
    });

    // Items and categories
    const itemWhere = (from: Date, to: Date): Prisma.OrderItemWhereInput => ({
      order: { openedAt: { gte: from, lt: to }, status: { not: 'cancelled' }, ...(branchId ? { branchId } : {}) },
    });
    const [items, prevItems, menu] = await Promise.all([
      this.db.client.orderItem.groupBy({ by: ['menuItemId'], where: itemWhere(p.from, p.to), _sum: { qty: true } }),
      this.db.client.orderItem.groupBy({ by: ['menuItemId'], where: itemWhere(p.prevFrom, p.prevTo), _sum: { qty: true } }),
      this.db.client.menuItem.findMany({ include: { category: { select: { key: true } } } }),
    ]);
    const lines = await this.db.client.orderItem.findMany({ where: itemWhere(p.from, p.to), select: { menuItemId: true, qty: true, unitPrice: true } });
    const revByItem = new Map<string, number>();
    for (const l of lines) revByItem.set(l.menuItemId, (revByItem.get(l.menuItemId) ?? 0) + l.qty * l.unitPrice);
    const itemsRevenue = sum([...revByItem.values()]);
    const top = items
      .map((i) => {
        const m = menu.find((x) => x.id === i.menuItemId)!;
        const prevSold = prevItems.find((x) => x.menuItemId === i.menuItemId)?._sum.qty ?? 0;
        const sold = i._sum.qty ?? 0;
        const rev = revByItem.get(i.menuItemId) ?? 0;
        return {
          id: m.id, nameAr: m.nameAr, nameEn: m.nameEn, image: m.image, sold, revenue: rev,
          sharePct: itemsRevenue ? Math.round((rev / itemsRevenue) * 100) : 0,
          up: sold >= prevSold,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    const groups = { food: 0, beverages: 0, desserts: 0, others: 0 };
    for (const [id, rev] of revByItem) groups[groupOf(menu.find((m) => m.id === id)!.category.key)] += rev;

    // Feedback
    const fb = await this.db.client.feedback.findMany({
      where: { at: { gte: p.from, lt: p.to }, ...(branchId ? { branchId } : {}) },
      orderBy: { at: 'desc' },
    });
    const dist = [5, 4, 3, 2, 1].map((star) => ({ star, count: fb.filter((f) => f.rating === star).length }));
    const quote = fb.find((f) => f.rating === 5 && f.comment);

    // Branches
    const branches = await this.db.client.branch.findMany({ orderBy: { createdAt: 'asc' } });
    const allCur = branchId ? await this.orders(p.from, p.to) : cur;
    const allPrev = branchId ? await this.orders(p.prevFrom, p.prevTo) : prev;
    const branchRows = branches
      .map((b) => {
        const r = revenue(allCur.filter((o) => o.branchId === b.id));
        const rp = revenue(allPrev.filter((o) => o.branchId === b.id));
        return { id: b.id, nameAr: b.nameAr, nameEn: b.nameEn, revenue: r, growthPct: pctChange(r, rp) };
      })
      .sort((a, b) => b.revenue - a.revenue);

    // Insights
    const hours = new Array(24).fill(0) as number[];
    for (const o of cur) hours[riyadhHour(o.openedAt)]! += 1;
    let peak = 0;
    for (let h = 0; h < 23; h++) if (hours[h]! + hours[h + 1]! > hours[peak]! + hours[peak + 1]!) peak = h;
    const produceWaste = await this.produceWasteChange(p, branchId);

    const revNow = revenue(cur);
    const revPrev = revenue(prev);
    return {
      period: { from: p.from, to: p.to, days: p.days },
      cards: {
        revenue: revNow, revenueDeltaPct: pctChange(revNow, revPrev),
        orders: cur.length, ordersDeltaPct: pctChange(cur.length, prev.length),
        customers: customers(cur), customersDeltaPct: pctChange(customers(cur), customers(prev)),
        avgPrepMin: prep(cur), avgPrepDeltaPct: pctChange(prep(cur), prep(prev)),
        wastePct: wasteNow, wasteDeltaPct: pctChange(wasteNow, wastePrev),
      },
      revenueDaily: daily,
      revenueWeekly: weekly,
      salesByCategory: {
        total: revNow,
        groups: (Object.keys(groups) as (keyof typeof groups)[]).map((k) => ({
          key: k, amount: groups[k], pct: itemsRevenue ? Math.round((groups[k] / itemsRevenue) * 100) : 0,
        })),
      },
      topItems: top.slice(0, 5),
      ordersTrend: trend,
      feedback: {
        avg: fb.length ? Math.round((sum(fb.map((f) => f.rating)) / fb.length) * 10) / 10 : 0,
        count: fb.length,
        distribution: dist.map((d) => ({ ...d, pct: fb.length ? Math.round((d.count / fb.length) * 100) : 0 })),
        quote: quote ? { text: quote.comment, author: quote.authorName, rating: quote.rating } : null,
      },
      branches: branchRows,
      insights: {
        salesChangePct: pctChange(revNow, revPrev),
        produceWasteChangePct: produceWaste,
        peakStartHour: peak,
        peakEndHour: peak + 2,
      },
      net: netFromInclusive(revNow),
    };
  }

  /** Change in produce (vegetable) waste cost vs the previous period, %. */
  async produceWasteChange(p: Period, branchId?: string) {
    const q = (from: Date, to: Date) =>
      this.db.client.stockMovement.aggregate({
        where: { type: 'waste', at: { gte: from, lt: to }, ingredient: { category: 'produce' }, ...(branchId ? { branchId } : {}) },
        _sum: { costHalala: true },
      });
    const [a, b] = await Promise.all([q(p.from, p.to), q(p.prevFrom, p.prevTo)]);
    return pctChange(a._sum.costHalala ?? 0, b._sum.costHalala ?? 0);
  }

  async vat(p: Period) {
    const invoices = await this.db.client.invoice.findMany({ where: { issuedAt: { gte: p.from, lt: p.to } } });
    const total = sum(invoices.map((i) => i.totalHalala));
    const vat = sum(invoices.map((i) => i.vatHalala));
    return {
      invoices: invoices.length,
      total, vat, net: total - vat,
      byStatus: ['pending', 'reported', 'cleared', 'rejected', 'warning'].map((s) => ({ status: s, count: invoices.filter((i) => i.status === s).length })),
    };
  }

  async csv(p: Period, branchId?: string) {
    const o = await this.overview(p, branchId);
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const rows: (string | number)[][] = [
      ['Metric', 'المؤشر', 'Value'],
      ['Revenue (SAR)', 'الإيراد', (o.cards.revenue / 100).toFixed(2)],
      ['Orders', 'الطلبات', o.cards.orders],
      ['Customers', 'العملاء', o.cards.customers],
      ['Avg. preparation (min)', 'متوسط التحضير', o.cards.avgPrepMin],
      ['Food waste %', 'نسبة الهدر', o.cards.wastePct],
      [],
      ['Day', 'اليوم', 'Revenue (SAR)'],
      ...o.revenueDaily.map((d) => [d.day, '', (d.revenue / 100).toFixed(2)]),
      [],
      ['Item', 'الصنف', 'Sold', 'Revenue (SAR)'],
      ...o.topItems.map((t) => [t.nameEn, t.nameAr, t.sold, (t.revenue / 100).toFixed(2)]),
    ];
    return '﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n');
  }
}
