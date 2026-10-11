import '@fontsource-variable/inter';
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/500.css';
import '@fontsource/ibm-plex-sans-arabic/600.css';
import '@fontsource/ibm-plex-sans-arabic/700.css';
import './globals.css';
import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { I18nProvider } from '@/lib/i18n';
import { LOCALE_COOKIE, NUMERALS_COOKIE, type Numerals } from '@/lib/prefs';
import { QueryProvider } from '@/lib/query';
import { ToastProvider } from '@/components/ui/toast';
import type { Locale } from '@/lib/dict';

export const metadata: Metadata = {
  title: { default: 'قِدر · Qidr', template: '%s · Qidr' },
  description: 'Restaurant operations: orders, tables, kitchen, inventory and real food cost.',
  icons: { icon: '/img/logo.svg' },
};
export const viewport: Viewport = { themeColor: '#191919', width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const locale: Locale = jar.get(LOCALE_COOKIE)?.value === 'en' ? 'en' : 'ar';
  const numerals: Numerals = jar.get(NUMERALS_COOKIE)?.value === 'arab' ? 'arab' : 'latn';
  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <body className="min-h-screen font-sans text-base text-ink antialiased">
        <I18nProvider locale={locale} numerals={numerals}>
          <QueryProvider>
            <ToastProvider>{children}</ToastProvider>
          </QueryProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
