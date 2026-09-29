# 07 — Databaseschema

**Engine:** PostgreSQL 16 (productie), PGlite (tests). **ORM:** Drizzle. **Migraties:** SQL-bestanden in `drizzle/`. De technische referentie met alle kolommen staat in `docs/DATABASE.md` en in `src/lib/db/schema.ts` (de bron van waarheid).

## 1. Ontwerpprincipes

1. **Feiten met provenance, snapshot voor snelheid.** Elk feit (en elk prijsplan) is een rij met bron, bronzin, status, confidence, `observed_at`, `verified_at` en een geldigheidsperiode (`valid_from`, `valid_to`). De tabel `tools` bevat een **gedenormaliseerde snapshot** van de huidige waarden, die opnieuw wordt berekend bij elke wijziging.
2. **Historie door geldigheid, niet door overschrijven.** Wijzigt een prijs, dan krijgt de oude rij een `valid_to` en komt er een nieuwe rij bij. De Time Machine is daardoor een gewone query.
3. **Vertaalbaar via `*_i18n`-tabellen:** (entiteit, locale) → teksten en slug. Er staan geen teksten in de kern-tabellen.
4. **Alles wat autonoom gebeurt, is herleidbaar:** `agent_runs` → `agent_actions`, en menselijke acties staan in `audit_log`.
5. **Privacy by design:** geen IP-adressen of cookies in analytics, gescrubde queries met een bewaartermijn, e-mail alleen met double opt-in.
6. **Monetisatie apart:** affiliate- en sponsortabellen worden nooit door de ranking-module gelezen.

## 2. Domeinen en tabellen

### A. Taxonomie (de "knowledge graph"-ruggengraat)

| Tabel | Belangrijkste kolommen | Doel |
|---|---|---|
| `categories` / `category_i18n` | id, position · (locale, name, slug, description) | Tekst, Beeld, Video, Audio, Code, Automatisering, … |
| `capabilities` / `capability_i18n` | id, category_id · (name, slug, description, **synonyms[]**) | Fijnmazige vermogens (tekst-naar-spraak, clips maken, …). Synoniemen per taal voeden de lexicale intentie-engine |
| `tasks` / `task_i18n` | id, category_id, position, status · (title, slug, summary, **intent_phrases[]**) | Jobs-to-be-done ("social-media-video's maken") |
| `task_steps` / `task_step_i18n` | task_id, position, key, **capability_ids[]**, required · (label, hint) | De workflow: welke capabilities per stap |

### B. Tools en feiten

| Tabel | Belangrijkste kolommen | Doel |
|---|---|---|
| `companies` | slug, name, website, country | Maker, land (EU-lens) |
| `tools` | slug, name, website_url, pricing_url, changelog_url, rss_url, github_repo, youtube_channel_id, company_id, status, published · **snapshot:** pricing_model, has_free_tier, api_available, open_source, self_hostable, supports_dutch, eu_data_residency, gdpr_dpa, platforms[], model_dependencies[], entry_price (cents, valuta, periode), confidence, freshness, last_checked_at, last_changed_at, last_verified_at, price_checked_at, website_checked_at, features_checked_at, social_checked_at, video_checked_at, website_status, quality_score, quality_issues, indexable | Toolrecord plus leessnapshot |
| `tool_i18n` | tool_id, locale, tagline, description, best_for[], not_for[], limitations[], content_status | Redactionele content per taal |
| `tool_capabilities` | tool_id, capability_id, strength (primary/secondary) | Wat de tool kan |
| `tool_relations` | tool_id, related_tool_id, kind (alternative, integrates_with, built_on, complements), source (editorial/computed), score | Alternatieven, integraties, modelafhankelijkheid |
| `sources` | url, domain, **source_type** (official, official_docs, changelog, github, media, secondary, community, social, video, api), last_fetched_at, last_status, last_content_hash, robots_allowed, fetch_mode, failure_count | Elke bron één keer |
| `source_snapshots` | source_id, fetched_at, http_status, content_hash, text (alleen de laatste 2 per bron), changed | Wijzigingsdetectie (hash en diff) |
| `facts` | tool_id, **key**, value (jsonb), **status** (verified/supported/community/unverified), **confidence**, source_id, extra_source_ids[], **evidence** (letterlijke bronzin), method, observed_at, verified_at, **valid_from, valid_to**, created_by, review_status | De bron van waarheid voor elk datapunt |
| `pricing_plans` | tool_id, plan_key, name, price_cents, currency, billing_period, price_unit, monthly_equivalent_cents, is_free, is_custom, quota, status, confidence, source_id, evidence, observed_at, verified_at, **valid_from, valid_to**, review_status | Plannen plus prijshistorie |
| `change_events` | tool_id, kind (price_increase, price_decrease, plan_added, free_tier_removed, feature, release, status_change, shutdown, new_tool, website_down, buzz, video, news…), title{locale}, summary{locale}, old_value, new_value, source_id, source_url, source_type, occurred_at, detected_at, detected_by, confidence, significance, status | Pulse en Stack Diff |
| `videos` | tool_id, provider, video_id, title, channel, kind (official/review/tutorial/comparison), published_at, source, status, relevance, verified_at | Video's per tool |
| `social_signals` | tool_id, provider (github, hackernews, youtube), metric, value, observed_at, url | Tijdreeksen voor momentum |
| `fx_rates` | date, quote, rate, source_url | ECB-referentiekoersen voor EUR-schattingen |

**Feitsleutels (`facts.key`) in de MVP:** `has_free_tier`, `has_free_trial`, `pricing_public`, `api_available`, `open_source`, `self_hostable`, `platforms`, `supports_dutch`, `eu_data_residency`, `gdpr_dpa`, `trains_on_user_data`, `commercial_use_free_tier`, `watermark_free_tier`, `model_dependencies`, `status`. Nieuwe sleutels vergen geen migratie.

### C. Agents en operations

| Tabel | Doel |
|---|---|
| `agent_configs` | Per agent: enabled, schedule, autonomy (auto / queue_only / off), config, next_run_at |
| `agent_runs` | Elke run: trigger, status, stats, samenvatting, fout |
| `agent_actions` | Elke actie: agent, entiteit, veld, oud → nieuw, bron, confidence, **beslissing** (auto_published, auto_published_flagged, queued, needs_human, rejected, info), reden |
| `review_items` | Menselijke queue: kind (fact_change, price_change, new_tool, duplicate, content_draft, broken_link, correction, status_change), payload, confidence, prioriteit, status |
| `tool_candidates` | Ontdekte tools (HN, GitHub, RSS, inzending) met signalen en status |
| `error_log` | Fouten (gededupliceerd per fingerprint en dag) |
| `llm_usage` | Per dag en doel: calls, tokens, geschatte kosten |
| `settings` | Drempels, versheidsvensters, feature flags, LLM-budget, `data_version` |
| `rate_limits` | Sleutel + tijdvenster → teller (werkt over meerdere instanties) |

### D. Gebruikers, stacks en relaties

| Tabel | Doel |
|---|---|
| `admin_users`, `admin_sessions`, `audit_log` | Beheer-auth (scrypt, gehashte sessietokens) en menselijke acties |
| `stacks`, `stack_items` | Opgeslagen stacks (public_id, edit_token_hash, taak, eisen, **snapshot bij opslaan** voor de Stack Diff) |
| `subscribers` | E-mail met double opt-in (tokens gehasht), locale, toestemmingstekst en tijdstip |
| `watches` | Abonnement op een stack of tool (frequentie, last_notified_at) |
| `email_outbox` | Uitgaande mail (verzonden, of gelogd als er geen provider is) |
| `leads` | B2B-aanvragen (stackadvies) met toestemming en status |

### E. Analytics en monetisatie

| Tabel | Doel |
|---|---|
| `events` | Privacyvriendelijke events: type, pad, paginatype, locale, entiteit, **bezoekershash** (dagelijks roterende salt; geen IP of cookie), referrer-domein, UTM, apparaat |
| `match_queries` | Gescrubde query (max 300 tekens, na 90 dagen gewist), engine, taak, capabilities, eisen, confidence, getoonde tools |
| `affiliate_programs` | Netwerk, status, commissietype en -waarde, cookieduur, voorwaarden, **bronstatus van deze info** |
| `affiliate_links` | URL-template met `{click_id}` (subID), actief, laatste controle |
| `outbound_clicks` | **click_id** (ook de subID), tool, linktype, pagina, positie, match_query_id, bezoekershash |
| `conversions` | Geïmporteerd (csv/api/handmatig): click_id, programma, bedrag, status (pending/approved/reversed/paid) |
| `revenue_entries` | Niet-affiliate-omzet (sponsoring, nieuwsbrief, leads, data) |
| `placements` | Gelabelde sponsorslots (slot, periode, prijs). Worden nooit in organische resultaten gemengd |

## 3. Belangrijkste indexen

- `facts (tool_id, key) WHERE valid_to IS NULL`: de huidige feiten.
- `pricing_plans (tool_id) WHERE valid_to IS NULL`, plus `(tool_id, valid_from)` voor de historie.
- `change_events (status, detected_at DESC)` en `(tool_id, detected_at DESC)`.
- `events (ts)`, `(type, ts)`, `(page_type, ts)`; `outbound_clicks (ts)`, `(tool_id, ts)`, `(page_path)`.
- `agent_actions (run_id)`, `(created_at DESC)`; `review_items (status, priority DESC)`.
- Unieke sleutels: slugs per locale, `sources.url`, `stacks.public_id`, `(provider, video_id, tool_id)`, `(program_id, external_id)`.

## 4. Snapshotberekening

`recomputeToolSnapshot(toolId)`:
1. Leest de huidige feiten (`valid_to IS NULL`, review_status = published) en zet ze om naar snapshotkolommen.
2. Het instapplan is het goedkoopste betaalde plan (maandequivalent); `has_free_tier` komt uit het feit, anders uit een gratis plan.
3. De confidence van de tool is het gewogen gemiddelde van de kritieke feiten (prijs ×3, status ×2, overige ×1).
4. Versheid volgt de versheidsregels (document 08 §6).
5. Kwaliteit en indexeerbaarheid volgen de poorten uit document 05 §5.
6. Tot slot `data_version++`.

## 5. Bewaartermijnen

| Data | Termijn |
|---|---|
| `match_queries.query_scrubbed` | 90 dagen, daarna NULL (aggregaten blijven) |
| `events` | 13 maanden |
| `source_snapshots.text` | Alleen de laatste 2 per bron; oudere houden alleen de hash |
| `agent_actions` | 24 maanden |
| `email_outbox` (body) | 30 dagen |
| `subscribers` (afgemeld) | E-mail na 30 dagen gehasht (voor suppressie) |
| Videometadata (YouTube API) | Periodiek ververst (API-voorwaarden) |
