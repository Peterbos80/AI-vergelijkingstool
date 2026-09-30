# Security

This document covers the threat model, the controls in the code, how secrets are handled, the known limitations, and how to report a vulnerability. Design background (in Dutch): [`docs/strategy/02-red-team.md`](strategy/02-red-team.md) and [`06-technical-architecture.md`](strategy/06-technical-architecture.md).

## What we protect, and from whom

| Asset | Threat | Main controls |
| --- | --- | --- |
| Correctness of published data | poisoned pages, manipulated feeds, a vendor gaming its page, our own bugs | evidence-based confidence, confirmation by repetition, hard rules, anomaly freeze, reversible ledger, monthly audit |
| The owner area | credential stuffing, session theft, CSRF | scrypt, rate limits, hashed session tokens, strict cookies, same-origin server actions, audit log, login-spike alert |
| Visitors | XSS, tracking, data leaks | nonce CSP, React escaping, cookieless analytics, data minimisation, retention |
| Our infrastructure and budget | SSRF through agents, LLM cost abuse, API scraping, spam | SSRF guard on every hop, per-visitor and daily LLM caps, rate limits everywhere, double opt-in |
| The LLM | prompt injection from pages or user queries | untrusted text delimited as data, no tools, schema-validated output constrained to catalog ids |
| Secrets | leakage in code, logs or responses | environment only, constant-time comparison, secret scanning |

## Controls

### HTTP

- **CSP per request** (`src/proxy.ts`): `script-src 'self' 'nonce-…' 'strict-dynamic'`, no inline script without the nonce, `object-src 'none'`, `frame-ancestors 'none'`, `form-action 'self'`, `base-uri 'self'`. Images come only from self, data/blob URIs and `i.ytimg.com`; frames only from `www.youtube-nocookie.com`. On HTTPS, `upgrade-insecure-requests` is added.
- **Headers on every response** (`next.config.ts`): HSTS (2 years, preload), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, a restrictive `Permissions-Policy`, and `Cross-Origin-Opener-Policy: same-origin`. API routes get `default-src 'none'`. `/admin` gets `noindex` and `Cache-Control: private, no-store`.
- JSON-LD is serialised with `<` escaped (`JsonLd.tsx`), so data cannot break out of the script tag.

### Owner authentication and authorisation

- **Passwords**: scrypt, memory-hard, with per-password salt (`src/lib/auth/password.ts`). Accounts are created from the CLI only (`npm run admin:create`); resetting a password revokes that user's sessions.
- **Sessions**: a random 256-bit token in cookie `aitw_admin`: `HttpOnly`, `SameSite=Strict`, `Path=/admin`, and `Secure` on HTTPS. The database stores only the SHA-256 of the token. Expiry is sliding, 7 days.
- **Login**: rate-limited to 20 attempts per 15 min per client address and 5 per 15 min per e-mail. The e-mail is hashed in the rate-limit key and the audit log. Unknown e-mails are verified against a dummy hash, so response time does not reveal which accounts exist. 20 or more failed logins in an hour raise a **security P1**, which is e-mailed to the owner.
- **Roles**: owner > editor > viewer. Every server action calls `requireAdmin(role)` before doing anything; the UI hiding a button is not the control. Every write lands in `audit_log`.
- **CSRF**: all writes are Next.js server actions, which only accept same-origin requests (Origin is checked against Host), and the session cookie is `SameSite=Strict`.
- **No reflection**: flash messages come from a whitelist of keys, never from URL text. Return paths after actions must match `^/admin(/[A-Za-z0-9-]+){0,4}$`.

### Input validation

Every external input is parsed with Zod before use: form fields, API query parameters, environment variables (`src/lib/env.ts`), owner settings (invalid stored values fall back to safe defaults), seed files, agent API responses and LLM output. IDs are checked against UUID or catalog patterns, and GitHub repositories and YouTube channel ids against strict patterns (`src/lib/validate.ts`).

### Rate limits

Fixed windows in Postgres (`rate_limits`), shared by every instance. Keys contain a hash of the client address (for visitor forms, the daily visitor hash), never the address itself.

| Endpoint | Limit |
| --- | --- |
| Public API `/api/v1/*` | 60 / min per client |
| Match with the LLM | 40 / hour per visitor (then the lexical engine), plus the daily USD budget |
| Save a stack | 30 / hour |
| Newsletter / Watch sign-up | 10 / hour |
| Corrections | 10 / hour |
| Advice requests | 5 / hour |
| Admin login | 20 / 15 min per address, 5 / 15 min per e-mail |
| Cron endpoint | 30 / min |

**Client address.** `X-Forwarded-For` is a list that clients can prepend to. `clientIp()` therefore takes the address `TRUSTED_PROXY_HOPS` entries from the right (default 1: the address our own proxy saw). Set it to the number of proxies in front of the app, and never expose the Node server directly without one.

If the database is unreachable, the limiter fails open. Availability wins there, and the LLM budget and double opt-in still bound abuse.

### Agents and external content

- **SSRF guard**: before connecting, every URL and every redirect hop is resolved, and private, loopback, link-local (including cloud metadata), CGNAT, multicast, documentation and NAT64 ranges are refused. Only `http`/`https` on ports 80/443 are allowed, with no credentials in URLs. See [DATA_SOURCES.md](DATA_SOURCES.md).
- **Isolation**: agents run in the worker process (or the cron endpoint), with size and time limits, a content-type allow-list, no cookies and no JavaScript execution. Fetched bodies are only ever handled as text.
- **Blast radius**: policy bands, hard rules, the anomaly freeze and confirmation by repetition limit what a manipulated page can change. Every change is in the ledger and most are one command to revert.

### LLM (prompt injection)

`src/lib/llm/client.ts`:

- The system prompt is fixed. User queries and fetched page text are passed only inside delimiter tags via `asData()`, which neutralises look-alike tags so the text cannot close the block.
- The model has **no tools** and cannot trigger actions. Output must validate against a Zod schema (structured outputs), otherwise it is discarded. Match intent may only name catalog ids; unknown ids are dropped.
- There is a hard daily spend cap (the lower of `LLM_DAILY_BUDGET_USD` and the owner setting) and a per-visitor hourly cap. Every call is metered in `llm_usage`. Every LLM feature has a deterministic fallback.
- Generated text is never published directly. Drafts are labelled `ai_draft` and need owner approval. A "no new numbers" check rejects drafts that contain figures not present in the source.

### Output and redirects

- React escapes all output. The only raw HTML is JSON-LD, which is escaped as described above.
- `/go/[slug]` is not an open redirect. The slug must be a catalog tool, and the target is that tool's website, or an active affiliate template validated when saved (https, no credentials, a real host).
- Stack editing requires a random edit token; only its hash is stored.

### Privacy

Analytics are cookieless: a daily-rotating salted hash of IP and user agent, with the salt never stored and the IP never stored. Match queries are scrubbed and deleted after 90 days. E-mail uses double opt-in, and unconfirmed sign-ups are deleted after 30 days. The full retention table is in [DATABASE.md](DATABASE.md).

## Secrets

- Secrets live only in environment variables (see `.env.example`); no secret is ever committed. `APP_SECRET` must be at least 32 characters in production; without it, the first request that needs it fails rather than falling back to a development value. `CRON_SECRET` must be at least 16, or the cron endpoint answers 503.
- The cron bearer token is compared in constant time (`safeEqual`).
- Secrets never reach the client bundle: only server code reads `env()`, and nothing is exposed with `NEXT_PUBLIC_`.
- Rotation: change the variable and restart. `APP_SECRET` only salts the daily visitor hash, so rotating it merely splits one day's visitor counts. Admin sessions and stack edit tokens are independent random tokens stored as hashes.
- Enable GitHub secret scanning and push protection on the repository.

## Known limitations

- **No second factor for admin login yet.** Use a long unique password and keep the admin user count small. The login-spike P1 helps detect attacks.
- No WAF or CAPTCHA: public forms rely on rate limits, double opt-in and validation. Put the site behind a CDN with bot protection for launch.
- The rate limiter fails open when the database is down, as described above.
- Owner-entered revenue and CSV imports are trusted after validation; they only affect Admin, never the public site.

## Reporting a vulnerability

When `LEGAL_EMAIL` is configured, `/.well-known/security.txt` (RFC 9116) publishes it as the contact. Without it, no placeholder is published and the route answers 404. Please report privately and allow reasonable time for a fix before disclosure.

## Checklist for changes

- A new write path is a server action or route that calls `requireAdmin` (admin) or `rateLimit` (public), validates with Zod, and writes `audit_log` (admin).
- New external content goes through `ctx.fetcher` and is treated as text.
- New LLM use goes through `callStructured()` with a schema, `asData()` for untrusted text, and a fallback.
- The engine never imports monetisation code (`tests/integration/engine.test.ts`).
- No new cookies without updating the privacy page.
