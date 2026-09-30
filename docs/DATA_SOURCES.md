# Data sources

What AIToolsWijzer reads, under which terms, what it stores and publishes, and what it never uses. The rule behind all of it: **only allowed sources, cited, minimal, and treated as untrusted input.**

## Principles

1. **Official first.** A price is only VERIFIED when our own fetcher finds it verbatim, next to the plan name, on the vendor's official pricing page. Secondary sources can support a value; they never make it VERIFIED.
2. **Cite, don't copy.** We publish values (a price, a date, a yes/no), each with its source URL and at most a short verbatim quote as evidence. We never republish articles or pages. Page text is used in memory to find a value and then discarded; only a content hash is stored to notice changes.
3. **Respect the site.** robots.txt is honoured, requests are throttled, and the bot identifies itself and explains itself on the `/bot` page (`src/app/[locale]/bot/page.tsx`).
4. **Documented APIs under their terms.** Where a vendor offers an API for the data (GitHub, Hacker News via Algolia, YouTube, ECB), we use that instead of scraping, within its rate limits and terms.
5. **Untrusted input.** Everything fetched is data, never instructions: bodies are parsed as text, never rendered as HTML or executed. When text goes to the LLM, it is delimited as data and the output must validate against a schema (see [SECURITY.md](SECURITY.md)).

## The fetcher

All agent traffic goes through `src/agents/fetcher/http.ts`:

| Rule | Value |
| --- | --- |
| Protocols and ports | `http`/`https` only, ports 80/443, no credentials in URLs |
| SSRF guard | Every redirect hop's resolved IP must be public unicast. Private, loopback, link-local (including cloud metadata `169.254.169.254`), CGNAT, multicast, documentation and NAT64 ranges are blocked, and so are `localhost`, `.local` and `.internal` names. At most 5 redirects. |
| robots.txt | RFC 9309: groups matched on the product token `AIToolsWijzerBot` (case-insensitive), longest-match allow/disallow with `*` and `$`. Cached 24 h per host. A 401/403 on robots.txt counts as "disallow all"; a 404 as "allowed". |
| Throttle | ≥ 5 s between requests to the same host, at most 2 concurrent per host |
| Limits | 15 s timeout, 2 MB per body (16 KB for light reachability checks), content-type allow-list per request |
| Identity | `AGENT_USER_AGENT`, default `AIToolsWijzerBot/1.0 (+https://aitoolswijzer.nl/bot)` |
| No state | No cookies, no logins, no forms, no JavaScript execution (there is no headless browser) |
| APIs | The `api` option skips robots.txt only for documented API hosts (`api.github.com`, `hn.algolia.com`, `www.googleapis.com`); the SSRF guard and throttle still apply |

Tests use `fixtureFetcher()`, which serves canned pages, so no test touches the network.

## Sources by agent

| Source | Used by | Access | What we take | What we publish |
| --- | --- | --- | --- | --- |
| Official pricing pages | `pricing` | HTML, robots.txt, at most daily per page | plan prices found next to the plan name | price, currency, period, date, source URL, ≤ 600-char quote |
| Official home pages | `broken-link` | light GET (≤ 16 KB), about every 6 h | reachability only | "unreachable since <date>" after ≥ 3 failures over ≥ 24 h |
| Official changelogs, RSS/Atom | `change-detection` | feed XML, every 6 h | item title, link, date | Pulse event with the vendor's own title and link |
| GitHub REST API | `social`, `discovery` | `api.github.com` (optional `GITHUB_TOKEN` for a higher rate limit) | stars, releases; repository search for candidates | star counts over time, release events with link |
| Hacker News via Algolia API | `social`, `discovery` | `hn.algolia.com` | mention counts; Show HN posts as candidates | "buzz" event only above a threshold, with link |
| Media RSS/Atom feeds (`data/news/sources.json`) | `news` | the publishers' own feeds, robots.txt, hourly | headline, link, date | headline as written, outlet, date and a link to the publisher; never article text or summaries |
| YouTube channel feeds | `video`, `news` | public feed per channel, only where robots.txt allows (else skipped and named in the run summary) | video id, title, channel, date | tool videos: embedded (privacy-enhanced, loads on click); news: title, channel and a link to YouTube |
| YouTube Data API v3 | `video`, `news` (optional, `YOUTUBE_API_KEY`) | `www.googleapis.com`: channel uploads playlists (1 quota unit per call) and search | the same fields; search results for reviews/tutorials | the same; API data is refreshed within 30 days or removed, per the API terms. The privacy page names the YouTube API Services and links YouTube's terms and Google's privacy policy |
| ECB reference rates | `fx` | `eurofxref-daily.xml` | daily EUR rates | "≈ €x (ECB rate of <date>)", always labelled indicative |
| Candidate websites | `verification` | HTML, robots.txt | reachability, AI relevance, pricing and legal page presence, meta description | nothing public: a dossier for the owner, who decides |
| Affiliate link targets | `monetization` | light GET with a test sub-id | reachability | nothing; a broken link falls back to the direct link |
| Tool websites (LLM drafts) | `content` (optional) | HTML, robots.txt | title, meta description, ≤ 6,000 chars of text as input to Claude | a new text in our own words, labelled `ai_draft`, published only after owner approval |

The seed dataset in `data/` was compiled from public sources (official pages first). Every value in it lists its sources and observation date, and seed values are never marked VERIFIED until our own fetcher confirms them.

## What we store from external pages

- `sources`: URL, type, role and fetch bookkeeping (status, failures, robots result, content hash).
- `source_snapshots`: a hash and length per changed fetch (newest five per source), **not** the page text.
- Evidence snippets on facts, plans and pending changes: at most a short verbatim quote, needed to show why a value is what it is.
- Videos: id, title, channel and date, never the video itself.
- News items: headline, outlet, date, link and tagged experts; articles are removed after 90 days, YouTube items 30 days after the channel last listed them.
- Social signals: counts and links.

## What we never do

- Log in to vendor accounts, submit forms, bypass paywalls, solve CAPTCHAs or rotate IPs to get around blocks.
- Fetch pages disallowed by robots.txt, or keep crawling a site that blocks us. A blocked source goes stale on the site ("may be outdated") instead of being worked around.
- Use Product Hunt or other sources whose terms do not allow this use. (The schema has a `producthunt` enum value; no code reads or writes it.)
- Copy reviews, ratings or testimonials, or invent any metric.
- Render a JavaScript-only pricing page. There is no renderer (`sources.fetch_mode = 'render'` is reserved). Such a price stays at its last sourced value and ages to "possibly outdated". The pricing agent logs `reanchor_needed` in the action ledger (Admin → Operations), and the weekly report counts the tool under stale data.

## Corrections and takedowns

Vendors and visitors can report errors on `/{locale}/corrections`. Reports land in the owner inbox with the submitted evidence. A vendor's claim is treated as a lead, not as a verification: the pricing agent re-checks the official page.

A site owner can block the bot with:

```
User-agent: AIToolsWijzerBot
Disallow: /
```

It is picked up within 24 hours. The `/bot` page says this in every live language.

## Adding a source

1. Check the terms of service and robots.txt. If there is an official API, use it (and add its host to `API_HOSTS` only if it is a documented API).
2. Fetch through `ctx.fetcher` only. Record fetches with `recordFetch()`.
3. Store the value, the source URL and at most a short quote. Compute confidence with `computeConfidence()`, clamp the status with `maxStatus()`, and set `method` honestly.
4. Document it in the table above.
