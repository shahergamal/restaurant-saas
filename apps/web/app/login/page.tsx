import { Suspense } from 'react';
import { LoginForm } from './login-form';

export const metadata = { title: 'تسجيل الدخول · Sign in' };

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm demo={process.env.NODE_ENV !== 'production' || process.env.SHOW_DEMO_ACCOUNTS === '1'} />
    </Suspense>
  );
}
