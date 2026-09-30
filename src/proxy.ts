/**
 * Request proxy (Next.js 16 "proxy", formerly middleware):
 *  1. Locale routing: "/" and un-prefixed public paths redirect to /{locale}.
 *  2. A per-request CSP nonce for every HTML response (strict-dynamic).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { enabledLocales, isLocale, negotiateLocale } from '@/i18n/config';

/** Paths that are never locale-prefixed. */
const UNLOCALIZED = /^\/(admin|go|api|data|og|bot|_next|\.well-known|llms\.txt|robots\.txt|sitemap\.xml|favicon\.ico|icon|apple-icon|manifest\.webmanifest)(\/|$)/;

function buildCsp(nonce: string, isDev: boolean): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    // Dev tooling injects un-nonced styles; production styles are external or nonced.
    isDev ? "style-src 'self' 'unsafe-inline'" : `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob: https://i.ytimg.com",
    "font-src 'self'",
    `connect-src 'self'${isDev ? ' ws: wss:' : ''}`,
    'frame-src https://www.youtube-nocookie.com',
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  // Only upgrade when the site is served over HTTPS (local `next start` is plain HTTP).
  if (!isDev && (process.env.SITE_URL ?? '').startsWith('https://')) directives.push('upgrade-insecure-requests');
  return directives.join('; ');
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  let rewriteTo: string | null = null;

  if (!UNLOCALIZED.test(pathname)) {
    const first = pathname.split('/')[1] ?? '';
    if (!isLocale(first)) {
      const locale = negotiateLocale(request.headers.get('accept-language'));
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;
      url.search = search;
      const res = NextResponse.redirect(url, 307);
      res.headers.set('Vary', 'Accept-Language');
      return res;
    }
    // Configured but not live yet: serve the 404 (no half-translated pages).
    if (!enabledLocales().includes(first)) rewriteTo = '/404-locale-not-live';
  }

  const isDev = process.env.NODE_ENV === 'development';
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce, isDev);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('x-pathname', pathname);
  requestHeaders.set('Content-Security-Policy', csp);
  const init = { request: { headers: requestHeaders } };
  const response = rewriteTo
    ? NextResponse.rewrite(new URL(rewriteTo, request.url), init)
    : NextResponse.next(init);
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|api/|go/|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|woff2?|txt|xml|webmanifest)$).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
