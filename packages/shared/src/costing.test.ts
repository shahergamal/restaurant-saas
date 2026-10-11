import { describe, expect, it } from 'vitest';
import { channelProfit, classifyMenu, foodCostBp, marginBp, recipeCost } from './costing';

describe('recipeCost', () => {
  it('sums qty x (1 + waste) x unit cost', () => {
    // 250 g chicken at 32.00/kg with 10% waste = 8.80 ; 150 g rice at 9.00/kg = 1.35
    expect(recipeCost([
      { qtyMilli: 250, unitCost: 3200, wasteBp: 1000 },
      { qtyMilli: 150, unitCost: 900 },
    ])).toBe(1015);
  });
  it('rejects negative values', () => expect(() => recipeCost([{ qtyMilli: -1, unitCost: 1 }])).toThrow());
});

describe('margins', () => {
  it('computes margin on the pre-VAT price', () => {
    // price 57.50 incl. VAT -> 50.00 net, cost 15.00 -> 70%
    expect(marginBp(5750, 1500)).toBe(7000);
    expect(marginBp(0, 100)).toBe(0);
  });
  it('computes food cost %', () => {
    expect(foodCostBp(10000, 3300)).toBe(3300);
    expect(foodCostBp(0, 10)).toBe(0);
  });
  it('deducts the delivery commission', () => {
    const p = channelProfit(5750, 1500, 2000); // 20% of 57.50 = 11.50
    expect(p.commission).toBe(1150);
    expect(p.profit).toBe(5000 - 1500 - 1150);
    expect(p.marginBp).toBe(4700);
    expect(channelProfit(0, 0, 0).marginBp).toBe(0);
  });
});

describe('classifyMenu', () => {
  it('classifies the four quadrants', () => {
    const r = classifyMenu([
      { id: 'star', sold: 100, contribution: 3000 },
      { id: 'horse', sold: 100, contribution: 1000 },
      { id: 'puzzle', sold: 5, contribution: 4000 },
      { id: 'dog', sold: 5, contribution: 500 },
    ]);
    expect(r).toEqual({ star: 'star', horse: 'plowhorse', puzzle: 'puzzle', dog: 'dog' });
  });
  it('handles empty sales', () => {
    expect(classifyMenu([{ id: 'a', sold: 0, contribution: 1 }])).toEqual({ a: 'dog' });
    expect(classifyMenu([])).toEqual({});
  });
});
