import '../globals.css';
import type { Metadata, Viewport } from 'next';
import { grotesk, plexMono } from '../fonts';
import { adminContext } from '@/lib/admin/context';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminContext();
  return {
    title: { default: t('admin.meta.title'), template: t('admin.meta.titleTemplate', { title: '%s' }) },
    robots: { index: false, follow: false, nocache: true },
  };
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

/** Root layout of the owner/admin area (separate from the public, localized site). */
export default async function AdminRootLayout({ children }: { children: React.ReactNode }) {
  const { locale } = await adminContext();
  return (
    <html lang={locale} className={`${grotesk.variable} ${plexMono.variable}`}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
