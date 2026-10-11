import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC = ['/login'];

/** Adds a per-request CSP nonce and sends visitors without a session to /login. */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const hasSession = req.cookies.has('sufra_session');
  if (!hasSession && !PUBLIC.some((p) => pathname.startsWith(p))) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  const nonce = btoa(crypto.randomUUID());
  const dev = process.env.NODE_ENV !== 'production';
  const ws = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4000';
  const wsOrigin = ws ? new URL(ws) : null;
  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    // Charts and Radix set inline style attributes; scripts stay nonce-locked.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self'`,
    `connect-src 'self'${wsOrigin ? ` ${wsOrigin.origin} ${wsOrigin.origin.replace(/^http/, 'ws')}` : ''}`,
    `media-src 'self' data:`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
  ].join('; ');

  const headers = new Headers(req.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set('Content-Security-Policy', csp);
  return res;
}

export const config = {
  matcher: [{ source: '/((?!api/|_next/static|_next/image|img/|favicon|sounds/).*)', missing: [{ type: 'header', key: 'next-router-prefetch' }] }],
};
