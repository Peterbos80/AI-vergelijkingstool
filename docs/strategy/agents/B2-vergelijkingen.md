# Agent B2 · Vergelijkingsbouwer (golf 1: unieke vergelijkingen met echte data)

Rol: senior full-stack engineer (TypeScript, React 19, Next.js 16 App Router). Je bouwt de vergelijkingen die geen concurrent heeft, uitsluitend op data die we al met bron hebben. Je werkt in een eigen git-worktree; tegelijk bouwt B1 (design-systeem) de visuele basis. De productlead voegt jullie werk samen.

## Lees eerst
1. `docs/strategy/agents/00-teambriefing.md` (spelregels: niets verzinnen, geld verandert de volgorde nooit, statische site).
2. `docs/strategy/research-2026-10/01-markt.md` §"Unieke vergelijkingen" (ideeën 1, 2, 3, 7, 9).
3. `docs/strategy/research-2026-10/02-gebruikers.md` §"Implicaties" (#4 gratis route, #8 echte kosten).
4. `AGENTS.md`: Next.js 16; lees bij twijfel `node_modules/next/dist/docs/`.

## Wat er al is
- Catalogus: `src/lib/catalog/types.ts` (`CatalogTool.plans: CatalogPlan[]` met `priceCents`, `currency`, `period`, `unit` flat|per_user|per_seat|per_channel|usage, `monthlyCents`, `annualMonthlyCents`, `isFree`, `quota` (vrije tekst), `status`, `observedAt`; `companyCountry`; `facts`; `capabilities` met strength). Valuta: `catalog.fx` (ECB-koersen + datum) en `toEurCents` in `src/lib/pricing/money.ts`.
- Taken: `data/taxonomy.json` (46 taken, stappen → capabilities). Taakpagina: `src/app/[locale]/tasks/[slug]/page.tsx`. Toolpagina: `src/app/[locale]/tools/[slug]/page.tsx`.
- 328 plannen, 230 met limiettekst; 61 gratis plannen met limiettekst. Feiten `watermark_free_tier` (10 tools) en `commercial_use_free_tier` (3).
- De site is statisch: interactie draait in client components die hun data als props krijgen tijdens de build. Geen server bij een bezoek.

## Opdracht (golf 1)
1. **Limietparser** `src/lib/pricing/quota.ts`: zet limiettekst om naar `{ amount, unit: 'minute'|'hour'|…, per: 'month'|'year'|'week'|'day'|'total', approximate, unlimited }` of `null`. Normaliseer alleen eenduidige gevallen ("300 minutes per month", "9 hours per month", "24 hours of voice generation per year" → 120 min/mnd, "€10 per audio hour" → gebruiksprijs, "About 10 hours … per user per month" → approximate). Daglimieten en "in total/one-off/lifetime" tel je **niet** om naar een maandbudget; markeer ze. Schrijf een tabeltest met alle echte limietteksten uit `data/tools` (snapshot: welke wel en niet parsen). Onbekend blijft onbekend.
2. **Gebruiksmeters** `src/lib/compare/usage.ts`: meters met een redactionele lijst van tools per meter, zodat een limiet nooit aan de verkeerde functie wordt toegekend: audio transcriberen (minuten audio), voice-over maken (minuten spraak), avatarvideo (minuten video), audio opschonen (uren audio), video nasynchroniseren (minuten). Per tool: het goedkoopste plan dat jouw gebruik dekt, maandprijs, prijs per eenheid (bijv. € per uur), in euro's via ECB met datum, plus het originele bedrag, plus status en datum van de bron. Tools die niet te berekenen zijn, staan apart met de reden ("limiet niet in minuten", "alleen daglimiet", "prijs op aanvraag"). Extra-gebruikkosten (overage) modelleer je niet; zeg dat erbij.
3. **"Wat kost het voor mij?"**: een client component met een schuif en invoer (bijv. 1–100 uur per maand) en een gesorteerde lijst; de volgorde is puur de berekende prijs, nooit affiliate. Plaats hem:
   - op de taakpagina's die bij een meter horen (`transcribe-audio`, `automatic-meeting-notes` waar zinvol, `create-ai-voiceovers`, `training-videos-ai-presenter`, `translate-and-dub-videos`, `clean-up-audio`);
   - op een nieuwe hubpagina `/[locale]/costs` ("Wat kost AI voor jouw gebruik?") met alle meters, plus een tab **teamkosten**: voor plannen per gebruiker of seat (bijv. AI-assistenten, notulen) N gebruikers × prijs, maand tegenover jaar.
   Voeg `href.costs` toe in `src/lib/routes.ts` en de pagina aan de sitemap (`src/lib/sitemap.ts`). De navigatielink laat je aan de productlead (B1 herbouwt de header).
4. **"Wat krijg je echt gratis?"** op taakpagina's: per tool van de taak het gratis plan met limiettekst, watermerk (feit), commercieel gebruik (feit) en creditcard nodig (alleen als feit bekend). Onbekend toont "–" met de tekst "onbekend", nooit "nee".
5. **Europees alternatief** op toolpagina's van tools met een bedrijf buiten Europa: tools van Europese bedrijven (EU/EER, VK, Zwitserland; `companyCountry`) met dezelfde primaire capabilities, met overlap in %, instapprijs en het land. Zeg erbij: "een Europees bedrijf zegt nog niets over waar je data staat".
6. **Berekende labels** (geen winnaars, geen scores): "Goedkoopst voor jouw gebruik" (in de calculator), "Echt bruikbaar gratis" (gratis plan zonder watermerk en met commercieel gebruik, alleen als beide feiten bekend zijn), "Europees bedrijf". Elk label linkt naar de reden.

## Spelregels
- Geen enkel getal zonder bron uit de catalogus. Status en datum van het plan reizen mee.
- Geen import van `src/lib/monetization/**` in `src/lib/compare/**` of `src/lib/pricing/**` (de rangschikking moet geldneutraal blijven; zie de test in `tests/integration/engine.test.ts`).
- Raak `src/app/globals.css`, de header en footer en `src/components/site/**` niet aan (B1). Gebruik Tailwind-klassen en bestaande tokens (`var(--ink)`, `var(--line)`, `card`, `chip`, …).
- In de taak- en toolpagina voeg je alleen secties toe (één component per sectie), zodat samenvoegen eenvoudig blijft.
- Teksten in nl, en, de en fr (`src/i18n/messages/*.json`, nieuwe namespaces `costs`, `freeCheck`, `euAlt`); nl en en hebben exact dezelfde sleutels.
- Toegankelijk: labels bij invoer, toetsenbord, `aria-live` voor het resultaat, contrast AA in beide thema's.

## Tests en controle
- Unit: parser (alle echte limietteksten), metercalculatie, teamkosten, EU-selectie.
- Integratie (PGlite, zie `tests/integration/*.test.ts`): uitkomsten op de echte seed. Bijvoorbeeld: Amberscript bij 10 uur per maand is Pro (600 minuten), het goedkoopste plan dat 10 uur dekt.
- E2E: `tests/e2e/costs.spec.ts`. Schuif verplaatsen → volgorde en bedragen veranderen; geen consolefouten; axe zonder serious of critical.
- Setup in je worktree: `npm ci`. Draai `npx tsc --noEmit -p .`, `npm run -s lint`, `npm run -s i18n:check`, `npx vitest run`. Daarna `npm run build` en e2e met een eigen database en poort: `psql -h /tmp -U postgres -c "CREATE DATABASE aitw_e2e_b2"`, dan `E2E_DATABASE_URL=postgres://postgres@localhost:5432/aitw_e2e_b2 E2E_PORT=3320 npx playwright test tests/e2e/costs.spec.ts tests/e2e/pages.spec.ts tests/e2e/a11y.spec.ts`.
- Commit in je worktree (niet pushen), met een duidelijke boodschap zonder modelnamen, en sluit af met:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` en `Claude-Session: https://claude.ai/code/session_01R3t4cziH1QcWsTXEGULZgz`.

## Oplevering
Eindbericht: worktree-pad, branch, commit(s), per punt 1–6 wat af is, hoeveel plannen per meter berekenbaar zijn en welke niet (met reden), testresultaten, en welke gedeelde bestanden je hebt aangeraakt.
