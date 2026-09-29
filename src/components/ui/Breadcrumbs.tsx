import Link from 'next/link';
import type { Translator } from '@/i18n/format';
import { siteUrl } from '@/lib/env';
import { JsonLd } from './JsonLd';

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items, t }: { items: Crumb[]; t: Translator }) {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.label,
      ...(c.href ? { item: siteUrl(c.href) } : {}),
    })),
  };
  return (
    <nav aria-label={t('a11y.breadcrumbs')} className="text-sm text-ink-3">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((c, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden="true">/</span>}
            {c.href && i < items.length - 1 ? (
              <Link href={c.href} className="no-underline hover:text-ink hover:underline">
                {c.label}
              </Link>
            ) : (
              <span aria-current={i === items.length - 1 ? 'page' : undefined}>{c.label}</span>
            )}
          </li>
        ))}
      </ol>
      <JsonLd data={ld} />
    </nav>
  );
}
