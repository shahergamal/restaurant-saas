'use client';

import { useQuery } from '@tanstack/react-query';
import { Minus, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/cn';
import { FoodImg } from '@/components/ui/food-img';
import { Skeleton } from '@/components/ui/states';

export type MenuItemRow = { id: string; nameAr: string; nameEn: string; image: string | null; priceHalala: number; active: boolean; category: { id: string; nameAr: string; nameEn: string } };
export type Cart = Record<string, number>;

export function useMenu() {
  return useQuery({ queryKey: ['menu-items'], queryFn: () => api<MenuItemRow[]>('/menu/items'), staleTime: 5 * 60_000 });
}

/** Menu grid with category chips and search; quantities live in `cart` (menuItemId → qty). */
export function MenuPicker({ cart, onChange }: { cart: Cart; onChange: (c: Cart) => void }) {
  const { t, name, money, num } = useI18n();
  const menu = useMenu();
  const [cat, setCat] = useState<string>('all');
  const [q, setQ] = useState('');
  const items = useMemo(() => (menu.data ?? []).filter((m) => m.active), [menu.data]);
  const cats = useMemo(() => {
    const seen = new Map<string, MenuItemRow['category']>();
    items.forEach((i) => seen.set(i.category.id, i.category));
    return [...seen.values()];
  }, [items]);
  const shown = items.filter((i) => (cat === 'all' || i.category.id === cat) && (!q || `${i.nameAr} ${i.nameEn}`.toLowerCase().includes(q.toLowerCase())));
  const set = (id: string, qty: number) => {
    const next = { ...cart };
    if (qty <= 0) delete next[id];
    else next[id] = Math.min(99, qty);
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('orders.search')} aria-label={t('orders.search')} className="h-10 w-full rounded-md border border-border bg-surface ps-9 pe-3 text-sm focus:border-accent focus:outline-none" />
      </div>
      <div className="scrollbar-thin -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {[{ id: 'all', nameAr: 'الكل', nameEn: 'All' }, ...cats].map((c) => (
          <button
            key={c.id}
            onClick={() => setCat(c.id)}
            aria-pressed={cat === c.id}
            className={cn('h-8 shrink-0 rounded-full border px-3 text-xs font-medium', cat === c.id ? 'border-accent bg-accent text-white' : 'border-border bg-surface hover:bg-surface-muted')}
          >
            {name(c)}
          </button>
        ))}
      </div>
      {menu.isLoading ? (
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : (
        <ul className="grid max-h-[300px] grid-cols-1 gap-2 overflow-y-auto pe-1 sm:grid-cols-2">
          {shown.map((m) => {
            const qty = cart[m.id] ?? 0;
            return (
              <li key={m.id} className={cn('flex items-center gap-2.5 rounded-md border p-2', qty ? 'border-accent/50 bg-accent-soft2' : 'border-border')}>
                <FoodImg image={m.image} className="size-11" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{name(m)}</p>
                  <p className="text-xs text-ink-muted tabular">{money(m.priceHalala)}</p>
                </div>
                {qty ? (
                  <div className="flex items-center gap-1">
                    <button className="grid size-7 place-items-center rounded border border-border bg-surface" onClick={() => set(m.id, qty - 1)} aria-label={`− ${name(m)}`}>
                      <Minus className="size-3.5" />
                    </button>
                    <span className="w-6 text-center text-sm font-semibold tabular" aria-live="polite">
                      {num(qty)}
                    </span>
                    <button className="grid size-7 place-items-center rounded bg-accent text-white" onClick={() => set(m.id, qty + 1)} aria-label={`+ ${name(m)}`}>
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                ) : (
                  <button className="h-7 rounded border border-accent px-2.5 text-xs font-medium text-accent hover:bg-accent-soft" onClick={() => set(m.id, 1)}>
                    {t('orders.addItem')}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
