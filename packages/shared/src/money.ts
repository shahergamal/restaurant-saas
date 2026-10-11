/**
 * Money is always an integer number of halalas (1 SAR = 100 halalas).
 * Never use floats for amounts; these helpers are the only place rounding happens.
 */
export type Halala = number;

export const VAT_RATE_BP = 1500; // 15% in basis points

function assertInt(n: number, name: string): void {
  if (!Number.isSafeInteger(n)) throw new RangeError(`${name} must be a safe integer, got ${n}`);
}

/** Round a rational numerator/denominator half away from zero (ZATCA rounds half up on 2 decimals). */
export function roundDiv(numerator: number, denominator: number): number {
  if (denominator === 0) throw new RangeError('division by zero');
  const sign = Math.sign(numerator) * Math.sign(denominator);
  const n = Math.abs(numerator);
  const d = Math.abs(denominator);
  const q = Math.floor(n / d);
  const r = n - q * d;
  return sign * (r * 2 >= d ? q + 1 : q);
}

/** Apply a percentage expressed in basis points (1% = 100bp). */
export function applyBp(amount: Halala, bp: number): Halala {
  assertInt(amount, 'amount');
  assertInt(bp, 'bp');
  return roundDiv(amount * bp, 10_000);
}

/** VAT contained in a VAT-inclusive amount. */
export function vatFromInclusive(inclusive: Halala, rateBp = VAT_RATE_BP): Halala {
  assertInt(inclusive, 'inclusive');
  return roundDiv(inclusive * rateBp, 10_000 + rateBp);
}

/** Net (pre-VAT) part of a VAT-inclusive amount. */
export function netFromInclusive(inclusive: Halala, rateBp = VAT_RATE_BP): Halala {
  return inclusive - vatFromInclusive(inclusive, rateBp);
}

/** SAR decimal string -> halalas, e.g. "12.50" -> 1250. Rejects more than 2 decimals. */
export function parseSar(input: string): Halala {
  const s = input.trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) throw new RangeError(`invalid SAR amount: ${input}`);
  const negative = s.startsWith('-');
  const [whole = '0', frac = ''] = s.replace('-', '').split('.');
  const value = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  return negative ? -value : value;
}

/** Halalas -> "12.50" (no currency symbol, Latin digits; formatting for display lives in the UI). */
export function toSarString(amount: Halala): string {
  assertInt(amount, 'amount');
  const negative = amount < 0;
  const abs = Math.abs(amount);
  const str = `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
  return negative ? `-${str}` : str;
}

/**
 * Split an amount into `parts` integer shares that sum exactly to the amount.
 * The remainder halalas go to the first shares.
 */
export function splitEven(amount: Halala, parts: number): Halala[] {
  assertInt(amount, 'amount');
  if (!Number.isInteger(parts) || parts < 1) throw new RangeError('parts must be >= 1');
  const base = Math.trunc(amount / parts);
  let remainder = amount - base * parts;
  const step = Math.sign(remainder);
  return Array.from({ length: parts }, () => {
    if (remainder !== 0) {
      remainder -= step;
      return base + step;
    }
    return base;
  });
}

/** Split proportionally to integer weights, exact sum (largest-remainder method). */
export function splitByWeights(amount: Halala, weights: number[]): Halala[] {
  assertInt(amount, 'amount');
  if (weights.length === 0) throw new RangeError('weights must not be empty');
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0 || weights.some((w) => w < 0)) throw new RangeError('weights must be non-negative with a positive sum');
  const raw = weights.map((w) => (amount * w) / total);
  const floors = raw.map((r) => Math.floor(r));
  let remainder = amount - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (remainder <= 0) break;
    floors[i]! += 1;
    remainder -= 1;
  }
  return floors;
}
