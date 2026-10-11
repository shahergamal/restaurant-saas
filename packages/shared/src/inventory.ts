export type StockStatus = 'in_stock' | 'low' | 'critical' | 'out';

/**
 * Status from the current quantity and the ingredient thresholds (same unit, thousandths).
 * critical: at or below the minimum level; low: at or below the reorder level.
 */
export function stockStatus(qtyMilli: number, minLevelMilli: number, reorderLevelMilli: number): StockStatus {
  if (qtyMilli <= 0) return 'out';
  if (qtyMilli <= minLevelMilli) return 'critical';
  if (qtyMilli <= reorderLevelMilli) return 'low';
  return 'in_stock';
}

export interface Lot {
  id: string;
  qtyMilli: number;
  expiresAt: Date | null;
}

/**
 * First-expired-first-out consumption plan. Lots without expiry are used last.
 * Returns the quantity taken from each lot; throws when stock is insufficient unless allowNegative.
 */
export function planFefo(
  lots: Lot[],
  requiredMilli: number,
  allowNegative = false,
): { lotId: string | null; qtyMilli: number }[] {
  if (requiredMilli < 0) throw new RangeError('required quantity must be >= 0');
  const sorted = [...lots]
    .filter((l) => l.qtyMilli > 0)
    .sort((a, b) => {
      const ae = a.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY;
      const be = b.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY;
      return ae - be;
    });
  const plan: { lotId: string | null; qtyMilli: number }[] = [];
  let remaining = requiredMilli;
  for (const lot of sorted) {
    if (remaining === 0) break;
    const take = Math.min(lot.qtyMilli, remaining);
    plan.push({ lotId: lot.id, qtyMilli: take });
    remaining -= take;
  }
  if (remaining > 0) {
    if (!allowNegative) throw new RangeError('insufficient stock');
    plan.push({ lotId: null, qtyMilli: remaining });
  }
  return plan;
}
