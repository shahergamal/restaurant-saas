import { describe, expect, it } from 'vitest';
import { planFefo, stockStatus } from './inventory';

describe('stockStatus', () => {
  it('maps thresholds', () => {
    expect(stockStatus(0, 2000, 5000)).toBe('out');
    expect(stockStatus(2000, 2000, 5000)).toBe('critical');
    expect(stockStatus(4000, 2000, 5000)).toBe('low');
    expect(stockStatus(9000, 2000, 5000)).toBe('in_stock');
  });
});

describe('planFefo', () => {
  const lots = [
    { id: 'late', qtyMilli: 5000, expiresAt: new Date('2026-06-10') },
    { id: 'none', qtyMilli: 5000, expiresAt: null },
    { id: 'early', qtyMilli: 1000, expiresAt: new Date('2026-06-01') },
    { id: 'empty', qtyMilli: 0, expiresAt: new Date('2026-05-01') },
  ];
  it('consumes the earliest expiry first', () => {
    expect(planFefo(lots, 3000)).toEqual([
      { lotId: 'early', qtyMilli: 1000 },
      { lotId: 'late', qtyMilli: 2000 },
    ]);
  });
  it('uses lots without expiry last', () => {
    expect(planFefo(lots, 7000).at(-1)).toEqual({ lotId: 'none', qtyMilli: 1000 });
  });
  it('throws or goes negative when short', () => {
    expect(() => planFefo(lots, 20000)).toThrow();
    expect(planFefo(lots, 12000, true).at(-1)).toEqual({ lotId: null, qtyMilli: 1000 });
    expect(() => planFefo(lots, -1)).toThrow();
  });
});
