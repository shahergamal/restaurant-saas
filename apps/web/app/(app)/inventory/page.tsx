'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, Check, CircleDollarSign, Download, Filter, Leaf, MinusCircle, MoreVertical, Package, PlusCircle, Plus } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { api, download } from '@/lib/api';
import { useErrorToast } from '@/lib/errors';
import { useI18n } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { cn } from '@/lib/cn';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Delta } from '@/components/ui/delta';
import { Dialog } from '@/components/ui/dialog';
import { Donut } from '@/components/ui/donut';
import { Field, Input, Select } from '@/components/ui/field';
import { FoodImg } from '@/components/ui/food-img';
import { MenuContent, MenuItem, MenuLabel, MenuRoot, MenuTrigger } from '@/components/ui/menu';
import { Pagination } from '@/components/ui/pagination';
import { PillTabs } from '@/components/ui/pill-tabs';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';

type StockStatus = 'in_stock' | 'low' | 'critical' | 'out';
type Summary = {
  totalItems: number;
  totalItemsDeltaPct: number;
  lowStock: number;
  lowStockDeltaPct: number;
  expiringSoon: number;
  expiringSoonDeltaPct: number;
  totalValue: number;
  totalValueDeltaPct: number;
  overview: Record<StockStatus, number>;
  categories: { key: string; count: number }[];
};
type Ingredient = { id: string; nameAr: string; nameEn: string; unit: string; category: string; image: string | null; qtyMilli: number; status: StockStatus; updatedAt: string | null; valueHalala: number; minLevelMilli: number; reorderLevelMilli: number };
type Page = { total: number; page: number; pageSize: number; items: Ingredient[] };
type Activity = { id: string; kind: 'low' | 'added' | 'updated' | 'waste'; nameAr: string; nameEn: string; unit: string; qtyMilli: number; at: string };
type ActionNeeded = { ingredientId: string; nameAr: string; nameEn: string; qtyMilli: number; unit: string; status: StockStatus } | null;

const STATUS_COLOR: Record<StockStatus, string> = { in_stock: 'rgb(18 147 109)', low: 'rgb(240 138 36)', critical: 'rgb(229 72 77)', out: 'rgb(185 183 179)' };
const UNITS = ['kg', 'g', 'L', 'ml', 'pack', 'pcs'] as const;
const CATS = ['produce', 'meat', 'seafood', 'dairy', 'dry_goods', 'beverages'] as const;

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  for (const k of ['inventory', 'notifications', 'dashboard']) qc.invalidateQueries({ queryKey: [k] });
}

function KpiCard({ icon, label, value, delta, goodWhenDown, bg, iconClass }: { icon: React.ReactNode; label: string; value: string; delta: number; goodWhenDown?: boolean; bg: string; iconClass: string }) {
  const { t } = useI18n();
  return (
    <Card className={cn('flex items-start gap-4 p-5', bg)}>
      <span className={cn('grid size-12 shrink-0 place-items-center rounded-full [&>svg]:size-6', iconClass)}>{icon}</span>
      <div className="min-w-0">
        <p className="text-sm text-ink-muted">{label}</p>
        <p className="mt-1 text-xl font-bold tabular">{value}</p>
        <Delta value={delta} goodWhenDown={goodWhenDown} label={t('common.vsLastWeek')} className="mt-1.5" />
      </div>
    </Card>
  );
}

function AddItemDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, unit } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const fail = useErrorToast();
  const empty = { nameAr: '', nameEn: '', unit: 'kg', category: 'produce', minLevel: '', reorderLevel: '', qty: '', unitCost: '' };
  const [f, setF] = useState(empty);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (open) {
      setF(empty);
      setTouched(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const num = (v: string) => (v.trim() === '' ? NaN : Number(v));
  const err = {
    nameAr: !f.nameAr.trim() ? t('common.required') : undefined,
    nameEn: !f.nameEn.trim() ? t('common.required') : undefined,
    minLevel: !(num(f.minLevel) >= 0) ? t('common.required') : undefined,
    reorderLevel: !(num(f.reorderLevel) >= 0) ? t('common.required') : num(f.reorderLevel) < num(f.minLevel) ? t('errors.reorder_below_min') : undefined,
    unitCost: f.unitCost && !/^\d+(\.\d{1,2})?$/.test(f.unitCost) ? '0.00' : undefined,
  };
  const valid = Object.values(err).every((v) => !v);
  const save = useMutation({
    mutationFn: () =>
      api('/inventory/ingredients', {
        method: 'POST',
        json: { nameAr: f.nameAr.trim(), nameEn: f.nameEn.trim(), unit: f.unit, category: f.category, minLevel: num(f.minLevel), reorderLevel: num(f.reorderLevel), qty: num(f.qty) || 0, unitCost: f.unitCost || '0' },
      }),
    onSuccess: () => {
      invalidate(qc);
      toast('success', t('inventory.added', { name: f.nameAr || f.nameEn }));
      onClose();
    },
    onError: fail,
  });
  const e = (k: keyof typeof err) => (touched ? err[k] : undefined);
  const submit = () => (valid ? save.mutate() : setTouched(true));
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title={t('inventory.addItem')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button loading={save.isPending} onClick={submit}>
            {t('inventory.addItem')}
          </Button>
        </>
      }
    >
      <form className="grid gap-4 sm:grid-cols-2" noValidate onSubmit={(ev) => (ev.preventDefault(), submit())}>
        <Field label={t('inventory.nameAr')} error={e('nameAr')}>
          {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!e('nameAr')} dir="rtl" value={f.nameAr} onChange={set('nameAr')} maxLength={80} />}
        </Field>
        <Field label={t('inventory.nameEn')} error={e('nameEn')}>
          {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!e('nameEn')} dir="ltr" value={f.nameEn} onChange={set('nameEn')} maxLength={80} />}
        </Field>
        <Field label={t('inventory.category')}>
          {(id) => (
            <Select id={id} value={f.category} onChange={set('category')}>
              {CATS.map((c) => (
                <option key={c} value={c}>
                  {t(`inventory.cats.${c}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t('inventory.unit')}>
          {(id) => (
            <Select id={id} value={f.unit} onChange={set('unit')}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {unit(u)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t('inventory.minLevel')} error={e('minLevel')}>
          {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!e('minLevel')} type="number" inputMode="decimal" min={0} step="any" dir="ltr" value={f.minLevel} onChange={set('minLevel')} />}
        </Field>
        <Field label={t('inventory.reorderLevel')} error={e('reorderLevel')}>
          {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!e('reorderLevel')} type="number" inputMode="decimal" min={0} step="any" dir="ltr" value={f.reorderLevel} onChange={set('reorderLevel')} />}
        </Field>
        <Field label={t('inventory.openingQty')}>
          {(id) => <Input id={id} type="number" inputMode="decimal" min={0} step="any" dir="ltr" value={f.qty} onChange={set('qty')} placeholder="0" />}
        </Field>
        <Field label={t('inventory.unitCost')} error={e('unitCost')}>
          {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!e('unitCost')} inputMode="decimal" dir="ltr" value={f.unitCost} onChange={set('unitCost')} placeholder="0.00" />}
        </Field>
      </form>
    </Dialog>
  );
}

function MovementDialog({ item, type, onClose }: { item: Ingredient | null; type: 'waste' | 'adjust'; onClose: () => void }) {
  const { t, name, qty, unit } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const fail = useErrorToast();
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  useEffect(() => {
    setAmount('');
    setReason(type === 'waste' ? t('inventory.wasteReasons.spoiled') : '');
  }, [item, type, t]);
  const n = Number(amount);
  const valid = amount.trim() !== '' && n !== 0 && (type === 'adjust' || n > 0) && reason.trim().length >= 2;
  const save = useMutation({
    mutationFn: () => api('/inventory/movements', { method: 'POST', json: { ingredientId: item!.id, type, qty: n, reason: reason.trim() } }),
    onSuccess: () => {
      invalidate(qc);
      toast('success', t('inventory.updated', { name: name(item) }));
      onClose();
    },
    onError: fail,
  });
  if (!item) return null;
  return (
    <Dialog
      open
      onOpenChange={(v) => !v && onClose()}
      title={`${type === 'waste' ? t('inventory.recordWaste') : t('inventory.adjust')} • ${name(item)}`}
      description={`${t('inventory.currentStock')}: ${qty(item.qtyMilli, item.unit)}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button disabled={!valid} loading={save.isPending} onClick={() => save.mutate()}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label={`${t('inventory.qty')} (${unit(item.unit)})`} hint={type === 'adjust' ? t('inventory.adjustHint') : undefined}>
          {(id, d) => <Input id={id} aria-describedby={d} autoFocus type="number" inputMode="decimal" step="any" dir="ltr" min={type === 'waste' ? 0 : undefined} value={amount} onChange={(e) => setAmount(e.target.value)} />}
        </Field>
        {type === 'waste' ? (
          <Field label={t('inventory.reason')}>
            {(id) => (
              <Select id={id} value={reason} onChange={(e) => setReason(e.target.value)}>
                {(['spoiled', 'expired', 'prep', 'returned'] as const).map((r) => (
                  <option key={r} value={t(`inventory.wasteReasons.${r}`)}>
                    {t(`inventory.wasteReasons.${r}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : (
          <Field label={t('inventory.reason')}>{(id) => <Input id={id} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />}</Field>
        )}
      </div>
    </Dialog>
  );
}

function useCreatePo() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const fail = useErrorToast();
  return useMutation({
    mutationFn: (ids: string[]) => api<{ number: number }>('/purchase-orders', { method: 'POST', json: { ingredientIds: ids } }),
    onSuccess: (po) => {
      invalidate(qc);
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast('success', t('inventory.poCreated', { n: String(po.number) }));
    },
    onError: fail,
  });
}

function StockOverview({ s }: { s?: Summary }) {
  const { t, num } = useI18n();
  const keys: StockStatus[] = ['in_stock', 'low', 'critical', 'out'];
  const total = s ? keys.reduce((a, k) => a + s.overview[k], 0) : 0;
  return (
    <Card className="p-5">
      <CardHeader title={t('inventory.stockOverview')} />
      {!s ? (
        <Skeleton className="mt-4 h-36" />
      ) : (
        <div className="mt-4 flex items-center gap-6">
          <Donut size={132} thickness={14} parts={keys.map((k) => ({ value: s.overview[k], color: STATUS_COLOR[k] }))} label={t('inventory.stockOverview')}>
            <div>
              <p className="text-2xl font-bold tabular">{num(total)}</p>
              <p className="text-2xs text-ink-muted">{t('inventory.totalItemsShort')}</p>
            </div>
          </Donut>
          <ul className="flex flex-1 flex-col gap-3.5">
            {keys.map((k) => (
              <li key={k} className="flex items-center gap-2.5 text-xs">
                <span className="size-2.5 rounded-full" style={{ background: STATUS_COLOR[k] }} aria-hidden />
                <span className="flex-1">{t(`status.${k}`)}</span>
                <span className="text-ink-muted tabular">
                  {num(s.overview[k])} ({num(total ? Math.round((s.overview[k] / total) * 100) : 0)}%)
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function RecentActivity() {
  const { t, name, qty, time } = useI18n();
  const q = useQuery({ queryKey: ['inventory', 'activity'], queryFn: () => api<Activity[]>('/inventory/activity') });
  const meta = (a: Activity) =>
    a.kind === 'low'
      ? { Icon: AlertTriangle, tone: 'bg-accent-soft text-accent', title: t('inventory.lowAlert', { name: name(a) }), sub: t('inventory.onlyLeft', { q: qty(a.qtyMilli, a.unit) }) }
      : a.qtyMilli < 0
        ? { Icon: MinusCircle, tone: 'bg-accent-soft text-accent', title: t('inventory.updated', { name: name(a) }), sub: `− ${qty(-a.qtyMilli, a.unit)}` }
        : { Icon: PlusCircle, tone: 'bg-success-soft text-success', title: t(a.kind === 'added' ? 'inventory.added' : 'inventory.updated', { name: name(a) }), sub: `+ ${qty(a.qtyMilli, a.unit)}` };
  return (
    <Card className="p-5">
      <CardHeader title={t('inventory.recentActivity')} />
      {q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <div className="mt-3 flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      ) : q.data.length === 0 ? (
        <EmptyState title={t('common.empty')} />
      ) : (
        <ul className="mt-2 divide-y divide-border">
          {q.data.map((a) => {
            const m = meta(a);
            return (
              <li key={a.id} className="flex items-start gap-3 py-3">
                <span className={cn('grid size-8 shrink-0 place-items-center rounded-full', m.tone)}>
                  <m.Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{m.title}</p>
                  <p className="mt-0.5 text-2xs text-ink-muted">{m.sub}</p>
                </div>
                <time className="text-2xs text-ink-muted" dateTime={a.at}>
                  {time(a.at)}
                </time>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function ActionNeededCard() {
  const { t, name } = useI18n();
  const { can } = useSession();
  const q = useQuery({ queryKey: ['inventory', 'action-needed'], queryFn: () => api<ActionNeeded>('/inventory/action-needed') });
  const po = useCreatePo();
  if (!q.data)
    return q.isSuccess ? (
      <section className="rounded-lg border border-success/20 bg-success-soft p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-success">
          <Check className="size-4" />
          {t('inventory.allGood')}
        </p>
        <p className="mt-1 text-xs text-ink-muted">{t('inventory.allGoodBody')}</p>
      </section>
    ) : null;
  const a = q.data;
  return (
    <section className="relative overflow-hidden rounded-lg border border-accent-line/70 bg-accent-soft2 p-5">
      <Leaf className="absolute -bottom-3 end-3 size-20 rotate-12 text-accent/10" aria-hidden />
      <div className="flex gap-3">
        <AlertTriangle className="size-5 shrink-0 text-accent" />
        <div>
          <h2 className="text-sm font-semibold text-accent">{t('inventory.actionNeeded')}</h2>
          <p className="mt-1 text-xs leading-5 text-ink-muted">{a.status === 'out' ? t('inventory.actionOut', { name: name(a) }) : t('inventory.actionBody', { name: name(a) })}</p>
          {can('purchasing.manage') ? (
            <Button size="sm" className="mt-3" loading={po.isPending} onClick={() => po.mutate([a.ingredientId])}>
              {t('inventory.createPo')}
              <ArrowRight className="flip-rtl size-3.5" />
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function InventoryInner() {
  const { t, name, num, money, qty, time, date, dir, unit } = useI18n();
  const { can } = useSession();
  const params = useSearchParams();
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState<StockStatus | ''>('');
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [move, setMove] = useState<{ item: Ingredient; type: 'waste' | 'adjust' } | null>(null);
  const toast = useToast();
  const po = useCreatePo();
  const q = params.get('q') ?? '';
  const summary = useQuery({ queryKey: ['inventory', 'summary'], queryFn: () => api<Summary>('/inventory/summary') });
  const list = useQuery({
    queryKey: ['inventory', 'ingredients', category, status, page, q],
    queryFn: () => api<Page>(`/inventory/ingredients?page=${page}${category !== 'all' ? `&category=${category}` : ''}${status ? `&status=${status}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`),
    placeholderData: (p) => p,
  });
  const s = summary.data;
  const today = new Date().toDateString();
  const updated = (d: string | null) => (!d ? '—' : new Date(d).toDateString() === today ? `${t('common.today')}${dir === 'rtl' ? '،' : ','} ${time(d)}` : date(d));
  const exportCsv = () => download('/inventory/export.csv', 'inventory.csv').catch(() => toast('error', t('errors.generic')));

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <Package className="size-11 text-accent" strokeWidth={1.6} />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('inventory.title')}</h1>
            <p className="mt-0.5 text-sm text-ink-muted">{t('inventory.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {can('inventory.manage') ? (
            <Button size="lg" onClick={() => setAddOpen(true)}>
              <Plus className="size-4" />
              {t('inventory.addItem')}
            </Button>
          ) : null}
          <Button size="lg" variant="outline" onClick={exportCsv}>
            <Download className="size-4" />
            {t('inventory.downloadReport')}
          </Button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {!s ? (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[104px] rounded-lg" />)
        ) : (
          <>
            <KpiCard icon={<Package />} label={t('inventory.totalItems')} value={num(s.totalItems)} delta={s.totalItemsDeltaPct} bg="bg-accent-soft2" iconClass="bg-accent-soft text-accent" />
            <KpiCard icon={<AlertTriangle />} label={t('inventory.lowStock')} value={num(s.lowStock)} delta={s.lowStockDeltaPct} goodWhenDown bg="bg-danger-soft/50" iconClass="text-danger" />
            <KpiCard icon={<Leaf />} label={t('inventory.expiringSoon')} value={num(s.expiringSoon)} delta={s.expiringSoonDeltaPct} goodWhenDown bg="bg-warning-soft/60" iconClass="bg-warning-soft text-warning" />
            <KpiCard icon={<CircleDollarSign />} label={t('inventory.totalValue')} value={money(s.totalValue, { whole: true })} delta={s.totalValueDeltaPct} bg="bg-success-soft/50" iconClass="bg-success text-white" />
          </>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="min-w-0 p-5">
          <CardHeader title={t('inventory.items')} />
          <div className="mt-4 flex items-start justify-between gap-3">
            <PillTabs
              size="sm"
              className="min-w-0 flex-nowrap overflow-x-auto pb-1 [scrollbar-width:none] [&>button]:shrink-0"
              label={t('inventory.category')}
              value={category}
              onChange={(c) => {
                setCategory(c);
                setPage(1);
              }}
              tabs={[
                { key: 'all', label: `${t('inventory.allItems')} (${num(s?.totalItems ?? 0)})` },
                ...(s?.categories ?? []).map((c) => ({ key: c.key, label: `${t(`inventory.cats.${c.key}`)} (${num(c.count)})` })),
              ]}
            />
            <MenuRoot>
              <MenuTrigger className="relative grid size-8 shrink-0 place-items-center rounded border border-border hover:bg-surface-muted" aria-label={t('inventory.filterStatus')}>
                <Filter className="size-4" />
                {status ? <span className="absolute -end-0.5 -top-0.5 size-2 rounded-full bg-accent" /> : null}
              </MenuTrigger>
              <MenuContent>
                <MenuLabel>{t('inventory.filterStatus')}</MenuLabel>
                {(['', 'in_stock', 'low', 'critical', 'out'] as const).map((k) => (
                  <MenuItem key={k || 'all'} onSelect={() => (setStatus(k), setPage(1))} icon={status === k ? <Check /> : <span className="block size-4" />}>
                    {k ? t(`status.${k}`) : t('common.all')}
                  </MenuItem>
                ))}
              </MenuContent>
            </MenuRoot>
          </div>
          {list.isError ? (
            <ErrorState onRetry={() => list.refetch()} />
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[680px]">
                <caption className="sr-only">{t('inventory.items')}</caption>
                <thead>
                  <tr className="border-b border-border text-xs text-ink-muted">
                    <th scope="col" className="py-3 pe-3 text-start font-medium">
                      {t('inventory.item')}
                    </th>
                    <th scope="col" className="px-3 py-3 text-start font-medium">
                      {t('inventory.category')}
                    </th>
                    <th scope="col" className="px-3 py-3 text-start font-medium">
                      {t('inventory.currentStock')}
                    </th>
                    <th scope="col" className="px-3 py-3 text-start font-medium">
                      {t('inventory.status')}
                    </th>
                    <th scope="col" className="px-3 py-3 text-start font-medium">
                      {t('inventory.lastUpdated')}
                    </th>
                    <th scope="col" className="w-10 py-3">
                      <span className="sr-only">{t('common.actions')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {!list.data
                    ? Array.from({ length: 9 }, (_, i) => (
                        <tr key={i}>
                          <td colSpan={6} className="py-2">
                            <Skeleton className="h-10" />
                          </td>
                        </tr>
                      ))
                    : list.data.items.map((i) => (
                        <tr key={i.id} className="border-b border-border last:border-0 hover:bg-surface-muted/50">
                          <td className="py-2 pe-3">
                            <div className="flex items-center gap-3">
                              <FoodImg image={i.image} category={i.category} className="size-10" alt="" />
                              <span>
                                <span className="block text-sm font-medium">{name(i)}</span>
                                <span className="block text-2xs text-ink-muted">{unit(i.unit)}</span>
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-xs text-ink-muted">{t(`inventory.cats.${i.category}`)}</td>
                          <td className="px-3 py-2 text-sm tabular">{qty(i.qtyMilli, i.unit)}</td>
                          <td className="px-3 py-2">
                            <StatusBadge status={i.status} />
                          </td>
                          <td className="px-3 py-2 text-xs text-ink-muted">{updated(i.updatedAt)}</td>
                          <td className="py-2 text-end">
                            {can('inventory.manage') || can('purchasing.manage') ? (
                              <MenuRoot>
                                <MenuTrigger className="grid size-8 place-items-center rounded-md text-ink-muted hover:bg-surface-muted" aria-label={`${t('common.actions')}: ${name(i)}`}>
                                  <MoreVertical className="size-4" />
                                </MenuTrigger>
                                <MenuContent>
                                  {can('inventory.manage') ? <MenuItem onSelect={() => setMove({ item: i, type: 'adjust' })}>{t('inventory.adjust')}</MenuItem> : null}
                                  {can('inventory.manage') ? <MenuItem onSelect={() => setMove({ item: i, type: 'waste' })}>{t('inventory.recordWaste')}</MenuItem> : null}
                                  {can('purchasing.manage') ? <MenuItem onSelect={() => po.mutate([i.id])}>{t('inventory.reorder')}</MenuItem> : null}
                                </MenuContent>
                              </MenuRoot>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
              {list.data && list.data.items.length === 0 ? <EmptyState title={t('inventory.empty')} body={t('inventory.emptyBody')} /> : null}
            </div>
          )}
          {list.data && list.data.total > 0 ? (
            <div className="mt-4">
              <Pagination page={page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} />
            </div>
          ) : null}
        </Card>
        <div className="flex flex-col gap-4">
          <StockOverview s={s} />
          <RecentActivity />
          <ActionNeededCard />
          <Link href="/suppliers" className="sr-only">
            {t('nav.suppliers')}
          </Link>
        </div>
      </div>
      <AddItemDialog open={addOpen} onClose={() => setAddOpen(false)} />
      <MovementDialog item={move?.item ?? null} type={move?.type ?? 'adjust'} onClose={() => setMove(null)} />
    </>
  );
}

export default function InventoryPage() {
  return (
    <Suspense>
      <InventoryInner />
    </Suspense>
  );
}
