# 05 — Informatiearchitectuur

## 1. Principes

1. **Eén vraag bovenaan:** "Wat wil je doen?" Elke pagina kan terugvallen op Match.
2. **Entiteiten zijn de ruggengraat:** taak, capability, tool, plan, feit, wijziging en stack. Pagina's zijn *weergaven* van entiteiten, geen losse artikelen.
3. **Geen doodlopende paden:** elke pagina linkt naar de volgende beslisstap (vergelijken, alternatieven, opslaan, Doctor).
4. **Indexeerbaar = verdiend.** Een pagina komt pas in de zoekindex als ze genoeg echte data heeft (§5).
5. **Locale-first URL's:** `/{locale}/…`. De UI-strings komen uit berichtenbestanden en de content uit vertaaltabellen.

## 2. Sitemap (publiek, per locale)

```
/{locale}                                  Home: Match-invoer, Pulse-ticker, secties met echte data
├── /match?q=…&budget=…&eu=1&level=…       Match-resultaat (stack-bonnetje), noindex
├── /tasks                                 Taakcatalogus ("Wat kun je met AI?")
│   └── /tasks/{task-slug}                 Taak + workflow + aanbevolen stack        [index: gate]
├── /categories                            Categorieën (Tekst, Beeld, Video, Audio, …)
│   └── /categories/{category-slug}        Categorie → capabilities → tools          [index]
├── /capabilities/{capability-slug}        "AI-tools voor voice-over" (gerangschikt)  [index: gate]
├── /tools                                 Verkenner (zoeken, filters, tabelweergave)   [index: basis; filtercombinaties noindex]
│   └── /tools/{tool-slug}                 Toolpagina                                 [index: gate]
│       ├── /pricing                       Plannen, prijsgeschiedenis, kleine lettertjes [index: gate]
│       └── /alternatives                  Alternatieven met overlap en verschillen      [index: gate]
├── /compare?tools=a,b,c                   Eigen vergelijking (2–4 tools), noindex
│   └── /compare/{a}-vs-{b}                Fair Fight-pagina                          [index: gate]
├── /doctor                                Stack Doctor (invoer + diagnose), noindex voor resultaten
├── /stack/{public-id}                     Gedeelde stack (bonnetje), noindex
├── /my-stack                              Mijn opgeslagen stacks (cookie), noindex
├── /pulse                                 AI Pulse-feed (filters per type)           [index]
├── /methodology                           Ranking, statussen, confidence, versheid   [index]
├── /disclosure                            Affiliate- en sponsorbeleid                [index]
├── /corrections                           Correctie melden + correctielog            [index]
├── /newsletter                            Aanmelden, bevestigen                      [index: alleen landingspagina]
├── /about                                 Over, redactie, contact                    [index]
└── /privacy                               Privacy- en cookieverklaring               [index]

Niet gelokaliseerd:
/go/{tool-slug}?src=…                      Outbound redirect + kliktracking (robots: disallow)
/api/*                                     API (robots: disallow)
/api/v1/*                                  Publieke read-only data-API (JSON)
/llms.txt                                  Samenvatting voor LLM-crawlers
/sitemap.xml, /robots.txt
/admin/*                                   Beheer (auth, noindex, Engelstalige interne UI)
```

## 3. Navigatie

**Header (sticky, compact):**
Logo · **Match** (home) · Verkennen (tools) · Vergelijken · Doctor · Pulse · [taalwissel] · [zoekveld/command bar ⌘K]

**Mobiel:** logo + zoekicoon + menu. Match-invoer bovenaan de home. Onderaan is een vaste "Wat wil je doen?"-knop zichtbaar op tool-, taak- en vergelijkingspagina's.

**Footer:** Methodologie · Disclosure · Correcties · Privacy · Over · Nieuwsbrief · Data-API · taalkeuze.

**Breadcrumbs** op alle entiteitpagina's (ook als `BreadcrumbList` in JSON-LD).

## 4. Paginatypes: doel, inhoud en volgende stap

| Paginatype | Doel (JTBD) | Kerninhoud | Volgende stap |
|---|---|---|---|
| Home | Snel naar een antwoord | Match-invoer met voorbeeldtaken, ticker, "Net veranderd", "Nieuw", "Goedkoper geworden", Fair Fights (alleen als er data is) | Match |
| Match-resultaat | Een stack kiezen | Begrepen doel + eisen (bewerkbaar), eventueel een verduidelijkende vraag, stack-bonnetje (stappen → tool, kosten, status), varianten (aanbevolen / budget / alles-in-één), per stap alternatieven, beperkingen, bronnen, video's, disclosure | Vergelijken, opslaan, delen, Watch, doorklikken |
| Taakpagina | "AI-tools voor X" begrijpen | Workflow (stappen), aanbevolen stack, tools per stap, veelgestelde vragen gebaseerd op data, gerelateerde taken | Match met voorgevulde taak |
| Capabilitypagina | "Beste AI voor voice-over" | Gerangschikte tools met prijs, gratis plan, status en versheid; "zo rangschikken we" | Tool, vergelijken |
| Toolpagina | Is dit iets voor mij? | Samenvatting, beste voor / niet voor, DNA-strip (capabilities, platforms, modellen, integraties), prijzen (kort), EU-lens, Vitals (versheid, bereikbaarheid, laatste wijziging), wijzigingstijdlijn, alternatieven, video's, bronnen | Bezoeken (/go), vergelijken, toevoegen aan stack |
| Prijspagina | Wat kost het echt? | Plantabel met status per regel, jaar vs maand, kleine lettertjes, prijsgeschiedenis, valuta en btw-noot | Vergelijken op prijs, Watch |
| Alternatievenpagina | Iets anders dan X | Alternatieven gerangschikt op overlap en eisen, met "waarom wel / waarom niet" | Vergelijken |
| Fair Fight | X of Y? | Criteria-matrix met bonnetjes, uitkomst per criterium, "Kies X als… / Kies Y als…", geen totaalwinnaar | Match, beide tools |
| Doctor | Mijn stack verbeteren | Invoer (tools + wat zit je dwars), diagnose (overlap, gaten, risico's, kosten), recept | Stack opslaan, Watch, lead (B2B) |
| Stack (gedeeld) | Bonnetje delen of bewaren | Stack, totaalkosten, Stack Diff sinds opslaan, Watch-opt-in | Doctor, aanpassen |
| Pulse | Wat is er veranderd? | Chronologische feed van gedetecteerde events met bron en type | Tool, alert |
| Methodologie | Kan ik dit vertrouwen? | Rankingparameters, statussen, confidence, versheid, agents, correctieproces | Correcties |

## 5. Indexeerbaarheidspoorten (anti-scaled-content)

Het Quality/SEO-proces berekent per pagina een `indexable`-vlag en de sitemap bevat alleen indexeerbare pagina's.

| Paginatype | Poort (alle voorwaarden) |
|---|---|
| Toolpagina | Gepubliceerd; beschrijving in deze locale; ≥ 1 primaire capability; ≥ 1 prijsfeit met status ≥ SUPPORTED **of** expliciet "prijs niet openbaar" met bron; website laatst bereikbaar |
| Prijspagina | ≥ 2 plannen of ≥ 1 plan + historie; alle plannen status ≥ SUPPORTED |
| Alternatievenpagina | ≥ 3 alternatieven met gedeelde primaire capability en prijsdata |
| Fair Fight | Beide tools delen ≥ 1 primaire capability; beide hebben prijsdata ≥ SUPPORTED; ≥ 4 onderscheidende criteria; paar staat in de lijst van betekenisvolle paren (samen overwogen in Match-data of door de redactie gemarkeerd) |
| Capabilitypagina | ≥ 4 gepubliceerde tools met deze capability als primair |
| Taakpagina | Alle verplichte stappen hebben ≥ 2 kandidaat-tools |
| Filtercombinaties in /tools | Altijd `noindex, follow` + canonical naar /tools |

## 6. Interne links

- Tool ↔ capability ↔ taak (graph-links) zijn altijd aanwezig.
- Toolpagina → top-3 alternatieven + max 3 Fair Fights (alleen indexeerbare).
- Taakpagina → tools per stap + gerelateerde taken (via gedeelde capabilities).
- Pulse-events → tool en prijs-/wijzigingspagina.
- Geen footer-linkfarms en geen tagclouds.

## 7. Locales

- `nl` (standaard) en `en` zijn live. `de` en `fr` zijn geconfigureerd maar staan uit tot hun vertaaldekking boven de drempel komt (zie document 11).
- `/` detecteert de taal (Accept-Language) en stuurt door naar `/{locale}`, met `nl` als fallback.
- hreflang-alternates per pagina, alleen voor locales waarin de pagina indexeerbaar is. `x-default` wijst naar `/en/…`.
- Slugs van tools zijn in alle talen gelijk (merknamen). Taak-, categorie- en capability-slugs zijn per locale vertaald, en hreflang koppelt ze via het entiteit-ID.
- Route-segmenten (`tools`, `tasks`, …) zijn Engels in alle locales (bewuste vereenvoudiging, zie NOT NOW).

## 8. Datakoppeling per weergave

```
Taak ──< Stap >── Capability ──< ToolCapability >── Tool ──< Plan (met historie)
                                                     │ ──< Feit (bron, status, bronzin, historie)
                                                     │ ──< Wijzigingsevent (Pulse)
                                                     │ ──< Video
                                                     │ ──< Relatie (alternatief, integreert, draait-op-model)
                                                     └ ──< Affiliatelink (alleen /go, nooit ranking)
```
