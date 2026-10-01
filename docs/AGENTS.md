# Agents

Nineteen scheduled agents keep the data current and the owner informed. They are ordinary TypeScript functions with a shared framework. There is no agent "swarm": each agent has one job, a schedule, a work limit and a time budget, and every change it makes is recorded and bounded by policy.

Design background (in Dutch): [`docs/strategy/08-agent-architecture.md`](strategy/08-agent-architecture.md) and [`12-autonomous-operations.md`](strategy/12-autonomous-operations.md).

## Framework

| Piece | File | What it does |
| --- | --- | --- |
| Registry | `src/agents/registry.ts` | The list of agents; the runner, CLI, worker, cron endpoint and Admin all read it |
| Runner | `src/agents/runner.ts` | Lease lock, run record, time budget (`AbortSignal`), context, data-version bump, next run |
| Schedule | `src/agents/schedule.ts` | `every:15m`, `every:6h`, `daily:HH:MM`, `weekly:D:HH:MM` (0 = Sunday), `monthly:DD:HH:MM`, in Europe/Amsterdam time |
| Policy | `src/agents/policy.ts` | Risk class × confidence band × hard rules → decision |
| Anomaly guard | `src/agents/anomaly.ts` | Freezes a run whose volume of changes is implausible |
| Action ledger | `src/agents/actions.ts` | Records every change; reverters for the reversible ones |
| Inbox | `src/lib/ops/inbox.ts` | Escalation with dedupe, grouping, a safe default action and a deadline |
| Fetcher | `src/agents/fetcher/*` | The only way agents read the web (see [DATA_SOURCES.md](DATA_SOURCES.md)) |

### A run

1. `runDueAgents()` selects enabled agents whose `next_run_at` has passed: never-run agents first, then the longest overdue, ties in registry order (safety agents first). A cycle stops after 20 runs or its time budget.
2. `runAgent()` takes a **lease**: `UPDATE agent_configs SET locked_until = now() + budget WHERE locked_until IS NULL OR locked_until < now()`. If another worker or cron call holds it, the run is skipped as `locked`. This works across processes and connection pools.
3. The agent receives a context: its **clock** (`ctx.now`), database, settings, fetcher, action logger, inbox, abort signal, `maxItems` and a stats counter. All timestamps an agent writes come from `ctx.now`, so tests can simulate days or weeks.
4. When the time budget runs out, the signal aborts; a run that still finishes is recorded as `partial`.
5. Afterwards the run row gets status, stats and summary; `next_run_at` is computed; three consecutive failures are counted. If published data changed, `data_version` is bumped and every web instance reloads its catalog within 15 s.

### Autonomy and policy

Each agent has an autonomy mode in `agent_configs`: `auto`, `queue_only` (everything goes to the inbox) or `off`.

Every proposed change gets a **risk class**:

| Class | Meaning | Example |
| --- | --- | --- |
| R0 | internal, no public effect | a snapshot recompute |
| R1 | public, factual, reversible | a price confirmed on the official page |
| R2 | reputation or impact sensitive | never silent: queued even at high confidence |
| R3 | legal, financial or security | never automatic |

`decide()` turns risk and confidence into a decision, using the owner's bands (`settings.policy`, defaults 95/80/60):

- R3 or a **hard rule** → `needs_human`. Hard rules include a price increase above 50%, a decrease above 70%, and free → paid.
- R0 → `auto_published`.
- ≥ 95 and R1 → `auto_published` (silent).
- ≥ 80 → `auto_published_flagged` (published, and the owner sees it); R2 in this band is `queued`.
- ≥ 60 → `queued`.
- below → `needs_human`.

Confidence always comes from evidence (`src/lib/provenance/confidence.ts`), never from a model's self-assessment. The current agents publish only R0 and R1 changes themselves; R2 and R3 are handled by the policy (and its tests) for anything more sensitive.

### Safety mechanisms

- **Confirmation by repetition.** A different price is first stored in `pending_changes`. It is published only after `settings.price.confirmations` identical observations (default 2) at least `confirmHours` apart (default 6). Meanwhile the public page shows the old price with "may have changed". Unconfirmed observations expire after 30 days.
- **Anomaly guard.** If one run would change more than 10% of tools, more than 5 prices or more than 3 statuses, the whole run is frozen. Nothing is published, and one inbox item (P1 above 25% of tools) carries the default action "discard after 7 days".
- **Our problem or theirs?** When many websites fail at once, the broken-link agent marks nothing and raises a dependency item instead.
- **Failing agents.** After 3 consecutive failed runs the escalation agent disables the agent and raises one P2. The safety agents `health` and `escalation` are never disabled.
- **Reversible actions.** `npm run agents -- revert <actionId>` or `revert-run <runId>` (also in Admin → Operations) undoes: `price_published`, `plan_verified`, `event_published`, `website_status`, `tool_published`, `video_added`, `affiliate_link_deactivated` and `llm_gating_adjusted`. A revert restores the previous row, recomputes the snapshot and bumps the data version.

### The inbox

`ctx.inbox.escalate()` never creates noise by accident:

- `dedupeKey`: the same problem creates one item, ever.
- `groupKey`: similar items are bundled into one, with a count and up to 50 payloads.
- `defaultAction` + `dueInHours`: every item says what happens if the owner does nothing, and the escalation agent applies it after the deadline. Examples: publish a confirmed large price change with a label, keep the old price flagged, discard frozen changes, keep the direct link.
- Severity P1 (act today), P2 (this week) and P3 (FYI, expires after 30 days). A new P1 is e-mailed to `OWNER_EMAIL` right away (`src/lib/ops/alerts.ts`; at most 10 per day, delivered by the notifier within 15 minutes).
- **Escalation budget:** at most 5 P2 items per week by default. Lower-priority ones are demoted to P3.
- Items auto-resolve when their cause clears: the site is back up, the check passes, or the golden set passes again.

## The agents

Times are Europe/Amsterdam. "Items" is the per-run work limit.

| Agent | Schedule | Items | What it does | What it may change on its own |
| --- | --- | --- | --- | --- |
| `health` | every 15 min | 50 | Runs the dependency register (database, agents, e-mail, FX, revenue imports, legal details, …); 20+ failed admin logins in an hour → security P1 | health checks, inbox |
| `escalation` | hourly | 200 | Safe defaults after deadlines, auto-resolve, expiry, failing agents, escalation budget | inbox, disable a failing agent |
| `quality` | hourly | 1000 | Recomputes freshness, quality scores and indexability; applies retention | snapshots, deletions per retention rules |
| `notifier` | every 15 min | 200 | Delivers the e-mail outbox, Watch digests and the weekly AI Pulse newsletter (confirmed subscribers only; sent 33 h after the week ends, minimum 3 items) | e-mail |
| `fx` | daily 16:40 | 1 | ECB reference rates for indicative euro conversions | `fx_rates` |
| `pricing` | hourly | 20 | Checks official pricing pages, highest-traffic and oldest first, each page at most once a day. An anchored price → VERIFIED; a different price → confirmation by repetition → policy. Coverage: every published tool with a `pricingUrl` gets a pricing source, and 3 tools per run whose plans have no official page get the pricing link from their own home page (`pricing_url_found`, reversible; no link → retried after 30 days, a failed fetch after a day) | plans, Pulse events (R1, within policy), `tools.pricing_url` |
| `broken-link` | hourly | 15 | Website reachability, the sites checked longest ago first (each site at most every 5.5 h); "unreachable since" only after ≥ 3 failures spanning ≥ 24 h, restored automatically | `website_status` |
| `change-detection` | every 6 h | 30 | Official changelogs and RSS/Atom → Pulse, titles verbatim from the vendor | Pulse events |
| `news` | hourly | 300 | Media feeds in `data/news/sources.json` (The Verge, The Guardian, TechCrunch, MIT Technology Review, CNBC, BBC, NOS) and media YouTube channels: headline, outlet, date and link, never article text; tags watched experts (`data/news/people.json`). YouTube via the Data API with `YOUTUBE_API_KEY`, else the channel feed where robots.txt allows. The run summary names every source that was skipped (robots.txt) or failed, with the reason | `news_items` (articles kept 90 days; videos 30 days after the channel last listed them) |
| `social` | every 6 h | 30 | GitHub stars/releases, Hacker News mentions; a "buzz" event needs ≥ 5 mentions and 3× the usual level | `social_signals`, buzz events |
| `video` | daily 06:15 | 50 | Official uploads (YouTube Data API with a key, else the channel feed where robots.txt allows); with a key, also API search. API data is refreshed within 30 days or removed | videos |
| `discovery` | hourly | 100 | The tool scout's eyes: Show HN and launch stories (HN Algolia API), new GitHub repositories of organisations, makers' own news feeds (`data/discovery/sources.json`) and Product Hunt (only with `PRODUCTHUNT_TOKEN`). Window: since the previous run (+ 48 h so points can grow); merged per domain; never texts or user names | `tool_candidates` only |
| `verification` | daily 03:20 | 15 | Checks candidates (reachable, AI-related, blocklist, duplicate, pricing and legal pages) and writes a dossier | candidate status; **never publishes** |
| `duplicate` | weekly Sun 05:00 | 50 | Flags tools sharing a host or normalised name | inbox only (merging is human) |
| `monetization` | weekly Wed 04:20 | 60 | Checks affiliate links; deactivates broken ones (the direct link takes over) | `affiliate_links.active` |
| `recommendation` | daily 04:30 | 100 | Nightly golden-set regression check of the engine against the live catalog | inbox (regression item) |
| `opportunity` | daily 05:10 | 50 | Ranks affiliate coverage, unmet demand, blocked comparisons and readiness by expected value; tunes LLM gating within owner bounds | LLM gating threshold (bounded) |
| `content` | daily 01:30 | 10 | Optional, needs `ANTHROPIC_API_KEY`: drafts texts for owner-created draft tools; machine-translates tool texts into extra enabled locales | drafts, labelled `ai_draft` / `machine_translated` |
| `reporter` | hourly | 1 | Builds the weekly owner report once the week is complete (default Monday 07:00) and e-mails it | `reports` |
| `audit` | monthly, 1st 08:00 | 50 | Random sample of automated decisions for owner review; precision per confidence band (Wilson lower bound) | inbox (audit sample) |

## Running agents

```bash
npm run agents -- list                  # schedule, last/next run, status of every agent
npm run agents -- run pricing           # run one now (respects "disabled"; add --force to override)
npm run agents -- due                   # run everything that is due, once
npm run agents -- disable social        # or: enable
npm run agents -- revert <actionId>     # undo one automated action
npm run agents -- revert-run <runId>    # undo every reversible action of a run
npm run agents:worker                   # scheduler loop (WORKER_CYCLE_SECONDS, default 60)
```

In production, use either the worker or a scheduler calling `POST /api/cron/agents` every 5–15 minutes. Both ping `HEARTBEAT_URL` after each cycle; see [DEPLOYMENT.md](DEPLOYMENT.md).

## Adding an agent

1. Create `src/agents/defs/<name>.ts` exporting an `AgentDefinition`: name, description, schedule, autonomy, `maxItems`, `timeoutMs`, optional `requires` (dependency keys), and `run(ctx)`.
2. Add the name to `AgentName` in `src/agents/types.ts` and to `AGENTS` in `src/agents/registry.ts`.
3. Inside `run`:
   - read the web only through `ctx.fetcher`, and treat every body as untrusted text;
   - take time only from `ctx.now()`, and stop when `ctx.signal.aborted`;
   - pass every public change through `decide()` (and `anomalyVerdict()` for bulk changes), and log it with `ctx.log.action()` including old/new value, source and confidence;
   - escalate with `ctx.inbox.escalate()` with a `dedupeKey`, a `defaultAction` and a deadline; never create an item without saying what happens if nobody acts;
   - return `dataChanged: true` when published data changed.
4. If the action should be reversible, add a reverter to `REVERTERS` in `src/agents/actions.ts`.
5. Add the description and any new inbox kinds, reasons or default actions to the `admin` messages in `src/i18n/messages/{nl,en}.json`.
6. Test it in `tests/integration/agents.test.ts` with `fixtureFetcher()` (canned pages, no network) and a simulated clock: `run('<name>', pages, hours(n))`.

## Testing

`tests/integration/agents.test.ts` runs the real agents against PGlite with the real seed data, a fixture fetcher and simulated time. It covers:

- price confirmation over hours;
- hard rules and the anomaly freeze;
- revert;
- lease locking;
- escalation defaults and budget;
- the dependency register;
- discovery → verification;
- the weekly report;
- retention.

Pure helpers (schedules, parsers, scoring) are unit-tested in `tests/unit/agents-*.test.ts`.
