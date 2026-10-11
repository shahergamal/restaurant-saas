/** Riyadh has no DST: UTC+3 all year. */
export const RIYADH_OFFSET_MIN = 180;

/** Start of the current day in Asia/Riyadh, as a UTC Date. */
export function startOfRiyadhDay(d = new Date(), offsetDays = 0): Date {
  const local = new Date(d.getTime() + RIYADH_OFFSET_MIN * 60_000);
  local.setUTCHours(0, 0, 0, 0);
  local.setUTCDate(local.getUTCDate() + offsetDays);
  return new Date(local.getTime() - RIYADH_OFFSET_MIN * 60_000);
}

export function riyadhHour(d: Date): number {
  return new Date(d.getTime() + RIYADH_OFFSET_MIN * 60_000).getUTCHours();
}

/** "2026-05-16" for a Date in Riyadh time. */
export function riyadhDateKey(d: Date): string {
  return new Date(d.getTime() + RIYADH_OFFSET_MIN * 60_000).toISOString().slice(0, 10);
}

export function pctChange(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
