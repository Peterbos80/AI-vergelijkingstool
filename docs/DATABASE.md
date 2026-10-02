# Database

PostgreSQL 16, accessed through Drizzle ORM. The schema is a single file: [`src/lib/db/schema.ts`](../src/lib/db/schema.ts). SQL migrations live in [`drizzle/`](../drizzle). Tests run the same migrations on PGlite (Postgres compiled to WebAssembly), so there is one schema and no mock layer.

The design reasoning (in Dutch) is in [`docs/strategy/07-database-schema.md`](strategy/07-database-schema.md).

## Rules the schema enforces

1. **Facts carry provenance.** Every fact and pricing plan has a status, a confidence, source(s), a verbatim evidence snippet, a method and observed/verified timestamps.
2. **History is never overwritten.** A new value closes the current row (`valid_to = now`) and inserts a new one. "Current" means `valid_to IS NULL` (partial indexes `facts_current_idx`, `pricing_plans_current_idx`). The price Time Machine reads the closed rows.
3. **Reads use a snapshot.** `tools` holds denormalised current values (entry price, flags, confidence, freshness, quality score, indexability). `recomputeToolSnapshot()` derives them from current facts and plans; nothing else writes them.
4. **Text is per locale.** Human-facing text lives in `*_i18n` tables keyed by `(id, locale)`, with a unique `(locale, slug)` for localised URLs. Change events store their title as a `{locale: text}` JSON object.
5. **Unknown is not zero.** Unknown prices and flags are `NULL`, never `0` or `false`.
6. **Money is separate.** Monetisation tables are never read by the ranking engine (tested; see [MONETIZATION.md](MONETIZATION.md)).
7. **Agents leave a trail.** Every automated change is an `agent_actions` row with old and new value, source, confidence and the policy decision, so it can be reviewed and, where supported, reverted.

## Tables

### A. Taxonomy (editorial, synced from `data/taxonomy.json`)

| Table | Purpose |
| --- | --- |
| `categories`, `category_i18n` | Top-level areas (video, audio, writing, …) |
| `capabilities`, `capability_i18n` | What a tool can do. `synonyms[]` per locale feed the lexical intent engine. |
| `tasks`, `task_i18n` | Goals people have. `intent_phrases[]` per locale. |
| `task_steps`, `task_step_i18n` | Ordered steps of a task, each needing one of `capability_ids[]`, required or optional |

### B. Tools, facts and signals

| Table | Purpose |
| --- | --- |
| `companies` | Vendor |
| `tools` | Identity, URLs (website, pricing, changelog, RSS, GitHub repo, YouTube channel), status, `published`, and the snapshot columns. Tool scout: `quarantine_until` (live but noindex and outside recommendations until promoted), `discovery` (how the scout found it: signals with links and dates, quarantine checks) and `logo` (a simple-icons logo matched on the tool's own domain: path, colour, source, license) |
| `tool_i18n` | Tagline, description, best for / not for / limitations. `content_status`: `editorial`, `ai_draft`, `machine_translated`, `reviewed` |
| `tool_capabilities` | Tool × capability, `primary` or `secondary` |
| `tool_relations` | Alternatives, integrations, built-on, complements. `source`: `editorial`, `computed` (capability overlap) or `fact` |
| `sources` | Every URL we cite or check: type, role (pricing, website, changelog, rss, …), fetch bookkeeping (`last_status`, `failure_count`, `failing_since`, robots result) |
| `source_snapshots` | Text snapshots of fetched pages with a content hash (only the newest five per source are kept) |
| `facts` | Key/value facts with provenance and validity range |
| `pricing_plans` | Plans with price in cents, currency, billing period, unit, monthly equivalent, provenance and validity range |
| `change_events` | Pulse: price changes, releases, status changes and so on, with source, confidence and a `dedupe_key` |
| `videos` | Official uploads and reviews (YouTube), with source (`rss`, `youtube_api`, `editorial`) and status |
| `social_signals` | Time series: GitHub stars and releases, Hacker News mentions |
| `fx_rates` | ECB reference rates per day, with source URL |

`sources.fetch_mode` is reserved for a JavaScript renderer that is not built. Every source is fetched over plain HTTP.

### C. Agents and operations

| Table | Purpose |
| --- | --- |
| `agent_configs` | Per agent: enabled, schedule, autonomy (`auto`, `queue_only`, `off`), next/last run, **lease** (`locked_until`), consecutive failures |
| `agent_runs` | One row per run: trigger, status, stats, summary, error |
| `agent_actions` | The action ledger (see rule 7). `reverted_at`/`reverted_by` when undone. |
| `review_items` | The owner inbox: kind, severity (P1–P3), category, payload, impact, **default action and deadline**, group key and count, `dedupe_key`, resolution |
| `pending_changes` | Confirmation by repetition: a measured value is only published after N identical observations at least M hours apart |
| `reports` | Weekly owner reports (one per period; data, summary per locale, e-mailed at) |
| `health_checks` | The dependency register: last status and last OK per dependency |
| `tool_candidates` | Tools found by discovery, one per domain, with signals (counts, dates, links; no texts or user names), the verification dossier and status. Published only through quarantine (`newToolMode = quarantine`), never directly. |
| `error_log` | Errors grouped by fingerprint per day, with a count |
| `llm_usage` | LLM calls, tokens, estimated cost and failures, per day and purpose |
| `settings` | Owner settings as one JSON document per key, merged onto safe defaults (`src/lib/settings/defaults.ts`). Also holds `data_version`. |
| `rate_limits` | Fixed-window counters shared by all instances |

### D. People, stacks and e-mail

| Table | Purpose |
| --- | --- |
| `admin_users` | Owner/editor/viewer accounts; scrypt password hashes |
| `admin_sessions` | Session id = SHA-256 of the cookie token (the token itself is never stored) |
| `audit_log` | Every admin write: who, what, which entity |
| `stacks`, `stack_items` | Saved and shared stacks. Editing needs a token whose hash is stored in `edit_token_hash`. |
| `subscribers` | E-mail addresses with double opt-in: consent text and moment, status, unsubscribe token |
| `watches` | A subscriber watching a stack or tool (removed on unsubscribe) |
| `email_outbox` | Every e-mail, queued → sent/failed, or `logged` when no provider is configured |
| `leads` | Advice requests (name, e-mail, company, message), with status and `last_contact_at` |

### E. Analytics and money

| Table | Purpose |
| --- | --- |
| `events` | Cookieless page views and interactions. `visitor_hash` rotates daily. |
| `match_queries` | Scrubbed Match queries with engine, confidence, LLM experiment arm and results |
| `affiliate_programs` | Programme terms we know, with a source and status. Research data, not a ranking input. |
| `affiliate_links` | Link templates with `{click_id}`, active flag and last check |
| `outbound_clicks` | `/go` clicks. The id is the click id and doubles as the affiliate sub-id. |
| `conversions` | Imported network conversions (CSV or manual), unique per `(programme, external_id)` |
| `revenue_entries` | Other revenue (sponsorship, newsletter, leads, data), entered by the owner |
| `placements` | Sponsored slots (`home_sponsored`, `newsletter`) with message, period and status |

## Retention

The quality agent applies retention every hour on its own clock (`src/agents/defs/quality.ts`). The privacy page promises these periods, and `tests/integration/agents.test.ts` checks them.

| Data | Kept for |
| --- | --- |
| `match_queries` | 90 days |
| `events` | 25 months |
| `leads` | 24 months after the last contact (`last_contact_at`, else creation) |
| `subscribers` that never confirmed | 30 days |
| `email_outbox` rows no longer queued | 90 days |
| `source_snapshots` | the newest 5 per source |
| `rate_limits` windows | 2 days |
| `pending_changes` not confirmed | expire after 30 days (the "may have changed" notice then ends) |
| `admin_sessions` | until expiry (7 days sliding); expired rows are removed at login |

## Migrations

```bash
# 1. change src/lib/db/schema.ts
npm run db:generate -- --name short_description   # writes drizzle/NNNN_short_description.sql
# 2. review the SQL; keep migrations additive where possible
npm run db:migrate                                 # applies pending migrations to DATABASE_URL
```

- Migrations are forward-only SQL files, applied in order and recorded in the `drizzle` schema.
- Run `db:migrate` before starting a new version of the web app or worker. Additive changes (new tables, nullable columns) are safe with the old code still running.
- `npm run db:reset` drops everything, migrates and re-seeds. It refuses to run with `NODE_ENV=production`.

## Seed pipeline

`data/` holds the sourced dataset: `taxonomy.json`, one file per tool in `data/tools/`, and change events in `data/events/`. Every price and fact in it names its sources and observation date.

```bash
npm run db:seed -- --dry     # validate only (the same check runs in CI: scripts/validate-seed.ts)
npm run db:seed              # sync
```

Sync semantics (`src/lib/seed/apply.ts`), safe to re-run:

- Taxonomy is upserted, because it is editorial.
- Tools are inserted only when their slug does not exist yet. After the first seed, agents own the data and its history, and a re-seed does not overwrite them.
- Events are inserted once (`dedupe_key`).
- Computed alternatives and all snapshots are recomputed.
- **Provenance is clamped.** A seed status can never be higher than the evidence allows. Seed data is never VERIFIED, because only our own fetcher anchoring a value verbatim on an official page earns that. Confidence is computed from the evidence, not copied from the file.

Tests never seed on the wall clock. The integration tests pass a fixed moment, and the e2e server uses `seedAsOf(bundle)`: the day after the dataset's newest observation. Freshness is stored at seed time, so test pages do not drift from "fresh" to "stale" as the calendar moves on.

## Backups

The application keeps no backups of its own. Use the database host's point-in-time recovery or daily snapshots, and test a restore before launch. The dependency register (Admin → Automation) lists `backups` as "not configured" on purpose: the app cannot observe your host's backups, so it stays there as a standing owner duty. See [DEPLOYMENT.md](DEPLOYMENT.md).
