'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { ErrorState } from '@/components/ui/states';

type Sale = { id: string; number: number; channel: string; table: string | null; closedAt: string; total: number; vat: number; methods: string[]; invoice: { icv: number; status: string; type: string } | null };
type Page = { total: number; page: number; pageSize: number; items: Sale[] };

export default function SalesPage() {
  const { t, num, money, date, time } = useI18n();
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ['sales', page], queryFn: () => api<Page>(`/sales?page=${page}`), placeholderData: (p) => p });
  return (
    <>
      <PageHeader title={t('sales.title')} subtitle={t('sales.subtitle')} />
      <Card className="p-5">
        {q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : (
          <DataTable
            caption={t('sales.title')}
            empty={t('common.empty')}
            rows={q.data?.items}
            columns={[
              { key: 'n', header: t('sales.number'), cell: (s) => <span className="font-semibold tabular">#{s.number}</span> },
              { key: 'ch', header: t('orders.table'), cell: (s) => <span className="text-xs text-ink-muted">{s.table ? t('common.table', { n: s.table }) : t(`channel.${s.channel}`)}</span> },
              { key: 'at', header: t('sales.closed'), cell: (s) => <span className="text-xs text-ink-muted">{`${date(s.closedAt)} · ${time(s.closedAt)}`}</span> },
              { key: 'm', header: t('sales.method'), cell: (s) => <span className="text-xs">{s.methods.map((m) => t(`orders.methods.${m}`)).join('، ')}</span> },
              { key: 'vat', header: t('sales.vat'), cell: (s) => <span className="tabular text-ink-muted">{money(s.vat)}</span> },
              { key: 'total', header: t('sales.total'), cell: (s) => <span className="font-semibold tabular">{money(s.total)}</span> },
              { key: 'inv', header: t('sales.invoice'), cell: (s) => (s.invoice ? <Badge tone={s.invoice.status === 'cleared' || s.invoice.status === 'reported' ? 'success' : 'warning'}>{s.invoice.status === 'pending' ? t('sales.pending') : s.invoice.status}</Badge> : <span className="text-xs text-ink-muted">{t('sales.notIssued')}</span>) },
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
