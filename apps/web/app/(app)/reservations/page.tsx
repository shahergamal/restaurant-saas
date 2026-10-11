'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MoreVertical, Plus } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useErrorToast } from '@/lib/errors';
import { useI18n } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { MenuContent, MenuItem, MenuRoot, MenuTrigger } from '@/components/ui/menu';
import { PageHeader } from '@/components/ui/page-header';
import { ErrorState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { ReservationDialog } from '@/components/reservation-dialog';

type Status = 'booked' | 'seated' | 'cancelled' | 'no_show';
type Reservation = { id: string; guestName: string; guests: number; section: 'family' | 'single'; at: string; status: Status; notes: string | null; phoneMasked: string | null; tableLabel: number | null };
const TONE: Record<Status, 'accent' | 'success' | 'neutral' | 'danger'> = { booked: 'accent', seated: 'success', cancelled: 'neutral', no_show: 'danger' };

export default function ReservationsPage() {
  const { t, num, date, time } = useI18n();
  const { can } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const fail = useErrorToast();
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ['reservations'], queryFn: () => api<Reservation[]>('/reservations') });
  const set = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Status }) => api(`/reservations/${id}`, { method: 'PATCH', json: { status } }),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['reservations'] });
      qc.invalidateQueries({ queryKey: ['tables'] });
      toast('success', t(`reservations.st.${v.status}`));
    },
    onError: fail,
  });
  const manage = can('tables.manage');
  return (
    <>
      <PageHeader
        title={t('reservations.title')}
        subtitle={t('reservations.subtitle')}
        actions={
          manage ? (
            <Button size="lg" onClick={() => setOpen(true)}>
              <Plus className="size-4" />
              {t('tables.newReservation')}
            </Button>
          ) : null
        }
      />
      <Card className="p-5">
        {q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : (
          <DataTable
            caption={t('reservations.title')}
            empty={t('reservations.empty')}
            rows={q.data}
            columns={[
              {
                key: 'g',
                header: t('reservations.guest'),
                cell: (r) => (
                  <span>
                    <span className="block font-medium">{r.guestName}</span>
                    <span className="block text-2xs text-ink-muted tabular" dir="ltr">
                      {r.phoneMasked ?? ''}
                    </span>
                  </span>
                ),
              },
              { key: 'at', header: t('reservations.time'), cell: (r) => <span className="text-xs">{`${date(r.at, { weekday: 'short', day: 'numeric', month: 'short' })} · ${time(r.at)}`}</span> },
              { key: 'p', header: t('reservations.party'), cell: (r) => <span className="text-xs">{t('common.guests', { n: num(r.guests) })}</span> },
              { key: 's', header: t('tables.section'), cell: (r) => <span className="text-xs text-ink-muted">{t(`tables.${r.section}`)}</span> },
              { key: 't', header: t('reservations.table'), cell: (r) => <span className="text-xs tabular">{r.tableLabel ? num(r.tableLabel) : '—'}</span> },
              { key: 'st', header: t('reservations.status'), cell: (r) => <Badge tone={TONE[r.status]}>{t(`reservations.st.${r.status}`)}</Badge> },
              {
                key: 'a',
                header: <span className="sr-only">{t('common.actions')}</span>,
                className: 'w-10 text-end',
                cell: (r) =>
                  manage && r.status === 'booked' ? (
                    <MenuRoot>
                      <MenuTrigger className="grid size-8 place-items-center rounded-md text-ink-muted hover:bg-surface-muted" aria-label={`${t('common.actions')}: ${r.guestName}`}>
                        <MoreVertical className="size-4" />
                      </MenuTrigger>
                      <MenuContent>
                        <MenuItem onSelect={() => set.mutate({ id: r.id, status: 'seated' })}>{t('reservations.seat')}</MenuItem>
                        <MenuItem onSelect={() => set.mutate({ id: r.id, status: 'no_show' })}>{t('reservations.st.no_show')}</MenuItem>
                        <MenuItem onSelect={() => set.mutate({ id: r.id, status: 'cancelled' })}>{t('reservations.cancel')}</MenuItem>
                      </MenuContent>
                    </MenuRoot>
                  ) : null,
              },
            ]}
          />
        )}
      </Card>
      <ReservationDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
