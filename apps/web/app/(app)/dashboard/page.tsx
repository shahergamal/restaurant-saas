'use client';

import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarDays,
  ChefHat,
  ClipboardList,
  Clock,
  Coins,
  LayoutGrid,
  Lightbulb,
  Package,
  Plus,
  Settings,
  UsersRound,
  Armchair,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { cn } from '@/lib/cn';
import { imgSrc } from '@/lib/photos';
import { Card, CardHeader } from '@/components/ui/card';
import { Delta } from '@/components/ui/delta';
import { Progress } from '@/components/ui/progress';
import { IconTile, StatCard } from '@/components/ui/stat-card';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { ButtonLink } from '@/components/ui/button';
import { axisTick, C } from '@/components/charts/theme';
import { ChartTooltip } from '@/components/charts/tooltip';

type Activity = { id: string; kind: string; data: Record<string, any>; at: string };
type Dashboard = {
  user: { nameAr: string; nameEn: string };
  now: string;
  cards: { occupiedTables: number; totalTables: number; activeOrders: number; avgPrepMin: number; avgPrepDeltaMin: number; revenueToday: number; revenueDeltaPct: number; delayedOrders: number };
  hourlySales: { hour: number; total: number }[];
  insight: { kind: 'kitchen_congestion'; waiting: number; thresholdMin: number; station: { key: string; nameAr: string; nameEn: string } | null } | { kind: 'all_clear'; thresholdMin: number } | null;
  activity: Activity[];
};

function riyadhHour(d: Date) {
  return (d.getUTCHours() + 3) % 24;
}

function Hero({ data }: { data?: Dashboard }) {
  const { t, name, longDate, hijri } = useI18n();
  const now = data ? new Date(data.now) : null;
  const h = now ? riyadhHour(now) : 9;
  const greet = h < 12 ? t('dashboard.morning') : h < 17 ? t('dashboard.afternoon') : t('dashboard.evening');
  const first = data ? name(data.user).split(' ')[0] : '';
  return (
    <div className="relative h-[246px] overflow-hidden rounded-lg bg-sidebar">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imgSrc('scenes/hero')} alt="" className="absolute inset-0 size-full object-cover rtl:-scale-x-100" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/35 to-transparent rtl:bg-gradient-to-l" />
      <div className="relative flex h-full flex-col justify-center px-8 text-white">
        <h1 className="text-[34px] font-bold leading-tight tracking-tight">
          {greet} <span className="text-accent">{first || ' '}</span>
        </h1>
        <p className="mt-2 text-lg text-white/90">{t('dashboard.subtitle')}</p>
        <p className="mt-6 flex items-center gap-2.5 text-sm text-white/90">
          <CalendarDays className="size-[18px]" />
          {now ? (
            <>
              {longDate(now)}
              <span className="text-white/50">•</span>
              <span className="text-white/75">{hijri(now)}</span>
            </>
          ) : null}
        </p>
      </div>
    </div>
  );
}

function Stats({ data }: { data?: Dashboard }) {
  const { t, num, money } = useI18n();
  if (!data)
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-[196px] rounded-lg" />
        ))}
      </div>
    );
  const c = data.cards;
  const occ = c.totalTables ? Math.round((c.occupiedTables / c.totalTables) * 100) : 0;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      <StatCard
        layout="stack"
        tone="accent"
        icon={<Armchair />}
        label={t('dashboard.occupiedTables')}
        value={
          <>
            {num(c.occupiedTables)} <span className="text-lg font-normal text-ink-muted">/ {num(c.totalTables)}</span>
          </>
        }
        foot={
          <>
            <Progress value={occ} label={t('dashboard.occupancy', { n: occ })} />
            <p className="mt-2.5 text-2xs text-ink-muted">{t('dashboard.occupancy', { n: occ })}</p>
          </>
        }
      />
      <StatCard layout="stack" tone="teal" icon={<ClipboardList />} label={t('dashboard.activeOrders')} value={num(c.activeOrders)} foot={<p className="text-2xs text-ink-muted">{t('dashboard.inProgress')}</p>} />
      <StatCard
        layout="stack"
        tone="info"
        icon={<Clock />}
        label={t('dashboard.avgPrep')}
        value={t('common.minutes', { n: c.avgPrepMin })}
        foot={
          <div className="flex flex-col gap-1">
            <Delta value={c.avgPrepDeltaMin} unit="min" goodWhenDown />
            <span className="text-2xs text-ink-muted">{t('common.vsLastHour')}</span>
          </div>
        }
      />
      <StatCard
        layout="stack"
        tone="violet"
        icon={<Coins />}
        label={t('dashboard.revenue')}
        value={money(c.revenueToday, { whole: true })}
        foot={
          <div className="flex flex-col gap-1">
            <Delta value={c.revenueDeltaPct} />
            <span className="text-2xs text-ink-muted">{t('common.vsYesterday')}</span>
          </div>
        }
      />
      <StatCard
        layout="stack"
        tone="danger"
        icon={<AlertTriangle />}
        label={t('dashboard.delayed')}
        value={<span className={c.delayedOrders ? 'text-danger' : undefined}>{num(c.delayedOrders)}</span>}
        foot={<p className="text-2xs text-ink-muted">{t('dashboard.needsAttention')}</p>}
      />
    </div>
  );
}

function QuickActions() {
  const { t } = useI18n();
  const { can } = useSession();
  const items = [
    { href: '/orders?new=1', icon: Plus, label: t('dashboard.newOrder'), p: 'orders.create' },
    { href: '/tables', icon: LayoutGrid, label: t('dashboard.viewTables'), p: 'tables.view' },
    { href: '/inventory', icon: Package, label: t('dashboard.checkInventory'), p: 'inventory.view' },
    { href: '/reports', icon: BarChart3, label: t('dashboard.viewReports'), p: 'reports.view' },
    { href: '/staff', icon: UsersRound, label: t('dashboard.manageStaff'), p: 'staff.manage' },
    { href: '/settings', icon: Settings, label: t('dashboard.settings'), p: 'settings.view' },
  ].filter((i) => can(i.p));
  return (
    <Card className="p-4">
      <CardHeader title={t('dashboard.quickActions')} className="px-1" />
      <div className="mt-3 grid grid-cols-3 gap-2.5">
        {items.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className="flex h-[76px] flex-col items-center justify-center gap-2 rounded-md border border-border bg-surface text-center text-2xs font-medium text-ink transition-colors hover:border-accent/40 hover:bg-accent-soft2"
          >
            <span className="grid size-8 place-items-center rounded-full bg-accent-soft text-accent">
              <i.icon className="size-4" />
            </span>
            {i.label}
          </Link>
        ))}
      </div>
    </Card>
  );
}

function SalesChart({ data }: { data?: Dashboard }) {
  const { t, money, compact, hour, dir } = useI18n();
  const rows = data?.hourlySales.map((h) => ({ ...h, label: hour(h.hour) })) ?? [];
  const empty = data && rows.every((r) => r.total === 0);
  return (
    <Card className="flex flex-col p-5">
      <CardHeader title={t('dashboard.salesOverview')} action={<span className="rounded px-2 py-1 text-xs font-medium text-ink">{t('common.today')}</span>} />
      <div className="mt-4 h-[180px]">
        {!data ? (
          <Skeleton className="h-full" />
        ) : empty ? (
          <EmptyState title={t('dashboard.noSales')} className="py-6" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 4, right: 4, left: 4, bottom: 0 }} barCategoryGap="30%">
              <CartesianGrid vertical={false} stroke={C.grid} />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} reversed={dir === 'rtl'} interval={0} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} width={44} tickFormatter={(v: number) => compact(v)} orientation={dir === 'rtl' ? 'right' : 'left'} />
              <Tooltip
                cursor={{ fill: 'rgb(248 101 29 / 0.06)' }}
                content={({ active, payload }) =>
                  active && payload?.length ? <ChartTooltip title={String(payload[0]!.payload.label)} rows={[[C.accent, t('dashboard.revenue'), money(Number(payload[0]!.value))]]} /> : null
                }
              />
              <Bar dataKey="total" fill={C.accent} radius={[4, 4, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}

function Insight({ data }: { data?: Dashboard }) {
  const { t, name } = useI18n();
  const ins = data?.insight;
  const congested = ins?.kind === 'kitchen_congestion';
  return (
    <section className="flex flex-col rounded-lg border border-accent-line/70 bg-accent-soft2 p-5">
      <h2 className="flex items-center gap-2.5 text-md font-semibold text-accent">
        <Lightbulb className="size-5" />
        {t('dashboard.insight')}
      </h2>
      {!data ? (
        <Skeleton className="mt-5 h-24" />
      ) : congested ? (
        <>
          <p className="mt-5 flex items-center gap-2 text-[15px] font-semibold text-ink">
            <span className="grid size-5 place-items-center rounded-full bg-accent text-white">
              <AlertTriangle className="size-3" strokeWidth={2.5} />
            </span>
            {t('dashboard.congestion')}
          </p>
          <p className="mb-5 mt-3 text-sm leading-6 text-ink-muted">{t('dashboard.congestionBody', { n: ins.waiting, m: ins.thresholdMin })}</p>
          <ButtonLink href={`/kitchen${ins.station ? `?station=${ins.station.key}` : ''}`} className="mt-auto w-full justify-between" size="lg">
            {t('dashboard.openStation', { station: ins.station ? name(ins.station) : t('nav.kitchen') })}
            <ArrowRight className="flip-rtl size-4" />
          </ButtonLink>
        </>
      ) : (
        <>
          <p className="mt-5 flex items-center gap-2 text-[15px] font-semibold text-ink">
            <CheckCircle2 className="size-5 text-success" />
            {t('dashboard.allClear')}
          </p>
          <p className="mt-3 text-sm leading-6 text-ink-muted">{t('dashboard.allClearBody', { m: ins && 'thresholdMin' in ins ? ins.thresholdMin : 20 })}</p>
        </>
      )}
    </section>
  );
}

const ACT: Record<string, { icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  order_created: { icon: ClipboardList, tone: 'bg-success-soft text-success' },
  order_ready: { icon: ChefHat, tone: 'bg-accent-soft text-accent' },
  table_seated: { icon: Armchair, tone: 'bg-violet-soft text-violet' },
  order_delayed: { icon: AlertTriangle, tone: 'bg-danger-soft text-danger' },
  low_stock: { icon: Package, tone: 'bg-teal-soft text-teal' },
};

function ActivityRow({ a }: { a: Activity }) {
  const { t, name, ago, qty } = useI18n();
  const meta = ACT[a.kind] ?? ACT.order_created!;
  const d = a.data;
  const n = d.number !== undefined ? String(d.number) : '';
  const [title, sub] = (() => {
    switch (a.kind) {
      case 'order_created':
        return [t('dashboard.act.order_created', { n }), d.table ? t('dashboard.act.tableItems', { t: d.table, n: d.items ?? 0 }) : t('channel.takeaway')];
      case 'order_ready':
        return [t('dashboard.act.order_ready', { n }), t('dashboard.act.kitchenAt', { s: name({ nameAr: d.stationAr, nameEn: d.stationEn }) })];
      case 'table_seated':
        return [t('dashboard.act.table_seated', { n: d.table }), d.walkIn ? t('dashboard.act.walkIn') : t('tables.reservation')];
      case 'order_delayed':
        return [t('dashboard.act.order_delayed', { n }), t('dashboard.act.moreThan', { n: d.minutes ?? 20 })];
      case 'low_stock':
        return [t('dashboard.act.low_stock'), `${name(d as any)} • ${t('dashboard.act.left', { q: d.unit ? qty(d.qtyMilli ?? 0, d.unit) : '' })}`];
      default:
        return [a.kind, ''];
    }
  })();
  return (
    <li className="flex items-start gap-3 py-3">
      <span className={cn('grid size-8 shrink-0 place-items-center rounded-md', meta.tone)}>
        <meta.icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{title}</p>
        <p className="mt-0.5 truncate text-2xs text-ink-muted">{sub}</p>
      </div>
      <time className="shrink-0 text-2xs text-ink-muted" dateTime={a.at}>
        {ago(a.at)}
      </time>
    </li>
  );
}

function RecentActivity({ data }: { data?: Dashboard }) {
  const { t } = useI18n();
  return (
    <Card className="p-4">
      <CardHeader
        title={t('dashboard.recentActivity')}
        className="px-1"
        action={
          <Link href="/orders" className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
            {t('common.viewAll')}
            <ArrowRight className="flip-rtl size-3.5" />
          </Link>
        }
      />
      {!data ? (
        <div className="mt-3 flex flex-col gap-4">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      ) : data.activity.length === 0 ? (
        <EmptyState title={t('common.empty')} />
      ) : (
        <ul className="mt-1 divide-y divide-border px-1">
          {data.activity.map((a) => (
            <ActivityRow key={a.id} a={a} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function QuickOverview() {
  const { t } = useI18n();
  const { can } = useSession();
  const tiles = [
    { href: '/tables', icon: Armchair, label: t('dashboard.tables'), sub: t('dashboard.viewAllTables'), p: 'tables.view' },
    { href: '/orders', icon: ClipboardList, label: t('dashboard.activeOrders'), sub: t('dashboard.viewOrders'), p: 'orders.view' },
    { href: '/kitchen', icon: ChefHat, label: t('dashboard.kitchen'), sub: t('dashboard.monitorKitchen'), p: 'kitchen.view' },
    { href: '/inventory', icon: Package, label: t('dashboard.inventory'), sub: t('dashboard.checkStock'), p: 'inventory.view' },
  ].filter((x) => can(x.p));
  return (
    <Card className="p-4">
      <CardHeader title={t('dashboard.quickOverview')} className="px-1" />
      <div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {tiles.map((x, i) => (
          <Link key={x.href} href={x.href} className="group flex items-center gap-3 rounded-md border border-border p-3 transition-colors hover:border-accent/40 hover:bg-accent-soft2">
            <IconTile tone={i === 0 ? 'accent' : 'softAccent'} className="size-12 rounded-md [&>svg]:size-6">
              <x.icon />
            </IconTile>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{x.label}</span>
              <span className="mt-0.5 block truncate text-2xs text-ink-muted">{x.sub}</span>
            </span>
            <ChevronRight className="flip-rtl size-4 text-accent" />
          </Link>
        ))}
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const q = useQuery({ queryKey: ['dashboard'], queryFn: () => api<Dashboard>('/dashboard'), refetchInterval: 60_000 });
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  const data = q.data;
  return (
    <div className="flex flex-col gap-4">
      <Hero data={data} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_306px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Stats data={data} />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_284px]">
            <SalesChart data={data} />
            <Insight data={data} />
          </div>
          <QuickOverview />
        </div>
        <div className="flex flex-col gap-4">
          <QuickActions />
          <RecentActivity data={data} />
        </div>
      </div>
    </div>
  );
}
