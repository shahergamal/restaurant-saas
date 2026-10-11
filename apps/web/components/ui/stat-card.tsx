import { cn } from '@/lib/cn';
import { Card } from './card';

export const ICON_TILES = {
  accent: 'bg-accent text-white',
  teal: 'bg-teal text-white',
  info: 'bg-info text-white',
  violet: 'bg-violet text-white',
  danger: 'bg-danger text-white',
  success: 'bg-success text-white',
  softAccent: 'bg-accent-soft text-accent',
  softSuccess: 'bg-success-soft text-success',
  softDanger: 'bg-danger-soft text-danger',
  softWarning: 'bg-warning-soft text-warning',
  softInfo: 'bg-info-soft text-info',
  softViolet: 'bg-violet-soft text-violet',
} as const;

export function IconTile({ tone, children, className }: { tone: keyof typeof ICON_TILES; children: React.ReactNode; className?: string }) {
  return <span className={cn('grid size-10 shrink-0 place-items-center rounded-md [&>svg]:size-5', ICON_TILES[tone], className)}>{children}</span>;
}

/** KPI card. `layout="stack"` = icon above (Dashboard); `"row"` = icon beside (Inventory, Reports, Food Cost). */
export function StatCard({
  icon,
  tone,
  label,
  value,
  foot,
  layout = 'row',
  className,
  iconClass,
}: {
  icon: React.ReactNode;
  tone: keyof typeof ICON_TILES;
  label: string;
  value: React.ReactNode;
  foot?: React.ReactNode;
  layout?: 'row' | 'stack';
  className?: string;
  iconClass?: string;
}) {
  if (layout === 'stack')
    return (
      <Card className={cn('flex flex-col p-4', className)}>
        <IconTile tone={tone} className={iconClass}>
          {icon}
        </IconTile>
        <p className="mt-4 text-sm text-ink-muted">{label}</p>
        <p className="mt-1.5 text-xl font-bold tabular text-ink">{value}</p>
        <div className="mt-auto pt-3">{foot}</div>
      </Card>
    );
  return (
    <Card className={cn('flex items-start gap-3.5 p-4', className)}>
      <IconTile tone={tone} className={cn('size-12 rounded-full [&>svg]:size-6', iconClass)}>
        {icon}
      </IconTile>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-ink-muted">{label}</p>
        <p className="mt-1 text-xl font-bold tabular text-ink">{value}</p>
        {foot ? <div className="mt-1.5">{foot}</div> : null}
      </div>
    </Card>
  );
}
