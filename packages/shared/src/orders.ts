import { applyBp, Halala, vatFromInclusive, VAT_RATE_BP } from './money';

export interface PricedLine {
  /** VAT-inclusive unit price in halalas (menu prices in KSA are shown VAT-inclusive). */
  unitPrice: Halala;
  qty: number;
  /** Optional per-line modifier surcharge, VAT-inclusive, per unit. */
  modifiersPrice?: Halala;
}

export type Discount =
  | { type: 'none' }
  | { type: 'percent'; bp: number }
  | { type: 'amount'; amount: Halala };

export interface TotalsInput {
  lines: PricedLine[];
  discount?: Discount;
  /** Service charge in basis points. It is part of the VAT base. */
  serviceChargeBp?: number;
  /** Tip is not part of the VAT base. */
  tip?: Halala;
  vatRateBp?: number;
}

export interface Totals {
  itemsTotal: Halala;
  discount: Halala;
  serviceCharge: Halala;
  /** Taxable amount excluding VAT. */
  net: Halala;
  vat: Halala;
  /** Amount due for the invoice (VAT-inclusive, excludes tip). */
  total: Halala;
  tip: Halala;
  /** What the guest pays. */
  grandTotal: Halala;
}

export function computeTotals(input: TotalsInput): Totals {
  const rate = input.vatRateBp ?? VAT_RATE_BP;
  const itemsTotal = input.lines.reduce((sum, l) => {
    if (!Number.isInteger(l.qty) || l.qty < 0) throw new RangeError('qty must be a non-negative integer');
    return sum + (l.unitPrice + (l.modifiersPrice ?? 0)) * l.qty;
  }, 0);

  const d = input.discount ?? { type: 'none' };
  let discount = 0;
  if (d.type === 'percent') {
    if (d.bp < 0 || d.bp > 10_000) throw new RangeError('discount percent out of range');
    discount = applyBp(itemsTotal, d.bp);
  } else if (d.type === 'amount') {
    if (d.amount < 0) throw new RangeError('discount amount must be >= 0');
    discount = Math.min(d.amount, itemsTotal);
  }

  const afterDiscount = itemsTotal - discount;
  // Service charge on the inclusive amount equals service on the net amount grossed up by VAT,
  // so the invoice total stays consistent with VAT-inclusive menu prices.
  const serviceCharge = applyBp(afterDiscount, input.serviceChargeBp ?? 0);
  const total = afterDiscount + serviceCharge;
  const vat = vatFromInclusive(total, rate);
  const tip = input.tip ?? 0;
  if (tip < 0) throw new RangeError('tip must be >= 0');

  return { itemsTotal, discount, serviceCharge, net: total - vat, vat, total, tip, grandTotal: total + tip };
}

export type OrderStatus = 'in_progress' | 'ready' | 'delayed' | 'served' | 'paid' | 'cancelled';

/** An open order counts as delayed after this many minutes without being ready. */
export const DELAY_THRESHOLD_MIN = 20;

export function deriveOrderStatus(
  stored: OrderStatus,
  openedAt: Date,
  now: Date,
  thresholdMin = DELAY_THRESHOLD_MIN,
): OrderStatus {
  if (stored !== 'in_progress') return stored;
  const minutes = (now.getTime() - openedAt.getTime()) / 60_000;
  return minutes > thresholdMin ? 'delayed' : 'in_progress';
}

export function elapsedMinutes(from: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - from.getTime()) / 60_000));
}
