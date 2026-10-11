'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, CheckCircle2, Globe, Lock, MapPin, ReceiptText, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useErrorToast } from '@/lib/errors';
import { useI18n, useSetPreference } from '@/lib/i18n';
import { LOCALE_COOKIE, NUMERALS_COOKIE } from '@/lib/prefs';
import { useSession } from '@/lib/session';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input, Select } from '@/components/ui/field';
import { IconTile } from '@/components/ui/stat-card';
import { ErrorState, Skeleton } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';

type Settings = {
  organization: { nameAr: string; nameEn: string; vatNumber: string | null; crNumber: string | null; serviceChargeBp: number; delayThresholdMin: number; plan: string };
  preferences: { locale: 'ar' | 'en'; numerals: 'arab' | 'latn'; mfaEnabled: boolean; email: string };
  branches: { id: string; nameAr: string; nameEn: string; address: string | null }[];
};

function Section({ icon, title, children, aside }: { icon: React.ReactNode; title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 text-md font-semibold">
          <IconTile tone="softAccent" className="size-9 rounded-md [&>svg]:size-4">
            {icon}
          </IconTile>
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </Card>
  );
}

function OrgForm({ s }: { s: Settings }) {
  const { t } = useI18n();
  const { can } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const fail = useErrorToast();
  const ro = !can('settings.manage');
  const o = s.organization;
  const [f, setF] = useState({ nameAr: o.nameAr, nameEn: o.nameEn, vatNumber: o.vatNumber ?? '', crNumber: o.crNumber ?? '', service: String(o.serviceChargeBp / 100), delay: String(o.delayThresholdMin) });
  const [touched, setTouched] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((v) => ({ ...v, [k]: e.target.value }));
  const err = {
    nameAr: !f.nameAr.trim() ? t('common.required') : undefined,
    nameEn: !f.nameEn.trim() ? t('common.required') : undefined,
    vatNumber: f.vatNumber && !/^3\d{13}3$/.test(f.vatNumber) ? t('settings.vatInvalid') : undefined,
    crNumber: f.crNumber && !/^\d{10}$/.test(f.crNumber) ? t('settings.crInvalid') : undefined,
    service: !(Number(f.service) >= 0 && Number(f.service) <= 30) ? '0 – 30' : undefined,
    delay: !(Number.isInteger(Number(f.delay)) && Number(f.delay) >= 5 && Number(f.delay) <= 120) ? '5 – 120' : undefined,
  };
  const e = (k: keyof typeof err) => (touched ? err[k] : undefined);
  const save = useMutation({
    mutationFn: () =>
      api('/settings/organization', {
        method: 'PATCH',
        json: { nameAr: f.nameAr.trim(), nameEn: f.nameEn.trim(), vatNumber: f.vatNumber, crNumber: f.crNumber, serviceChargeBp: Math.round(Number(f.service) * 100), delayThresholdMin: Number(f.delay) },
      }),
    onSuccess: () => {
      qc.invalidateQueries();
      toast('success', t('common.saved'));
    },
    onError: fail,
  });
  const submit = () => (Object.values(err).every((v) => !v) ? save.mutate() : setTouched(true));
  return (
    <Section icon={<Building2 />} title={t('settings.restaurant')} aside={<Badge tone="accent">{`${t('settings.plan')}: ${o.plan.toUpperCase()}`}</Badge>}>
      <form className="grid gap-4 sm:grid-cols-2" noValidate onSubmit={(ev) => (ev.preventDefault(), submit())}>
        <fieldset disabled={ro} className="contents">
          <Field label={t('settings.nameAr')} error={e('nameAr')}>
            {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!e('nameAr')} dir="rtl" value={f.nameAr} onChange={set('nameAr')} maxLength={120} />}
          </Field>
          <Field label={t('settings.nameEn')} error={e('nameEn')}>
            {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!e('nameEn')} dir="ltr" value={f.nameEn} onChange={set('nameEn')} maxLength={120} />}
          </Field>
          <Field label={t('settings.vat')} hint={t('settings.vatHelp')} error={e('vatNumber')}>
            {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!e('vatNumber')} dir="ltr" inputMode="numeric" maxLength={15} value={f.vatNumber} onChange={set('vatNumber')} placeholder="3XXXXXXXXXXXXX3" />}
          </Field>
          <Field label={t('settings.cr')} error={e('crNumber')}>
            {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!e('crNumber')} dir="ltr" inputMode="numeric" maxLength={10} value={f.crNumber} onChange={set('crNumber')} />}
          </Field>
          <Field label={t('settings.service')} hint={t('settings.serviceHelp')} error={e('service')}>
            {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!e('service')} dir="ltr" type="number" min={0} max={30} step="0.5" value={f.service} onChange={set('service')} />}
          </Field>
          <Field label={t('settings.delay')} error={e('delay')}>
            {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!e('delay')} dir="ltr" type="number" min={5} max={120} value={f.delay} onChange={set('delay')} />}
          </Field>
        </fieldset>
        <div className="flex items-center justify-between gap-3 sm:col-span-2">
          <p className="text-xs text-ink-muted">{ro ? t('settings.readOnly') : ''}</p>
          {ro ? null : (
            <Button type="submit" loading={save.isPending}>
              {t('common.save')}
            </Button>
          )}
        </div>
      </form>
    </Section>
  );
}

function Preferences({ s }: { s: Settings }) {
  const { t, locale, numerals } = useI18n();
  const setPref = useSetPreference();
  const fail = useErrorToast();
  const change = async (k: 'locale' | 'numerals', v: string) => {
    try {
      await api('/settings/preferences', { method: 'PATCH', json: { locale: k === 'locale' ? v : locale, numerals: k === 'numerals' ? v : numerals } });
      setPref(k === 'locale' ? LOCALE_COOKIE : NUMERALS_COOKIE, v);
    } catch (e) {
      fail(e);
    }
  };
  return (
    <Section icon={<Globe />} title={t('settings.prefs')}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('settings.language')}>
          {(id) => (
            <Select id={id} value={locale} onChange={(e) => change('locale', e.target.value)}>
              <option value="ar">العربية</option>
              <option value="en">English</option>
            </Select>
          )}
        </Field>
        <Field label={t('settings.numerals')}>
          {(id) => (
            <Select id={id} value={numerals} onChange={(e) => change('numerals', e.target.value)}>
              <option value="latn">{t('settings.latn')}</option>
              <option value="arab">{t('settings.arab')}</option>
            </Select>
          )}
        </Field>
      </div>
      <p className="mt-3 text-xs text-ink-muted" dir="ltr">
        {s.preferences.email}
      </p>
    </Section>
  );
}

function Security({ s }: { s: Settings }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const fail = useErrorToast();
  const [setup, setSetup] = useState<{ qrDataUrl: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState('');
  const [disabling, setDisabling] = useState(false);
  const on = s.preferences.mfaEnabled;
  useEffect(() => setCode(''), [setup, disabling]);
  const start = useMutation({ mutationFn: () => api<{ qrDataUrl: string; otpauthUrl: string }>('/auth/mfa/setup', { method: 'POST' }), onSuccess: setSetup, onError: fail });
  const confirm = useMutation({
    mutationFn: () => api(on ? '/auth/mfa/disable' : '/auth/mfa/enable', { method: 'POST', json: { code } }),
    onSuccess: () => {
      toast('success', on ? t('settings.mfaOff') : t('settings.mfaEnabled'));
      setSetup(null);
      setDisabling(false);
      qc.invalidateQueries({ queryKey: ['settings'] });
      qc.invalidateQueries({ queryKey: ['me'] });
    },
    onError: fail,
  });
  const codeOk = /^\d{6}$/.test(code);
  const codeField = (
    <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={(e) => (e.preventDefault(), codeOk && confirm.mutate())}>
      <Field label={t('login.mfaCode')}>
        {(id) => <Input id={id} className="w-40 text-center tracking-[0.3em]" dir="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus />}
      </Field>
      <Button type="submit" disabled={!codeOk} loading={confirm.isPending} variant={on ? 'danger' : 'primary'}>
        {on ? t('settings.mfaDisable') : t('common.confirm')}
      </Button>
      <Button type="button" variant="ghost" onClick={() => (setSetup(null), setDisabling(false))}>
        {t('common.cancel')}
      </Button>
    </form>
  );
  return (
    <Section icon={<ShieldCheck />} title={t('settings.security')} aside={<Badge tone={on ? 'success' : 'neutral'}>{on ? t('settings.mfaOn') : t('settings.mfaOff')}</Badge>}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{t('settings.mfa')}</p>
          <p className="mt-0.5 text-xs text-ink-muted">{on ? t('settings.mfaEnabled') : t('settings.mfaRecommended')}</p>
        </div>
        {on ? (
          !disabling ? (
            <Button variant="outline" onClick={() => setDisabling(true)}>
              {t('settings.mfaDisable')}
            </Button>
          ) : null
        ) : !setup ? (
          <Button onClick={() => start.mutate()} loading={start.isPending}>
            <Lock className="size-4" />
            {t('settings.mfaSetup')}
          </Button>
        ) : null}
      </div>
      {setup ? (
        <div className="mt-4 flex flex-wrap items-start gap-5 rounded-md border border-border p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={setup.qrDataUrl} alt={t('settings.mfaScan')} width={160} height={160} className="rounded-md border border-border" />
          <div className="min-w-0 flex-1">
            <p className="text-xs leading-5 text-ink-muted">{t('settings.mfaScan')}</p>
            {codeField}
          </div>
        </div>
      ) : null}
      {disabling ? codeField : null}
    </Section>
  );
}

export default function SettingsPage() {
  const { t, name } = useI18n();
  const q = useQuery({ queryKey: ['settings'], queryFn: () => api<Settings>('/settings') });
  const s = q.data;
  return (
    <>
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">{t('settings.title')}</h1>
        <p className="mt-0.5 text-sm text-ink-muted">{t('settings.subtitle')}</p>
      </div>
      {q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : !s ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Skeleton className="h-[420px] rounded-lg" />
          <Skeleton className="h-[420px] rounded-lg" />
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex min-w-0 flex-col gap-4">
            <OrgForm s={s} />
            <Security s={s} />
          </div>
          <div className="flex flex-col gap-4">
            <Preferences s={s} />
            <Section icon={<MapPin />} title={t('settings.branches')}>
              <ul className="divide-y divide-border">
                {s.branches.map((b) => (
                  <li key={b.id} className="py-2.5">
                    <p className="text-sm font-medium">{name(b)}</p>
                    {b.address ? <p className="mt-0.5 text-xs text-ink-muted">{b.address}</p> : null}
                  </li>
                ))}
              </ul>
            </Section>
            <Section icon={<ReceiptText />} title={t('settings.zatca')}>
              <p className="flex gap-2 text-xs leading-5 text-ink-muted">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-warning" />
                {t('settings.zatcaBody')}
              </p>
            </Section>
          </div>
        </div>
      )}
    </>
  );
}
