# 10 — UX/UI-specificatie

## 1. Ontwerpprincipes

1. **Antwoord eerst, ontdekken daarna.** Het eerste scherm stelt één vraag. De rest van de homepage bewijst dat er "iets gebeurt" met echte data.
2. **Feiten zien eruit als feiten.** Data in monospace, tabellen als op een terminal, bonnetjes met stempels. Mening (redactioneel) is visueel herkenbaar als mening.
3. **Rustig, niet leeg.** Veel witruimte, strakke typografie, één accentkleur. Geen neonverlopen, geen glow, geen robotjes.
4. **Uitleg op aanvraag.** Status en versheid tonen we als klein symbool; bron, bronzin en historie openen in een lade. De gebruiker wordt niet overspoeld.
5. **Elke pagina heeft een volgende stap** (vergelijken, opslaan, delen, Doctor, bezoeken).
6. **Snelheid is een feature.** Server-rendered, weinig JS, motion alleen als betekenis.

## 2. Design tokens

### Kleur

| Token | Licht | Donker | Gebruik |
|---|---|---|---|
| `--paper` | `#F7F5F0` | `#0F0F10` | Achtergrond ("papier") |
| `--paper-2` | `#EFECE4` | `#17171A` | Verzonken vlakken, tabelkoppen |
| `--card` | `#FFFFFF` | `#1B1B1F` | Kaarten, bonnetjes |
| `--ink` | `#121212` | `#F2EFE8` | Primaire tekst, primaire knop |
| `--ink-2` | `#3D3D3A` | `#C9C5BC` | Secundaire tekst |
| `--ink-3` | `#66655F` | `#8D8A83` | Meta, tijdstempels |
| `--line` | `#DEDAD0` | `#2E2E33` | Randen, perforatie |
| `--signal` | `#D9401F` | `#FF6A4D` | Accent: focus, wijzer, ticker, highlights |
| `--verified` | `#1E7F4F` | `#4CC38A` | Stempel GECONTROLEERD |
| `--supported` | `#2456C8` | `#7AA2FF` | Stempel ONDERSTEUND |
| `--community` | `#9A5B00` | `#E8A64A` | Stempel COMMUNITY |
| `--unverified` | `#66655F` | `#9A978F` | Stempel ONBEVESTIGD |
| `--danger` | `#B3261E` | `#FF8A80` | Stopgezet, fout |

Contrasteis: tekst ≥ 4,5:1 en UI-elementen ≥ 3:1 (WCAG 2.2 AA), gecontroleerd in de a11y-tests. De primaire knop is inkt op papier (hoogste contrast). Signaalkleur dient als accent, niet als tekstkleur op wit.

### Typografie

- **Grotesk (koppen en UI):** *Schibsted Grotesk* (variabel). Redactioneel, krachtig, onderscheidend ten opzichte van Inter/Geist.
- **Mono (data, bonnetjes, tijdstempels):** *IBM Plex Mono*, voor een "terminal"-gevoel.
- Zelf gehost via npm (geen verzoeken naar Google, AVG-vriendelijk), met `font-display: swap` en metric-fallback.
- **Schaal:** 12 · 13 · 14 · 16 (body) · 18 · 20 · 24 · 30 · 38 · 48 · clamp(40px, 6vw, 72px) voor de heroregel.
- `font-variant-numeric: tabular-nums` voor alle bedragen.

### Ruimte, vorm en motion

- 4px-grid; secties 64–96px verticaal (desktop) en 40–56px (mobiel).
- Radius: 6 (klein), 10 (kaart), 999 (chips). Bonnetjes: 2px, met een geperforeerde rand (CSS radial-gradient).
- Schaduw: bijna geen; 1px-randen. Alleen zwevende elementen (commandobalk) krijgen een zachte schaduw.
- **Motion:** 120–200 ms ease-out. Het bonnetje "print" (400 ms clip-reveal) en de ticker scrollt pauzeerbaar. Alles valt uit bij `prefers-reduced-motion`.

## 3. Kerncomponenten

| Component | Beschrijving |
|---|---|
| `MatchInput` | Groot invoerveld, placeholder wisselt tussen echte voorbeeldtaken, ⏎ = verzenden, voorbeeldchips eronder |
| `ClarifyQuestion` | Eén vraag, 2–4 chipantwoorden + "sla over". `aria-live` |
| `IntentSummary` | "Begrepen: …" + bewerkbare eis-chips (budget, niveau, EU, taal, platform) + engine-label ("taalmodel" / "trefwoordanalyse") |
| `StackReceipt` | Het bonnetje: kop (taak, datum, nr.), regels per stap (stap · tool · plan · €/mnd · stempel), totaal (per valuta en ≈ EUR), voet ("Bonnetje bewaren", delen). Dit is ook de OG-deelkaart |
| `StatusStamp` | Stempel met status en tooltip ("Bevestigd op officiële bron, 29-09-2026") |
| `FreshnessDial` | Mini-klok (SVG): de wijzer staat op de leeftijd (vers = groen segment), met een label voor schermlezers |
| `ReceiptDrawer` | Lade met bronnen per feit: type, URL, datum, bronzin, historie |
| `ToolRow` | Compacte rij (geen kaartenmuur): monogram, naam, tagline, instapprijs, gratis-badge, stempel, dial, vergelijk-vinkje |
| `ToolMonogram` | Letterlogo met een kleur afgeleid van de naam (geen hotlinking van logo's, geen merkmisbruik) |
| `PlanTable` | Plannen met prijs per maand en jaar, quota, stempel per regel |
| `PriceHistory` | Stappengrafiek (SVG) + tabel |
| `CompareMatrix` | Criteria × tools; per cel waarde + stempel; verschillen gemarkeerd |
| `VerdictList` | "Kies X als… / Kies Y als…" |
| `PulseTicker` | Ticker met echte events (type-icoon, tool, kop), pauzeknop |
| `PulseFeed` | Chronologische lijst per dag, filter op type |
| `DisclosureNote` | Automatisch zichtbaar bij affiliatelinks |
| `SponsoredSlot` | Afwijkende stijl, label "Gesponsord", link naar het beleid |
| `StaleBanner` | "⚠️ Informatie mogelijk verouderd" + laatste controledatum |
| `EmptyState` | Een eerlijke lege staat met humor en een volgende stap (nooit "coming soon") |
| `VideoFacade` | Thumbnail + afspeelknop; YouTube (nocookie) laadt pas na een klik |

## 4. Wireframes

### 4.1 Home (desktop)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ◴ AIToolsWijzer   Match  Verkennen  Vergelijken  Doctor  Pulse   NL▾  ⌘K │
├──────────────────────────────────────────────────────────────────────────┤
│ ▸ PULSE  💰 Tool A −20% · 🚀 Tool B nieuw gratis plan · 🔥 Tool C v3 …  ⏸ │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Wat wil je doen?                                                       │
│   ┌──────────────────────────────────────────────────────────────┐       │
│   │ Ik wil van lange video's automatisch TikToks maken…          │  ⏎    │
│   └──────────────────────────────────────────────────────────────┘       │
│   [Video's voor social] [Website zonder code] [Vergaderingen notuleren]  │
│   AI-tools, met bonnetje. 132 tools · 1.204 feiten · 97% bevestigd ≤30d  │ ← echte tellingen
│                                                                          │
├───────────────────────────────┬──────────────────────────────────────────┤
│ NET VERANDERD                 │ GOEDKOPER GEWORDEN                        │
│ · Tool A — prijs +25%   ◷ 2d  │ · Tool D — Pro $30 → $24   [bonnetje]    │
│ · Tool B — gratis plan  ◷ 4d  │                                          │
├───────────────────────────────┴──────────────────────────────────────────┤
│ FAIR FIGHTS   Claude vs ChatGPT · Runway vs Kling · Framer vs Webflow    │
├──────────────────────────────────────────────────────────────────────────┤
│ POPULAIRE TAKEN (grid van 6–8 taken met stappen-icoontjes)               │
└──────────────────────────────────────────────────────────────────────────┘
```
Secties zonder data worden **niet** gerenderd.

### 4.2 Match-resultaat

```
Begrepen: "Professionele social-media-video's maken"          [taalmodel]
Eisen: [Budget: < €50/mnd ✎] [Niveau: beginner ✎] [EU: geen eis ✎] [+]
┌ Verduidelijking ────────────────────────────────────────────────┐
│ Wil je zelf in beeld, met een AI-avatar, of alleen beelden?     │
│ [Zelf in beeld] [AI-avatar] [Alleen beelden/stock] [Sla over]   │
└─────────────────────────────────────────────────────────────────┘
Varianten: (●) Aanbevolen  ( ) Goedkoopst  ( ) Minste tools

╔═ STACK-BONNETJE ═══════════════════════ #A7F3 · 29-09-2026 ═╗
║ 1 Script      Claude        Pro      $20/mnd   [GECONTR.] ◴ ║
║ 2 Voice-over  ElevenLabs    Starter  $6/mnd    [ONDERST.] ◴ ║
║ 3 Video       CapCut        Free     $0        [ONDERST.] ◴ ║
║ 4 Ondertitels (in CapCut)                                   ║
║ 5 Plannen     Buffer        Free     $0        [ONDERST.] ◴ ║
║ ─────────────────────────────────────────────────────────── ║
║ TOTAAL                     $26/mnd  (≈ €23, ECB 29-09)      ║
║ Gratis starten mogelijk: ja (met limieten, zie bonnetjes)   ║
╚══ [Bewaren] [Delen] [Vergelijk stap] [Houd in de gaten] ════╝
Per stap: waarom deze tool · alternatieven (2–3) · beperkingen · video's
Bronnen (lade) · Disclosure (als er affiliatelinks zijn)
```

### 4.3 Toolpagina

```
[Monogram] ElevenLabs                              [Bezoek site ↗] [+ Stack]
Tekst-naar-spraak en voice cloning        GECONTROLEERD ◴ vers · 29-09-2026
Beste voor: … · Niet voor: …
DNA: [TTS ●][Voice cloning ●][Dubbing ○] · Web · API · iOS · model: eigen
┌ Prijzen ───────────────┐ ┌ EU-lens ────────────────┐ ┌ Vitals ──────────┐
│ Free $0 · Starter $6   │ │ EU-opslag: onbekend     │ │ Site: bereikbaar │
│ Creator $22 · …        │ │ DPA: ja [bron]          │ │ Laatst gewijzigd │
│ [Alle plannen + historie]│ NL-taal: ja [bron]      │ │ Prijs stabiel 90d│
└────────────────────────┘ └─────────────────────────┘ └──────────────────┘
Tijdlijn (wijzigingen) · Alternatieven (3) · Fair Fights · Video's · Bronnen
```

### 4.4 Mobiel (Home)

```
┌─────────────────────┐
│ ◴ AIToolsWijzer  ☰ │
│ ▸ 💰 Tool A −20% …  │
│ Wat wil je doen?    │
│ ┌─────────────────┐ │
│ │ Ik wil…       ⏎ │ │
│ └─────────────────┘ │
│ [Video] [Website]   │
│ [Notuleren] [+]     │
│ NET VERANDERD       │
│ · …                 │
└─────────────────────┘
```
Resultaten worden op mobiel één kolom; de bonnetjesregels vouwen naar twee regels (stap + tool / plan + prijs + stempel).

### 4.5 Admin: Overview en AI Operations

```
KPI's: Bezoekers 30d · Matches · Outbound kliks · Omzet MTD (€/€500) · Queue · Fouten
┌ AI OPERATIONS ──────────────────────────────────────────────┐
│ Discovery        ✓  03:00  12 kandidaten                    │
│ Pricing          ✓  03:10  118 gecontroleerd · 1 gewijzigd  │
│ Change Detection ⚠  06:00  2 bronnen onbereikbaar           │
│ Broken Links     3  kapotte links                           │
│ Needs Review     7                                          │
└─────────────────────────────────────────────────────────────┘
Vannacht: 118 bevestigd · 1 auto (gemarkeerd) · 2 queue · 3 links …  [details]
```

## 5. Interactieflow (Search → Save → Share)

```
Invoer → (lexicale en/of LLM-intentie) → [verduidelijking? max 1 vraag per ronde, max 2 rondes]
      → stack-bonnetje + varianten → vergelijken (stap of tools) → bezoeken (/go)
      → bewaren (stack-link + privé-bewerklink) → delen (Web Share / kopieer / OG-kaart)
      → Houd in de gaten (e-mail, double opt-in)
```
- De URL weerspiegelt de staat (`?q=&budget=&level=&eu=&variant=`), zodat terug, delen en refresh werken.
- Een fout of timeout van het LLM valt stil terug op de lexicale engine; het label toont welke engine werd gebruikt.

## 6. Microcopy (toon: direct, droog, behulpzaam, "je")

| Situatie | NL | EN |
|---|---|---|
| Hero | Wat wil je doen? | What are you trying to do? |
| Merkregel | AI-tools, met bonnetje. | AI tools, with receipts. |
| Laden | Bonnetjes aan het natellen… | Checking the receipts… |
| Geen resultaat | Daar hebben we (nog) geen bonnetje voor. Probeer het anders te zeggen, of kies een taak. | We don't have a receipt for that (yet). Try rephrasing, or pick a task. |
| Verouderd | ⚠️ Informatie mogelijk verouderd. Laatst gecontroleerd op {date}. | ⚠️ Information may be outdated. Last checked {date}. |
| Onbevestigd | Nog niet bevestigd op de officiële site. | Not yet confirmed on the official site. |
| 404 | Deze pagina heeft geen bonnetje. | This page has no receipt. |
| Disclosure | Sommige links zijn affiliatelinks. We kunnen commissie ontvangen. Dat verandert de volgorde niet. | Some links are affiliate links. We may earn a commission. It never changes the order. |
| Roast (Doctor) | Drie tools die allemaal tekst schrijven. Je stack heeft een identiteitscrisis. | Three tools that all write text. Your stack is having an identity crisis. |

## 7. Toegankelijkheid (WCAG 2.2 AA)

- Een skiplink, landmarks (`header`, `nav`, `main`, `footer`) en één `h1` per pagina.
- Zichtbare focus (2px `--signal` outline + offset). Alles is met het toetsenbord bedienbaar (chips, vergelijk-vinkjes, lade, ⌘K).
- `aria-live="polite"` voor verduidelijking en resultaten. Stempels en dial hebben een tekstlabel.
- `lang` per locale en formulieren met labels en foutteksten.
- Geen informatie alleen via kleur: stempels hebben tekst en de dial een label.
- Reduced motion wordt gerespecteerd; de ticker is pauzeerbaar en stopt standaard bij reduced motion.

## 8. Performancebudget

| Metriek | Budget (p75, mobiel) |
|---|---|
| LCP | ≤ 2,5 s |
| INP | ≤ 200 ms |
| CLS | ≤ 0,1 |
| JS per publieke route | ≤ 120 kB gzip |
| Fonts | 2 families, latin-subset, de display-font preloaded |
| Derde partijen | Geen scripts. YouTube pas na een klik (facade) |

## 9. Responsiveness

Breakpoints: 640 / 768 / 1024 / 1280. Mobile-first. De side gutter is 16px op mobiel. Tabellen scrollen horizontaal in hun eigen container (nooit de pagina). De CompareMatrix wordt op mobiel een kaartweergave per criterium.
