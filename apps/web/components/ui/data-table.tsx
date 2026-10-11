'use client';

import { cn } from '@/lib/cn';
import { EmptyState, Skeleton } from './states';

export type Column<T> = { key: string; header: React.ReactNode; cell: (row: T) => React.ReactNode; className?: string };

/** Plain list table used by the directory screens (menu, staff, sales…). */
export function DataTable<T extends { id: string }>({ caption, columns, rows, empty, minWidth = 720 }: { caption: string; columns: Column<T>[]; rows?: T[]; empty: string; minWidth?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full" style={{ minWidth }}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border text-xs text-ink-muted">
            {columns.map((c) => (
              <th key={c.key} scope="col" className={cn('px-3 py-3 text-start font-medium first:ps-0', c.className)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {!rows
            ? Array.from({ length: 8 }, (_, i) => (
                <tr key={i}>
                  <td colSpan={columns.length} className="py-1.5">
                    <Skeleton className="h-10" />
                  </td>
                </tr>
              ))
            : rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface-muted/50">
                  {columns.map((c) => (
                    <td key={c.key} className={cn('px-3 py-2.5 text-sm first:ps-0', c.className)}>
                      {c.cell(r)}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
      {rows && rows.length === 0 ? <EmptyState title={empty} /> : null}
    </div>
  );
}
