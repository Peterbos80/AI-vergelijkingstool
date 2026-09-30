# Monetization

How AIToolsWijzer earns money without letting money touch the recommendations, and how revenue is measured without inventing numbers. Strategy and projections (in Dutch): [`docs/strategy/09-monetization-architecture.md`](strategy/09-monetization-architecture.md).

## The rule

**Money never changes what we recommend or in which order.** The engine (`src/lib/engine`) has no access to affiliate programmes, links, placements, clicks or revenue:

- `tests/integration/engine.test.ts` fails the build if any engine module imports `src/lib/monetization`, the commerce admin or the monetisation agents, directly or through other modules, or names a monetisation table.
- Ranking parameters are published on `/methodology`, as Dutch law (art. 6:193e BW, Omnibus directive) requires: capability fit first, then data reliability and freshness, then entry price.
- Affiliate status is not a column the engine can see; tools with and without a programme are ranked identically.

## Streams

| Stream | How it works | Where it is managed | How revenue is recorded |
| --- | --- | --- | --- |
| **Affiliate** | Outbound "visit" links go through `/go/<tool>`. With an active affiliate link, the redirect uses its template with the click id as sub-id; otherwise it goes to the tool's own website. | Admin → Commerce: programmes, link templates | Network conversion CSV import, matched by click id |
| **Sponsored placements** | A clearly labelled block on the home page, or a labelled line in the weekly newsletter, for a period. Never inside recommendations, rankings or comparisons. | Admin → Commerce → Placements | Revenue entry (kind `sponsorship` or `newsletter`) when the sponsor pays |
| **Advice leads** | Stack Doctor visitors can request advice (consent recorded). The owner follows up. | Admin → Commerce → Leads (status, value) | Revenue entry (kind `lead`) |
| **Data** | The public API is free with attribution. Commercial data deals are handled offline. | — | Revenue entry (kind `data`) |

## Disclosure

- Every affiliate link has `rel="sponsored nofollow"`; other outbound links have `rel="nofollow"`. Placements have `rel="sponsored"` and a visible "Sponsored" label.
- Pages with an affiliate link show a disclosure note linking to `/disclosure`. That page lists, live, every tool with an active affiliate link, and states what we never do: take payment for position or inclusion, publish paid reviews or invented ratings, or leave out tools without an affiliate programme.
- Sponsored slots only exist where they are rendered: `home_sponsored` and `newsletter`. Admin cannot sell a slot that no page shows.

## Affiliate flow

1. **Programme** (Admin → Commerce): network, commission type and value, cookie days, terms URL, and the source of that information with its own status. It stays at `researching` until you have applied and been approved.
2. **Link**: a URL template with `{click_id}` where the network expects a sub-id, for example `https://partner.example/track?aff=123&sub={click_id}`. Templates are validated when saved (https, a real host, no credentials) and start inactive. Activate one when the programme is approved.
3. **Click**: `/go/<tool>?src=…&pos=…&l=…` logs an `outbound_clicks` row (page, position, locale, Match query, device, daily visitor hash) after the redirect is sent. Bots and synthetic traffic are skipped.
4. **Health**: the monetization agent checks active links weekly. A broken link is deactivated, so the direct link takes over, and one inbox item is raised. Revert with one click if it was a false alarm.
5. **Conversions**: export the network's report monthly and import it (Admin → Commerce → Import). Columns: `external_id, occurred_at, amount, currency, status (pending/approved/reversed/paid), click_id`. The import is idempotent per programme and external id, and re-importing updates statuses (for example pending → approved).

## Measuring revenue honestly

`src/lib/reports/metrics.ts` computes owner metrics with fixed SQL. The rules:

- **Unknown is not zero.** Each stream has a status: `ok`, `partial`, `unknown`, `not_configured` or `none`. Affiliate revenue is only `ok` when the import covers the whole period. Otherwise the report says "data through <date>" (imports are expected within 3 days after a period ends).
- An approved programme without an import in `settings.revenue.staleImportDays` (default 35) puts the dependency register's `revenue_import` check on "warning", and its revenue shows as unknown until the next import.
- Ratios need a denominator: EPC only with ≥ 100 clicks and RPM only with ≥ 1,000 page views. Below that the report says "too little data".
- Week-over-week changes are only called meaningful when |Δ| > 2·√previous and previous ≥ 30 (a Poisson noise guard).
- Nothing is estimated into revenue. Projections exist only in `npm run revenue:scenarios` and the strategy document, always labelled as scenarios with their assumptions.

## The opportunity agent

Daily, it ranks commercial next steps by expected value per month and puts the few worth the owner's time in the inbox, each with its calculation (`evBasis`):

- **Affiliate coverage**: tools with many outbound clicks but no programme. EV = clicks × conversion × commission, using the base scenario (1.5% conversion, €22 average commission) until real conversion data exists.
- **Unmet demand**: Match questions without a good answer.
- **Blocked comparisons**: popular pairs that fail the Fair Fight data gate.
- **Readiness**: newsletter sponsorship, a sponsor slot or vendor insights become worth pursuing only above measured thresholds (subscribers, traffic).

Items below `settings.autonomy.opportunityMinEvCents` (default €25/month) are not raised. The agent also tunes the LLM gating threshold within the owner's bounds, based on the holdout experiment.

## Owner routine

- **Monthly**: import conversions for each network (the dependency register and the weekly report show when an import is overdue).
- **When a sponsor pays**: add a revenue entry. The placement itself does not count as revenue.
- **When a lead turns into money**: set the lead to `won` with its value, and add a revenue entry.
- The weekly report shows revenue by stream with status and coverage, versus the monthly goal (`settings.revenue.goalCentsPerMonth`, default €500).
