# Operations: the owner handbook

You are the **exception handler, not the operator**. The system checks prices, detects changes, finds tools, fixes what it safely can, and keeps a record of everything it did. It only asks you for real decisions, and every question comes with a default that applies if you do nothing. The design behind this (in Dutch): [`docs/strategy/12-autonomous-operations.md`](strategy/12-autonomous-operations.md).

Admin lives at `/admin`. Its language is set under Automation → Owner.

## What reaches you, and how

| Channel | When | What to do |
| --- | --- | --- |
| **P1 e-mail** | Something needs you today: a security signal, a mass-change freeze, a failing core dependency | Open the link, and follow the matching runbook below |
| **Weekly report** (Monday 07:00, e-mail + Admin → Reports) | Every week | Read it (5 minutes). It ends with at most 3 recommendations. |
| **Admin → Overview** | Whenever you open Admin | "Needs your attention" first. The default state is *nothing to do*. |
| **External heartbeat alert** | The scheduler stopped | See "Scheduler stopped" |

P2 items (this week) and P3 items (FYI) wait in the inbox and are summarised in the report. At most 5 P2 items reach you per week by default; lower-priority ones are demoted to P3.

## In the free edition: your inbox is GitHub issues

The free edition (GitHub Pages, see [DEPLOYMENT.md](DEPLOYMENT.md)) has no admin area. Instead:

- every new **P1 or P2** inbox item becomes an issue labelled `ops` and `p1`/`p2`, with the reason, the evidence and "if you do nothing". GitHub e-mails you about new issues in your repository;
- every **weekly report** becomes an issue labelled `report`, and the previous one is closed;
- you decide with a comment on the issue: `/approve`, `/reject` (both with an optional note), `/snooze` (7 days) or `/default` (apply the default action now). Only comments by the repository owner count. The workflow replies, and closes the issue once the item is resolved;
- corrections from visitors arrive as issues labelled `correction` (the site's corrections page links to the form). Check the source and, where needed, fix the data in `data/` or let the next agent run confirm it.

Everything else in this handbook applies. Where it mentions Admin pages, the free edition uses the issue, the Actions log ("Site and agents") or a commit to `data/`.

## Routine

**Weekly, about 15 minutes, after the report:**

1. Read the 3-sentence summary and the recommendations.
2. Check the "Unmeasured" list: things the system cannot see, such as no traffic data yet, Search Console, backups, e-mail and revenue imports. Each one says what would fix it.
3. Open the inbox and decide what you want to decide. Anything you skip gets its default action at its deadline, and that is fine.

**Monthly:**

- Import affiliate conversions for each network (Admin → Commerce).
- Do the **audit sample** (inbox item on the 1st): mark each automated decision correct or incorrect. The report shows precision per confidence band. If a band is below target, the system proposes stricter thresholds.
- Glance at Admin → Automation → Dependencies.

**Quarterly:** test a backup restore (see [DEPLOYMENT.md](DEPLOYMENT.md)).

## The inbox

Every item shows:

- what happened and why (with evidence and sources);
- the impact (pages, visits, expected value);
- **"If you do nothing"**: the default action and its date.

Your options:

- **Approve** or **Reject** (with an optional note). The meaning depends on the item:
  - a flagged price change: approve keeps it, reject undoes it;
  - a frozen run: approve publishes the changes, reject discards them;
  - a new tool: approve creates a draft;
  - a broken affiliate link: reject means "the link is fine", which re-activates it.
- **Snooze 7 days**, when you need more information.
- **Apply the default now**, when you agree with it; the escalation agent applies it within the hour.
- **Revert** an automated change straight from the item.
- For a disabled agent: **re-enable** it once the cause is fixed.

Items close themselves when their cause clears: a site is back up, a check passes, or the golden set passes again. Duplicates are merged into one item with a counter.

## Runbooks

### Scheduler stopped (heartbeat alert)

1. Check the worker process or the cron job on your host, and restart it.
2. Run `npm run agents -- due` once, or wait for the next cycle.
3. Admin → Operations should show fresh runs. The `agents` dependency turns OK once they have run on schedule.

Nothing is lost: agents catch up. For example, the weekly report is built as soon as the reporter runs again.

### An agent was disabled after 3 failures

1. Admin → Operations → the agent → the latest failed run shows the error.
2. Typical causes: a vendor changed a page or feed URL (fix it in Admin → Tools), an API key expired, or a network problem on our side.
3. Re-enable it from the inbox item or Operations, or with `npm run agents -- enable <agent>`. `health` and `escalation` are never disabled.

### Anomaly freeze (many changes at once)

A run tried to change more than 10% of tools, more than 5 prices or more than 3 statuses. Nothing was published.

1. Open the item and spot-check two or three of the changes against the official pages linked.
2. If they are real (for example, a vendor repriced everything), **approve**. If not (for example, a broken page or a currency switch), **reject**.
3. Default after 7 days: the frozen changes are discarded and the next run starts fresh.

### Large price change (above the hard-rule limit)

The price was confirmed by repeated measurement, but the change is bigger than the automatic limit (increase > 50%, decrease > 70%, or free → paid).

1. Check the linked official page.
2. **Approve** to publish now, or **reject** to keep the old price marked "may have changed".
3. Default after 72 hours: publish, labelled as a large change confirmed by repeated measurement.

### Wrong data went live

1. Admin → Operations → open the run that made the change → **Revert** the action, or the whole run. From the command line: `npm run agents -- revert <actionId>` or `revert-run <runId>`.
2. The public page updates within about 15 seconds. The history keeps both the change and the revert.
3. If the source itself is wrong, fix the tool's URLs in Admin → Tools so the next check does not repeat it.

### A correction from a visitor or vendor

The item shows the claim and the submitted evidence. A vendor's claim is a lead, not proof: approve to have the value re-checked on the official page, or reject with a note.

### A website is unreachable

Handled automatically: a tool is marked "unreachable since…" only after at least 3 failed checks spanning 24 hours, and restored automatically when it responds again. If many sites fail at once, nothing is marked (the problem is probably our network) and a dependency item is raised. Act only if the tool has really shut down: set its status in Admin → Tools.

### New tool candidates

Admin → Candidates lists tools found on Show HN and GitHub that passed verification, each with a dossier (reachability, AI relevance, pricing and legal pages, duplicate check).

1. **Promote** a good one. It becomes an unpublished draft tool. With the LLM configured, the content agent drafts nl/en texts from its homepage overnight.
2. In Admin → Tools: review the texts, set capabilities, add plans with their source, check the URLs.
3. **Publish.** The publish gate refuses until nl and en texts exist and are reviewed (no `ai_draft` or `machine_translated` left) and at least one capability is set. Without plans, prices show as unknown and the tool pages stay out of the index until the data is there.

New tools are never published automatically.

### Duplicate flagged

Two tools share a host or name. Decide which one stays, then unpublish the other in Admin → Tools. Merging stays a human decision.

### Golden-set regression

The nightly check found a real question that no longer gets a sensible answer, usually after a data change such as a tool unpublished or a capability removed. The item names the case. Revert the change that caused it, or fix the data. The item closes when all cases pass again.

### E-mail stuck

The `email` dependency fails when mail has been queued for more than 24 hours. Check `RESEND_API_KEY`, the sending domain's DNS (SPF, DKIM) and the provider dashboard. Queued mail is retried automatically once delivery works.

### LLM budget reached

Nothing breaks: Match falls back to the lexical engine, and drafts wait until tomorrow. The weekly report shows LLM calls, failures and cost against the budget; raise the daily budget in Automation if it is regularly used up. The opportunity agent measures the LLM's effect with the 10% holdout and tunes the gating threshold within your bounds.

### Security P1: many failed logins

1. The inbox item shows how many logins failed in the last hour. Every attempt is in the `audit_log` table, with the e-mail hashed.
2. Rotate your password: `npm run admin:create -- --email you@… --password '…'`. This revokes all sessions of that user.
3. If it persists, block the source at your proxy or CDN.

### Restore from backup

Restore into a new database, run `npm run db:migrate` against it (a no-op if it is current), point `DATABASE_URL` at it, and restart web and scheduler. Agents re-verify prices on their normal schedule.

## Settings worth knowing (Admin → Automation)

| Setting | Default | Meaning |
| --- | --- | --- |
| Publish silently / with flag / queue from confidence | 95 / 80 / 60 | Policy bands for automated changes |
| Max automatic price increase / decrease | 50% / 70% | Above this, a human decides (with a default) |
| Identical measurements needed, hours apart | 2, 6 h | Confirmation by repetition |
| Freeze thresholds | 10% of tools, 5 prices, 3 statuses | Anomaly guard (P1 above 25% of tools) |
| Max P2 items per week | 5 | Your weekly decision budget |
| Days before a safe default applies | 7 | Generic deadline |
| Hours before a large confirmed price change is published | 72 | Hard-rule default |
| P3 expiry | 30 days | FYI items disappear |
| Daily LLM budget | $5 | Hard cap (the lower of this and the environment value) |
| LLM gating threshold (min–max) | 0.55 (0.30–0.70) | The system tunes it within your bounds |
| Weekly report | Monday 07:00 Europe/Amsterdam | Day, hour, time zone |
| Revenue goal | €500/month | Shown against real revenue |

Each section is saved on its own. Invalid or inconsistent values (for example, bands in the wrong order) are rejected with a message, and nothing in that section changes until it is valid. Every change is in the audit log with before and after values.

## What stays manual (by design, or not built yet)

- Publishing new tools, merging duplicates, and changing the taxonomy (`data/taxonomy.json` + `npm run db:seed`).
- Affiliate programme applications and terms, conversion imports (CSV), sponsor deals and invoicing, and lead follow-up.
- Legal requests (takedowns, complaints) arrive by e-mail or the corrections form and are handled by you.
- Taking a new language live (checklist in [SEO.md](SEO.md)).
- Search Console, host backups, DNS, and creating admin accounts or resetting passwords (CLI).
- The weekly report's summary is template-based; there is no LLM rewrite.
