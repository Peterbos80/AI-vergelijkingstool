import type { Metadata } from 'next';
import { headers } from 'next/headers';
import type { Locale } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { getCatalog } from '@/lib/catalog';
import { getDb } from '@/lib/db/client';
import { emailEnabled, staticSite } from '@/lib/env';
import { loadSettings } from '@/lib/settings';
import { runMatch } from '@/lib/engine/match';
import { parseMatchParams } from '@/lib/engine/params';
import { affiliateToolIds } from '@/lib/monetization/affiliate';
import { href } from '@/lib/routes';
import { uuid } from '@/lib/ids';
import { nowDate, nowMs } from '@/lib/time';
import { track } from '@/lib/analytics/track';
import { logMatch } from '@/lib/analytics/match-log';
import { clientIp, visitorHash } from '@/lib/analytics/visitor';
import { rateLimit } from '@/lib/security/rate-limit';
import { MatchView } from '@/components/match/MatchView';
import { StaticQueryPage } from '@/components/static/StaticQueryPage';
import { saveStackAction } from './actions';

/** LLM-assisted Matches per visitor per hour; beyond this the (free) lexical engine answers. */
const LLM_MATCHES_PER_HOUR = 40;

export async function generateMetadata({ params, searchParams }: PageProps<'/[locale]/match'>): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const p = parseMatchParams(await searchParams);
  const t = getT(locale);
  return {
    title: p.q ? t('match.metaTitle', { goal: p.q.slice(0, 60) }) : t('match.metaTitleEmpty'),
    robots: { index: false, follow: true },
    alternates: { canonical: href.home(locale) },
  };
}

export default async function MatchPage({ params, searchParams }: PageProps<'/[locale]/match'>) {
  const { locale } = (await params) as { locale: Locale };
  const sp = await searchParams;
  const p = parseMatchParams(sp);
  const t = getT(locale);
  const catalog = await getCatalog();

  if (staticSite()) {
    // Free edition: the question is answered in the browser (lexical engine, nothing is sent or stored).
    return (
      <>
        <noscript>
          <p className="container-page notice notice-warning mt-6">{t('static.needsJs')}</p>
        </noscript>
        <StaticQueryPage kind="match" locale={locale} labels={{ loading: t('static.loading'), failed: t('static.failed') }}>
          <MatchView locale={locale} t={t} p={p} out={null} catalog={catalog} affiliates={new Set()} receiptNo="" date={nowDate()} />
        </StaticQueryPage>
      </>
    );
  }

  await track({ path: href.match(locale), pageType: 'match', locale, searchParams: sp });
  if (!p.q && !p.taskOverride) {
    return <MatchView locale={locale} t={t} p={p} out={null} catalog={catalog} affiliates={new Set()} receiptNo="" date={nowDate()} />;
  }

  const started = nowMs();
  const settings = await loadSettings(getDb());
  // The LLM is a shared, budgeted resource: cap it per visitor so one client cannot exhaust the daily budget.
  const h = await headers();
  const llmAllowed = await rateLimit(`llm:${visitorHash(clientIp(h), h.get('user-agent') ?? '')}`, LLM_MATCHES_PER_HOUR, 3600);
  const out = await runMatch(
    {
      query: p.q,
      locale,
      explicit: p.explicit,
      approach: p.approach,
      taskOverride: p.taskOverride,
      budget: p.budget,
      skip: p.skip,
      answered: p.answered,
      gatingThreshold: settings.llm.gatingThreshold,
      allowLlm: llmAllowed,
    },
    catalog,
  );
  const mqId = uuid();
  const result = out.variants?.[p.variant] ?? null;
  await logMatch({
    id: mqId,
    locale,
    intent: out.intent,
    resultToolIds: result ? result.lines.map((l) => l.toolId) : [],
    clarified: p.answered > 0,
    latencyMs: nowMs() - started,
    llmEligible: out.llmEligible,
    llmHoldout: out.llmHoldout,
  });
  return (
    <MatchView
      locale={locale}
      t={t}
      p={p}
      out={out}
      catalog={catalog}
      affiliates={await affiliateToolIds()}
      receiptNo={mqId.slice(0, 4).toUpperCase()}
      date={nowDate()}
      mq={mqId}
      saveAction={saveStackAction}
      watchAvailable={emailEnabled()}
    />
  );
}
