# 06 — Technische architectuur

## 1. Overzicht

```
                        ┌──────────────────────────────────────────────┐
  Browser ──HTTPS──▶    │  Web (Next.js 16, App Router, React 19)      │
  (nl/en/…)             │  • Server Components (SSR) per locale        │
                        │  • Route handlers: /api, /go, /api/v1        │
                        │  • Admin (/admin) met sessie-auth            │
                        │  • App-cache (LRU + dataversie)              │
                        └───────┬───────────────┬──────────────────────┘
                                │ SQL (pg)      │ HTTPS (optioneel)
                                ▼               ▼
                        ┌──────────────┐   ┌───────────────────────┐
                        │ PostgreSQL 16│   │ Anthropic API (Claude)│
                        │ (Drizzle)    │   │ intentie, extractie,  │
                        └──────▲───────┘   │ concepten             │
                               │ SQL       └───────────▲───────────┘
                        ┌──────┴───────────────────────┴──────────┐
                        │  Agent worker (Node, zelfde codebase)    │
                        │  • Scheduler (advisory locks)            │
                        │  • 16 agents (Discovery … Notifier)      │
                        │  • Veilige fetcher (SSRF, robots, rate)  │
                        │  • Optioneel: Playwright-renderer        │
                        └──────┬──────────────────────────────────┘
                               │ HTTPS (alleen toegestane bronnen)
                               ▼
        Officiële sites, prijspagina's, changelogs/RSS, GitHub API, HN Algolia API,
        YouTube Data API, ECB-wisselkoersen, (Product Hunt API, optioneel)

        E-mail: Resend (optioneel) → anders outbox-tabel (zichtbaar in Admin)
```

**Kernidee:** web en agents delen één codebase en één database, maar draaien als **losse processen**. De web-app blijft snel en voorspelbaar, en agents mogen traag of zwaar zijn (Playwright) zonder de site te raken.

## 2. Technologiekeuzes en onderbouwing

| Laag | Keuze | Waarom | Alternatief overwogen |
|---|---|---|---|
| Framework | **Next.js 16 (App Router)** | SSR voor SEO, server components (weinig client-JS), route handlers, OG-images, grote community | Remix/React Router (minder ecosysteem voor OG/SEO), Astro (minder geschikt voor interactieve app-delen) |
| Taal | **TypeScript (strict)** | Een gedeeld datamodel tussen web en agents; overdraagbaarheid | — |
| Styling | **Tailwind CSS 4** + design tokens (CSS-variabelen) | Snel, consistent, geen runtime | CSS Modules (trager bouwen) |
| Database | **PostgreSQL 16** | JSONB, sterke indexen, gratis managed opties (Neon/Supabase), later pgvector | SQLite/libSQL (goedkoper, maar minder geschikt voor analytics en joins op schaal) |
| ORM/migraties | **Drizzle ORM + drizzle-kit** | Type-safe, SQL-dichtbij, migraties als SQL-bestanden | Prisma (zwaardere runtime) |
| Tests-DB | **PGlite** (Postgres in WASM, in-process) | Echte Postgres-semantiek zonder server; snelle, geïsoleerde tests | Docker-Postgres (trager, extra afhankelijkheid) |
| Validatie | **Zod 4** | Alle invoer (API, LLM-output, seed) | — |
| LLM | **Anthropic SDK (Claude)**, optioneel | Gestructureerde output (tool use), sterke instructievolging; alles heeft een deterministische fallback | OpenAI (kan via een adapter) |
| HTML-parsing | **cheerio** | Robuuste tekstextractie uit HTML | Regex (te broos) |
| RSS/Atom | **fast-xml-parser** | Licht, snel | rss-parser |
| E2E-tests | **Playwright** + axe-core | Echte browser, visuele regressie, a11y | Cypress |
| Unit/integratie | **Vitest** | Snel, TS-native | Jest |

## 3. Rendering en caching

- **Publieke pagina's worden dynamisch server-side gerenderd.** Een build heeft dus nooit een database nodig (belangrijk voor Docker, CI en previews).
- **App-cache:** een in-memory LRU met TTL rond alle leesqueries (catalogus, toolpagina's, Pulse). Een `data_version`-teller in de database wordt verhoogd bij elke publicatie door agents of admin. Elke instantie controleert die teller hooguit elke 30 s en leegt de cache bij een wijziging. Dit werkt ook bij meerdere instanties zonder Redis.
- **Match-engine:** de catalogus (tools, capabilities, taken, synoniemen) wordt als in-memory index opgebouwd (±150 tools ≈ enkele MB). Zoeken en scoren duren < 5 ms.
- **HTTP-caching:** statische assets zijn immutable. Voor HTML volstaat de app-cache; een CDN-cache is een latere optimalisatie.
- **Client-JS alleen waar interactie nodig is:** Match-invoer, verduidelijkende vragen, vergelijkingsselectie, opslaan/delen, ticker-pauze, admin-tabellen.

## 4. Modulestructuur

```
src/
  app/                    Next.js routes
    [locale]/…            publieke pagina's
    admin/…               beheer
    api/…                 route handlers
    go/[slug]/route.ts    outbound redirect + tracking
  components/             UI-bouwstenen (Receipt, Stamp, FreshnessDial, …)
  i18n/                   locale-config, berichten (nl/en/de/fr), helpers
  lib/
    db/                   schema (Drizzle), client, queries
    catalog/              geladen catalogus + zoekindex
    engine/               intent (lexicaal + LLM), clarify, compose, score, cost, doctor, compare, explain
    provenance/           confidence, status, beslisbeleid
    evidence/             normalisatie, bronzin-verankering, prijsextractie
    freshness/            versheidsregels
    fetcher/              veilige fetcher (SSRF, robots, rate limit, grootte)
    llm/                  Claude-client, prompts, guards, budget
    analytics/            events, bezoekershash
    monetization/         links, kliks, conversies, EPC
    security/             auth, sessies, rate limiter, headers
    seo/                  metadata, JSON-LD, indexeerbaarheid, sitemap
    email/                verzending (Resend) + outbox
  agents/                 agent-framework + 16 agents + scheduler
scripts/                  migrate, seed, agents CLI, worker, admin:create
data/                     seed: taxonomie, tools (1 bestand per tool), events, video's
drizzle/                  SQL-migraties
tests/                    unit, integration, e2e (Playwright), fixtures
docs/                     strategie (NL) + ontwikkelaarsdocumentatie (EN)
```

## 5. Datastroom: van bron naar pagina

```
Bron (officiële prijspagina)
  → Fetcher (robots, SSRF, rate, hash)
  → Agent (bijv. Pricing): is de bronzin er nog? Nieuwe kandidaten?
  → Confidence (bewijs) → Beleid (auto / auto+markering / queue / mens)
  → Feit (nieuwe versie, oude krijgt valid_to) + wijzigingsevent + agent_action (audit)
  → Snapshot van de tool wordt herberekend
  → data_version++ → app-cache leeg → pagina toont nieuwe waarde + historie
  → Notifier: watchers van deze tool krijgen een digest
```

## 6. LLM-integratie (optioneel, nooit kritiek)

| Taak | Model | Guardrails |
|---|---|---|
| Intentie parsen (Match/Doctor) | snel model (Haiku-klasse) | Output = JSON volgens een Zod-schema; taken en capabilities alleen uit de catalogus (enum); bij fout valt de lexicale engine in |
| Prijsextractie bij gewijzigde pagina | slim model (Sonnet-klasse) | Bron als *data* afgebakend; elke geëxtraheerde prijs moet letterlijk in de brontekst staan; zonder bewijs verworpen |
| Samenvatting van het resultaat | snel model | Mag alleen feiten uit de meegegeven JSON gebruiken; een "no new numbers"-guard: elk getal in de output moet in de input staan, anders volgt een template |
| Conceptbeschrijvingen/vertalingen | slim model | Gaan altijd naar de review-queue, nooit automatisch live |

**Kostenbeheersing:** rate limit per IP, een dagbudget (calls en tokens) in de database, caching per genormaliseerde query en automatische fallback. Het gebruik is zichtbaar in Admin.

## 7. Beveiligingsarchitectuur (samenvatting; details in SECURITY.md)

- **Admin-auth:** gebruikers in de DB, scrypt-hashes, sessietokens (gehasht opgeslagen), HttpOnly/Secure/SameSite=Lax-cookies, rollen (owner/editor/viewer), login-rate-limit, origin-check op mutaties.
- **Invoer:** Zod op elke grens; lengtelimieten; PII-scrubbing van Match-queries vóór opslag.
- **Uitvoer:** security headers (CSP, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, frame-ancestors).
- **Externe content is onbetrouwbaar:** HTML wordt nooit als HTML gerenderd, alleen als tekst. LLM-prompts bakenen brontekst af als data. Er is geen tool-executie op basis van externe content.
- **Scraper-isolatie:** een aparte worker-process, SSRF-guard (DNS → private ranges geblokkeerd, bij elke redirect opnieuw), groottelimieten, time-outs, een allowlist van content-types, robots.txt en rate limiting per domein.
- **Geheimen:** alleen via environment variables; `.env.example` zonder waarden; server-only modules.
- **Open redirect:** `/go/{slug}` redirect alleen naar URL's uit de database.

## 8. Deploymentopties

| Topologie | Web | DB | Agents | Kosten (indicatie) |
|---|---|---|---|---|
| **A. Managed** | Vercel (Pro, want Hobby is niet-commercieel) | Neon Postgres | GitHub Actions cron (nachtelijk) → `npm run agents -- due` | €20–45/mnd |
| **B. Eén VPS** | Docker (Next standalone) | Postgres-container | Worker-container met scheduler | €6–15/mnd |
| **C. Hybride** | Vercel | Neon | Kleine VPS/Fly.io-worker (Playwright) | €25–40/mnd |

Een build heeft geen database nodig. Migraties draaien als aparte stap (`npm run db:migrate`).

## 9. Schaalpad

| Schaal | Aanpassing |
|---|---|
| ≤ 2.000 tools, ≤ 200k bezoeken/mnd | Huidige opzet |
| ≤ 20.000 tools | Zoekindex naar Postgres FTS + pg_trgm, of Meilisearch; catalogus gedeeltelijk laden |
| ≥ 1M bezoeken/mnd | CDN-caching van HTML (ISR/tag-revalidatie), read-replica, events naar een aparte analytics-store (ClickHouse) |
| Meer agents en bronnen | Een queue (pg-boss/Graphile Worker) in plaats van de eenvoudige scheduler; horizontale workers |
| Semantisch matchen | pgvector-embeddings per taak en tool als aanvulling op de lexicale en LLM-intentie |

## 10. Observability

- **agent_runs / agent_actions:** elke autonome actie met agent, bron, oud → nieuw, confidence, beslissing en tijdstip (de "wat deed het systeem vannacht"-weergave).
- **error_log:** fouten uit app en agents, met context (geen PII).
- **llm_usage:** per dag het aantal calls, tokens en de geschatte kosten.
- **Health endpoint** `/api/health`: DB-connectiviteit, cacheversie, de leeftijd van de laatste agent-run.
- **Gestructureerde logs** (JSON) naar stdout voor elk hostingplatform.
