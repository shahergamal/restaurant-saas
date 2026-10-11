'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ArrowUp, ArrowDown, Building2, CalendarDays, ChefHat, ClipboardList, Clock, Download, FileText, Lightbulb, MapPin, Star, Trash2, TrendingDown, TrendingUp, TriangleAlert, UsersRound, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, download } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { cn } from '@/lib/cn';
import { imgSrc } from '@/lib/photos';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Delta } from '@/components/ui/delta';
import { Dialog } from '@/components/ui/dialog';
import { Donut } from '@/components/ui/donut';
import { Select } from '@/components/ui/field';
import { FoodImg } from '@/components/ui/food-img';
import { MenuContent, MenuItem, MenuRoot, MenuTrigger } from '@/components/ui/menu';
import { PillTabs } from '@/components/ui/pill-tabs';
import { IconTile, StatCard } from '@/components/ui/stat-card';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { axisTick, C } from '@/components/charts/theme';
import { ChartTooltip } from '@/components/charts/tooltip';

type Range = 'today' | '7d' | '30d';
type Overview = {
  period: { from: string; to: string; days: number };
  cards: { revenue: number; revenueDeltaPct: number; orders: number; ordersDeltaPct: number; customers: number; customersDeltaPct: number; avgPrepMin: number; avgPrepDeltaPct: number; wastePct: number; wasteDeltaPct: number };
  revenueDaily: { day: string; revenue: number }[];
  revenueWeekly: { weekStart: string; revenue: number }[];
  salesByCategory: { total: number; groups: { key: 'food' | 'beverages' | 'desserts' | 'others'; amount: number; pct: number }[] };
  topItems: { id: string; nameAr: string; nameEn: string; image: string | null; sold: number; revenue: number; sharePct: number; up: boolean }[];
  ordersTrend: { day: string; dineIn: number; takeaway: number }[];
  feedback: { avg: number; count: number; distribution: { star: number; count: number; pct: number }[]; quote: { text: string; author: string; rating: number } | null };
  branches: { id: string; nameAr: string; nameEn: string; revenue: number; growthPct: number }[];
  insights: { salesChangePct: number; produceWasteChangePct: number; peakStartHour: number | null; peakEndHour: number | null };
};
type Vat = { invoices: number; total: number; vat: number; net: number; byStatus: { status: string; count: number }[] };

const CAT_COLOR = { food: C.accent, beverages: C.success, desserts: C.blue, others: C.violet } as const;

function Kpi({ icon, tone, label, value, foot }: { icon: React.ReactNode; tone: 'softAccent' | 'softSuccess' | 'softInfo' | 'softViolet' | 'softDanger'; label: string; value: string; foot: React.ReactNode }) {
  return (
    <Card className="flex min-w-0 flex-col p-4">
      <div className="flex items-center gap-2.5">
        <IconTile tone={tone} className="size-10 rounded-md">
          {icon}
        </IconTile>
        <p className="text-xs leading-4 text-ink-muted">{label}</p>
      </div>
      <p className="mt-3 whitespace-nowrap text-lg font-bold tabular">
        {value}
      </p>
      <div className="mt-2">{foot}</div>
    </Card>
  );
}

function RevenueOverview({ data }: { data: Overview }) {
  const { t, money, compact, shortDay, dir } = useI18n();
  const [mode, setMode] = useState<'daily' | 'weekly'>('daily');
  const rows = mode === 'daily' ? data.revenueDaily.map((r) => ({ label: shortDay(r.day), v: r.revenue })) : data.revenueWeekly.map((r) => ({ label: shortDay(r.weekStart), v: r.revenue }));
  const last = rows[rows.length - 1];
  return (
    <Card className="flex min-w-0 flex-col p-5">
      <CardHeader
        title={t('reports.revenueOverview')}
        action={
          <PillTabs
            size="sm"
            label={t('reports.revenueOverview')}
            value={mode}
            onChange={setMode}
            tabs={[
              { key: 'daily', label: t('reports.daily') },
              { key: 'weekly', label: t('reports.weekly') },
            ]}
          />
        }
      />
      <div className="mt-4 min-h-[220px] flex-1" role="img" aria-label={`${t('reports.revenueOverview')}: ${last ? `${last.label} ${money(last.v, { whole: true })}` : ''}`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 28, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="rev-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={C.accent} stopOpacity={0.28} />
                <stop offset="1" stopColor={C.accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} reversed={dir === 'rtl'} interval="preserveStartEnd" />
            <YAxis tick={axisTick} axisLine={false} tickLine={false} width={52} tickFormatter={(v) => compact(v)} orientation={dir === 'rtl' ? 'right' : 'left'} />
            <Tooltip cursor={{ stroke: C.accentSoft }} content={({ active, payload, label }) => (active && payload?.length ? <ChartTooltip title={String(label)} rows={[[C.accent, t('reports.revenueCol'), money(Number(payload[0].value), { whole: true })]]} /> : null)} />
            <Area
              type="monotone"
              dataKey="v"
              stroke={C.accent}
              strokeWidth={2.5}
              fill="url(#rev-fill)"
              dot={{ r: 3.5, fill: C.accent, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              label={(p: { index?: number; x?: number | string; y?: number | string }) =>
                p.index === rows.length - 1 && last ? (
                  <g key="last">
                    <rect x={dir === 'rtl' ? Number(p.x) + 8 : Number(p.x) - 94} y={Number(p.y) - 36} width={86} height={24} rx={6} fill="white" stroke={C.grid} />
                    <text x={dir === 'rtl' ? Number(p.x) + 51 : Number(p.x) - 51} y={Number(p.y) - 20} textAnchor="middle" fontSize={11} fontWeight={700} fill="rgb(25 21 18)">
                      {money(last.v, { whole: true })}
                    </text>
                  </g>
                ) : (
                  <g key={p.index} />
                )
              }
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function SalesByCategory({ data }: { data: Overview }) {
  const { t, money, pct } = useI18n();
  const g = data.salesByCategory.groups;
  return (
    <Card className="min-w-0 p-5">
      <CardHeader title={t('reports.byCategory')} />
      <div className="mt-6 flex items-center gap-5">
        <Donut size={148} thickness={22} parts={g.map((x) => ({ value: x.amount, color: CAT_COLOR[x.key] }))} label={t('reports.byCategory')}>
          <div>
            <p className="text-sm font-bold tabular">{money(data.salesByCategory.total, { whole: true })}</p>
            <p className="text-2xs text-ink-muted">{t('reports.totalSales')}</p>
          </div>
        </Donut>
        <ul className="flex min-w-0 flex-1 flex-col gap-4">
          {g.map((x) => (
            <li key={x.key} className="flex items-center gap-2.5 text-xs">
              <span className="size-2.5 rounded-full" style={{ background: CAT_COLOR[x.key] }} aria-hidden />
              <span className="flex-1">{t(`reports.${x.key}`)}</span>
              <span className="tabular text-ink-muted">{pct(x.pct)}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

function TopSelling({ data }: { data: Overview }) {
  const { t, name, num, money, pct } = useI18n();
  return (
    <Card className="min-w-0 p-5">
      <CardHeader
        title={t('reports.topSelling')}
        action={
          <Link href="/food-cost?tab=items" className="flex items-center gap-1 text-xs font-medium text-accent hover:underline">
            {t('common.viewAll')}
            <ArrowRight className="flip-rtl size-3.5" />
          </Link>
        }
      />
      {data.topItems.length === 0 ? (
        <EmptyState title={t('common.empty')} />
      ) : (
        <table className="mt-3 w-full">
          <caption className="sr-only">{t('reports.topSelling')}</caption>
          <thead>
            <tr className="border-b border-border text-2xs text-ink-muted">
              <th scope="col" className="w-6 py-2 text-start font-medium">
                #
              </th>
              <th scope="col" className="py-2 text-start font-medium">
                {t('reports.item')}
              </th>
              <th scope="col" className="py-2 text-start font-medium">
                {t('reports.sold')}
              </th>
              <th scope="col" className="py-2 text-start font-medium">
                {t('reports.revenueCol')}
              </th>
              <th scope="col" className="py-2 text-end font-medium">
                %
              </th>
            </tr>
          </thead>
          <tbody>
            {data.topItems.map((i, n) => (
              <tr key={i.id} className="border-b border-border last:border-0">
                <td className="py-2.5 text-xs text-ink-muted tabular">{num(n + 1)}</td>
                <td className="py-2.5">
                  <span className="flex items-center gap-2.5">
                    <FoodImg image={i.image} className="size-9" />
                    <span className="truncate text-xs font-medium">{name(i)}</span>
                  </span>
                </td>
                <td className="py-2.5 text-xs tabular">{num(i.sold)}</td>
                <td className="py-2.5 text-xs tabular">{money(i.revenue, { whole: true })}</td>
                <td className="py-2.5 text-end text-xs tabular">
                  <span className="inline-flex items-center gap-1.5">
                    {pct(i.sharePct)}
                    {i.up ? <ArrowUp className="size-3.5 text-success" aria-label={t('reports.growth')} /> : <ArrowDown className="size-3.5 text-danger" />}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function OrdersTrend({ data }: { data: Overview }) {
  const { t, num, shortDay, dir } = useI18n();
  const rows = data.ordersTrend.map((r) => ({ label: shortDay(r.day), dineIn: r.dineIn, takeaway: r.takeaway }));
  return (
    <Card className="min-w-0 p-5">
      <CardHeader title={t('reports.ordersTrend')} />
      <div className="mt-3 h-[150px]" role="img" aria-label={t('reports.ordersTrend')}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={3} barCategoryGap="28%">
            <CartesianGrid stroke={C.grid} vertical={false} />
            <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} reversed={dir === 'rtl'} interval="preserveStartEnd" />
            <YAxis tick={axisTick} axisLine={false} tickLine={false} width={32} tickCount={5} allowDecimals={false} orientation={dir === 'rtl' ? 'right' : 'left'} tickFormatter={(v) => num(v)} />
            <Tooltip
              cursor={{ fill: 'rgb(248 101 29 / 0.06)' }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <ChartTooltip
                    title={String(label)}
                    rows={[
                      [C.accent, t('reports.dineIn'), num(Number(payload[0].value))],
                      [C.accentSoft, t('reports.takeaway'), num(Number(payload[1]?.value ?? 0))],
                    ]}
                  />
                ) : null
              }
            />
            <Bar dataKey="dineIn" fill={C.accent} radius={[3, 3, 0, 0]} maxBarSize={14} />
            <Bar dataKey="takeaway" fill={C.accentSoft} radius={[3, 3, 0, 0]} maxBarSize={14} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex gap-5 text-2xs text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: C.accent }} />
          {t('reports.dineIn')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: C.accentSoft }} />
          {t('reports.takeaway')}
        </span>
      </div>
    </Card>
  );
}

function Stars({ n, className }: { n: number; className?: string }) {
  return (
    <span className={cn('flex gap-0.5', className)} aria-label={`${n}/5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={cn('size-3.5', i < Math.round(n) ? 'fill-accent text-accent' : 'text-border')} />
      ))}
    </span>
  );
}

function Feedback({ data }: { data: Overview }) {
  const { t, num, num1, pct, locale } = useI18n();
  const f = data.feedback;
  return (
    <Card className="min-w-0 p-5">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Star className="size-4 text-accent" />
            {t('reports.feedback')}
          </span>
        }
      />
      {f.count === 0 ? (
        <EmptyState title={t('common.empty')} />
      ) : (
        <div className="mt-3 grid items-center gap-4 sm:grid-cols-[auto_1fr_1.1fr]">
          <div>
            <p className="text-2xl font-bold text-accent tabular">
              {num1(f.avg)} <span className="text-md text-ink">/ {num(5)}</span>
            </p>
            <p className="text-2xs text-ink-muted">{t('reports.reviews', { n: num(f.count) })}</p>
          </div>
          <ul className="flex flex-col gap-1">
            {[...f.distribution].sort((a, b) => b.star - a.star).map((d) => (
              <li key={d.star} className="flex items-center gap-2 text-2xs text-ink-muted">
                <span className="w-6 tabular">{num(d.star)}★</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
                  <span className="block h-full rounded-full bg-accent" style={{ width: `${d.pct}%` }} />
                </span>
                <span className="w-8 text-end tabular">{pct(d.pct)}</span>
              </li>
            ))}
          </ul>
          {f.quote ? (
            <figure className="rounded-md border border-border p-3">
              <blockquote className="text-2xs leading-5 text-ink-muted" lang="en" dir={locale === 'ar' ? 'ltr' : undefined}>
                “{f.quote.text}”
              </blockquote>
              <figcaption className="mt-1 text-2xs text-ink-muted">— {f.quote.author}</figcaption>
              <Stars n={f.quote.rating} className="mt-1.5" />
            </figure>
          ) : null}
        </div>
      )}
    </Card>
  );
}

function Insights({ data }: { data: Overview }) {
  const { t, num1, hour } = useI18n();
  const ins = data.insights;
  const up = ins.salesChangePct >= 0;
  const wasteHigh = ins.produceWasteChangePct > 5;
  const rows = [
    {
      Icon: up ? TrendingUp : TrendingDown,
      tone: up ? 'text-success' : 'text-danger',
      title: up ? t('reports.salesUp') : t('reports.salesDown'),
      body: t(up ? 'reports.salesUpBody' : 'reports.salesDownBody', { n: num1(Math.abs(ins.salesChangePct)) }),
    },
    {
      Icon: TriangleAlert,
      tone: wasteHigh ? 'text-accent' : 'text-success',
      title: t('reports.wasteAlert'),
      body: wasteHigh ? t('reports.wasteBody', { n: num1(ins.produceWasteChangePct) }) : t('reports.wasteOk'),
      link: { href: '/inventory', label: t('reports.reviewInventory') },
    },
    ins.peakStartHour !== null && ins.peakEndHour !== null
      ? { Icon: Clock, tone: 'text-accent', title: t('reports.peak'), body: t('reports.peakBody', { a: hour(ins.peakStartHour), b: hour(ins.peakEndHour) }), link: { href: '/staff', label: t('reports.extraStaff') } }
      : null,
  ].filter(Boolean) as { Icon: typeof Clock; tone: string; title: string; body: string; link?: { href: string; label: string } }[];
  return (
    <section className="rounded-lg border border-accent-line/60 bg-accent-soft2 p-4">
      <h2 className="flex items-center gap-2 text-md font-semibold text-accent">
        <Lightbulb className="size-5" />
        {t('reports.insights')}
      </h2>
      <ul className="mt-3 flex flex-col gap-2.5">
        {rows.map((r) => (
          <li key={r.title} className="flex gap-3 rounded-md bg-surface/70 p-3">
            <r.Icon className={cn('size-5 shrink-0', r.tone)} />
            <div className="min-w-0">
              <p className="text-xs font-semibold">{r.title}</p>
              <p className="mt-0.5 text-2xs leading-5 text-ink-muted">{r.body}</p>
              {r.link ? (
                <Link href={r.link.href} className="mt-1.5 inline-flex items-center gap-1 text-2xs font-medium text-accent hover:underline">
                  {r.link.label}
                  <ArrowRight className="flip-rtl size-3" />
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Branches({ data }: { data: Overview }) {
  const { t, name, money, pct } = useI18n();
  const icons = [Building2, MapPin, MapPin];
  const tones = ['softAccent', 'softWarning', 'softInfo'] as const;
  return (
    <Card className="p-4">
      <CardHeader title={t('reports.branches')} />
      <div className="mt-3 grid grid-cols-[1fr_auto_auto] gap-x-3 text-2xs text-ink-muted">
        <span>{t('reports.branch')}</span>
        <span className="text-end">{t('reports.revenueCol')}</span>
        <span className="w-12 text-end">{t('reports.growth')}</span>
      </div>
      <ul className="mt-1 divide-y divide-border">
        {data.branches.map((b, i) => {
          const Icon = icons[i % icons.length];
          return (
            <li key={b.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 py-2.5">
              <span className="flex min-w-0 items-center gap-2.5">
                <IconTile tone={tones[i % tones.length]} className="size-8 rounded-full [&>svg]:size-4">
                  <Icon />
                </IconTile>
                <span className="truncate text-xs font-medium">{name(b)}</span>
              </span>
              <span className="text-end text-xs tabular">{money(b.revenue, { whole: true })}</span>
              <span className={cn('flex w-12 items-center justify-end gap-0.5 text-2xs font-semibold tabular', b.growthPct >= 0 ? 'text-success' : 'text-danger')}>
                {b.growthPct >= 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                {pct(Math.abs(b.growthPct))}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function VatDialog({ range, open, onClose }: { range: Range; open: boolean; onClose: () => void }) {
  const { t, money, num } = useI18n();
  const q = useQuery({ queryKey: ['reports', 'vat', range], queryFn: () => api<Vat>(`/reports/vat?range=${range}`), enabled: open });
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()} title={t('reports.vat')} footer={<Button variant="ghost" onClick={onClose}>{t('common.close')}</Button>}>
      {!q.data ? (
        <Skeleton className="h-32" />
      ) : (
        <dl className="grid grid-cols-2 gap-3 text-sm">
          {(
            [
              [t('reports.vatInvoices'), num(q.data.invoices)],
              [t('reports.vatNet'), money(q.data.net)],
              [t('reports.vatAmount'), money(q.data.vat)],
              [t('reports.vatTotal'), money(q.data.total)],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="rounded-md border border-border p-3">
              <dt className="text-xs text-ink-muted">{k}</dt>
              <dd className="mt-1 font-semibold tabular">{v}</dd>
            </div>
          ))}
          <p className="col-span-2 text-xs text-ink-muted">{t('settings.zatcaBody')}</p>
        </dl>
      )}
    </Dialog>
  );
}

export default function ReportsPage() {
  const { t, num, money, pct, date } = useI18n();
  const { can } = useSession();
  const toast = useToast();
  const [range, setRange] = useState<Range>('7d');
  const [vatOpen, setVatOpen] = useState(false);
  const q = useQuery({ queryKey: ['reports', 'overview', range], queryFn: () => api<Overview>(`/reports/overview?range=${range}`), placeholderData: (p) => p });
  const d = q.data;
  const exportCsv = () => download(`/reports/export.csv?range=${range}`, `qidr-report-${range}.csv`).catch(() => toast('error', t('errors.generic')));
  const prev = t(range === 'today' ? 'common.vsYesterday' : range === '7d' ? 'common.vsPrevWeek' : 'common.vsPrev');
  const foot = (v: number, goodWhenDown?: boolean) => (
    <div>
      <Delta value={v} goodWhenDown={goodWhenDown} />
      <p className="mt-0.5 text-2xs text-ink-muted">{prev}</p>
    </div>
  );

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('reports.title')}</h1>
          <p className="mt-0.5 text-sm text-ink-muted">{t('reports.subtitle')}</p>
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
          <MenuRoot>
            <MenuTrigger asChild>
              <Button size="lg">
                <Download className="size-4" />
                {t('reports.download')}
              </Button>
            </MenuTrigger>
            <MenuContent align="end">
              <MenuItem icon={<FileText />} onSelect={exportCsv}>
                {t('reports.salesCsv')}
              </MenuItem>
              {can('reports.view') ? (
                <MenuItem icon={<Wallet />} onSelect={() => setVatOpen(true)}>
                  {t('reports.vat')}
                </MenuItem>
              ) : null}
            </MenuContent>
          </MenuRoot>
        </div>
      </div>

      {q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_272px]">
          <div className="flex min-w-0 flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
              {!d ? (
                Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-[132px] rounded-lg" />)
              ) : (
                <>
                  <Kpi tone="softAccent" icon={<Wallet />} label={t('reports.revenue')} value={money(d.cards.revenue, { whole: true })} foot={foot(d.cards.revenueDeltaPct)} />
                  <Kpi tone="softSuccess" icon={<ClipboardList />} label={t('reports.orders')} value={num(d.cards.orders)} foot={foot(d.cards.ordersDeltaPct)} />
                  <Kpi tone="softInfo" icon={<UsersRound />} label={t('reports.customers')} value={num(d.cards.customers)} foot={foot(d.cards.customersDeltaPct)} />
                  <Kpi tone="softViolet" icon={<ChefHat />} label={t('reports.avgPrep')} value={t('common.minutes', { n: num(d.cards.avgPrepMin) })} foot={foot(d.cards.avgPrepDeltaPct, true)} />
                  <Kpi tone="softDanger" icon={<Trash2 />} label={t('reports.waste')} value={pct(d.cards.wastePct)} foot={foot(d.cards.wasteDeltaPct, true)} />
                </>
              )}
            </div>
            {!d ? (
              <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
                <Skeleton className="h-[300px] rounded-lg" />
                <Skeleton className="h-[300px] rounded-lg" />
              </div>
            ) : (
              <>
                <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                  <RevenueOverview data={d} />
                  <SalesByCategory data={d} />
                </div>
                <div className="grid gap-4 lg:grid-cols-[1fr_1.35fr]">
                  <TopSelling data={d} />
                  <div className="flex min-w-0 flex-col gap-4">
                    <OrdersTrend data={d} />
                    <Feedback data={d} />
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="flex flex-col gap-4">
            {d ? <Insights data={d} /> : <Skeleton className="h-[330px] rounded-lg" />}
            {d ? <Branches data={d} /> : <Skeleton className="h-[220px] rounded-lg" />}
            <section className="relative overflow-hidden rounded-lg bg-sidebar p-5 text-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imgSrc('scenes/promo')} alt="" className="absolute inset-0 size-full object-cover opacity-90" />
              <div className="relative">
                <p className="text-lg font-bold leading-6">{t('reports.promoTitle')}</p>
                <p className="mt-1 max-w-[180px] text-2xs text-white/80">{t('reports.promoBody')}</p>
                <Button size="sm" className="mt-4" onClick={exportCsv}>
                  {t('reports.download')}
                  <ArrowRight className="flip-rtl size-3.5" />
                </Button>
              </div>
            </section>
            {d ? (
              <p className="text-center text-2xs text-ink-muted">
                {date(d.period.from)} – {date(new Date(new Date(d.period.to).getTime() - 1))}
              </p>
            ) : null}
          </div>
        </div>
      )}
      <VatDialog range={range} open={vatOpen} onClose={() => setVatOpen(false)} />
    </>
  );
}
