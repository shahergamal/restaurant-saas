import { Halala, netFromInclusive, roundDiv, VAT_RATE_BP } from './money';

export interface RecipeLine {
  /** Quantity in the ingredient's base unit, in thousandths (e.g. grams for kg -> 250 = 0.250 kg). */
  qtyMilli: number;
  /** Cost per base unit in halalas (e.g. per kg). */
  unitCost: Halala;
  /** Waste percentage in basis points (5% = 500). */
  wasteBp?: number;
}

/** Cost of one portion: sum of qty x (1 + waste) x unit cost, rounded once at the end. */
export function recipeCost(lines: RecipeLine[]): Halala {
  // numerator scale: qtyMilli (1/1000) * (10000 + wasteBp) (1/10000)
  const numerator = lines.reduce((sum, l) => {
    if (l.qtyMilli < 0 || l.unitCost < 0) throw new RangeError('negative recipe values');
    return sum + l.qtyMilli * (10_000 + (l.wasteBp ?? 0)) * l.unitCost;
  }, 0);
  return roundDiv(numerator, 1000 * 10_000);
}

/**
 * Profit margin in basis points: (price before VAT - cost) / price before VAT.
 * `priceInclusive` is the menu price including VAT.
 */
export function marginBp(priceInclusive: Halala, cost: Halala, vatRateBp = VAT_RATE_BP): number {
  const net = netFromInclusive(priceInclusive, vatRateBp);
  if (net <= 0) return 0;
  return roundDiv((net - cost) * 10_000, net);
}

/** Food cost percentage in basis points = cost / net sales. */
export function foodCostBp(netSales: Halala, cost: Halala): number {
  if (netSales <= 0) return 0;
  return roundDiv(cost * 10_000, netSales);
}

/**
 * Channel profitability: margin per portion after the delivery platform commission.
 * Commission is charged on the VAT-inclusive order value.
 */
export function channelProfit(
  priceInclusive: Halala,
  cost: Halala,
  commissionBp: number,
  vatRateBp = VAT_RATE_BP,
): { net: Halala; commission: Halala; profit: Halala; marginBp: number } {
  const net = netFromInclusive(priceInclusive, vatRateBp);
  const commission = roundDiv(priceInclusive * commissionBp, 10_000);
  const profit = net - cost - commission;
  return { net, commission, profit, marginBp: net > 0 ? roundDiv(profit * 10_000, net) : 0 };
}

export type MenuClass = 'star' | 'plowhorse' | 'puzzle' | 'dog';

export interface MenuEngineeringItem {
  id: string;
  sold: number;
  /** Contribution margin per portion (net price - cost), halalas. */
  contribution: Halala;
}

/**
 * Kasavana & Smith menu engineering.
 * Popular when the item's share of units >= 70% of an equal share (1 / n).
 * High margin when contribution >= the sales-weighted average contribution.
 */
export function classifyMenu(items: MenuEngineeringItem[]): Record<string, MenuClass> {
  const result: Record<string, MenuClass> = {};
  const n = items.length;
  const totalSold = items.reduce((s, i) => s + i.sold, 0);
  if (n === 0 || totalSold === 0) {
    for (const i of items) result[i.id] = 'dog';
    return result;
  }
  const avgContribution = items.reduce((s, i) => s + i.contribution * i.sold, 0) / totalSold;
  const popularityThreshold = (1 / n) * 0.7;
  for (const i of items) {
    const popular = i.sold / totalSold >= popularityThreshold;
    const profitable = i.contribution >= avgContribution;
    result[i.id] = popular ? (profitable ? 'star' : 'plowhorse') : profitable ? 'puzzle' : 'dog';
  }
  return result;
}
