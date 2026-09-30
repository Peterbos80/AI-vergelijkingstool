# Testing

Three layers, all runnable locally and in CI. None of them touch the network or real services: no LLM, no e-mail provider, no vendor sites.

| Layer | Runner | Database | What it proves |
| --- | --- | --- | --- |
| Unit (`tests/unit`) | Vitest | none | Pure logic: confidence and status rules, freshness, text normalisation, i18n formatting, snapshots, revenue scenarios, agent helpers (schedules, parsers, policy, SSRF guard, robots.txt), client-address and secret handling |
| Integration (`tests/integration`) | Vitest | PGlite (real migrations, in process) | The real seed data, engine and agents together: seed idempotency and provenance clamping, the golden set, ranking independence, comparison, Stack Doctor, search, every agent against a fixture fetcher with simulated time, admin logic, retention, P1 alerts |
| End-to-end (`tests/e2e`) | Playwright | PostgreSQL (isolated e2e database) | The production build in a browser: journeys, use cases, pages, accessibility, SEO, security headers, API, admin, visual regression, performance budgets |

## Running

```bash
npm test                                   # unit + integration (≈ 20 s)
npx vitest run tests/unit/provenance.test.ts
npx vitest                                 # watch mode

npm run build && npm run test:e2e          # end-to-end against the production build
npx playwright test journey                # one spec
npx playwright test --project=desktop      # skip the mobile project
```

The e2e server (`scripts/e2e-serve.ts`, started by Playwright) needs a Postgres database it may wipe: `E2E_DATABASE_URL`, default `postgres://aitw:aitw@localhost:5432/aitoolswijzer_e2e`. `docker compose up -d` creates it. On every start it drops the schema, migrates, seeds, creates the e2e owner (`E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`), and runs `next start` on `E2E_PORT` (3200). It refuses to run with `NODE_ENV=production` and never touches `DATABASE_URL`.

To test a deployed staging site instead: `E2E_BASE_URL=https://staging.example.com npx playwright test`. Some specs log in and save stacks, so never point this at production.

## Determinism

- **Time.** Agents take time only from `ctx.now`, so integration tests simulate hours and weeks (`run('pricing', pages, hours(7))`). Seeding uses a fixed moment: integration tests pass one, and the e2e server uses `seedAsOf(bundle)`, the day after the dataset's newest observation. Freshness is stored at seed time, so pages do not drift from "fresh" to "stale" as the calendar moves on.
- **Network.** `fixtureFetcher({ url: { body, status } })` serves canned pages to agents; any other URL fails like a real network error. `tests/setup/env.ts` removes API keys and the heartbeat URL, so nothing can reach a real service.
- **Analytics.** Playwright sends `x-aitw-synthetic: 1`, so test traffic is never counted as visits or clicks.
- **Dynamic regions.** Visual tests mask tickers, `<time>` elements, receipt numbers (`data-dynamic`) and the footer.

## What the specs cover

| Spec | Covers |
| --- | --- |
| `journey.spec.ts` | The brief's final journey in English and Dutch: "I want to create professional social media videos but I don't know which AI tools to use." Goal → clarification → stack with receipts → variants → saved, shareable stack. Also a tool page's prices with status, date and sources. Desktop and mobile. |
| `use-cases.spec.ts` | All 27 golden use cases through the real Match page: the right task, a usable tool for every required step, and an honest "no match" where we cannot answer |
| `pages.spec.ts` | Every template renders without console errors (desktop and mobile), real 404s, the language switcher, explorer filters, Stack Doctor, corrections form validation |
| `a11y.spec.ts` | axe-core (WCAG 2.1 A/AA rules) on the key templates, and the skip link moving keyboard focus to the content |
| `seo.spec.ts` | canonical/hreflang/JSON-LD, noindex on personal pages, robots.txt and sitemap, the `/bot` page, OG images, `llms.txt` |
| `security.spec.ts` | nonce CSP and hardening headers, admin pages requiring a session (and never indexed), the cron endpoint refusing missing or wrong secrets, `/go` only redirecting to known tools, failed logins not revealing whether an account exists |
| `api.spec.ts` | tools endpoint values carry status, confidence and dates; unknown tools give a JSON 404; tasks and changes endpoints respond |
| `admin.spec.ts` | owner login, the dashboard and every admin section; settings validation rejecting inconsistent thresholds |
| `visual.spec.ts` | screenshots of home, tool, pricing, Fair Fight, Match and admin login against Linux/Chromium baselines (2% pixel tolerance) |
| `perf.spec.ts` | per template: LCP < 2.5 s, CLS < 0.1, TTFB < 800 ms, JS < 200 KB |

## The golden set

`src/lib/engine/golden.ts` holds 27 real questions (18 Dutch, 9 English). Each names the task the engine must recognise and, where relevant, constraints such as budget or EU-only, or an expected "no match". Three places use the same evaluator (`src/lib/engine/golden-eval.ts`):

- `tests/integration/engine.test.ts` (every CI run);
- `tests/e2e/use-cases.spec.ts` (through the real UI);
- the **recommendation agent** every night against the live catalog. A data change that breaks a case raises a regression item, which auto-resolves once the set passes again.

To add a case, append it to `GOLDEN` with an id, the query, the locale and the expected task(s), then run `npm test`. If it fails, fix the engine or the taxonomy (synonyms, intent phrases), not the case.

## Visual baselines

Baselines live in `tests/e2e/__screenshots__/` and are Linux/Chromium (CI uses ubuntu-latest with Playwright's Chromium). After an intended UI change:

```bash
npm run build && npx playwright test visual --update-snapshots
```

Review the new PNGs in the diff before committing. On macOS or Windows, regenerate them in Linux (for example in the official Playwright Docker image), because font rendering differs per OS.

## CI

`.github/workflows/ci.yml` runs on every push and pull request, and can be started by hand:

1. **Checks**: `npm ci`, lint, typecheck (with route type generation), i18n coverage, seed validation, unit + integration tests.
2. **E2E** (after checks): a Postgres 16 service, Playwright Chromium, `npm run build`, the full Playwright suite. On failure the HTML report is uploaded as an artifact for 7 days.

Make the workflow a required check before merging.

## Writing tests

- New engine behaviour: add a golden case or an engine integration test.
- New agent behaviour: add to `tests/integration/agents.test.ts` with canned pages and simulated time. Assert on the ledger (`agent_actions`) and the inbox (`review_items`), not only on data.
- New public page: add it to `pages.spec.ts` (renders without console errors), and to `a11y.spec.ts` if it has forms or new components.
- New admin action: assert the role check and the audit row.
- Bug fix: first a test that fails, then the fix.
