'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { computeTotals, splitEven } from '@sufra/shared';
import { Banknote, CreditCard, Smartphone, Users, Wallet } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useErrorToast } from '@/lib/errors';
import { useI18n } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Select, Textarea } from '@/components/ui/field';
import { FoodImg } from '@/components/ui/food-img';
import { StatusBadge } from '@/components/ui/badge';
import { ErrorState, Skeleton } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import type { Floor } from '@/components/floor-map';
import { MenuPicker, useMenu, type Cart } from './menu-picker';

export type OrderDetail = {
  id: string;
  number: number;
  channel: string;
  platform: string | null;
  status: string;
  guests: number | null;
  notes: string | null;
  subtotalHalala: number;
  discountHalala: number;
  serviceHalala: number;
  vatHalala: number;
  totalHalala: number;
  openedAt: string;
  elapsedMin: number;
  table: { label: number } | null;
  items: { id: string; qty: number; unitPrice: number; modifiers: string[]; notes: string | null; status: string; menuItem: { nameAr: string; nameEn: string; image: string | null } }[];
  payments: { id: string; method: string; amount: number }[];
};

export function useOrder(id: string | null) {
  return useQuery({ queryKey: ['order', id], queryFn: () => api<OrderDetail>(`/orders/${id}`), enabled: !!id });
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  for (const k of ['orders', 'order', 'floors', 'table', 'tables-summary', 'kitchen', 'dashboard', 'notifications']) qc.invalidateQueries({ queryKey: [k] });
}

export function useOrderAction() {
  const qc = useQueryClient();
  const fail = useErrorToast();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, action, body }: { id: string; action: 'ready' | 'serve' | 'cancel' | 'pay' | 'items'; body?: unknown; ok?: string }) =>
      action === 'items' ? api(`/orders/${id}/items`, { method: 'PATCH', json: body }) : api(`/orders/${id}/${action}`, { method: 'POST', json: body ?? {} }),
    onSuccess: (_d, v) => {
      invalidateAll(qc);
      if (v.ok) toast('success', v.ok);
    },
    onError: fail,
  });
}

function Totals({ subtotal, vat, total, discount, service }: { subtotal: number; vat: number; total: number; discount?: number; service?: number }) {
  const { t, money } = useI18n();
  const row = 'flex items-center justify-between text-sm';
  return (
    <dl className="flex flex-col gap-1.5 rounded-md bg-surface-muted px-3.5 py-3">
      <div className={row}>
        <dt className="text-ink-muted">{t('orders.subtotal')}</dt>
        <dd className="tabular">{money(subtotal)}</dd>
      </div>
      {discount ? (
        <div className={row}>
          <dt className="text-ink-muted">−</dt>
          <dd className="tabular text-success">−{money(discount)}</dd>
        </div>
      ) : null}
      {service ? (
        <div className={row}>
          <dt className="text-ink-muted">{t('settings.service')}</dt>
          <dd className="tabular">{money(service)}</dd>
        </div>
      ) : null}
      <div className={row}>
        <dt className="text-ink-muted">{t('orders.vat')}</dt>
        <dd className="tabular text-ink-muted">{money(vat)}</dd>
      </div>
      <div className={cn(row, 'mt-1 border-t border-border pt-2 text-md font-semibold')}>
        <dt>{t('orders.total')}</dt>
        <dd className="tabular">{money(total)}</dd>
      </div>
    </dl>
  );
}

/** Order details with the actions the user's role allows. */
export function OrderDetailsDialog({ id, onClose, onAddItems, onPay, onCancel }: { id: string | null; onClose: () => void; onAddItems: (id: string) => void; onPay: (o: OrderDetail) => void; onCancel: (o: OrderDetail) => void }) {
  const { t, name, money, num, time } = useI18n();
  const { can } = useSession();
  const q = useOrder(id);
  const act = useOrderAction();
  const o = q.data;
  const open = o ? !['paid', 'cancelled'].includes(o.status) : false;
  return (
    <Dialog
      open={!!id}
      onOpenChange={(v) => !v && onClose()}
      title={o ? `${t('orders.order')} #${o.number}` : t('common.loading')}
      description={o ? `${o.table ? t('common.table', { n: o.table.label }) : t(`channel.${o.platform ?? o.channel}`)} • ${t('orders.since', { t: time(o.openedAt) })}` : undefined}
      className="w-[min(560px,calc(100vw-32px))]"
      footer={
        o && open ? (
          <>
            {can('orders.cancel') ? (
              <Button variant="ghost" className="me-auto text-danger hover:bg-danger-soft hover:text-danger" onClick={() => onCancel(o)}>
                {t('orders.cancelOrder')}
              </Button>
            ) : null}
            {can('orders.update') ? (
              <Button variant="outline" onClick={() => onAddItems(o.id)}>
                {t('tables.addItems')}
              </Button>
            ) : null}
            {can('orders.update') && (o.status === 'in_progress' || o.status === 'delayed') ? (
              <Button variant="secondary" loading={act.isPending} onClick={() => act.mutate({ id: o.id, action: 'ready', ok: t('kitchen.readyToast', { n: String(o.number) }) })}>
                {t('orders.markReady')}
              </Button>
            ) : null}
            {can('orders.update') ? <Button onClick={() => onPay(o)}>{t('orders.pay')}</Button> : null}
          </>
        ) : null
      }
    >
      {q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : !o ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
          <Skeleton className="h-24" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <StatusBadge status={o.status} />
            {o.guests ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
                <Users className="size-3.5" />
                {t('common.guests', { n: o.guests })}
              </span>
            ) : null}
          </div>
          <ul className="divide-y divide-border">
            {o.items.map((i) => (
              <li key={i.id} className="flex items-center gap-3 py-2.5">
                <FoodImg image={i.menuItem.image} className="size-11" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{name(i.menuItem)}</p>
                  {i.modifiers.length || i.notes ? <p className="truncate text-xs text-ink-muted">{[...i.modifiers, i.notes].filter(Boolean).join(' • ')}</p> : null}
                </div>
                <span className="text-xs text-ink-muted tabular">×{num(i.qty)}</span>
                <span className="w-24 text-end text-sm tabular">{money(i.unitPrice * i.qty)}</span>
              </li>
            ))}
          </ul>
          {o.notes ? <p className="rounded-md bg-warning-soft px-3 py-2 text-sm text-ink">{o.notes}</p> : null}
          <Totals subtotal={o.subtotalHalala} discount={o.discountHalala} service={o.serviceHalala} vat={o.vatHalala} total={o.totalHalala} />
        </div>
      )}
    </Dialog>
  );
}

/** New order: type, table (dine-in), guests and items. Totals preview uses the same shared function as the API. */
export function NewOrderDialog({ open, onClose, presetTableId }: { open: boolean; onClose: () => void; presetTableId?: string | null }) {
  const { t, name, num } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const fail = useErrorToast();
  const [channel, setChannel] = useState<'dine_in' | 'takeaway' | 'delivery'>('dine_in');
  const [tableId, setTableId] = useState<string>('');
  const [guests, setGuests] = useState(2);
  const [notes, setNotes] = useState('');
  const [cart, setCart] = useState<Cart>({});
  const menu = useMenu();
  const floors = useQuery({ queryKey: ['floors'], queryFn: () => api<Floor[]>('/floors'), enabled: open });
  useEffect(() => {
    if (open) {
      setCart({});
      setNotes('');
      setChannel('dine_in');
      setTableId(presetTableId ?? '');
    }
  }, [open, presetTableId]);
  const available = (floors.data ?? []).flatMap((f) => f.tables.filter((tb) => tb.status === 'available' || tb.id === presetTableId).map((tb) => ({ ...tb, floor: f })));
  const lines = Object.entries(cart).map(([id, qty]) => ({ id, qty, price: menu.data?.find((m) => m.id === id)?.priceHalala ?? 0 }));
  const totals = useMemo(() => computeTotals({ lines: lines.map((l) => ({ unitPrice: l.price, qty: l.qty })) }), [lines]);
  const create = useMutation({
    mutationFn: () =>
      api<{ id: string; number: number }>('/orders', {
        method: 'POST',
        json: { channel, tableId: channel === 'dine_in' ? tableId : undefined, guests: channel === 'dine_in' ? guests : undefined, notes: notes.trim() || undefined, items: lines.map((l) => ({ menuItemId: l.id, qty: l.qty })) },
      }),
    onSuccess: (o) => {
      invalidateAll(qc);
      toast('success', t('orders.created', { n: String(o.number) }));
      onClose();
    },
    onError: fail,
  });
  const valid = lines.length > 0 && (channel !== 'dine_in' || !!tableId);
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title={t('orders.newOrder')}
      className="w-[min(720px,calc(100vw-32px))]"
      footer={
        <>
          <span className="me-auto text-sm text-ink-muted">{lines.length ? t('common.items', { n: lines.reduce((s, l) => s + l.qty, 0) }) : t('orders.noItems')}</span>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button disabled={!valid} loading={create.isPending} onClick={() => create.mutate()}>
            {t('orders.create')}
          </Button>
        </>
      }
    >
      <div className="grid gap-5 md:grid-cols-[1fr_230px]">
        <MenuPicker cart={cart} onChange={setCart} />
        <div className="flex flex-col gap-3.5">
          <Field label={t('orders.channel')}>
            {(id) => (
              <Select id={id} value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)}>
                <option value="dine_in">{t('channel.dine_in')}</option>
                <option value="takeaway">{t('channel.takeaway')}</option>
                <option value="delivery">{t('channel.delivery')}</option>
              </Select>
            )}
          </Field>
          {channel === 'dine_in' ? (
            <>
              <Field label={t('orders.chooseTable')}>
                {(id) => (
                  <Select id={id} value={tableId} onChange={(e) => setTableId(e.target.value)} required>
                    <option value="">—</option>
                    {available.map((tb) => (
                      <option key={tb.id} value={tb.id}>
                        {t('common.table', { n: tb.label })} • {name(tb.floor)} • {t('tables.seats', { n: tb.seats })}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label={t('orders.guests')}>
                {(id) => (
                  <Select id={id} value={guests} onChange={(e) => setGuests(Number(e.target.value))}>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {num(n)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </>
          ) : null}
          <Field label={t('tables.notes')}>{(id) => <Textarea id={id} value={notes} maxLength={300} onChange={(e) => setNotes(e.target.value)} rows={2} />}</Field>
          <Totals subtotal={totals.itemsTotal} vat={totals.vat} total={totals.total} />
        </div>
      </div>
    </Dialog>
  );
}

export function AddItemsDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { t } = useI18n();
  const [cart, setCart] = useState<Cart>({});
  const act = useOrderAction();
  useEffect(() => setCart({}), [id]);
  const n = Object.values(cart).reduce((s, q) => s + q, 0);
  return (
    <Dialog
      open={!!id}
      onOpenChange={(v) => !v && onClose()}
      title={t('tables.addItems')}
      className="w-[min(600px,calc(100vw-32px))]"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={!n}
            loading={act.isPending}
            onClick={() =>
              act.mutate(
                { id: id!, action: 'items', body: { items: Object.entries(cart).map(([menuItemId, qty]) => ({ menuItemId, qty })) }, ok: t('common.saved') },
                { onSuccess: onClose },
              )
            }
          >
            {t('tables.addItems')} {n ? `(${n})` : ''}
          </Button>
        </>
      }
    >
      <MenuPicker cart={cart} onChange={setCart} />
    </Dialog>
  );
}

const METHODS = [
  { key: 'mada', icon: CreditCard },
  { key: 'cash', icon: Banknote },
  { key: 'card', icon: CreditCard },
  { key: 'apple_pay', icon: Smartphone },
  { key: 'stc_pay', icon: Wallet },
] as const;

/** Payment, optionally split evenly into N parts (each part can use a different method). */
export function PayDialog({ order, onClose, initialParts = 1 }: { order: OrderDetail | null; onClose: () => void; initialParts?: number }) {
  const { t, money, num } = useI18n();
  const act = useOrderAction();
  const [parts, setParts] = useState(initialParts);
  const [methods, setMethods] = useState<string[]>([]);
  useEffect(() => {
    setParts(initialParts);
    setMethods([]);
  }, [order, initialParts]);
  if (!order) return null;
  const amounts = splitEven(order.totalHalala, parts);
  const methodOf = (i: number) => methods[i] ?? 'mada';
  return (
    <Dialog
      open={!!order}
      onOpenChange={(v) => !v && onClose()}
      title={`${t('orders.pay')} • #${order.number}`}
      description={`${t('orders.amountDue')}: ${money(order.totalHalala)}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            loading={act.isPending}
            onClick={() =>
              act.mutate(
                { id: order.id, action: 'pay', body: { payments: amounts.map((amount, i) => ({ method: methodOf(i), amount })) }, ok: t('orders.paid', { n: String(order.number) }) },
                { onSuccess: onClose },
              )
            }
          >
            {t('orders.confirmPay')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">{t('tables.split')}</span>
          <div className="flex items-center gap-1" role="radiogroup" aria-label={t('tables.split')}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <button key={n} role="radio" aria-checked={parts === n} onClick={() => setParts(n)} className={cn('grid size-8 place-items-center rounded text-sm tabular', parts === n ? 'bg-accent text-white' : 'border border-border hover:bg-surface-muted')}>
                {num(n)}
              </button>
            ))}
          </div>
        </div>
        <ul className="flex flex-col gap-3">
          {amounts.map((amount, i) => (
            <li key={i} className="rounded-md border border-border p-3">
              <div className="mb-2.5 flex items-center justify-between">
                <span className="text-xs text-ink-muted">{parts > 1 ? `${num(i + 1)} / ${num(parts)}` : t('orders.method')}</span>
                <span className="text-md font-semibold tabular">{money(amount)}</span>
              </div>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('orders.method')}>
                {METHODS.map((m) => (
                  <button
                    key={m.key}
                    role="radio"
                    aria-checked={methodOf(i) === m.key}
                    onClick={() => setMethods((s) => Object.assign([...s], { [i]: m.key }))}
                    className={cn('inline-flex h-8 items-center gap-1.5 rounded border px-2.5 text-xs font-medium', methodOf(i) === m.key ? 'border-accent bg-accent-soft text-accent' : 'border-border hover:bg-surface-muted')}
                  >
                    <m.icon className="size-3.5" />
                    {t(`orders.methods.${m.key}`)}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
        {parts > 1 ? <p className="text-xs text-ink-muted">{t('tables.splitNote')}</p> : null}
      </div>
    </Dialog>
  );
}

export function CancelOrderDialog({ order, onClose }: { order: OrderDetail | { id: string; number: number } | null; onClose: () => void }) {
  const { t } = useI18n();
  const act = useOrderAction();
  const [reason, setReason] = useState('');
  useEffect(() => setReason(''), [order]);
  if (!order) return null;
  return (
    <Dialog
      open={!!order}
      onOpenChange={(v) => !v && onClose()}
      title={t('orders.cancelConfirm', { n: String(order.number) })}
      description={t('orders.cancelBody')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('orders.keep')}
          </Button>
          <Button variant="danger" disabled={reason.trim().length < 3} loading={act.isPending} onClick={() => act.mutate({ id: order.id, action: 'cancel', body: { reason: reason.trim() }, ok: t('common.saved') }, { onSuccess: onClose })}>
            {t('orders.cancelOrder')}
          </Button>
        </>
      }
    >
      <Field label={t('orders.cancelReason')}>{(id) => <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} autoFocus />}</Field>
    </Dialog>
  );
}

/** Wires the order dialogs together so any screen can open an order by id. */
export function useOrderDialogs() {
  const [detailId, setDetailId] = useState<string | null>(null);
  const [addId, setAddId] = useState<string | null>(null);
  const [pay, setPay] = useState<{ order: OrderDetail; parts: number } | null>(null);
  const [cancel, setCancel] = useState<OrderDetail | { id: string; number: number } | null>(null);
  const node = (
    <>
      <OrderDetailsDialog
        id={detailId}
        onClose={() => setDetailId(null)}
        onAddItems={(id) => (setDetailId(null), setAddId(id))}
        onPay={(o) => (setDetailId(null), setPay({ order: o, parts: 1 }))}
        onCancel={(o) => (setDetailId(null), setCancel(o))}
      />
      <AddItemsDialog id={addId} onClose={() => setAddId(null)} />
      <PayDialog order={pay?.order ?? null} initialParts={pay?.parts ?? 1} onClose={() => setPay(null)} />
      <CancelOrderDialog order={cancel} onClose={() => setCancel(null)} />
    </>
  );
  return { node, openDetails: setDetailId, openAddItems: setAddId, openPay: (order: OrderDetail, parts = 1) => setPay({ order, parts }), openCancel: setCancel };
}
