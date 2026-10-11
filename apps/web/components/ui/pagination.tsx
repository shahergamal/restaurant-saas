'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/cn';

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const { t, num } = useI18n();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const list: (number | '…')[] = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) list.push(p);
    else if (list.at(-1) !== '…') list.push('…');
  }
  const btn = 'grid size-8 place-items-center rounded text-xs font-medium tabular transition-colors';
  return (
    <nav className="flex flex-wrap items-center justify-between gap-3" aria-label="Pagination">
      <p className="text-xs text-ink-muted">{t('common.showing', { from, to, total })}</p>
      <div className="flex items-center gap-1">
        <button className={cn(btn, 'border border-border hover:bg-surface-muted disabled:opacity-40')} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label={t('common.prev')}>
          <ChevronLeft className="flip-rtl size-4" />
        </button>
        {list.map((p, i) =>
          p === '…' ? (
            <span key={`e${i}`} className="px-1 text-xs text-ink-subtle">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p)}
              aria-current={p === page ? 'page' : undefined}
              aria-label={t('common.page', { n: p })}
              className={cn(btn, p === page ? 'bg-accent text-white' : 'border border-border hover:bg-surface-muted')}
            >
              {num(p)}
            </button>
          ),
        )}
        <button className={cn(btn, 'border border-border hover:bg-surface-muted disabled:opacity-40')} disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label={t('common.next')}>
          <ChevronRight className="flip-rtl size-4" />
        </button>
      </div>
    </nav>
  );
}
