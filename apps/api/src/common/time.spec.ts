import { pctChange, riyadhDateKey, riyadhHour, startOfRiyadhDay } from './time';

describe('Riyadh time helpers', () => {
  it('starts the day at 00:00 Riyadh (21:00 UTC the day before)', () => {
    expect(startOfRiyadhDay(new Date('2026-05-16T09:45:00Z')).toISOString()).toBe('2026-05-15T21:00:00.000Z');
    expect(startOfRiyadhDay(new Date('2026-05-16T22:30:00Z')).toISOString()).toBe('2026-05-16T21:00:00.000Z');
    expect(startOfRiyadhDay(new Date('2026-05-16T09:45:00Z'), -1).toISOString()).toBe('2026-05-14T21:00:00.000Z');
  });
  it('maps hours and dates', () => {
    expect(riyadhHour(new Date('2026-05-16T09:45:00Z'))).toBe(12);
    expect(riyadhDateKey(new Date('2026-05-16T22:30:00Z'))).toBe('2026-05-17');
  });
  it('computes percentage change', () => {
    expect(pctChange(112, 100)).toBe(12);
    expect(pctChange(0, 0)).toBe(0);
    expect(pctChange(5, 0)).toBe(100);
  });
});
