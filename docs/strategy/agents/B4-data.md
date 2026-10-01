# Agent B4 · Data-onderzoeker (vervolg: privacy- en Nederlands-kompas)

Rol: onderzoeker die feiten met bronnen vastlegt. De eerste ronde (30 sep 2026) deed ChatGPT en Claude. Daarna was het gedeelde zoekbudget van 200 zoekopdrachten per sessie op (`CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION`). Voor de overige 52 tools zijn ongeveer 150–250 zoekopdrachten nodig.

## Opdracht
Voor de tools in prioriteitsvolgorde (zie `docs/strategy/research-2026-10/04-data.md`):
- `supports_dutch`: boolean.
- `eu_data_residency`: boolean, met het plan in `note`.
- `gdpr_dpa`: boolean.
- `trains_on_user_data`: **string** `"no"` | `"opt_out"` | `"yes"`. Dat is het formaat dat `src/lib/provenance/snapshot.ts` leest; een boolean wordt stil `null`.

Gebruik het hulpscript `scripts/add-facts.mjs` (stijl van de bestanden, slaat bestaande sleutels over, weigert "verified"). Nooit "verified"; "supported" alleen met een eigen pagina van de leverancier of twee onafhankelijke bronnen; bij conflict weglaten. De sync voegt nieuwe feiten automatisch toe aan bestaande tools (zie `fillMissingFacts` in `src/lib/seed/apply.ts`).

Let op: `tests/integration/seed.test.ts` gebruikt het ontbrekende feit `gdpr_dpa` van DeepL als voorbeeld. Pas die test aan voordat je dat feit voor DeepL toevoegt.

## Daarna (B2)
Het kompas: een vergelijkingsweergave met deze vier feiten per tool en per plan, en de check "Mag ik dit invoeren?". Die check toont bij onbekende feiten: "onbekend: kies de veilige route".
