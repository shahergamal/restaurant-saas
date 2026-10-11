'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronRight, LogOut, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { NAV } from '@/lib/nav';
import { logout, useSession } from '@/lib/session';
import { cn } from '@/lib/cn';
import { LogoMark } from '@/components/ui/logo';
import { MenuContent, MenuItem, MenuLabel, MenuRoot, MenuTrigger } from '@/components/ui/menu';

type Notifs = { count: number; items: { kind: string }[] };

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, name, num } = useI18n();
  const { me, can, branchId, setBranch } = useSession();
  const path = usePathname();
  const notifs = useQuery({ queryKey: ['notifications'], queryFn: () => api<Notifs>('/notifications'), refetchInterval: 60_000, enabled: can('orders.view') });
  const delayed = notifs.data?.items.filter((i) => i.kind === 'order_delayed').length ?? 0;
  const branch = me.branches.find((b) => b.id === branchId) ?? me.branches[0];

  return (
    <>
      <div className={cn('fixed inset-0 z-40 bg-black/40 lg:hidden', open ? 'block' : 'hidden')} onClick={onClose} aria-hidden />
      <aside
        className={cn(
          'fixed inset-y-0 start-0 z-50 flex w-[240px] flex-col bg-sidebar text-sidebar-text transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen',
          open ? 'translate-x-0' : 'max-lg:ltr:-translate-x-full max-lg:rtl:translate-x-full',
        )}
        aria-label={t('nav.main')}
      >
        <div className="flex items-center gap-3 px-6 pb-6 pt-7">
          <LogoMark className="size-11" tone="light" />
          <div className="leading-tight">
            <p className="text-[26px] font-bold tracking-tight text-white">{t('brand.name')}</p>
            <p className="mt-0.5 text-2xs text-sidebar-muted">{t('brand.tagline')}</p>
          </div>
          <button className="ms-auto rounded p-1 text-sidebar-muted hover:text-white lg:hidden" onClick={onClose} aria-label={t('topbar.closeMenu')}>
            <X className="size-5" />
          </button>
        </div>

        <nav className="scrollbar-thin flex-1 overflow-y-auto px-3.5">
          <ul className="flex flex-col gap-0.5">
            {NAV.filter((n) => can(n.permission)).map((n) => {
              const active = path === n.href || path.startsWith(`${n.href}/`);
              const Icon = n.icon;
              return (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    onClick={onClose}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex h-[43px] items-center gap-3.5 rounded-md px-3 text-[14.5px] font-medium transition-colors duration-fast',
                      active ? 'bg-accent text-white shadow-accent' : 'text-sidebar-text/90 hover:bg-white/[0.06] hover:text-white',
                    )}
                  >
                    <Icon className="size-[21px] shrink-0" strokeWidth={1.7} />
                    <span className="flex-1 truncate">{t(`nav.${n.key}`)}</span>
                    {n.key === 'orders' && delayed > 0 ? (
                      <span className={cn('grid size-5 place-items-center rounded-full text-2xs font-semibold', active ? 'bg-white text-accent' : 'bg-accent text-white')} aria-label={t('status.delayed')}>
                        {num(delayed)}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="px-3.5 pb-4">
          <div className="mx-2 border-t border-sidebar-line" />
          <MenuRoot>
            <MenuTrigger className="mt-3 flex w-full items-center gap-3 rounded-md px-2 py-2 text-start hover:bg-white/[0.06]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/img/scenes/branch.svg" alt="" className="size-11 shrink-0 rounded-md object-cover" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-white">{name(me.organization)}</span>
                <span className="block truncate text-2xs text-sidebar-muted">{name(branch)}</span>
              </span>
              <ChevronRight className="flip-rtl size-4 text-sidebar-muted" />
            </MenuTrigger>
            <MenuContent align="start" className="w-[220px]">
              <MenuLabel>{t('topbar.branch')}</MenuLabel>
              {me.branches.map((b) => (
                <MenuItem key={b.id} onSelect={() => setBranch(b.id)} icon={b.id === branchId ? <Check /> : <span className="block size-4" />}>
                  {name(b)}
                </MenuItem>
              ))}
            </MenuContent>
          </MenuRoot>
          <div className="mx-2 mt-3 border-t border-sidebar-line" />
          <button onClick={logout} className="mt-3 flex h-10 w-full items-center gap-3.5 rounded-md px-3 text-sm text-sidebar-text/90 hover:bg-white/[0.06] hover:text-white">
            <LogOut className="flip-rtl size-5" strokeWidth={1.7} />
            {t('nav.logout')}
          </button>
        </div>
      </aside>
    </>
  );
}
