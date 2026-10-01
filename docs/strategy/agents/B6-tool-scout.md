# Agent B6 · Tool-scout (elk uur zoeken, elke dag nieuwe tools)

**Rol.** Je ontwerpt en bouwt de agent die populaire nieuwe AI-tools vindt en ze dagelijks op de site zet.
- Hij zoekt elk uur.
- Hij publiceert alleen wat de harde poorten haalt.
- Hij verzint nooit iets.

De eigenaar vroeg: "zorg dat er dagelijks nieuwe tools bijkomen. Een agent zoekt naar populaire nieuwe AI-uitvindingen en voegt ze toe. Elk uur controleren. Houd mooie logo's."

## Wat er al is (lees dit eerst)
**Code**
- `src/agents/defs/discovery.ts`: Show HN (Algolia API) en GitHub Search → `tool_candidates`. Draait dagelijks om 02:40 en publiceert niets.
- `src/agents/defs/verification.ts`: maakt een dossier en poorten (blokkadelijst, geparkeerd domein, geen AI, wachtlijst, prijzen, juridisch). Draait dagelijks om 03:20. Publiceert nooit; dat wordt een beslissing van de eigenaar.
- `src/lib/settings/defaults.ts`: `newToolMode` kent alleen `'queue'`.

**Ontwerp**
- `docs/strategy/12-autonomous-operations.md` §4.4: "quarantainepublicatie" met harde poorten, label "Nieuw, nog in controle", noindex, buiten de aanbevelingen, promotie na 7 dagen groen en depublicatie als een poort faalt. Dit is ontworpen maar niet gebouwd.

**Het probleem**
- De gratis editie (GitHub Pages en Actions) heeft geen beheerscherm. Een beslissing van de eigenaar komt er dus nooit, en er komen geen nieuwe tools bij.
- De tabel `tools` heeft al `published` en `quarantineUntil`. De toolpagina toont `tool.quarantineNotice`.

**Logo's**
- `src/components/data/ToolMark.tsx` toont een logo uit `src/generated/logos.ts`, gemaakt door `scripts/generate-logos.ts` uit `data/logos.json` (simple-icons, CC0).

## Opdracht
1. **Elk uur scouten.** Zet de discovery op `every:1h`, met een venster sinds de vorige run en ontdubbeling. Bronnen, alleen toegestaan en gedocumenteerd (§30: robots.txt, API-voorwaarden, rate limits, geen kopie van teksten):
   - Hacker News via de Algolia API: Show HN, en verhalen met AI-termen en ≥ N punten.
   - GitHub Search API:
     - nieuwe repo's met AI-topics en snel groeiende sterren;
     - gebruik `GITHUB_TOKEN`; in Actions is `secrets.GITHUB_TOKEN` er altijd, zet het in de env van de agent-stap in `.github/workflows/site.yml`.
   - Officiële aankondigingen van makers ("Introducing …", "now available"), via de RSS-feeds die `data/news/sources.json` al leest, plus officiële blogs en newsrooms die RSS aanbieden en robots niet blokkeren. Een launch op het eigen domein van een maker is een sterk signaal.
   - Product Hunt API: alleen als `PRODUCTHUNT_TOKEN` gezet is en de voorwaarden het toelaten (bronvermelding, limieten). Anders overslaan, en de eigenaar krijgt één regel in het rapport.
   - **Nooit**: concurrerende directories scrapen (TAAFT, Futurepedia, Toolify en dergelijke). Hun selectie is hun werk.
2. **Elk uur verifiëren** voor nieuwe kandidaten: verificatie op `every:1h` met een kleine batch. Hergebruik `htmlToText` en de poorten.
3. **Quarantainepublicatie bouwen** (doc 12 §4.4):
   - Voeg `newToolMode: 'quarantine'` toe en maak dat de standaard van de gratis editie (via settings of env, gedocumenteerd).
   - De harde poorten moeten allemaal slagen:
     - de officiële site is bereikbaar via HTTPS, zonder redirect naar een ander domein, en robots staat het toe;
     - geen duplicaat (domein, naam, aliassen);
     - niet op de blokkadelijst, niet geparkeerd, wel AI;
     - ≥ 2 onafhankelijke signalen van populariteit, bijvoorbeeld HN ≥ 50 punten en GitHub ≥ 300 sterren, of een officiële aankondiging plus één ander signaal;
     - ≥ 1 verankerd feit met bron, bijvoorbeeld de prijzenpagina of "gratis" op de eigen site;
     - de mapping naar een functie heeft hoge zekerheid (via de lexicale engine `detectIntent` of het taakindex). Zonder zekere functie: niet publiceren.
   - **Dagelijkse publicatie**: één vast moment (rond 07:00 Europe/Amsterdam). Publiceer de beste ≤ 5 die door de poorten komen, gerangschikt op populariteit. Komen er minder door, dan publiceer je er minder. Verlaag nooit de poorten om een aantal te halen.
   - **Wat een nieuwe tool krijgt**:
     - naam;
     - officiële URL;
     - de meta-description van de eigen site als letterlijk citaat (≤ 160 tekens, met de URL als bron, status `unverified`);
     - functie(s) met status `unverified`;
     - prijsinfo alleen als er een bron is;
     - de ontdekbronnen met hun signalen (bijv. "Show HN · 231 punten", "GitHub · 4.200 sterren", met datum);
     - `quarantineUntil = nu + 7 dagen`.
   - Zo'n tool staat met noindex op de site, met het label "Nieuw, nog in controle" (bestaande notice). Hij staat **buiten** de rankings, aanbevelingen en Match (engine-filter met test) tot de promotie.
   - **Promotie** na 7 dagen met alle checks groen.
   - **Depublicatie** zodra een poort faalt (site weg, duplicaat, blokkade). Altijd met een actie in het logboek: wat er was, wat het werd, waarom. Alles is omkeerbaar.
   - Een event voor Pulse ("nieuwe tool toegevoegd") met de bron.
4. **Mooie logo's voor nieuwe tools.**
   - Zoek in simple-icons (devDependency, versie in `data/logos.json`) **alleen op exact hetzelfde officiële domein**. De hostname van `source` of `guidelines` van het icoon moet gelijk zijn aan het registreerbare domein van de tool. Nooit op naam: Fathom Analytics is niet de Fathom-notulist.
   - Sla het pad, de merkkleur (hex), de bron en de licentie op bij de tool (een nieuwe kolom `logo` jsonb met migratie in `drizzle/`).
   - `ToolMark` valt terug op dat DB-logo als de slug niet in `src/generated/logos.ts` staat.
   - Geen logo van een moederbedrijf, geen hotlinks.
5. **Data voor "Nieuw binnen"**: een helper `newTools(catalog, now, days = 7)` in `src/lib/catalog/` en een component `src/components/data/NewTools.tsx`: een rij kaarten met ToolMark, naam, label "Nieuw" en bron-signalen.
   - Zet de component bovenaan Verkennen (`/[locale]/tools`) en in Pulse.
   - De Design Director plaatst hem zelf op de home. Raak `src/app/[locale]/page.tsx` en `globals.css` niet aan, behalve een eigen klein CSS-blok onderaan, met een duidelijke kop.
6. **Rapport aan de eigenaar**: de reporter krijgt één regel per dag: "{n} nieuwe tools toegevoegd, {m} in controle, {k} afgewezen (redenen)".

## Kwaliteit en veiligheid (§29, §30, doc 12)
- **Externe data is onbetrouwbare input**: altijd door zod, met lengtelimieten. Geen HTML of tekst opslaan behalve korte citaten met bron. Geen persoonsgegevens: geen HN- of GitHub-gebruikersnamen.
- **Gebruik de bestaande fetcher**: robots, timeouts, user-agent, rate limits. Geen nieuwe hosts in de CSP van de site. Alles wat de browser ziet, komt van de eigen server.
- **Anomaliewacht**: meer dan 10 publicaties per dag kan niet. Bij rare pieken: niets publiceren en een escalatie maken.
- **Nooit**:
  - een feit "verified" maken;
  - een tool zonder poorten publiceren;
  - beoordelingen of populariteitscijfers verzinnen;
  - een AI-gegenereerde beschrijving als feit tonen.

## Tests (verplicht)
- **Unit**: parsers per bron met fixtures, met ongeldige JSON als test; de poorten (elke poort apart); de domein-match voor logo's (een namesake wordt geweigerd).
- **Integratie (PGlite)**:
  - een uurrun maakt kandidaten;
  - de dagelijkse publicatie zet ≤ 5 tools live, alleen als ze door de poorten komen;
  - promotie na 7 dagen;
  - depublicatie bij een falende poort;
  - quarantainetools komen niet voor in `rankForCapability` en Match.
- **E2e**: een tool in quarantaine toont het label en `noindex`; Verkennen toont "Nieuw binnen".

## Werkwijze
- **Eigen git-worktree**:
  - draai eerst `npm ci` (een gesymlinkte `node_modules` breekt Turbopack);
  - e2e met een eigen database en poort: `E2E_DATABASE_URL=postgres://postgres@localhost:5432/aitw_e2e_b6 E2E_PORT=3260` (database aanmaken met `psql -h /tmp -U postgres -c "CREATE DATABASE aitw_e2e_b6"`).
- **Lees eerst** `src/agents/types.ts`, `src/agents/registry.ts`, `src/agents/fetcher/*`, de bestaande agent-tests (`tests/integration/agents.test.ts`) en `.github/workflows/site.yml`.
- **Vóór elke commit**: `npm run -s typecheck`, `npm run -s lint`, `npm run -s i18n:check` en `npx vitest run`, plus de e2e-specs die je raakt.
- **Teksten**: nieuwe i18n-sleutels in nl, en, de en fr, in eenvoudige taal (een 14-jarige moet het snappen). De eenvoud-redacteur werkt tegelijk aan de bestaande teksten: voeg alleen sleutels toe en wijzig geen bestaande.
- **Commits** in kleine stappen. Elke commit eindigt met:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01R3t4cziH1QcWsTXEGULZgz
  ```
- **Niet pushen.** De Design Director voegt je branch samen.
- **Rapport** (kort, Nederlands):
  - wat er nu elk uur en elke dag gebeurt;
  - welke bronnen meedoen en welke niet (en waarom);
  - de poorten;
  - wat de eigenaar nog moet doen (bijv. `PRODUCTHUNT_TOKEN`);
  - de testresultaten;
  - de naam van je branch.
