'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ArrowUpRight, CalendarDays, Coins, Database, Leaf, Lightbulb, MapPin, Percent, Search, TriangleAlert, Upload } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis, ReferenceLine } from 'recharts';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Delta } from '@/components/ui/delta';
import { Donut } from '@/components/ui/donut';
import { Input, Select } from '@/components/ui/field';
import { FoodImg } from '@/components/ui/food-img';
import { PillTabs } from '@/components/ui/pill-tabs';
import { Sparkline } from '@/components/ui/sparkline';
import { IconTile } from '@/components/ui/stat-card';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { axisTick, C } from '@/components/charts/theme';
import { ChartTooltip } from '@/components/charts/tooltip';

type Range = 'today' | '7d' | '30d';
type Tab = 'overview' | 'items' | 'ingredients' | 'analysis';
type Named = { nameAr: string; nameEn: string };
type Overview = {
  cards: { foodSales: number; foodSalesDeltaPct: number; foodCost: number; foodCostDeltaPct: number; marginPct: number; marginDeltaPct: number; wastePct: number; wasteDeltaPct: number };
  series: { day: string; sales: number; cost: number }[];
  breakdown: { total: number; parts: { key: 'ingredients' | 'labor' | 'overheads' | 'packaging'; amount: number; pct: number }[] };
  topIngredients: (Named & { id: string; image: string | null; amount: number; pct: number })[];
  marginByCategory: (Named & { key: string; marginPct: number; net: number })[];
  insights: { costRise: (Named & { pct: number }) | null; lowMargin: (Named & { marginPct: number; targetPct: number }) | null; produceWasteChangePct: number };
};
type Item = { id: string; nameAr: string; nameEn: string; image: string | null; categoryAr: string; categoryEn: string; cost: number; price: number; marginPct: number; sold: number; trend: number[]; belowTarget: boolean };
type Items = { targetMarginPct: number; items: Item[] };
type EngClass = 'star' | 'plowhorse' | 'puzzle' | 'dog';
type Engineering = {
  items: (Named & { id: string; image: string | null; sold: number; contribution: number; class: EngClass; channels: { platform: string; net: number; commission: number; profit: number; marginBp: number }[] })[];
  channels: { platform: string; commissionPct: number }[];
};

const PART_COLOR = { ingredients: C.accent, labor: C.success, overheads: C.violet, packaging: C.slate } as const;
const CLASS_COLOR: Record<EngClass, string> = { star: C.success, plowhorse: C.accent, puzzle: C.blue, dog: C.neutral };
const CLASS_TONE: Record<EngClass, string> = { star: 'bg-success-soft text-success', plowhorse: 'bg-accent-soft text-accent', puzzle: 'bg-info-soft text-info', dog: 'bg-surface-muted text-ink-muted' };

function marginTone(m: number, target: number) {
  return m < target ? 'bg-danger-soft text-danger' : m < 65 ? 'bg-warning-soft text-warning' : 'bg-success-soft text-success';
}

function Kpi({ icon, tone, label, value, delta, goodWhenDown }: { icon: React.ReactNode; tone: 'softAccent' | 'success' | 'softWarning' | 'softDanger'; label: string; value: string; delta: number; goodWhenDown?: boolean }) {
  const { t } = useI18n();
  return (
    <Card className="flex min-w-0 items-start gap-3 p-4">
      <IconTile tone={tone} className="size-10 rounded-full">
        {icon}
      </IconTile>
      <div className="min-w-0">
        <p className="truncate text-xs text-ink-muted">{label}</p>
        <p className="mt-1 whitespace-nowrap text-lg font-bold tabular">{value}</p>
        <Delta value={delta} goodWhenDown={goodWhenDown} className="mt-1.5" />
        <p className="mt-0.5 text-2xs text-ink-muted">{t('common.vsLastWeek')}</p>
      </div>
    </Card>
  );
}

function SalesVsCost({ d }: { d: Overview }) {
  const { t, money, compact, shortDay, dir } = useI18n();
  const rows = d.series.map((r) => ({ label: shortDay(r.day), sales: r.sales, cost: r.cost }));
  return (
    <Card className="flex min-w-0 flex-col p-5">
      <CardHeader
        title={t('foodCost.salesVsCost')}
        action={
          <div className="flex gap-4 text-2xs text-ink-muted">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: C.accent }} />
              {t('foodCost.foodSales')}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: C.slate }} />
              {t('foodCost.foodCost')}
            </span>
          </div>
        }
      />
      <div className="mt-4 min-h-[200px] flex-1" role="img" aria-label={t('foodCost.salesVsCost')}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="fc-s" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={C.accent} stopOpacity={0.22} />
                <stop offset="1" stopColor={C.accent} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="fc-c" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={C.slate} stopOpacity={0.16} />
                <stop offset="1" stopColor={C.slate} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} reversed={dir === 'rtl'} interval="preserveStartEnd" />
            <YAxis tick={axisTick} axisLine={false} tickLine={false} width={52} tickFormatter={(v) => compact(v)} orientation={dir === 'rtl' ? 'right' : 'left'} />
            <Tooltip
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <ChartTooltip
                    title={String(label)}
                    rows={[
                      [C.accent, t('foodCost.foodSales'), money(Number(payload[0].value), { whole: true })],
                      [C.slate, t('foodCost.foodCost'), money(Number(payload[1]?.value ?? 0), { whole: true })],
                    ]}
                  />
                ) : null
              }
            />
            <Area type="monotone" dataKey="sales" stroke={C.accent} strokeWidth={2} fill="url(#fc-s)" dot={{ r: 3, fill: C.accent, strokeWidth: 0 }} />
            <Area type="monotone" dataKey="cost" stroke={C.slate} strokeWidth={2} fill="url(#fc-c)" dot={{ r: 3, fill: C.slate, strokeWidth: 0 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function Breakdown({ d }: { d: Overview }) {
  const { t, money, pct } = useI18n();
  return (
    <Card className="min-w-0 p-5">
      <CardHeader title={t('foodCost.breakdown')} />
      <div className="mt-5 flex items-center gap-5">
        <Donut size={128} thickness={18} parts={d.breakdown.parts.map((p) => ({ value: p.amount, color: PART_COLOR[p.key] }))} label={t('foodCost.breakdown')}>
          <div>
            <p className="text-sm font-bold tabular">{money(d.breakdown.total, { whole: true })}</p>
            <p className="text-2xs text-ink-muted">{t('foodCost.totalCost')}</p>
          </div>
        </Donut>
        <ul className="flex min-w-0 flex-1 flex-col gap-3.5">
          {d.breakdown.parts.map((p) => (
            <li key={p.key} className="grid grid-cols-[auto_1fr_auto] items-center gap-x-2 text-xs">
              <span className="size-2.5 rounded-full" style={{ background: PART_COLOR[p.key] }} aria-hidden />
              <span className="truncate">{t(`foodCost.parts.${p.key}`)}</span>
              <span className="tabular text-ink-muted">{pct(p.pct)}</span>
              <span className="col-start-2 col-end-4 text-2xs text-ink-muted tabular">{money(p.amount, { whole: true })}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

function ItemsTable({ range, compact }: { range: Range; compact?: boolean }) {
  const { t, name, money, pct } = useI18n();
  const [filter, setFilter] = useState<'all' | 'top' | 'low'>('all');
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(!compact);
  const res = useQuery({ queryKey: ['food-cost', 'items', range, filter], queryFn: () => api<Items>(`/food-cost/items?range=${range}&filter=${filter}`), placeholderData: (p) => p });
  const rows = useMemo(() => {
    const all = res.data?.items ?? [];
    const term = q.trim().toLowerCase();
    const f = term ? all.filter((i) => i.nameAr.includes(term) || i.nameEn.toLowerCase().includes(term) || i.categoryEn.toLowerCase().includes(term) || i.categoryAr.includes(term)) : all;
    return compact ? f.slice(0, 8) : f;
  }, [res.data, q, compact]);
  const target = res.data?.targetMarginPct ?? 25;
  return (
    <Card className="min-w-0 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-md font-semibold">{t('foodCost.performance')}</h2>
        <div className="flex items-center gap-2">
          <PillTabs
            size="sm"
            label={t('foodCost.performance')}
            value={filter}
            onChange={setFilter}
            tabs={[
              { key: 'all', label: t('foodCost.allItems') },
              { key: 'top', label: t('foodCost.topProfit') },
              { key: 'low', label: t('foodCost.lowMargin') },
            ]}
          />
          {searching ? (
            <label className="relative">
              <span className="sr-only">{t('foodCost.searchItems')}</span>
              <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
              <Input autoFocus={compact} className="h-8 w-44 ps-8 text-xs" placeholder={t('foodCost.searchItems')} value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
          ) : (
            <button type="button" onClick={() => setSearching(true)} className="grid size-8 place-items-center rounded border border-border hover:bg-surface-muted" aria-label={t('foodCost.searchItems')}>
              <Search className="size-4" />
            </button>
          )}
        </div>
      </div>
      {res.isError ? (
        <ErrorState onRetry={() => res.refetch()} />
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <caption className="sr-only">{t('foodCost.performance')}</caption>
            <thead>
              <tr className="bg-surface-muted/60 text-2xs text-ink-muted">
                {[t('foodCost.item'), t('foodCost.category'), t('foodCost.foodCost'), t('foodCost.price'), t('foodCost.marginCol'), t('foodCost.trend')].map((h, i) => (
                  <th key={h} scope="col" className={cn('px-3 py-2.5 text-start font-medium', i === 0 && 'rounded-s-md', i === 5 && 'rounded-e-md')}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!res.data
                ? Array.from({ length: 8 }, (_, i) => (
                    <tr key={i}>
                      <td colSpan={6} className="py-1.5">
                        <Skeleton className="h-9" />
                      </td>
                    </tr>
                  ))
                : rows.map((i) => {
                    const first = i.trend[0] ?? i.marginPct;
                    const last = i.trend[i.trend.length - 1] ?? i.marginPct;
                    return (
                      <tr key={i.id} className="border-b border-border last:border-0">
                        <td className="px-3 py-2">
                          <span className="flex items-center gap-3">
                            <FoodImg image={i.image} className="size-9" />
                            <span className="text-xs font-medium">{name(i)}</span>
                          </span>
                        </td>
                        <td className="px-3 py-2 text-2xs text-ink-muted">{name({ nameAr: i.categoryAr, nameEn: i.categoryEn })}</td>
                        <td className="px-3 py-2 text-xs tabular">{money(i.cost)}</td>
                        <td className="px-3 py-2 text-xs tabular">{money(i.price)}</td>
                        <td className="px-3 py-2">
                          <span className={cn('inline-block min-w-12 rounded px-2 py-0.5 text-center text-2xs font-semibold tabular', marginTone(i.marginPct, target))}>{pct(i.marginPct)}</span>
                        </td>
                        <td className="px-3 py-2">
                          <Sparkline values={i.trend} tone={i.belowTarget || last - first < -2 ? 'down' : i.marginPct < 65 ? 'flat' : 'up'} label={`${t('foodCost.trend')}: ${pct(first)} → ${pct(last)}`} />
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
          {res.data && rows.length === 0 ? <EmptyState title={t('inventory.empty')} /> : null}
        </div>
      )}
    </Card>
  );
}

function Insights({ d }: { d: Overview }) {
  const { t, name, num } = useI18n();
  const ins = d.insights;
  const rows = [
    ins.costRise ? { Icon: ArrowUpRight, title: t('foodCost.costIncreased', { name: name(ins.costRise) }), body: t('foodCost.costIncreasedBody', { name: name(ins.costRise), n: num(ins.costRise.pct) }), href: '/suppliers', cta: t('foodCost.reviewSupplier') } : null,
    ins.lowMargin
      ? { Icon: TriangleAlert, title: t('foodCost.lowMarginAlert'), body: t('foodCost.lowMarginBody', { name: name(ins.lowMargin), n: num(ins.lowMargin.marginPct), t: num(ins.lowMargin.targetPct) }), href: '/menu', cta: t('foodCost.checkRecipe') }
      : null,
    ins.produceWasteChangePct > 5 ? { Icon: Leaf, title: t('foodCost.wasteOpp'), body: t('foodCost.wasteOppBody', { n: num(ins.produceWasteChangePct) }), href: '/inventory', cta: t('foodCost.viewWaste') } : null,
  ].filter(Boolean) as { Icon: typeof Leaf; title: string; body: string; href: string; cta: string }[];
  return (
    <section className="rounded-lg border border-accent-line/60 bg-accent-soft2 p-4">
      <h2 className="flex items-center gap-2 text-md font-semibold text-accent">
        <Lightbulb className="size-5" />
        {t('foodCost.smartInsights')}
      </h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-xs text-ink-muted">{t('foodCost.noInsights')}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2.5">
          {rows.map((r) => (
            <li key={r.title} className="flex gap-3 rounded-md bg-surface/70 p-3">
              <r.Icon className="size-5 shrink-0 text-accent" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-accent">{r.title}</p>
                <p className="mt-0.5 text-2xs leading-5 text-ink-muted">{r.body}</p>
                <Link href={r.href} className="mt-2 inline-flex items-center gap-1 rounded border border-accent-line bg-surface px-2.5 py-1 text-2xs font-medium text-accent hover:bg-accent-soft">
                  {r.cta}
                  <ArrowRight className="flip-rtl size-3" />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TopIngredients({ d, full }: { d: Overview; full?: boolean }) {
  const { t, name, money, pct } = useI18n();
  const max = Math.max(...d.topIngredients.map((i) => i.pct), 1);
  return (
    <Card className="p-4">
      <CardHeader
        title={t('foodCost.topIngredients')}
        action={
          full ? null : (
            <Link href="/food-cost?tab=ingredients" className="flex items-center gap-1 text-2xs font-medium text-accent hover:underline">
              {t('common.viewAll')}
              <ArrowRight className="flip-rtl size-3" />
            </Link>
          )
        }
      />
      <ul className="mt-3 flex flex-col gap-3">
        {d.topIngredients.map((i) => (
          <li key={i.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto_48px_auto] items-center gap-2">
            <FoodImg image={i.image} className="size-8" rounded="rounded-full" />
            <span className="truncate text-xs">{name(i)}</span>
            <span className="text-2xs tabular">{money(i.amount, { whole: true })}</span>
            <span className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
              <span className="block h-full rounded-full bg-accent" style={{ width: `${(i.pct / max) * 100}%` }} />
            </span>
            <span className="w-8 text-end text-2xs tabular text-ink-muted">{pct(i.pct)}</span>
          </li>
        ))}
      </ul>
      {full ? (
        <Link href="/inventory" className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
          {t('nav.inventory')}
          <ArrowRight className="flip-rtl size-3" />
        </Link>
      ) : null}
    </Card>
  );
}

function MarginByCategory({ d, target }: { d: Overview; target: number }) {
  const { t, name, pct } = useI18n();
  return (
    <Card className="p-4">
      <CardHeader title={t('foodCost.marginByCategory')} />
      <ul className="mt-3 flex flex-col gap-3">
        {d.marginByCategory.map((c) => (
          <li key={c.key} className="grid grid-cols-[80px_36px_1fr] items-center gap-2.5 text-xs">
            <span className="truncate text-ink-muted">{name(c)}</span>
            <span className="tabular">{pct(c.marginPct)}</span>
            <span className="h-2 overflow-hidden rounded-full bg-surface-muted">
              <span className={cn('block h-full rounded-full', c.marginPct >= 75 ? 'bg-success' : c.marginPct < target ? 'bg-danger' : 'bg-accent')} style={{ width: `${c.marginPct}%` }} />
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Analysis({ range }: { range: Range }) {
  const { t, name, num, money, pct, compact } = useI18n();
  const res = useQuery({ queryKey: ['food-cost', 'engineering', range], queryFn: () => api<Engineering>(`/food-cost/engineering?range=${range}`) });
  const [cls, setCls] = useState<EngClass | 'all'>('all');
  if (res.isError) return <ErrorState onRetry={() => res.refetch()} />;
  if (!res.data) return <Skeleton className="h-[480px] rounded-lg" />;
  const items = res.data.items;
  const avgSold = items.reduce((s, i) => s + i.sold, 0) / (items.length || 1);
  const avgContrib = items.reduce((s, i) => s + i.contribution, 0) / (items.length || 1);
  const shown = cls === 'all' ? items : items.filter((i) => i.class === cls);
  const counts = (['star', 'plowhorse', 'puzzle', 'dog'] as const).map((k) => ({ k, n: items.filter((i) => i.class === k).length }));
  const platforms = ['dine_in', ...res.data.channels.map((c) => c.platform)];
  const top = [...items].sort((a, b) => b.sold - a.sold).slice(0, 8);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card className="min-w-0 p-5">
          <CardHeader title={t('foodCost.engineering')} />
          <div className="mt-4 h-[340px]" role="img" aria-label={t('foodCost.engineering')}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 16 }}>
                <CartesianGrid stroke={C.grid} strokeDasharray="3 3" />
                <XAxis type="number" dataKey="sold" name={t('foodCost.popularity')} tick={axisTick} axisLine={false} tickLine={false} label={{ value: t('foodCost.popularity'), position: 'insideBottom', offset: -10, fontSize: 11, fill: C.tick }} />
                <YAxis type="number" dataKey="contribution" tick={axisTick} axisLine={false} tickLine={false} width={56} tickFormatter={(v) => compact(v)} label={{ value: t('foodCost.contribution'), angle: -90, position: 'insideLeft', fontSize: 11, fill: C.tick }} />
                <ZAxis range={[60, 60]} />
                <ReferenceLine x={avgSold} stroke={C.neutral} strokeDasharray="4 4" />
                <ReferenceLine y={avgContrib} stroke={C.neutral} strokeDasharray="4 4" />
                <Tooltip
                  cursor={false}
                  content={({ active, payload }) => {
                    const p = payload?.[0]?.payload as Engineering['items'][number] | undefined;
                    return active && p ? (
                      <ChartTooltip
                        title={name(p)}
                        rows={[
                          [CLASS_COLOR[p.class], t(`foodCost.classes.${p.class}`), ''],
                          [C.slate, t('foodCost.sold'), num(p.sold)],
                          [C.slate, t('foodCost.contribution'), money(p.contribution)],
                        ]}
                      />
                    ) : null;
                  }}
                />
                {(['star', 'plowhorse', 'puzzle', 'dog'] as const).map((k) => (
                  <Scatter key={k} data={shown.filter((i) => i.class === k)} fill={CLASS_COLOR[k]} />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <div className="grid grid-cols-2 gap-3">
          {counts.map(({ k, n }) => (
            <button
              type="button"
              key={k}
              onClick={() => setCls(cls === k ? 'all' : k)}
              aria-pressed={cls === k}
              className={cn('flex flex-col items-start rounded-lg border bg-surface p-4 text-start shadow-card transition-colors hover:border-accent-line', cls === k ? 'border-accent ring-1 ring-accent' : 'border-border')}
            >
              <span className={cn('rounded px-2 py-0.5 text-2xs font-semibold', CLASS_TONE[k])}>{t(`foodCost.classes.${k}`)}</span>
              <span className="mt-2 text-2xl font-bold tabular">{num(n)}</span>
              <span className="mt-1 text-2xs leading-4 text-ink-muted">{t(`foodCost.classHelp.${k}`)}</span>
            </button>
          ))}
        </div>
      </div>
      <Card className="min-w-0 p-5">
        <CardHeader title={t('foodCost.channel')} />
        <p className="mt-1 text-xs text-ink-muted">{t('foodCost.channelBody')}</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <caption className="sr-only">{t('foodCost.channel')}</caption>
            <thead>
              <tr className="border-b border-border text-2xs text-ink-muted">
                <th scope="col" className="py-2 text-start font-medium">
                  {t('foodCost.item')}
                </th>
                {platforms.map((p) => {
                  const c = res.data!.channels.find((x) => x.platform === p);
                  return (
                    <th key={p} scope="col" className="px-3 py-2 text-start font-medium">
                      <span className="block text-ink">{t(`channel.${p}`)}</span>
                      {c ? <span className="block">{t('foodCost.commission', { n: num(c.commissionPct) })}</span> : null}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {top.map((i) => (
                <tr key={i.id} className="border-b border-border last:border-0">
                  <td className="py-2">
                    <span className="flex items-center gap-2.5">
                      <FoodImg image={i.image} className="size-8" />
                      <span className="text-xs font-medium">{name(i)}</span>
                    </span>
                  </td>
                  {platforms.map((p) => {
                    const ch = i.channels.find((x) => x.platform === p);
                    if (!ch) return <td key={p} className="px-3 py-2 text-xs text-ink-muted">—</td>;
                    const m = ch.marginBp / 100;
                    return (
                      <td key={p} className="px-3 py-2">
                        <span className="block text-xs font-semibold tabular">{money(ch.profit)}</span>
                        <span className={cn('text-2xs tabular', m < 50 ? 'text-danger' : m < 65 ? 'text-warning' : 'text-success')}>{pct(Math.round(m))}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function FoodCostInner() {
  const { t, name, money, pct } = useI18n();
  const { me, branchId, setBranch } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const tabParam = params.get('tab');
  const tab: Tab = tabParam === 'items' || tabParam === 'ingredients' || tabParam === 'analysis' ? tabParam : 'overview';
  const setTab = (k: Tab) => router.replace(k === 'overview' ? '/food-cost' : `/food-cost?tab=${k}`, { scroll: false });
  const [range, setRange] = useState<Range>('7d');
  const ov = useQuery({ queryKey: ['food-cost', 'overview', range], queryFn: () => api<Overview>(`/food-cost/overview?range=${range}`), placeholderData: (p) => p });
  const d = ov.data;

  const exportCsv = async () => {
    const res = await api<Items>(`/food-cost/items?range=${range}&filter=all`);
    const head = ['Item', 'Category', 'Food cost (SAR)', 'Selling price (SAR)', 'Margin %', 'Sold'];
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [head, ...res.items.map((i) => [i.nameEn, i.categoryEn, (i.cost / 100).toFixed(2), (i.price / 100).toFixed(2), i.marginPct, i.sold])].map((r) => r.map(esc).join(','));
    const url = URL.createObjectURL(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `qidr-food-cost-${range}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('foodCost.title')}</h1>
          <p className="mt-0.5 text-sm text-ink-muted">{t('foodCost.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative flex items-center">
            <span className="sr-only">{t('common.period')}</span>
            <CalendarDays className="pointer-events-none absolute start-3 size-4 text-ink-muted" />
            <Select className="h-11 w-44 ps-9" value={range} onChange={(e) => setRange(e.target.value as Range)}>
              <option value="today">{t('reports.todayRange')}</option>
              <option value="7d">{t('reports.last7')}</option>
              <option value="30d">{t('reports.last30')}</option>
            </Select>
          </label>
          {me.branches.length > 1 ? (
            <label className="relative flex items-center">
              <span className="sr-only">{t('reports.branch')}</span>
              <MapPin className="pointer-events-none absolute start-3 size-4 text-ink-muted" />
              <Select className="h-11 w-44 ps-9" value={branchId} onChange={(e) => setBranch(e.target.value)}>
                {me.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {name(b)}
                  </option>
                ))}
              </Select>
            </label>
          ) : null}
          <Button size="lg" onClick={exportCsv}>
            <Upload className="size-4" />
            {t('foodCost.export')}
          </Button>
        </div>
      </div>

      <PillTabs
        className="mb-4"
        label={t('foodCost.title')}
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'overview', label: t('foodCost.overview') },
          { key: 'items', label: t('foodCost.menuItems') },
          { key: 'ingredients', label: t('foodCost.ingredients') },
          { key: 'analysis', label: t('foodCost.analysis') },
        ]}
      />

      {ov.isError ? (
        <ErrorState onRetry={() => ov.refetch()} />
      ) : tab === 'items' ? (
        <ItemsTable range={range} />
      ) : tab === 'analysis' ? (
        <Analysis range={range} />
      ) : tab === 'ingredients' ? (
        d ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <TopIngredients d={d} full />
            <Breakdown d={d} />
          </div>
        ) : (
          <Skeleton className="h-[320px] rounded-lg" />
        )
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-w-0 flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {!d ? (
                Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[100px] rounded-lg" />)
              ) : (
                <>
                  <Kpi tone="softAccent" icon={<Coins />} label={t('foodCost.sales')} value={money(d.cards.foodSales, { whole: true })} delta={d.cards.foodSalesDeltaPct} />
                  <Kpi tone="success" icon={<Database />} label={t('foodCost.cost')} value={money(d.cards.foodCost, { whole: true })} delta={d.cards.foodCostDeltaPct} goodWhenDown />
                  <Kpi tone="softWarning" icon={<Percent />} label={t('foodCost.margin')} value={pct(d.cards.marginPct)} delta={d.cards.marginDeltaPct} />
                  <Kpi tone="softDanger" icon={<Leaf />} label={t('foodCost.waste')} value={pct(d.cards.wastePct)} delta={d.cards.wasteDeltaPct} goodWhenDown />
                </>
              )}
            </div>
            {d ? (
              <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
                <SalesVsCost d={d} />
                <Breakdown d={d} />
              </div>
            ) : (
              <Skeleton className="h-[260px] rounded-lg" />
            )}
            <ItemsTable range={range} compact />
          </div>
          <div className="flex flex-col gap-4">
            {d ? <Insights d={d} /> : <Skeleton className="h-[360px] rounded-lg" />}
            {d ? <TopIngredients d={d} /> : <Skeleton className="h-[220px] rounded-lg" />}
            {d ? <MarginByCategory d={d} target={d.insights.lowMargin?.targetPct ?? 25} /> : null}
          </div>
        </div>
      )}
    </>
  );
}

export default function FoodCostPage() {
  return (
    <Suspense>
      <FoodCostInner />
    </Suspense>
  );
}
