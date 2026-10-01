# 01 · Markt- en concurrentieanalyse AIToolsWijzer.nl

*Marktanalist · 30 sep 2026. Bronnen staan als [n] genummerd onderaan. "(inschatting)" en "~" = mijn eigen afleiding, dus niet uit een bron. Beperkingen: tweakers.net en independer.nl kon ik niet direct doorzoeken (geblokkeerd), dus daar gebruik ik secundaire bronnen. Het gedeelde zoekbudget van 200 zoekopdrachten is op. Cijfers over onze eigen data komen uit een telling van `data/tools/*.json` en uit de code.*

## Samenvatting

1. **De markt bestaat uit vier blokken.** (a) Volumedirectories: TAAFT met 53.932 tools, Toolify met 23.000–27.000, TopAI.tools met 23.487 en Futurepedia met 4.000+. Ze verdienen aan betaalde plaatsing [1][3][12][14][6]. (b) B2B-reviewplatforms: G2 koopt Capterra, GetApp en Software Advice (samen ≈6 mln reviews, jan 2026) [22]. (c) Modeldata voor ontwikkelaars: Artificial Analysis, Arena, OpenRouter en Epoch [30][35][40][43]. (d) Een nieuwe **"bonnetjes"-niche**: CostBench (1.465 tools, dagelijkse agent, publieke prijs-changelog) [45], ComparEdge (prijzen met bronpagina, gratis API/MCP) [46] en daarnaast SaaS Price Pulse, PriceWorld en AI SaaS Showdown [48–51].
2. **"Met bron" is niet meer uniek.** Wat nog wél uniek is: niemand combineert Nederlandstalig + taak→stap→stack + status per feit + prijstijdlijn + EU-lens + Stack Doctor + een getoetste regel dat geld de volgorde niet verandert.
3. **Nederland heeft geen echte AI-toolvergelijker.** RankmyAI (HvA, non-profit) rangschikt op verkeer, investeringen en reviews [52]. Umely heeft ±100 tools en een keuzetest [53]. Searchlab schrijft artikelen [54]. Consumentenbond, Frankwatching, Emerce en Computable publiceren tests, lijstjes en nieuws, maar geen vergelijkingsdata [55][57–59].
4. **Onze grootste gaten ten opzichte van de markt:** echte logo's en beeld, grafieken, rekenhulpen, alerts en digest, vergelijken van meer dan 2 tools, en vooral **data** over EU, privacy en Nederlands. De velden staan in het schema, maar zijn leeg: `supports_dutch` 4/101, `eu_data_residency` 1/101, `gdpr_dpa` 0, `trains_on_user_data` 0.
5. **Waar gebruikers last van hebben (met bewijs):**
   - Credits maken kosten onvoorspelbaar. Het aantal bedrijven met een creditmodel steeg van 35 naar 79 van de 500 in 2025, en Cursor bood in juli 2025 excuses aan [64][65].
   - Abonnementen stapelen zich op: in een Amerikaanse enquête betaalt men $66/mnd voor ±4 AI-abonnementen, en 54% noemt dat "afzetterij" [66].
   - Privacy: 6 van de 6 grote aanbieders trainen standaard op chats [67], en 85% van de Nederlanders maakt zich zorgen over privacy [69].
   - Taal: Otter ondersteunt geen Nederlands [71].
6. **Waar de novelty zit:** eenheidsprijzen in euro's ("€ per uur transcriptie", "wat kost het voor míjn gebruik"), de werkelijkheid achter gratis plannen, krimpflatie (17% van 1.800 SaaS-wijzigingen in 2025 ging over limieten [64]), en kompassen voor Nederlands en privacy. Nederlandse overheids-DPIA's kunnen daarbij als bonnetje dienen [68].
7. **Modelbenchmarks zijn voor ontwikkelaars.** Niemand legt uit welk model ín een consumententool zit (inschatting). Bij ons is `model_dependencies` gevuld voor 1 van de 101 tools.
8. **Top-tier sites hebben één signatuurvisual:** het G2 Grid [21], de intelligentie-vs-prijsgrafiek van AA [32], het tokenaandeel van OpenRouter [40], de prijsgrafiek van Tweakers [60] en de predicaten van de Consumentenbond [56]. Wij hebben er geen. **Het bonnetje kan die rol krijgen.**
9. **Nederlandse vergelijkers hebben een vertrouwensprobleem.** Independer is sinds 2011 grotendeels van Achmea en kreeg kritiek dat provisie de top 3 bepaalt (bronnen uit 2011–2013) [62]. Onze regel "geld verandert nooit de volgorde" verdient een zichtbaar keurmerk. Op de screenshots is die nu nauwelijks zichtbaar (inschatting).
10. **Risico:** bijna elke novelty vraagt om genormaliseerde limieten en nieuwe feittypes. Nu staan limieten als vrije tekst in 230 van de 328 plannen, en maar 44 plannen noemen uren of minuten. Begin daarom met deelverzamelingen en toon "onbekend". Nooit schatten.

## Concurrenten

**A. Grote AI-directories**

| Speler | Kern en manier van vergelijken | Vertrouwen en versheid | Verdienmodel | Uniek | Zwakte |
|---|---|---|---|---|---|
| There's An AI For That | 53.932 tools en 10.796 taken; Job Impact Index voor 5.000+ beroepen [1][2] | Community-ratings. De lijst "most saved" is volgens TAAFT zelf te manipuleren door "cheaters" [4] | Betaalde lancering of featured plek; nieuwsbrief met 2,5–2,8 mln lezers [3] | Taken en beroepen gekoppeld aan tools | Ruis, micro-tools, reviewmanipulatie [5] |
| Futurepedia | 4.000+ tools; toolpagina met prijsmodel, startprijs, voor- en nadelen en rating [6][8] | "Verified"-badge [7] | Badge kost $497 eenmalig, "Enhanced" levert klikken [7]; nieuwsbrief 280k+ [9]; zustermerken Skill Leap en Howfinity [6] (cursussen: inschatting) | Combinatie van onderwijs en directory | De badge is betaald; volgens concurrent ToolJunction geen echte vs-functie, maar bronnen spreken elkaar tegen [10] |
| Toolify | 23.000–27.000 tools (bronnen verschillen), gerangschikt op bezoek (SimilarWeb), omzet en regio [11][12] | Populariteit als signaal | $99 om voorrang te krijgen, plus advertenties [13] | Ranglijsten op omzet en verkeer | Populair ≠ geschikt; omzetmethode onbekend [11] |
| TopAI.tools | 23.487 tools; AI-zoeken, "compare", filter op prijsmodel, deals [14] | Dagelijkse updates [14] | Fast Track $39, Boosted $229 [15] | Deals | Weinig diepgang (inschatting) |
| Product Hunt | Lanceringen, reviews, nieuwe Alternatives-pagina's met tools naast elkaar [16] | Upvotes | Advertenties, producten met label "PROMOTED" [17] | Dynamiek van de lanceringsdag | Hype boven bruikbaarheid (inschatting) |
| AlternativeTo | Crowdsourced alternatieven; filters op licentie, platform en **EU-herkomst** [18] | Likes, reacties | Advertenties, geen betaalde ranking [19] | EU-filter | Geen diepgang in prijzen of limieten (inschatting) |

**B. B2B-reviewplatforms**

| Speler | Kern | Vertrouwen | Verdienmodel | Uniek | Zwakte |
|---|---|---|---|---|---|
| G2 (+Capterra, GetApp, Software Advice) | Geverifieerde reviews. G2 Grid (tevredenheid × marktaanwezigheid) en badges; Capterra Shortlist en vergelijkingen met startprijs en gratis proef; G2.ai als gesprek [20][21][25][27] | Reviews worden geverifieerd; cadeaubon-incentives moeten gemeld worden [23] | Koopintentiedata voor vendors ($10k–87k+/jaar) [24]; bij Capterra betaalt de vendor per klik, gesponsorde plekken zijn gelabeld [26] | ≈6 mln reviews in 2.000 categorieën [22]; **Capterra.nl is Nederlandstalig** [28] | Gericht op B2B; limieten van consumententools ontbreken (inschatting) |
| SaaSworthy | "SW Score": features, ratings, aanwezigheid op web en social, groeisnelheid; relatief per categorie [29] | Gedateerde pagina's | Niet gevonden | Label "Rising Star" [29] | Mengt populariteit en kwaliteit |

**C. Modeldata**

| Speler | Kern | Vertrouwen | Verdienmodel | Uniek | Zwakte |
|---|---|---|---|---|---|
| Artificial Analysis | Intelligence Index, snelheid en tokenprijs; ook spraak-naar-tekst ($/1.000 min + foutpercentage), video en stem [30][34]; **aparte pagina voor consumentenchatbots** (plannen, features, privacy, grafieken) [32]; calculator voor LLM-prijzen [33] | Eigen metingen met methodologie [30] | Pro $417/mnd per seat, Data-API [31] | Prijs × prestatie, gemeten | Engelstalig en gericht op ontwikkelaars |
| Arena (heet sinds 28-1-2026 niet meer LMArena) | Blinde stemmen → ranglijst. Hub met nieuwe modellen, top-10 per categorie, filters op prijs en context, video [35][37]; Agent Arena met taakkosten en Pareto-lijn [36] | Miljoenen stemmen, open dataset [37] | Betaalde evaluaties; $30 mln run-rate, waardering $1,7 mld [38] | Menselijke voorkeur als maatstaf | Kritiek "Leaderboard Illusion" [39] |
| OpenRouter | Ranglijsten van tokens per model, app en use-case; latency en uptime per provider [40][41] | Echte gebruiksdata [42] | Vergoeding bij aankoop van credits [41] | Laat zien wat ontwikkelaars echt gebruiken | Alleen API-verkeer |
| Epoch AI | 3.600+ modellen, benchmarkhub, trends; CSV onder CC-BY [43] | Eigen evaluaties | (inschatting: onderzoeksorganisatie) | Analyses van prijsdalingen (9–900× per jaar) [44] | Niet bedoeld om een tool te kiezen |

**D. De bonnetjes-niche (directe concurrenten van onze belofte)**

| Speler | Wat | Zwakte |
|---|---|---|
| CostBench | 1.465 tools; een agent haalt dagelijks prijzen opnieuw op; publieke changelog (sept 2026: 74 producten, 37 verhogingen); prijsgeschiedenis, alerts en een wekelijkse digest [45] | Engelstalig; geen taakstack, geen NL, geen EU-lens (inschatting) |
| ComparEdge | 490+ tools; prijs met datum en bronpagina, TCO; gratis API + MCP "Price Watch" met menselijke goedkeuring [46] | Idem |
| ToolJunction | 190+ gescoorde oordelen die ook zeggen waar een tool slecht in is; gelabelde plaatsing; workflows met echte kosten [10][47] | Klein |
| AI SaaS Showdown | 10 chatbots; 2–4 naast elkaar, 30+ plannen, compliance-matrix, quiz, changelog "What Changed"; alles draait in de browser [48] | Alleen chatbots |
| pricepertoken / SaaS Price Pulse / PriceWorld | Abonnement vs. API [49]; snapshots van prijspagina's met visuele diff en alerts ($19/mnd) [50]; gedateerd prijsregister van 8 consumententools [51] | Smal |

**E. Nederland en België**

| Speler | Wat | Zwakte |
|---|---|---|
| RankmyAI | 56.000+ tools; maandelijkse ranglijst, ook een top 100 van NL; op basis van verkeer, reviews en investeringen; non-profit van de HvA [52] | Alleen populariteit, geen prijs of limiet |
| Umely.ai | ±100 tools in 17 categorieën; keuzetest, prijzen, video's, naast elkaar [53] | Klein |
| Searchlab | Vergelijkingsartikelen zoals ChatGPT vs Claude vs Gemini (17-3-2026) [54] | Statisch; noemt al verouderde modellen (inschatting) |
| Consumentenbond | Noemt Le Chat een bruikbaar Europees alternatief; privacygids; vindt dat aanbieders niet op gebruikersdata mogen trainen [55]; predicaten Beste uit de Test, Beste Koop en Afrader [56] | Geen doorlopende AI-data |
| Frankwatching / Emerce / Computable | Lijstjes zoals de "100 populairste AI-tools" [57]; naamsbekendheid ChatGPT 65%, Gemini 32% [58]; keuzecriteria voor bedrijven, waaronder datalocatie en GreenPT [59] | Geen vergelijkingsdata |

**F. Nederlandse vergelijkers als UX-benchmark:**
- **Tweakers Pricewatch:** prijsgrafiek, 742.000 prijsalerts, een eigen team dat specificaties aanvult, diepe filters, updates per kwartier [60].
- **Kieskeurig:** prijshistorie, filter "Laagste prijs ooit", prijsalarm, keurmerk "Best Reviewed" [61].
- **Independer:** klantcijfers (bijv. 8,2), sorteren op prijs-kwaliteit; eerdere kritiek op het eigendom van Achmea en op provisie [62].
- **Pricewise:** vergelijkt energie, verzekeringen en telecom en heeft een overstapservice [63].

## Feature-gapmatrix

✔ ja · ◐ deels · ✘ nee · ? onbekend · ~ inschatting. De kolom Wij komt uit onze code en data; de andere kolommen uit de bronnen in de vorige sectie.

| Feature | Wij | TAAFT | Futurep. | Toolify | G2/Capterra | AltTo | Art. Analysis | Arena | CostBench |
|---|---|---|---|---|---|---|---|---|---|
| Echte logo's | ✘ monogram | ✔~ | ✔~ | ✔~ | ✔~ | ✔~ | ✔~ | ✔~ | ? |
| Screenshots | ✘ | ✔~ | ✔~ | ✔~ | ✔~ | ✔~ | – | – | ? |
| Gebruikersreviews | ✘ bewust | ✔ | ✔ | ◐~ | ✔ | ✔ | ✘ | ◐ stemmen | ✘~ |
| Gemeten of redactionele score | ◐ geen cijfer | ✘ | ◐ | ✘ | ◐ algoritme | ✘ | ✔ | ✔ | ✘~ |
| Bron + datum + status per feit | ✔ | ✘~ | ✘~ | ✘~ | ◐ | ✘~ | ◐ | ◐ | ◐ |
| Actuele prijsplannen | ✔ | ◐~ | ✔ | ◐~ | ◐ | ◐ | ✔ | ◐ | ✔ |
| Prijsgeschiedenis | ◐ weinig data (2 oude prijzen, 16 events) | ✘~ | ✘~ | ✘~ | ✘~ | ✘~ | ? | ✘~ | ✔ |
| Alerts of digest | ◐ Pulse + /api/v1/changes | ✘~ | ✘~ | ✘~ | ✘~ | ✘~ | ? | ✘~ | ✔ |
| Kostencalculator op gebruik | ✘ | ✘~ | ✘~ | ✘~ | ✘~ | ✘~ | ◐ alleen API | ✘~ | ◐ |
| Naast elkaar vergelijken | ◐ 2 tools | ? | ? | ? | ✔ | ◐~ | ✔ | ◐ | ✔ |
| "Alternatieven voor X" | ✔ | ✔~ | ✔ | ✔~ | ✔~ | ✔ | ◐~ | ✘ | ? |
| EU- en privacy-info | ◐ lens zonder data | ✘~ | ◐ [82] | ✘~ | ◐~ | ◐ EU-filter | ◐ | ✘ | ◐ |
| Werkt het in het Nederlands? | ◐ 4/101 | ✘~ | ✘~ | ✘~ | ✘~ | ✘~ | ✘~ | ? | ✘~ |
| Advies op taak of doel | ✔ 46 taken | ✔ | ◐ | ◐ | ◐ G2.ai | ✘ | ✘ | ◐ | ✘~ |
| Stacks en workflows | ✔ | ✘~ | ◐ | ✘~ | ✘~ | ✘~ | ✘ | ✘ | ✘~ |
| Eigen stack doorlichten | ✔ Doctor | ✘~ | ✘~ | ✘~ | ◐ G2 Track [24] | ✘~ | ✘ | ✘ | ✘~ |
| Nieuwsbrief | ◐ code staat uit op de statische site | ✔ | ✔ | ? | ? | ? | ? | ? | ✔ |
| Open data of API | ✔ JSON + llms.txt | ✘~ | ✘~ | ✘~ | ◐ betaald | ✘~ | ✔ betaald | ✔ | ? |
| Ranglijsten en benchmarks | ✘ | ◐ populariteit | ✘ | ◐ verkeer | ◐ Grid | ◐ likes | ✔ | ✔ | ✘ |
| Grafieken | ◐ prijsgrafiek | ✘~ | ✘~ | ◐~ | ✔ | ✘~ | ✔ | ✔~ | ◐~ |
| Personalisatie | ◐ niveau + vraagvak | ◐ | ◐ | ◐ | ◐ | ✘~ | ◐ | ◐ | ◐ |
| Community | ✘ | ✔ | ◐ | ◐ | ✔ | ✔ | ✘ | ✔ | ✘~ |
| Geld verandert de volgorde niet | ✔ getest | ✘ | ◐ | ✘ | ◐ | ✔ | ✔~ | ◐ | ? |
| Versheid per item zichtbaar | ✔ | ◐ | ◐ | ◐ | ◐ | ✘~ | ✔ | ✔ | ✔ |
| Nederlandstalig | ✔ | ✘~ | ✘~ | ✘~ | ◐ Capterra.nl | ✘~ | ✘~ (wel ES/PT/DE [31]) | ✘~ | ✘~ |

## Unieke vergelijkingen (gerangschikt)

"Data nu" is gecontroleerd in `data/tools` en `schema.ts`. Effort: S = klein, M = middel, L = groot.

| # | Idee | Wat en waarom (bewijs) | Data nu | Effort | Risico |
|---|---|---|---|---|---|
| 1 | **"Wat kost het voor mij?"** | Je vult uren audio, minuten video, aantal beelden of seats in en ziet €/maand per tool: het goedkoopste plan dat past, jaar tegenover maand, ECB-koers, elk getal met een bonnetje. Waarom: credits zijn onbegrijpelijk [64][65]. AA doet dit alleen voor API-tokens [33] | Limieten staan als vrije tekst in 230/328 plannen; 44 noemen uren of minuten (transcriptie, audio, video). Nodig: nieuwe velden `quotaAmount`, `quotaUnit` en `overage` | M | Credits nooit zelf omrekenen; zonder conversie van de maker tonen we "niet te berekenen" |
| 2 | **Prijs per uitkomst** | Bijv. "€ per uur transcriptie" of "€ per minuut avatarvideo", per taak gerangschikt. AA doet dit alleen voor spraak-naar-tekst-API's [34]; voor consumentenplannen vond ik niets (inschatting). Voorbeelden uit onze data: Amberscript €10 per audio-uur, Happy Scribe 6.000 min, Synthesia 30 min | Dezelfde deelverzameling als #1 | S na #1 | "Onbeperkt" en fair use apart tonen |
| 3 | **Wat krijg je echt gratis?** | Per gratis plan: hoeveel, watermerk, commercieel gebruik, exportkwaliteit, creditcard nodig. Een checklist, geen score. "Gratis" is een topintentie (ons eigen voorbeeld: "gratis notuleren") | 77 gratis plannen, 61 met limiettekst; watermerk bekend bij 10 tools, commercieel gebruik bij 3 | S–M | Onbekend is niet hetzelfde als nee |
| 4 | **Privacy- en EU-kompas** | Vijf checks per tool én per plan: traint op je data, EU-hosting, verwerkersovereenkomst, land van het bedrijf, status van de Nederlandse DPIA. Bewijs: 6/6 aanbieders trainen standaard op chats [67]; 85% privacyzorg [69]; de DPIA op M365 Copilot vond 4 hoge risico's, die inmiddels deels verlaagd zijn [68] | Velden bestaan maar zijn gevuld voor 1, 0 en 0 tools; bedrijfsland 85/101 | M–L | Juridische nuance; alleen primaire bronnen gebruiken; Incogni hooguit als secundaire bron [70] |
| 5 | **Nederlands-kompas** | Nederlandse interface, invoer en uitvoer (spraak, samenvatting), Vlaams. Voor LLM's linken we naar EuroEval en de Amsterdamse "Grip on LLMs" [72][73]. Bewijs: Otter kan geen Nederlands [71]; GPT-NL wordt in H2 2026 breder beschikbaar [74] | `supports_dutch` 4/101 | M | Geen eigen kwaliteitscijfer; wel onderscheid tussen "volgens maker" en "getest door [bron]" |
| 6 | **Krimpflatiemonitor** | Signaleert minder minuten of credits, geschrapte plannen en kleinere gratis limieten, en toont de eenheidsprijs door de tijd. Bewijs: 17% van 1.800 wijzigingen ging over limieten; Lovable wijzigde ongeveer maandelijks [64] | Er is geen event-type `quota_change`; snapshots bewaren alleen een hash | M | Vals-positieven; een mens controleert (needs_human) |
| 7 | **Abonnementsrekening (Doctor 2.0)** | Overlap per functie in €/maand, bundels en de besparing bij jaarbetaling. Bewijs uit de VS: $66/mnd, 54% vindt het "afzetterij" [66] | Capabilities ✔, jaarprijs bekend bij 152 plannen | S | Zelfde functie betekent niet zelfde kwaliteit |
| 8 | **Taakkosten** | Per taak (46) wat het per maand kost bij licht, gemiddeld en zwaar gebruik, per stackvariant. TAAFT koppelt taken wel aan tools maar niet aan kosten [1] | Taken ✔, limieten deels | M | Gebruiksprofielen labelen als aanname |
| 9 | **EU-alternatief-wissel** | Per Amerikaanse tool: Europese tools met dezelfde functies, % overlap en prijsverschil. EU-directories matchen niet op functie of prijs (inschatting) [80]. Nederlanders tonen interesse [81] | ≈22 Europese bedrijven, capabilities ✔ | S | "EU-bedrijf" is niet hetzelfde als "EU-hosting" |
| 10 | **AI-prijsindex NL** | Een vast mandje in euro's, maandelijks. API-prijzen dalen 10× per jaar [78][44]; ondertussen ontstaat een budgetlaag van $4,99 en $8 [79] | Historie loopt pas vanaf sept 2026 | M | Pas publiceren na ≥3 maanden meten |
| 11 | **Overstapmeter** | Export, import van geheugen (Claude, Gemini) [75], jaarcontract, vervallende credits. Onder de EU Data Act zijn overstapkosten vanaf 12-1-2027 verboden [76] | Geen velden | M | Beginnen met de top 20 |
| 12 | **Onder de motorkap** | Welk model zit in de tool, met een link naar de scores bij AA en Arena. Bruggen tussen tool- en modelniveau ontbreken (inschatting) | `model_dependencies` 1/101 | M | Modellen wisselen vaak; datum verplicht |
| 13 | **Abonnement of per gebruik betalen?** | Voor Advanced. Een abonnement van $200 is volgens SemiAnalysis $8.000–14.000 aan API-waarde [77]; pricepertoken vergelijkt dit al [49] | Geen API-prijzen in onze catalogus | M | Limieten zijn vaak geheim |
| 14 | **Beroepstoolkits** | 5 beroepen met hun taken, de goedkoopste stack die aan de privacy-eisen voldoet en de verplichtingen. TAAFT meet alleen de impact op beroepen [2]; slechts 5% van de basisscholen heeft AI-beleid [83] | Taken ✔, `audience` ✔, privacydata ✘ | M | Geen verzonnen behoeften |
| 15 | **Betrouwbaarheidsmeter per bonnetje** | % VERIFIED, aandeel officiële bronnen, leeftijd van de data. Maakt ons verschil met CostBench en ComparEdge zichtbaar [45][46] | ✔ | S | Laat ook zien hoeveel we op secundaire bronnen leunen; eerlijk |

## Visuele benchmark

**Wat top-tier maakt.** Het oordeel is een inschatting; de feiten hebben een bron.

- **Artificial Analysis:** één vraag per grafiek, bijvoorbeeld intelligentie × prijs of intelligentie × features, ook voor consumentenchatbots [32], met de methodologie ernaast [30].
- **Arena:** een modulaire hub met bovenaan wat nieuw is, een top-10 per categorie, prijs en prestatie, en video [37].
- **OpenRouter:** het tokenaandeel door de tijd vertelt het verhaal in één beeld [40].
- **Epoch:** "data insights" van één grafiek, een korte tekst en een download onder CC-BY [43][44].
- **G2:** het Grid en de badges zijn een eigen object dat vendors zelf verspreiden [21].
- **Tweakers en Kieskeurig:** prijsgrafiek, alert en "laagste prijs ooit". Dicht, maar vertrouwd [60][61].
- **Consumentenbond:** predicaten als visuele afkorting van een weging [56].
- **Minder sterk:** TAAFT, Toolify en TopAI zijn lange lijsten vol badges en betaalde plekken, en kiezen voor kwantiteit boven helderheid [5][13].

**Patronen voor een Nederlands merk dat vertrouwen wil uitstralen en op bonnetjes draait:**

1. **Het bonnetje als signatuur.** Een kassabonkaart in Plex Mono met geperforeerde rand, datum- en statusstempel, te openen vanaf elk getal en te delen als OG-afbeelding. Nu zijn de statuslabels kleine formulierchips ("ONDERST.") (screenshot).
2. **Echte logo's**, zelf gehost (de CSP staat het eigen domein toe), met het monogram als terugval.
3. **Sparkline in elke prijscel** en een markering "laagste sinds meting", alleen waar we historie hebben.
4. **Scatter "prijs per uitkomst" per taak**, met een Pareto-lijn en alleen genormaliseerde eenheden.
5. **Berekende predicaten in plaats van winnaars:** "Goedkoopst voor jouw gebruik", "Echt bruikbaar gratis", "EU-gehost (bron)", "Werkt in het Nederlands". Elk heeft een bonnetje.
6. **Het verschil dat telt:** alleen de rijen die verschillen, met 2–4 kolommen (zoals [48]).
7. **Onafhankelijkheid als keurmerk:** een vast blokje "Geld verandert de volgorde niet, getest op [datum]", als contrast met de kritiek op Independer [62].
8. **Pulse als datajournalistiek:** elke wijziging krijgt een minigrafiek van oud naar nieuw, met de bron.
9. **Dichtheid per niveau:** Basis toont kaarten met drie feiten; Advanced een dichte tabel zoals bij Tweakers.
10. **Emoji vervangen** door één zelf gehoste iconenset (dit overlapt met de design-audit).

## Bronnen

[1] https://theresanaiforthat.com/ · https://theresanaiforthat.com/tasks/
[2] https://theresanaiforthat.com/job-impact/
[3] https://theresanaiforthat.com/get-featured/ · https://theresanaiforthat.com/launch/
[4] https://theresanaiforthat.com/most-saved/ · https://theresanaiforthat.com/leaderboard/
[5] https://aiindigo.com/blog/navigating-the-ai-maze-a-2026-review-of-there-s-an-ai-for-that
[6] https://www.futurepedia.io/
[7] https://www.futurepedia.io/verified · https://www.futurepedia.io/enhanced
[8] https://www.futurepedia.io/tool/perplexity-ai
[9] https://newsletter.futurepedia.io/
[10] https://www.tooljunction.io/vs/futurepedia
[11] https://www.toolify.ai/Best-AI-Tools-revenue
[12] https://www.cutout.pro/learn/toolify-ai-directory/ · https://apify.com/solidcode/toolify-ai-scraper
[13] https://www.tooljunction.io/vs/toolify
[14] https://topai.tools/
[15] https://sharedcontext.ai/skills/external/sales-skills/sales-topai
[16] https://www.producthunt.com/changes
[17] https://fourweekmba.com/how-does-product-hunt-make-money/
[18] https://alternativeto.net/software/jan-ai/ · https://alternativeto.net/software/chatgpt/
[19] https://www.stork.ai/en/alternativeto
[20] https://www.g2.com/categories/ai-chatbots
[21] https://sell.g2.com/g2-scoring-methodologies · https://documentation.g2.com/docs/es/g2-badges
[22] https://company.g2.com/news/g2-acquires-capterra-software-advice-getapp
[23] https://sell.g2.com/resources/review-campaign-incentives
[24] https://komo.ai/glossary/g2-intent-data · https://vizologi.com/business-strategy-canvas/g2-business-model-canvas/
[25] https://company.g2.com/news/g2-launches-conversational-software-review-experiences-for-ai-first-era
[26] https://www.capterra.com/resources/how-we-ensure-transparency · https://en.wikipedia.org/wiki/Capterra
[27] https://www.capterra.com/resources/proprietary-data-research/ · https://www.capterra.com/compare/
[28] https://www.capterra.nl/llms.txt
[29] https://www.saasworthy.com/sw-score-methodology
[30] https://artificialanalysis.ai/models · https://artificialanalysis.ai/methodology
[31] https://artificialanalysis.ai/pricing · https://artificialanalysis.ai/data-api · https://artificialanalysis.ai/es/pricing · https://artificialanalysis.ai/pt/pricing
[32] https://artificialanalysis.ai/agents/chatbots
[33] https://artificialanalysis.ai/tools/llm-price-calculator
[34] https://artificialanalysis.ai/speech-to-text
[35] https://en.wikipedia.org/wiki/Arena_(AI_platform) · https://arena.ai/blog/new-beta/
[36] https://arena.ai/company/product-changelog/
[37] https://alphasignal.ai/news/lm-arena-merges-12-ai-leaderboards-into-one-free-dashboard · https://arena.ai/blog/arena-leaderboard-dataset/
[38] https://pulse2.com/lmarena-150-million-at-1-7-billion-valuation-raised-to-expand-real-world-ai-evaluation
[39] https://layerlens.ai/reports/the-great-ai-benchmark-mirage-thoughts-and-controversy-about-the-leaderboard-illusion-paper
[40] https://openrouter.ai/rankings
[41] https://openrouter.ai/docs/faq · https://openrouter.ai/models
[42] https://openrouter.ai/assets/State-of-AI.pdf
[43] https://epoch.ai/data · https://epoch.ai/benchmarks/about
[44] https://epoch.ai/data-insights/llm-inference-price-trends
[45] https://www.costbench.com/ · https://www.costbench.com/changelog/ · https://costbench.com/changelog/month/2026-09/
[46] https://mcpservers.org/servers/comparedge/pricing-api
[47] https://www.tooljunction.io/vs · https://www.tooljunction.io/list-your-product
[48] https://www.aguidetocloud.com/ai-showdown/
[49] https://pricepertoken.com/subscriptions
[50] https://saaspricepulse.com/ · https://www.saaspricepulse.com/pricing
[51] https://priceworld.com/ai-costs/
[52] https://www.rankmyai.com/methodology · https://www.amsterdamuas.com/projects/2023/10/rankmyai · https://www.rankmyai.com/maps/dutch-ai-ecosystem-map
[53] https://www.eu-startups.com/directory/umely-ai/
[54] https://searchlab.nl/vergelijken/chatgpt-vs-claude-vs-gemini
[55] https://www.consumentenbond.nl/kunstmatige-intelligentie/ai-antwoordmachines · https://www.consumentenbond.nl/digitaalgids/digitaalgids-uitgelicht/voorkom-dat-ai-meeleest
[56] https://www.consumentenbond.nl/over-ons/wie-zijn-we/logo-beste-koop-en-beste-uit-de-test
[57] https://www.frankwatching.com/archive/2024/09/11/populairste-ai-tools-2024/ · https://www.frankwatching.com/tag/ai-tools/
[58] https://www.emerce.nl/nieuws/chatgpt-blijft-bekendst-gemini-groeit-snelst-naamsbekendheid
[59] https://www.computable.nl/2026/09/30/een-model-voor-elk/
[60] https://dpgmedia.h5mag.com/2022-en/pricewatch
[61] https://id.nl/huis-en-entertainment/beeld-en-geluid/tv/laagste-prijs-ooit-check-het-met-de-prijshistorie-van-kieskeurig-nl · https://www.telecompaper.com/news/kieskeurig-introduceert-keurmerk-best-reviewed--598509
[62] https://skipr.nl/nieuws/client-waardeert-kleine-zorgverzekeraars-het-hoogst · https://nos.nl/l/203832 · https://radar.avrotros.nl/artikel/vergelijkingssites-1635
[63] https://pricewise.nl/blog/hoe-onafhankelijk-een-vergelijkingswebsite-handen-van-een-verzekeraar
[64] https://www.growthunhinged.com/p/2025-state-of-saas-pricing-changes
[65] https://flexprice.io/blog/cursor-pricing-guide · https://www.saaspricepulse.com/blog/cursor-pricing-history
[66] https://www.newscaststudio.com/2025/11/19/ai-subscription-costs-outpace-streaming-for-many-u-s-consumers
[67] https://news.stanford.edu/stories/2025/10/ai-chatbot-privacy-concerns-risks-research · https://cyberlaw.stanford.edu/publications/user-privacy-and-large-language-models-an-analysis-of-frontier-developers-privacy-policies
[68] https://www.binnenlandsbestuur.nl/digitaal/rijk-en-microsoft-overleg-over-veiliger-gebruik-copilot · https://www.dutchitchannel.nl/news/688045/gemeenten-ontvangen-geactualiseerd-advies-over-microsoft-copilot
[69] https://assets.kpmg.com/content/dam/kpmg/nl/pdf/2025/ai-vertrouwensmonitor-2025.pdf · https://privacy-web.nl/en/nieuws/cbs-slechts-23-procent-van-nederlanders-gebruikt-generatieve-ai-2
[70] https://blog.incogni.com/gen-ai-llm-privacy-ranking-2026/ · https://blog.incogni.com/ai-llm-privacy-ranking-2025/
[71] https://subanana.com/nl/blog/otter-alternatieven · https://www.sally.io/blog/otter-ai-in-dutch
[72] https://arxiv.org/pdf/2608.09925
[73] https://arxiv.org/pdf/2304.00906
[74] https://www.dutchitchannel.nl/news/725960/nederlands-taalmodel-gpt-nl-bij-eerste-gebruikers-getest
[75] https://pcworld.com/article/3076376/claude-can-now-import-chat-histories-from-chatgpt-and-other-ais.html · https://macrumors.com/2026/03/26/gemini-import-tool
[76] https://www.cloudmagazin.com/en/2026/07/06/eu-data-act-when-cloud-switching-fees-are-abolished-what-cios-need-to-examine/ · https://www.deloittelegal.de/dl/en/services/legal/perspectives/cloud-switching-eu-data-act.html
[77] https://pasqualepillitteri.it/en/news/4793/semianalysis-token-value-claude-chatgpt-plans
[78] https://www.a16z.com/llmflation-llm-inference-cost
[79] https://www.eweek.com/news/ai-pricing-cheat-sheet-2026/ · https://www.notebookcheck.net/What-AI-subscriptions-cost-in-2026-and-which-one-is-worth-it.1341432.0.html
[80] https://eualternative.eu · https://peerpush.com/p/only-eu-kceo
[81] https://radar.avrotros.nl/artikel/lechat-de-franse-ai-die-zich-losmaakt-van-amerika-maar-hoe-veilig-is-het-echt-61454 · https://www.vrt.be/vrtnws/nl/2026/02/06/europesetech/ · https://ioplus.nl/nl/posts/handelsoorlog-5-europese-tech-alternatieven-om-te-overwegen
[82] https://aiindigo.com/blog/navigating-the-ai-chaos-a-2026-review-of-futurepedia
[83] https://www.kennisnet.nl/app/uploads/Kennisnet-lanceert-toolkit-over-gebruik-AI.pdf
