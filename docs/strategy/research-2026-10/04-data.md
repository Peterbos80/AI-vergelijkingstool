# 04 · Data: Privacy & Nederlands kompas (30 september 2026)

**Status: gestopt na 2 van de 54 tools.** Na 14 zoekopdrachten meldde WebSearch dat het zoekbudget van deze sessie op is (200 van 200 calls, gedeeld met de rest van het team). Ik heb daarna niet meer gezocht en niets omzeild: geen WebFetch en geen curl. Alles hieronder komt uit zoekresultaten die ik echt heb gezien.

- Worktree: `/home/user/AI-vergelijkingstool/.claude/worktrees/agent-a33d0f7fc289c9f1a`
- Branch: `worktree-agent-a33d0f7fc289c9f1a`, commit `1a1c43d` (niet gepusht)
- Controles: `validate-seed` geeft OK (237 facts, was 231). `seed.test.ts` en `tests/unit` slagen: 93 van 93 tests.

## Tabel

✔ = ja · ✘ = nee · – = geen bron gevonden (weggelaten). Bij "Traint op data": ✔ betekent dat de tool standaard traint, "uit te zetten" dat je dat kunt uitzetten.

| Tool | Nederlands | EU-opslag | Verwerkersovereenkomst | Traint op data |
|---|---|---|---|---|
| ChatGPT | ✔ | ✔ (alleen Enterprise, Edu en API) | ✔ (Business, Enterprise en API) | ✔, uit te zetten |
| Claude | – | – (conflict, zie hieronder) | ✔ (Commercial Terms: Claude for Work en API) | ✔, uit te zetten |
| overige 52 tools | niet onderzocht | niet onderzocht | niet onderzocht | niet onderzocht |

Deze feiten stonden al in de data en heb ik niet aangeraakt: `supports_dutch` bij deepl (✔), grammarly (✘), languagetool (✔) en amberscript (✔), en `eu_data_residency` bij amberscript (✔). Het zijn redactionele feiten of feiten van één bron, met status *unverified*.

## Status van de nieuwe feiten
- **6 feiten toegevoegd**, alle 6 *supported* en 0 *unverified*.
- Elk feit heeft een bronpagina van de leverancier (official, official_docs of official_blog) of minstens twee onafhankelijke bronnen die het eens zijn.
- Per fact key: `supports_dutch` 1, `eu_data_residency` 1, `gdpr_dpa` 2, `trains_on_user_data` 2.

## Conflicten en weggelaten feiten
- **Claude, EU-opslag: conflict, weggelaten.** Secundaire bronnen (amitkoth.com, firstaimovers) zeggen dat Claude zelf (claude.ai, Enterprise en de API) geen EU-opslag heeft. Opslag in de werkruimte zou dan alleen in de VS zijn. Wel draaien de Claude-modellen in EU-regio's via AWS Bedrock en Google Vertex AI. De eigen pagina van Anthropic over regionale compliance noemt Europa volgens de zoeksamenvatting "Coming 2026". Dat is niet eenduidig genoeg voor ✔ of ✘.
- **Claude, Nederlands: niet gevonden.** De documentatie van Anthropic zegt dat Claude de meeste wereldtalen verwerkt, maar noemt Nederlands niet. De zoeksamenvatting zegt ook letterlijk dat Nederlands ontbreekt in de benchmarktabel. Daarom weggelaten.

## Opvallend
- **ChatGPT én Claude trainen standaard op gesprekken van consumenten.** Bij ChatGPT geldt dat voor Free, Plus en Pro; je zet het uit via "Improve the model for everyone". Bij Claude geldt het sinds 28 augustus 2025 voor Free, Pro en Max; je zet het uit in de privacy-instellingen. Zakelijke contracten vallen er bij beide buiten.
- **EU-opslag bij OpenAI alleen voor grote klanten.** Het gaat om ChatGPT Enterprise en Edu (nieuwe werkruimtes) en om nieuwe API-projecten. Er is geen EU-optie voor Free, Plus of Pro.
- **Een verwerkersovereenkomst krijg je alleen met een zakelijk contract.** Bij OpenAI is dat Business, Enterprise of API. Bij Anthropic is de DPA automatisch onderdeel van de Commercial Terms. Consumentenaccounts hebben geen verwerkersovereenkomst.

## Technische punten voor wie verder bouwt
1. **`trains_on_user_data` is geen boolean.** Snapshot, UI, vergelijking, Stack Doctor en de ranking lezen alleen `"no"`, `"opt_out"` of `"yes"` (`src/lib/provenance/snapshot.ts:163`, labels in `facts.values`). Een boolean wordt stil `null`, en dan toont de site "onbekend". Daarom staat er `"opt_out"`.
   - Omzetten naar een boolean: `yes` en `opt_out` worden `true`, `no` wordt `false`.
   - Met een tijdelijke test heb ik gecontroleerd dat de waarden in de catalogus aankomen.
2. **Er is een test die breekt zodra DeepL een `gdpr_dpa` krijgt.** `tests/integration/seed.test.ts` ("adds facts the dataset gained later…") gebruikt `deepl.gdpr_dpa` als voorbeeld van een feit dat nog niet in de data staat. Wie dat feit toevoegt, moet de test een sleutel laten kiezen die DeepL nog niet heeft.
3. **Hulpscript:** `scratchpad/add-facts.mjs <repo> <batch.json>`.
   - Het voegt feiten toe in de bestaande stijl, één regel per feit, en slaat keys over die al bestaan.
   - Het weigert `verified` en controleert de lengte van `evidence` en `note`.
   - Voorbeeldinvoer: `scratchpad/batch1.json`.

## Vervolg
Om de overige 52 tools te doen moet het zoekbudget omhoog (`CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION`). Reken op ongeveer 3 tot 5 zoekopdrachten per tool, dus zo'n 150 tot 250 in totaal. Daarna kan het onderzoek verder vanaf gemini, in de volgorde van de lijst.
