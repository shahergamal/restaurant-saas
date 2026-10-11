'use client';

import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/cn';

export type PillTab<K extends string> = { key: K; label: string; count?: number; dot?: string };

/** Segmented filter pills (Orders, Kitchen, Inventory, Food Cost). Arrow keys move between tabs. */
export function PillTabs<K extends string>({ tabs, value, onChange, size = 'md', label, className }: { tabs: PillTab<K>[]; value: K; onChange: (k: K) => void; size?: 'sm' | 'md'; label: string; className?: string }) {
  const { num, dir } = useI18n();
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const fwd = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    const back = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
    if (e.key !== fwd && e.key !== back) return;
    e.preventDefault();
    const next = (i + (e.key === fwd ? 1 : -1) + tabs.length) % tabs.length;
    onChange(tabs[next]!.key);
    (e.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className={cn('flex flex-wrap items-center gap-2', className)}>
      {tabs.map((tab, i) => {
        const active = tab.key === value;
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onKeyDown={(e) => onKey(e, i)}
            onClick={() => onChange(tab.key)}
            className={cn(
              'inline-flex items-center gap-2 whitespace-nowrap border font-medium transition-colors duration-fast',
              size === 'sm' ? 'h-8 rounded px-3 text-xs' : 'h-10 rounded-md px-4 text-sm',
              active ? 'border-accent bg-accent text-white shadow-accent' : 'border-border bg-surface text-ink hover:bg-surface-muted',
            )}
          >
            {tab.dot ? <span className={cn('size-2 rounded-full', tab.dot)} aria-hidden /> : null}
            {tab.label}
            {tab.count !== undefined ? (
              <span className={cn('min-w-[22px] rounded-full px-1.5 py-px text-2xs font-semibold tabular', active ? 'bg-white/20 text-white' : 'bg-surface-muted text-ink-muted')}>{num(tab.count)}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
