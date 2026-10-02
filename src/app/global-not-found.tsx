import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getT } from '@/i18n/server';
import { grotesk, plexMono } from './fonts';

export const metadata: Metadata = {
  title: '404 · AIToolsWijzer',
  robots: { index: false },
};

/** Unmatched URLs outside any root layout (e.g. disabled locales). */
export default function GlobalNotFound() {
  // Bilingual: there is no locale outside the [locale] routes. The words come from the messages (errors.*).
  const nl = getT('nl');
  const en = getT('en');
  return (
    <html lang="en" className={`${grotesk.variable} ${plexMono.variable}`}>
      <body className="min-h-screen">
        <main className="container-page py-24">
          <p className="eyebrow">404</p>
          <h1 className="mt-2 text-3xl">
            {nl('errors.notFoundTitle')} · {en('errors.notFoundTitle')}
          </h1>
          <p className="mt-3 text-ink-2">
            <Link href="/nl">{nl('errors.notFoundCta')} (NL)</Link> · <Link href="/en">{en('errors.notFoundCta')} (EN)</Link>
          </p>
        </main>
      </body>
    </html>
  );
}
