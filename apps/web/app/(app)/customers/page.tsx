'use client';

import { useQuery } from '@tanstack/react-query';
import { Lock } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { ErrorState } from '@/components/ui/states';
import { initials } from '@/components/shell/topbar';

type Customer = { id: string; name: string | null; phoneMasked: string | null; createdAt: string };
type Page = { total: number; page: number; pageSize: number; items: Customer[] };

export default function CustomersPage() {
  const { t, date } = useI18n();
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ['customers', page], queryFn: () => api<Page>(`/customers?page=${page}`), placeholderData: (p) => p });
  return (
    <>
      <PageHeader title={t('customers.title')} subtitle={t('customers.subtitle')} />
      <Card className="p-5">
        {q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : (
          <DataTable
            caption={t('customers.title')}
            empty={t('common.empty')}
            minWidth={560}
            rows={q.data?.items}
            columns={[
              {
                key: 'name',
                header: t('customers.name'),
                cell: (c) => (
                  <span className="flex items-center gap-3">
                    <span className="grid size-9 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">{initials(c.name ?? '—')}</span>
                    <span className="font-medium">{c.name ?? '—'}</span>
                  </span>
                ),
              },
              {
                key: 'phone',
                header: t('customers.phone'),
                cell: (c) => (
                  <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted tabular" dir="ltr">
                    <Lock className="size-3" aria-hidden />
                    {c.phoneMasked ?? '—'}
                  </span>
                ),
              },
              { key: 'since', header: t('customers.since'), cell: (c) => <span className="text-xs text-ink-muted">{date(c.createdAt)}</span> },
            ]}
          />
        )}
        {q.data && q.data.total > 0 ? (
          <div className="mt-4">
            <Pagination page={page} pageSize={q.data.pageSize} total={q.data.total} onPage={setPage} />
          </div>
        ) : null}
      </Card>
    </>
  );
}
