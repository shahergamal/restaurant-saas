'use client';

import { AlertTriangle, Inbox, RotateCw } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/cn';
import { Button } from './button';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden />;
}

export function EmptyState({ title, body, icon, action, className }: { title: string; body?: string; icon?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 px-6 py-10 text-center', className)}>
      <div className="mb-1 grid size-11 place-items-center rounded-full bg-surface-muted text-ink-subtle">{icon ?? <Inbox className="size-5" />}</div>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {body ? <p className="max-w-xs text-xs text-ink-muted">{body}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({ onRetry, className }: { onRetry?: () => void; className?: string }) {
  const { t } = useI18n();
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center gap-2 px-6 py-10 text-center', className)}>
      <div className="mb-1 grid size-11 place-items-center rounded-full bg-danger-soft text-danger">
        <AlertTriangle className="size-5" />
      </div>
      <p className="text-sm font-semibold">{t('common.errorTitle')}</p>
      <p className="text-xs text-ink-muted">{t('common.errorBody')}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-1" onClick={onRetry}>
          <RotateCw className="size-3.5" />
          {t('common.retry')}
        </Button>
      ) : null}
    </div>
  );
}
