# Deployment

AIToolsWijzer needs three things in production:

1. **Web**: the Next.js server (Node ≥ 22.12), behind a TLS-terminating reverse proxy or platform.
2. **Scheduler**: either the long-running worker, or a scheduler calling the cron endpoint.
3. **PostgreSQL 16**, with backups.

Everything else (e-mail, LLM, YouTube, GitHub, heartbeat) is optional and degrades honestly when missing. Admin → Automation shows what is configured.

> **Not GitHub Pages.** GitHub Pages only hosts static files. This app renders pages per request, has server actions, an owner area and a database, so it needs a Node host (Vercel, Fly.io, Railway, Render, or a VPS with Node) plus Postgres. GitHub holds the code and runs CI; hosting happens elsewhere.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string |
| `SITE_URL` | yes | Public base URL (`https://…`): canonical URLs, sitemap, OG images, e-mail links. HTTPS enables `Secure` cookies and `upgrade-insecure-requests`. |
| `APP_SECRET` | yes | ≥ 32 characters; salts the daily visitor hash. `openssl rand -hex 32` |
| `CRON_SECRET` | with cron | ≥ 16 characters; bearer token for `/api/cron/agents` (503 without it) |
| `TRUSTED_PROXY_HOPS` | yes, if not 1 | Proxies in front of the app that append to `X-Forwarded-For` (default 1). Per-IP rate limits depend on it. |
| `DB_POOL_MAX` | no | Connections per process (default 10) |
| `OWNER_EMAIL` | recommended | Receives P1 alerts and the weekly report |
| `HEARTBEAT_URL` | recommended | External dead man's switch (https), pinged after every scheduler cycle |
| `RESEND_API_KEY`, `EMAIL_FROM` | recommended | E-mail delivery. Without them, mail stays in the outbox and Watch/newsletter are hidden. |
| `ANTHROPIC_API_KEY` | no | LLM features (Match intent when unsure, drafts, translations) |
| `ANTHROPIC_MODEL` | no | Model id (default `claude-opus-5-5`). Choosing a cheaper model is an owner decision. |
| `LLM_DAILY_BUDGET_USD` | no | Hard daily cap (default 5; the lower of this and the owner setting applies) |
| `LLM_MATCH_ENABLED` | no | `false` disables the LLM in Match |
| `GITHUB_TOKEN` | no | Higher GitHub API rate limit for the social and discovery agents |
| `YOUTUBE_API_KEY` | no | YouTube Data API search (without it: official channel RSS only) |
| `AGENT_USER_AGENT` | no | Bot identity (keep the `+https://…/bot` link pointing at your domain) |
| `ENABLED_LOCALES` | no | Live locales, comma-separated (default `nl,en`) |
| `LEGAL_NAME`, `LEGAL_KVK`, `LEGAL_ADDRESS`, `LEGAL_EMAIL` | before launch | Shown on /about. `LEGAL_EMAIL` also enables `security.txt` and the bot contact line. |
| `WORKER_CYCLE_SECONDS` | no | Worker cycle (default 60, minimum 15) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | no | Defaults for `npm run admin:create` without flags |

`.env.example` documents all of them. The web app reads its environment from the platform or `.env.local`; the CLI scripts and the worker also read `.env.local` and `.env`, with the real environment taking precedence.

## First deployment

```bash
npm ci
npm run build                 # no database needed at build time
npm run db:migrate            # against DATABASE_URL
npm run db:seed               # first time only: the sourced dataset in /data
npm run admin:create -- --email you@example.com --password 'a long unique password'
```

### Web

Either run the standard server:

```bash
npm start                     # next start, PORT defaults to 3000
```

or the standalone output (smaller, no `node_modules` needed at runtime):

```bash
cp -r .next/static .next/standalone/.next/static
PORT=3000 HOSTNAME=0.0.0.0 node .next/standalone/server.js
```

Put a reverse proxy or platform edge in front for TLS, and set `TRUSTED_PROXY_HOPS` to the number of proxies that append to `X-Forwarded-For`. Never expose the Node port directly.

### Scheduler: pick one

**A. Worker** (a VPS, Fly.io or Railway worker process):

```bash
npm run agents:worker         # needs the repository and node_modules (tsx is a runtime dependency)
```

Run it under a supervisor (systemd, pm2 or the platform's process manager) with restart on failure. On SIGTERM it finishes the current agent and exits.

**B. Cron** (serverless hosts such as Vercel, or any scheduler): every 5–15 minutes:

```bash
curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/agents
```

GET with the same header is accepted too (Vercel Cron sends `Authorization: Bearer $CRON_SECRET` itself when `CRON_SECRET` is set). A call runs what is due within about 4 minutes (`maxDuration = 300`).

Both options can run at the same time: the per-agent lease prevents double runs.

### Heartbeat

Create a check at an external monitor (for example Healthchecks.io) with a period slightly longer than your cycle. Set its URL as `HEARTBEAT_URL`. After every cycle the scheduler pings it: the URL on success, `…/fail` when the health agent failed. If the pings stop, **the external service alerts you**. That covers the one failure the system cannot report itself: the scheduler not running.

### E-mail

1. Create a Resend account and verify your sending domain: add the SPF and DKIM records it gives you, plus a DMARC record (start with `p=none`).
2. Set `RESEND_API_KEY` and `EMAIL_FROM` (an address on the verified domain) and `OWNER_EMAIL`.
3. Admin → Automation → Dependencies shows `email: ok` while a provider is configured and nothing has been stuck in the outbox for more than 24 hours. Watch and the newsletter appear on the site only when a provider is configured.

## Updating

```bash
git pull
npm ci
npm run build
npm run db:migrate            # before starting the new version
# restart web and worker
```

Migrations are forward-only and mostly additive (new tables, nullable columns), so the old version keeps working while they run. For a destructive change, split it over two releases.

## Backups and restore

- Turn on the database host's automated backups with point-in-time recovery, or at least daily snapshots kept for 30 days.
- Test a restore before launch and then every quarter: restore into a new database, point a staging web instance at it with `DATABASE_URL`, and open `/nl` and `/admin`.
- The dependency register keeps `backups` visible as an owner duty because the app cannot see your host's backups.

## Monitoring

| Signal | Where |
| --- | --- |
| Scheduler stopped | external heartbeat alert |
| Something needs you today | P1 e-mail (`OWNER_EMAIL`) and the Admin overview |
| Weekly state, revenue, data quality, what the system did | weekly report (Monday 07:00, e-mailed) |
| Dependencies (database, agents, e-mail, FX, imports, legal, …) | Admin → Automation |
| Errors | Admin → Errors (grouped per fingerprint per day) |
| Agent runs and every automated change | Admin → Operations |

## Launch checklist

- [ ] `SITE_URL` is the final https URL; `APP_SECRET`, `CRON_SECRET` and `TRUSTED_PROXY_HOPS` are set.
- [ ] Migrations applied, dataset seeded, owner account created with a long unique password.
- [ ] Scheduler running (worker or cron), and Admin → Operations shows runs.
- [ ] `HEARTBEAT_URL` configured, and the external monitor alerts you when you stop the scheduler (test it).
- [ ] E-mail domain verified (SPF, DKIM, DMARC), `OWNER_EMAIL` set, and a test P1 or weekly report received.
- [ ] Legal details set (`LEGAL_*`): Admin → Automation shows `legal: ok`; /about and `security.txt` show them.
- [ ] Backups on, restore tested.
- [ ] `https://your-domain/robots.txt` and `/sitemap.xml` load. Optionally verify the domain in Google Search Console and submit the sitemap.
- [ ] `AGENT_USER_AGENT` links to your domain's `/bot`.
- [ ] GitHub: secret scanning and push protection on, and the CI workflow required before merging.
- [ ] Optional: run the Playwright suite against staging (`E2E_BASE_URL=https://staging… npx playwright test`). Use a staging deployment with the seed data, never production: some specs save stacks and log in with the e2e admin.
