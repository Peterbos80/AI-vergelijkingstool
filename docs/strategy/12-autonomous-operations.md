# 12 — Autonome operatie: kritische toets en ontwerp

> **Opdracht:** AIToolsWijzer moet een bijna-onderhoudsvrij, autonoom commercieel product worden, met de eigenaar als *exception handler* en niet als operator. Eerst wordt de opdracht kritisch getoetst (§1–§3), daarna volgt het ontwerp (§4–§13).

## 0. De kern

1. **Het operationele werk kan vandaag grotendeels autonoom.** Denk aan monitoren, verifiëren, prijzen, links, versheid, tests, fouten en rapportage. Aan API-kosten gaat het om enkele dollars per maand (§11).
2. **Het commerciële werk kan níet volledig autonoom.** Affiliate-aanmeldingen, contracten, sponsordeals, uitbetalingen, btw en juridische reacties vereisen een rechtspersoon, een identiteit of een handtekening. Het systeem maakt van dit werk wel korte, goed voorbereide beslissingen met de verwachte opbrengst erbij.
3. **De grootste risico's van autonomie zijn niet technisch:**
   - stil verkeerde data (één parserfout raakt honderd tools tegelijk);
   - alarmmoeheid (te veel escalaties, dus de eigenaar leest niets meer);
   - een SEO-straf voor massaal gegenereerde content;
   - optimaliseren op ruis zolang er weinig verkeer is.
4. **Daarom is autonomie hier een verdiende status per risicoklasse**, met vaste patronen:
   - degradeer naar transparantie in plaats van naar stilte;
   - bevestiging door herhaling;
   - quarantainepublicatie;
   - een anomaliewacht die automatisch bevriest;
   - elke actie omkeerbaar;
   - een escalatiebudget;
   - een veilige standaardactie bij elke escalatie.
5. **Realistische eigenaarstijd (schatting):**
   - eenmalig 1–2 dagen inrichten;
   - daarna 1–2 uur per week in de eerste drie maanden, dalend naar 30–60 minuten per week;
   - boekhouding en salesgesprekken tellen hierin niet mee.
   
   "Nul" is het niet, en dat beloven zou oneerlijk zijn.

---

## 1. Kritische toets: waar de opdracht botst met de werkelijkheid

Elk punt volgt hetzelfde patroon: **de opdracht zegt** → **de werkelijkheid is** → **dus ontwerpen we**.

**C1. "Near-zero maintenance" versus de onvervreemdbare plichten van een ondernemer**
- Een ondernemer heeft plichten die niet te automatiseren zijn:
  - KvK-registratie;
  - btw-aangifte en de bewaarplicht van de administratie;
  - AVG-verzoeken van betrokkenen;
  - juridische klachten (merkenrecht, onjuiste informatie);
  - contracten met affiliatenetwerken, soms met belastingformulieren voor buitenlandse programma's;
  - betalingen aan hosting- en API-leveranciers.
- Die taken verdwijnen niet door software.
- **Dus:** er is één expliciet *afhankelijkhedenregister* (§6.3) met elke resterende eigenaarstaak, de frequentie en de geschatte tijd (§10). Er zijn geen verborgen afhankelijkheden.

**C2. Omzetdata komt niet vanzelf binnen**
- Commissies staan in het dashboard van elk netwerk of programma.
- Sommige netwerken bieden een publisher-API met eigen credentials per netwerk. Veel kleinere SaaS-programma's bieden alleen een dashboard of een CSV-export.
- **Dus:** omzetinname werkt per netwerk via een connector waar een API is (klasse B), en anders via een CSV-import (klasse C, maandelijks, ±15 minuten).
- Per stroom toont het dashboard "data t/m {datum}".
- **Onbekend is nooit €0.** Een verouderde import wordt één keer geëscaleerd en is daarna zichtbaar in elk rapport. Het is nooit een stil gat.

**C3. Weinig verkeer betekent geen statistische zeggingskracht**
- Stel dat je een conversiestap van 5% met 20% relatief wilt verbeteren (naar 6%), met 80% power en α = 0,05.
- Dan zijn **±8.155 bezoekers per variant** nodig. Bij een stap van 2% → 2,4% is dat ±21.100 per variant. *(Berekend met de two-proportion z-test.)*
- In het basisscenario heeft de hele site in maand 6 ±4.000 bezoekers per maand. Eén paginatest zou dan langer dan een jaar duren.
- **Dus:**
  - Geen automatische experimenten tot de benodigde steekproef per test haalbaar is binnen 8 weken.
  - Tot die tijd voert het systeem alleen **deterministische verbeteringen** uit: technische SEO, kapotte interne links, ontbrekende metadata en snelheid.
  - Observaties worden gerapporteerd als "signaal, nog geen bewijs".
  - Het weekrapport markeert veranderingen die binnen de ruis vallen (§7.3).

**C4. Autonome SEO-content op schaal is een spamrisico**
- Het spambeleid van Google (*scaled content abuse*) richt zich op massaal geproduceerde pagina's die vooral bedoeld zijn om te ranken. Of een mens of AI ze maakte, maakt niet uit.
- Een straf kan het hele domein treffen.
- **Dus:**
  - Er worden geen autonome artikelen gegenereerd.
  - Programmatische pagina's zijn alleen toegestaan op basis van **unieke, gestructureerde data**: prijzen met historie, vergelijkingen, alternatieven, wijzigingen.
  - Die pagina's staan achter indexeerbaarheidspoorten: minimaal genoeg unieke data én aantoonbare vraag.
  - Gegenereerde tekst mag alleen opgeslagen feiten parafraseren ("no new facts") en wordt gelabeld als AI-ondersteund.

**C5. Een systeem kan zijn eigen uitval niet melden**
- Ligt de server of worker plat, dan ligt de interne alarmering ook plat.
- **Dus:** er is een externe *dead man's switch* (klasse B):
  - een heartbeat-ping naar een externe monitor na elke worker-cyclus;
  - een externe uptimecheck van de publieke site.
- Dit is een van de weinige verplichte externe diensten. Er bestaan gratis instapniveaus (bijv. Healthchecks.io, UptimeRobot); de voorwaarden controleer je bij de inrichting.

**C6. Confidence is geen waarheid**
- De confidenceformule (doc 08 §4) is een model. Zonder grondwaarheid is het echte foutpercentage van automatisch gepubliceerde feiten onbekend.
- **Dus: een steekproefaudit.**
  - Het systeem trekt elke maand willekeurig automatisch gepubliceerde feiten, gestratificeerd per agent en confidenceband.
  - Omvang: in de eerste drie maanden 20 per maand (±25 minuten), daarna 10 per maand (±12 minuten).
  - De eigenaar controleert ze tegen de bron.
- Wat de steekproef zegt:
  - Zijn 60 steekproeven foutloos, dan ligt het werkelijke foutpercentage met 95% zekerheid onder ±5% (*rule of three*: 3/n).
  - Het systeem berekent de precisie per band en doet op basis van de Wilson-ondergrens een **voorstel** voor nieuwe drempels.
- Aanvullende grondwaarheid komt uit vendorcorrecties, gebruikersmeldingen en onenigheid tussen bronnen.

**C7. Eén bug kan alles tegelijk kapotmaken**
- Een parserfout, of een gewijzigd paginatemplate bij een platform dat veel vendors gebruiken, kan tientallen "prijswijzigingen" tegelijk opleveren.
- Autonome publicatie zou die fout in één nacht overal verspreiden.
- **Dus: een anomaliewacht (§4.4).**
  - Wijzigt een run meer dan een drempel (standaard: 10% van de tools, of meer dan 5 prijswijzigingen), dan bevriest de publicatie van die run automatisch. Alles gaat dan naar de queue en er volgt één escalatie.
  - Elke automatische wijziging is omkeerbaar per actie en per run (§4.5).

**C8. Alarmmoeheid is de vijand van het uitzonderingsmodel**
- Landen er dertig items per week in de inbox, dan stopt de eigenaar met lezen en worden echte problemen gemist.
- **Dus (§5.4):**
  - een escalatiebudget van ≤ 5 actie-items per week;
  - bundeling ("12 tools onbereikbaar" in plaats van 12 items);
  - automatisch sluiten zodra de oorzaak verdwijnt;
  - een veilige standaardactie per item bij geen reactie;
  - "stop met vragen" wordt omgezet in een voorstel om het beleid aan te passen.

**C9. Vendors blokkeren bots en bronnen veranderen**
- Denk aan botbescherming, JavaScript-gerenderde prijspagina's, prijzen en valuta die per regio verschillen, en A/B-tests op prijspagina's.
- **Dus:**
  - Een mislukte fetch is géén escalatie. Het feit houdt de laatst geverifieerde waarde, en de leeftijd is zichtbaar (freshness engine).
  - Een prijswijziging vereist **bevestiging door herhaling** (§4.4).
  - Valuta en regio worden bij elke observatie vastgelegd.

**C10. Juridische grenzen van automatisering**
- **robots.txt en ToS** (brief §30):
  - bronnen die ophalen verbieden, worden niet opgehaald.
- **Auteursrecht:**
  - geen volledige kopieën;
  - korte citaten als bewijs, met bronvermelding.
- **Databankenrecht van derden.**
- **AI-verordening art. 50** (transparantie, van toepassing vanaf 2 augustus 2026):
  - AI-ondersteunde tekst wordt gelabeld, ook waar dat mogelijk niet strikt verplicht is.
- **AVG:**
  - cookieloze analytics zonder persoonsgegevens;
  - leads alleen met toestemming.
- **Telecommunicatiewet art. 11.7 (plus de AVG):**
  - opt-in geldt voor natuurlijke personen, inclusief eenmanszaken;
  - dat maakt geautomatiseerde koude e-mail juridisch lastig, en het brengt reputatierisico mee;
  - dus geen autonome outreach.
- **Omnibus (art. 6:193e BW):**
  - de rankingparameters zijn openbaar;
  - een wijziging van de ranking vereist dus een aanpassing van de methodologie, en dat is een menselijk besluit.
- **Reclamecode:**
  - gesponsorde content wordt gelabeld.

**C11. Terugkoppelingslussen kunnen de neutraliteit ondermijnen**
- Optimaliseren op kliks of omzet schuift langzaam naar "rijk wordt rijker" en naar een ranking die door geld wordt gestuurd.
- **Dus: omzetdata stuurt alleen:**
  1. de contentprioriteit;
  2. de linkvariant per tool (affiliate of direct, welk netwerk);
  3. de prioriteit van commerciële kansen.
- Omzetdata raakt **nooit** de ranking, de volgorde van aanbevelingen of welke tools erin staan. Dat wordt afgedwongen via modulegrenzen en de test `ranking-independence` (doc 09 §1).
- Een wijziging in de aanbevelingsgewichten verloopt zo: voorstel, offline-evaluatie, akkoord van de eigenaar, aanpassing van de methodologie.

**C12. Kosten kunnen weglopen**
- Risico's: LLM-lussen, quota's, render-workers.
- **Dus:**
  - dagbudgetten per agent en in totaal;
  - circuit breakers;
  - de LLM alleen waar de deterministische route faalt (gating);
  - de kosten per week in het rapport (§11).

**C13. Automatisch ontdekken en publiceren van nieuwe tools botst met kwaliteit en veiligheid**
- Tussen nieuwe AI-tools zitten scams, malware, NSFW-"undress"-apps, dunne wrappers, duplicaten en affiliate-spam.
- **Dus:**
  - quarantainepublicatie met harde poorten (§4.4);
  - een blokkadelijst van categorieën;
  - tools in geblokkeerde categorieën worden nooit automatisch gepubliceerd.

---

## 2. Classificatie: wat kan écht autonoom?

| Klasse | Betekenis |
|---|---|
| **A — Nu autonoom** | Alleen eigen code plus gratis publieke bronnen zonder contract. De mens komt alleen in beeld bij uitzonderingen. |
| **B — Autonoom na eenmalige koppeling** | Vereist een externe API, dienst of sleutel. De eigenaar richt die eenmalig in, daarna draait het vanzelf. |
| **C — Autonoom voorbereid, mens beslist** | Het systeem doet de detectie en het onderzoek en maakt een kant-en-klaar voorstel. Het besluit of de handtekening is menselijk: één klik of een korte taak. |
| **D — Niet automatiseren (nu)** | Te duur, onbetrouwbaar, juridisch problematisch of economisch niet te rechtvaardigen. |

| # | Proces | Klasse | Wat het systeem zelf doet | Wanneer de mens in beeld komt |
|---|---|---|---|---|
| 1 | Ontdekken van nieuwe tools | A (HN Algolia, GitHub, RSS) · B (Product Hunt: token + voorwaarden) | Kandidaten, dossier, poorten, quarantainepublicatie | Grijze-zone-poorten, wekelijks gebundeld |
| 2 | Monitoren van bestaande tools | A | Status, snapshots, hash-diffs | Nooit, tenzij "stopgezet" zonder officiële bron |
| 3 | Verifiëren van informatie | A (verankering) · B (LLM-extractie) | Verankeren, promoveren naar GECONTROLEERD | Conflict tussen officiële bronnen |
| 4 | Prijswijzigingen | A/B | Detectie, bevestiging door herhaling, publicatie binnen het beleid | Grote sprong zonder verankering; anomaliebevriezing |
| 5 | Featurewijzigingen | A (officiële changelog/RSS) · B (LLM-classificatie) | Pulse-events uit officiële feeds | Homepage-diffs zonder changelog (batch) |
| 6 | Stopgezette tools | A (signalen) · C (label "stopgezet") | Label "niet bereikbaar sinds …"; "stopgezet" alleen met een letterlijke officiële aankondiging | "Stopgezet" zonder officiële bron |
| 7 | Duplicaten | A (kandidaat vs. catalogus) · C (bestaande tools) | Kandidaat-duplicaten (zelfde domein) automatisch afwijzen | Samenvoegen van bestaande tools |
| 8 | Kapotte links | A | Controles, herhaling, labels, affiliate → directe link als fallback | Nooit (permanent verdwenen: zie 6) |
| 9 | Metadata en verrijking | A (GitHub, sitemetadata) · B (LLM) | Verrijking met provenance | Klacht van een merkhouder |
| 10 | Aankondigingen en nieuws | A (officiële feeds) · B (LLM-samenvatting) | Pulse uit officiële bronnen; media alleen als link | Mediaclaims zonder officiële bevestiging die impact hebben |
| 11 | YouTube- en social-signalen | A (kanaal-RSS, HN, GitHub) · B (YouTube Data API) · D (Reddit, X, LinkedIn) | Relevantie van video's, momentum | Nooit (onder de drempel = niet tonen) |
| 12 | Trends | A (eigen vraagdata, GitHub/HN-snelheid) · B (Search Console) · D (Google Trends scrapen) | Trenddetectie in het rapport | Nooit (informatief) |
| 13 | SEO-content genereren en updaten | A (datagedreven updates) · B (LLM binnen guards) · D (massa-artikelen) | Pagina's updaten bij datawijziging; beschrijvingen uit feiten | Nieuwe paginatypen; eerste batch concepten via een steekproef |
| 14 | Zoekkansen | A (Match-queries zonder resultaat) · B (Search Console) | Kansenlijst; vergelijkingspagina aanmaken als de datapoort slaagt | Nieuwe taken en categorieën (1 klik) |
| 15 | Pagina's verbeteren op basis van prestaties | A (technisch) · C (experimenten, zodra de power volstaat) | Technische SEO-fixes, interne links herstellen | Experimenten (later, C3) |
| 16 | Affiliatelinks valideren | A | Redirectketen, eindbestemming en subID controleren; fallback | Programma beëindigd (bevestigen, gebundeld) |
| 17 | Affiliatekansen | A (detectie) · C (aanmelding) | Programma's detecteren; verwachte opbrengst op basis van gemeten kliks | Aanmelden (contract, identiteit) |
| 18 | Affiliateprestaties | B (netwerk-API) · C (CSV-import) | EPC/RPM per pagina en tool, anomalieën | Import als er geen API is |
| 19 | Commerciële kansen (sponsoring, leads, nieuwsbrief, premium, B2B, partnerships) | A (drempeldetectie) · C (deal) | "Sponsorslot is nu verantwoord", mediakit met echte cijfers | Onderhandelen, prijs, contract, factuur |
| 20 | Technische gezondheid | A (intern) · B (externe heartbeat/uptime) | Healthchecks, afhankelijkhedenregister | P1-storing die zelfherstel niet oplost |
| 21 | Geautomatiseerde tests | A | CI plus nachtelijke synthetische journeys | Falende test → ontwikkelaar (of een automatisch GitHub-issue) |
| 22 | Fouten detecteren en herstellen | A | Retry, backoff, circuit breaker, auto-uit, terugdraaien | Structurele fouten na zelfherstel |
| 23 | Databasekwaliteit | A · B (back-ups bij de hostingpartij) | Kwaliteitsscore, tegenstrijdigheden, hersteltest van back-ups | Een herstel uitvoeren (zeldzaam) |
| 24 | Contentversheid | A | Versheid; herverificatie gepland op impact | Nooit (de banner toont de leeftijd) |
| 25 | Aanbevelingskwaliteit | A (golden set, impliciete signalen) · C (gewichten) | Meten, regressies detecteren, automatische terugdraai | Gewichten of methodologie wijzigen |
| 26 | Gebruikersgedrag en funnel | A | Funnels, anomalieën | Nooit (rapport) |
| 27 | Omzetkansen | A (detectie) · C (actie) | Gerangschikte kansen met verwachte waarde en bewijs | Beslissing en uitvoering |
| 28 | Periodieke BI-rapporten | A · B (e-mailbezorging) | Weekrapport | Lezen (±10 minuten per week) |

---

## 3. De zeven vragen per proces

De zeven vragen:
1. Is het technisch haalbaar?
2. Is het juridisch toegestaan?
3. Hoe betrouwbaar is de data?
4. Wat gebeurt er bij lage confidence?
5. Wat kost het per maand? De LLM-bedragen volgen de aannames in §11.
6. Is het economisch te rechtvaardigen?
7. Wanneer is er een mens nodig?

### 3.1 Data

| Proces | 1 Technisch | 2 Juridisch | 3 Betrouwbaarheid | 4 Bij lage confidence | 5 Kosten/mnd | 6 Rendabel? | 7 Mens |
|---|---|---|---|---|---|---|---|
| Discovery | Ja: HN Algolia, GitHub Search, RSS | Openbare API's; Product Hunt: token + voorwaarden checken | Laag per los signaal, hoog na dossier + poorten | Kandidaat blijft onzichtbaar | ≈ $0–2 | Ja: dekking groeit zonder handwerk | Grijze zone, wekelijks gebundeld |
| Monitoring | Ja: fetcher + hash-diff | robots.txt/ToS gerespecteerd; snapshots intern, niet publiek | Hoog (deterministisch) | n.v.t. | €0 (worker) | Ja | Nee |
| Verificatie | Ja: verankering; LLM voor extractie | Korte citaten als bewijs (citaatrecht) met bron | Hoog bij verankering, middel bij fuzzy | Status blijft ONDERSTEUND/ONBEVESTIGD, zichtbaar | ≈ $2–5 | Ja: kern van het vertrouwen | Conflict tussen officiële bronnen |
| Prijzen | Ja, met render-modus en geo-kanttekening | Idem | Middel-hoog, met herhaalbevestiging | Oude prijs + "mogelijk gewijzigd" | in verificatie | Ja: het meest gezochte feit | Grote sprong zonder verankering; bevriezing |
| Features | Ja via changelog/RSS; homepage-diffs zijn ruisgevoelig | Idem | Hoog (changelog) / laag (diff) | Diff → wekelijkse batch, niet gepubliceerd | ≈ $2 | Ja voor changelogs, nee voor losse diffs | Alleen batch met twijfelgevallen |
| Stopgezet | Signalen: DNS, 404, domeinparkering, aankondiging | Onterecht "stopgezet" = reputatieschade voor de vendor | Signaal hoog; conclusie laag zonder aankondiging | Feitelijk label "niet bereikbaar sinds …" | €0 | Ja | "Stopgezet" zonder officiële bron |
| Duplicaten | Ja: domein, naam, aliassen | — | Hoog bij hetzelfde domein | Kandidaat → queue | €0 | Ja | Samenvoegen van bestaande tools |
| Links | Ja | — | Hoog na 3 pogingen over 24 u | Label pas na herhaling | €0 | Ja | Nee |
| Verrijking | Ja: GitHub-API, sitemetadata | Logo's alleen ter identificatie; verwijderen op verzoek | Hoog voor API-data | Veld leeg laten in plaats van gokken | ≈ $0–1 | Ja | Klacht van een merkhouder |
| Nieuws | Ja via officiële feeds | Geen artikelen kopiëren: titel + link + eigen feitensamenvatting | Hoog (officieel), middel (media) | Media-only → label COMMUNITY/ONBEVESTIGD of queue | ≈ $2 | Ja: voedt Pulse | Media-only claims met impact |
| Video/social | YouTube Data API (standaardquotum 10.000 units/dag; een zoekopdracht kost 100 units, dus ±100 per dag); kanaal-RSS; HN; GitHub | YouTube API-voorwaarden (officiële speler, regels voor opslag van API-data); Reddit/X betaald of op toestemming → D | Middel (relevantie) | Onder de drempel → niet tonen | €0 (quotum) | Ja voor YouTube/HN/GitHub; nee voor Reddit/X | Nee |

### 3.2 Groei en content

| Proces | 1 Technisch | 2 Juridisch | 3 Betrouwbaarheid | 4 Bij lage confidence | 5 Kosten/mnd | 6 Rendabel? | 7 Mens |
|---|---|---|---|---|---|---|---|
| Trends | Ja: eigen Match- en zoekdata, GitHub/HN-snelheid, Search Console-API | Google Trends heeft geen algemeen beschikbare officiële API; scrapen strijdt met de voorwaarden → niet doen | Middel; ruis bij laag volume | Label "signaal" | €0 | Ja | Nee |
| SEO-content | Updates: ja (datagedreven); tekst: LLM met guards | Scaled-content-beleid; AI-label | Hoog (data) / middel (tekst) | Concept blijft concept (noindex) | ≈ $1–6 | Ja voor datapagina's; **nee** voor massa-artikelen | Nieuwe paginatypen; steekproef bij de eerste batch |
| Zoekkansen | Ja | — | Middel | Kans blijft advies | €0 | Ja | Nieuwe taken en categorieën (1 klik) |
| Paginaverbetering | Technisch: ja; experimenten pas bij voldoende verkeer (C3) | Geen dark patterns | Laag bij weinig verkeer | Alleen observeren | €0 | Technische fixes ja; experimenten later | Experimenten starten (later) |

### 3.3 Commercie

| Proces | 1 Technisch | 2 Juridisch | 3 Betrouwbaarheid | 4 Bij lage confidence | 5 Kosten/mnd | 6 Rendabel? | 7 Mens |
|---|---|---|---|---|---|---|---|
| Affiliatelinks valideren | Ja: redirectketen, eindbestemming, subID | — | Middel: trackingdomeinen blokkeren soms bots, dus "onbekend" ≠ "kapot" | Directe link als fallback | €0 | Ja: beschermt omzet en UX | Programma beëindigd (bevestigen) |
| Affiliatekansen | Detectie: ja (partnerpagina's, netwerkpatronen) | Aanmelding = contract door een rechtspersoon | Middel | Alleen advies | €0 | Ja | Aanmelden (10–20 min per programma) |
| Affiliateprestaties | Ja met netwerk-API, anders CSV | Voorwaarden van het netwerk voor API-gebruik | Hoog (de bron is het netwerk) | "Onbekend" tonen, nooit €0 | €0 | Ja | Import zonder API (±15 min/mnd per netwerk) |
| Commerciële kansen | Readiness-detectie: ja | Reclamecode-labeling; Tw art. 11.7 bij e-mail | Hoog voor drempels (eigen data) | Alleen advies | €0 | Ja | Onderhandelen, prijs, contract, factuur |
| Omzetkansen | Ja: detectie + schatting van de verwachte waarde | — | Middel; schattingen expliciet gelabeld | Alleen advies | €0 | Ja | Beslissing en uitvoering |

### 3.4 Techniek en kwaliteit

| Proces | 1 Technisch | 2 Juridisch | 3 Betrouwbaarheid | 4 Bij lage confidence | 5 Kosten/mnd | 6 Rendabel? | 7 Mens |
|---|---|---|---|---|---|---|---|
| Technische gezondheid | Intern: ja; extern: heartbeat nodig (C5) | — | Hoog | n.v.t. | €0 (gratis tiers) | Ja: verplicht | P1-storing die zelfherstel niet oplost |
| Tests | Ja: CI + nachtelijke synthetische journeys | Synthetisch verkeer uitsluiten van analytics | Hoog | Deploy geblokkeerd | €0 (gratis CI-tier) | Ja | Falende test → ontwikkelaar / GitHub-issue |
| Fouten en herstel | Ja: retry, backoff, circuit breaker, terugdraaien | — | Hoog | Agent gaat automatisch uit na N fouten | €0 | Ja | Structurele fouten |
| DB-kwaliteit | Ja, plus een hersteltest van back-ups | AVG: bewaartermijnen gelden ook voor back-ups | Hoog | Kwaliteitsscore stuurt de indexeerbaarheid | €0–5 | Ja | Een herstel uitvoeren |
| Versheid | Ja | Consumentenrecht: geen misleidende prijsinformatie → leeftijd tonen | Hoog | Banner "mogelijk verouderd" | €0 | Ja | Nee |
| Aanbevelingskwaliteit | Ja: golden set, impliciete signalen, feedbackknop | Omnibus: parameters openbaar | Middel | Regressie → automatisch terugdraaien of melden | €0 | Ja | Gewichten of methodologie |
| Funnel | Ja: first-party, cookieloos | AVG: geen persoonsgegevens | Hoog voor tellingen; ruis bij kleine aantallen | Label "binnen normale schommeling" | €0 | Ja | Nee |
| Rapporten | Ja | — | Zo goed als de onderliggende data (per cijfer: bron + actualiteit) | Ontbrekende data expliciet benoemd | ≈ $0,30 (optionele LLM-samenvatting) | Ja | Lezen |

---

## 4. Architectuur van de autonome lus

```
        ┌────────── PLANNER: verificatiebudget naar impact (verkeer × volatiliteit × veroudering) ─────────┐
        ▼                                                                                                  │
  SENSE — agents halen op (fetcher, API's, eigen data)                                                     │
        │                                                                                                  │
        ▼                                                                                                  │
  DECIDE — risicoklasse × confidence × harde regels × anomaliewacht × budget                               │
        │                                          │                                                       │
        ▼                                          ▼                                                       │
  ACT (automatisch, omkeerbaar,          ESCALATE (inbox: ernst, "waarom jij", advies,                     │
       in het actielogboek)                        standaardactie + deadline, bundeling)                   │
        │                                          │                                                       │
        ▼                                          ▼                                                       │
  VERIFY — herhaling · synthetische tests · golden set · maandelijkse steekproefaudit                      │
        │                                                                                                  │
        ▼                                                                                                  │
  LEARN — precisie per band → drempelvoorstellen · goedkeuringspatronen → autonomievoorstellen ────────────┘
```

### 4.1 Componenten

| Component | Taak |
|---|---|
| **Planner** | Verdeelt het dagelijkse ophaalbudget op basis van impact: (bezoeken aan toolpagina's + uitgaande kliks, 30 d) × volatiliteit (historische wijzigingsfrequentie) × veroudering. Er geldt een ondergrens: elke tool wordt binnen de versheidslimiet gecontroleerd. |
| **Beleidsmotor** | Risicoklasse (§4.2) + confidenceband (doc 08 §5) + harde regels. Resultaat: auto, gepoort of mens. |
| **Anomaliewacht** | Controle op run-niveau vóór publicatie (§4.4). Kan de hele run bevriezen. |
| **Actielogboek** | `agent_actions` met ervoor en erna. Terugdraaien kan per actie en per run (§4.5). |
| **Escalatiemanager** | Inbox, deduplicatie, bundeling, ernst, SLA, standaardactie bij time-out, automatisch sluiten, escalatiebudget (§5). |
| **Afhankelijkhedenregister** | Elke externe input (API, sleutel, import, heartbeat) met de verwachte actualiteit. Verouderd = één escalatie (§6.3). |
| **Budgetbeheer** | Dagbudgetten voor LLM en API's, per agent en in totaal. Circuit breakers per bron en domein. |
| **Health** | Interne checks + heartbeat-ping naar de externe monitor. |
| **Reporter** | Het wekelijkse rapport (§7). |

### 4.2 Risicoklassen

| Klasse | Voorbeelden | Autonomie |
|---|---|---|
| **R0: intern, onzichtbaar** | Kwaliteitsscore, planning, cache, relatieberekening | Altijd automatisch |
| **R1: publiek, feitelijk, omkeerbaar** | Verankerde prijsupdate, linkstatus, versheid, video van een officieel kanaal, Pulse uit een officiële changelog | Automatisch binnen het confidencebeleid + de anomaliewacht |
| **R2: publiek, reputatie- of impactgevoelig** | Nieuwe tool, label "stopgezet", grote prijssprong, nieuw paginatype, gegenereerde tekst | Gepoort: quarantaine, herhaling of officiële bron. Anders beslist een mens. |
| **R3: juridisch, financieel, contractueel, security, strategisch** | Aanmeldingen, contracten, sponsorprijs, rankingmethodologie, beveiligingsincident, juridische klacht, sleutels | Altijd een mens. Het systeem bereidt voor. |

### 4.3 Hoe de bestaande harde regels (doc 08 §5) veranderen

| Regel (was) | Wordt |
|---|---|
| Prijsstijging > 50% → `needs_human` | Blijft `needs_human`, **maar**: is de prijs verankerd op een officiële bron en 2× bevestigd, dan geldt een veilige standaardactie. Na 72 uur zonder reactie wordt de prijs gepubliceerd met het label "grote wijziging, bevestigd door 2 metingen". |
| Statuswijziging naar `shutdown` → `needs_human` | Met een letterlijke officiële aankondiging (bronzin op het eigen domein van de vendor) → `auto_published_flagged`. Zonder: alleen het feitelijke label "niet bereikbaar sinds …" (R1) en een escalatie. |
| Nieuwe tool → altijd `queued` | Instelbaar `newToolMode`: `queue` (MVP-standaard) of `quarantine` (§4.4). |

### 4.4 Ontwerppatronen

1. **Degradeer naar transparantie, niet naar stilte.**
   - Kan het systeem iets niet bevestigen, dan toont het de onzekerheid aan de gebruiker.
   - Voorbeelden: "prijs gecontroleerd op {datum}", "mogelijk gewijzigd, wordt gecontroleerd".
   - Het houdt nooit stilletjes een oude waarde vast, en publiceert nooit stilletjes een nieuwe.
2. **Bevestiging door herhaling.**
   - Een prijswijziging wordt pas gepubliceerd na **2 identieke observaties met ≥ 6 uur ertussen** (instelbaar).
   - Dat filtert A/B-tests, regionale verschillen en tijdelijke fouten weg.
   - De tweede observatie wordt als vervolgtaak ingepland.
3. **Quarantainepublicatie** (nieuwe tools, als `newToolMode = quarantine`).
   - De harde poorten moeten allemaal slagen:
     - officiële site bereikbaar via HTTPS, zonder redirect naar een ander domein;
     - geen duplicaat;
     - categorie niet op de blokkadelijst;
     - ≥ 2 onafhankelijke signalen (bijv. HN-punten, GitHub-sterren, meerdere bronnen);
     - ≥ 1 verankerd feit;
     - de capability-mapping met hoge zekerheid.
   - Dan wordt de tool gepubliceerd met **noindex** en het label "Nieuw, nog in controle", buiten de aanbevelingen.
   - Blijven alle checks 7 dagen groen, dan volgt automatische promotie.
   - Faalt een poort, dan wordt de tool automatisch gedepubliceerd.
   - De eigenaar ziet wekelijks één regel: "{n} nieuwe tools in quarantaine".
4. **Een anomaliewacht met automatische bevriezing.**
   - Vóór publicatie vergelijkt de run het aantal en de verdeling van de wijzigingen met de drempels (standaard > 10% van de tools, of > 5 prijswijzigingen, of > 3 statuswijzigingen).
   - Wordt een drempel overschreden, dan wordt alles in de run `queued` en volgt één escalatie.
   - Een run die > 25% raakt, is P1.
5. **Alles omkeerbaar.**
   - Elke automatische wijziging schrijft historie (`valid_to`) en een actie met ervoor en erna.
   - "Run terugdraaien" zet alle wijzigingen van een run terug en wordt zelf ook gelogd.
6. **Een veilige standaardactie bij geen reactie.**
   - Elke escalatie heeft een `defaultAction` en een deadline (§5.5).
   - Niets doen is dus altijd een gedefinieerde, veilige uitkomst.
7. **Begrensde autonomie.**
   - De eigenaar stelt eenmalig grenzen in, en het systeem optimaliseert daarbinnen:
     - de LLM-gatingdrempel;
     - de verdeling van het verificatiebudget;
     - de dagbudgetten.
   - Buiten de grenzen doet het systeem een voorstel.
8. **Autonomie verdienen.**
   - Heeft de eigenaar ≥ 20 opeenvolgende items van een type zonder aanpassing goedgekeurd, en ≥ 95% over 60 dagen, dan stelt het systeem voor om de autonomie voor dat type te verhogen.
   - Afwijspatronen leiden tot voorstellen voor strengere poorten.
   - Het besluit blijft bij de eigenaar.
9. **Eén afhankelijkhedenregister.** Er is geen workflow die stilletjes van de eigenaar afhangt (§6.3).
10. **Nul is niet onbekend.** Ontbrekende data wordt als "—" met een reden getoond, nooit als 0 (§6.2).

### 4.5 Terugdraaien

- **Per actie:** `agent_actions.before` wordt teruggezet.
- **Per run:** alle acties van een `run_id`, in omgekeerde volgorde.
- **Voorwaarde:** een actie wordt alleen teruggedraaid als het veld sindsdien niet opnieuw is gewijzigd. Anders volgt een conflictmelding, geen overschrijving.
- **Automatisch terugdraaien:**
  - bij een regressie in de golden set, als de oorzaak een automatische wijziging is die < 24 uur oud is;
  - bij een faalde quarantainepoort.

---

## 5. Escalatiesysteem

### 5.1 Wanneer wordt er geëscaleerd (en alleen dan)

1. Er is een R3-actie nodig.
2. Een harde regel slaat aan (grote prijssprong zonder verankering, "stopgezet" zonder officiële bron).
3. De anomaliewacht heeft een run bevroren.
4. Een fout blijft terugkomen na zelfherstel:
   - een agent is automatisch uitgeschakeld;
   - of de bron van een tool met veel verkeer is > 7 dagen geblokkeerd en de data zijn verlopen.
5. Een afhankelijkheid is verouderd: omzetimport > 35 dagen, ongeldige API-sleutel, heartbeat gemist (extern), of een budget dat herhaaldelijk op is.
6. Een beveiligingsgebeurtenis: een piek in mislukte logins, een mogelijk gelekt geheim, of een kritieke kwetsbaarheid in een dependency.
7. Een kans met een verwachte waarde boven de drempel (standaard ≥ €25/mnd) waarvoor een menselijke actie nodig is.
8. De steekproefaudit is aan de beurt (maandelijks).
9. Een vendorcorrectie met impact of een juridische klacht (altijd).

### 5.2 Anatomie van een escalatie

| Veld | Inhoud |
|---|---|
| Ernst | P1 / P2 / P3 |
| Categorie | data · commercieel · juridisch · security · techniek · content |
| Titel | Eén zin |
| **Waarom jij** | De specifieke reden waarom de automatisering stopte ("prijssprong van 120%, officiële pagina niet verankerbaar") |
| **Advies** | Wat het systeem zou doen, en waarom |
| Bewijs | Bronnen, diff, citaten, runs |
| Impact | Getroffen pagina's en bezoekers (30 d), en de verwachte waarde in € (gelabeld als schatting, met de berekening) |
| Opties | Knoppen: goedkeuren, afwijzen, aanpassen, uitstellen, "niet meer vragen voor dit type" (dat wordt een beleidsvoorstel) |
| **Standaardactie + deadline** | Wat er gebeurt als de eigenaar niets doet, en wanneer |
| Deduplicatie en bundeling | `dedupe_key`, `group_key` |
| Automatisch sluiten | De voorwaarde waaronder het item zichzelf sluit (bijv. site weer bereikbaar) |
| Herkomst | Agent, run, tijdstip |

*Voorbeeld (fictief, ter illustratie van het formaat):*
```
[P2 · data]  Prijs "Creator" van ToolX mogelijk van $20 naar $45 /mnd
Waarom jij:  stijging 125% (> 50%) en de bronzin is niet letterlijk verankerd (fuzzy 0,86)
Advies:      oude prijs laten staan met "mogelijk gewijzigd"; opnieuw meten over 6 u
Bewijs:      https://toolx.example/pricing · snapshot 2026-10-02 03:04 · diff
Impact:      toolpagina + 3 vergelijkingen · 412 bezoeken (30 d)
Standaard:   na 72 u zonder reactie → "mogelijk gewijzigd" blijft staan; opnieuw beoordeeld bij de volgende meting
Opties:      [Nieuwe prijs publiceren] [Oude prijs bevestigen] [Aanpassen…] [Uitstellen 7 d]
```

### 5.3 Ernst en kanalen

| Ernst | Betekenis | Voorbeelden | Kanaal | Standaard bij geen reactie |
|---|---|---|---|---|
| **P1** | Nu | Site > 10 min onbereikbaar (extern gemeld), beveiligingsincident, bevriezing > 25% van de tools, kritieke synthetische journey faalt, juridische klacht | Direct e-mail (+ optioneel webhook) + bovenaan het dashboard | Veilige toestand (bevroren, geblokkeerd, verborgen) |
| **P2** | Deze week | R3-besluiten, harde regels, verouderde afhankelijkheden, kansen boven de drempel, steekproefaudit | Dashboard + weekrapport; e-mail alleen bij een deadline < 72 u | Standaardactie na de SLA (standaard 7 dagen) |
| **P3** | Wanneer het uitkomt | Grijze-zone-batches, conceptsteekproeven | Alleen het dashboard (queue) | Niet publiceren; vervalt na 30 dagen |

"**Vraagt jouw aandacht**" = open P1 + P2. De P3-queue staat op een aparte pagina en telt niet mee.

### 5.4 Escalatiebudget en bundeling

- **Budget:** ≤ 5 open P2-items per week (instelbaar).
- **Bij overschrijding:**
  - P2-items van hetzelfde type worden gebundeld tot één item met een lijst;
  - het weekrapport meldt "budget overschreden" met de oorzaak, bijv. "80% komt van bron X (geblokkeerd) → voorstel: `fetch_mode=render`".
- **Bundeling:**
  - items met dezelfde `group_key` (bijv. `unreachable:{datum}`) worden één item;
  - het aantal wordt bijgewerkt.
- **Automatisch sluiten:**
  - zodra de voorwaarde niet meer geldt (site weer bereikbaar, import binnen), sluit het item met status `auto_resolved` en een reden.

### 5.5 Veilige standaardacties

| Escalatie | Na de SLA, zonder reactie |
|---|---|
| Prijssprong > 50%, officieel verankerd en 2× bevestigd | Publiceren met het label "grote wijziging, bevestigd door 2 metingen" (72 u) |
| Prijs niet verankerd of conflicterend | Oude prijs + "mogelijk gewijzigd, wordt gecontroleerd". Opnieuw meten; vervalt na 30 dagen. |
| "Stopgezet" zonder officiële bron | Alleen "niet bereikbaar sinds …" (staat er al). Nooit automatisch "stopgezet". |
| Nieuwe tool in de grijze zone | Niet publiceren. Vervalt na 30 dagen en wordt opnieuw beoordeeld bij nieuwe signalen. |
| Kans: aanmelden bij een affiliateprogramma | Niets. De kans blijft in de lijst en de verwachte waarde wordt bijgewerkt. |
| Omzetimport verouderd | Het dashboard toont "onbekend sinds …". Het weekrapport noemt het. |
| Anomaliebevriezing | Blijft bevroren. Na 7 dagen vervallen de bevroren wijzigingen en begint de volgende run opnieuw. |
| Verdachte logins | Account automatisch tijdelijk geblokkeerd; blijft zo tot actie van de eigenaar |
| Juridische klacht over een specifiek feit | Het betwiste feit wordt verborgen met de melding "wordt beoordeeld". De rest van de pagina blijft staan. |
| Vendorcorrectie zonder bewijs | Het feit blijft staan. De vendor krijgt een automatisch verzoek om een bron (bevestigingsmail met een link naar het correctieformulier). |

### 5.6 Leren van beslissingen

- Elke beslissing (goedkeuren, afwijzen, aanpassen) wordt gelogd met het type en de kenmerken van het item.
- **Autonomievoorstel:** als ≥ 20 opeenvolgende items van een type ongewijzigd zijn goedgekeurd en de goedkeuring over 60 dagen ≥ 95% is, volgt een P2-voorstel. Bijvoorbeeld: "prijswijzigingen tussen 50% en 80% met officiële verankering automatisch publiceren?"
- **Steekproefaudit:** geeft de precisie per band en een Wilson-ondergrens. Zakt de ondergrens onder het doel (95%), dan volgt een voorstel om de drempel te verhogen.
- Voorstellen worden nooit automatisch doorgevoerd, omdat ze het publieke gedrag van het systeem veranderen.

---

## 6. Eigenaarsdashboard (Admin → Overzicht)

### 6.1 Indeling

```
┌ VRAAGT JOUW AANDACHT ──────────────────────────────────────────────────────────┐
│ ✓ Niets te doen.  Afgelopen 7 dagen zelf afgehandeld: {n} acties  [bekijk]     │   ← berekende toestand, geen vaste tekst
│   (of: P1/P2-kaarten met "waarom jij", advies, standaard + deadline, knoppen)  │
└────────────────────────────────────────────────────────────────────────────────┘
┌ Omzet (mnd) ─────┐┌ Verkeer (30 d) ──┐┌ Conversies ──────┐┌ Leads ───────────┐
│ totaal · per     ││ bezoekers ·      ││ uitgaande kliks ·││ nieuw · gekwali- │
│ stroom · data t/m││ organisch · AI-  ││ affiliatekliks · ││ ficeerd · waarde │
│ {datum} per bron ││ referrals        ││ conversies · EPC ││                  │
└──────────────────┘└──────────────────┘└──────────────────┘└──────────────────┘
┌ AUTOMATISCH AFGEHANDELD (7 d) ─────────┐┌ SYSTEEMGEZONDHEID ─────────────────────┐
│ per type: bevestigd · gewijzigd ·      ││ agents ✓/⚠/✗ · heartbeat · fouten (7 d)│
│ teruggedraaid · in quarantaine · …     ││ · budget LLM/API · afhankelijkheden    │
└────────────────────────────────────────┘└────────────────────────────────────────┘
┌ Belangrijke wijzigingen ┐┌ Nieuwe tools ┐┌ Kansen (verwachte waarde) ┐┌ Top pagina's / tools ┐
┌ Fouten (gegroepeerd per fingerprint) ┐┌ Afhankelijkheden: bron → actualiteit → status ┐
```

De onderdelen uit de brief zitten er allemaal in:
- omzet, affiliate-omzet, sponsoromzet;
- leads;
- verkeer, organisch verkeer, conversies;
- toptools en toppagina's;
- nieuwe tools en belangrijke wijzigingen;
- automatische acties;
- fouten;
- kansen die om goedkeuring vragen;
- systeemgezondheid.

### 6.2 Regels voor elk cijfer

1. **Bron en actualiteit** staan bij elke tegel ("uit: conversie-import PartnerStack, data t/m 30 sep").
2. **Onbekend ≠ 0.** Ontbreekt data, dan toont de tegel "—" met de reden en de actie ("geen netwerkkoppeling · laatste import 12 aug · [importeren]").
3. **Vergelijking** met de vorige periode, plus een ruislabel (§7.3).
4. **Geen vanity-metrics.** Alleen cijfers waar een beslissing uit volgt.
5. **Echte data.** Alle cijfers komen uit SQL-queries op de eigen tabellen. Er is geen demo-, voorbeeld- of opvuldata. Een lege database geeft lege toestanden met uitleg.

### 6.3 Afhankelijkhedenregister

| Afhankelijkheid | Verwachte actualiteit | Als die verouderd is |
|---|---|---|
| Externe heartbeat (worker) | ≤ 2 × het cyclusinterval | De externe monitor mailt (P1) |
| Agents (per agent) | Laatste geslaagde run ≤ 2 × het schema | P2, na automatisch opnieuw proberen |
| Omzet per netwerk (API of import) | ≤ 35 dagen | P2, daarna vermelding in het weekrapport |
| API-sleutels (Anthropic, YouTube, GitHub, e-mail, Search Console) | Geldig bij de laatste call | P2 bij een auth-fout |
| E-mailbezorging | Outbox < 24 u achterstand | P2 |
| Back-ups | Laatste back-up ≤ 24 u; hersteltest ≤ 31 d | P2 |
| Juridische gegevens (config) | Aanwezig | Blokkade in Launch readiness |
| Steekproefaudit | ≤ 31 d | P2 |

Het register is code (`src/lib/ops/dependencies.ts`) en geen document. Elke nieuwe koppeling moet zich registreren, anders faalt de test `dependencies-registered`.

---

## 7. Wekelijks autonoom rapport

### 7.1 Planning en bezorging

- **Moment:** maandag 07:00 Europe/Amsterdam (instelbaar).
- **Maker:** de Reporter-agent.
- **Opslag:** in `reports`, zichtbaar in Admin → Rapporten.
- **Bezorging:** per e-mail als e-mail is ingesteld. Anders staat alleen in het dashboard "nieuw rapport".
- **Opbouw:** de cijfers komen uit vaste queries (`src/lib/reports`). De samenvatting is een template. Een optionele LLM-herschrijving wordt alleen geaccepteerd als elk getal erin letterlijk in de brondata voorkomt ("no new numbers"). Anders blijft de template staan.

### 7.2 Inhoud

1. **Samenvatting** in drie zinnen: wat ging goed, wat vraagt aandacht, en wat het systeem zelf deed.
2. **Verkeer:** bezoekers, pageviews, organisch, AI-referrals, Matches. Met de vorige week en een ruislabel.
3. **Omzet** per stroom (affiliate, sponsor, nieuwsbrief, leads) en de conversies. Per stroom: "data t/m".
4. **Affiliateprestaties:** EPC en RPM per paginatype, top/bottom 5 tools, kapotte links en de fallbacks die zijn toegepast.
5. **Nieuwe tools:** kandidaten, gepubliceerd, in quarantaine, afgewezen.
6. **Tool- en prijswijzigingen:** de belangrijkste wijzigingen met bron.
7. **SEO-groei:**
   - indexeerbare pagina's (poorten);
   - organische bezoeken;
   - kliks en impressies in Search Console (indien gekoppeld).
8. **Beste pagina's:** op bezoekers, uitgaande kliks en omzet.
9. **Monetisatiekansen:** gerangschikt op verwachte waarde, met de berekening.
10. **Systeemgezondheid:** agentruns (ok / gedeeltelijk / mislukt), fouten per fingerprint, LLM- en API-kosten tegenover het budget.
11. **Automatische acties:** aantallen per type en beslissing, plus terugdraaiingen.
12. **Onopgeloste issues:** open P1/P2 met leeftijd en standaardactie.
13. **Aanbevolen acties voor de eigenaar:** maximaal 3, gerangschikt op verwachte waarde × urgentie, elk met de geschatte tijd.
14. **Wat dit rapport níet kon meten:** ontbrekende bronnen en verouderde afhankelijkheden.

### 7.3 Ruisregel

Voor tellingen wordt een verandering alleen als betekenisvol gemarkeerd als:
- |Δ| > 2·√(vorige waarde) (Poisson-benadering, ±95%); **en**
- de vorige waarde ≥ 30.

In alle andere gevallen: "binnen normale schommeling". Voor ratio's geldt de minimale steekproef uit C3. Onder die steekproef komt er geen oordeel.

---

## 8. Zelfherstel

| Storing | Detectie | Automatische reactie | Escaleren als |
|---|---|---|---|
| Bron geeft 403/429 | Statuscode, failure_count | Exponentiële backoff. Na 3× een alternatieve bron (officiële docs, API) of de render-modus, als die is toegestaan. | Tool met veel verkeer én data verlopen én > 7 d geblokkeerd (gebundeld) |
| Parser vindt de prijs niet meer (template gewijzigd) | Bronzin weg, grote hash-diff | Laatste waarde blijft staan, label "herverankering nodig". LLM-extractie binnen het budget. | Na 14 d voor de top-50 tools (gebundeld) |
| Massale wijziging | Anomaliewacht | Run bevroren | Altijd (P1 bij > 25%) |
| Agent crasht of loopt vast | Time-out, exception | Volgende cyclus opnieuw. Na 3 opeenvolgende fouten automatisch uit. | Bij automatisch uit (P2) |
| LLM niet beschikbaar of budget op | API-fout, budgetcheck | Deterministische route. Het budget wordt de volgende dag gereset. | > 3 dagen achtereen |
| E-mailprovider faalt | Outbox-fouten | Opnieuw met backoff | > 24 u achterstand |
| Database haperend | Pool-fouten | Opnieuw proberen. Publieke pagina's serveren de laatste in-memory catalogus (alleen lezen). | Extern: site of heartbeat > 10 min weg (P1) |
| Worker gestopt | Heartbeat mist | — (kan zichzelf niet melden) | De externe monitor mailt (P1) |
| Affiliatelink kapot | Linkcheck | Directe link als fallback, gelogd | Gebundeld in P3; P2 als het een top-10-omzettool is |
| Regressie in de golden set na een datawijziging | Nachtelijke evaluatie | Automatische wijziging < 24 u oud → terugdraaien | Anders P2 met de veroorzakende wijziging |
| Synthetische journey faalt (productie) | Nachtelijke Playwright-run | — | P1 bij een kernjourney (Match, toolpagina, /go) |
| Codefout (herhaalde exception) | Error-fingerprint | Gebundeld per fingerprint. Optioneel een automatisch GitHub-issue met stacktrace en context (token nodig). | Bij een nieuwe fingerprint met ≥ 10 voorkomens per dag |

**Grens van zelfherstel:** het systeem herstelt data, planning en verbindingen, maar **geen code**. Het deployt niet zichzelf. Codefouten worden een goed gedocumenteerd issue, en een ontwikkelaar (of Claude Code) lost het op.

---

## 9. BI- en omzetlussen

| Lus | Meet | Doet zelf | Mens |
|---|---|---|---|
| **Contentprioriteit** | Vraag (Match-queries, zoektermen) × commerciële waarde (EPC per taak/tool, gemeten of aangenomen) | Rangschikt ontbrekende vergelijkingen en taakpagina's. Maakt pagina's aan als de datapoort slaagt. | Nieuwe taken en categorieën |
| **Programmadekking** | Uitgaande kliks naar tools zonder programma | Detecteert programma's (partnerpagina's op het vendordomein, netwerkpatronen). Berekent de verwachte waarde. | Aanmelden |
| **Linkgezondheid** | Redirectketens, eindbestemmingen | Fallback naar de directe link | — |
| **Readiness** | Abonnees, bezoekers, Matches | "Nieuwsbriefsponsoring verantwoord" (≥ 1.000 abonnees), "sponsorslot" (≥ 10k bezoekers/mnd), "vendorinzichten" (≥ 10k Matches/mnd) | Aanbod, prijs, contract |
| **LLM-kosten tegenover meerwaarde** | Kosten per Match; uitkomst van LLM- versus lexicale Matches (klikratio, herformuleringen) | Past de gatingdrempel aan binnen de grenzen van de eigenaar | Grenzen, modelkeuze |
| **Funnellekken** | Stapconversie home → Match → resultaat → tool → /go | Technische fixes; observaties in het rapport | Experimenten (zodra C3 het toelaat) |

**Verwachte waarde (EV) van een affiliatekans:**

```
EV/mnd = uitgaande kliks naar de tool (gemeten, 30 d) × c × r
```

- `c` en `r` komen uit doc 09 §6, tot er gemeten waarden zijn.
- De EV wordt altijd gelabeld als **schatting**, met de invulling erbij.

**Nooit:** ranking, volgorde van aanbevelingen, opname in of uitsluiting uit resultaten, of internelinkmodules die op omzet selecteren. Interne links worden alleen op relevantie en vraag gekozen.

---

## 10. Wat handmatig blijft (eerlijk)

### 10.1 Eenmalig

| Taak | Tijd (schatting) | Waarom niet automatisch | Hoe het systeem helpt |
|---|---|---|---|
| Domein, hosting, database, e-mail-DNS (SPF/DKIM) | 2–4 u | Accounts en betaling op naam | Checklist in Launch readiness met live checks |
| API-sleutels (Anthropic, YouTube, GitHub, e-mail, optioneel Search Console) | 1–2 u | Accounts op naam, voorwaarden accepteren | Het afhankelijkhedenregister valideert elke sleutel |
| Externe heartbeat en uptimemonitor | 15 min | Externe dienst (C5) | Testknop; de URL staat in de config |
| Juridische gegevens + privacyverklaring | 1–2 u (+ advies) | Aansprakelijkheid | Blokkade in Launch readiness zolang ze ontbreken |
| Affiliate-aanmeldingen (top 5–10 op EV) | 10–20 min per programma | Contract, identiteit, belastinggegevens | Gerangschikte lijst met link, disclosure-eisen en EV |

### 10.2 Terugkerend

| Taak | Frequentie | Tijd (schatting) |
|---|---|---|
| Inbox (P1/P2) | Wekelijks | 10–30 min (doel: ≤ 5 items) |
| Weekrapport lezen | Wekelijks | 10 min |
| Steekproefaudit | Maandelijks | 25 min (eerste 3 mnd), daarna 12 min |
| Omzetimport (alleen zonder API) | Maandelijks | ±15 min per netwerk |
| Sponsors en leads afhandelen | Ad hoc | Afhankelijk van volume |
| Btw en boekhouding | Per kwartaal | Buiten het systeem; export van `revenue_entries` helpt |
| Sleutels roteren | Jaarlijks (of bij een incident) | 15 min; herinnering via het register |

**Totaal (schatting):** 1–2 u per week in de eerste 3 maanden, daarna 30–60 min per week. Boekhouding en salesgesprekken zijn niet meegeteld.

**Ter vergelijking, handmatig:** alleen al de prijzen van 101 tools controleren kost ±2 min per pagina, dus ±3,4 u per ronde. Wekelijks gedaan is dat ±14 u per maand. Dat werk verdwijnt volledig.

---

## 11. Kosten van autonomie

| Post | Aanname | Kosten per maand |
|---|---|---|
| Worker/hosting (incl. Playwright voor de render-modus) | Kleine VPS of serverless + cron | €5–20 |
| LLM: prijsextractie | 50–150 calls × ±$0,032 (6.000 tokens in / 600 uit) | ±$1,6–4,8 |
| LLM: classificatie van changelogs en nieuws | ±300 calls × ±$0,006 | ±$1,9 |
| LLM: conceptteksten (alleen gewijzigde tools) | ±40 × ±$0,028 (eenmalig 202 concepten: ±$5,7) | ±$1,1 |
| LLM: samenvatting weekrapport (optioneel) | 4–5 × ±$0,06 | ±$0,3 |
| LLM: Match-intentie (optioneel; met caching en gating: LLM bij ±40% van de Matches) | ±$0,011–0,018 per call | ±$9–14 per 2.000 Matches · ±$45–72 per 10.000 Matches |
| YouTube, GitHub, HN, Search Console, ECB | Binnen gratis quota | €0 |
| Heartbeat en uptime | Gratis instapniveaus | €0 |
| E-mail | Gratis tier tot een volumegrens | €0–20 |

**Rekenbasis:**
- Standaardmodel `claude-opus-5-5`: $4 per miljoen inputtokens, $20 per miljoen outputtokens, cache-reads $0,20 per miljoen.
- De tokenaantallen zijn aannames. Een Match is bijvoorbeeld 2.000 tokens in (waarvan 1.800 uit de cache) en 500 uit, inclusief het denkwerk.
- De echte kosten worden per call gemeten in `llm_usage` en staan wekelijks in het rapport.
- Een goedkoper model kiezen (`ANTHROPIC_MODEL`) is een afweging tussen kwaliteit en kosten, en dus een **keuze van de eigenaar**. Het systeem doet dat niet zelf. Wel toont het de kosten per Match naast de gemeten meerwaarde (§9).

**Economische rechtvaardiging:**
- Zonder Match-LLM kost de autonome operatie ±$5–10 aan API's plus €5–20 aan hosting per maand.
- Alleen al de prijscontroles besparen ±14 uur per maand (§10.2).
- De Match-LLM is het enige onderdeel dat met het verkeer meeschaalt. Daarom is hij optioneel, gegated en gemeten. De lexicale engine werkt altijd.

---

## 12. Bewust níet geautomatiseerd (klasse D)

| Niet | Waarom |
|---|---|
| Autonome outreach naar vendors en sponsors | Tw art. 11.7 en AVG; reputatierisico. Het systeem schrijft wel een concept. |
| Affiliate-aanmeldingen, contracten accepteren | Vereist een rechtspersoon, identiteit en belastinggegevens |
| Massa-artikelen voor SEO | Scaled-content-spambeleid; risico voor het hele domein |
| Rankinggewichten automatisch tunen | Neutraliteit + Omnibus (methodologie openbaar); feedbackloops |
| Reddit-, X- en LinkedIn-data | Kosten, toestemming, voorwaarden |
| Google Trends scrapen | Geen algemeen beschikbare officiële API; strijdig met de voorwaarden |
| Automatische codewijzigingen en deploys | Risico; wél een automatisch issue |
| Automatische juridische reacties | Aansprakelijkheid |
| Sponsorprijzen en -acceptatie | Strategisch en contractueel |
| Generatieve benchmarks (Battle Lab-output) | Kosten, reproduceerbaarheid, benchmarkclausules in voorwaarden |
| "Stopgezet" zonder officiële bron | Reputatieschade voor de vendor |
| Uitbetalingen en facturatie | Financiële administratie; valt buiten de scope van het product |

---

## 13. Implementatie in deze build

| Onderdeel | Implementatie |
|---|---|
| **Inbox** | `review_items` wordt uitgebreid met `severity` (p1/p2/p3), `category`, `reason` ("waarom jij"), `recommendation`, `default_action`, `due_at`, `group_key`, `impact` en `resolution`. Nieuwe soorten: `anomaly_freeze`, `dependency`, `agent_failing`, `opportunity`, `audit_sample`, `security`, `autonomy_proposal`. |
| **Rapporten** | Nieuwe tabel `reports` (soort, periode, data-JSON, samenvatting, verzonden-op) |
| **Afhankelijkheden en gezondheid** | Nieuwe tabel `health_checks` (sleutel, status, laatst ok, laatst gecontroleerd, detail) + register in code |
| **Nieuwe agents** | **Health** (checks, heartbeat, register), **Reporter** (weekrapport), **Audit** (maandelijkse steekproef), **Escalation** (SLA, standaardacties, automatisch sluiten, budget, bundeling; vervangt Editorial), **Opportunity** (SEO- en omzetkansen, readiness, programmadetectie) |
| **Bestaande agents** | Pricing: herhaalbevestiging + anomaliewacht. Broken Link: "niet bereikbaar sinds". Discovery/Verification: quarantainemodus (instelbaar). |
| **Admin** | Overzicht = eigenaarsdashboard (§6). Nieuwe pagina's: Inbox, Rapporten, Automatisering (beleid, autonomieniveaus, grenzen, afhankelijkheden). |
| **Instellingen** | `escalationBudgetPerWeek`, `anomaly.*`, `price.confirmations`, `price.confirmHours`, `newToolMode`, `quarantineDays`, `slaDays`, `llm.gating.{min,max}`, `report.{day,hour,timezone}` |
| **Omgeving** | `OWNER_EMAIL`, `HEARTBEAT_URL`, `REPORT_TIMEZONE`, optioneel `GITHUB_ISSUES_REPO` + `GITHUB_TOKEN` |
| **Tests** | Anomaliewacht, herhaalbevestiging, standaardacties, automatisch sluiten, "onbekend ≠ 0", ruisregel, registerdekking, ranking-onafhankelijkheid |

**Volgorde:** eerst het fundament (fase 1) en het kernproduct, daarna het agentframework met deze beleidslaag, en tot slot dashboard en rapport. De beleidsregels (§4–§5) worden als pure functies gebouwd en getest vóór de agents die ze gebruiken.
