/**
 * Our crawler's user agent names "+https://…/bot". That URL is not
 * locale-prefixed, so send visitors to the bot page in their language.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { negotiateLocale } from '@/i18n/config';

export function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = `/${negotiateLocale(request.headers.get('accept-language'))}/bot`;
  url.search = '';
  const res = NextResponse.redirect(url, 307);
  res.headers.set('Vary', 'Accept-Language');
  return res;
}
