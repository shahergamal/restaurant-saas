import { describe, expect, it } from 'vitest';
import { computeTotals, deriveOrderStatus, elapsedMinutes } from './orders';
import { splitEven, vatFromInclusive } from './money';

describe('computeTotals', () => {
  it('handles a plain VAT-inclusive order', () => {
    const t = computeTotals({ lines: [{ unitPrice: 5600, qty: 2 }, { unitPrice: 1400, qty: 1 }] });
    expect(t.itemsTotal).toBe(12600);
    expect(t.total).toBe(12600);
    expect(t.vat).toBe(1643); // 12600 * 15/115 = 1643.48
    expect(t.net + t.vat).toBe(t.total);
  });

  it('applies a percentage discount before VAT', () => {
    const t = computeTotals({ lines: [{ unitPrice: 10000, qty: 1 }], discount: { type: 'percent', bp: 1000 } });
    expect(t.discount).toBe(1000);
    expect(t.total).toBe(9000);
    expect(t.vat).toBe(vatFromInclusive(9000));
  });

  it('caps an amount discount at the items total', () => {
    const t = computeTotals({ lines: [{ unitPrice: 500, qty: 1 }], discount: { type: 'amount', amount: 900 } });
    expect(t.total).toBe(0);
    expect(t.vat).toBe(0);
  });

  it('puts the service charge inside the VAT base', () => {
    const t = computeTotals({ lines: [{ unitPrice: 11500, qty: 1 }], serviceChargeBp: 1000 });
    expect(t.serviceCharge).toBe(1150);
    expect(t.total).toBe(12650);
    expect(t.vat).toBe(1650); // 15% of 11000 net
  });

  it('keeps the tip outside the VAT base', () => {
    const t = computeTotals({ lines: [{ unitPrice: 11500, qty: 1 }], tip: 500 });
    expect(t.vat).toBe(1500);
    expect(t.grandTotal).toBe(12000);
  });

  it('includes modifier surcharges', () => {
    const t = computeTotals({ lines: [{ unitPrice: 1000, qty: 2, modifiersPrice: 200 }] });
    expect(t.itemsTotal).toBe(2400);
  });

  it('split bills sum exactly to the original total and VAT never drifts more than one halala per part', () => {
    const t = computeTotals({ lines: [{ unitPrice: 3333, qty: 3 }], discount: { type: 'percent', bp: 500 }, serviceChargeBp: 1000 });
    const parts = splitEven(t.total, 3);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(t.total);
    const partsVat = parts.map((p) => vatFromInclusive(p)).reduce((a, b) => a + b, 0);
    expect(Math.abs(partsVat - t.vat)).toBeLessThanOrEqual(parts.length);
  });

  it('rejects invalid inputs', () => {
    expect(() => computeTotals({ lines: [{ unitPrice: 100, qty: 1.5 }] })).toThrow();
    expect(() => computeTotals({ lines: [], discount: { type: 'percent', bp: 20000 } })).toThrow();
    expect(() => computeTotals({ lines: [], discount: { type: 'amount', amount: -1 } })).toThrow();
    expect(() => computeTotals({ lines: [], tip: -1 })).toThrow();
  });
});

describe('order status', () => {
  const opened = new Date('2026-05-16T12:00:00Z');
  it('marks in-progress orders delayed after the threshold', () => {
    expect(deriveOrderStatus('in_progress', opened, new Date('2026-05-16T12:19:00Z'))).toBe('in_progress');
    expect(deriveOrderStatus('in_progress', opened, new Date('2026-05-16T12:21:00Z'))).toBe('delayed');
    expect(deriveOrderStatus('ready', opened, new Date('2026-05-16T13:00:00Z'))).toBe('ready');
  });
  it('computes elapsed minutes', () => {
    expect(elapsedMinutes(opened, new Date('2026-05-16T12:12:59Z'))).toBe(12);
    expect(elapsedMinutes(opened, new Date('2026-05-16T11:00:00Z'))).toBe(0);
  });
});
