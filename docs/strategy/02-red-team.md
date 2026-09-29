# 02 — Red-team review

**Opdracht aan mezelf:** probeer AIToolsWijzer kapot te maken. Elke aanval is geformuleerd zoals een sceptische investeerder, concurrent, Google-engineer of advocaat hem zou brengen. Per aanval staan de schade, of de aanval standhoudt, en het besluit.

Legenda voor het oordeel: 🔴 fataal als we niets doen · 🟠 ernstig · 🟡 beheersbaar.

---

## A1 🔴 "ChatGPT met browsing doet dit gratis, in één zin."

**Aanval:** *"Welke AI-tools heb ik nodig om social-media-video's te maken?"* Stel die vraag aan ChatGPT, Claude of Perplexity en je krijgt een redelijk antwoord met vijf tools. Waarom zou iemand naar een website gaan?

**Houdt stand?** Ja, voor *generiek advies*. Een "AI-matchmaker" die alleen tekst genereert, is een slechtere ChatGPT.

**Besluit:** we concurreren **niet op advies, maar op feiten, rekenwerk en tijd**:
1. **Correctheid op details** waar LLM's falen: prijs per plan, gratis limieten, watermerken, commercieel gebruik, EU-dataopslag, Nederlandse taalondersteuning. Elk feit heeft een bron, datum en status.
2. **Rekenwerk:** de totale stackkosten per maand, overlap tussen tools, besparing.
3. **Tijd:** historie ("was 6 maanden geleden 30% goedkoper") en monitoring ("we laten het weten als het verandert").
4. **Meetbaar maken:** maandelijkse nauwkeurigheidsaudit (30 willekeurige feiten tegen de officiële bron). Scoren we niet structureel beter dan een LLM met browsing, **dan hebben we geen product**. Dat is een expliciet kill-criterium in document 11.

## A2 🟠 "Nederlandstalig is geen moat: er zijn al zes NL-sites."

**Aanval:** dutchaitools.nl, aitoolhub.nl, wegwijsai.nl, softwarekiezer.nl, aiwijser.nl en aitoolsfinder.nl bestaan al. Jij bent nummer zeven.

**Houdt stand?** Ja. Taal is een distributievoordeel, geen verdedigbare positie.

**Besluit:** taal is een *laag*, niet de *propositie*. Het onderscheid zit in (1) taakgerichte stacks met kostenrekening, (2) bewijs per feit en automatische verificatie, (3) de EU/AVG-lens, (4) historie en alerts. De architectuur is vanaf dag 1 meertalig (nl + en live), zodat we niet vastzitten in een klein taalgebied.

## A3 🔴 "Niemand komt terug naar een directory."

**Aanval:** je hebt eens per kwartaal een nieuwe tool nodig. Daarna vergeet je de site. De CAC is hoog en de LTV laag.

**Houdt stand?** Ja, voor pull-gedrag.

**Besluit:** retentie via **push**:
- **Stack Watch:** sla je stack op (zonder account) en ontvang alleen een mail als er iets relevants verandert (prijs, limiet, stopzetting, beter alternatief). Double opt-in.
- **Pulse:** een wekelijkse digest van *gedetecteerde* wijzigingen, geen herkauwd nieuws.
- **Meten:** opt-in-ratio en heropen-ratio zijn MVP-KPI's. Onder de 3% opt-in na 1.000 Matches heroverwegen we het retentiemodel.

## A4 🔴 "Je beste antwoord levert €0 op, dus je gaat buigen."

**Aanval:** Claude, ChatGPT en Midjourney hebben geen publiek affiliateprogramma. De tools *met* een programma krijgen stiekem een duwtje. Zo is elke directory geëindigd.

**Houdt stand?** Het is het grootste integriteitsrisico van het concept.

**Besluit (architectuur, niet alleen beleid):**
- De **ranking-module importeert geen monetisatiedata**. Een geautomatiseerde test controleert dat resultaten identiek blijven met en zonder affiliatelinks.
- Betaalde plaatsing bestaat alleen in **gelabelde slots** ("Gesponsord") buiten de organische resultaten.
- Rankingparameters staan openbaar op `/methodologie` (dat is ook een wettelijke plicht).
- Waar een tool een affiliatelink heeft, staat dat erbij: "We kunnen commissie ontvangen. Dit beïnvloedt de volgorde niet."

## A5 🔴 "Autonome agents gaan onzin publiceren."

**Aanval:** LLM's hallucineren prijzen, pagina's veranderen van structuur en een verkeerde "prijsverhoging" naar duizenden mensen mailen is reputatieschade. "95% confidence" van een LLM betekent niets.

**Houdt stand?** Ja, als confidence uit LLM-zelfrapportage komt.

**Besluit:**
- **Evidence anchoring:** een feit bestaat uit waarde, bron-URL en *letterlijke bronzin*. Een geëxtraheerde prijs die niet letterlijk in de brontekst voorkomt, wordt verworpen.
- **Confidence = functie van bewijs:** brontype (officieel > documentatie > media > community), overeenstemming tussen bronnen, verankering (zin aanwezig), sanity checks (prijs > 0, jaar ≥ maand, sprong < 300%) en leeftijd.
- **Drempels configureerbaar** (standaard ≥95 auto, 80–94 auto + markering, 60–79 queue, <60 mens). **Prijsverhogingen van meer dan 50% en stopzettingen gaan altijd naar een mens.**
- Elke autonome actie staat in een auditlog: agent, bron, oud → nieuw, confidence, beslissing, tijd.

## A6 🟠 "Je data is op dag 1 al niet geverifieerd: je kunt niet eens scrapen."

**Aanval:** de bouwomgeving blokkeert uitgaand verkeer naar vendor-sites. Je seeddata komt uit secundaire bronnen. Hoe verkoop je dan "betrouwbaar"?

**Houdt stand?** Gedeeltelijk. Het is waar en het moet zichtbaar zijn.

**Besluit:** eerlijk labelen. Seedprijzen krijgen status **SUPPORTED** (meerdere secundaire bronnen) of **UNVERIFIED**, met bron en datum, nooit VERIFIED. Zodra de Pricing Agent in productie de officiële pagina bereikt en de bronzin vindt, promoveert het feit automatisch naar **VERIFIED**. De UI toont bij twijfel "Prijs volgens secundaire bronnen (29-09-2026), nog niet bevestigd op de officiële site". Die eerlijkheid is zelf een onderscheidend kenmerk.

## A7 🔴 "Google gaat je programmatic pagina's afstraffen."

**Aanval:** "X vs Y" × 150 tools geeft 11.000 dunne pagina's. Dat is precies waar de spam-update van 18–21 augustus 2026 op mikte.

**Houdt stand?** Ja, als we pagina's genereren omdat het kan.

**Besluit:** een **indexeerbaarheidspoort** per paginatype. Een vergelijking wordt pas geïndexeerd als beide tools minstens één primaire capability delen, beide geverifieerde of ondersteunde prijzen hebben en er minimaal N onderscheidende feiten zijn. De rest is `noindex` (wel bruikbaar voor gebruikers) of wordt helemaal niet gerenderd. De sitemap bevat alleen poortwaardige pagina's. Liever 300 sterke pagina's dan 30.000 zwakke.

## A8 🟠 "AI Overviews eten je kliks op."

**Aanval:** zero-click is 68%. Zelfs op positie 1 krijg je weinig verkeer.

**Houdt stand?** Ja, voor informationele queries.

**Besluit:**
1. **Word de geciteerde bron.** Levert gestructureerde, actuele feiten (JSON-LD `SoftwareApplication` + `Offer` met `dateModified`, een publiek JSON-endpoint, `llms.txt`). AI-systemen zoeken daar juist naar.
2. **Richt je op de interacties die een AI Overview niet kan leveren:** stack bouwen, Doctor, vergelijken, opslaan en alerts. Die kun je niet in een SERP doen.
3. **Eigen kanalen:** nieuwsbrief, deelbare "bonnetjes", vendor-badges als backlinks.

## A9 🟠 "€500 per maand in maand 4 is fantasie."

**Aanval:** het plan zelf rekent met 10.000 bezoekers maar verwacht er in maand 3 1.000.

**Houdt stand?** Ja (zie audit C7–C10).

**Besluit:** in document 09 staan drie scenario's met expliciete aannames. Het basisscenario haalt €500 rond maand 11, met een mix van affiliate (mid-tail SaaS met programma's), newsletter-sponsoring (vanaf ~2.000 abonnees) en B2B-leads ("AI-stackadvies voor mkb"). Het dashboard vergelijkt de werkelijkheid met het scenario, zodat we sturen op feiten.

## A10 🟠 "Vendors gaan niet betalen voor een site zonder verkeer."

**Houdt stand?** Ja.

**Besluit:** geen listing fees. Wel een **gratis vendorcorrectieproces** (feiten corrigeren met bewijs). Dat verbetert de data, bouwt een relatie op en levert later sponsor- en datapartners op. Betaalde producten (gelabelde sponsoring, vendor-analytics) pas bij aantoonbaar bereik.

## A11 🟠 "Humor over echte bedrijven is een rechtszaak die wacht."

**Aanval:** "We tested that claim. Your marketing department can relax." Als dat niet aantoonbaar is, is het misleidend en denigrerend.

**Besluit:**
- Humor over **je eigen stack** ("Roast my stack") is veilig en deelbaar.
- Humor over **vendorclaims** alleen in het format *Claim → Bonnetje*: een letterlijke claim met bron, onze feitelijke bevinding met bron, redactionele review, geen automatische publicatie, recht op weerwoord en een correctielog.
- Microcopy-humor (lege staten, laden, 404) raakt niemand.

## A12 🟡 "'Wijzer' werkt internationaal niet en botst met AI-toolwijzer en AIwijser."

**Besluit:** merkcheck vóór de launch. De merknaam is per locale configureerbaar (`siteName` in de config), zodat een internationale merknaam later geen codewijziging vergt.

## A13 🟠 "Het Battle Lab is duur, subjectief en niet reproduceerbaar."

**Aanval:** generatieve output is niet-deterministisch. Wie bepaalt welke video "beter" is? En gebruik je Claude om Claude te beoordelen?

**Besluit:** MVP = **Fair Fights op feiten** (prijs, limieten, platforms, API, EU, integraties) met een uitkomst per criterium en "Kies X als… / kies Y als…", zonder totaalwinnaar. Het Lab met gegenereerde output komt later, met gepubliceerde prompts, versies, seeds en ruwe output, en met blinde paarsgewijze menselijke stemmen. Nooit een LLM-rechter van dezelfde leverancier als een deelnemer, en voorwaarden (benchmarkclausules) eerst juridisch checken.

## A14 🟠 "Social intelligence is juridisch en financieel onhaalbaar."

**Aanval:** Reddit vereist goedkeuring en $0,24 per 1.000 calls voor commercieel gebruik. X kost per gelezen post. LinkedIn is dicht.

**Besluit:** de MVP gebruikt alleen **gratis en toegestane** bronnen: GitHub API (sterren, releases), Hacker News (Algolia API), YouTube Data API (quota) en RSS/changelogs van vendors. Reddit en X staan op de NOT NOW-lijst tot er budget en goedkeuring is. Social data wordt altijd gelabeld als *Community*, nooit als feit.

## A15 🟠 "De LLM-kosten lopen weg; iemand spamt je zoekbalk."

**Besluit:** rate limits per IP (per minuut en per dag), een globaal dagbudget voor LLM-calls, caching van identieke queries, en automatisch terugvallen op de deterministische engine. Die fallback is zichtbaar voor de gebruiker ("begrepen via trefwoordanalyse").

## A16 🟠 "Eén persoon kan geen review-queue van 500 items per nacht bijhouden."

**Besluit:** diepte boven breedte (100–200 tools), queue-prioritering (impact × onzekerheid), batchgoedkeuring, en een autonomieniveau dat per agent instelbaar is. De queue-omvang is een zichtbare KPI in Admin: groeit hij structureel, dan is de dekking te breed.

## A17 🟡 "'Knowledge graph' is een buzzword."

**Besluit:** alleen relaties die het product *gebruikt*: tool ↔ capability (Match, Doctor), taak ↔ stappen ↔ capabilities (workflows), tool ↔ tool (alternatief, integreert-met, draait-op-model), tool ↔ bron ↔ feit (bewijs). Geen graph-database: Postgres met relatietabellen volstaat ruim.

## A18 🟡 "Accounts zijn frictie."

**Besluit:** de MVP heeft geen gebruikersaccounts. Een stack opslaan geeft een deelbare link en een privé-bewerklink (cookie). Alerts lopen via e-mail met double opt-in. Accounts komen pas als er een reden is (teams).

## A19 🟠 "Vier talen × content is onderhoudbaar noch te betalen."

**Besluit:** nl + en live. De/fr zijn in de architectuur aanwezig (routing, berichten, datamodel), maar een locale gaat pas live boven een ingestelde vertaaldekking (standaard 90% van de UI-strings en 80% van de gepubliceerde tools). Zo ontstaan geen halfvertaalde pagina's.

## A20 🟡 "Een interactieve, geanimeerde site wordt traag."

**Besluit:** server components by default, minimale client-JS, geen animatiebibliotheken, CSS-motion met `prefers-reduced-motion`, performancebudget (LCP < 2,5 s, CLS < 0,1, JS per route < 120 kB gzip) en een Lighthouse-check in de testsuite.

## A21 🟠 "De confidence-drempels van de brief laten 60–79% in de queue hangen. Dan is alle secundaire seeddata onzichtbaar."

**Besluit:** de drempels bepalen wat een agent *autonoom* mag. Een redacteur (mens, of bij de initiële import de gelogde seed-actie) kan expliciet publiceren, mét zichtbaar statuslabel. Autonomie en zichtbaarheid zijn twee verschillende dingen.

---

## Wat overleeft, wat sneuvelt

**Overleeft (en wordt de kern):**
- Taak → stack met kosten ("Match")
- Stack-diagnose ("Doctor")
- Monitoring en alerts ("Watch" + "Pulse")
- Bewijs per feit ("Bonnetjes")
- Historie ("Time Machine")
- Feitelijke vergelijkingen ("Fair Fights")
- EU/AVG-lens
- Geen pay-to-rank

**Sneuvelt of wordt uitgesteld:**
- Directory van 5.000 kaarten
- Listing fees en AdSense
- Gebruikersreviews bij launch
- AR-mascotte, karaoke, meme-generator
- Reddit/X-data
- Battle Lab met gegenereerde output
- Premium-accounts
- Losse de/fr-launch

**Het eindoordeel van het red team:** het concept is verdedigbaar **als en alleen als** we het strijdtoneel verleggen van "advies" (waar LLM's winnen) naar "geverifieerde feiten + rekenwerk + tijd" (waar LLM's structureel zwak zijn). Elke featurebeslissing wordt aan die zin getoetst.
