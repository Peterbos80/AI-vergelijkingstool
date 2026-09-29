import Link from 'next/link';
import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { inArray } from 'drizzle-orm';
import type { Locale } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { formatDate } from '@/i18n/formatters';
import { getDb } from '@/lib/db/client';
import { stacks } from '@/lib/db/schema';
import { MY_STACKS_COOKIE, parseMyStacks } from '@/lib/stacks/store';
import { href } from '@/lib/routes';
import { track } from '@/lib/analytics/track';

export async function generateMetadata({ params }: PageProps<'/[locale]/my-stack'>): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return { title: getT(locale)('myStack.metaTitle'), robots: { index: false, follow: false } };
}

export default async function MyStackPage({ params }: PageProps<'/[locale]/my-stack'>) {
  const { locale } = (await params) as { locale: Locale };
  const t = getT(locale);
  await track({ path: href.myStack(locale), pageType: 'my_stack', locale });
  const mine = parseMyStacks((await cookies()).get(MY_STACKS_COOKIE)?.value);
  const rows = mine.length
    ? await getDb()
        .select({ publicId: stacks.publicId, title: stacks.title, createdAt: stacks.createdAt })
        .from(stacks)
        .where(inArray(stacks.publicId, mine.map((m) => m.id)))
    : [];
  rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return (
    <div className="container-page py-10">
      <h1 className="text-3xl">{t('myStack.title')}</h1>
      <p className="mt-2 max-w-2xl text-ink-2">{t('myStack.intro')}</p>
      {rows.length === 0 ? (
        <div className="card mt-8 p-6">
          <p>{t('myStack.empty')}</p>
          <Link href={href.home(locale)} className="btn mt-4">
            {t('myStack.emptyCta')}
          </Link>
        </div>
      ) : (
        <ul className="card mt-8 divide-y divide-line">
          {rows.map((r) => (
            <li key={r.publicId} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3">
              <Link href={href.stack(locale, r.publicId)} className="font-semibold">
                {r.title}
              </Link>
              <span className="text-xs text-ink-3">{t('myStack.saved', { date: formatDate(r.createdAt, locale) })}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
