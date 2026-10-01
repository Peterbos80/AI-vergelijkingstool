# 03 — Design-audit AIToolsWijzer

*Design auditor · 30 sep 2026 · Basis: `shots/` (24 opnames), eigen opnames in `design-shots/` (390/768/1024/1280 px + DPR 2-crops), code in `src/`. Contrast berekend volgens WCAG. Het grafiekpalet is gevalideerd met de dataviz-validator. Scripts: `design-shots.cjs`, `overflow-check.cjs`, `contrast*.py`.*

## 0. Kort
Het concept is top tier: "AI-tools, met bonnetje", de wijzer, papier & inkt (strategy 04 §6, 10 §1). De uitvoering is dat niet. De site is weggedreven van haar eigen spec: neon-cyaan en glow in dark mode, drie accentkleuren en emoji als iconen. Het bonnetje staat alleen in Match. Alles heeft hetzelfde gewicht en er is bijna geen datavisualisatie. Daarbovenop zitten bugs die een topsite nooit heeft. De oplossing is geen nieuwe huisstijl, maar het concept consequent doorvoeren: **kleur is data**.

## 1. Diagnose

### 1.1 Sitebreed
| # | Probleem | Bewijs |
|---|---|---|
| G1 | **Twee merken.** Licht = papier + petrol; donker = neon-cyaan `#00F0FF` met glow, wat spec 10 §1.3 zelf verbiedt ("één accentkleur, geen glow"). Er zijn drie accenten (signal, accent, ok), maar geen merkkleur. Licht (off-white + turquoise) lijkt bovendien op Perplexity (niet online geverifieerd), een risico voor een neutrale vergelijker. | home__desktop-dark vs -light |
| G2 | **Emoji als iconen**: 10 categorie-emoji, 20 Pulse-emoji, ⚡/💻, 🔥, ⚠️. Ze renderen per besturingssysteem anders en ogen als een template. | start__desktop-dark, pulse__desktop-dark |
| G3 | **Stempelruis.** `data/tools/*.json` bevat 0× VERIFIED (121 supported, 130 unverified). Bijna elke waarde heeft dus hetzelfde blauwe "ONDERST."-kader, en dat is luider dan de waarde zelf. De afkortingen zijn cryptisch; "Ondersteund" is dubbelzinnig. | compare-chatgpt-claude__desktop-light (10 stempels op 7 rijen) |
| G4 | **Vlakke hiërarchie**: H2 is 20–24px bij body 16px; alles zit in 1px-kaarten; er zijn 11 radii; de banden op de home ogen streperig. | home__desktop-dark |
| G5 | **Mono overal**, waardoor "mono = feit" geen betekenis meer heeft. | alle |
| G6 | **Prijsbug**: `tabular-nums` op Schibsted maakt de komma 2,3× breder ("US$ 18 ,33"). Een euro-bedrag ontbreekt vaak. | design-shots/zoom-pricing-table-light |
| G7 | **Zwakke toolidentiteit**: hash-kleur en mono-letters; ChatGPT, Claude, CapCut en Copilot zijn allemaal "C". | tools__desktop-light |
| G8 | **Header**: 7 navigatie-items, zoekveld, niveauschakelaar, taal en ticker (94px chroom). Gemeten breedte 1042px (bij 768px) en 1274px (bij ≥1024px). Daardoor **scrolt de pagina horizontaal van 768 tot ~1300px**, ook op een 1280-laptop. Het mobiele menu is een zwevend kaartje dat overloopt. | design-shots/home-768, home-1024, zoom-header-light, home-mobile-menu |
| G9 | **Ticker**: marquee met emoji op elke pagina, die concurreert met de H1. | alle |
| G10 | **Lege staten als inhoud** (radar 2/3 leeg, nieuws, tijdlijn, "Website: nog niet gecontroleerd"), terwijl spec 10 §4.1 zegt: niet renderen. | home, news, tool-descript |
| G11 | **AA-risico**: de randen van inputs en selects halen 1,2–1,4:1; WCAG 1.4.11 eist 3:1 (axe test dit niet). | doctor, tools |

### 1.2 Per pagina
| Pagina | Opnames | Onder top tier doordat… |
|---|---|---|
| Home | home__* | Rechts 35% leeg; slogan ín het invoerveld; Engelse badges; de matrix zit in `max-w-4xl`, dus "Werkt op" wordt afgekapt en rijen zijn 5 regels hoog; taken staan er twee keer; 4.119px lang en toch geen productbeeld (geen bonnetje). |
| Verkennen | tools__* (12.497px) | 100 rijen zonder paginering; zes selects; op mobiel eerst een scherm vol filters; per rij een rafelige rechterkolom (prijs, gratis, stempel, dial, vinkje). |
| Toolpagina | tool-descript__*, design-shots/tool-gemini | Geen overzicht in één oogopslag; vanaf-prijs in de zijkolom (mobiel onderaan); bronnen als "[Secundaire bron] x.io" ×9 ogen als debug-uitvoer; lege tijdlijn; CTA scrolt weg. |
| Prijzen | pricing-elevenlabs__*, design-shots/pricing-gemini | Kale tabel; plannaam in een grijze kopkolom. Time Machine: oude prijs is een stipje, labels overlappen, geen as, en een prijs*daling* is **rood**. |
| Vergelijken | compare-*, design-shots/compare-3, -mobile-full | Stempel in elke cel; functies als kommabrij; "beste" is een ✓ van 10px; lege beslisblokken ónder de tabel; op mobiel valt tool 2 buiten beeld. |
| Match | match__*, design-shots/zoom-receipt-* | De beste pagina, maar het bonnetje is in dark een terminalpaneel, een groen "gratis plan" onder een betaalde prijs verwart, en het totaal krijgt geen nadruk. |
| Taak | task__* (5.807px) | Dezelfde tools staan er 2–3× in; een kaartenmuur. |
| Start | start__*, design-shots/start-mobile | Emoji-kaarten, een weeskaart en nauwelijks voortgang. |
| Nieuws | news__* | De lege staat ís de pagina. |
| Doctor | doctor__* | Acht identieke selects; het resultaat wordt niet beloofd. |
| Pulse | pulse__* | Goede structuur, maar emoji, geen oude→nieuwe prijs en geen monogram. |
| Leren | learn__* | 45% lege rechterkant en geen inhoudsopgave. |

## 2. Visuele richting: "Kleur is data"
**Beeld:** de betrouwbaarheid van een stationsklok en de eerlijkheid van een kassabon.

1. **Papier & inkt: de interface zwijgt.** De interface is monochroom in beide thema's: warm papier, diepe inkt, haarlijnen en een strak 12-koloms raster. Donker = *nachtinkt*: warm bijna-zwart, zonder blauwe zweem of glow.
2. **De wijzer: één signaalkleur.** Wijzerrood `#D63F1E` is de secondewijzer, "zojuist gecontroleerd". Het is alleen voor de logo-wijzer, de actieve navigatiestreep, de focusring, de live-stip en de "nu"-markering in grafieken. Nooit voor vlakken of knoppen; knoppen zijn inkt.
3. **Het bonnetje: bewijs als object.** Elk feit is een regel met een bron-chip. Elke uitkomst eindigt met een TOTAAL. Bewijs vouwt open als een bon: thermopapier, zigzagrand, mono, stippellijnen, dubbele totaalstreep. **Signatuur: in dark mode blijft het bonnetje papier**, een licht eiland op nachtinkt dat in elke screenshot en deelkaart herkenbaar is.

Kleur verschijnt alléén als ze iets betekent: bewijsstatus, prijsrichting, versheid, toolidentiteit en grafiekreeksen. Waarom deze richting:
- Het ontwerp bewijst de belofte: feiten boven marketing.
- Het onderscheidt zich van de AI-clichés (paars, neon, glas) en blijft neutraal tegenover vendors (teal ≈ Perplexity, terracotta ≈ Claude, groen ≈ OpenAI).
- Data krijgt het volume.
- Het is goedkoop en statisch te bouwen: tokens plus ~8 componenten, 0 kB extra JS.

**Patronen** (niet kopiëren): Vercel/Linear (monochrome precisie), NS-borden en de stationsklok (helderheid), Tweakers Pricewatch (prijsverloop, specificaties), FT (papierkleur als merk), Artificial Analysis (gelabelde grafieken).
**Verboden:** verlopen, glow, glas, emoji, ✨, robotjes, stockfoto's, "populair"-badges zonder data.

## 3. Design system

### 3.1 Kleurtokens
Deze tokens vervangen de `:root`-blokken in `globals.css`. De contrastwaarden zijn de laagste gemeten waarde over paper, paper-2, surface en surface-2.

| Token | Licht | Donker | Gebruik · contrast (licht/donker) |
|---|---|---|---|
| `--paper` / `--paper-2` | `#F7F5F0` / `#EFECE4` | `#121211` / `#0C0C0B` | pagina / verzonken (tabelkop, footer, tags) |
| `--surface` / `--surface-2` | `#FFFFFF` / `#FAF8F4` | `#1B1B19` / `#242421` | kaarten, tabellen, grafieken / hover, selectie |
| `--ink` | `#151513` | `#F3F0E8` | tekst, primaire knop · ≥15,5 / ≥13,7 |
| `--ink-2` | `#3F3E3A` | `#CCC7BC` | secundair · ≥9,0 / ≥9,2 |
| `--ink-3` | `#67655F` | `#A09B90` | meta, minimaal 13px · ≥4,9 / ≥5,6 |
| `--line` | `#E3DFD6` | `#302F2B` | decoratieve haarlijn |
| `--line-strong` | `#8A867D` | `#77736B` | rand van inputs, selects, checkbox en secundaire knop · ≥3,07 / ≥3,30 (1.4.11) |
| `--signal` / `--signal-ink` | `#D63F1E` / `#B2361A` | `#FF6B4A` / `#FF8D73` | wijzer, focus, live · ≥3,9 / ≥5,5 · als tekst ≥5,2 / ≥6,9 |
| `--marker` | `#FFE7A3` | `#4D4214` | markering "laagste" of "verschil", nooit de enige drager · inkt 15 / 8,8 |
| `--verified` / `-bg` | `#17734A` / `#E4F1E9` | `#5CC98F` / `#17291F` | ≥4,96 / ≥7,4 (ook op eigen tint) |
| `--supported` / `-bg` | `#2553C4` / `#E6ECFA` | `#93B2FF` / `#1A2238` | ≥5,7 / ≥7,4 |
| `--community` / `-bg` | `#8C5300` / `#F6ECDC` | `#E6A955` / `#2D2414` | ≥5,3 / ≥7,4 |
| `--unverified` | `#67655F` + streepjesrand | `#A09B90` + streepjesrand | |
| `--price-up` / `-bg` | `#B42318` / `#FBE6E3` | `#FF8A7A` / `#33191A` | ≥5,5 / ≥6,8 |
| `--price-down` / `-bg` | `#17753F` / `#E3F1E8` | `#5CC98F` / `#17291F` | ≥4,87 / ≥7,4 |
| `--receipt` | `#FFFEFB` | `#E7E1D4` | bonnetje (licht eiland in dark) |
| `--receipt-ink` / `-ink-3` | `#1C1B18` / `#67655F` | `#1C1B18` / `#5A5850` | 17 / 13,2 · 5,8 / 5,5 |

- **Op het bonnetje** gelden in beide thema's eigen statuskleuren: verified `#15643C`, supported `#2148AE`, community `#7A4700`, up `#9E1F15` (alle ≥5,5:1). Implementeer dit als `.receipt{color-scheme:light;--ink:var(--receipt-ink);…}`.
- **Grafiekreeksen 1–4**: licht `#2A78D6 #EB6834 #1BAF7A #EDA100`, donker `#3987E5 #D95926 #199E70 #C98500`. Gevalideerd: CVD-ΔE ≥9,1 (licht) / ≥8,4 (donker), normaal zicht ≥19,8. In licht haalt een deel van de reeksen geen 3:1 (slots 3–4 op surface, 2–4 op paper). Daarom zijn **directe labels en een tabelweergave verplicht**, en staan grafieken altijd op `--surface`.
- **Statusmarks**: good `#0CA30C`, warning `#FAB219`, critical `#D03B3B`, altijd met icoon en label.
- **Schrappen**: `--accent` (petrol/cyaan), `--glow`, de gradients in `.hero`, `--live-2` en `--ok`.

### 3.2 Typografie
Schibsted Grotesk en IBM Plex Mono blijven; er komt geen nieuw font bij.

| Rol | Specificatie (gewicht · grootte/regelhoogte · spatiëring) |
|---|---|
| Display (alleen home-H1) | 800 · `clamp(2.75rem,1.6rem+4.6vw,5rem)` (44→80px) / 0,98 · −0,035em |
| H1 | 750 · `clamp(2rem,1.55rem+1.9vw,3rem)` (32→48px) / 1,05 · −0,025em |
| H2 | 700 · `clamp(1.5rem,1.35rem+.6vw,1.875rem)` (24→30px) / 1,15 · −0,02em |
| H3 / H4 | 650 · 20px/1,25 · −0,01em  /  650 · 16px/1,35 |
| Lead | 400 · 19px (mobiel 18px)/1,5 · ink-2 |
| Body / prose | 400 · 16px/1,6 · prose 17px/1,65, maximaal 68ch |
| UI / small | 500 · 14px/1,45 |
| Meta | 400 · 13px/1,4 · ink-3 (nooit 12px grijze sans) |
| Label | 650 · 12px · +0,07em · hoofdletters · ink-2 (vervangt de mono-eyebrow) |
| Data | Plex Mono 500 · 14px/1,45: prijzen, datums, domeinen, aantallen |
| Data-lg | Plex Mono 600 · 28–32px/1,1: prijs in de toolhero en op de plankaart |
| Bonnetje | Plex Mono 400 · 14px/1,55; kop 600 · 13px · +0,08em · hoofdletters |

**Regels:**
- Mono is alleen voor feiten.
- Prijzen staan altijd in mono (Plex is al tabulair). Gebruik **nooit `tabular-nums` op Schibsted**.
- Koppen krijgen `text-wrap:balance`, lopende tekst `text-wrap:pretty`.

### 3.3 Ruimte, vorm, diepte
- **Spacing** (4px-basis): 2·4·8·12·16·20·24·32·40·48·64·80·96.
  - Afstand tussen secties: 48px mobiel, 88px desktop.
  - Van kop naar inhoud: 16–24px.
  - Kaartpadding: 16px mobiel, 24px desktop. Tabelcel: 12×16px.
  - Container 75rem, 12 kolommen, gap 24px, zijmarge 16/24/32px.
- **Radius**: 4px (tags, stempels), 8px (knoppen, inputs), 12px (kaarten, tabellen, panelen), 999px (chips, segmented control), 0 (bonnetje), monogram 25%. Verder niets.
- **Diepte**: standaard plat met een 1px `--line`.
  - e1 (hover): `0 1px 2px rgb(21 21 19/.06), 0 4px 12px -4px rgb(21 21 19/.10)`
  - e2 (popover, lade, tray): `0 12px 32px -12px rgb(21 21 19/.22)`
  - e3 (dialoog, ⌘K): `0 24px 64px -16px rgb(21 21 19/.32)`
  - Bonnetje: `0 1px 1px rgb(0 0 0/.04), 0 10px 24px -12px rgb(0 0 0/.2)`; in dark `.7`.
  - In dark mode is diepte één surface-stap plus `inset 0 1px 0 rgb(255 255 255/.04)`. Geen glow.
- **Randen**: 1px line (scheiding), 1px line-strong (controls), 2px ink (geselecteerd), 1px gestreept (onbevestigd, bonregels), 3px dubbel (TOTAAL). Focus: 2px signal met 2px offset.

### 3.4 Iconen (vervangen alle emoji)
Een eigen inline-SVG-registry in `src/components/ui/Icon.tsx` (`<Icon name="video"/>`), server-rendered en `aria-hidden`. Een icoon staat altijd naast tekst, of de knop krijgt een `aria-label`.
- Raster 24, live area 20, stroke 1,75 (1,5 op 16px), ronde uiteinden en hoeken, `currentColor`.
- Maten 16/20/24/32.
- Paden afgeleid van Lucide (ISC-licentie, met vermelding); er is geen npm-pakket nodig.

Benodigde iconen:
- **Categorieën (10)**:
  - assistent `message-square`, schrijven `pen-line`, onderzoek `book-open`, beeld `image`, video `clapperboard`
  - audio `audio-lines`, code `code-xml`, automatisering `workflow`, marketing `megaphone`, klanten `headset`
- **UI (10)**: `search`, `menu`, `x`, `arrow-right`, `arrow-up-right` (extern), `chevron-down`, `columns-2` (vergelijk), `sliders-horizontal` (filter), `bookmark`, `share-2`.
- **Bewijs (6)**: `badge-check` gecontroleerd, `files` onderbouwd, `users` community, `circle-dashed` onbevestigd, `receipt` bronnen, eigen `dial` (= logo, voor versheid).
- **Pulse (20 events → 13 tekens)**:
  - prijs: `trending-up` omhoog, `trending-down` omlaag
  - plannen: `list-plus` / `list-minus` plan erbij/weg, `gift` / `circle-slash` gratis plan erbij/weg
  - product: `square-plus` functie of nieuwe tool, `tag` release of naam
  - status: `power-off` stopgezet, `unplug` / `plug` site weg/terug
  - overig: `newspaper` nieuws, beleid, geld en overname; `play` video; `activity` buzz
- **Platforms (6)**: `globe` web, `monitor` desktop, `smartphone` mobiel, `braces` API, `terminal` CLI, `server` self-host.

### 3.5 Toolidentiteit: monogram 2.0
- **Vorm**: squircle (radius 25%), maten 20/28/40/64px. Letters in Schibsted 700 op 42% van de maat, −0,02em.
- **Data per tool**: `identity.hue` (0–359, redactioneel gekozen; mag naar de merkkleur verwijzen zonder logo) en `identity.letters` (ChatGPT "GP", Claude "Cl", CapCut "Cc", Copilot "Co"). Zonder deze velden valt het terug op de huidige hash.
- **Kleur** in OKLCH:
  - licht: achtergrond `oklch(.94 .04 h)`, letters `oklch(.38 .10 h)`
  - donker: achtergrond `oklch(.30 .05 h)`, letters `oklch(.88 .07 h)`
  - Gemeten over alle tinten: ≥7,7:1 in licht en ≥9,3:1 in donker.
- **Details**: 1px binnenring op 8% inkt. Een stopgezette tool wordt grijs met een diagonale streep. In Vergelijken krijgt het monogram een 2px ring in de reekskleur.
- **Later, optioneel**: een build-time logo-pipeline, alleen met rechten. Persmap-SVG's lokaal in `public/logos`, bron en licentie in de data, nooit hotlinken. Het monogram blijft de fallback.

### 3.6 Datavisualisatie
Alle grafieken zijn SVG, server-side gerenderd, zonder chartbibliotheek. Algemene regels:
- Het grid is een solide haarlijn van 1px `--line`, nooit gestippeld. Marks zijn dun.
- Labels gebruiken teksttokens, nooit de reekskleur.
- Label selectief direct; er staat altijd een tabel of lijst naast de grafiek.
- Marks krijgen een tooltip en toetsenbordfocus.

Grafiektypen:
- **Prijstrap** (toolpagina en prijzenpagina):
  - Horizontale balken per plan, oplopend vanaf €0. Balk 16px dik met een afgerond eind van 4px.
  - Alle plannen in `--ink-3`, het instapplan in reeks 1.
  - Een gratis plan is een punt van 8px op de basislijn met label "Gratis".
  - Label aan de punt van de balk (mono 13px), per gebruiker met `user`-icoon. De jaarprijs is een tick van 2px met label.
- **Time Machine**:
  - Stapgrafiek van 2px: de huidige periode in `--ink`, de historie in `--ink-3`.
  - Een wijziging is een punt van 8px met een ring van 2px in de surface-kleur, plus een deltapil ("−38% · 8 jun").
  - Drie afgeronde ticks op de y-as, maanden op de x-as, eindlabel "US$ 4,99 nu".
  - Een onbekend begin wordt een holle punt met "tot 8 jun". Hoogte 160px (mobiel 120px).
- **Sparkline** (ToolRow): alleen bij ≥3 prijspunten. 64×20px, lijn 1,5px `--ink-3`, eindpunt `--signal` als de wijziging jonger is dan 30 dagen. Bij 2 punten een deltachip in plaats van een sparkline.
- **Prijsbereik** (Vergelijken, maximaal 4 tools): per tool een lijn van 2px van het goedkoopste naar het duurste plan, met punten per plan, labels bij minimum en maximum, en een gedeelde euro-as.
- **Bewijsmeter**: een gesegmenteerde balk van 6px met gaten van 2px en een legenda met aantallen ("5 onderbouwd · 2 onbevestigd"). Nooit een score.
- **Versheid**: de logo-wijzer op 16/20px. De hoek van de wijzer geeft de leeftijd, de kleur de status, altijd met een tekstlabel.

### 3.7 Componenten
- **Header** (64px desktop, 56px mobiel):
  - Inhoud: logo met een rode wijzer; navigatie *Verkennen · Vergelijken · Stack Doctor · Pulse · Leren*; zoekknop "Zoek tool of taak ⌘K" (opent een palet met tools, taken en "Vraag: …" → Match); segmented control "Basis | Gevorderd"; "EN".
  - Match valt weg uit de navigatie (het logo leidt naar de home); Nieuws wordt een tab in Pulse.
  - Actief item: inkt met een streep van 2px in signal.
  - Onder 1024px: alleen logo, zoek-icoon en "Menu". Het menu opent schermvullend, met rijen van 48px.
- **Hero + vraagvak** (grid 7/5):
  - Links: de display-H1, de lead en het vraagvak.
    - Vraagvak: surface, rand line-strong, radius 16, schaduw e1, textarea van 20px.
    - Onder de textarea staan optionele chips [Budget ▾] [Niveau ▾] en de knop "Vraag →".
  - Daaronder drie voorbeeldchips (zonder Engelse badges) en de link "Kies stap voor stap".
  - Rechts: een **echt voorbeeldbonnetje**, gegenereerd door de engine tijdens de build en gelabeld "Voorbeeld · echte uitkomst · gecontroleerd {datum}".
- **ToolRow**:
  - Opbouw: monogram 40px, naam 16/650, tagline op regel 2, maximaal 2 tags.
  - Rechts: prijs in mono, eronder het bedrag omgerekend (≈ €) en het origineel; één bonnetje-chip voor status en versheid samen; een vergelijk-toggle.
  - De hele rij is klikbaar.
- **ToolCard** (alternatieven): monogram en naam; prijs in data-lg; 1–2 echte verschillen ("heeft gratis plan"); knop "Vergelijk met X".
- **Vergelijkingstabel**:
  - Sticky kop met monogram, naam en prijs.
  - Groepsrijen: Prijs, Toegang & platforms, Functies, Privacy/EU.
  - De beste cel krijgt `--marker` plus de tag "laagste". Gelijke rijen staan in ink-3 met de tag "gelijk" en verdwijnen met "Alleen verschillen" (checkbox + `:has()`, zonder JS; `buildMatrix` levert `differs` al).
  - Ja/nee met icoon plus tekst; onbekend is "–" met tooltip.
  - Platforms als iconenmatrix; functies als "Beide / Alleen A / Alleen B".
  - Een statusglyph per cel; legenda en bronnen in de voet.
  - Mobiel: een blok per criterium, met de waarden 50/50 naast elkaar.
- **Plankaart**:
  - Radius 12, padding 20. Naam 18/650, prijs in data-lg met "/mnd".
  - Een mono-regel met het origineel, "per gebruiker" en de ECB-datum.
  - Jaarprijs met een deltachip; quota; kleine lettertjes met `alert`-icoon.
  - Voet: bonnetje-chip. Geen "populair"-badge. Bij een onbekende prijs: "Op aanvraag".
- **Bonnetje-chip**:
  - Compact (in tabellen en lijsten): een glyph van 16px in een knop van 24px, met de toegankelijke naam "Onderbouwd · 2 bronnen · 29 sep". De knop opent de bronnenlade.
  - Standaard: glyph, label (12/600) en datum (mono) op de `-bg`-tint, radius 4.
  - Onbevestigd: transparant met een gestreepte rand.
  - De rubberstempel komt alleen nog voor in de lade of op het bonnetje.
- **Statuslabels**: Gecontroleerd · Onderbouwd (was "Ondersteund") · Community · Onbevestigd. Geen afkortingen.
- **Chips en tags**:
  - Filterchip: pill van 32px; aan = inkt op papier.
  - Tag: 24px, radius 4, paper-2.
  - Functiechip: primair met een gevulde stip, secundair met een holle stip, plus een legenda.
  - Deltachip: mono op de up- of down-tint, met icoon.
- **Knoppen**:
  - Primair: inkt, 40px hoog (mobiel 48px), radius 8, 15/600.
  - Secundair: surface met rand line-strong. Ghost: ink-2 met hover paper-2.
  - Links: onderstreept 1px, bij hover 2px.
  - Externe links altijd met `arrow-up-right` en het affiliate-label eronder.
  - Geen glow en geen verlopen.
- **Lege staat**: lege secties render je niet. Op paginaniveau: een gestreepte kader, een icoon van 32px, één zin over wanneer er data komt en één actie.
- **Footer**:
  - Bovenrand als bonscheur (zigzag).
  - Kolommen met labels: Product, Leren, Openheid, Over.
  - De datalijn als bontotaal: "101 TOOLS · 559 FEITEN · GECONTROLEERD 29-09-2026".
  - Mobiel twee kolommen.

## 4. Paginaschetsen

**Home**
```
HERO 7/5   H1 · lead · vraagvak · 3 voorbeeldchips · "Kies stap voor stap →"
           | VOORBEELDBONNETJE (engine-uitkomst); mobiel onder de chips, ingeklapt tot 3 regels + totaal
BONVOET    101 tools · 559 prijzen en feiten · 77% meerdere bronnen · gecontroleerd 29 sep → methodologie
NET VERANDERD  3–5 regels: icoon · monogram · "Gemini: US$ 7,99 → 4,99 (−38%)" · datum · bron-chip (alleen met data)
NAAST ELKAAR   toolmatrix over de volle breedte, niveauschakelaar, platformiconen; mobiel als kaartlijst
TAKEN      8 tegels: categorie-icoon · titel · stappen · top-3 monogrammen · "start gratis"/"vanaf € x" (engine)
FAIR FIGHTS    [monogram] vs [monogram] · aantal verschillen
HOE HET WERKT  01 Jij zegt wat je wilt · 02 Wij rekenen met bonnetjes · 03 Geld beslist niet
RADAR      alleen kolommen met data · FOOTER met bonscheur
```
**Toolpagina**
```
HERO   monogram 64 · H1 · tagline · "door Descript · Video · Beginner"         [Bezoek ↗] [Vergelijk]
KERNCIJFERS (mobiel 2×2): vanaf US$ 24 (≈ €…) · Gratis plan: ja, met watermerk · platformiconen · EU-data: – · wijzer
MAIN 8                                         | ASIDE 4 (sticky): BONNETJE-SAMENVATTING
In het kort + Beste voor / Niet voor /           |  bewijsmeter · gecontroleerd/gewijzigd · bronnen
  Beperkingen (iconen)                           |  gegroepeerd (Officieel 2 · Secundair 7) · [Bezoek ↗]
PRIJZEN: prijstrap + plankaarten → Time Machine  |  · "Meld een correctie"
KLEINE LETTERTJES · DNA + legenda · EU-LENS (alleen bekende feiten) · TIJDLIJN (alleen met events)
ALTERNATIEVEN: 3 ToolCards met echte verschillen + Fair Fights · VIDEO'S
Mobiel: sticky onderbalk 56px [Bezoek ↗][Vergelijk]
```
**Vergelijken**
```
H1 "ChatGPT vs Claude" · "Fair Fight: dezelfde criteria, geen totaalwinnaar"
FACE-OFF (sticky, compact 56px): [monogram · naam · vanaf-prijs · gratis-chip · Bezoek ↗]  vs  [idem]
KIES X ALS JE… / KIES Y ALS JE…  1–3 redenen met bron-chip, bóven de tabel; geen reden = één gedempte zin
SAMENVATTING  "3 van 7 criteria verschillen" · [ ] Alleen verschillen · bewijsmeter
TABEL  Prijs · Toegang & platforms (iconen) · Functies (Beide/Alleen A/Alleen B) · Privacy/EU
PRIJSBEREIK  plannen per tool op één euro-as
VOET  legenda · bronnen (n) · andere Fair Fights · "Advies op maat? → Match"
Mobiel: face-off twee kolommen sticky; per criterium een blok 50/50; nooit horizontaal scrollen
```

## 5. Geprioriteerde veranderlijst
**QW** = quick win · **SIG** = signature move. Alle paden relatief aan `src/`.

| # | Wat | Imp | Eff | Bestanden | Acceptatiecriteria |
|---|---|---|---|---|---|
| 1 | **QW** Header-overflow repareren en de header versimpelen (§3.7) | H | M | `components/site/Header.tsx`, `level/LevelTabs.tsx`, `globals.css`, `i18n/messages/*.json` | `scrollWidth == innerWidth` op 320, 360, 390, 768, 820, 1024, 1180, 1280 en 1440px; header 64/56px; ≤5 navigatie-items; menu met Esc en focusherstel |
| 2 | **SIG** Tokenreset "papier & inkt" (§3.1), 4 radii | H | M | `app/globals.css`, `[locale]/layout.tsx` (themeColor), `home/AskBox.tsx` | Geen cyaan, glow of radial-gradient meer; tekst ≥4,5:1 en controlranden ≥3:1 in beide thema's; axe groen |
| 3 | **QW** Emoji vervangen door `Icon.tsx` | H | S | nieuw `ui/Icon.tsx`, `start/emoji.ts`, `start/page.tsx`, `lib/catalog/events.ts`, `RadarPanel.tsx`, `pulse/page.tsx`, i18n | 0 emoji in `src` (buiten admin); elk icoon `aria-hidden` naast tekst |
| 4 | **QW** Ticker weg; het Pulse-item in de navigatie krijgt een stip met het aantal wijzigingen (30 dagen) | M | S | `[locale]/layout.tsx`, `site/PulseTicker.tsx`, `Header.tsx` | Nergens meer een marquee; aantal berekend uit `catalog.events`, verborgen bij 0 |
| 5 | **QW** Prijzen in mono, geen `tabular-nums` op Schibsted, euro-bedrag plus origineel | H | S | `globals.css`, `data/format.ts`, de views voor prijzen, tool en vergelijken, `StackReceipt.tsx` | Nergens "18 ,33"; het origineel is altijd zichtbaar; ≈€ alleen met een ECB-datum |
| 6 | **SIG** Bonnetje-chip en statusregels, "Onderbouwd", legenda | H | M | `StatusStamp.tsx` → `ReceiptChip.tsx`, `CompareView.tsx`, `ToolRow.tsx`, `FactList.tsx`, `StackReceipt.tsx`, `nl.json`/`en.json` | Geen tekststempels in cellen of rijen; elke glyph heeft een naam en opent de lade; geen afkortingen |
| 7 | **SIG** Bonnetje 2.0: zigzag (CSS mask), thermopapier, dubbele totaalstreep, licht eiland in dark, print-CSS | H | M | `globals.css`, `stack/StackReceipt.tsx`, `data/ReceiptDrawer.tsx` | Receipt-tokens ≥4,5:1 in beide thema's; bestaande `data-testid`'s blijven; print toont alleen de bon |
| 8 | **SIG** Home-hero met een echt voorbeeldbonnetje en de bonvoet | H | M | `[locale]/page.tsx`, `AskBox.tsx`, `lib/engine/compose.ts` (`composeVariants`) | Voorbeeld komt tijdens de build uit de engine en is gelabeld; geen hardcoded getallen; vraagvak boven de vouw op 390×844 |
| 9 | **QW** Home opschonen: matrix over de volle breedte met platformiconen, dubbele taken weg, lege radarkolommen weg | M | S | `[locale]/page.tsx`, `ToolMatrix.tsx`, `RadarPanel.tsx`, `StarterWorkflows.tsx` | Geen horizontale scroll in de matrix vanaf 1024px; home minstens 25% korter |
| 10 | Monogram 2.0 (§3.5) | M | S | `data/ToolMonogram.tsx`, `globals.css`, `data/tools/*.json` plus de catalogustypes | Letters ≥4,5:1; binnen een categorie geen twee tools met gelijke letters en ΔH<25 |
| 11 | Toolpagina: kerncijfers-strook, aside als bonnetje-samenvatting, sticky CTA op mobiel | H | M | `tools/[slug]/page.tsx`, nieuwe `KeyFacts.tsx` en `EvidenceMeter.tsx` | Vanaf-prijs en gratis plan boven de vouw op 390×844; bronnen gegroepeerd met aantallen |
| 12 | **SIG** Prijstrap en plankaarten | H | M | nieuwe `data/PriceLadder.tsx` en `PlanCard.tsx`, `pricing/page.tsx`, `tools/[slug]/page.tsx` | Basislijn €0, labels aan de balkpunt, per-gebruiker gemarkeerd; de tabel blijft als detail |
| 13 | Time Machine herbouwen (§3.6) | M | S | `data/PriceHistoryChart.tsx` | Oude en nieuwe prijs gelabeld; deltapil met teken en icoon; geen overlap op 320px; een daling is niet rood |
| 14 | **SIG** Vergelijken herontwerpen (§4) | H | L | `data/CompareView.tsx`, `compare/[pair]/page.tsx`, `compare/page.tsx`, `lib/engine/compare.ts` | Op 390px geen horizontale scroll; "Alleen verschillen" werkt zonder JS; de keuzehulp staat vóór de tabel |
| 15 | Prijsbereik-grafiek in Vergelijken | M | M | nieuwe `data/PriceRange.tsx` | Gevalideerde reekskleuren, directe labels, tabel ernaast |
| 16 | Verkennen: resultaten eerst (filters in een `<dialog>`), vergelijk-tray via `:has()`, "Toon meer" per 24 | H | M | `explorer/ExplorerView.tsx`, `ToolRow.tsx` | Eerste tool boven de vouw op 390×844; tray verschijnt zonder JS; pagina <4.000px hoog op 1440px |
| 17 | **SIG** Wijzer = logo: rode wijzer, dezelfde tekening voor versheid | M | S | `site/Logo.tsx`, `data/FreshnessDial.tsx` | Leesbaar op 16px; met tekstlabel |
| 18 | Pulse: monogram, icoon, prijs "oud → nieuw (−x%)" | M | S | `pulse/page.tsx`, `lib/catalog/events.ts` | Alleen als beide waarden in de data staan, anders tekst |
| 19 | Start met iconen en een voortgangsbalk; Doctor met een combobox met monogramchips en een preview van het recept | M | M | `start/page.tsx`, `doctor/DoctorView.tsx` | Geen emoji; `aria-current` op de actieve stap; volledig bedienbaar met het toetsenbord |
| 20 | `EmptyState.tsx` plus de regel "lege secties niet renderen"; op Nieuws personen inklappen tot 6 | M | S | nieuwe `ui/EmptyState.tsx`, `news/page.tsx`, `RadarPanel.tsx`, `tools/[slug]/page.tsx` | Nergens een kop met alleen een "nog niets"-zin |
| 21 | Footer als bonvoet | L | S | `site/Footer.tsx` | Kolomlabels; mobiel minstens 40% korter |
| 22 | Taakpagina met tabs per stap (elke tool één keer); Leren met inhoudsopgave en vorige/volgende | M | M | `tasks/[slug]/page.tsx`, `stack/StepDetails.tsx`, `learn/*` | Taakpagina minstens 40% korter |
| 23 | Kwaliteitspoorten: overflowtest op 9 breedtes, unit-test voor tokencontrast (incl. 1.4.11), visuele baselines verversen | M | S | `tests/e2e/visual.spec.ts`, nieuwe tests | CI faalt bij overflow of een contrastregressie |

**Volgorde:**
- Sprint 1: 1–5 en 9. Dit haalt de "goedkope" signalen weg.
- Sprint 2: 6, 7, 8, 10 en 17. Hiermee wordt het merk zichtbaar.
- Sprint 3: 11–16, de beslisschermen.
- Daarna 18–23.

Behoud `data-testid="stack-receipt"`, `receipt-step` en `data-level-tab`, want de journey- en level-tests leunen erop.
