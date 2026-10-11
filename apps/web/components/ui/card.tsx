import { cn } from '@/lib/cn';

export function Card({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <section className={cn('rounded-lg border border-border bg-surface shadow-card', className)} {...rest} />;
}

export function CardHeader({ title, action, className, id }: { title: React.ReactNode; action?: React.ReactNode; className?: string; id?: string }) {
  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <h2 id={id} className="text-md font-semibold text-ink">
        {title}
      </h2>
      {action}
    </div>
  );
}
