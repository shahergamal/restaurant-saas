'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ROLES } from '@sufra/shared';
import { api } from '@/lib/api';
import { useErrorToast } from '@/lib/errors';
import { useI18n } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/field';
import { PageHeader } from '@/components/ui/page-header';
import { ErrorState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { initials } from '@/components/shell/topbar';

type Staff = { id: string; nameAr: string; nameEn: string; email: string; phone: string | null; active: boolean; mfaEnabled: boolean; roles: string[] };

function AddStaff({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const fail = useErrorToast();
  const empty = { nameAr: '', nameEn: '', email: '', role: 'waiter', password: '' };
  const [f, setF] = useState(empty);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    setF(empty);
    setTouched(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((v) => ({ ...v, [k]: e.target.value }));
  const err = {
    nameAr: f.nameAr.trim().length < 2 ? t('common.required') : undefined,
    nameEn: f.nameEn.trim().length < 2 ? t('common.required') : undefined,
    email: !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim()) ? t('common.required') : undefined,
    password: f.password.length < 10 ? t('staff.passwordHelp') : undefined,
  };
  const e = (k: keyof typeof err) => (touched ? err[k] : undefined);
  const save = useMutation({
    mutationFn: () => api('/staff', { method: 'POST', json: { ...f, nameAr: f.nameAr.trim(), nameEn: f.nameEn.trim(), email: f.email.trim() } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff'] });
      toast('success', t('staff.created'));
      onClose();
    },
    onError: fail,
  });
  const submit = () => (Object.values(err).every((v) => !v) ? save.mutate() : setTouched(true));
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title={t('staff.add')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button loading={save.isPending} onClick={submit}>
            {t('staff.add')}
          </Button>
        </>
      }
    >
      <form className="grid gap-4 sm:grid-cols-2" noValidate onSubmit={(ev) => (ev.preventDefault(), submit())}>
        <Field label={t('menu.nameAr')} error={e('nameAr')}>
          {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!e('nameAr')} dir="rtl" value={f.nameAr} onChange={set('nameAr')} maxLength={80} />}
        </Field>
        <Field label={t('menu.nameEn')} error={e('nameEn')}>
          {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!e('nameEn')} dir="ltr" value={f.nameEn} onChange={set('nameEn')} maxLength={80} />}
        </Field>
        <Field label={t('staff.email')} error={e('email')}>
          {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!e('email')} dir="ltr" type="email" autoComplete="off" value={f.email} onChange={set('email')} />}
        </Field>
        <Field label={t('staff.role')}>
          {(id) => (
            <Select id={id} value={f.role} onChange={set('role')}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(`roles.${r}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t('staff.password')} hint={t('staff.passwordHelp')} error={e('password')}>
          {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!e('password')} dir="ltr" type="password" autoComplete="new-password" value={f.password} onChange={set('password')} />}
        </Field>
      </form>
    </Dialog>
  );
}

export default function StaffPage() {
  const { t, name } = useI18n();
  const { can } = useSession();
  const [adding, setAdding] = useState(false);
  const q = useQuery({ queryKey: ['staff'], queryFn: () => api<Staff[]>('/staff') });
  return (
    <>
      <PageHeader
        title={t('staff.title')}
        subtitle={t('staff.subtitle')}
        actions={
          can('staff.manage') ? (
            <Button size="lg" onClick={() => setAdding(true)}>
              <Plus className="size-4" />
              {t('staff.add')}
            </Button>
          ) : null
        }
      />
      <Card className="p-5">
        {q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : (
          <DataTable
            caption={t('staff.title')}
            empty={t('common.empty')}
            rows={q.data}
            columns={[
              {
                key: 'name',
                header: t('staff.name'),
                cell: (s) => (
                  <span className="flex items-center gap-3">
                    <span className="grid size-9 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">{initials(name(s))}</span>
                    <span className="font-medium">{name(s)}</span>
                  </span>
                ),
              },
              { key: 'email', header: t('staff.email'), cell: (s) => <span className="text-xs text-ink-muted" dir="ltr">{s.email}</span> },
              {
                key: 'role',
                header: t('staff.role'),
                cell: (s) => (
                  <span className="flex flex-wrap gap-1.5">
                    {s.roles.map((r) => (
                      <Badge key={r} tone="accent">
                        {t(`roles.${r}`)}
                      </Badge>
                    ))}
                  </span>
                ),
              },
              { key: 'mfa', header: t('staff.mfa'), cell: (s) => (s.mfaEnabled ? <ShieldCheck className="size-4 text-success" aria-label={t('settings.mfaOn')} /> : <span className="text-xs text-ink-muted">{t('settings.mfaOff')}</span>) },
              { key: 'active', header: t('staff.active'), cell: (s) => <Badge tone={s.active ? 'success' : 'neutral'}>{s.active ? t('menu.active') : t('menu.hidden')}</Badge> },
            ]}
          />
        )}
      </Card>
      <AddStaff open={adding} onClose={() => setAdding(false)} />
    </>
  );
}
