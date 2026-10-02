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
| APIs | The `api` option skips robots.txt only for documented API hosts (`api.github.com`, `hn.algolia.com`, `www.googleapis.com`, `api.producthunt.com`); the SSRF guard and throttle still apply. `post` (a JSON body of at most 8 KB, e.g. a read-only GraphQL query) exists only for these hosts over HTTPS and follows no redirects |

Tests use `fixtureFetcher()`, which serves canned pages, so no test touches the network.

## Sources by agent

| Source | Used by | Access | What we take | What we publish |
| --- | --- | --- | --- | --- |
| Official pricing pages | `pricing` | HTML, robots.txt, at most daily per page | plan prices found next to the plan name | price, currency, period, date, source URL, ≤ 600-char quote |
| Official home pages | `broken-link`, `pricing` | light GET (≤ 16 KB), hourly in small batches, a site at most every 5.5 h; `pricing` reads a home page once to find the link to the official pricing page (tools whose plans have none) | reachability; the pricing link | "unreachable since <date>" after ≥ 3 failures over ≥ 24 h; the pricing page becomes a monitored source |
| Official changelogs, RSS/Atom | `change-detection` | feed XML, every 6 h | item title, link, date | Pulse event with the vendor's own title and link |
| GitHub REST API | `social`, `discovery` | `api.github.com` (optional `GITHUB_TOKEN` for a higher rate limit) | stars, releases; repository search for candidates | star counts over time, release events with link |
| Hacker News via Algolia API | `social`, `discovery` | `hn.algolia.com` | mention counts; Show HN posts as candidates | "buzz" event only above a threshold, with link |
| Media RSS/Atom feeds (`data/news/sources.json`) | `news` | the publishers' own feeds, robots.txt, hourly | headline, link, date | headline as written, outlet, date and a link to the publisher; never article text or summaries |
| YouTube channel feeds | `video`, `news` | public feed per channel, only where robots.txt allows (else skipped and named in the run summary) | video id, title, channel, date | tool videos: embedded (privacy-enhanced, loads on click); news: title, channel and a link to YouTube |
| YouTube Data API v3 | `video`, `news` (optional, `YOUTUBE_API_KEY`) | `www.googleapis.com`: channel uploads playlists (1 quota unit per call) and search | the same fields; search results for reviews/tutorials | the same; API data is refreshed within 30 days or removed, per the API terms. The privacy page names the YouTube API Services and links YouTube's terms and Google's privacy policy |
| ECB reference rates | `fx` | `eurofxref-daily.xml` | daily EUR rates | "≈ €x (ECB rate of <date>)", always labelled indicative |
| Hacker News via Algolia API | `discovery` (tool scout) | `hn.algolia.com`, hourly | Show HN, "Launch HN" and stories that launch a named AI product: id, points, comments, date (never the author) | with a published tool: "Hacker News · 231 points" with a link and date |
| GitHub search API | `discovery` (tool scout) | `api.github.com`, hourly, 4 queries | new repositories of organisations with AI topics: stars, creation date, license id (persons' repositories are skipped: a user name is personal data) | with a published tool: "GitHub · 4,200 stars" with a link and date; an open-source license as a fact |
| Makers' news feeds (`data/discovery/sources.json`) | `discovery` (tool scout) | the makers' own RSS/Atom feeds, robots.txt, hourly; the launch post itself (at most 6 per run) | launch posts ("Introducing …", "… is now available"): name, link, date, and the product link in the post | with a published tool: "announcement by OpenAI" with a link |
| Product Hunt API | `discovery` (tool scout), **only with `PRODUCTHUNT_TOKEN`** | `api.producthunt.com` (GraphQL), hourly; its product links only where producthunt.com's robots.txt allows following them | AI launches: id, votes, date, post link (never makers or taglines) | with a published tool: "Product Hunt · 420 votes" with a link and date |
| Candidate websites | `verification`, `new-tools` (tool scout) | HTML, robots.txt; home page, pricing page, the site's own feed | reachability, AI relevance, the name, title and meta description, pricing (free plan, prices), legal pages, a launch post | in quarantine: name, URL, the meta description as a literal quote (≤ 160 characters, with the URL), functions and anchored pricing facts, all UNVERIFIED with their source |
| simple-icons (dev dependency, CC0) | `new-tools` (tool scout) | the installed package, no network | an icon whose `source` or `guidelines` host equals the tool's own domain | the logo's path and brand colour, served by the site itself |
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
- Tool candidates: name, URL, domain and the signals' ids, counts, dates and links; never descriptions, article text or people's user names.

## What we never do

- Log in to vendor accounts, submit forms, bypass paywalls, solve CAPTCHAs or rotate IPs to get around blocks.
- Fetch pages disallowed by robots.txt, or keep crawling a site that blocks us. A blocked source goes stale on the site ("may be outdated") instead of being worked around.
- Use sources whose terms do not allow this use. Product Hunt's API terms ask for permission for commercial use: the tool scout reads it only when the owner set `PRODUCTHUNT_TOKEN` after getting that permission; otherwise it is skipped and the weekly report says so.
- Scrape other AI-tool directories (There's An AI For That, Futurepedia, Toolify and the like): their selection is their work. They are never fetched and never a candidate.
- Use media headlines as a popularity signal: they can only be linked to a tool by its name, and namesakes would put wrong signals on a tool.
- Match a logo by name: only by the tool's own domain.
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
