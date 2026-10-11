'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, MoreVertical, Plus, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useErrorToast } from '@/lib/errors';
import { useI18n } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/field';
import { FoodImg } from '@/components/ui/food-img';
import { MenuContent, MenuItem, MenuRoot, MenuTrigger } from '@/components/ui/menu';
import { PageHeader } from '@/components/ui/page-header';
import { PillTabs } from '@/components/ui/pill-tabs';
import { ErrorState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';

type Named = { id: string; nameAr: string; nameEn: string };
type Item = Named & { image: string | null; priceHalala: number; active: boolean; category: Named; station: Named | null; cost: number; marginPct: number; recipe: { ingredientId: string; nameAr: string; nameEn: string; unit: string; qtyMilli: number; wasteBp: number }[] };
type Category = Named & { _count: { items: number } };

function ItemDialog({ item, open, onClose, categories, stations }: { item: Item | null; open: boolean; onClose: () => void; categories: Category[]; stations: Named[] }) {
  const { t, name, currency } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const fail = useErrorToast();
  const [f, setF] = useState({ nameAr: '', nameEn: '', categoryId: '', stationId: '', price: '' });
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!open) return;
    setTouched(false);
    setF(
      item
        ? { nameAr: item.nameAr, nameEn: item.nameEn, categoryId: item.category.id, stationId: item.station?.id ?? '', price: (item.priceHalala / 100).toFixed(2) }
        : { nameAr: '', nameEn: '', categoryId: categories[0]?.id ?? '', stationId: stations[0]?.id ?? '', price: '' },
    );
  }, [open, item, categories, stations]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((v) => ({ ...v, [k]: e.target.value }));
  const err = {
    nameAr: !f.nameAr.trim() ? t('common.required') : undefined,
    nameEn: !f.nameEn.trim() ? t('common.required') : undefined,
    price: !/^\d+(\.\d{1,2})?$/.test(f.price) || Number(f.price) <= 0 ? t('common.required') : undefined,
  };
  const e = (k: keyof typeof err) => (touched ? err[k] : undefined);
  const save = useMutation({
    mutationFn: () => {
      const json = { nameAr: f.nameAr.trim(), nameEn: f.nameEn.trim(), categoryId: f.categoryId, stationId: f.stationId || null, priceHalala: Math.round(Number(f.price) * 100) };
      return item ? api(`/menu/items/${item.id}`, { method: 'PATCH', json }) : api('/menu/items', { method: 'POST', json });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu'] });
      toast('success', item ? t('common.saved') : t('menu.created'));
      onClose();
    },
    onError: fail,
  });
  const submit = () => (Object.values(err).every((v) => !v) ? save.mutate() : setTouched(true));
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title={item ? name(item) : t('menu.addItem')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button loading={save.isPending} onClick={submit}>
            {item ? t('common.save') : t('menu.addItem')}
          </Button>
        </>
      }
    >
      <form className="grid gap-4 sm:grid-cols-2" noValidate onSubmit={(ev) => (ev.preventDefault(), submit())}>
        <Field label={t('menu.nameAr')} error={e('nameAr')}>
          {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!e('nameAr')} dir="rtl" value={f.nameAr} onChange={set('nameAr')} maxLength={80} />}
        </Field>
        <Field label={t('menu.nameEn')} error={e('nameEn')}>
          {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!e('nameEn')} dir="ltr" value={f.nameEn} onChange={set('nameEn')} maxLength={80} />}
        </Field>
        <Field label={t('menu.category')}>
          {(id) => (
            <Select id={id} value={f.categoryId} onChange={set('categoryId')}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {name(c)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t('menu.station')}>
          {(id) => (
            <Select id={id} value={f.stationId} onChange={set('stationId')}>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {name(s)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={`${t('menu.price')} (${currency})`} hint={t('menu.priceHelp')} error={e('price')}>
          {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!e('price')} dir="ltr" inputMode="decimal" value={f.price} onChange={set('price')} placeholder="0.00" />}
        </Field>
      </form>
      {item ? <Recipe item={item} /> : null}
    </Dialog>
  );
}

function Recipe({ item }: { item: Item }) {
  const { t, name, qty, money, pct } = useI18n();
  return (
    <section className="mt-5 border-t border-border pt-4">
      <h3 className="flex items-center justify-between text-sm font-semibold">
        {t('menu.recipe')}
        <span className="text-xs font-normal text-ink-muted">
          {t('menu.cost')}: {money(item.cost)} · {t('menu.margin')}: {pct(item.marginPct)}
        </span>
      </h3>
      {item.recipe.length === 0 ? (
        <p className="mt-2 text-xs text-ink-muted">{t('menu.noRecipe')}</p>
      ) : (
        <ul className="mt-2 divide-y divide-border text-xs">
          {item.recipe.map((r) => (
            <li key={r.ingredientId} className="flex justify-between py-1.5">
              <span>{name(r)}</span>
              <span className="tabular text-ink-muted">
                {qty(r.qtyMilli, r.unit)}
                {r.wasteBp ? ` (+${pct(r.wasteBp / 100)})` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CategoryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const fail = useErrorToast();
  const toast = useToast();
  const [f, setF] = useState({ nameAr: '', nameEn: '' });
  useEffect(() => setF({ nameAr: '', nameEn: '' }), [open]);
  const valid = f.nameAr.trim() && f.nameEn.trim();
  const save = useMutation({
    mutationFn: () => api('/menu/categories', { method: 'POST', json: { nameAr: f.nameAr.trim(), nameEn: f.nameEn.trim() } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu'] });
      toast('success', t('common.saved'));
      onClose();
    },
    onError: fail,
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title={t('menu.addCategory')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button disabled={!valid} loading={save.isPending} onClick={() => save.mutate()}>
            {t('menu.addCategory')}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('menu.nameAr')}>{(id) => <Input id={id} dir="rtl" value={f.nameAr} onChange={(e) => setF((v) => ({ ...v, nameAr: e.target.value }))} maxLength={60} />}</Field>
        <Field label={t('menu.nameEn')}>{(id) => <Input id={id} dir="ltr" value={f.nameEn} onChange={(e) => setF((v) => ({ ...v, nameEn: e.target.value }))} maxLength={60} />}</Field>
      </div>
    </Dialog>
  );
}

export default function MenuPage() {
  const { t, name, money, pct } = useI18n();
  const { can } = useSession();
  const qc = useQueryClient();
  const fail = useErrorToast();
  const manage = can('recipes.manage');
  const items = useQuery({ queryKey: ['menu', 'items', 'all'], queryFn: () => api<Item[]>('/menu/items') });
  const cats = useQuery({ queryKey: ['menu', 'categories'], queryFn: () => api<Category[]>('/menu/categories') });
  const stations = useQuery({ queryKey: ['menu', 'stations'], queryFn: () => api<Named[]>('/menu/stations') });
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Item | null>(null);
  const [adding, setAdding] = useState(false);
  const [addingCat, setAddingCat] = useState(false);
  const toggle = useMutation({
    mutationFn: (i: Item) => api(`/menu/items/${i.id}`, { method: 'PATCH', json: { active: !i.active } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu'] }),
    onError: fail,
  });
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.data?.filter((i) => (cat === 'all' || i.category.id === cat) && (!term || i.nameAr.includes(term) || i.nameEn.toLowerCase().includes(term)));
  }, [items.data, cat, q]);

  return (
    <>
      <PageHeader
        title={t('menu.title')}
        subtitle={t('menu.subtitle')}
        actions={
          manage ? (
            <>
              <Button size="lg" variant="outline" onClick={() => setAddingCat(true)}>
                {t('menu.addCategory')}
              </Button>
              <Button size="lg" onClick={() => setAdding(true)}>
                <Plus className="size-4" />
                {t('menu.addItem')}
              </Button>
            </>
          ) : null
        }
      />
      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <PillTabs
            size="sm"
            className="min-w-0 flex-1"
            label={t('menu.category')}
            value={cat}
            onChange={setCat}
            tabs={[{ key: 'all', label: `${t('inventory.allItems')} (${items.data?.length ?? 0})` }, ...(cats.data ?? []).map((c) => ({ key: c.id, label: `${name(c)} (${c._count.items})` }))]}
          />
          <label className="relative">
            <span className="sr-only">{t('foodCost.searchItems')}</span>
            <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
            <Input className="h-9 w-56 ps-8 text-sm" placeholder={t('foodCost.searchItems')} value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
        </div>
        {items.isError ? (
          <ErrorState onRetry={() => items.refetch()} />
        ) : (
          <DataTable
            caption={t('menu.title')}
            empty={t('inventory.empty')}
            rows={rows}
            columns={[
              {
                key: 'name',
                header: t('foodCost.item'),
                cell: (i) => (
                  <button type="button" className="flex items-center gap-3 text-start hover:text-accent" onClick={() => setEdit(i)}>
                    <FoodImg image={i.image} className={cn('size-10', !i.active && 'opacity-50')} />
                    <span className="font-medium">{name(i)}</span>
                  </button>
                ),
              },
              { key: 'cat', header: t('menu.category'), cell: (i) => <span className="text-xs text-ink-muted">{name(i.category)}</span> },
              { key: 'station', header: t('menu.station'), cell: (i) => <span className="text-xs text-ink-muted">{i.station ? name(i.station) : '—'}</span> },
              { key: 'price', header: t('menu.price'), cell: (i) => <span className="tabular">{money(i.priceHalala)}</span> },
              { key: 'cost', header: t('menu.cost'), cell: (i) => <span className="tabular text-ink-muted">{i.recipe.length ? money(i.cost) : '—'}</span> },
              {
                key: 'margin',
                header: t('menu.margin'),
                cell: (i) => (i.recipe.length ? <span className={cn('rounded px-2 py-0.5 text-xs font-semibold tabular', i.marginPct < 25 ? 'bg-danger-soft text-danger' : i.marginPct < 65 ? 'bg-warning-soft text-warning' : 'bg-success-soft text-success')}>{pct(i.marginPct)}</span> : '—'),
              },
              { key: 'status', header: t('inventory.status'), cell: (i) => <Badge tone={i.active ? 'success' : 'neutral'}>{i.active ? t('menu.active') : t('menu.hidden')}</Badge> },
              {
                key: 'act',
                header: <span className="sr-only">{t('common.actions')}</span>,
                className: 'w-10 text-end',
                cell: (i) =>
                  manage ? (
                    <MenuRoot>
                      <MenuTrigger className="grid size-8 place-items-center rounded-md text-ink-muted hover:bg-surface-muted" aria-label={`${t('common.actions')}: ${name(i)}`}>
                        <MoreVertical className="size-4" />
                      </MenuTrigger>
                      <MenuContent>
                        <MenuItem onSelect={() => setEdit(i)}>{t('common.edit')}</MenuItem>
                        <MenuItem icon={i.active ? <EyeOff /> : <Eye />} onSelect={() => toggle.mutate(i)}>
                          {i.active ? t('menu.hideItem') : t('menu.showItem')}
                        </MenuItem>
                      </MenuContent>
                    </MenuRoot>
                  ) : null,
              },
            ]}
          />
        )}
      </Card>
      <ItemDialog open={adding || !!edit} item={edit} onClose={() => (setEdit(null), setAdding(false))} categories={cats.data ?? []} stations={stations.data ?? []} />
      <CategoryDialog open={addingCat} onClose={() => setAddingCat(false)} />
    </>
  );
}
