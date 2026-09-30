/**
 * RFC 9116 security.txt. Only served when a real contact address is
 * configured (LEGAL_EMAIL); no placeholder contact is ever published.
 */
import { env, siteUrl } from '@/lib/env';

export const dynamic = 'force-dynamic';

export function GET() {
  const email = env().LEGAL_EMAIL;
  if (!email) return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  const expires = new Date(Date.now() + 180 * 86_400_000).toISOString();
  const body = [
    `Contact: mailto:${email}`,
    `Expires: ${expires}`,
    'Preferred-Languages: nl, en',
    `Canonical: ${siteUrl('/.well-known/security.txt')}`,
    `Policy: ${siteUrl('/en/about')}`,
    '',
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=86400' } });
}
