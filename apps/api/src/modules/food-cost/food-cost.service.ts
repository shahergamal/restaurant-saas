import { Injectable } from '@nestjs/common';
import { channelProfit, classifyMenu, marginBp, netFromInclusive, recipeCost } from '@sufra/shared';
import { DbService } from '../../common/prisma.service';
import { currentBranchId } from '../../common/tenant-context';
import { pctChange, riyadhDateKey } from '../../common/time';
import { dayKeys, Period } from '../reports/range';

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

@Injectable()
export class FoodCostService {
  constructor(private readonly db: DbService) {}

  private branch(branchId?: string) {
    return branchId ?? currentBranchId();
  }

  private async paidOrders(from: Date, to: Date, branchId: string) {
    return this.db.client.order.findMany({
      where: { branchId, status: 'paid', closedAt: { gte: from, lt: to } },
      select: { id: true, totalHalala: true, vatHalala: true, costHalala: true, closedAt: true },
    });
  }

  private async waste(from: Date, to: Date, branchId: string) {
    const rows = await this.db.client.stockMovement.groupBy({
      by: ['type'],
      where: { branchId, at: { gte: from, lt: to }, type: { in: ['sale', 'waste'] } },
      _sum: { costHalala: true },
    });
    const w = rows.find((r) => r.type === 'waste')?._sum.costHalala ?? 0;
    const s = rows.find((r) => r.type === 'sale')?._sum.costHalala ?? 0;
    return { wasteCost: w, pct: w + s ? Math.round((w / (w + s)) * 1000) / 10 : 0 };
  }

  /** Current recipe cost and margin for every active menu item. */
  private async menuCosts() {
    const items = await this.db.client.menuItem.findMany({
      where: { active: true },
      include: { category: true, recipe: { include: { ingredient: { select: { avgCostHalala: true } } } } },
      orderBy: { nameEn: 'asc' },
    });
    return items.map((m) => {
      const cost = recipeCost(m.recipe.map((r) => ({ qtyMilli: r.qtyMilli, wasteBp: r.wasteBp, unitCost: r.ingredient.avgCostHalala })));
      return { item: m, cost, marginBp: marginBp(m.priceHalala, cost, m.vatRateBp) };
    });
  }

  async overview(p: Period, branchId?: string) {
    const b = this.branch(branchId);
    const org = await this.db.client.organization.findFirstOrThrow({ select: { targetMarginBp: true } });
    const [cur, prev, wNow, wPrev, expenses] = await Promise.all([
      this.paidOrders(p.from, p.to, b),
      this.paidOrders(p.prevFrom, p.prevTo, b),
      this.waste(p.from, p.to, b),
      this.waste(p.prevFrom, p.prevTo, b),
      this.db.client.expense.groupBy({ by: ['category'], where: { branchId: b, day: { gte: p.from, lt: p.to } }, _sum: { amountHalala: true } }),
    ]);
    const net = (os: typeof cur) => sum(os.map((o) => o.totalHalala - o.vatHalala));
    const cost = (os: typeof cur) => sum(os.map((o) => o.costHalala));
    const margin = (os: typeof cur) => (net(os) ? Math.round(((net(os) - cost(os)) / net(os)) * 100) : 0);

    const keys = dayKeys(p);
    const series = keys.map((k) => {
      const os = cur.filter((o) => riyadhDateKey(o.closedAt!) === k);
      return { day: k, sales: net(os), cost: cost(os) };
    });

    const ingredientsCost = cost(cur);
    const exp = (k: 'labor' | 'overheads' | 'packaging') => expenses.find((e) => e.category === k)?._sum.amountHalala ?? 0;
    const breakdownParts = [
      { key: 'ingredients', amount: ingredientsCost },
      { key: 'labor', amount: exp('labor') },
      { key: 'overheads', amount: exp('overheads') },
      { key: 'packaging', amount: exp('packaging') },
    ];
    const breakdownTotal = sum(breakdownParts.map((x) => x.amount));

    // Top cost ingredients (consumed by sales in the period)
    const consumed = await this.db.client.stockMovement.groupBy({
      by: ['ingredientId'],
      where: { branchId: b, type: 'sale', at: { gte: p.from, lt: p.to } },
      _sum: { costHalala: true },
      orderBy: { _sum: { costHalala: 'desc' } },
      take: 10,
    });
    const ingNames = await this.db.client.ingredient.findMany({
      where: { id: { in: consumed.map((c) => c.ingredientId) } },
      select: { id: true, nameAr: true, nameEn: true, image: true },
    });
    const consumedTotal = ingredientsCost || 1;
    const topIngredients = consumed.map((c) => {
      const i = ingNames.find((x) => x.id === c.ingredientId)!;
      const amount = c._sum.costHalala ?? 0;
      return { id: i.id, nameAr: i.nameAr, nameEn: i.nameEn, image: i.image, amount, pct: Math.round((amount / consumedTotal) * 100) };
    });

    // Margin by category (from actual sales lines)
    const lines = await this.db.client.orderItem.findMany({
      where: { order: { branchId: b, status: 'paid', closedAt: { gte: p.from, lt: p.to } } },
      select: { qty: true, unitPrice: true, unitCost: true, menuItem: { select: { vatRateBp: true, category: { select: { key: true, nameAr: true, nameEn: true } } } } },
    });
    const cats = new Map<string, { nameAr: string; nameEn: string; net: number; cost: number }>();
    for (const l of lines) {
      const c = l.menuItem.category;
      const e = cats.get(c.key) ?? { nameAr: c.nameAr, nameEn: c.nameEn, net: 0, cost: 0 };
      e.net += netFromInclusive(l.unitPrice * l.qty, l.menuItem.vatRateBp);
      e.cost += l.unitCost * l.qty;
      cats.set(c.key, e);
    }
    const marginByCategory = [...cats.entries()]
      .map(([key, v]) => ({ key, nameAr: v.nameAr, nameEn: v.nameEn, marginPct: v.net ? Math.round(((v.net - v.cost) / v.net) * 100) : 0, net: v.net }))
      .sort((a, b) => b.net - a.net)
      .slice(0, 5);

    // Insights
    const menu = await this.menuCosts();
    const lowMargin = menu.filter((m) => m.marginBp < org.targetMarginBp).sort((a, b) => a.marginBp - b.marginBp)[0];
    const rise = await this.biggestCostRise(p, b);
    const produce = await this.produceWaste(p, b);

    const nNow = net(cur);
    const nPrev = net(prev);
    return {
      cards: {
        foodSales: nNow, foodSalesDeltaPct: pctChange(nNow, nPrev),
        foodCost: ingredientsCost, foodCostDeltaPct: pctChange(ingredientsCost, cost(prev)),
        marginPct: margin(cur), marginDeltaPct: pctChange(margin(cur), margin(prev)),
        wastePct: wNow.pct, wasteDeltaPct: pctChange(wNow.pct, wPrev.pct),
      },
      series,
      breakdown: {
        total: breakdownTotal,
        parts: breakdownParts.map((x) => ({ ...x, pct: breakdownTotal ? Math.round((x.amount / breakdownTotal) * 100) : 0 })),
      },
      topIngredients: topIngredients.slice(0, 5),
      marginByCategory,
      insights: {
        costRise: rise,
        lowMargin: lowMargin
          ? { nameAr: lowMargin.item.nameAr, nameEn: lowMargin.item.nameEn, marginPct: Math.round(lowMargin.marginBp / 100), targetPct: org.targetMarginBp / 100 }
          : null,
        produceWasteChangePct: produce,
      },
    };
  }

  private async biggestCostRise(p: Period, branchId: string) {
    const purchases = await this.db.client.stockLot.findMany({
      where: { branchId, receivedAt: { gte: p.prevFrom, lt: p.to } },
      select: { ingredientId: true, costPerUnit: true, receivedAt: true, qtyMilli: true },
    });
    const byIng = new Map<string, { now: number[]; prev: number[] }>();
    for (const l of purchases) {
      const e = byIng.get(l.ingredientId) ?? { now: [], prev: [] };
      (l.receivedAt >= p.from ? e.now : e.prev).push(l.costPerUnit);
      byIng.set(l.ingredientId, e);
    }
    let best: { id: string; pct: number } | null = null;
    for (const [id, e] of byIng) {
      if (!e.now.length || !e.prev.length) continue;
      const pct = pctChange(sum(e.now) / e.now.length, sum(e.prev) / e.prev.length);
      if (pct > 0 && (!best || pct > best.pct)) best = { id, pct };
    }
    if (!best) return null;
    const ing = await this.db.client.ingredient.findUniqueOrThrow({ where: { id: best.id }, select: { nameAr: true, nameEn: true } });
    return { ...ing, pct: Math.round(best.pct) };
  }

  private async produceWaste(p: Period, branchId: string) {
    const q = (from: Date, to: Date) =>
      this.db.client.stockMovement.aggregate({
        where: { branchId, type: 'waste', at: { gte: from, lt: to }, ingredient: { category: 'produce' } },
        _sum: { costHalala: true },
      });
    const [a, b] = await Promise.all([q(p.from, p.to), q(p.prevFrom, p.prevTo)]);
    return Math.round(pctChange(a._sum.costHalala ?? 0, b._sum.costHalala ?? 0));
  }

  /** Menu item performance with a daily margin trend (sparkline) over the period. */
  async items(p: Period, filter: 'all' | 'top' | 'low', branchId?: string) {
    const b = this.branch(branchId);
    const org = await this.db.client.organization.findFirstOrThrow({ select: { targetMarginBp: true } });
    const menu = await this.menuCosts();
    const lines = await this.db.client.orderItem.findMany({
      where: { order: { branchId: b, status: 'paid', closedAt: { gte: p.from, lt: p.to } } },
      select: { menuItemId: true, qty: true, unitPrice: true, unitCost: true, order: { select: { closedAt: true } } },
    });
    const keys = dayKeys(p);
    let rows = menu.map((m) => {
      const own = lines.filter((l) => l.menuItemId === m.item.id);
      const trend = keys.map((k) => {
        const day = own.filter((l) => riyadhDateKey(l.order.closedAt!) === k);
        const net = sum(day.map((l) => netFromInclusive(l.unitPrice * l.qty, m.item.vatRateBp)));
        const cost = sum(day.map((l) => l.unitCost * l.qty));
        return net ? Math.round(((net - cost) / net) * 100) : null;
      });
      return {
        id: m.item.id,
        nameAr: m.item.nameAr,
        nameEn: m.item.nameEn,
        image: m.item.image,
        categoryAr: m.item.category.nameAr,
        categoryEn: m.item.category.nameEn,
        cost: m.cost,
        price: m.item.priceHalala,
        marginPct: Math.round(m.marginBp / 100),
        sold: sum(own.map((l) => l.qty)),
        trend,
        belowTarget: m.marginBp < org.targetMarginBp,
      };
    });
    if (filter === 'top') rows = rows.sort((a, b) => b.marginPct - a.marginPct).slice(0, 10);
    if (filter === 'low') rows = rows.filter((r) => r.belowTarget || r.marginPct < 60).sort((a, b) => a.marginPct - b.marginPct);
    if (filter === 'all') rows = rows.sort((a, b) => b.sold - a.sold);
    return { targetMarginPct: org.targetMarginBp / 100, items: rows };
  }

  /** Menu engineering quadrants (popularity x contribution) and per-channel profitability. */
  async engineering(p: Period, branchId?: string) {
    const b = this.branch(branchId);
    const menu = await this.menuCosts();
    const sold = await this.db.client.orderItem.groupBy({
      by: ['menuItemId'],
      where: { order: { branchId: b, status: 'paid', closedAt: { gte: p.from, lt: p.to } } },
      _sum: { qty: true },
    });
    const items = menu.map((m) => ({
      id: m.item.id,
      sold: sold.find((s) => s.menuItemId === m.item.id)?._sum.qty ?? 0,
      contribution: netFromInclusive(m.item.priceHalala, m.item.vatRateBp) - m.cost,
    }));
    const classes = classifyMenu(items);
    const channels = await this.db.client.deliveryChannel.findMany({ where: { branchId: b } });
    return {
      items: menu.map((m) => {
        const i = items.find((x) => x.id === m.item.id)!;
        return {
          id: m.item.id, nameAr: m.item.nameAr, nameEn: m.item.nameEn, image: m.item.image, sold: i.sold, contribution: i.contribution,
          class: classes[m.item.id],
          channels: [
            { platform: 'dine_in', ...channelProfit(m.item.priceHalala, m.cost, 0, m.item.vatRateBp) },
            ...channels.map((c) => ({ platform: c.platform, ...channelProfit(m.item.priceHalala, m.cost, c.commissionBp, m.item.vatRateBp) })),
          ],
        };
      }),
      channels: channels.map((c) => ({ platform: c.platform, commissionPct: c.commissionBp / 100 })),
    };
  }
}
