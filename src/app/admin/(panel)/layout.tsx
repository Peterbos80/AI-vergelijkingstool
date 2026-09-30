import Link from 'next/link';
import { headers } from 'next/headers';
import { sql } from 'drizzle-orm';
import { adminContext } from '@/lib/admin/context';
import { requireAdmin } from '@/lib/auth/session';
import { queryRows } from '@/lib/db/sql';
import { Logo } from '@/components/site/Logo';
import { logoutAction } from './actions';

const NAV = [
  { href: '/admin', key: 'overview' },
  { href: '/admin/inbox', key: 'inbox' },
  { href: '/admin/reports', key: 'reports' },
  { href: '/admin/operations', key: 'operations' },
  { href: '/admin/automation', key: 'automation' },
  { href: '/admin/tools', key: 'tools' },
  { href: '/admin/candidates', key: 'candidates' },
  { href: '/admin/commerce', key: 'commerce' },
  { href: '/admin/errors', key: 'errors' },
] as const;

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const { t, db, locale } = await adminContext();
  const pathname = (await headers()).get('x-pathname') ?? '/admin';
  const [c] = await queryRows<{ n: string }>(
    db,
    sql`SELECT count(*)::text AS n FROM review_items WHERE status = 'pending' AND severity IN ('p1', 'p2') AND kind <> 'opportunity' AND (snoozed_until IS NULL OR snoozed_until <= now())`,
  );
  const attention = Number(c?.n ?? 0);
  const active = (href: string) => (href === '/admin' ? pathname === '/admin' : pathname.startsWith(href));
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[15rem_1fr]">
      <a href="#main" className="skip-link">
        {t('a11y.skipToContent')}
      </a>
      <aside className="border-b border-line bg-paper-2 lg:sticky lg:top-0 lg:h-screen lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between gap-3 px-4 py-3 lg:flex-col lg:items-stretch lg:py-5">
          <Link href="/admin" className="flex items-center gap-2 font-bold no-underline">
            <Logo />
            <span>{t('meta.siteName')}</span>
          </Link>
          <span className="eyebrow hidden lg:block">{t('admin.meta.title')}</span>
        </div>
        <nav aria-label={t('admin.nav.menu')} className="overflow-x-auto px-2 pb-2 lg:px-3">
          <ul className="flex gap-1 lg:flex-col">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  aria-current={active(n.href) ? 'page' : undefined}
                  className={`flex items-center justify-between gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-sm whitespace-nowrap no-underline ${active(n.href) ? 'bg-ink text-paper' : 'text-ink-2 hover:bg-card'}`}
                >
                  <span>{t(`admin.nav.${n.key}`)}</span>
                  {n.key === 'inbox' && attention > 0 && (
                    <span className="rounded-full bg-signal px-1.5 text-xs font-bold text-white tabular" aria-label={t('admin.overview.attentionCount', { count: attention })}>
                      {attention}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="hidden border-t border-line px-4 py-4 text-xs text-ink-3 lg:block">
          <div className="truncate" title={user.email}>
            {user.email}
          </div>
          <div className="mt-1 mono">{user.role}</div>
          <div className="mt-3 flex flex-col gap-2">
            <Link href={`/${locale}`} prefetch={false} className="underline">
              {t('admin.nav.site')}
            </Link>
            <form action={logoutAction}>
              <button type="submit" className="underline">
                {t('admin.nav.logout')}
              </button>
            </form>
          </div>
        </div>
      </aside>
      <main id="main" tabIndex={-1} className="min-w-0 p-4 outline-none md:p-8">
        {children}
        <form action={logoutAction} className="mt-10 text-xs text-ink-3 lg:hidden">
          <button type="submit" className="underline">
            {t('admin.nav.logout')} ({user.email})
          </button>
        </form>
      </main>
    </div>
  );
}
