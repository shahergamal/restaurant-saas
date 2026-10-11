import { BadRequestException } from '@nestjs/common';
import { RIYADH_OFFSET_MIN, startOfRiyadhDay } from '../../common/time';

export interface Period {
  from: Date;
  to: Date;
  prevFrom: Date;
  prevTo: Date;
  days: number;
}

const DAY = 86_400_000;

/** Resolves a reporting window in Riyadh days. `to` is exclusive. Defaults to the last 7 days including today. */
export function resolvePeriod(input: { from?: string; to?: string; range?: string }): Period {
  let from: Date;
  let to: Date;
  if (input.from && input.to) {
    from = new Date(Date.parse(`${input.from}T00:00:00Z`) - RIYADH_OFFSET_MIN * 60_000);
    to = new Date(Date.parse(`${input.to}T00:00:00Z`) - RIYADH_OFFSET_MIN * 60_000 + DAY);
  } else {
    const days = input.range === 'today' ? 1 : input.range === '30d' ? 30 : 7;
    to = startOfRiyadhDay(new Date(), 1);
    from = new Date(to.getTime() - days * DAY);
  }
  const span = to.getTime() - from.getTime();
  if (span <= 0 || span > 366 * DAY) throw new BadRequestException('range_invalid');
  return { from, to, prevFrom: new Date(from.getTime() - span), prevTo: from, days: Math.round(span / DAY) };
}

export function dayKeys(p: Period): string[] {
  return Array.from({ length: p.days }, (_, i) => new Date(p.from.getTime() + RIYADH_OFFSET_MIN * 60_000 + i * DAY).toISOString().slice(0, 10));
}

export const CATEGORY_GROUP: Record<string, 'food' | 'beverages' | 'desserts' | 'others'> = {
  drinks: 'beverages',
  hot_drinks: 'beverages',
  desserts: 'desserts',
  sides: 'others',
  soups: 'others',
};
export const groupOf = (key: string) => CATEGORY_GROUP[key] ?? 'food';
