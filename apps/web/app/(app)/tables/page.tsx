'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, Armchair, Check, ChevronRight, Clock, Expand, MapPin, Minimize, Minus, MoreHorizontal, Plus, ReceiptText, Sparkles, Timer, User, Users, Ban, CheckCircle2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useErrorToast } from '@/lib/errors';
import { useI18n } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { FoodImg } from '@/components/ui/food-img';
import { MenuContent, MenuItem, MenuRoot, MenuTrigger } from '@/components/ui/menu';
import { PageHeader } from '@/components/ui/page-header';
import { PillTabs } from '@/components/ui/pill-tabs';
import { Progress } from '@/components/ui/progress';
import { IconTile } from '@/components/ui/stat-card';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { Select } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { FloorLegend, FloorMap, type Floor, type FloorTable } from '@/components/floor-map';
import { NewOrderDialog, useOrderAction, useOrderDialogs, type OrderDetail } from '@/components/orders/order-dialogs';
import { ReservationDialog } from '@/components/reservation-dialog';

type Summary = { total: number; occupied: number; available: number; cleaning: number; outOfService: number };
type Waiter = { id: string; nameAr: string; nameEn: string };
type TableDetail = {
  id: string;
  label: number;
  seats: number;
  status: string;
  section: string;
  guests: number | null;
  occupiedSince: string | null;
  waiter: Waiter | null;
  order: { id: string; number: number; status: string; estimatedMin: number | null; total: number; items: { id: string; nameAr: string; nameEn: string; image: string | null; qty: number; lineTotal: number }[] } | null;
};

const STATUS_TONE: Record<string, 'accent' | 'success' | 'violet' | 'neutral' | 'danger'> = { occupied: 'accent', available: 'success', cleaning: 'violet', out_of_service: 'neutral' };

function SummaryCards({ s }: { s?: Summary }) {
  const { t, num } = useI18n();
  if (!s)
    return (
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[92px] rounded-lg" />
        ))}
      </div>
    );
  const pct = (n: number) => (s.total ? Math.round((n / s.total) * 100) : 0);
  const cards = [
    { label: t('status.occupied'), value: s.occupied, of: s.total, icon: Armchair, tone: 'accent' as const, bar: 'bg-accent' },
    { label: t('status.available'), value: s.available, icon: CheckCircle2, tone: 'success' as const, bar: 'bg-success-table' },
    { label: t('status.cleaning'), value: s.cleaning, icon: Sparkles, tone: 'violet' as const, bar: 'bg-violet' },
    { label: t('status.out_of_service'), value: s.outOfService, icon: Ban, tone: 'softInfo' as const, bar: 'bg-neutral', iconClass: 'bg-neutral text-white' },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label} className="p-4">
          <div className="flex items-center gap-3.5">
            <IconTile tone={c.tone} className={cn('size-12 [&>svg]:size-6', c.iconClass)}>
              <c.icon />
            </IconTile>
            <div>
              <p className="text-sm text-ink-muted">{c.label}</p>
              <p className="mt-0.5 text-xl font-bold tabular">
                {num(c.value)}
                {c.of ? <span className="text-md font-normal text-ink-muted"> / {num(c.of)}</span> : null}
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Progress value={pct(c.value)} barClass={c.bar} label={c.label} />
            <span className="text-2xs text-ink-muted tabular">{num(pct(c.value))}%</span>
          </div>
        </Card>
      ))}
    </div>
  );
}

function useTableMutation() {
  const qc = useQueryClient();
  const toast = useToast();
  const fail = useErrorToast();
  return useMutation({
    mutationFn: ({ id, body, move }: { id: string; body: unknown; move?: boolean; ok: string }) => api(`/tables/${id}${move ? '/move' : ''}`, { method: move ? 'POST' : 'PATCH', json: body }),
    onSuccess: (_d, v) => {
      for (const k of ['floors', 'table', 'tables-summary', 'orders', 'dashboard']) qc.invalidateQueries({ queryKey: [k] });
      toast('success', v.ok);
    },
    onError: fail,
  });
}

function AssignWaiterDialog({ table, onClose }: { table: TableDetail | null; onClose: () => void }) {
  const { t, name } = useI18n();
  const waiters = useQuery({ queryKey: ['waiters'], queryFn: () => api<Waiter[]>('/tables/waiters'), enabled: !!table });
  const m = useTableMutation();
  const [sel, setSel] = useState<string>('');
  useEffect(() => setSel(table?.waiter?.id ?? ''), [table]);
  if (!table) return null;
  const chosen = waiters.data?.find((w) => w.id === sel);
  return (
    <Dialog
      open
      onOpenChange={(v) => !v && onClose()}
      title={`${t('tables.assignWaiter')} • ${t('common.table', { n: table.label })}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button disabled={!sel} loading={m.isPending} onClick={() => m.mutate({ id: table.id, body: { waiterId: sel }, ok: t('tables.assigned', { name: name(chosen) }) }, { onSuccess: onClose })}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <ul className="flex flex-col gap-2" role="radiogroup" aria-label={t('tables.assignWaiter')}>
        {waiters.data?.map((w) => (
          <li key={w.id}>
            <button role="radio" aria-checked={sel === w.id} onClick={() => setSel(w.id)} className={cn('flex w-full items-center gap-3 rounded-md border p-3 text-start text-sm', sel === w.id ? 'border-accent bg-accent-soft2' : 'border-border hover:bg-surface-muted')}>
              <span className="grid size-9 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">{name(w).slice(0, 1)}</span>
              <span className="flex-1 font-medium">{name(w)}</span>
              {sel === w.id ? <Check className="size-4 text-accent" /> : null}
            </button>
          </li>
        )) ?? <Skeleton className="h-32" />}
      </ul>
    </Dialog>
  );
}

function MoveTableDialog({ table, floors, onClose }: { table: TableDetail | null; floors?: Floor[]; onClose: () => void }) {
  const { t, name } = useI18n();
  const m = useTableMutation();
  const [floorId, setFloorId] = useState<string>('');
  const [target, setTarget] = useState<FloorTable | null>(null);
  useEffect(() => {
    setTarget(null);
    setFloorId(floors?.find((f) => f.tables.some((x) => x.id === table?.id))?.id ?? floors?.[0]?.id ?? '');
  }, [table, floors]);
  if (!table || !floors) return null;
  const floor = floors.find((f) => f.id === floorId) ?? floors[0]!;
  return (
    <Dialog
      open
      onOpenChange={(v) => !v && onClose()}
      title={`${t('tables.moveTable')} • ${t('common.table', { n: table.label })}`}
      description={t('tables.movePick')}
      className="w-[min(760px,calc(100vw-32px))]"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button disabled={!target} loading={m.isPending} onClick={() => target && m.mutate({ id: table.id, move: true, body: { toTableId: target.id }, ok: t('tables.moved', { n: target.label }) }, { onSuccess: onClose })}>
            {target ? `${t('tables.moveTo')} ${target.label}` : t('tables.moveTo')}
          </Button>
        </>
      }
    >
      <PillTabs size="sm" label={t('tables.title')} value={floor.id} onChange={setFloorId} tabs={floors.map((f) => ({ key: f.id, label: name(f) }))} className="mb-3" />
      <div className="overflow-hidden rounded-md border border-border">
        <FloorMap floor={floor} selectedId={target?.id} onSelect={setTarget} isDisabled={(x) => x.status !== 'available' || x.seats < (table.guests ?? 1)} />
      </div>
    </Dialog>
  );
}

function SplitDialog({ order, onClose, onPay }: { order: OrderDetail | null; onClose: () => void; onPay: (o: OrderDetail, parts: number) => void }) {
  const { t, money, num } = useI18n();
  const [parts, setParts] = useState(2);
  const preview = useQuery({
    queryKey: ['split', order?.id, parts],
    queryFn: () => api<{ total: number; parts: { amount: number; vat: number }[] }>(`/orders/${order!.id}/split`, { method: 'POST', json: { parts } }),
    enabled: !!order,
  });
  useEffect(() => setParts(Math.max(2, Math.min(order?.guests ?? 2, 6))), [order]);
  if (!order) return null;
  return (
    <Dialog
      open
      onOpenChange={(v) => !v && onClose()}
      title={`${t('tables.splitBill')} • #${order.number}`}
      description={`${t('orders.total')}: ${money(order.totalHalala)}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => onPay(order, parts)}>{t('orders.pay')}</Button>
        </>
      }
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{t('tables.split')}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setParts((p) => Math.max(2, p - 1))} aria-label="−">
            <Minus className="size-4" />
          </Button>
          <span className="w-16 text-center text-md font-semibold" aria-live="polite">
            {t('tables.parts', { n: parts })}
          </span>
          <Button variant="outline" size="icon" onClick={() => setParts((p) => Math.min(20, p + 1))} aria-label="+">
            <Plus className="size-4" />
          </Button>
        </div>
      </div>
      <ul className="mt-4 divide-y divide-border rounded-md border border-border">
        {(preview.data?.parts ?? []).map((p, i) => (
          <li key={i} className="flex items-center justify-between px-3.5 py-2.5 text-sm">
            <span className="text-ink-muted">
              {t('tables.each')} {num(i + 1)}
            </span>
            <span className="text-end">
              <span className="block font-semibold tabular">{money(p.amount)}</span>
              <span className="block text-2xs text-ink-muted tabular">
                {t('orders.vat')}: {money(p.vat)}
              </span>
            </span>
          </li>
        ))}
        {preview.isLoading ? <Skeleton className="m-3 h-16" /> : null}
      </ul>
      <p className="mt-3 text-xs text-ink-muted">{t('tables.splitNote')}</p>
    </Dialog>
  );
}

function TablePanel({ tableId, floors, onSeat }: { tableId: string | null; floors?: Floor[]; onSeat: (id: string) => void }) {
  const { t, name, money, num, time } = useI18n();
  const { can } = useSession();
  const q = useQuery({ queryKey: ['table', tableId], queryFn: () => api<TableDetail>(`/tables/${tableId}`), enabled: !!tableId, refetchInterval: 30_000 });
  const tm = useTableMutation();
  const act = useOrderAction();
  const dialogs = useOrderDialogs();
  const [assign, setAssign] = useState<TableDetail | null>(null);
  const [move, setMove] = useState<TableDetail | null>(null);
  const [split, setSplit] = useState<OrderDetail | null>(null);
  const loadOrder = (id: string) => api<OrderDetail>(`/orders/${id}`);

  if (!tableId)
    return (
      <Card className="flex min-h-[420px] items-center justify-center">
        <EmptyState icon={<Armchair className="size-5" />} title={t('tables.title')} body={t('tables.selectTable')} />
      </Card>
    );
  if (q.isError) return <Card><ErrorState onRetry={() => q.refetch()} /></Card>;
  const tb = q.data;
  if (!tb)
    return (
      <Card className="flex flex-col gap-4 p-5">
        <Skeleton className="h-10" />
        <Skeleton className="h-20" />
        <Skeleton className="h-48" />
      </Card>
    );
  const o = tb.order;
  const status = tb.status;
  const manage = can('tables.manage');
  const statusMenu = [
    status !== 'available' && !o ? { k: 'available', label: t('tables.setAvailable') } : null,
    status !== 'cleaning' && !o ? { k: 'cleaning', label: t('tables.setCleaning') } : null,
    status !== 'out_of_service' && !o ? { k: 'out_of_service', label: t('tables.setOutOfService') } : null,
  ].filter(Boolean) as { k: string; label: string }[];
  const qa = 'flex h-[50px] items-center gap-3 rounded-md border border-border px-3 text-sm font-medium transition-colors hover:border-accent/40 hover:bg-accent-soft2 disabled:pointer-events-none disabled:opacity-45';
  const ready = o && (o.status === 'ready' || o.status === 'served');

  return (
    <Card className="p-5" aria-live="polite">
      <div className="flex items-center gap-3">
        <IconTile tone={status === 'occupied' ? 'accent' : status === 'available' ? 'success' : status === 'cleaning' ? 'violet' : 'softInfo'} className={cn('size-11', status === 'out_of_service' && 'bg-neutral text-white')}>
          <Armchair />
        </IconTile>
        <h2 className="text-lg font-bold">{t('common.table', { n: tb.label })}</h2>
        <Badge tone={STATUS_TONE[status] ?? 'neutral'}>{t(`status.${status}`)}</Badge>
        {manage && statusMenu.length ? (
          <MenuRoot>
            <MenuTrigger className="ms-auto grid size-8 place-items-center rounded-md text-ink-muted hover:bg-surface-muted" aria-label={t('common.more')}>
              <MoreHorizontal className="size-5" />
            </MenuTrigger>
            <MenuContent>
              {statusMenu.map((s) => (
                <MenuItem key={s.k} onSelect={() => tm.mutate({ id: tb.id, body: { status: s.k }, ok: t('tables.statusChanged') })}>
                  {s.label}
                </MenuItem>
              ))}
            </MenuContent>
          </MenuRoot>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2.5 text-xs text-ink">
        <span className="inline-flex items-center gap-2">
          <Users className="size-4 text-ink-muted" />
          {tb.guests ? t('tables.guests', { n: tb.guests }) : t('tables.seats', { n: tb.seats })}
        </span>
        {tb.occupiedSince ? (
          <span className="inline-flex items-center gap-2">
            <Clock className="size-4 text-ink-muted" />
            {t('tables.since', { t: time(tb.occupiedSince) })}
          </span>
        ) : null}
        <span className="inline-flex w-full items-center gap-2">
          <User className="size-4 text-ink-muted" />
          {tb.waiter ? t('tables.waiter', { name: name(tb.waiter) }) : t('tables.noWaiter')}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {o ? (
          <Button onClick={() => dialogs.openDetails(o.id)}>{t('tables.viewOrder')}</Button>
        ) : status === 'available' && can('orders.create') ? (
          <Button onClick={() => onSeat(tb.id)}>{t('tables.seat')}</Button>
        ) : status === 'cleaning' && manage ? (
          <Button onClick={() => tm.mutate({ id: tb.id, body: { status: 'available' }, ok: t('tables.statusChanged') })}>{t('tables.setAvailable')}</Button>
        ) : (
          <span />
        )}
        {manage ? (
          <Button variant="secondary" onClick={() => setAssign(tb)}>
            {t('tables.assignWaiter')}
          </Button>
        ) : null}
      </div>

      {o ? (
        <>
          <section className="mt-5 rounded-md border border-border p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">{t('tables.orderDetails')}</h3>
              <span className="text-xs font-medium text-ink-muted tabular">#{o.number}</span>
            </div>
            <ul className="mt-2">
              {o.items.map((i) => (
                <li key={i.id} className="flex items-center gap-3 py-2">
                  <FoodImg image={i.image} className="size-10" />
                  <span className="min-w-0 flex-1 truncate text-sm">{name(i)}</span>
                  <span className="text-2xs text-ink-muted tabular">×{num(i.qty)}</span>
                  <span className="w-[86px] text-end text-xs font-medium tabular">{money(i.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex items-center justify-between border-t border-border pt-3 text-sm font-semibold">
              <span>{t('tables.total')}</span>
              <span className="tabular">{money(o.total)}</span>
            </div>
          </section>
          <button
            onClick={() => dialogs.openDetails(o.id)}
            className={cn('mt-4 flex w-full items-center gap-3 rounded-md border p-3.5 text-start', ready ? 'border-success/25 bg-success-soft' : 'border-accent-line bg-accent-soft2')}
          >
            <span className={cn('grid size-10 place-items-center rounded-full text-white', ready ? 'bg-success' : 'bg-accent')}>{ready ? <CheckCircle2 className="size-5" /> : <Timer className="size-5" />}</span>
            <span className="min-w-0 flex-1">
              <span className={cn('block text-sm font-semibold', ready ? 'text-success' : 'text-accent')}>{ready ? t('tables.orderReady') : t('tables.orderInProgress')}</span>
              <span className="mt-0.5 block text-xs text-ink-muted">{ready ? t('tables.readyToServe') : t('tables.estimated', { n: o.estimatedMin ?? 0 })}</span>
            </span>
            <ChevronRight className="flip-rtl size-4 text-ink-muted" />
          </button>
          <h3 className="mb-2.5 mt-5 text-md font-semibold">{t('tables.quickActions')}</h3>
          <div className="grid grid-cols-2 gap-2.5">
            <button className={qa} disabled={!can('orders.update')} onClick={() => dialogs.openAddItems(o.id)}>
              <Plus className="size-4 text-accent" />
              {t('tables.addItems')}
            </button>
            <button className={qa} disabled={!manage} onClick={() => setMove(tb)}>
              <ArrowLeftRight className="size-4 text-accent" />
              {t('tables.moveTable')}
            </button>
            <button className={qa} disabled={!can('orders.update')} onClick={async () => setSplit(await loadOrder(o.id))}>
              <ReceiptText className="size-4 text-accent" />
              {t('tables.splitBill')}
            </button>
            <button
              className={qa}
              disabled={!can('orders.update') || o.status !== 'in_progress' && o.status !== 'delayed'}
              onClick={() => act.mutate({ id: o.id, action: 'ready', ok: t('kitchen.readyToast', { n: String(o.number) }) })}
            >
              <Check className="size-4 text-accent" />
              {t('tables.markReady')}
            </button>
          </div>
        </>
      ) : (
        <p className="mt-6 rounded-md bg-surface-muted p-4 text-center text-sm text-ink-muted">{t('tables.noOrder')}</p>
      )}

      <AssignWaiterDialog table={assign} onClose={() => setAssign(null)} />
      <MoveTableDialog table={move} floors={floors} onClose={() => setMove(null)} />
      <SplitDialog order={split} onClose={() => setSplit(null)} onPay={(ord, parts) => (setSplit(null), dialogs.openPay(ord, parts))} />
      {dialogs.node}
    </Card>
  );
}

function TablesInner() {
  const { t, name } = useI18n();
  const { can } = useSession();
  const params = useSearchParams();
  const floors = useQuery({ queryKey: ['floors'], queryFn: () => api<Floor[]>('/floors'), refetchInterval: 30_000 });
  const summary = useQuery({ queryKey: ['tables-summary'], queryFn: () => api<Summary>('/tables/summary'), refetchInterval: 30_000 });
  const [floorId, setFloorId] = useState<string>('');
  const [selected, setSelected] = useState<string | null>(params.get('table'));
  const [section, setSection] = useState('');
  const [zoom, setZoom] = useState(1);
  const [full, setFull] = useState(false);
  const [seatTable, setSeatTable] = useState<string | null>(null);
  const [reserve, setReserve] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);

  const list = floors.data ?? [];
  const floor = list.find((f) => f.id === floorId) ?? (selected ? list.find((f) => f.tables.some((x) => x.id === selected)) : undefined) ?? list[0];
  useEffect(() => {
    if (!selected && floor) {
      const first = floor.tables.find((x) => x.status === 'occupied') ?? floor.tables[0];
      if (first) setSelected(first.id);
    }
  }, [floor, selected]);
  useEffect(() => {
    const on = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  const toggleFull = () => (document.fullscreenElement ? document.exitFullscreen() : mapRef.current?.requestFullscreen());

  return (
    <>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <PageHeader
            title={t('tables.title')}
            subtitle={t('tables.subtitle')}
            actions={
              <>
                <div className="relative w-[170px]">
                  <MapPin className="pointer-events-none absolute start-3 top-1/2 z-10 size-4 -translate-y-1/2 text-ink" />
                  <Select aria-label={t('tables.section')} value={section} onChange={(e) => setSection(e.target.value)} className="h-11 ps-9">
                    <option value="">{t('orders.allAreas')}</option>
                    <option value="family">{t('tables.family')}</option>
                    <option value="single">{t('tables.single')}</option>
                  </Select>
                </div>
                {can('tables.manage') ? (
                  <Button size="lg" onClick={() => setReserve(true)}>
                    <Plus className="size-4" />
                    {t('tables.newReservation')}
                  </Button>
                ) : null}
              </>
            }
          />
          <SummaryCards s={summary.data} />
          <Card className="mt-4 p-4">
            <div ref={mapRef} className={cn(full && 'flex h-full flex-col bg-surface p-6')}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                {list.length ? (
                  <PillTabs
                    label={t('tables.title')}
                    value={floor?.id ?? ''}
                    onChange={(id) => {
                      setFloorId(id);
                      setSelected(null);
                      setZoom(1);
                    }}
                    tabs={list.map((f) => ({ key: f.id, label: name(f) }))}
                  />
                ) : (
                  <Skeleton className="h-10 w-72" />
                )}
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => setZoom((z) => Math.min(2, +(z + 0.25).toFixed(2)))} aria-label={t('tables.zoomIn')} disabled={zoom >= 2}>
                    <Plus className="size-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => setZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)))} aria-label={t('tables.zoomOut')} disabled={zoom <= 1}>
                    <Minus className="size-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={toggleFull} aria-label={full ? t('tables.exitFullscreen') : t('tables.fullscreen')}>
                    {full ? <Minimize className="size-4" /> : <Expand className="size-4" />}
                  </Button>
                </div>
              </div>
              <div className={cn('mt-4 overflow-hidden rounded-md', full && 'flex-1')}>
                {floors.isError ? (
                  <ErrorState onRetry={() => floors.refetch()} />
                ) : floor ? (
                  <FloorMap
                    floor={floor}
                    zoom={zoom}
                    selectedId={selected}
                    onSelect={(x) => setSelected(x.id)}
                    isDisabled={section ? (x) => x.section !== section : undefined}
                    className={full ? 'h-full' : undefined}
                  />
                ) : (
                  <Skeleton className="aspect-[10/7]" />
                )}
              </div>
              <FloorLegend attention={false} className="mt-4" />
            </div>
          </Card>
        </div>
        <div className="xl:pt-[76px]">
          <TablePanel tableId={selected} floors={floors.data} onSeat={setSeatTable} />
        </div>
      </div>
      <NewOrderDialog open={!!seatTable} presetTableId={seatTable} onClose={() => setSeatTable(null)} />
      <ReservationDialog open={reserve} onClose={() => setReserve(false)} tables={list.flatMap((f) => f.tables)} />
    </>
  );
}

export default function TablesPage() {
  return (
    <Suspense>
      <TablesInner />
    </Suspense>
  );
}
