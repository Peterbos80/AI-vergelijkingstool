# AIToolsWijzer

**AI tools, with receipts.** A decision platform that answers one question: *"I want to do something — which AI solution should I use?"* You describe a goal and get a reasoned stack of AI tools: which tool for each step, why, what it costs, and the source, date and evidence status behind every price and fact.

> **In het kort (NL).** AIToolsWijzer is geen toolgids maar een beslisplatform: van doel naar een onderbouwde AI-stack, met bronnen, versheid en alternatieven. Autonome agents houden prijzen en status actueel. De eigenaar is uitzonderingsbehandelaar, geen operator: het systeem handelt routinewerk zelf af en legt alleen echte beslissingen voor. De strategische documenten staan in het Nederlands in [`docs/strategy`](docs/strategy). De developerdocumentatie hieronder is Engels.

## What it does

| Feature | What it gives you |
| --- | --- |
| **Match** | Plain-language goal → task, steps and capabilities → a stack in three variants (recommended, cheapest, fewest tools). It asks at most two clarification questions. |
| **Receipts** | Every price and fact carries a status (VERIFIED, SUPPORTED, COMMUNITY, UNVERIFIED), a confidence score, a date and sources. Outdated data is labelled as possibly outdated. |
| **Tool pages** | Pricing with history ("Time Machine"), an EU lens, alternatives, Fair Fights, videos and a timeline. |
| **Compare / Fair Fight** | Side-by-side comparison with no overall winner, only "choose X if you…". |
| **Stack Doctor** | Finds overlap, unnecessary cost, risks and cheaper or consolidating alternatives in the stack you already use. |
| **Pulse** | Real changes detected by agents: price moves, plans, shutdowns, releases. |
| **AI news** | Every hour, headlines about AI from media feeds and YouTube channels (outlet, date, link; never the article text), with pages per expert such as Geoffrey Hinton or Roman Yampolskiy. |
| **For beginners** | A step-by-step finder (`/start`), a plain-language guide for every task, six "AI for beginners" guides and a glossary. A site-wide Basis / Advanced switch shows beginner steps or technical details. |
| **My stack / Watch** | Save and share stacks. With e-mail configured, you get notified when something in a stack changes. |
| **Autonomous operations** | 20 agents verify prices on official pages, detect changes, collect AI news, find new tools, check links and report weekly. The owner only sees exceptions. |
| **Owner dashboard** | Opens with "Needs your attention" (default: *nothing to do*), what the system did itself, KPIs with their source, and system health. |
| **Public data API** | Read-only JSON with status, confidence and dates, plus `/llms.txt`. |

**Principles, enforced in code and tests:**

- Money never changes the order. The engine cannot import monetisation code, and a test enforces this.
- Nothing fake. A value without a sourced record is left out or shown as a dash, never as 0 or a guess. There are no dummy reviews, no invented metrics and no "coming soon" features.
- External content is untrusted data. It passes through an SSRF-guarded fetcher that honours robots.txt, and is quoted, never executed.

## Stack

- Next.js 16 (App Router, `proxy.ts`), React 19, TypeScript 6, Tailwind CSS 4.
- PostgreSQL 16 via Drizzle ORM. PGlite is used for in-process tests.
- Zod 4, Vitest 5 and Playwright.
- Optional: Claude (Anthropic API) for intent understanding, extraction and drafts. It is always budgeted and gated, and a deterministic fallback exists for every use.

## Hosting

Two editions of the same code ([DEPLOYMENT.md](docs/DEPLOYMENT.md)):

- **Free edition**: GitHub Pages serves the site; GitHub Actions runs the agents every hour, keeps their database on the `ops-state` branch, and turns the owner inbox and weekly report into GitHub issues. Match and Stack Doctor run in the browser. Costs nothing for a public repository.
- **Full platform**: a Node host plus PostgreSQL, with the admin area, the LLM, e-mail (Watch, newsletter, alerts) and first-party statistics.

## Quick start

Requirements: Node ≥ 22.12 and PostgreSQL 16. For a local database you can run `docker compose up -d`.

```bash
npm install
cp .env.example .env.local          # set DATABASE_URL, APP_SECRET (≥ 32 chars)
npm run db:migrate                  # apply migrations
npm run db:seed                     # load the sourced dataset in /data
npm run dev                         # http://localhost:3000 → /nl or /en

npm run admin:create -- --email you@example.com --password 'a long password'
# owner area: http://localhost:3000/admin

npm run agents -- list              # see all agents
npm run agents -- run health        # run one agent now
npm run agents:worker               # run agents on schedule (keep running)
```

Without API keys everything works except the optional parts:

- no LLM → keyword engine;
- no e-mail provider → e-mails stay in the outbox and Watch/newsletter are hidden;
- no YouTube key → official channel feeds only.

The dependency register (Admin → Automation) shows what is configured.

## Scripts

| Script | Purpose |
| --- | --- |
| `dev` / `build` / `start` | Next.js development, production build (standalone output), production server |
| `lint`, `typecheck`, `test`, `test:e2e` | ESLint, TypeScript (with route typegen), Vitest (unit + integration on PGlite), Playwright |
| `db:generate` / `db:migrate` / `db:seed` / `db:reset` | Drizzle migration generation, migrate, seed/sync from `/data`, local reset (refused in production) |
| `agents -- list \| run <agent> [--force] \| due \| enable/disable <agent> \| revert <actionId> \| revert-run <runId>` | Agent CLI |
| `agents:worker` | Long-running scheduler plus external heartbeat |
| `admin:create` | Create or reset an admin (resetting revokes that user's sessions) |
| `i18n:check` | Message coverage per locale (the build fails on gaps in live locales) |
| `revenue:scenarios` | Revenue projections with explicit assumptions |
| `e2e:serve` | Serve the build against an isolated, freshly seeded e2e database |
| `static:export` / `static:serve` | Export the static edition from a server running with `SITE_MODE=static` / serve it like GitHub Pages |

## Repository layout

```
src/app/[locale]/…      public site (nl, en live; de, fr ready but dark)
src/app/admin/…         owner area (auth, dashboard, inbox, operations, reports, automation, tools, commerce)
src/app/api/…           public data API (v1) and the cron endpoint
src/agents/…            agent framework, safe fetcher, policy, anomaly guard, 19 agent definitions
src/lib/engine/…        intent, clarification, composer, ranking, compare, doctor, golden set (no monetisation imports)
src/lib/provenance/…    confidence, freshness, snapshots
src/lib/reports/…       owner metrics (fixed SQL) and the weekly report
src/lib/…               catalog cache, db, i18n helpers, security, e-mail, analytics, monetisation
src/i18n/messages/      nl, en, de, fr message catalogs
data/                   the sourced seed dataset (taxonomy, tools, events)
drizzle/                SQL migrations
tests/unit|integration  Vitest (PGlite, fixture fetcher, simulated time)
tests/e2e               Playwright (journey, 27 use cases, a11y, SEO, security, API, admin, visual, performance)
docs/strategy           product strategy and design decisions (Dutch)
docs/*.md               developer documentation (English)
```

## Documentation

| Document | Contents |
| --- | --- |
| [Architecture](docs/ARCHITECTURE.md) | System overview, request flow, caches, engine, provenance, agents, admin |
| [Database](docs/DATABASE.md) | Tables, invariants, history, migrations, seed pipeline, retention |
| [Agents](docs/AGENTS.md) | Framework, policy, escalation, every agent, and how to add one |
| [Data sources](docs/DATA_SOURCES.md) | What we read, under which terms, what we store and cite, and what we never use |
| [Security](docs/SECURITY.md) | Threat model, controls, secrets, reporting |
| [Deployment](docs/DEPLOYMENT.md) | Environment variables, build, web + worker/cron, database, e-mail, heartbeat, launch checklist |
| [Testing](docs/TESTING.md) | Test layers, running them, fixtures, golden set, baselines, CI |
| [Monetization](docs/MONETIZATION.md) | Revenue streams, affiliate flow, disclosure, ranking independence, revenue data |
| [SEO](docs/SEO.md) | Indexability gates, sitemap, hreflang, structured data, OG receipts, locale go-live |
| [Operations](docs/OPERATIONS.md) | Owner handbook: weekly routine, inbox, runbooks, what stays manual |

## License

Proprietary (UNLICENSED). Fonts are distributed under the SIL Open Font License (see `src/app/fonts` and `src/lib/og/fonts`).
