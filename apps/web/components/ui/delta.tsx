'use client';

import { ArrowDown, ArrowUp } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/cn';

/**
 * Change indicator. `goodWhenDown` flips the colour for metrics where lower is better (cost, waste, prep time).
 * `unit` "%" renders a percentage, "min" a duration.
 */
export function Delta({ value, unit = '%', goodWhenDown, label, className }: { value: number; unit?: '%' | 'min'; goodWhenDown?: boolean; label?: string; className?: string }) {
  const { t, num1 } = useI18n();
  const up = value > 0;
  const flat = value === 0;
  const good = flat ? null : goodWhenDown ? !up : up;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs', className)}>
      <span className={cn('inline-flex items-center gap-0.5 font-semibold', good === null ? 'text-ink-muted' : good ? 'text-success' : 'text-danger')}>
        {!flat ? <Icon className="size-3.5" strokeWidth={2.5} aria-hidden /> : null}
        {unit === '%' ? `${num1(Math.abs(value))}%` : t('common.minutes', { n: Math.abs(value) })}
      </span>
      {label ? <span className="text-ink-muted">{label}</span> : null}
    </span>
  );
}
