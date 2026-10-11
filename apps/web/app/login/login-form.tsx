'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Eye, EyeOff, Languages, ShieldCheck } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { LOCALE_COOKIE, useI18n, useSetPreference } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { LogoMark } from '@/components/ui/logo';

const DEMO = [
  ['manager@sufra.demo', 'manager'],
  ['owner@sufra.demo', 'owner'],
  ['cashier@sufra.demo', 'cashier'],
  ['chef@sufra.demo', 'chef'],
  ['accountant@sufra.demo', 'accountant'],
  ['stock@sufra.demo', 'inventory_clerk'],
] as const;

function safeNext(next: string | null) {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/login') ? next : '/dashboard';
}

export function LoginForm({ demo }: { demo: boolean }) {
  const { t, locale } = useI18n();
  const setPref = useSetPreference();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fail = (e: unknown) => {
    const code = e instanceof ApiError ? e.code : '';
    const status = e instanceof ApiError ? e.status : 0;
    setError(
      status === 429 ? t('login.throttled') : code === 'account_locked' ? t('login.locked') : code === 'mfa_invalid' ? t('login.mfaInvalid') : status === 401 || status === 400 ? t('login.invalid') : t('errors.generic'),
    );
  };
  const done = () => window.location.assign(safeNext(params.get('next')));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await api<{ mfaRequired: boolean; challenge?: string }>('/auth/login', { method: 'POST', json: { email, password } });
      if (r.mfaRequired && r.challenge) setChallenge(r.challenge);
      else done();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api('/auth/mfa', { method: 'POST', json: { challenge, code } });
      done();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(440px,1fr)_1.15fr]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <LogoMark className="size-10" />
            <span className="text-2xl font-bold tracking-tight">{t('brand.name')}</span>
          </div>
          <button onClick={() => setPref(LOCALE_COOKIE, locale === 'ar' ? 'en' : 'ar')} className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-ink-muted hover:bg-surface-muted hover:text-ink">
            <Languages className="size-4" />
            {t('topbar.language')}
          </button>
        </div>

        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">
          {!challenge ? (
            <form onSubmit={submit} noValidate className="flex flex-col gap-5">
              <div>
                <h1 className="text-2xl font-bold">{t('login.title')}</h1>
                <p className="mt-2 text-sm text-ink-muted">{t('login.subtitle')}</p>
              </div>
              {error ? (
                <p role="alert" className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2.5 text-sm text-danger">
                  {error}
                </p>
              ) : null}
              <Field label={t('login.email')}>
                {(id) => <Input id={id} type="email" autoComplete="username" inputMode="email" dir="ltr" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />}
              </Field>
              <Field label={t('login.password')}>
                {(id) => (
                  <div className="relative">
                    <Input id={id} type={show ? 'text' : 'password'} autoComplete="current-password" required minLength={8} dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 pe-11" />
                    <button type="button" onClick={() => setShow((s) => !s)} className="absolute end-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded text-ink-muted hover:text-ink" aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>
                      {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                )}
              </Field>
              <Button type="submit" size="lg" loading={busy} disabled={!email || password.length < 8}>
                {busy ? t('login.submitting') : t('login.submit')}
              </Button>
            </form>
          ) : (
            <form onSubmit={verify} className="flex flex-col gap-5">
              <div className="grid size-12 place-items-center rounded-full bg-accent-soft text-accent">
                <ShieldCheck className="size-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{t('login.mfaTitle')}</h1>
                <p className="mt-2 text-sm text-ink-muted">{t('login.mfaBody')}</p>
              </div>
              {error ? (
                <p role="alert" className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2.5 text-sm text-danger">
                  {error}
                </p>
              ) : null}
              <Field label={t('login.mfaCode')}>
                {(id) => (
                  <Input
                    id={id}
                    autoFocus
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="\d{6}"
                    maxLength={6}
                    dir="ltr"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    className="h-12 text-center text-xl tracking-[0.5em] tabular"
                  />
                )}
              </Field>
              <Button type="submit" size="lg" loading={busy} disabled={code.length !== 6}>
                {t('login.verify')}
              </Button>
              <Button variant="ghost" onClick={() => (setChallenge(null), setCode(''), setError(null))}>
                {t('login.back')}
              </Button>
            </form>
          )}

          {demo && !challenge ? (
            <div className="mt-8 rounded-lg border border-dashed border-border bg-surface p-4">
              <p className="text-xs font-semibold">{t('login.demo')}</p>
              <p className="mt-1 text-xs text-ink-muted">
                {t('login.demoHint')} <code dir="ltr" className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-ink">Sufra@Demo2026</code>
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {DEMO.map(([mail, role]) => (
                  <button
                    key={mail}
                    type="button"
                    onClick={() => {
                      setEmail(mail);
                      setPassword('Sufra@Demo2026');
                    }}
                    className="rounded border border-border px-2.5 py-1 text-xs hover:border-accent hover:text-accent"
                  >
                    {t(`roles.${role}`)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <p className="text-center text-2xs text-ink-subtle">© {new Date().getFullYear()} {t('brand.name')}</p>
      </div>

      <div className="relative hidden overflow-hidden bg-sidebar lg:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/img/scenes/hero.svg" alt="" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute inset-x-12 bottom-12 text-white">
          <p className="text-3xl font-bold leading-snug">{t('orders.promoTitle')}</p>
          <p className="mt-2 text-lg text-white/80">{t('orders.promoBody')}</p>
        </div>
      </div>
    </div>
  );
}
