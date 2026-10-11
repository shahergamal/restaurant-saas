'use client';

import { createContext, useCallback, useContext, useMemo } from 'react';
import { dictionaries, type Locale, type Messages } from './dict';

import { LOCALE_COOKIE, NUMERALS_COOKIE, type Numerals } from './prefs';
export { LOCALE_COOKIE, NUMERALS_COOKIE, type Numerals };
const TZ = 'Asia/Riyadh';

type Vars = Record<string, string | number>;
type Named = { nameAr?: string | null; nameEn?: string | null };

function lookup(messages: Messages, key: string): string {
  let node: unknown = messages;
  for (const part of key.split('.')) {
    if (node && typeof node === 'object' && part in node) node = (node as Record<string, unknown>)[part];
    else return key;
  }
  return typeof node === 'string' ? node : key;
}

function makeI18n(locale: Locale, numerals: Numerals) {
  const messages = dictionaries[locale];
  const ar = locale === 'ar';
  const tag = `${ar ? 'ar-SA' : 'en-US'}-u-nu-${numerals}`;
  const nf = new Intl.NumberFormat(tag);
  const nf1 = new Intl.NumberFormat(tag, { maximumFractionDigits: 1 });
  const nf2 = new Intl.NumberFormat(tag, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const cache = new Map<string, Intl.DateTimeFormat>();
  const dtf = (opts: Intl.DateTimeFormatOptions, cal = 'gregory') => {
    const k = cal + JSON.stringify(opts);
    let f = cache.get(k);
    if (!f) {
      f = new Intl.DateTimeFormat(`${ar ? 'ar-SA' : 'en-GB'}-u-ca-${cal}-nu-${numerals}`, { timeZone: TZ, ...opts });
      cache.set(k, f);
    }
    return f;
  };
  const timeEn = new Intl.DateTimeFormat(`en-US-u-nu-${numerals}`, { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true });
  const toDate = (d: Date | string | number) => (d instanceof Date ? d : new Date(d));
  const t = (key: string, vars?: Vars) => {
    const s = lookup(messages, key);
    if (!vars) return s;
    return s.replace(/\{(\w+)\}/g, (_, k: string) => {
      const v = vars[k];
      return v === undefined ? `{${k}}` : typeof v === 'number' ? nf.format(v) : v;
    });
  };
  const currency = ar ? 'ر.س' : 'SAR';

  return {
    locale,
    numerals,
    dir: (ar ? 'rtl' : 'ltr') as 'rtl' | 'ltr',
    messages,
    t,
    /** Picks the localized name from an API row with nameAr / nameEn. */
    name: (row: Named | null | undefined) => (row ? ((ar ? row.nameAr : row.nameEn) || row.nameEn || row.nameAr || '') : ''),
    num: (n: number) => nf.format(n),
    num1: (n: number) => nf1.format(n),
    pct: (n: number) => `${nf1.format(n)}%`,
    /** Money in halala → "SAR 1,250.00" / "1,250.00 ر.س". `whole` drops decimals for KPIs. */
    money: (halala: number, opts: { whole?: boolean } = {}) => {
      const v = halala / 100;
      const s = opts.whole ? nf.format(Math.round(v)) : nf2.format(v);
      return ar ? `${s} ${currency}` : `${currency} ${s}`;
    },
    /** Compact axis label: 2K, 15K. */
    compact: (halala: number) => {
      const v = halala / 100;
      return v >= 1000 ? `${nf1.format(v / 1000)}${ar ? ' ألف' : 'K'}` : nf.format(Math.round(v));
    },
    currency,
    unit: (unit: string) => unitLabel(unit, ar),
    qty: (milli: number, unit: string) => `${nf1.format(milli / 1000)} ${unitLabel(unit, ar)}`,
    date: (d: Date | string | number, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) => dtf(opts).format(toDate(d)),
    longDate: (d: Date | string | number) => dtf({ weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }).format(toDate(d)),
    shortDay: (d: Date | string | number) => dtf({ day: 'numeric', month: 'short' }).format(toDate(d)),
    hijri: (d: Date | string | number) => dtf({ day: 'numeric', month: 'long', year: 'numeric' }, 'islamic-umalqura').format(toDate(d)),
    time: (d: Date | string | number) => (ar ? dtf({ hour: 'numeric', minute: '2-digit', hour12: true }) : timeEn).format(toDate(d)),
    hour: (h: number) => {
      const d = new Date(Date.UTC(2026, 0, 1, h - 3, 0));
      return dtf({ hour: 'numeric', hour12: true }).format(d);
    },
    /** "5 min ago" style relative time. */
    ago: (d: Date | string | number, now = Date.now()) => {
      const min = Math.max(0, Math.floor((now - toDate(d).getTime()) / 60000));
      if (min < 1) return t('common.justNow');
      if (min < 60) return t('common.minAgo', { n: min });
      const h = Math.floor(min / 60);
      if (h < 24) return t('common.hAgo', { n: h });
      return dtf({ day: 'numeric', month: 'short' }).format(toDate(d));
    },
  };
}

const UNITS: Record<string, [string, string]> = {
  kg: ['kg', 'كجم'],
  g: ['g', 'جم'],
  l: ['L', 'لتر'],
  L: ['L', 'لتر'],
  ml: ['ml', 'مل'],
  pcs: ['pcs', 'حبة'],
  pc: ['pcs', 'حبة'],
  pack: ['pack', 'عبوة'],
  box: ['box', 'كرتون'],
  dozen: ['dozen', 'درزن'],
};
function unitLabel(unit: string, ar: boolean) {
  const u = UNITS[unit];
  return u ? u[ar ? 1 : 0] : unit;
}

export type I18n = ReturnType<typeof makeI18n>;
const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ locale, numerals, children }: { locale: Locale; numerals: Numerals; children: React.ReactNode }) {
  const value = useMemo(() => makeI18n(locale, numerals), [locale, numerals]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n outside I18nProvider');
  return v;
}

/** Persists a display preference in a cookie (read by the root layout) and reloads server components. */
export function useSetPreference() {
  return useCallback((name: typeof LOCALE_COOKIE | typeof NUMERALS_COOKIE, value: string) => {
    document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`;
    window.location.reload();
  }, []);
}
