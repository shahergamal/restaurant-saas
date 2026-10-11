'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { SessionProvider, useMeQuery } from '@/lib/session';
import { useRealtime } from '@/lib/realtime';
import { LogoMark } from '@/components/ui/logo';
import { ErrorState } from '@/components/ui/states';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

const SEARCH_HINT: Record<string, string> = {
  '/inventory': 'topbar.searchInventory',
  '/reports': 'topbar.searchReports',
  '/food-cost': 'topbar.searchMenu',
};

function Live() {
  useRealtime();
  return null;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const me = useMeQuery();
  const [open, setOpen] = useState(false);
  const path = usePathname();
  if (me.isError)
    return (
      <div className="grid min-h-screen place-items-center">
        <ErrorState onRetry={() => me.refetch()} />
      </div>
    );
  if (!me.data)
    return (
      <div className="grid min-h-screen place-items-center" aria-busy>
        <LogoMark className="size-12 animate-pulse" />
        <span className="sr-only">{t('common.loading')}</span>
      </div>
    );
  const hint = Object.entries(SEARCH_HINT).find(([p]) => path.startsWith(p))?.[1];
  return (
    <SessionProvider me={me.data}>
      <Live />
      <a href="#main" className="sr-only z-[60] rounded bg-accent px-3 py-2 text-white focus:not-sr-only focus:fixed focus:start-3 focus:top-3">
        Skip to content
      </a>
      <div className="flex min-h-screen">
        <Sidebar open={open} onClose={() => setOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onMenu={() => setOpen(true)} searchPlaceholder={hint ? t(hint) : undefined} />
          <main id="main" className="flex-1 px-4 pb-8 pt-5 md:px-6">
            {children}
          </main>
        </div>
      </div>
    </SessionProvider>
  );
}
