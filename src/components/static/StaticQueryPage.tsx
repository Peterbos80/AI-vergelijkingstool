'use client';
/**
 * Static edition (GitHub Pages): pages whose content depends on the URL query
 * (Match, Stack Doctor, the explorer's filters, Compare) are computed in the
 * browser with the same pure engine and views as the server pages. Without a
 * query, the server-rendered content (children) stays as it is.
 */
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { LOCALE_META, type Locale } from '@/i18n/config';
import { createTranslator, type MessageTree } from '@/i18n/format';
import type { Catalog } from '@/lib/catalog/types';
import { catalogFromWire, reviveDates, type CatalogWire } from '@/lib/catalog/wire';
import { lexicalMatch } from '@/lib/engine/match-core';
import { parseMatchParams } from '@/lib/engine/params';
import { MatchView } from '@/components/match/MatchView';
import { DoctorView } from '@/components/doctor/DoctorView';
import { ExplorerView } from '@/components/explorer/ExplorerView';
import { ComparePicker } from '@/components/data/ComparePicker';

export type QueryPageKind = 'match' | 'doctor' | 'explorer' | 'compare';

interface SiteData {
  catalog: Catalog;
  messages: MessageTree;
  affiliates: Set<string>;
}

/** Shape of /data/<locale>.json (src/app/data/[file]/route.ts). */
export interface SiteDataWire {
  catalog: CatalogWire;
  messages: MessageTree;
  affiliates: string[];
}

const loaded = new Map<string, Promise<SiteData>>();

function loadSiteData(locale: string): Promise<SiteData> {
  let p = loaded.get(locale);
  if (!p) {
    p = fetch(`/data/${locale}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`data ${r.status}`);
        return r.text();
      })
      .then((text) => {
        const w = JSON.parse(text, reviveDates) as SiteDataWire;
        return { catalog: catalogFromWire(w.catalog), messages: w.messages, affiliates: new Set(w.affiliates) };
      });
    p.catch(() => loaded.delete(locale));
    loaded.set(locale, p);
  }
  return p;
}

type SP = Record<string, string | string[]>;

function searchRecord(search: string): SP {
  const out: SP = {};
  for (const [k, v] of new URLSearchParams(search)) {
    const prev = out[k];
    out[k] = prev === undefined ? v : Array.isArray(prev) ? [...prev, v] : [prev, v];
  }
  return out;
}

/** Query parameters that only carry campaign attribution do not change the page. */
const IGNORED = /^utm_/;

interface Ready {
  data: SiteData;
  url: string;
  receiptNo: string;
  now: Date;
}

const noSubscribe = () => () => undefined;

export function StaticQueryPage({
  kind,
  locale,
  labels,
  children,
}: {
  kind: QueryPageKind;
  locale: Locale;
  labels: { loading: string; failed: string };
  children: ReactNode;
}) {
  // The query is only known in the browser; the server snapshot is "no query".
  const search = useSyncExternalStore(noSubscribe, () => window.location.search, () => '');
  const sp = useMemo(() => searchRecord(search), [search]);
  const hasQuery = Object.keys(sp).some((k) => !IGNORED.test(k));
  const [ready, setReady] = useState<Ready | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!hasQuery) return;
    let alive = true;
    loadSiteData(locale)
      .then((data) => {
        if (!alive) return;
        const receiptNo = Math.floor(Math.random() * 0xffff)
          .toString(16)
          .padStart(4, '0')
          .toUpperCase();
        setReady({ data, url: window.location.href, receiptNo, now: new Date() });
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [hasQuery, locale]);

  if (!hasQuery) return <>{children}</>;
  if (failed) {
    return (
      <div className="container-page py-12">
        <p role="alert" className="notice notice-warning">
          {labels.failed}
        </p>
      </div>
    );
  }
  if (!ready) {
    return (
      <div className="container-page py-12" aria-busy="true">
        <p role="status" className="text-ink-3">
          {labels.loading}
        </p>
      </div>
    );
  }

  const { data } = ready;
  const t = createTranslator(locale, LOCALE_META[locale].intl, data.messages);
  switch (kind) {
    case 'match': {
      const p = parseMatchParams(sp);
      const out =
        p.q || p.taskOverride
          ? lexicalMatch(
              { query: p.q, locale, explicit: p.explicit, approach: p.approach, taskOverride: p.taskOverride, budget: p.budget, skip: p.skip, answered: p.answered },
              data.catalog,
            )
          : null;
      return (
        <MatchView
          locale={locale}
          t={t}
          p={p}
          out={out}
          catalog={data.catalog}
          affiliates={data.affiliates}
          receiptNo={ready.receiptNo}
          date={ready.now}
          shareUrl={p.q ? ready.url : undefined}
        />
      );
    }
    case 'doctor':
      return <DoctorView locale={locale} t={t} catalog={data.catalog} sp={sp} />;
    case 'explorer':
      return <ExplorerView locale={locale} t={t} catalog={data.catalog} sp={sp} />;
    case 'compare':
      return <ComparePicker locale={locale} t={t} catalog={data.catalog} sp={sp} affiliates={data.affiliates} />;
  }
}
