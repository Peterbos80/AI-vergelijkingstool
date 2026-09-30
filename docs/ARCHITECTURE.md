# Architecture

AIToolsWijzer is one Next.js application plus one scheduler process, sharing one PostgreSQL database. There is no queue, cache server or search cluster. Everything that needs to scale later (rate limits, leases, caches) is built so it keeps working with several web instances.

Design background (in Dutch) lives in [`docs/strategy`](strategy): 06 technical architecture, 07 schema, 08 agents, 12 autonomous operations. This document describes the code as built.

```
            browser / crawler / API client
                         │
                  src/proxy.ts            locale redirect, per-request CSP nonce
                         │
      ┌──────────────────┴───────────────────┐
      │ Next.js App Router (Node runtime)    │
      │  src/app/[locale]/…  public pages    │──► getCatalog() ──► in-process cache
      │  src/app/admin/…     owner area      │        (reloaded when data_version changes)
      │  src/app/api/v1/…    public JSON API │
      │  src/app/go/[slug]   outbound click  │
      │  src/app/api/cron/agents             │──┐
      └──────────────────┬───────────────────┘  │  either the cron endpoint…
                         │                      │
                    PostgreSQL 16 ◄─────────────┤
                         ▲                      │  …or the long-running worker
      ┌──────────────────┴───────────────────┐  │
      │ scripts/worker.ts → runDueAgents()   │◄─┘
      │ 19 agents, safe fetcher, policy,     │──► official sites, documented APIs
      │ anomaly guard, action ledger, inbox  │    (robots.txt, throttled, SSRF-guarded)
      └──────────────────────────────────────┘
```

## Request flow (public pages)

1. **`src/proxy.ts`** redirects `/` and unprefixed paths to `/{locale}` (negotiated from `Accept-Language`, default `nl`). A configured locale that is not live yet (`ENABLED_LOCALES`) is rewritten to a 404 instead of showing half-translated pages. Every HTML response gets a fresh CSP nonce (`script-src 'nonce-…' 'strict-dynamic'`). Paths such as `/admin`, `/api`, `/go`, `/.well-known`, `/llms.txt` and `/sitemap.xml` are never localised.
2. **Server components** render everything. Pages are dynamic (server-rendered per request), so a build never needs a database. That matters for CI, Docker builds and previews.
3. **`getCatalog()`** (`src/lib/catalog`) returns the whole published catalog from a process-wide cache: taxonomy, tools with their current snapshot, plans, alternatives and statistics. At most every 15 s it re-reads the `data_version` setting. Any write that changes published data bumps that counter (`bumpDataVersion`), so every instance reloads within 15 s. Tool detail (facts with sources, price history, timeline) is cached per `(data_version, tool)`.
4. **The engine** (`src/lib/engine`) is pure functions over the catalog. It is deterministic and explainable, and it never imports monetisation code (see below).
5. **Analytics** are recorded server-side after the response is sent (`after()` in `src/lib/analytics/track.ts`). They are cookieless: the visitor id is a salted hash of IP and user agent whose salt rotates daily and is never stored. Bots, prefetches and requests with `x-aitw-synthetic` are skipped.

## Match: goal → stack

`src/lib/engine/match.ts` orchestrates:

1. **Lexical intent** (`intent.ts`): normalised, stemmed Dutch/English text is matched against task intent phrases, capability synonyms and tool names. Constraints such as budget, EU data, Dutch, no watermark, open source and platform are parsed from the text and the URL (`params.ts`). Every signal records the phrase that triggered it.
2. **Optional LLM intent** (`llm-intent.ts`), only when lexical confidence is below the gating threshold (`settings.llm.gatingThreshold`) and within the daily budget and a cap of 40 LLM matches per visitor per hour. The output is constrained to catalog ids and validated with Zod; unknown ids are dropped. 10% of eligible queries (stable per query per week) are a **holdout** answered lexically, so the value of the LLM can be measured. The opportunity agent tunes the threshold within owner-set bounds (two-proportion z-test).
3. **Clarification** (`clarify.ts`): at most one question per round and two rounds in total. Every question can be skipped, and answers live in the URL, so refresh, back, sharing and no-JS all work.
4. **Composition** (`compose.ts`): task steps → tools and plans, in three variants: *recommended* (balanced), *budget* (cheapest viable, free plans first) and *fewest* (greedy step coverage). Totals are kept per currency. A euro approximation uses the ECB rate of a named day, never a silent conversion.

Every query is logged in `match_queries` with a scrubbed text (e-mail addresses, URLs, phone-like numbers and IBANs replaced), engine, confidence and results, and deleted after 90 days.

## Provenance model

- A **fact** or **pricing plan** row carries: value, status (`verified`, `supported`, `community`, `unverified`), confidence 0–100, source(s), a verbatim evidence snippet, method, `observed_at`/`verified_at`, and a validity range (`valid_from`/`valid_to`). A change closes the current row and inserts a new one, so history is never overwritten.
- **Confidence** (`src/lib/provenance/confidence.ts`) is computed from evidence: best source type × anchoring (verbatim, fuzzy, none) × recency × method, plus corroboration from independent domains. A model's self-reported confidence is never an input. **Status** is clamped to what the evidence allows; VERIFIED requires an official source with a verbatim anchor and confidence ≥ 90.
- **Freshness** (`freshness.ts`) compares the last check with per-kind limits (`settings.freshness`; prices are fresh ≤ 14 days, aging ≤ 45, stale beyond). Stale data shows "information may be outdated", and unknown shows `—`, never 0.
- **Snapshot** (`snapshot.ts`): the `tools` row holds denormalised current values (entry price, flags, confidence, freshness, quality score, indexability) derived from current facts and plans. Reads use the snapshot; provenance stays in `facts` and `pricing_plans`.

## Agents

Nineteen agents (`src/agents/defs`) run on schedules in Europe/Amsterdam time. The runner (`src/agents/runner.ts`) takes a lease lock per agent in `agent_configs`, so overlapping runs and multiple workers are safe. It records a run, enforces a time budget, and gives each agent a context with its clock, the safe fetcher, an action logger and the inbox. Details are in [AGENTS.md](AGENTS.md).

Two ways to drive them, and they can be combined because of the leases:

- `npm run agents:worker`: a long-running loop that runs due agents every cycle and pings `HEARTBEAT_URL`;
- `POST /api/cron/agents` with `Authorization: Bearer $CRON_SECRET`, from any scheduler.

## Owner area

`/admin` is a separate, unlocalised area (nl/en per `settings.owner.locale`), served with `X-Robots-Tag: noindex` and `Cache-Control: no-store`. Server components read data. **Server actions** do every write, and each one checks the session and role (`requireAdmin('owner' | 'editor' | 'viewer')`) and writes an `audit_log` row. Pages: overview ("needs your attention"), inbox, operations (runs and the action ledger), weekly reports, automation (settings and the dependency register), tools, candidates, commerce, errors. The owner handbook is [OPERATIONS.md](OPERATIONS.md).

## Money and ranking independence

Affiliate links, sponsored placements and revenue live in their own tables and modules (`src/lib/monetization`, Admin → Commerce). The engine never reads them. `tests/integration/engine.test.ts` fails the build if any module under `src/lib/engine` imports monetisation code, directly or through other modules, or names a monetisation table. Placements render only in labelled slots, separate from recommendations. See [MONETIZATION.md](MONETIZATION.md).

## Internationalisation

- Message catalogs live in `src/i18n/messages/{nl,en,de,fr}.json` and use ICU plural/select. `getT(locale)` returns the translator. There are no hardcoded UI strings; `npm run i18n:check` fails on gaps in live locales.
- Content (taxonomy, tool texts) is stored per locale in `*_i18n` tables with a fallback chain. A page is only indexable in a locale that has its own text; fallback pages are `noindex`.
- `nl` and `en` are live. `de` and `fr` have every public UI string but stay dark until tool texts and taxonomy synonyms exist (checklist in [SEO.md](SEO.md)).

## Caching summary

| What | Where | Invalidated by |
| --- | --- | --- |
| Catalog (all published data) | process memory | `data_version` bump, checked every 15 s |
| Tool detail | process memory, per tool | `data_version` |
| Active affiliate links, placements | process memory | 15 s TTL + `data_version` |
| Public API responses | HTTP (`max-age=300`) | time |
| robots.txt per host (agents) | fetcher memory | 24 h |

## Key directories

| Path | Contents |
| --- | --- |
| `src/app/[locale]` | public pages, OG images (`opengraph-image.tsx`), server actions for forms |
| `src/app/admin` | owner area (login, panel pages, server actions) |
| `src/app/api` | `v1` public API, `cron/agents` |
| `src/agents` | runner, registry, schedule, policy, anomaly guard, action ledger, fetcher, agent definitions |
| `src/lib/engine` | intent, clarification, composition, ranking, comparison, Stack Doctor, search, golden set |
| `src/lib/provenance` | confidence, freshness, snapshot |
| `src/lib/catalog` | catalog loader and cache, tool detail |
| `src/lib/reports` | owner metrics (fixed SQL) and the weekly report |
| `src/lib/ops` | inbox/escalation, dependency register, error log |
| `src/lib/security`, `src/lib/auth` | rate limiting, secrets helpers, passwords, sessions |
| `src/lib/seed` | seed file schema, loader and sync |
| `data/` | the sourced seed dataset |
