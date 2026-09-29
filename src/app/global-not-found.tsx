import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { grotesk, plexMono } from './fonts';

export const metadata: Metadata = {
  title: '404 · AIToolsWijzer',
  robots: { index: false },
};

/** Unmatched URLs outside any root layout (e.g. disabled locales). */
export default function GlobalNotFound() {
  return (
    <html lang="en" className={`${grotesk.variable} ${plexMono.variable}`}>
      <body className="min-h-screen">
        <main className="container-page py-24">
          <p className="eyebrow">404</p>
          <h1 className="mt-2 text-3xl">Deze pagina heeft geen bonnetje. · This page has no receipt.</h1>
          <p className="mt-3 text-ink-2">
            <Link href="/nl">Naar de start (NL)</Link> · <Link href="/en">Go to the start (EN)</Link>
          </p>
        </main>
      </body>
    </html>
  );
}
