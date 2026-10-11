import { describe, expect, it } from 'vitest';
import { applyBp, netFromInclusive, parseSar, roundDiv, splitByWeights, splitEven, toSarString, vatFromInclusive } from './money';

describe('roundDiv', () => {
  it('rounds half away from zero', () => {
    expect(roundDiv(5, 2)).toBe(3);
    expect(roundDiv(-5, 2)).toBe(-3);
    expect(roundDiv(4, 3)).toBe(1);
    expect(roundDiv(5, -2)).toBe(-3);
  });
  it('rejects division by zero', () => expect(() => roundDiv(1, 0)).toThrow());
});

describe('VAT 15%', () => {
  it('extracts VAT from inclusive prices', () => {
    expect(vatFromInclusive(11500)).toBe(1500); // 115.00 -> 15.00
    expect(vatFromInclusive(1000)).toBe(130); // 10.00 -> 1.304 -> 1.30
    expect(vatFromInclusive(1)).toBe(0);
    expect(vatFromInclusive(4)).toBe(1); // 0.52 -> 1 halala
  });
  it('net + vat always equals the inclusive amount', () => {
    for (let x = 0; x < 5000; x += 7) expect(netFromInclusive(x) + vatFromInclusive(x)).toBe(x);
  });
  it('applies basis points', () => expect(applyBp(10000, 1250)).toBe(1250));
  it('rejects non-integers', () => expect(() => vatFromInclusive(10.5)).toThrow());
});

describe('parse / format', () => {
  it('round-trips', () => {
    expect(parseSar('12.5')).toBe(1250);
    expect(parseSar('0.05')).toBe(5);
    expect(parseSar('-3.10')).toBe(-310);
    expect(toSarString(1250)).toBe('12.50');
    expect(toSarString(-5)).toBe('-0.05');
  });
  it('rejects bad input', () => {
    expect(() => parseSar('1.234')).toThrow();
    expect(() => parseSar('abc')).toThrow();
  });
});

describe('splits', () => {
  it('splits evenly with exact sum', () => {
    expect(splitEven(1000, 3)).toEqual([334, 333, 333]);
    expect(splitEven(-1000, 3)).toEqual([-334, -333, -333]);
    expect(splitEven(10, 1)).toEqual([10]);
    expect(() => splitEven(10, 0)).toThrow();
  });
  it('splits by weights with exact sum', () => {
    const parts = splitByWeights(1001, [1, 1, 1]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(1001);
    expect(splitByWeights(1000, [3, 1])).toEqual([750, 250]);
    expect(() => splitByWeights(10, [])).toThrow();
    expect(() => splitByWeights(10, [0, 0])).toThrow();
  });
});
