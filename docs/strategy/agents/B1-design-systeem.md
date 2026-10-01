# Agent B1 · Design-systeembouwer (golf 1: de visuele basis)

Rol: senior frontend engineer met oog voor design. Je bouwt de visuele basis waarop alle andere agents verder bouwen. Je werkt in een eigen git-worktree; de productlead voegt je werk samen met dat van B2 (vergelijkingsbouwer), die tegelijk werkt.

## Lees eerst
1. `docs/strategy/agents/00-teambriefing.md` (product, spelregels).
2. `docs/strategy/research-2026-10/03-design-audit.md` (jouw spec: diagnose §1, systeem §3, lijst §5).
3. `docs/strategy/research-2026-10/01-markt.md` §"Visuele benchmark".
4. `AGENTS.md`: dit is Next.js 16; lees bij twijfel de gids in `node_modules/next/dist/docs/`.

## Besluit van de eigenaar over kleur (gaat vóór de audit)
De eigenaar vroeg expliciet om een donkere luxe-modus: `#0A0A0C` achtergrond, `#15151F` kaarten, neon-cyaan `#00F0FF` voor interactieve paden, smaragd voor succes, oranje/karmijn voor live wijzigingen. **Dat palet blijft.** Neem van de audit de principes over: kleur alleen waar ze iets betekent, geen glow of radial gradients, één accent voor interactie (licht: petrol `#00707C`, donker: cyaan), statuskleuren en prijsrichting als eigen tokens, het bonnetje als licht papieren eiland ook in dark mode. Het "wijzerrood" uit de audit gebruik je niet als accent.

## Opdracht (golf 1)
1. **Header-overflow repareren en de header versimpelen** (audit G8, lijst #1). Nu scrolt de pagina horizontaal tussen 768 en ~1300px. Doel: `document.documentElement.scrollWidth === innerWidth` op 320, 360, 390, 768, 820, 1024, 1180, 1280 en 1440px. Maximaal 5 navigatie-items (bijv. Verkennen · Vergelijken · Stack Doctor · Pulse · Leren; Nieuws en Uitleg mogen onder Pulse en Leren), een zoekknop, de niveauschakelaar en de taal. Onder 1024px: logo, zoekicoon en "Menu"; het menu opent schermvullend, sluit met Esc en zet de focus terug. Behoud `data-level-tab` en de rol `tab` van de niveauschakelaar (tests leunen erop).
2. **Tokens verfijnen** in `src/app/globals.css` binnen het palet van de eigenaar: haal `--glow`, de hero-gradients en losse accenten weg; voeg toe: `--line-strong` (randen van inputs/selects ≥3:1, WCAG 1.4.11), statusparen `--verified/-bg`, `--supported/-bg`, `--community/-bg`, `--unverified`, `--price-up/-bg`, `--price-down/-bg` (een prijs*daling* is nooit rood), `--receipt`, `--receipt-ink`. Radii: 4 / 8 / 12 / 999. Typeschaal volgens audit §3.2 (H1 750, H2 700, label-stijl in plaats van mono-eyebrows; mono alleen voor feiten).
3. **Emoji vervangen door een iconenset**: nieuw `src/components/ui/Icon.tsx` met inline-SVG-paden afgeleid van Lucide (ISC-licentie: vermeld bron en licentie in een commentaar bovenaan). Lijst in audit §3.4. Vervang alle emoji in de publieke site (categorieën in `src/components/start/emoji.ts`, Pulse-iconen in `src/lib/catalog/events.ts`, niveauschakelaar ⚡/💻, radar 🔥, enz.). Iconen zijn `aria-hidden` en staan naast tekst.
4. **Ticker weg** (lijst #4): geen marquee meer. Het Pulse-item in de navigatie krijgt een kleine teller met het aantal wijzigingen van de laatste 30 dagen (uit de catalogus; verborgen bij 0).
5. **Prijzen goed tonen** (G6, lijst #5): nooit `tabular-nums` op Schibsted; bedragen in Plex Mono. Waar een omrekening bestaat: "≈ €x" plus het origineel en de ECB-datum.
6. **Statuslabels en bonnetje-chip** (G3, lijst #6): het Nederlandse label voor SUPPORTED wordt "Onderbouwd" (niet "Ondersteund"); geen afkortingen meer. In dichte tabellen en rijen (vergelijken, ToolRow, FactList) vervangt een compacte chip (glyph + toegankelijke naam "Onderbouwd · 2 bronnen · 29 sep") de luide stempel; de stempel blijft in de bronnenlade en op het bonnetje.
7. **Toolidentiteit**:
   - Monogram 2.0 (audit §3.5): squircle, kleur via OKLCH per tint, twee letters waar namen botsen (ChatGPT "GP", Claude "Cl", CapCut "Cc", Copilot "Co").
   - **Echte logo's waar dat mag**: voeg `simple-icons@16.33.0` (CC0) toe als devDependency, maak `data/logos.json` (toolslug → simple-icons-slug) en `scripts/generate-logos.ts`, dat `src/generated/logos.ts` genereert (gecommit; de site hangt dus niet van het pakket af). Deze tools hebben een logo in simple-icons: brevo, buffer, claude, claude-code, cursor, deepl, elevenlabs, fathom, flux, framer, github-copilot, grammarly, hootsuite, hostinger-website-builder, intercom, languagetool, lm-studio, mailchimp, make, n8n, notion, ollama, perplexity, remove-bg, replit, suno, v0, veed, webflow, windsurf, wix, zapier, gemini (Google Gemini), le-chat (Mistral AI), gemini-notebook (NotebookLM). Controleer elk. Gebruik geen generiek "Google"-logo voor google-veo. Toon het logo als glyph op een neutrale tegel; kleur het met de merkkleur als die ≥3:1 haalt tegen de tegel, anders in inkt. Nooit hotlinken. Voeg één zin toe (nl/en/de/fr) op `/about`: logo's zijn handelsmerken van hun eigenaars en dienen alleen om tools te herkennen.
8. **Kwaliteitspoorten** (lijst #23): een e2e-test die op de 9 breedtes hierboven controleert dat de pagina niet horizontaal scrolt (home, tools, toolpagina, vergelijken), en een unit-test die het contrast van de belangrijkste tokenparen controleert (tekst ≥4,5:1, controlranden ≥3:1, beide thema's).

## Niet doen
- Geen pagina-herontwerpen van toolpagina, vergelijken of home-hero (dat is golf 2). Raak `src/app/[locale]/tasks/[slug]/page.tsx` en `src/app/[locale]/tools/[slug]/page.tsx` alleen aan voor de chips, iconen en monogrammen; B2 voegt daar secties toe.
- Niet aankomen: `src/lib/engine/**`, `src/lib/pricing/**`, `data/tools/**`.
- Geen nieuwe externe hosts, scripts of fonts; geen verzonnen data.

## Werkwijze en controle
- Setup in je worktree: `npm ci` (een symlink naar node_modules breekt Turbopack).
- Draai `npx tsc --noEmit -p .`, `npm run -s lint`, `npm run -s i18n:check` en `npx vitest run`.
- Bouw en test in de browser: `npm run build`, daarna e2e met een eigen database en poort zodat je niemand stoort: `E2E_DATABASE_URL=postgres://postgres@localhost:5432/aitw_e2e_b1 E2E_PORT=3310 npx playwright test` (maak de database eerst: `psql -h /tmp -U postgres -c "CREATE DATABASE aitw_e2e_b1"`). Werk visuele baselines bij met `--update-snapshots` als de nieuwe weergave klopt (bekijk de screenshots).
- Nieuwe teksten in alle vier de talen (`src/i18n/messages/{nl,en,de,fr}.json`); nl en en hebben exact dezelfde sleutels.
- Commit in je worktree (niet pushen), met een duidelijke boodschap zonder modelnamen, en sluit af met:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` en `Claude-Session: https://claude.ai/code/session_01R3t4cziH1QcWsTXEGULZgz`.

## Oplevering
Eindbericht: worktree-pad, branch, commit(s), wat af is per punt 1–8, wat niet, testresultaten, en welke bestanden B2 waarschijnlijk ook raakt (voor het samenvoegen).
