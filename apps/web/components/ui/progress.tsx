import { cn } from '@/lib/cn';

export function Progress({ value, className, barClass = 'bg-accent', label }: { value: number; className?: string; barClass?: string; label?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface-muted', className)} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={cn('h-full rounded-full transition-[width] duration-500', barClass)} style={{ width: `${v}%` }} />
    </div>
  );
}
