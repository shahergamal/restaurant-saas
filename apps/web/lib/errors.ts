'use client';

import { ApiError } from './api';
import { useI18n } from './i18n';
import { useToast } from '@/components/ui/toast';

/** Turns an API error into a sentence the user can act on (never a raw code). */
export function useErrorToast() {
  const { t, messages } = useI18n();
  const toast = useToast();
  return (e: unknown) => {
    const code = e instanceof ApiError ? e.code : '';
    const known = code && code in messages.errors;
    const forbidden = e instanceof ApiError && e.status === 403 && !known;
    toast('error', known ? t(`errors.${code}`) : forbidden ? t('errors.permission_denied') : t('errors.generic'));
  };
}
