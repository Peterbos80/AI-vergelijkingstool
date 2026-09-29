# 11 — MVP-roadmap

## 1. Prioriteitenmatrix

Score 1–5 (5 = hoogst; bij Effort betekent 5 = *weinig* werk). **Totaal = Impact×2 + Revenue + Retention + Differentiation×2 + Effort.**

| # | Feature | Impact | Effort (5=licht) | Revenue | Retention | Differentiation | Totaal | Besluit |
|---|---|---|---|---|---|---|---|---|
| 1 | Match: natural-language intentie → stack | 5 | 2 | 4 | 3 | 5 | 29 | **MVP** |
| 2 | Tooldatabase met provenance (feiten, status, bronnen) | 5 | 2 | 3 | 3 | 5 | 28 | **MVP** |
| 3 | Toolpagina's (incl. prijzen, EU-lens, vitals) | 5 | 3 | 4 | 2 | 4 | 27 | **MVP** |
| 4 | Stack-kostenrekening | 4 | 4 | 3 | 2 | 5 | 27 | **MVP** |
| 5 | Freshness engine + stempels | 4 | 4 | 1 | 2 | 5 | 25 | **MVP** |
| 6 | Vergelijken (matrix + verdicts) | 4 | 3 | 4 | 1 | 4 | 24 | **MVP** |
| 7 | Stack Doctor | 4 | 3 | 4 | 3 | 5 | 28 | **MVP** |
| 8 | Alternatievenpagina's | 4 | 4 | 4 | 1 | 3 | 23 | **MVP** |
| 9 | Zoeken + filters (verkenner) | 4 | 4 | 2 | 1 | 1 | 17 | **MVP** (verplicht, niet onderscheidend) |
| 10 | Verduidelijkende vragen | 3 | 4 | 2 | 1 | 4 | 21 | **MVP** |
| 11 | Affiliate-tracking (/go, subID, import) | 3 | 4 | 5 | 0 | 1 | 17 | **MVP** |
| 12 | Analytics (privacyvriendelijk) + €500-dashboard | 4 | 3 | 5 | 0 | 2 | 20 | **MVP** |
| 13 | Admin (tools, queue, operations, revenue) | 4 | 2 | 3 | 0 | 3 | 19 | **MVP** |
| 14 | Agents: link-, prijs-, change- en kwaliteitschecks | 5 | 2 | 2 | 3 | 5 | 27 | **MVP** |
| 15 | Pulse (echte wijzigingen) + ticker | 3 | 4 | 1 | 3 | 4 | 22 | **MVP** |
| 16 | Stack opslaan/delen (zonder account) | 3 | 4 | 2 | 4 | 3 | 22 | **MVP** |
| 17 | Stack Watch-alerts (double opt-in, digest) | 4 | 3 | 2 | 5 | 5 | 28 | **MVP** |
| 18 | SEO-basis (metadata, hreflang, JSON-LD, sitemap, poorten) | 5 | 4 | 3 | 0 | 2 | 21 | **MVP** |
| 19 | Publieke data-API + llms.txt | 3 | 4 | 1 | 0 | 4 | 19 | **MVP** (licht) |
| 20 | Discovery + Social (HN, GitHub) | 3 | 3 | 1 | 1 | 3 | 17 | **MVP** (achter de queue) |
| 21 | Video's per tool (facade) | 3 | 4 | 1 | 1 | 2 | 16 | **MVP** (waar data is) |
| 22 | Nieuwsbrief (double opt-in) | 3 | 4 | 3 | 4 | 1 | 19 | **MVP** (aanmelden; verzending via Notifier) |
| 23 | B2B-leadformulier | 2 | 5 | 4 | 0 | 2 | 17 | **MVP** |
| 24 | Deelbare OG-bonnetjes | 3 | 4 | 1 | 1 | 4 | 20 | **MVP** |
| 25 | Time Machine (prijshistorie-weergave) | 3 | 4 | 1 | 2 | 5 | 23 | **MVP** (groeit vanzelf) |
| 26 | Gesponsord slot (gelabeld) | 2 | 4 | 4 | 0 | 0 | 12 | Architectuur nu, activeren later |
| 27 | Vendorcorrecties + correctielog | 3 | 4 | 1 | 0 | 4 | 19 | **MVP** |
| 28 | Battle Lab met gegenereerde output | 3 | 1 | 1 | 2 | 4 | 18 | NOT NOW |
| 29 | Gebruikersreviews | 2 | 2 | 1 | 2 | 1 | 11 | NOT NOW |
| 30 | Accounts/teams | 2 | 2 | 3 | 3 | 1 | 14 | NOT NOW |

## 2. MVP-definitie

**MVP = de 16 verplichte onderdelen uit de brief + de onderscheidende lagen die het tot een beslisproduct maken.**

| Verplicht (brief §34) | Invulling |
|---|---|
| 1. Homepage | Match-invoer, Pulse-ticker, secties met echte data |
| 2. AI natural-language search | Match: Claude-intentie (optioneel) + lexicale engine (altijd) |
| 3. Tooldatabase | Postgres, feiten met provenance en historie |
| 4. Toolpagina's | Incl. prijzen, EU-lens, vitals, tijdlijn, bronnen |
| 5. Search | Verkenner + ⌘K-autocomplete |
| 6. Filters | Categorie, capability, prijsmodel, gratis, platform, API, open source, EU, NL-taal, status |
| 7. Comparison | Matrix + verdicts; Fair Fight-pagina's met poort |
| 8. Alternatives | Per tool, gerangschikt op overlap en eisen |
| 9. Pricing | Plantabel, maand/jaar, historie, kleine lettertjes |
| 10. Sources | Bonnetjes-lade per feit |
| 11. Freshness | Dial, stempels, banner bij verouderde informatie |
| 12. Basic recommendation engine | Stack-composer met varianten + uitleg |
| 13. Affiliate tracking | /go, click_id, subID, conversie-import |
| 14. Analytics | Cookieloos, first-party, dashboards |
| 15. Admin | Overview, Operations, Queue, Tools, Revenue, Analytics, SEO, Errors, Settings |
| 16. Automated data checks | Agents (link, prijs, change, kwaliteit, duplicaat, editorial) |

**Plus:** Stack Doctor, Stack opslaan/delen, Watch-alerts, Pulse, deelbare bonnetjes, methodologie, disclosure, correcties, nieuwsbrief, B2B-leads en de publieke data-API.

## 3. NOT NOW-lijst (bewust niet gebouwd)

| # | Niet nu | Waarom niet | Heroverwegen als |
|---|---|---|---|
| 1 | Directory met duizenden tools | Diepte boven breedte; kwaliteit valt anders niet te bewaken | Pipeline houdt ≥ 95% nauwkeurigheid bij 300 tools |
| 2 | Gebruikersreviews en ratings | Cold start, spam, DSA-plichten, nep-reviewrisico | ≥ 20k bezoekers/mnd + moderatiecapaciteit |
| 3 | Gebruikersaccounts en social login | Frictie; niet nodig voor opslaan en alerts | Teams vragen erom (leads) |
| 4 | Teamaccounts en AVG-rapportage | Geen bewezen vraag | ≥ 10 B2B-leads met die vraag |
| 5 | Battle Lab met gegenereerde output | Kosten, reproduceerbaarheid, benchmarkclausules | Budget + juridische check + methodologie gereviewd |
| 6 | AI Olympics-evenement | Bouwt op het Battle Lab | Lab draait 3 maanden stabiel |
| 7 | Reddit-data | Commerciële goedkeuring vereist, $0,24/1k calls | Budget + goedgekeurde use case |
| 8 | X/Twitter- en LinkedIn-data | Kosten per call / geen toegang | Idem |
| 9 | Product Hunt-integratie standaard aan | Token en voorwaarden; optionele connector bestaat | Token + akkoord met de voorwaarden |
| 10 | Premium-abonnement voor consumenten | Geen betaalbereidheid aangetoond | Watch-opt-in > 10% en vraag naar "sneller/meer" |
| 11 | Vendor-analyticsportal | Statistisch zinloos bij weinig Matches | ≥ 10k Matches/mnd |
| 12 | Betaalde data-API | Eerst gratis adoptie meten | Aanvragen van ≥ 3 partijen |
| 13 | AI-procurement/inkoopbegeleiding | Vergt vertrouwen, volume en sales | Leads vragen erom |
| 14 | de/fr live | Vertaaldekking; halfvertaalde pagina's schaden SEO | Dekking ≥ 90% UI + ≥ 80% tools |
| 15 | Gelokaliseerde route-segmenten (`/nl/taken/…`) | Complexiteit; beperkte SEO-winst | Na de de/fr-launch |
| 16 | AdSense/display-ads | Ondermijnt het vertrouwen, lage opbrengst | Nooit (herzien alleen bij strategiewissel) |
| 17 | Listing fees / pay-to-rank | Strijdig met de kernbelofte | Nooit |
| 18 | Tool Tinder-swipe | Lage beslissingswaarde | Engagementdata vraagt om exploratie |
| 19 | AR-mascotte, karaoke, meme-generator, easter-egg-bot | Geen gebruikerswaarde | — |
| 20 | Claim → Bonnetje (vendorclaims) automatisch | Juridisch risico; vergt echte tests | Redactieproces + juridische review |
| 21 | Migration assistant (volledige gidsen) | Doctor dekt de eerste behoefte | Doctor-gebruik > 20% van de Matches |
| 22 | Semantische embeddings (pgvector) | Lexicaal + LLM volstaat bij deze catalogusgrootte | > 1.000 tools of veel "geen match" |
| 23 | CDN-caching van HTML / ISR | App-cache volstaat | > 200k bezoeken/mnd |
| 24 | Mobiele app | Web is voldoende | Retentie via app aantoonbaar beter |
| 25 | Forum/Discord | Communitybeheer kost tijd | ≥ 5.000 abonnees |

## 4. Fasering (elke fase: STOP → TEST → REVIEW → FIX → CONTINUE)

| Fase | Inhoud | Exitcriteria |
|---|---|---|
| **0: Audit en architectuur** | Documenten 00–11 | Beslissingen vastgelegd, NOT NOW-lijst akkoord |
| **1: Foundation** | Next.js, TypeScript, Tailwind, design tokens, i18n (nl/en + de/fr voorbereid), Postgres + Drizzle-schema + migraties, seed-framework, security headers, CI | Build groen, migraties draaien, lege pagina's renderen per locale, lint/typecheck/unit groen |
| **2: Core product** | Catalogus, toolpagina's, verkenner + filters, vergelijken, alternatieven, prijzen, bronnen, freshness | E2E: tool bekijken → vergelijken → bezoeken werkt; SEO-metadata aanwezig |
| **3: AI intelligence** | Intentie (lexicaal + Claude), verduidelijking, stack-composer, varianten, uitleg met guards, Doctor | 20+ use cases geven zinnige stacks; LLM-uitval → fallback werkt |
| **4: Automation** | Agent-framework, fetcher, confidence/beleid, 16 agents, runner/worker, Admin Operations/Queue/Errors | Agents op fixtures groen; acties traceerbaar; drempels configureerbaar |
| **5: Monetization** | /go-tracking, programma's/links, disclosure, conversie-import, omzet- en scenariodashboard, leads, nieuwsbrief, placements | Omzet per pagina berekenbaar; disclosure-test groen; ranking-onafhankelijkheid-test groen |
| **6: Growth** | Sitemap/poorten, JSON-LD, hreflang, OG-bonnetjes, llms.txt, publieke API, Pulse, Watch/Notifier | SEO-checks groen; deelkaart rendert; digest wordt gegenereerd |
| **7: Internationalization** | Vertaaldekking meten, de/fr-berichten, locale-poort | Dekkingsrapport in Admin; nl/en 100% |

## 5. Validatiemijlpalen na launch

| Moment | Meten | Beslissen |
|---|---|---|
| Week 2 | Match-start-ratio, "geen match"-queries | Taakcatalogus uitbreiden waar vraag is |
| Dag 30 | Nauwkeurigheidsaudit (30 feiten) | ≥ 95%? Anders stopt de uitbreiding |
| Dag 60 | Gemeten o, a, c en r → scenario's vervangen | Contentprioriteit op basis van EPC |
| Dag 90 | Kill-criteria uit document 01 | Doorgaan / bijsturen / pivot |

## 6. Launchchecklist (eigenaar)

- [ ] Merkcheck "AIToolsWijzer" (BOIP) en domeinconfiguratie.
- [ ] Juridische gegevens in de config (naam, KvK, adres, contact). Zonder deze gegevens meldt Admin → Launch readiness een blokkade.
- [ ] Privacyverklaring laten toetsen.
- [ ] Aanmelden bij affiliateprogramma's (ElevenLabs, Synthesia, HeyGen, …) en links invoeren in Admin.
- [ ] `ANTHROPIC_API_KEY` (optioneel), `RESEND_API_KEY` (voor alerts), `YOUTUBE_API_KEY` (optioneel) en `GITHUB_TOKEN` (voor hogere rate limits) instellen.
- [ ] Netwerktoegang voor de agent-worker tot vendor-sites (in productie standaard).
- [ ] De eerste nachtelijke agent-run controleren in Admin → Operations; seedfeiten die op de officiële bron zijn bevestigd, promoveren automatisch naar GECONTROLEERD.
