# 00 — Audit van het bestaande plan

**Datum:** 29 september 2026
**Scope:** (1) *Marktanalyse AI-toolvergelijkers (executive summary)* (PDF, 7 p.), (2) *Uitvoerend overzicht* (PDF, 8 p.), (3) de productbrief voor AIToolsWijzer (45 punten).
**Methode:** ik heb elke claim uit de plannen gelezen, de rekensommen nagerekend en de belangrijkste feiten op 29-09-2026 via webonderzoek gecontroleerd. Waar ik geen primaire bron kon inzien, staat dat erbij.

> **Belangrijk voorbehoud.** Beide PDF's zijn door ChatGPT gegenereerd. De bronverwijzingen (`【46†L312-L320】` enz.) zijn interne artefacten van de browse-sessie. Er staan geen URL's bij en je kunt ze niet naslaan. **Elk getal uit de PDF's geldt daarom als onbewezen** tot het opnieuw is geverifieerd. Hieronder staat wat ik heb kunnen verifiëren.

---

## 1. Claimcontrole

| # | Claim in het plan | Wat ik vond (29-09-2026) | Status |
|---|---|---|---|
| C1 | "Een dedicated NL-portaal ontbreekt" (PDF 1) | Er bestaan minstens zes Nederlandstalige AI-toolvergelijkers of -gidsen: [dutchaitools.nl](https://dutchaitools.nl/over/) ("eerlijke scores, actuele prijzen"), [aitoolhub.nl](https://aitoolhub.nl/) ("de grootste gids voor AI-tools in het Nederlands", test NL-output), [wegwijsai.nl](https://wegwijsai.nl/ai-tools-vergelijken/), [softwarekiezer.nl](https://softwarekiezer.nl/gids/welk-ai-tool-past-bij-jou), [aiwijser.nl](https://www.aiwijser.nl/), [aitoolsfinder.nl](https://aitoolsfinder.nl/), plus blogs als [searchlab.nl](https://searchlab.nl/blog/beste-ai-tools-2026) | **Weerlegd** |
| C2 | TAAFT: nieuwsbrief "ruim 1 miljoen abonnees" (PDF 2) | Eigen nieuwsbriefpagina en sponsorprofiel noemen 2,5–2,6 mln lezers ([newsletter.theresanaiforthat.com](https://newsletter.theresanaiforthat.com/), [passionfroot.me/taaft](https://www.passionfroot.me/taaft)) | **Verouderd** (groter dan gedacht) |
| C3 | TAAFT: vermelding €300 per tool | Secundaire bron: featured listing $347 eenmalig ([stackbuilt.co](https://stackbuilt.co/blog/best-ai-tools-directories-2026)) | Ongeveer juist, secundair |
| C4 | Futurepedia: "miljoenen bezoekers", 4.000+ tools, "onafhankelijk" (PDF 1) | Secundaire bron: 5.722 tools en 2,05 mln bezoeken over juni–aug 2025 (≈0,7 mln/maand). Verificatie kost **$497** ([futurepedia.io/verified](https://www.futurepedia.io/verified)). Futurepedia ontvangt vergoeding voor kliks | "Onafhankelijk" is **twijfelachtig**: het model is pay-to-be-verified |
| C5 | Grote spelers = Futurepedia, AI Tools Recap, AI Tools Directory, AI Tool Hunt | TAAFT, Toolify, OpenFuture AI (40.000+ tools volgens [fast.io](https://fast.io/resources/open-future-ai-review-2026/)), Product Hunt en FutureTools ontbreken of worden onderschat | **Onvolledig** |
| C6 | CPC voor "AI tools"-termen €2–5 | Het plan noemt dit zelf "schatting op basis van markttrends". Geen databron | **Onbewezen** |
| C7 | €500/mnd = 10.000 bezoekers × 5% CTR × 2% conversie × €50 commissie (PDF 1) | De rekensom klopt (10 conversies × €50). Maar €50 per conversie is optimistisch. Voorbeelden van werkelijke voorwaarden: ElevenLabs 22% gedurende 12 maanden ([elevenlabs.io/affiliates](https://elevenlabs.io/affiliates)), Synthesia 25% gedurende 12 maanden ([synthesia.io](https://www.synthesia.io/partners/affiliates)), Descript eenmalig. Bij instapplannen van $6–$29 p/m levert een betalende klant **€10–€40 over meerdere maanden** op, uitbetaald na wachtperiodes | **Rekenkundig juist, aannames te optimistisch** |
| C8 | 20k bezoekers × 0,5% affiliateconversie × €10 = "~€100" (PDF 2) | 20.000 × 0,005 × €10 = **€1.000**, niet €100. Een factor 10 fout (of er ontbreekt een klikstap) | **Rekenfout** |
| C9 | "50 affiliate-kliks à €5 commissie = €250" (PDF 2) | Hier worden kliks en conversies verward. Een klik levert bij CPA/CPS-programma's niets op | **Denkfout** |
| C10 | KPI: 1.000 bezoekers in maand 3, €500 omzet in maand 4 (PDF 1) | Volgens het eigen model (C7) zijn daarvoor 10.000 bezoekers nodig: 10× groei in één maand | **Intern inconsistent** |
| C11 | ElasticSearch/Algolia nodig voor performance | Onder de ~10.000 tools volstaan Postgres full-text of een in-memory index ruim. Extra kosten en complexiteit zonder winst | **Overkill** |
| C12 | "Kleinschalige site kan met SEO ±€500/mnd verdienen" | Zoekgedrag is veranderd. Pew meet 8% klikratio bij AI-samenvattingen tegenover 15% zonder, en Ahrefs meet −58% CTR op positie 1 ([ppc.land](https://ppc.land/researchers-find-google-ai-overviews-cut-publisher-clicks-39-8/), [seo-kreativ.de](https://www.seo-kreativ.de/en/blog/google-ai-overviews-updates-2026-en/)). Zero-click is 68% begin 2026 ([searchengineland.com](https://searchengineland.com/google-zero-click-searches-2026-study-479717)) | Mogelijk, maar **veel moeilijker dan het plan veronderstelt** |
| C13 | Programmatic lijstjes ("Beste AI-tools voor [branche] in 2026") als contentmotor | Google trad in maart 2026 (core) en op 18–21 aug 2026 (spam update) op tegen geschaalde, dunne en affiliatecontent. Pagina's met echte, unieke data ("comparison tools with live pricing") overleven ([digitalapplied.com](https://www.digitalapplied.com/blog/programmatic-seo-after-march-2026-surviving-scaled-content-ban), [kurums.com](https://kurums.com/googles-august-2026-spam-update-targeted-scaled-ai-content-what-marketing-teams-must-fix-now/)) | **Hoog risico** in de voorgestelde vorm |

**Conclusie claimcontrole:** de marktanalyse is richtinggevend maar niet betrouwbaar genoeg om beslissingen op te baseren. De belangrijkste premisse (een leeg NL-speelveld) klopt niet meer. De omzetmodellen bevatten een rekenfout, een denkfout en een inconsistente KPI.

---

## 2. Antwoorden op de 12 auditvragen

### 1. Wat is goed?

- **De pijn is goed benoemd:** overload ("duizenden tools") en wantrouwen ("AI-slop", affiliatelijstjes). Dat is het echte probleem, en het wordt groter.
- **Taakgericht zoeken** ("AI-tools voor [doel]") als primaire intentie. Dat sluit aan op de kern van de brief: *"Wat wil je doen?"*
- **Freshness-checks en verouderde data als risico.** Beide PDF's zien dat tools snel verdwijnen of veranderen.
- **Diversificatie van inkomsten.** Het plan herkent dat affiliate alleen kwetsbaar is.
- **De productbrief is sterker dan de PDF's.** Provenance per datapunt, een confidence-beleid voor autonomie, transparantie over betaalde plaatsing, een expliciete *NOT NOW*-lijst en de vraag "wat kunnen wij dat ChatGPT niet kan?" zijn precies de juiste uitgangspunten.

### 2. Wat is naïef?

1. **"Er is geen NL-portaal, dus er is ruimte."** Zie C1: die ruimte is al opgevuld door kleine spelers. Taal alleen is geen moat. Bovendien zoekt een groot deel van de NL-doelgroep in het Engels.
2. **"Traffic komt via SEO."** Een nieuw domein zonder autoriteit concurreert met TAAFT, Futurepedia en G2, op een SERP waar AI Overviews het antwoord al geven.
3. **"Affiliate levert €50 per conversie."** Zie C7. Ernstiger: **de meest gezochte tools hebben geen publiek affiliateprogramma**. Claude heeft er geen ([customgpt.ai](https://customgpt.ai/claude-ai-affiliate-program-alternative/); Anthropic heeft alleen een enterprise partnernetwerk), en voor ChatGPT en Midjourney vond ik er geen. **Het eerlijkste antwoord levert dus vaak €0 op.** Dat creëert een structurele verleiding om te buigen. Die verleiding moet je architectonisch onmogelijk maken, anders is het vertrouwen, en daarmee het product, weg.
4. **"Toolmakers betalen voor een vermelding."** Vendors betalen voor bereik. Zonder verkeer is er geen listing-omzet, en betaalde vermeldingen botsen met een onafhankelijke positionering.
5. **"Gebruikersreviews" in de MVP.** Bij weinig verkeer krijg je lege reviewsecties (erger dan geen), spam en DSA-verplichtingen (notice & action). Het cold-start-probleem wordt nergens geadresseerd.
6. **"AI-gegenereerde beschrijving + menselijke review" als contentmotor.** Dat schaalt niet voor één persoon. En juist die content (generieke beschrijvingen) is waardeloos in een wereld waar ChatGPT hetzelfde in één seconde schrijft.
7. **Viral ideeën zonder link met de kernwaarde:** AR-mascotte, GPT-karaoke, meme-generator, easter-egg-chatbot. Leuk voor een pitch, maar ze leveren geen gebruikerswaarde en geen herbruikbare data op.
8. **90 dagen en 300–400 uur voor een marktleider.** Voor een directory is dat realistisch, voor marktleiderschap niet.

### 3. Welke aannames zijn onbewezen? (en hoe we ze toetsen)

| Aanname | Waarom onzeker | Toets (goedkoop, snel) |
|---|---|---|
| NL'ers willen NL-talig AI-advies | Veel professionals zoeken in het Engels | Aandeel NL- vs EN-queries in de eigen Match-logs; Search Console per locale |
| Mensen willen een *stack*, niet één tool | Mogelijk willen de meesten één antwoord | Klikratio op "stack" vs "losse tool" in resultaten; opslaan/delen-ratio |
| Gebruikers komen terug | Keuzemomenten zijn episodisch | Opt-in-ratio voor Stack Watch-alerts; heropen-ratio van alertmails |
| We kunnen feiten actueler houden dan ChatGPT | Scrapen is broos, LLM-extractie hallucineert | Maandelijkse nauwkeurigheidsaudit: 30 random feiten vs officiële bron |
| Affiliate dekt de kosten | De top-tools betalen niets | Aandeel outbound-kliks naar tools *met* programma; EPC per paginatype |
| Vendors willen betalen (sponsoring, data, leads) | Zonder bereik geen deal | Pas testen bij >10k bezoekers/maand: 10 outreach-mails, meet respons |
| AI-zoekmachines citeren ons | Onbekend of gestructureerde data helpt | Tellen van verwijzingen vanuit chatgpt.com/perplexity.ai in referrer-data |
| Het EU/AVG-perspectief is een koopreden | Aangenomen, niet gemeten | Gebruik van de EU-filter; queries met "AVG/GDPR/EU" |

### 4. Welke functies zijn overbodig (nu)?

Uit de PDF's: AR-mascotte, GPT-karaoke, meme-generator, easter-egg-chatbot, AdSense-banners (ondermijnen vertrouwen en leveren bij laag verkeer "enkele tientallen euro's" op, zegt het plan zelf), ElasticSearch/Algolia, forum/Discord bij launch, gebruikersreviews bij launch, social login, "Tool Awards" met publieksstemmen, een heatmap per land (er is geen data).

Uit de brief, **voor fase 1**: AI Olympics, AI courtroom als losse feature, X/LinkedIn social intelligence (juridisch en financieel onhaalbaar, zie §7), premium- en teamaccounts, een vendor analytics-portal, API/data-verkoop, procurement, de de/fr-locales live zetten zonder vertaalde content, en een Benchmark Lab met gegenereerde output. Alles hiervan staat met reden in de *NOT NOW*-lijst (document 11).

### 5. Welke functies ontbreken?

1. **Bewijs per feit (evidence anchoring).** De brief vraagt om provenance. Ontbrekend detail: sla per feit de **letterlijke bronzin** op (bijv. `"$22/month"` op de officiële prijspagina). Hercontrole wordt dan deterministisch: staat de zin er nog? Dit is de ruggengraat van betrouwbare autonomie.
2. **Het EU/AVG-perspectief:** EU-dataopslag, verwerkersovereenkomst (DPA), training-opt-out, Nederlandse taalondersteuning, prijzen in EUR incl./excl. btw. Dit mist bij de meeste concurrenten en ChatGPT levert het niet systematisch.
3. **Stack-kostenrekening:** de totale maandkosten van een workflow, met gratis tiers en limieten erbij.
4. **Wijzigingsgeschiedenis (Time Machine):** prijs- en featurehistorie die vanaf dag 1 opbouwt. Een concurrent kan die niet achteraf reconstrueren.
5. **Transparantie over rankingparameters.** Dit is een wettelijke plicht (Omnibus-richtlijn / art. 6:193e BW), geen nice-to-have.
6. **AI-transparantie:** sinds 2 augustus 2026 gelden de AI Act art. 50-verplichtingen voor systemen die met mensen interacteren ([Cooley](https://www.cooley.com/news/insight/2026/2026-08-03-eu-ai-act-transparency-obligations-take-effect-2-august-2026), [artificialintelligenceact.eu](https://artificialintelligenceact.eu/article/50/)). Onze Match-assistent moet dat melden.
7. **Correctieproces voor vendors:** gratis "claim & correct" met bewijs. Dat levert betere data en een relatie met vendors op zonder pay-to-rank.
8. **Omzetattributie per pagina:** click-ID → subID → geïmporteerde conversies. Zonder dit is "welke pagina's leveren geld op" niet te beantwoorden.
9. **Indexeerbaarheidspoort:** pagina's worden pas indexeerbaar bij voldoende echte data (bescherming tegen scaled-content-straffen).
10. **Een push-kanaal voor retentie:** alerts en digest, in plaats van hopen dat mensen terugkomen.

### 6. Waar zitten technische risico's?

| Risico | Impact | Mitigatie |
|---|---|---|
| Scrapen is broos (JS-rendering, botbescherming, geo-prijzen, A/B-tests) | Onjuiste of verouderde prijzen | Evidence anchoring + officiële bronnen; Playwright alleen waar nodig; bij twijfel naar de queue, nooit gokken |
| **Netwerkbeperkingen**: deze bouwomgeving blokkeert al uitgaand verkeer naar vendor-sites | Agents kunnen hier niet live verifiëren | Agents zijn getest met lokale fixtures; data draagt eerlijk de status "secundaire bron" tot de agent in productie verifieert |
| LLM-extractie hallucineert | Verzonnen prijzen | **Regel:** een geëxtraheerde waarde telt alleen als die letterlijk in de brontekst staat. Confidence wordt berekend uit bewijs, niet uit wat het LLM over zichzelf zegt |
| Onbegrensde LLM-kosten (misbruik van de zoekbalk) | Kostenexplosie | Rate limits, dagbudget, cache, deterministische fallback-engine |
| Datamodelcomplexiteit (feiten met historie) | Trage queries, bugs | Feiten-tabel met historie + gedenormaliseerde snapshot voor lezen |
| Contentdrift tussen talen | Inconsistente pagina's | Vertaaldekking per locale meten; een locale gaat pas live boven een drempel |
| Serverless-limieten (cron, Playwright) | Agents draaien niet | Agents als losse worker of GitHub Actions; web en agents ontkoppeld |
| Vendor lock-in op één LLM-leverancier | Uitval of prijsstijging | LLM is optioneel; alle kernfuncties hebben een deterministische route |

### 7. Waar zitten juridische risico's?

- **Rankingtransparantie** (Omnibus-richtlijn 2019/2161, art. 6:193e BW, ACM-leidraad): de hoofdparameters van onze ranking en elke betaalde plaatsing moeten zichtbaar zijn.
- **Verborgen reclame** (Reclamecode art. 11, Oneerlijke Handelspraktijken): affiliatelinks en sponsoring moeten herkenbaar zijn.
- **Vergelijkende claims en humor** ("AI Roast"): feitelijk onjuiste of denigrerende uitspraken over een concurrent zijn onrechtmatig (misleidende en vergelijkende reclame, onrechtmatige daad). Humor over vendors alleen na feitencheck, redactionele review en met recht op weerwoord. **Nooit automatisch publiceren.**
- **AI Act art. 50** (sinds 2-8-2026): meld dat gebruikers met een AI-systeem interacteren. AI-gegenereerde publieke tekst zonder redactionele verantwoordelijkheid moet gelabeld worden.
- **AVG:** Match-queries kunnen persoonsgegevens bevatten (namen, e-mails). Daarom PII scrubben, bewaartermijnen hanteren en het doel beperken. E-mail-alerts alleen met double opt-in.
- **Telecommunicatiewet (cookies):** geen trackingcookies. Analytics zonder cookies en zonder opgeslagen IP.
- **Databankenrecht:** het scrapen van andermans directory (TAAFT e.d.) is een inbreuk (sui-generis-databankrecht). Discovery gebruikt alleen officiële en open bronnen.
- **Auteursrecht:** vendorteksten en screenshots niet overnemen. Korte feitelijke citaten (prijsregels) als bewijs, met bronvermelding. Respecteer robots.txt en de TDM-opt-out (art. 4 DSM-richtlijn).
- **Merkenrecht en naam:** "AI-toolwijzer" wordt al gebruikt door [NHL Stenden](https://libguides.nhlstenden.com/aitoolwijzer) en de [NLDA-bibliotheek](https://bibliotheeknlda.libguides.com/AI-toolwijzer/Introductie), en er bestaat [AIwijser.nl](https://www.aiwijser.nl/). Doe een merkcheck (BOIP) vóór de launch.
- **Platformvoorwaarden:** YouTube API (data periodiek verversen, attributie tonen), Reddit (commercieel gebruik alleen na goedkeuring, $0,24 per 1.000 calls, [prowlo.com](https://prowlo.com/blog/reddit-data-api)), X (pay-per-use, ~$0,005 per gelezen post, [postproxy.dev](https://postproxy.dev/blog/x-api-pricing-2026/)).
- **DSA:** zodra gebruikers content plaatsen (reviews) gelden notice-and-action-verplichtingen.

### 8. Waar zitten SEO-risico's?

1. **Scaled content abuse:** automatisch gegenereerde "X vs Y"- en "alternatieven voor X"-pagina's zijn exact het patroon waar Google in maart en augustus 2026 op handhaafde.
2. **Zero-click:** AI Overviews beantwoorden "beste AI-tool voor X" direct.
3. **Nieuw domein:** geen autoriteit en geen backlinks. De concurrentie heeft beide jarenlang opgebouwd.
4. **Klein NL-volume:** het Nederlandse taalgebied is een fractie van het Engelse, en veel NL-professionals zoeken in het Engels.
5. **Meertaligheid:** zonder hreflang en écht gelokaliseerde content ontstaan duplicaten.
6. **Faceted navigation:** filtercombinaties creëren crawl traps. Die moeten op noindex of canonical.
7. **E-E-A-T:** er is geen aantoonbare ervaring. Vandaar methodologie, bronnen, auteur/redactie en een correctielog.

**Kans:** AI-zoekmachines hebben actuele, gestructureerde feiten met bron en datum nodig. Precies dat is ons product. Daarom leveren we JSON-LD, een publiek data-endpoint, `llms.txt` en `dateModified` per feit.

### 9. Waar zitten monetisatierisico's?

- De meest gevraagde tools betalen niets (§2.3). Daardoor ontstaat een incentive-conflict.
- Commissies zijn klein, lopen over meerdere maanden en gaan pas in na wachtperiodes. Uitbetaaldrempels veroorzaken 30–90 dagen cashvertraging.
- Affiliatenetwerken keuren sites zonder verkeer af.
- Er is geen zicht op conversies zonder subID-rapportage of import.
- Adblockers blokkeren bekende affiliatedomeinen; een eigen `/go/`-redirect helpt.
- Betaalde vermeldingen en AdSense ondermijnen de kern (vertrouwen).
- Koersrisico en btw bij USD-commissies.

### 10. Waar kunnen concurrenten dit eenvoudig kopiëren?

| Onderdeel | Kopieerbaar in | Toelichting |
|---|---|---|
| Directory met filters | dagen | Bestaat duizendvoudig |
| Taakgericht zoeken | bestaat al | TAAFT's kernfeature is zoeken op taak |
| LLM-"matchmaker" | weken | Elke concurrent kan een LLM-zoekbalk toevoegen |
| Humor, design | weken | Stijl is imiteerbaar |
| **Historische prijs- en wijzigingsdata** | **niet** | Tijd valt niet in te halen |
| **Bewijs per feit (evidence) + correctielog** | maanden–jaren | Vergt een pipeline en discipline |
| **Geanonimiseerde intentie→keuze-data** | niet zonder ons verkeer | Netwerkeffect |
| **Opgeslagen stacks + alertrelatie (e-mail)** | niet | Directe relatie met de gebruiker |
| **Geen pay-to-rank (counter-positioning)** | lastig voor incumbents | Zij verdienen aan betaalde listings ($347–$497). Kopiëren kost hun omzet |

### 11. Wat brengt een gebruiker dagelijks of maandelijks terug?

Eerlijk antwoord: **dagelijks bijna niemand**, behalve AI-enthousiastelingen (Pulse en nieuwsbrief). Keuzemomenten zijn episodisch. Terugkeer ontstaat door:

1. **Stack Watch (maandelijks, push):** "Je betaalt sinds deze maand 25% meer voor tool X" of "Er is een gratis alternatief dat 2 van je 3 tools vervangt". Relevant, persoonlijk en onderbouwd met bewijs.
2. **Nieuwe keuzemomenten (episodisch):** een nieuwe taak leidt tot een nieuwe Match. Onthoud de context (budget, EU-eis, taal).
3. **Pulse en nieuwsbrief (wekelijks):** alleen echte, gedetecteerde wijzigingen, geen herkauwd nieuws.

Het product wordt daarom ontworpen op **push (alerts)**, niet op hopen dat mensen terugkomen.

### 12. Waarom AIToolsWijzer in plaats van Google, ChatGPT, Claude, Perplexity, Reddit, YouTube of bestaande directories?

| Alternatief | Sterk in | Zwak in | Ons antwoord |
|---|---|---|---|
| Google | Breedte | SERP vol affiliatelijstjes; AI Overview generiek | Eén antwoord op jouw taak, met bewijs en kosten |
| ChatGPT / Claude / Gemini | Gesprek, uitleg | Prijzen en limieten vaak verouderd of gegokt; geen historie; geen monitoring; bronnen wisselend | **Geverifieerde feiten met datum en bron**, kostenrekening, historie, alerts |
| Perplexity | Bronnen, actualiteit | Citeert vaak dezelfde SEO-lijstjes; geen gestructureerde vergelijking | Primaire bronnen (officiële prijspagina) en gestructureerde data |
| Reddit | Echte ervaringen | Versnipperd, anekdotisch, verouderd | We tonen community-signalen apart gelabeld, nooit als waarheid |
| YouTube | Demo's | Tijdrovend, vaak gesponsord | Gecureerde video's per tool, gelabeld (officieel, review, tutorial) |
| TAAFT, Futurepedia e.d. | Omvang | Betaalde listings, weinig verificatie, geen stacks, geen EU-lens | Geen pay-to-rank, bewijs per feit, stacks, Doctor, Watch |
| NL-gidsen (dutchaitools, aitoolhub…) | NL-taal | Kleine databases, blog-karakter, handmatig | Taakgerichte stacks, automatische verificatie, historie |

**Kernzin:** *ChatGPT weet veel over AI-tools. AIToolsWijzer weet wat er vandaag klopt, bewijst het, rekent het uit en houdt het voor je in de gaten.*

---

## 3. Beslissingen die uit deze audit volgen

1. **Positionering:** geen "grootste directory" maar de *betrouwbaarste beslislaag*. De voorkeur gaat uit naar diepte (100–200 tools, grondig) boven breedte (5.000, oppervlakkig).
2. **Geen pay-to-rank, ooit.** Ranking en monetisatie zijn in de code gescheiden, en een test bewaakt dat.
3. **Evidence anchoring** is het kerndatamodel. Elk getoond feit heeft een status (VERIFIED, SUPPORTED, COMMUNITY of UNVERIFIED), een bron en een datum.
4. **EU/AVG-lens** als onderscheidend kenmerk voor NL/DE/FR.
5. **Push-retentie** via Stack Watch en de digest, vanaf de MVP.
6. **Realistische omzetscenario's** (document 09): €500/maand is in het basisscenario haalbaar rond maand 11 (niet in maand 4), en niet alleen via affiliate. In het conservatieve scenario lukt het niet binnen 18 maanden zonder B2B-inkomsten.
7. **nl + en tegelijk live.** De/fr zijn architectonisch klaar, maar gaan pas live bij voldoende vertaalde content.
8. **Merkcheck** op "AIToolsWijzer" vóór de launch, vanwege de naamverwarring met AI-toolwijzer en AIwijser.
