'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ArrowRight, Bike, ChefHat, LayoutGrid, MapPin, MoreVertical, Package, Plus, ShoppingBag, TrendingUp, User, UtensilsCrossed } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { cn } from '@/lib/cn';
import { imgSrc } from '@/lib/photos';
import { Card, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { PillTabs } from '@/components/ui/pill-tabs';
import { StatusBadge } from '@/components/ui/badge';
import { FoodImg } from '@/components/ui/food-img';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { MenuContent, MenuItem, MenuRoot, MenuTrigger } from '@/components/ui/menu';
import { Select } from '@/components/ui/field';
import { ButtonLink } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { FloorLegend, FloorMap, type Floor } from '@/components/floor-map';
import { NewOrderDialog, useOrderAction, useOrderDialogs } from '@/components/orders/order-dialogs';

type Status = 'all' | 'in_progress' | 'ready' | 'delayed';
type OrderRow = {
  id: string;
  number: number;
  channel: 'dine_in' | 'takeaway' | 'delivery';
  platform: string | null;
  table: { label: number } | null;
  guests: number | null;
  status: string;
  openedAt: string;
  elapsedMin: number;
  total: number;
  items: { nameAr: string; nameEn: string; image: string | null; qty: number }[];
};
type OrdersRes = { counts: Record<Status, number>; thresholdMin: number; total: number; page: number; pageSize: number; items: OrderRow[] };
type Board = { stations: { key: string; nameAr: string; nameEn: string; tickets: { elapsedMin: number }[] }[] };

const CHANNEL_ICON = { dine_in: UtensilsCrossed, takeaway: ShoppingBag, delivery: Bike };

function OrderRowView({ o, onOpen, onCancel }: { o: OrderRow; onOpen: () => void; onCancel: () => void }) {
  const { t, name, num, time } = useI18n();
  const { can } = useSession();
  const act = useOrderAction();
  const Icon = CHANNEL_ICON[o.channel] ?? UtensilsCrossed;
  const [first, second] = o.items;
  const more = o.items.length - 2;
  return (
    <tr className="group border-t border-border transition-colors hover:bg-accent-soft2/60">
      <td className="py-3.5 pe-3 ps-4">
        <button onClick={onOpen} className="flex items-center gap-3 text-start" aria-label={`${t('orders.viewDetails')} #${o.number}`}>
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-white">
            <Icon className="size-[18px]" />
          </span>
          <span>
            <span className="block text-sm font-semibold tabular">#{o.number}</span>
            <span className="mt-0.5 block text-2xs text-ink-muted">{t(`channel.${o.platform ?? o.channel}`)}</span>
          </span>
        </button>
      </td>
      <td className="px-3 py-3.5">
        <span className="flex items-center gap-1.5 text-sm font-medium tabular">
          <LayoutGrid className="size-3.5 text-accent" />
          {o.table ? num(o.table.label) : '—'}
        </span>
        <span className="mt-1 flex items-center gap-1.5 text-2xs text-ink-muted">
          <User className="size-3.5" />
          {o.channel === 'dine_in' ? t('common.guests', { n: o.guests ?? 1 }) : t('common.online')}
        </span>
      </td>
      <td className="px-3 py-3.5">
        <div className="flex items-center gap-3">
          <FoodImg image={first?.image} className="size-11" alt="" />
          <div className="min-w-0 text-xs leading-5">
            {[first, second].filter(Boolean).map((i, k) => (
              <p key={k} className={cn('flex gap-3', k ? 'text-ink-muted' : 'font-medium text-ink')}>
                <span className="truncate">{name(i)}</span>
                <span className="text-ink-muted tabular">×{num(i!.qty)}</span>
              </p>
            ))}
            {more > 0 ? <p className="text-2xs text-ink-subtle">+{num(more)}</p> : null}
          </div>
        </div>
      </td>
      <td className="px-3 py-3.5">
        <StatusBadge status={o.status} />
      </td>
      <td className="px-3 py-3.5">
        <span className={cn('block text-sm font-semibold tabular', o.status === 'delayed' && 'text-danger')}>{t('common.minutes', { n: o.elapsedMin })}</span>
        <span className="mt-0.5 block text-2xs text-ink-muted">{t('orders.since', { t: time(o.openedAt) })}</span>
      </td>
      <td className="py-3.5 pe-4 ps-3 text-end">
        <MenuRoot>
          <MenuTrigger className="grid size-8 place-items-center rounded-md text-ink-muted hover:bg-surface-muted hover:text-ink" aria-label={`${t('common.actions')} #${o.number}`}>
            <MoreVertical className="size-4" />
          </MenuTrigger>
          <MenuContent>
            <MenuItem onSelect={onOpen}>{t('orders.viewDetails')}</MenuItem>
            {can('orders.update') && (o.status === 'in_progress' || o.status === 'delayed') ? (
              <MenuItem onSelect={() => act.mutate({ id: o.id, action: 'ready', ok: t('kitchen.readyToast', { n: String(o.number) }) })}>{t('orders.markReady')}</MenuItem>
            ) : null}
            {can('orders.update') && o.status === 'ready' ? <MenuItem onSelect={() => act.mutate({ id: o.id, action: 'serve', ok: t('common.saved') })}>{t('orders.markServed')}</MenuItem> : null}
            {can('orders.cancel') ? (
              <MenuItem danger onSelect={onCancel}>
                {t('orders.cancelOrder')}
              </MenuItem>
            ) : null}
          </MenuContent>
        </MenuRoot>
      </td>
    </tr>
  );
}

function MiniFloor({ floors, area }: { floors?: Floor[]; area: string }) {
  const { t } = useI18n();
  const floor = floors?.find((f) => f.id === area) ?? floors?.find((f) => f.layout?.featured) ?? floors?.[0];
  return (
    <Card className="p-4">
      <CardHeader
        title={t('orders.floor')}
        action={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-2xs font-medium text-success">
            <span className="size-1.5 animate-pulse rounded-full bg-success" aria-hidden />
            {t('common.liveView')}
          </span>
        }
      />
      <Link href="/tables" className="mt-3 block overflow-hidden rounded-md border border-border" aria-label={t('dashboard.viewAllTables')}>
        {floor ? <FloorMap floor={floor} compact /> : <Skeleton className="aspect-[4/3]" />}
      </Link>
      <FloorLegend className="mt-3 justify-between gap-x-3 text-2xs" />
    </Card>
  );
}

function SideActions({ onNew }: { onNew: () => void }) {
  const { t } = useI18n();
  const { can } = useSession();
  const tile = 'flex h-14 items-center gap-3 rounded-md border border-border px-3 text-sm font-medium transition-colors hover:border-accent/40 hover:bg-accent-soft2';
  const ic = (filled: boolean) => cn('grid size-8 place-items-center rounded-full', filled ? 'bg-accent text-white' : 'bg-accent-soft text-accent');
  return (
    <Card className="p-4">
      <CardHeader title={t('dashboard.quickActions')} />
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        {can('orders.create') ? (
          <button onClick={onNew} className={tile}>
            <span className={ic(true)}>
              <Plus className="size-4" />
            </span>
            {t('dashboard.newOrder')}
          </button>
        ) : null}
        <Link href="/tables" className={tile}>
          <span className={ic(true)}>
            <LayoutGrid className="size-4" />
          </span>
          {t('dashboard.viewAllTables')}
        </Link>
        {can('inventory.view') ? (
          <Link href="/inventory" className={tile}>
            <span className={ic(false)}>
              <Package className="size-4" />
            </span>
            {t('dashboard.checkInventory')}
          </Link>
        ) : null}
        <Link href="/kitchen" className={tile}>
          <span className={ic(false)}>
            <ChefHat className="size-4" />
          </span>
          {t('nav.kitchen')}
        </Link>
      </div>
    </Card>
  );
}

function DelayCard({ delayed, threshold }: { delayed: number; threshold: number }) {
  const { t, name } = useI18n();
  const board = useQuery({ queryKey: ['kitchen', 'board'], queryFn: () => api<Board>('/kitchen/board'), enabled: delayed > 0 });
  if (!delayed) return null;
  const worst = board.data?.stations
    .map((s) => ({ s, n: s.tickets.filter((x) => x.elapsedMin > threshold).length }))
    .sort((a, b) => b.n - a.n)[0];
  return (
    <section className="rounded-lg border border-accent-line/70 bg-accent-soft p-5" role="status">
      <div className="flex gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-white">
          <AlertCircle className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-md font-semibold text-accent">{t('orders.kitchenDelay')}</h2>
          <p className="mt-1.5 text-sm leading-6 text-ink-muted">{t('orders.kitchenDelayBody', { n: delayed, m: threshold })}</p>
          <ButtonLink href={`/kitchen${worst?.n ? `?station=${worst.s.key}` : ''}`} className="mt-4">
            {t('orders.openKitchen', { station: worst?.n ? name(worst.s) : t('nav.kitchen') })}
            <ArrowRight className="flip-rtl size-4" />
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

function Promo() {
  const { t } = useI18n();
  return (
    <div className="mt-4 flex flex-wrap items-center gap-5 overflow-hidden rounded-lg border border-border bg-surface pe-4 shadow-card">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imgSrc('scenes/pasta-banner')} alt="" className="h-[68px] w-[114px] object-cover" />
      <div className="min-w-[160px] flex-1">
        <p className="text-md font-semibold">{t('orders.promoTitle')}</p>
        <p className="mt-0.5 text-xs text-ink-muted">{t('orders.promoBody')}</p>
      </div>
      <div className="hidden items-center gap-3 border-s border-border ps-5 md:flex">
        <span className="grid size-9 place-items-center rounded-full bg-accent-soft text-accent">
          <TrendingUp className="size-4" />
        </span>
        <p className="max-w-[170px] text-2xs text-ink-muted">{t('orders.promoSide')}</p>
      </div>
      <ButtonLink href="/reports" variant="secondary" size="sm">
        {t('orders.viewReports')}
        <ArrowRight className="flip-rtl size-3.5" />
      </ButtonLink>
    </div>
  );
}

function OrdersInner() {
  const { t, name } = useI18n();
  const { can } = useSession();
  const params = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<Status>('all');
  const [area, setArea] = useState('');
  const [page, setPage] = useState(1);
  const [newOpen, setNewOpen] = useState(false);
  const dialogs = useOrderDialogs();
  useEffect(() => {
    if (params.get('new') === '1' && can('orders.create')) setNewOpen(true);
    const open = params.get('open');
    if (open) dialogs.openDetails(open);
    if (params.get('new') || open) router.replace('/orders');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const floors = useQuery({ queryKey: ['floors'], queryFn: () => api<Floor[]>('/floors') });
  const q = useQuery({
    queryKey: ['orders', status, area, page],
    queryFn: () => api<OrdersRes>(`/orders?status=${status}&page=${page}&pageSize=8${area ? `&area=${area}` : ''}`),
    refetchInterval: 30_000,
    placeholderData: (prev) => prev,
  });
  const counts = q.data?.counts;
  const threshold = q.data?.thresholdMin ?? 20;
  return (
    <>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_386px]">
        <div className="min-w-0">
          <PageHeader
            title={t('orders.title')}
            subtitle={t('orders.subtitle')}
            actions={
              <div className="relative w-[170px]">
                <MapPin className="pointer-events-none absolute start-3 top-1/2 z-10 size-4 -translate-y-1/2 text-ink" />
                <Select
                  aria-label={t('orders.allAreas')}
                  value={area}
                  onChange={(e) => {
                    setArea(e.target.value);
                    setPage(1);
                  }}
                  className="h-11 ps-9"
                >
                  <option value="">{t('orders.allAreas')}</option>
                  {floors.data?.map((f) => (
                    <option key={f.id} value={f.id}>
                      {name(f)}
                    </option>
                  ))}
                </Select>
              </div>
            }
          />
          <Card className="mb-4 p-3">
            <PillTabs<Status>
              label={t('orders.title')}
              value={status}
              onChange={(s) => {
                setStatus(s);
                setPage(1);
              }}
              tabs={[
                { key: 'all', label: t('orders.allOrders'), count: counts?.all },
                { key: 'in_progress', label: t('status.in_progress'), count: counts?.in_progress },
                { key: 'ready', label: t('status.ready'), count: counts?.ready },
                { key: 'delayed', label: t('status.delayed'), count: counts?.delayed },
              ]}
            />
          </Card>
          <Card className="overflow-hidden">
            {q.isError ? (
              <ErrorState onRetry={() => q.refetch()} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-start">
                  <caption className="sr-only">{t('orders.title')}</caption>
                  <thead>
                    <tr className="text-start text-sm font-medium text-ink">
                      <th scope="col" className="py-3.5 pe-3 ps-4 text-start font-medium">
                        {t('orders.order')}
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-start font-medium">
                        {t('orders.table')}
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-start font-medium">
                        {t('orders.items')}
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-start font-medium">
                        {t('orders.status')}
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-start font-medium">
                        {t('orders.time')}
                      </th>
                      <th scope="col" className="py-3.5 pe-4 ps-3 text-end font-medium">
                        {t('orders.actions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {!q.data
                      ? Array.from({ length: 6 }, (_, i) => (
                          <tr key={i} className="border-t border-border">
                            <td colSpan={6} className="px-4 py-3">
                              <Skeleton className="h-11" />
                            </td>
                          </tr>
                        ))
                      : q.data.items.map((o) => <OrderRowView key={o.id} o={o} onOpen={() => dialogs.openDetails(o.id)} onCancel={() => dialogs.openCancel({ id: o.id, number: o.number })} />)}
                  </tbody>
                </table>
                {q.data && q.data.items.length === 0 ? <EmptyState title={t('orders.empty')} body={t('orders.emptyBody')} /> : null}
              </div>
            )}
            {q.data && q.data.total > q.data.pageSize ? (
              <div className="border-t border-border px-4 py-3">
                <Pagination page={page} pageSize={q.data.pageSize} total={q.data.total} onPage={setPage} />
              </div>
            ) : null}
          </Card>
          <Promo />
        </div>
        <div className="flex flex-col gap-4">
          <MiniFloor floors={floors.data} area={area} />
          <SideActions onNew={() => setNewOpen(true)} />
          <DelayCard delayed={counts?.delayed ?? 0} threshold={threshold} />
        </div>
      </div>
      <NewOrderDialog open={newOpen} onClose={() => setNewOpen(false)} />
      {dialogs.node}
    </>
  );
}

export default function OrdersPage() {
  return (
    <Suspense>
      <OrdersInner />
    </Suspense>
  );
}
