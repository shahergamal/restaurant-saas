'use client';

import { useQuery } from '@tanstack/react-query';
import { Bell, CalendarDays, ChevronDown, Languages, LogOut, Menu as MenuIcon, Search, Settings, AlertTriangle, PackageX, Hash } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { api } from '@/lib/api';
import { LOCALE_COOKIE, NUMERALS_COOKIE, useI18n, useSetPreference } from '@/lib/i18n';
import { logout, useSession } from '@/lib/session';
import { cn } from '@/lib/cn';
import { MenuContent, MenuItem, MenuRoot, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { FoodImg } from '@/components/ui/food-img';

type Notif =
  | { kind: 'order_delayed'; id: string; number: number; at: string }
  | { kind: 'stock_critical'; id: string; nameAr: string; nameEn: string; qtyMilli: number; unit: string };
type SearchRes = {
  orders: { id: string; number: number; status: string }[];
  tables: { id: string; label: number; status: string }[];
  menu: { id: string; nameAr: string; nameEn: string; image: string | null; priceHalala: number }[];
  ingredients: { id: string; nameAr: string; nameEn: string; image: string | null }[];
};

export function initials(n: string) {
  return n
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('');
}

function useNow() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function GlobalSearch({ placeholder }: { placeholder: string }) {
  const { t, name, money } = useI18n();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 220);
    return () => clearTimeout(id);
  }, [q]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const res = useQuery({ queryKey: ['search', debounced], queryFn: () => api<SearchRes>(`/search?q=${encodeURIComponent(debounced)}`), enabled: debounced.length >= 1 });
  const go = (href: string) => {
    setOpen(false);
    setQ('');
    router.push(href);
  };
  const d = res.data;
  const empty = d && !d.orders.length && !d.tables.length && !d.menu.length && !d.ingredients.length;
  const group = 'px-3 pb-1 pt-2.5 text-2xs font-semibold uppercase text-ink-subtle';
  const row = 'flex w-full items-center gap-3 rounded-md px-3 py-2 text-start text-sm hover:bg-surface-muted focus:bg-surface-muted focus:outline-none';
  return (
    <Popover.Root open={open && debounced.length > 0} onOpenChange={setOpen}>
      <Popover.Anchor asChild>
        <div className="relative w-full max-w-[470px]">
          <Search className="pointer-events-none absolute start-4 top-1/2 size-[18px] -translate-y-1/2 text-ink-muted" />
          <input
            ref={inputRef}
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            aria-label={placeholder}
            className="h-11 w-full rounded-lg border border-transparent bg-surface-muted ps-11 pe-4 text-sm placeholder:text-ink-subtle focus:border-accent/40 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent/10"
          />
        </div>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="animate-fade-in z-50 max-h-[420px] w-[var(--radix-popover-trigger-width)] min-w-[320px] overflow-y-auto rounded-lg border border-border bg-surface p-1.5 shadow-pop"
        >
          {res.isLoading ? <p className="px-3 py-3 text-sm text-ink-muted">{t('common.loading')}</p> : null}
          {empty ? <p className="px-3 py-3 text-sm text-ink-muted">{t('topbar.searchEmpty', { q: debounced })}</p> : null}
          {d?.orders.length ? <p className={group}>{t('topbar.searchOrders')}</p> : null}
          {d?.orders.map((o) => (
            <button key={o.id} className={row} onClick={() => go(`/orders?open=${o.id}`)}>
              <Hash className="size-4 text-ink-muted" />#{o.number}
              <span className="ms-auto text-xs text-ink-muted">{t(`status.${o.status}`)}</span>
            </button>
          ))}
          {d?.tables.length ? <p className={group}>{t('topbar.searchTables')}</p> : null}
          {d?.tables.map((tb) => (
            <button key={tb.id} className={row} onClick={() => go(`/tables?table=${tb.id}`)}>
              {t('common.table', { n: tb.label })}
              <span className="ms-auto text-xs text-ink-muted">{t(`status.${tb.status}`)}</span>
            </button>
          ))}
          {d?.menu.length ? <p className={group}>{t('topbar.searchMenuItems')}</p> : null}
          {d?.menu.map((m) => (
            <button key={m.id} className={row} onClick={() => go(`/menu?item=${m.id}`)}>
              <FoodImg image={m.image} className="size-7" rounded="rounded" />
              {name(m)}
              <span className="ms-auto text-xs text-ink-muted tabular">{money(m.priceHalala)}</span>
            </button>
          ))}
          {d?.ingredients.length ? <p className={group}>{t('topbar.searchIngredients')}</p> : null}
          {d?.ingredients.map((m) => (
            <button key={m.id} className={row} onClick={() => go(`/inventory?q=${encodeURIComponent(name(m))}`)}>
              <FoodImg image={m.image} className="size-7" rounded="rounded" />
              {name(m)}
            </button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function Notifications() {
  const { t, name, ago, num, qty } = useI18n();
  const { can } = useSession();
  const q = useQuery({ queryKey: ['notifications'], queryFn: () => api<{ count: number; items: Notif[] }>('/notifications'), refetchInterval: 60_000, enabled: can('orders.view') });
  const count = q.data?.count ?? 0;
  return (
    <Popover.Root>
      <Popover.Trigger className="relative grid size-10 place-items-center rounded-full text-ink hover:bg-surface-muted" aria-label={`${t('topbar.notifications')} (${count})`}>
        <Bell className="size-[22px]" strokeWidth={1.7} />
        {count > 0 ? <span className="absolute end-1.5 top-1 grid min-w-[17px] place-items-center rounded-full border-2 border-bg bg-accent px-0.5 text-[9px] font-bold leading-[13px] text-white">{num(count)}</span> : null}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} className="animate-fade-in z-50 w-[340px] rounded-lg border border-border bg-surface p-1.5 shadow-pop">
          <p className="px-3 pb-2 pt-2 text-sm font-semibold">{t('topbar.notifications')}</p>
          {count === 0 ? <p className="px-3 pb-4 text-sm text-ink-muted">{t('topbar.noNotifications')}</p> : null}
          <ul className="max-h-[360px] overflow-y-auto">
            {q.data?.items.map((n) => (
              <li key={n.kind + n.id}>
                <Link href={n.kind === 'order_delayed' ? '/kitchen' : '/inventory'} className="flex items-start gap-3 rounded-md px-3 py-2.5 hover:bg-surface-muted">
                  <span className={cn('grid size-8 shrink-0 place-items-center rounded-md', n.kind === 'order_delayed' ? 'bg-danger-soft text-danger' : 'bg-warning-soft text-warning')}>
                    {n.kind === 'order_delayed' ? <AlertTriangle className="size-4" /> : <PackageX className="size-4" />}
                  </span>
                  <span className="min-w-0 flex-1 text-sm">
                    {n.kind === 'order_delayed' ? t('topbar.orderDelayed', { n: String(n.number) }) : t('topbar.stockCritical', { name: name(n) })}
                    <span className="mt-0.5 block text-xs text-ink-muted">{n.kind === 'order_delayed' ? ago(n.at) : qty(n.qtyMilli, n.unit)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function Topbar({ onMenu, searchPlaceholder }: { onMenu: () => void; searchPlaceholder?: string }) {
  const { t, name, longDate, time, hijri, locale, numerals } = useI18n();
  const { me, can } = useSession();
  const setPref = useSetPreference();
  const now = useNow();
  const role = me.roles[0] ?? 'manager';
  const userName = name(me.user);
  return (
    <header className="sticky top-0 z-30 flex h-[72px] items-center gap-3 border-b border-border/60 bg-bg/90 px-4 backdrop-blur md:px-6">
      <button className="grid size-10 place-items-center rounded-md hover:bg-surface-muted lg:hidden" onClick={onMenu} aria-label={t('topbar.openMenu')}>
        <MenuIcon className="size-5" />
      </button>
      <GlobalSearch placeholder={searchPlaceholder ?? t('topbar.search')} />
      <div className="ms-auto flex items-center gap-2 md:gap-4">
        <Notifications />
        <div className="hidden items-center gap-3 border-e border-border pe-5 xl:flex">
          <CalendarDays className="size-[22px] text-ink" strokeWidth={1.7} />
          <div className="leading-tight" suppressHydrationWarning>
            <p className="text-xs text-ink-muted">{now ? longDate(now) : ' '}</p>
            <p className="mt-0.5 text-sm font-semibold text-ink">
              {now ? time(now) : ' '}
              {now ? <span className="ms-2 text-2xs font-normal text-ink-muted">{hijri(now)}</span> : null}
            </p>
          </div>
        </div>
        <MenuRoot>
          <MenuTrigger className="flex items-center gap-3 rounded-lg py-1 pe-1 ps-1 hover:bg-surface-muted">
            <span className="grid size-10 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent" aria-hidden>
              {initials(userName)}
            </span>
            <span className="hidden text-start leading-tight sm:block">
              <span className="block text-sm font-semibold text-ink">{userName}</span>
              <span className="mt-0.5 block text-xs text-ink-muted">{t(`roles.${role}`)}</span>
            </span>
            <ChevronDown className="size-4 text-ink-muted" />
          </MenuTrigger>
          <MenuContent className="w-[230px]">
            <MenuItem icon={<Languages />} onSelect={() => setPref(LOCALE_COOKIE, locale === 'ar' ? 'en' : 'ar')}>
              {t('topbar.language')}
            </MenuItem>
            <MenuItem icon={<Hash />} onSelect={() => setPref(NUMERALS_COOKIE, numerals === 'arab' ? 'latn' : 'arab')}>
              {numerals === 'arab' ? 'Latin digits (123)' : t('topbar.numerals')}
            </MenuItem>
            {can('settings.view') ? (
              <MenuItem icon={<Settings />} onSelect={() => (window.location.href = '/settings')}>
                {t('topbar.profile')}
              </MenuItem>
            ) : null}
            <MenuSeparator />
            <MenuItem icon={<LogOut className="flip-rtl" />} danger onSelect={logout}>
              {t('nav.logout')}
            </MenuItem>
          </MenuContent>
        </MenuRoot>
      </div>
    </header>
  );
}
