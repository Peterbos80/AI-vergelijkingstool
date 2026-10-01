# 13 · Marktonderzoek, design-audit en backlog (oktober 2026)

De eigenaar vroeg om "volledig onderzoek van de website; visueel en qua features vergelijken met de markt; marktonderzoek naar wat mensen willen die met AI willen werken; novelty en unieke vergelijkingen zijn key; het visuele aspect doet niet mee met top tier; maak een volledige backlog met specifieke agents die samenwerken, maak de prompts en voer het uit."

Dit document bundelt de uitkomst. De volledige rapporten, met bronnen, staan in `research-2026-10/`; de opdrachten per agent in `agents/`.

## 1. Wat het onderzoek liet zien

**Markt** (`research-2026-10/01-markt.md`, 83 bronnen)
- **Vier blokken:**
  - grote directories die betaalde plaatsing verkopen (TAAFT, Toolify, Futurepedia, TopAI);
  - B2B-reviews (G2 met Capterra);
  - modeldata voor ontwikkelaars (Artificial Analysis, Arena, OpenRouter, Epoch);
  - een nieuwe "bonnetjes"-niche met prijzen plus bron (CostBench, ComparEdge, AI SaaS Showdown). Die is overal Engelstalig.
- **Nederland heeft geen echte AI-toolvergelijker.** RankmyAI rangschikt op populariteit; Umely heeft ±100 tools.
- **Wat ons onderscheidt is de combinatie**, niet "met bron" alleen: Nederlandstalig, van taak naar stack, status per feit, prijsgeschiedenis, EU-lens, Stack Doctor en een getoetste regel dat geld de volgorde niet verandert.
- **Gaten:** logo's, grafieken, kostencalculators, vergelijken met meer dan 2 tools, alerts, en data over privacy en Nederlands.

**Gebruikers** (`research-2026-10/02-gebruikers.md`, 46 bronnen)
- **AI is mainstream maar ondiep**: 61% heeft GenAI gebruikt (Deloitte 2026).
- **Bijna niemand betaalt**: 13% van de Nederlandse ChatGPT-gebruikers.
- **De grootste drempel is kennis**: 74,6% van de bedrijven die AI overwogen mist ervaring (CBS 2025).
- **Privacy speelt sterk**: "traint het op mijn data?"; de AP meldt meer datalekken via chatbots.
- **De AI-verordening is bij de helft van de ondernemers onbekend**, terwijl art. 4 (AI-geletterdheid) verplicht blijft.
- **Directories frustreren** door de massa, affiliate-gedreven lijsten en tools die niemand getest heeft.
- **De grootste kans:** veilig en gratis beginnen, per taak en per doelgroep.

**Design** (`research-2026-10/03-design-audit.md`)
- **Het concept is top tier ("AI-tools, met bonnetje"), de uitvoering niet:**
  - emoji als iconen;
  - drie accentkleuren met glow;
  - luide statusstempels in elke cel;
  - vlakke hiërarchie;
  - bijna geen datavisualisatie;
  - een zwakke toolidentiteit.
- **Bugs:**
  - de header maakt de pagina horizontaal scrollbaar tussen 768 en ~1300 px;
  - bedragen worden verkeerd gezet ("18 ,33");
  - randen van invoervelden halen geen 3:1;
  - een prijsdaling wordt rood getoond.

**Data** (`research-2026-10/04-data.md`)
- De velden voor privacy en Nederlands waren bijna leeg.
- **Eerste ronde:** 6 feiten met bron voor ChatGPT en Claude. Beide trainen standaard op chats van consumentenabonnementen; uitzetten kan.
- **De rest staat stil:** het zoekbudget van de sessie (200) is op.

## 2. Positionering
**"De Nederlandse AI-wijzer: van je taak naar de juiste tools, met een bonnetje bij elk getal, en geld beslist nooit de volgorde."**
- **Signatuur:** het bonnetje als visueel object.
- **Novelty:** vergelijkingen die rekenen met jouw gebruik en eerlijk zijn over gratis plannen en privacy.

**Kleur:** de eigenaar koos expliciet het donkere luxe-palet (`#0A0A0C`/`#15151F`, cyaan voor interactie, smaragd voor succes, oranje/karmijn voor live). Dat blijft. Van de audit nemen we over: kleur alleen waar ze iets betekent, geen glow, en statuskleuren en prijsrichting als eigen tokens. Het alternatieve "papier & inkt met wijzerrood"-voorstel ligt klaar als de eigenaar dat later wil.

## 3. Het agentteam en hoe het samenwerkt

| Agent | Vlak | Levert | Opdracht |
|---|---|---|---|
| R1 Marktanalist | Concurrenten, features, visuele benchmark | `01-markt.md` | (afgerond) |
| R2 Gebruikersonderzoeker | Behoeften, drempels, keuzecriteria (NL) | `02-gebruikers.md` | (afgerond) |
| R3 Design-auditor | Diagnose en design-systeemspec | `03-design-audit.md` | (afgerond) |
| R4/B4 Data-onderzoeker | Feiten met bron: privacy, EU, Nederlands | feiten in `data/tools` | `agents/B4-data.md` |
| B1 Design-systeembouwer | Visuele basis: header, tokens, iconen, chips, logo's | code | `agents/B1-design-systeem.md` |
| B2 Vergelijkingsbouwer | Unieke vergelijkingen met echte data | code | `agents/B2-vergelijkingen.md` |
| B3 Content-redacteur | Doelgroepen, prompts, AI-geletterdheid | content | `agents/B3-content.md` |
| Q1 QA/integratie (productlead) | Samenvoegen, review, testen, deploy, rapport | release | `agents/Q1-qa.md` |
| D1 Design Director | Visuele kwaliteit, interactie, UX: werelden, podium, toolmerken | code + `research-2026-10/05-design-director.md` | (brief van de eigenaar, 1 okt) |
| B5 Eenvoud-redacteur | Alle teksten en menu's begrijpelijk voor een 14-jarige; bewaker in de tests | teksten + `research-2026-10/06-taal-en-eenvoud.md` | `agents/B5-eenvoud.md` |
| B6 Tool-scout | Elk uur populaire nieuwe AI-tools zoeken, dagelijks publiceren via quarantaine, logo's op domein | code | `agents/B6-tool-scout.md` |

**Samenwerking:**
1. Teambriefing.
2. Onderzoek, parallel (R1–R4).
3. Backlog, door de productlead.
4. Bouwen in eigen git-worktrees, parallel (B1 + B2). Elke agent heeft eigen bestanden, en gedeelde bestanden alleen met afspraken.
5. Q1 voegt samen, reviewt en test.
6. Deploy.
7. Meten: Search Console en de agentlogboeken.
8. Volgende golf.

De onderzoekers leveren bronnen aan, de bouwers gebruiken alleen data met bron, en Q1 bewaakt de spelregels.

## 4. Backlog

Prioriteit P1 = nu, P2 = volgende golf, P3 = daarna. Impact en effort: H/M/L.

### E1 Visuele basis (B1) · golf 1
| # | Item | Impact | Effort | Acceptatie |
|---|---|---|---|---|
| 1.1 | Header-overflow repareren, max 5 navigatie-items, schermvullend mobiel menu | H | M | Geen horizontale scroll op 9 breedtes (320–1440 px) |
| 1.2 | Tokens: glow weg, `line-strong`, status- en prijsrichtingtokens, bonnetje-tokens, typeschaal, 4 radii | H | M | Tekst ≥4,5:1, controls ≥3:1, beide thema's; axe groen |
| 1.3 | Emoji → SVG-iconenset (`ui/Icon.tsx`) | H | S | 0 emoji in de publieke site |
| 1.4 | Ticker weg; Pulse-teller in de navigatie | M | S | Geen marquee |
| 1.5 | Prijzen in mono, geen tabular-nums op Schibsted, ≈€ met ECB-datum | H | S | Nergens "18 ,33" |
| 1.6 | Bonnetje-chip in tabellen, label "Onderbouwd", geen afkortingen | H | M | Elke chip heeft een toegankelijke naam en opent de bronnen |
| 1.7 | Monogram 2.0 en echte logo's (simple-icons, CC0, zelf gehost) voor ±35 tools | M | S | Geen hotlinks; contrast ≥3:1 |
| 1.8 | Kwaliteitspoorten: overflowtest, contrasttest, nieuwe baselines | M | S | CI faalt bij een regressie |

### E2 Signatuur en beslisschermen (B1) · golf 2
| # | Item | Impact | Effort |
|---|---|---|---|
| 2.1 | Bonnetje 2.0 (zigzag, thermopapier, licht eiland in dark, print-CSS) | H | M |
| 2.2 | Home-hero met een echt voorbeeldbonnetje van de engine, en een bonvoet met cijfers | H | M |
| 2.3 | Toolpagina: kerncijfers-strook, aside als bonnetje-samenvatting, sticky CTA op mobiel | H | M |
| 2.4 | Prijstrap en plankaarten; Time Machine herbouwen (een daling is niet rood) | H | M |
| 2.5 | Vergelijken: 2–4 tools, "alleen verschillen" zonder JS, prijsbereik-grafiek, mobiel zonder scroll | H | L |
| 2.6 | Verkennen: resultaten eerst, filters in een dialoog, vergelijk-tray | H | M |
| 2.7 | Pulse oud→nieuw met delta; Start en Doctor met iconen; lege staten niet tonen; footer als bonvoet | M | M |

### E3 Unieke vergelijkingen (B2) · golf 1
| # | Item | Impact | Effort |
|---|---|---|---|
| 3.1 | Limietparser plus gebruiksmeters (transcriptie, voice-over, avatarvideo, audio opschonen, nasynchroniseren) | H | M |
| 3.2 | **"Wat kost het voor mij?"**: calculator op taakpagina's en de hub `/costs`, met prijs per uitkomst (€/uur) | H | M |
| 3.3 | Teamkosten: N gebruikers × plan, maand tegenover jaar | M | S |
| 3.4 | **"Wat krijg je echt gratis?"** per taak: limiet, watermerk, commercieel gebruik | H | S |
| 3.5 | **Europees alternatief** per niet-Europese tool, met overlap en prijs | M | S |
| 3.6 | Berekende labels in plaats van winnaars: "Goedkoopst voor jouw gebruik", "Echt bruikbaar gratis", "Europees bedrijf" | M | S |

### E4 Privacy- en Nederlands-kompas (B4 data → B2 UI) · golf 2
| # | Item | Impact | Effort | Afhankelijk van |
|---|---|---|---|---|
| 4.1 | Feiten met bron voor de top 50 (Nederlands, EU-data, verwerkersovereenkomst, traint op data) | H | M | Hoger zoekbudget (eigenaar) |
| 4.2 | Kompasweergave: vergelijken per tool en per plan | H | M | 4.1 |
| 4.3 | Check "Mag ik dit invoeren?" (soort gegevens × tool × plan) | H | M | 4.1 |
| 4.4 | Krimpflatiemonitor: minder voor hetzelfde geld, met een nieuw event-type `quota_change` | M | M | — |

### E5 Doelgroepen en leren (B3) · golf 2
| # | Item | Impact | Effort |
|---|---|---|---|
| 5.1 | "Ik ben…"-pagina's (zzp, mkb, onderwijs, studenten, marketing, developers, beginners) op basis van de bestaande `audience`-tags | H | M |
| 5.2 | Nederlandse prompts per taak (top 15) | H | M |
| 5.3 | Starterkit AI-geletterdheid (art. 4) en AI-register-export uit de Stack Doctor | H | M |
| 5.4 | Leerpad met afvinken; onderwijs-hub met minimumleeftijd | M | M |

### E6 Vertrouwen en vindbaarheid · golf 2–3
| # | Item | Impact | Effort |
|---|---|---|---|
| 6.1 | Zichtbaar keurmerk "Geld verandert de volgorde niet, afgedwongen met een test" | M | S |
| 6.2 | Betrouwbaarheidsmeter per tool (% onderbouwd, officiële bronnen, leeftijd) | M | S |
| 6.3 | schema.org `SoftwareApplication` + `Offer` met prijs en datum (gevonden worden door AI-assistenten) | M | S |
| 6.4 | Blok "Onafhankelijke tests" (links naar Consumentenbond, Which?, Stiftung Warentest; geen scores overnemen) | M | S |
| 6.5 | AI-prijsindex NL (pas na ≥3 maanden meten) | M | M |

### E7 Acties voor de eigenaar
- **Zoekbudget verhogen** (`CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION`) voor de data-onderzoeker. Dit is nodig voor E4.
- **YouTube-sleutel** toevoegen (checklist stap 5.1) en de **externe wekker** instellen (stap 5.3). GitHub startte de uurplanning in 9 uur maar één keer.

## 5. Status
- Golf 1 is gestart op 1 oktober 2026 (B1 en B2 parallel).
- De uitkomst staat in de commitgeschiedenis en in het rapport aan de eigenaar.
