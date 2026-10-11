'use client';

import { AlertTriangle, CheckCircle2, Clock, Loader, XCircle } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/cn';

type Tone = 'warning' | 'success' | 'danger' | 'info' | 'neutral' | 'violet' | 'accent';
const tones: Record<Tone, string> = {
  warning: 'bg-warning-soft text-warning',
  success: 'bg-success-soft text-success',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  neutral: 'bg-neutral-soft text-neutral',
  violet: 'bg-violet-soft text-violet',
  accent: 'bg-accent-soft text-accent',
};

export function Badge({ tone, children, icon, className }: { tone: Tone; children: React.ReactNode; icon?: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded px-2.5 py-1 text-xs font-medium', tones[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

const STATUS: Record<string, { tone: Tone; Icon?: React.ComponentType<{ className?: string }> }> = {
  in_progress: { tone: 'warning', Icon: Loader },
  ready: { tone: 'success', Icon: CheckCircle2 },
  delayed: { tone: 'danger', Icon: AlertTriangle },
  served: { tone: 'info', Icon: CheckCircle2 },
  paid: { tone: 'success', Icon: CheckCircle2 },
  cancelled: { tone: 'neutral', Icon: XCircle },
  in_stock: { tone: 'success' },
  low: { tone: 'warning' },
  critical: { tone: 'danger' },
  out: { tone: 'neutral' },
  pending: { tone: 'warning', Icon: Clock },
};

/** Order / stock status pill with icon, so state never relies on colour alone. */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const { t } = useI18n();
  const s = STATUS[status] ?? { tone: 'neutral' as Tone };
  const Icon = s.Icon;
  return (
    <Badge tone={s.tone} className={className} icon={Icon ? <Icon className="size-3.5" /> : <span className="size-1.5 rounded-full bg-current" aria-hidden />}>
      {t(`status.${status}`)}
    </Badge>
  );
}
