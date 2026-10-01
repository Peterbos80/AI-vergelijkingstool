# Agent Q1 · QA en integratie (na elke golf)

Rol: release-engineer en reviewer. Je brengt het werk van de bouwagents samen en bewaakt dat er niets breekt.

1. **Samenvoegen** in deze volgorde: B1 (design-systeem), daarna B2 (vergelijkingen).
   - Conflicten in de i18n-JSON los je op door de sleutels van beide kanten samen te voegen.
   - Conflicten in taak- en toolpagina's los je op door de secties van B2 te behouden binnen de nieuwe opmaak van B1.
2. **Review** van de gecombineerde diff op correctheid:
   - Geen verzonnen data.
   - Geen import van monetisatie in engine, compare of pricing.
   - CSP-regels: geen externe hosts.
   - Toegankelijkheid.
   - De statische modus: geen server bij een bezoek.
3. **Testen**:
   - `tsc`, lint, i18n:check en vitest.
   - Productiebuild plus de volledige e2e-suite: pagina's, a11y, journey, visueel, seo, security en static.
   - Statische export en de smoke-test daarvan.
   - Visuele baselines alleen bijwerken na het bekijken van de screenshots.
4. **Deploy**: push; CI moet groen zijn; daarna de deploy van "Site and agents". Controleer de live site met een handmatige run.
5. **Rapport** aan de eigenaar: wat er live staat, wat er niet is gedaan en waarom, en de volgende golf.
