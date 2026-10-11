'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellOff, CakeSlice, Check, CheckCircle2, ChefHat, ChevronRight, Clock, CookingPot, CupSoda, Eye, Filter, Flame, Layers, NotebookPen, Salad, ShoppingBag, Timer, TrendingUp, AlertTriangle, LayoutGrid, Users, Utensils, Truck } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useErrorToast } from '@/lib/errors';
import { useI18n } from '@/lib/i18n';
import { useRealtime } from '@/lib/realtime';
import { useSession } from '@/lib/session';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FoodImg } from '@/components/ui/food-img';
import { MenuContent, MenuItem, MenuLabel, MenuRoot, MenuTrigger } from '@/components/ui/menu';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { useOrderDialogs } from '@/components/orders/order-dialogs';

type Ticket = {
  id: string;
  orderId: string;
  orderNumber: number;
  table: number | null;
  channel: string;
  elapsedMin: number;
  estimatedMin: number | null;
  items: { id: string; nameAr: string; nameEn: string; image: string | null; qty: number; modifiers: string[]; status: string }[];
};
type Station = { id: string; key: string; nameAr: string; nameEn: string; completedToday: number; tickets: Ticket[] };
type Board = { stations: Station[]; thresholdMin?: number };
type Perf = { avgPrepMin: number; onTimePct: number; delayed: number; throughputDeltaPct: number; lastHourPrepMin: number };
type TicketDetail = {
  id: string;
  status: string;
  orderId: string;
  orderNumber: number;
  orderStatus: string;
  table: number | null;
  guests: number | null;
  createdAt: string;
  elapsedMin: number;
  estimatedMin: number | null;
  station: { key: string; nameAr: string; nameEn: string };
  notes: string[];
  items: { id: string; nameAr: string; nameEn: string; image: string | null; qty: number; modifiers: string[] }[];
  totalItems: number;
};

const STATION_STYLE: Record<string, { icon: React.ComponentType<{ className?: string }>; head: string; icon2: string }> = {
  grill: { icon: Flame, head: 'bg-accent-soft', icon2: 'text-accent' },
  pasta: { icon: CookingPot, head: 'bg-[#FFF6DD]', icon2: 'text-[#E3A008]' },
  salad: { icon: Salad, head: 'bg-success-soft', icon2: 'text-success' },
  desserts: { icon: CakeSlice, head: 'bg-violet-soft', icon2: 'text-violet' },
  drinks: { icon: CupSoda, head: 'bg-info-soft', icon2: 'text-info' },
};
const styleOf = (key: string) => STATION_STYLE[key] ?? { icon: ChefHat, head: 'bg-surface-muted', icon2: 'text-ink-muted' };

function elapsedTone(min: number, threshold: number) {
  if (min > threshold) return 'bg-danger-soft text-danger';
  if (min > threshold / 2) return 'bg-warning-soft text-warning';
  return 'bg-success-soft text-success';
}

/** Short two-tone chime via Web Audio; no audio file needed. */
function chime() {
  try {
    const ctx = new AudioContext();
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.18 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.3);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.18);
      o.stop(ctx.currentTime + i * 0.18 + 0.32);
    });
  } catch {
    /* audio blocked until the user interacts */
  }
}

function TicketCard({ tk, threshold, selected, onSelect }: { tk: Ticket; threshold: number; selected: boolean; onSelect: () => void }) {
  const { t, name, num } = useI18n();
  const delayed = tk.elapsedMin > threshold;
  return (
    <button
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'animate-fade-in w-full rounded-md border bg-surface p-2.5 text-start transition-shadow hover:shadow-card',
        selected ? 'border-accent ring-2 ring-accent/20' : delayed ? 'border-danger/30' : 'border-border',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-sm font-semibold tabular">#{tk.orderNumber}</span>
        <span className={cn('inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-2xs font-semibold tabular', elapsedTone(tk.elapsedMin, threshold))}>
          {delayed ? <AlertTriangle className="size-3" /> : null}
          {t('common.minutes', { n: tk.elapsedMin })}
        </span>
      </div>
      <p className="mt-1 flex items-center gap-1.5 text-2xs text-ink-muted">
        {tk.table ? <LayoutGrid className="size-3" /> : <ShoppingBag className="size-3" />}
        {tk.table ? t('common.table', { n: tk.table }) : t(`channel.${tk.channel}`)}
      </p>
      <ul className="mt-2.5 flex flex-col gap-2">
        {tk.items.map((i) => (
          <li key={i.id} className="flex items-center gap-2.5">
            <FoodImg image={i.image} className="size-8" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{name(i)}</p>
              {i.modifiers.length ? <p className="truncate text-2xs text-ink-muted">• {i.modifiers.join(', ')}</p> : null}
            </div>
            <span className="text-2xs text-ink-muted tabular">×{num(i.qty)}</span>
          </li>
        ))}
      </ul>
    </button>
  );
}

function Column({ s, threshold, selectedId, onSelect, wide }: { s: Station; threshold: number; selectedId: string | null; onSelect: (t: Ticket) => void; wide?: boolean }) {
  const { t, name, num } = useI18n();
  const st = styleOf(s.key);
  return (
    <section className="flex min-w-[200px] flex-col rounded-lg border border-border bg-surface/60" aria-label={name(s)}>
      <header className={cn('flex items-center gap-2 rounded-t-lg px-3 py-3', st.head)}>
        <st.icon className={cn('size-5', st.icon2)} />
        <h2 className="flex-1 truncate text-sm font-semibold">{name(s)}</h2>
        <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-2xs font-semibold tabular">{num(s.tickets.length)}</span>
      </header>
      <div className={cn('flex flex-1 flex-col gap-2.5 p-2.5', wide && 'grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] content-start')}>
        {s.tickets.length === 0 ? <EmptyState title={t('kitchen.emptyStation')} className="py-8" icon={<CheckCircle2 className="size-5 text-success" />} /> : null}
        {s.tickets.map((tk) => (
          <TicketCard key={tk.id} tk={tk} threshold={threshold} selected={tk.id === selectedId} onSelect={() => onSelect(tk)} />
        ))}
        <div className="mt-auto flex items-center gap-2 rounded-md bg-surface-muted px-3 py-2.5 text-xs">
          <CheckCircle2 className="size-4 text-success" />
          <span className="flex-1">
            <span className="block font-medium">{t('kitchen.completed')}</span>
            <span className="text-2xs text-ink-muted">{t('kitchen.ordersN', { n: s.completedToday })}</span>
          </span>
        </div>
      </div>
    </section>
  );
}

const STEPS = ['cooking', 'ready', 'serving', 'delivered'] as const;
const STEP_ICON = { cooking: ChefHat, ready: Utensils, serving: Users, delivered: Truck };

function Detail({ id, threshold }: { id: string | null; threshold: number }) {
  const { t, name, num, time } = useI18n();
  const { can } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const fail = useErrorToast();
  const dialogs = useOrderDialogs();
  const q = useQuery({ queryKey: ['kitchen', 'ticket', id], queryFn: () => api<TicketDetail>(`/kitchen/tickets/${id}`), enabled: !!id });
  const ready = useMutation({
    mutationFn: (tid: string) => api(`/kitchen/tickets/${tid}/ready`, { method: 'PATCH' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kitchen'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast('success', t('kitchen.readyToast', { n: String(q.data?.orderNumber ?? '') }));
    },
    onError: fail,
  });
  if (!id)
    return (
      <Card className="flex min-h-[420px] items-center justify-center">
        <EmptyState icon={<ChefHat className="size-5" />} title={t('kitchen.title')} body={t('kitchen.selectTicket')} />
      </Card>
    );
  if (q.isError) return <Card><ErrorState onRetry={() => q.refetch()} /></Card>;
  const d = q.data;
  if (!d)
    return (
      <Card className="flex flex-col gap-4 p-5">
        <Skeleton className="h-14" />
        <Skeleton className="h-16" />
        <Skeleton className="h-40" />
      </Card>
    );
  const stepIdx = d.status === 'cooking' ? 0 : d.orderStatus === 'served' || d.orderStatus === 'paid' ? 3 : d.status === 'ready' ? 1 : 2;
  const remaining = Math.max(0, (d.estimatedMin ?? 0) - d.elapsedMin);
  const delayed = d.status === 'cooking' && d.elapsedMin > threshold;
  return (
    <Card className="overflow-hidden">
      <div className={cn('flex items-center justify-between px-5 py-4 text-white', delayed ? 'bg-danger' : 'bg-accent')}>
        <h2 className="text-xl font-semibold">{t('kitchen.order', { n: String(d.orderNumber) })}</h2>
        <span className="rounded bg-white px-2.5 py-1 text-2xs font-semibold text-accent">{delayed ? t('status.delayed') : t(`status.${d.status === 'cooking' ? 'in_progress' : 'ready'}`)}</span>
      </div>
      <div className="p-5">
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink">
          <span className="inline-flex items-center gap-1.5">
            <LayoutGrid className="size-3.5 text-ink-muted" />
            {d.table ? t('common.table', { n: d.table }) : t('kitchen.takeaway')}
          </span>
          {d.guests ? (
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-3.5 text-ink-muted" />
              {t('kitchen.guests', { n: d.guests })}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1.5 text-ink-muted">
            <Clock className="size-3.5" />
            {t('kitchen.minAgo', { n: d.elapsedMin })}
          </span>
        </p>
        <ol className="mt-5 flex items-start justify-between" aria-label={t('orders.status')}>
          {STEPS.map((s, i) => {
            const Icon = STEP_ICON[s];
            const done = i <= stepIdx;
            return (
              <li key={s} className="relative flex flex-1 flex-col items-center gap-1.5" aria-current={i === stepIdx ? 'step' : undefined}>
                {i > 0 ? <span className={cn('absolute end-1/2 top-6 h-px w-full -translate-y-1/2', i <= stepIdx ? 'bg-accent' : 'bg-border')} style={{ insetInlineEnd: '50%', marginInlineEnd: 24 }} aria-hidden /> : null}
                <span className={cn('relative z-10 grid size-12 place-items-center rounded-full', done ? 'bg-accent text-white' : 'bg-surface-muted text-ink-subtle')}>
                  <Icon className="size-5" />
                </span>
                <span className={cn('text-2xs', i === stepIdx ? 'font-semibold text-accent' : 'text-ink-muted')}>{t(`kitchen.${s}`)}</span>
              </li>
            );
          })}
        </ol>
        <h3 className="mt-6 text-sm font-semibold">{t('kitchen.orderItems')}</h3>
        <ul className="mt-2 divide-y divide-border">
          {d.items.map((i) => (
            <li key={i.id} className="flex items-center gap-3 py-2.5">
              <FoodImg image={i.image} className="size-12" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{name(i)}</p>
                {i.modifiers.length ? <p className="text-2xs text-ink-muted">• {i.modifiers.join(', ')}</p> : null}
              </div>
              <span className="text-xs text-ink-muted tabular">×{num(i.qty)}</span>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between border-y border-border py-3 text-sm">
          <span>{t('kitchen.totalItems')}</span>
          <span className="font-semibold tabular">{num(d.totalItems)}</span>
        </div>
        <h3 className="mt-4 flex items-center gap-2 text-sm font-semibold">
          <NotebookPen className="size-4" />
          {t('kitchen.specialNotes')}
        </h3>
        {d.notes.length ? (
          <ul className="mt-2 flex flex-col gap-1.5">
            {d.notes.map((n, i) => (
              <li key={i} className="rounded-md bg-warning-soft px-3 py-2 text-sm font-medium text-ink">
                {n}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-ink-muted">{t('kitchen.noNotes')}</p>
        )}
        {d.status === 'cooking' ? (
          <div className={cn('mt-5 flex items-center gap-3.5 rounded-md p-4', delayed ? 'bg-danger-soft' : 'bg-accent-soft')}>
            <Timer className={cn('size-9', delayed ? 'text-danger' : 'text-accent')} strokeWidth={1.6} />
            <div>
              <p className={cn('text-xs font-medium', delayed ? 'text-danger' : 'text-accent')}>{t('kitchen.estimated')}</p>
              <p className={cn('text-2xl font-semibold tabular', delayed ? 'text-danger' : 'text-accent')}>
                {remaining === 0 && d.elapsedMin > (d.estimatedMin ?? 0) ? '+' + t('common.minutes', { n: d.elapsedMin - (d.estimatedMin ?? 0) }) : t('common.minutes', { n: remaining })}
              </p>
              <p className="text-2xs text-ink-muted">({t('orders.since', { t: time(d.createdAt) })})</p>
            </div>
          </div>
        ) : null}
        <div className="mt-5 flex flex-col gap-2.5">
          {can('kitchen.update') && d.status === 'cooking' ? (
            <Button size="lg" loading={ready.isPending} onClick={() => ready.mutate(d.id)}>
              <Check className="size-4" />
              {t('kitchen.markReady')}
            </Button>
          ) : null}
          {can('orders.view') ? (
            <Button variant="secondary" size="lg" onClick={() => dialogs.openDetails(d.orderId)}>
              <Eye className="size-4" />
              {t('kitchen.viewDetails')}
            </Button>
          ) : null}
        </div>
      </div>
      {dialogs.node}
    </Card>
  );
}

function Performance() {
  const { t, num } = useI18n();
  const q = useQuery({ queryKey: ['kitchen', 'performance'], queryFn: () => api<Perf>('/kitchen/performance'), refetchInterval: 60_000 });
  const p = q.data;
  const cell = 'flex items-center gap-3 border-border px-4 md:border-s';
  return (
    <Card className="mt-4 flex flex-wrap items-center gap-y-3 p-4">
      <div className="flex items-center gap-3 pe-4">
        <span className="grid size-11 place-items-center rounded-full bg-accent text-white">
          <Flame className="size-5" />
        </span>
        <h2 className="w-24 text-sm font-semibold leading-5">{t('kitchen.performance')}</h2>
      </div>
      {!p ? (
        <Skeleton className="h-10 flex-1" />
      ) : (
        <>
          <div className={cell}>
            <Clock className="size-5 text-accent" />
            <div>
              <p className="text-2xs text-ink-muted">{t('kitchen.avgPrep')}</p>
              <p className="text-sm font-semibold tabular">{t('common.minutes', { n: p.avgPrepMin })}</p>
            </div>
          </div>
          <div className={cell}>
            <CheckCircle2 className="size-5 text-success" />
            <div>
              <p className="text-2xs text-ink-muted">{t('kitchen.onTime')}</p>
              <p className="text-sm font-semibold tabular">{num(p.onTimePct)}%</p>
            </div>
          </div>
          <div className={cell}>
            <AlertTriangle className="size-5 text-danger" />
            <div>
              <p className="text-2xs text-ink-muted">{t('kitchen.delayed')}</p>
              <p className="text-sm font-semibold tabular">{num(p.delayed)}</p>
            </div>
          </div>
          <div className={cn(cell, 'ms-auto')}>
            <TrendingUp className={cn('size-5', p.throughputDeltaPct >= 0 ? 'text-success' : 'text-danger')} />
            <div>
              <p className="text-sm font-semibold tabular">
                {p.throughputDeltaPct > 0 ? '+' : ''}
                {num(p.throughputDeltaPct)}%
              </p>
              <p className="text-2xs text-ink-muted">{t('kitchen.vsLastHour')}</p>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

type FilterKey = 'all' | 'delayed' | 'dine_in' | 'takeaway';

function KitchenInner() {
  const { t, name, num } = useI18n();
  const params = useSearchParams();
  const [station, setStation] = useState<string>(params.get('station') ?? 'all');
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [sound, setSound] = useState(false);
  const toast = useToast();
  useEffect(() => {
    try {
      setSound(localStorage.getItem('sufra.kds.sound') === '1');
    } catch {
      /* ignore */
    }
  }, []);
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const onEvent = useCallback(
    (event: string) => {
      if (event === 'ticket.created') {
        if (soundRef.current) chime();
        toast('success', t('kitchen.newTicket'));
      }
    },
    [t, toast],
  );
  useRealtime(onEvent);
  const board = useQuery({ queryKey: ['kitchen', 'board'], queryFn: () => api<Board>('/kitchen/board'), refetchInterval: 20_000 });
  const threshold = board.data?.thresholdMin ?? 20;
  const stations = useMemo(
    () =>
      (board.data?.stations ?? []).map((s) => ({
        ...s,
        tickets: s.tickets.filter((tk) => (filter === 'delayed' ? tk.elapsedMin > threshold : filter === 'dine_in' ? tk.channel === 'dine_in' : filter === 'takeaway' ? tk.channel !== 'dine_in' : true)),
      })),
    [board.data, filter, threshold],
  );
  const all = stations.flatMap((s) => s.tickets);
  useEffect(() => {
    if (!board.data) return;
    if (!selected || !all.some((x) => x.id === selected)) {
      const pool = station === 'all' ? all : stations.find((s) => s.key === station)?.tickets ?? [];
      setSelected(pool[0]?.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.data, station, filter]);
  const shown = station === 'all' ? stations : stations.filter((s) => s.key === station);
  const toggleSound = () => {
    const v = !sound;
    setSound(v);
    if (v) chime();
    try {
      localStorage.setItem('sufra.kds.sound', v ? '1' : '0');
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px] 2xl:grid-cols-[minmax(0,1fr)_330px]">
      <div className="min-w-0">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <ChefHat className="size-11 text-accent" strokeWidth={1.6} />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{t('kitchen.title')}</h1>
              <p className="mt-0.5 text-sm text-ink-muted">{t('kitchen.subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm text-success">
              <span className="size-2 animate-pulse rounded-full bg-success" aria-hidden />
              {t('common.live')}
            </span>
            <Button variant="outline" onClick={toggleSound} aria-pressed={sound} aria-label={t('kitchen.sound')}>
              {sound ? <Bell className="size-4" /> : <BellOff className="size-4" />}
              <span className="hidden sm:inline">{t('kitchen.sound')}</span>
            </Button>
            <MenuRoot>
              <MenuTrigger className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-muted">
                <Filter className="size-4" />
                {t('kitchen.filter')}
                {filter !== 'all' ? <span className="size-1.5 rounded-full bg-accent" /> : null}
              </MenuTrigger>
              <MenuContent>
                <MenuLabel>{t('kitchen.filter')}</MenuLabel>
                {(['all', 'delayed', 'dine_in', 'takeaway'] as FilterKey[]).map((k) => (
                  <MenuItem key={k} onSelect={() => setFilter(k)} icon={filter === k ? <Check /> : <span className="block size-4" />}>
                    {k === 'all' ? t('common.all') : k === 'delayed' ? t('status.delayed') : t(`channel.${k}`)}
                  </MenuItem>
                ))}
              </MenuContent>
            </MenuRoot>
          </div>
        </div>

        <div role="tablist" aria-label={t('kitchen.allStations')} className="scrollbar-thin mb-4 flex gap-2.5 overflow-x-auto rounded-lg border border-border bg-surface p-2.5">
          {[{ key: 'all', nameAr: 'كل المحطات', nameEn: 'All Stations', count: all.length }, ...stations.map((s) => ({ key: s.key, nameAr: s.nameAr.replace('محطة ', ''), nameEn: s.nameEn.replace(' Station', ''), count: s.tickets.length }))].map((s) => {
            const active = station === s.key;
            const st = s.key === 'all' ? { icon: Layers, icon2: active ? 'text-white' : 'text-accent' } : styleOf(s.key);
            return (
              <button
                key={s.key}
                role="tab"
                aria-selected={active}
                onClick={() => setStation(s.key)}
                className={cn('inline-flex h-10 shrink-0 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors', active ? 'border-accent bg-accent text-white shadow-accent' : 'border-border bg-surface hover:bg-surface-muted')}
              >
                <st.icon className={cn('size-5', active ? 'text-white' : st.icon2)} />
                {name(s)}
                <span className={cn('min-w-[22px] rounded-full px-1.5 py-px text-2xs font-semibold tabular', active ? 'bg-white/20' : 'bg-surface-muted text-ink-muted')}>{num(s.count)}</span>
              </button>
            );
          })}
        </div>

        {board.isError ? (
          <Card>
            <ErrorState onRetry={() => board.refetch()} />
          </Card>
        ) : !board.data ? (
          <div className="grid grid-cols-5 gap-3">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-[520px] rounded-lg" />
            ))}
          </div>
        ) : (
          <div className={cn('scrollbar-thin grid gap-3 overflow-x-auto pb-1', shown.length > 1 ? 'grid-cols-[repeat(5,minmax(148px,1fr))]' : 'grid-cols-1')}>
            {shown.map((s) => (
              <Column key={s.id} s={s} threshold={threshold} selectedId={selected} onSelect={(tk) => setSelected(tk.id)} wide={shown.length === 1} />
            ))}
          </div>
        )}
        <Performance />
      </div>
      <div>
        <Detail id={selected} threshold={threshold} />
      </div>
    </div>
  );
}

export default function KitchenPage() {
  return (
    <Suspense>
      <KitchenInner />
    </Suspense>
  );
}
