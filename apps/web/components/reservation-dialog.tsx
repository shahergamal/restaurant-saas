'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useErrorToast } from '@/lib/errors';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';

function defaultTime() {
  // Next half hour, at least 30 minutes from now, as a local datetime-local value.
  const d = new Date(Date.now() + 60 * 60_000);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const PHONE = /^(\+9665|05)\d{8}$/;

export function ReservationDialog({ open, onClose, tables }: { open: boolean; onClose: () => void; tables?: { id: string; label: number; seats: number }[] }) {
  const { t, num } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const fail = useErrorToast();
  const [form, setForm] = useState({ guestName: '', phone: '', guests: 2, section: 'family', at: defaultTime(), tableId: '', notes: '' });
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (open) {
      setForm({ guestName: '', phone: '', guests: 2, section: 'family', at: defaultTime(), tableId: '', notes: '' });
      setTouched(false);
    }
  }, [open]);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const phone = form.phone.replace(/[\s-]/g, '');
  const errors = {
    guestName: form.guestName.trim().length < 2 ? t('common.required') : undefined,
    phone: !PHONE.test(phone) ? '05XXXXXXXX' : undefined,
    at: new Date(form.at).getTime() < Date.now() ? t('errors.reservation_in_past') : undefined,
  };
  const valid = !errors.guestName && !errors.phone && !errors.at;
  const save = useMutation({
    mutationFn: () =>
      api('/reservations', {
        method: 'POST',
        json: { guestName: form.guestName.trim(), phone, guests: form.guests, section: form.section, at: new Date(form.at).toISOString(), tableId: form.tableId || undefined, notes: form.notes.trim() || undefined },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservations'] });
      toast('success', t('tables.reserved'));
      onClose();
    },
    onError: (e) => (e instanceof ApiError && e.code === 'validation_failed' ? setTouched(true) : fail(e)),
  });
  const show = (k: keyof typeof errors) => (touched ? errors[k] : undefined);
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title={t('tables.newReservation')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button loading={save.isPending} onClick={() => (valid ? save.mutate() : setTouched(true))}>
            {t('tables.reserve')}
          </Button>
        </>
      }
    >
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => (e.preventDefault(), valid ? save.mutate() : setTouched(true))} noValidate>
        <Field label={t('tables.guestName')} error={show('guestName')} className="sm:col-span-2">
          {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!show('guestName')} value={form.guestName} onChange={(e) => set('guestName', e.target.value)} autoComplete="name" maxLength={80} />}
        </Field>
        <Field label={t('tables.phone')} error={show('phone')}>
          {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!show('phone')} dir="ltr" inputMode="tel" placeholder="05XXXXXXXX" value={form.phone} onChange={(e) => set('phone', e.target.value)} autoComplete="tel" />}
        </Field>
        <Field label={t('orders.guests')}>
          {(id) => (
            <Select id={id} value={form.guests} onChange={(e) => set('guests', Number(e.target.value))}>
              {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {num(n)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t('tables.dateTime')} error={show('at')}>
          {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!show('at')} type="datetime-local" dir="ltr" value={form.at} onChange={(e) => set('at', e.target.value)} />}
        </Field>
        <Field label={t('tables.section')}>
          {(id) => (
            <Select id={id} value={form.section} onChange={(e) => set('section', e.target.value)}>
              <option value="family">{t('tables.family')}</option>
              <option value="single">{t('tables.single')}</option>
            </Select>
          )}
        </Field>
        {tables ? (
          <Field label={t('orders.table')} className="sm:col-span-2">
            {(id) => (
              <Select id={id} value={form.tableId} onChange={(e) => set('tableId', e.target.value)}>
                <option value="">{t('tables.anyTable')}</option>
                {tables
                  .filter((tb) => tb.seats >= form.guests)
                  .map((tb) => (
                    <option key={tb.id} value={tb.id}>
                      {t('common.table', { n: tb.label })} • {t('tables.seats', { n: tb.seats })}
                    </option>
                  ))}
              </Select>
            )}
          </Field>
        ) : null}
        <Field label={t('tables.notes')} className="sm:col-span-2">
          {(id) => <Textarea id={id} value={form.notes} maxLength={200} onChange={(e) => set('notes', e.target.value)} rows={2} />}
        </Field>
      </form>
    </Dialog>
  );
}
