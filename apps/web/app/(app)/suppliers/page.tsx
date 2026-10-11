'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Truck } from 'lucide-react';
import { api } from '@/lib/api';
import { useErrorToast } from '@/lib/errors';
import { useI18n } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { PageHeader } from '@/components/ui/page-header';
import { ErrorState } from '@/components/ui/states';
import { IconTile } from '@/components/ui/stat-card';
import { useToast } from '@/components/ui/toast';

type Supplier = { id: string; name: string; phone: string | null; vatNumber: string | null; _count: { ingredients: number; purchaseOrders: number } };
type Po = { id: string; number: number; status: 'draft' | 'sent' | 'received' | 'cancelled'; createdAt: string; receivedAt: string | null; supplier: { name: string } | null; totalHalala?: number };

export default function SuppliersPage() {
  const { t, num, date, money } = useI18n();
  const { can } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const fail = useErrorToast();
  const sup = useQuery({ queryKey: ['suppliers'], queryFn: () => api<Supplier[]>('/suppliers') });
  const pos = useQuery({ queryKey: ['purchase-orders'], queryFn: () => api<Po[]>('/purchase-orders') });
  const receive = useMutation({
    mutationFn: (id: string) => api(`/purchase-orders/${id}/receive`, { method: 'POST' }),
    onSuccess: () => {
      for (const k of ['purchase-orders', 'inventory', 'suppliers']) qc.invalidateQueries({ queryKey: [k] });
      toast('success', t('suppliers.received'));
    },
    onError: fail,
  });
  return (
    <>
      <PageHeader title={t('suppliers.title')} subtitle={t('suppliers.subtitle')} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="min-w-0 p-5">
          {sup.isError ? (
            <ErrorState onRetry={() => sup.refetch()} />
          ) : (
            <DataTable
              caption={t('suppliers.title')}
              empty={t('common.empty')}
              minWidth={560}
              rows={sup.data}
              columns={[
                {
                  key: 'n',
                  header: t('suppliers.name'),
                  cell: (s) => (
                    <span className="flex items-center gap-3">
                      <IconTile tone="softAccent" className="size-9 rounded-full [&>svg]:size-4">
                        <Truck />
                      </IconTile>
                      <span className="font-medium">{s.name}</span>
                    </span>
                  ),
                },
                { key: 'p', header: t('suppliers.phone'), cell: (s) => <span className="text-xs text-ink-muted tabular" dir="ltr">{s.phone ?? '—'}</span> },
                { key: 'v', header: t('suppliers.vat'), cell: (s) => <span className="text-xs text-ink-muted tabular" dir="ltr">{s.vatNumber ?? '—'}</span> },
                { key: 'i', header: t('suppliers.items'), cell: (s) => <span className="tabular">{num(s._count.ingredients)}</span> },
                { key: 'o', header: t('suppliers.pos'), cell: (s) => <span className="tabular">{num(s._count.purchaseOrders)}</span> },
              ]}
            />
          )}
        </Card>
        <Card className="p-5">
          <CardHeader title={t('suppliers.pos')} />
          {pos.data && pos.data.length === 0 ? <p className="mt-3 text-xs text-ink-muted">{t('common.empty')}</p> : null}
          <ul className="mt-3 divide-y divide-border">
            {(pos.data ?? []).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold tabular">#{p.number}</p>
                  <p className="mt-0.5 truncate text-xs text-ink-muted">
                    {p.supplier?.name ?? '—'} · {date(p.createdAt)}
                    {p.totalHalala ? ` · ${money(p.totalHalala)}` : ''}
                  </p>
                </div>
                {p.status === 'received' ? (
                  <Badge tone="success">{t('suppliers.st.received')}</Badge>
                ) : p.status === 'cancelled' ? (
                  <Badge tone="neutral">{t('suppliers.st.cancelled')}</Badge>
                ) : can('purchasing.manage') ? (
                  <Button size="sm" variant="outline" loading={receive.isPending && receive.variables === p.id} onClick={() => receive.mutate(p.id)}>
                    {t('suppliers.receive')}
                  </Button>
                ) : (
                  <Badge tone="warning">{t(`suppliers.st.${p.status}`)}</Badge>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
