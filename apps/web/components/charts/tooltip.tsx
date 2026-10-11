'use client';

/** Shared recharts tooltip body; rows are [colour, label, formatted value]. */
export function ChartTooltip({ title, rows }: { title?: string; rows: [string, string, string][] }) {
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-pop">
      {title ? <p className="mb-1 font-semibold text-ink">{title}</p> : null}
      {rows.map(([color, label, value]) => (
        <p key={label} className="flex items-center gap-2 text-ink-muted">
          <span className="size-2 rounded-full" style={{ background: color }} />
          {label}
          <span className="ms-auto ps-3 font-semibold text-ink tabular">{value}</span>
        </p>
      ))}
    </div>
  );
}
