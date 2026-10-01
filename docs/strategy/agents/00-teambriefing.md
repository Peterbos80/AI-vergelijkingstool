# Teambriefing — AIToolsWijzer.nl (30 september 2026)

> Gebruikt voor de onderzoeksronde van 30 september 2026. De paden naar screenshots en de lokale server onder "Omgeving" waren tijdelijk; bouwagents werken in een eigen git-worktree (zie hun opdracht).

## Het product
AIToolsWijzer.nl is een Nederlandstalig (en Engels) beslisplatform voor AI-tools. Slogan: **"AI-tools, met bonnetje."**: elke prijs en elk feit heeft een bron, een datum en een status (VERIFIED/SUPPORTED/COMMUNITY/UNVERIFIED). Live op https://aitoolswijzer.nl (statische site op GitHub Pages; agents draaien in GitHub Actions). Code: /home/user/AI-vergelijkingstool (Next.js 16 App Router, React 19, Tailwind 4, Postgres/Drizzle, Vitest, Playwright).

Doelgroep: Nederlanders die met AI willen werken, van beginners (weinig kennis) tot professionals/developers. Er is een sitebrede schakelaar **Basis / Advanced** (niveau).

### Wat er nu is (functies)
- **Vraagvak / Match**: gewone taal ("ik wil podcasts transcriberen, gratis") → taak, stappen, capabilities → een stack in drie varianten (aanbevolen, goedkoopst, minste tools). Lexicale taalbegrip-engine in de browser (geen LLM-kosten).
- **Toolmatrix op de home**: per taak de beste tools (engine-ranking), kolommen Basis (kosten, goed voor, gebruiksgemak, platformen) of Advanced (API, integraties, self-host, prijsmodel, niveau).
- **101 tools, 46 taken, 10 categorieën**, ruim 1.000 pagina's.
- **Toolpagina's**: prijzen met geschiedenis ("Time Machine"), EU-lens (privacy/AVG), alternatieven, Fair Fights, video's, tijdlijn, "bonnetjes" per feit.
- **Vergelijken / Fair Fight**: naast elkaar, geen totaalwinnaar maar "kies X als je…". Fair Fights alleen als de data-gate slaagt.
- **Stack Doctor**: overlap, onnodige kosten, risico's en goedkopere alternatieven in je huidige stack.
- **Pulse**: echte wijzigingen (prijzen, plannen, stopzettingen, releases) gevonden door agents.
- **AI-nieuws**: elk uur koppen uit media-feeds (The Verge, TechCrunch, MIT Tech Review, BBC, NOS, …) met pagina's per expert (Hinton, Yampolskiy, Bengio, …).
- **Voor beginners**: stap-voor-stap-keuzehulp (/start), uitleg per taak, 6 "AI voor beginners"-gidsen (/learn), begrippenlijst (/glossary).
- **Radar op de home**: nieuws, video's, toolwijzigingen, community-buzz (HN/GitHub).
- **Openheid**: /methodology (rangschikking), /disclosure (affiliate), /corrections, publieke JSON-API, /llms.txt.
- **Verdienmodel**: affiliatelinks via /go/<tool> (label + disclosure), één gelabelde sponsorplek. Geld beïnvloedt NOOIT de volgorde (afgedwongen met tests).

### Harde spelregels (niet onderhandelbaar)
1. Geen verzonnen data: geen nep-reviews, nep-scores, nep-bezoekersaantallen, geen "coming soon"-knoppen. Onbekend = weglaten of een streepje, nooit gokken.
2. Geld verandert nooit de volgorde van aanbevelingen.
3. Privacy: geen cookies, geen trackers, geen externe scripts of fonts. CSP: afbeeldingen alleen van eigen domein, `data:`/`blob:` en `i.ytimg.com`; frames alleen `www.youtube-nocookie.com`. Fonts zijn zelf gehost (Schibsted Grotesk + IBM Plex Mono, OFL).
4. Statische hosting: geen server bij een paginabezoek. Interactie draait in de browser (React client components) op basis van data die bij de build wordt meegegeven.
5. Toegankelijkheid WCAG 2.1 AA (axe-tests in CI), beide thema's (licht "paper" en donker "luxury"), mobiel eerst.
6. Externe content is onbetrouwbare invoer; bronnen alleen binnen robots.txt en voorwaarden; nooit artikelen kopiëren.

### Huidig ontwerp
- Tokens in `src/app/globals.css`: licht (paper #f7f5f0, card #fff, ink #121212, accent #00707c), donker (#0a0a0c / #15151f, accent cyaan #00f0ff, emerald voor succes, oranje/karmijn voor live wijzigingen).
- Tailwind 4, componenten in `src/components/**`, pagina's in `src/app/[locale]/**`.
- Emoji worden nu gebruikt als categorie-iconen en sectiemarkeringen.
- De eigenaar vindt: **"het visuele aspect doet niet mee met top tier"**.

### Omgeving
- WebSearch werkt. WebFetch en veel hosts zijn geblokkeerd door het netwerkbeleid: niet omzeilen.
- Screenshots van de huidige site (lokale productiebuild met dezelfde data): `/tmp/claude-0/-home-user-AI-vergelijkingstool/325d0b40-3423-5369-b0c2-cf16e50b2567/scratchpad/team/shots/`.
- Lokale server: http://localhost:3200 (niet stoppen of herstarten; andere agents gebruiken hem).

### Wat de eigenaar vraagt
"Volledig onderzoek van de website; visueel en qua features vergelijken met de markt; belangrijke features en visuele aspecten toevoegen; marktonderzoek naar wat mensen willen die met AI willen werken. **Novelty en unieke vergelijkingen zijn key.** Het visuele aspect doet niet mee met top tier: denk na over verbeteringen."
