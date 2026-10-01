# 05 · Design Director: audit en richting

*1 okt 2026. Basis: opnames van de live build op 1440 en 390 px (home, toolpagina, verkennen, categorieën, taak), de code in `src/` en de eerdere audit `03-design-audit.md`. Maatstaf: IMDb, Apple, Linear, Stripe, Notion, Arc. Niet kopiëren, wel hetzelfde niveau halen.*

## 1. Oordeel
De site is eerlijk, snel en toegankelijk. Golf 1 (header, tokens, iconen, chips, prijzen) maakte haar ook netjes.

Maar ze voelt als een document en niet als een product. Elke pagina is: kop → raster van kaders met 1px rand → tekst. Er is geen beeld, geen diepte en geen moment, en geen pagina waar je wilt blijven kijken. Bezoekers onthouden de belofte ("met bonnetje"), maar niet het beeld.

## 2. Audit

### KEEP: dit is sterk en blijft
- **Het palet van de eigenaar** (bijna-zwart, cyaan voor interactie, smaragd, oranje/karmijn voor live) en de tokenarchitectuur: papier/inkt/lijn, status- en prijsrichtingtokens, e1–e3.
- **Het bonnetje** als signatuur: thermopapier, en in dark mode een licht eiland. Niemand in de markt heeft dit.
- **Typografie**: Schibsted Grotesk (redactioneel, sterke display) met Plex Mono voor feiten.
- **De vraagbalk** als hoofdrolspeler. Hij werkt ook zonder JavaScript.
- **Eerlijkheid als systeem**: status per feit, bronnen, en geld beslist nooit de volgorde.
- **De basis**: iconenset, focusringen, skip-link, `prefers-reduced-motion`, semantische tabellen.

### IMPROVE: goed idee, zwakke uitvoering
- **Hero**: alleen een tekstkolom, met rechts 30% leegte. De vergelijkingstabel staat er direct onder, dus het eerste scherm voelt als een spreadsheet. De kolom "Werkt op" wordt op 1440 px afgekapt.
- **Toolidentiteit**: letters in een gekleurd vierkant (ChatGPT, Claude en Copilot zijn allemaal "C"). Voor 35 tools mag een echt logo (simple-icons, CC0, zelf gehost).
- **Kaarten**: alleen tekst, allemaal even zwaar, zonder hover-diepte of entree. Overal kader-in-kader (hub-panel > radar-col).
- **Ritme**: elke sectie heeft dezelfde vorm (h2 + raster), dus er is geen dramaturgie.
- **Toolpagina-kop**: mist een titelmoment. Kerncijfers staan verspreid. "Website: nog niet gecontroleerd" en een lege tijdlijn worden getoond.
- **Stempels in het bonnetje**: "ONDERBOUWD" in hoofdletters op elke regel is luid en herhalend.

### REPLACE: weg ermee
- **Fair Fights als chipwolk** (alfabetisch "A vs B") → versus-kaarten met twee identiteitsmerken tegenover elkaar.
- **"Zo werkt het 01/02/03"** (generiek) → de belofte zichtbaar maken in een echt bonnetje (golf 2).
- **Categorieën als tekstkaarten met chipwolken** → werelden.
- **Lege radarkolommen op de home** ("Nog geen nieuws") → niet tonen.

### INVENT: nieuw
1. **Werelden.** Elke categorie is een plek: een maquette in isometrie (vloer, twee wanden, 3–6 objecten) met één eigen lichtkleur. Assistenten = gesprekskamer, Schrijven = schrijfkamer, Onderzoek = lab, Beeld = creatieve studio, Video = filmstudio, Audio = opnamestudio, Code = werkplek van de toekomst, Automatisering = commandocentrum, Marketing = campagnekamer, Klantcontact = servicebalie. De home krijgt "het kantoor van de wijzer": een wandklok en een bonnetjesprinter.
   - Eén tekenstijl: maquette, geen cartoon, geen personages, geen AI-clichés (geen robots, breinen, sparkles of neurale netten).
2. **Een podium dat luistert.** Typ "ik wil een filmpje maken" en het podium verandert in de filmstudio, met het onderschrift "Filmstudio · 29 tools →". Dat gebeurt lokaal in de browser, op de woorden uit de eigen taxonomie (functies, synoniemen, taakzinnen). De voorbeeldprompts doen hetzelfde bij hover en focus.
3. **Identiteitsmerk (ToolMark)**: één tegel voor alle tools: een logo-glyph in inkt, of initialen in Schibsted, met een stip in de wereldkleur.
4. **Toolkaart 2.0**: merk, naam, maker, doel, kernfunctie met wereldstip, vanaf-prijs in mono met ≈€, "gratis plan", en **"x% onderbouwd"** in plaats van sterren.
   - We verzinnen geen beoordelingen of reviews. Het bewijspercentage is echte data (status per feit) en past bij het merk.
5. **Titelpagina per tool** (zoals IMDb, golf 2):
   - wereld als achtergrond;
   - groot merk;
   - kerncijferstrook: vanaf-prijs · gratis plan · platforms · Nederlands · EU-data · traint op data;
   - daarna prijzen (bonnetje), functies, alternatieven en duels.
   - Geen screenshots: die van derden mogen we niet zomaar overnemen (§30).

## 3. Richting: "Podium en bonnetje"
Elke pagina heeft twee lagen:
- **het podium**, de wereld van wat je wilt maken: emotie, oriëntatie, beeld;
- **het bonnetje**, de feiten: prijzen, bronnen, status.

Daartussen staat het identiteitsmerk van de tool als hoofdrolspeler. Het podium is gevoel, het bonnetje is bewijs. Samen zijn ze uniek in de markt: directories hebben het bewijs niet, en datasites hebben het gevoel niet.

**Verhaal van de home** (geen hero → categorieën → kaarten → footer):
1. **Vraag**: het podium dat luistert.
2. **Werelden**: tien plekken om te maken.
3. **Naast elkaar**: de matrix (Basis/Advanced).
4. **Wat er verandert**: de radar, alleen met echte items.
5. **Duels**: versus-kaarten.
6. **Begin hier**: stappenplannen.

## 4. Systeem

**Kleur.** Het bestaande palet blijft. Nieuw zijn tien wereldkleuren:
- tinten op ~36° van elkaar;
- in dark: lichtheid L≈0,80, voor licht en lijnen;
- in licht thema: L≈0,50;
- in beide thema's een tint voor vlakken.

Wereldkleur betekent "waar ben je". Ze is nooit een status en nooit tekstkleur voor bewijs. Contrast als grafisch element is ≥ 3:1.

| Wereld | Tint (OKLCH h) | Plek |
|---|---|---|
| assistant | 290 violet | gesprekskamer |
| writing | 90 zand | schrijfkamer |
| research | 185 teal | lab |
| image | 325 magenta | creatieve studio |
| video | 22 wolfraamrood | filmstudio |
| audio | 255 blauw | opnamestudio |
| code | 150 groen | werkplek |
| automation | 65 amber | commandocentrum |
| marketing | 355 roze | campagnekamer |
| business | 220 hemelsblauw | servicebalie |

**Typografie.** Een displayschaal voor heroes (`--fs-display` clamp 2,75–5,25rem), titels (2,25 / 1,75 / 1,375rem), body 1rem, meta 0,8125rem. Display gebruikt gewicht 750 met -0,03em letterspatiëring.

**Ruimte.** Sectieritme `--space-section` clamp(4rem, 8vw, 7rem). Binnen een sectie het 4px-raster.

**Radius** (bestaand): 4 / 8 / 12 / 999. Wereldkaarten gebruiken 12.

**Diepte.** e1 is rust, e2 hover en popovers, e3 dialogen. In de maquettes zit diepte in de vlakken (boven, links en rechts in drie tinten), niet in schaduwen.

**Beweging** (70% stilstaand ontwerp, 20% micro-interacties, 10% momenten):

| Token | Waarde | Gebruik |
|---|---|---|
| `--dur-1` | 120ms | indrukken, kleur |
| `--dur-2` | 200ms | hover, rand, schaduw |
| `--dur-3` | 420ms | entree van kaarten en panelen |
| `--dur-4` | 700ms | wereldwissel op het podium (het enige "moment") |
| `--ease-out` | cubic-bezier(0.16, 1, 0.3, 1) | entree |
| `--ease-std` | cubic-bezier(0.2, 0, 0, 1) | toestanden |
| `--ease-io` | cubic-bezier(0.65, 0, 0.35, 1) | crossfades |

Spelregels voor beweging:
- **Hover**: kaart -2px met e2, en de lagen van de maquette verschuiven 2–4px (parallax).
- **Entree**: opacity met 12px translate, één keer, via `animation-timeline: view()`. Zonder ondersteuning is het statisch.
- **Niet doen**: stuiteren, eindeloze loops, deeltjes, autoplay-carrousels of 3D-kanteling.
- **`prefers-reduced-motion`** zet alles uit. Dat staat al globaal en geldt ook voor de pointer-parallax.

**Prestaties.** Maquettes zijn inline SVG (±2–3 kB per stuk). Alleen `transform` en `opacity` animeren, en de enige gradient is het wereldlicht. Op de home komt er ±6 kB gzip JS bij voor de wereldherkenning en de maquettes. Fonts en afbeeldingen veranderen niet. Geen externe hosts (CSP).

**Toegankelijkheid.** Maquettes zijn decoratief (`aria-hidden`). Het onderschrift is tekst, en een wereldwissel wordt gemeld via een beleefde live-regio. Doelen zijn ≥ 44px op mobiel. Focus is altijd zichtbaar.

## 5. Werkwijze en status
1. **Representatief gebied eerst**:
   - tokens (wereld, beweging, type);
   - de maquette-engine (isometrie-helpers) en tien plus één werelden;
   - het luisterende podium in de home-hero;
   - ToolMark met logo's.
2. Beoordelen op 1440 / 1024 / 390 px, in dark en licht, en met reduced motion. Verfijnen.
3. Uitbreiden:
   - wereldsectie en versus-kaarten op de home;
   - de categoriepagina's als werelden;
   - de titelpagina per tool;
   - toolkaarten in verkennen en alternatieven.

Na elke ronde staat de uitkomst onder "Beoordelingslog".

## Beoordelingslog
*(wordt per ronde bijgewerkt)*
