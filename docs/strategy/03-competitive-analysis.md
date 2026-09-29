# 03 — Competitive analysis

**Peildatum:** 29-09-2026. Cijfers komen uit publiek beschikbare bronnen; *secundair* betekent dat het getal uit een derde partij komt en niet uit de primaire bron. De featurevergelijking is gebaseerd op publieke beschrijvingen, niet op een uitputtende hands-on test. Dat moet vóór de launch handmatig worden nagelopen (checklist onderaan).

## 1. Het speelveld in vijf segmenten

| Segment | Spelers | Wat ze de gebruiker bieden | Verdienmodel |
|---|---|---|---|
| **Mega-directories (EN)** | There's An AI For That (TAAFT), Futurepedia, Toolify, OpenFuture AI, AIxploria | Breedte: 5.000–40.000+ tools, zoeken op taak (TAAFT), trending-lijsten | Betaalde listings ($347 TAAFT, $497 verificatie Futurepedia), sponsoring, affiliate, nieuwsbriefadvertenties |
| **Curators en media** | FutureTools (Matt Wolfe), The Rundown, nieuwsbrieven | Selectie, nieuws, YouTube | Sponsoring, affiliate |
| **Softwarereviewplatforms** | G2, Capterra, Product Hunt | Reviews, B2B-vergelijking, lanceringen | Vendor-abonnementen, leads, PPC |
| **NL-gidsen** | dutchaitools.nl, aitoolhub.nl, wegwijsai.nl, softwarekiezer.nl, aiwijser.nl, aitoolsfinder.nl, aitool.nl, searchlab.nl (blog) | NL-taal, lijstjes, scores, "test NL-output" (aitoolhub) | Affiliate, leadgen voor diensten |
| **AI-assistenten** | ChatGPT, Claude, Gemini, Perplexity, Copilot | Gespreksadvies op maat | Abonnement |

## 2. Profielen (kern)

### There's An AI For That (TAAFT)
- **Schaal:** de grootste AI-directory qua verkeer (secundair). Nieuwsbrief met 2,5–2,6 mln lezers ([eigen pagina](https://newsletter.theresanaiforthat.com/)).
- **Sterk:** zoeken op taak ("there's an AI for that"), enorme database, merkbekendheid.
- **Zwak:** betaalde featured listings ($347, secundair: [stackbuilt.co](https://stackbuilt.co/blog/best-ai-tools-directories-2026)) maken neutraliteit ongeloofwaardig. Geen zichtbare provenance per feit, geen stack-kostenrekening, geen EU-lens.
- **Wat we leren:** taakgericht zoeken is geen onderscheid meer, het is *table stakes*.

### Futurepedia
- **Schaal:** 5.722 tools, 2,05 mln bezoeken over juni–aug 2025 (secundair). Educatie en cursussen.
- **Model:** verificatie $497 ([futurepedia.io/verified](https://www.futurepedia.io/verified)), vergoeding voor kliks.
- **Zwak:** "geverifieerd" is een betaald product, geen datastatus. Dat is een betekenisverwarring waar wij tegenover kunnen staan: bij ons betekent VERIFIED "bevestigd op de officiële bron", en dat is niet te koop.

### Toolify, OpenFuture AI, AIxploria
- **Sterk:** volume (OpenFuture 40.000+ tools volgens [fast.io](https://fast.io/resources/open-future-ai-review-2026/)), trending-rankings.
- **Zwak:** automatisch verzamelde, ongeverifieerde data. Kwantiteit is daar het product.

### FutureTools en nieuwsbrieven
- **Sterk:** persoonlijkheid, video, vertrouwen in de curator.
- **Zwak:** geen gestructureerde beslishulp; content veroudert.

### G2, Capterra, Product Hunt
- **Sterk:** reviews, B2B-kopers, autoriteit.
- **Zwak:** traag voor AI (nieuwe tools ontbreken), reviews zijn duur te verkrijgen, vendors betalen voor zichtbaarheid.
- **Relevant voor ons:** ons B2B-segment (mkb dat een AI-stack kiest) overlapt met G2-kopers. Wij winnen op snelheid, taakgerichtheid en EU-lens, niet op reviewvolume.

### Nederlandse gidsen
- dutchaitools.nl ("eerlijke scores, actuele prijzen en duidelijke verdicts"), aitoolhub.nl (test NL-output, beschikbaarheid in NL/BE), wegwijsai.nl (voor mensen die "geen expert willen worden"), softwarekiezer.nl ("welk AI-tool past bij jou"), aiwijser.nl (tool + prompt per taak).
- **Sterk:** taal, lokale toon, eerste SEO-posities op NL-termen.
- **Zwak (op basis van publieke beschrijvingen):** redactioneel handwerk, beperkte databases, blog/lijstjes-karakter, geen zichtbare automatische verificatie of historie.
- **Wat we leren:** "NL-taal" en "eerlijke scores" claimen ze al. Wij moeten *laten zien* wat zij *zeggen*: bewijs per feit, datum, historie.

### AI-assistenten (ChatGPT, Claude, Perplexity, Gemini)
- **Sterk:** conversatie, context, gratis, de gebruiker zit er al.
- **Zwak:** prijzen en limieten zijn vaak verouderd of gegokt; er is geen historie, geen monitoring en geen consistent EU-perspectief; ze citeren dezelfde affiliatelijstjes.
- **Strategie:** niet bevechten maar **bevoorraden**. Wij willen de bron zijn die zij citeren (gestructureerde data, publiek endpoint, `llms.txt`). Verkeer dat via AI-zoekmachines binnenkomt, meten we apart.

## 3. Featurematrix (publieke beschrijvingen, te verifiëren)

| Capability | TAAFT | Futurepedia | Toolify / OpenFuture | G2 | NL-gidsen | ChatGPT/Perplexity | **AIToolsWijzer** |
|---|---|---|---|---|---|---|---|
| Zoeken op taak | ✅ | ◐ | ◐ | ✗ | ◐ | ✅ | ✅ |
| Stack/workflow met meerdere tools | ✗ | ✗ | ✗ | ✗ | ✗ | ◐ (tekst) | ✅ gestructureerd |
| Totale stackkosten | ✗ | ✗ | ✗ | ✗ | ✗ | ◐ (onbetrouwbaar) | ✅ met bron |
| Diagnose van de huidige stack | ✗ | ✗ | ✗ | ✗ | ✗ | ◐ | ✅ Doctor |
| Bron + datum per feit | ✗ | ✗ | ✗ | ◐ | ✗ | ◐ (links) | ✅ per feit, met status |
| Prijshistorie | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✅ vanaf dag 1 |
| Wijzigingsalerts op eigen stack | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✅ |
| EU/AVG-lens | ✗ | ✗ | ✗ | ◐ | ◐ | ✗ | ✅ |
| Rankingmethodologie openbaar | ? | ? | ? | ◐ | ? | ✗ | ✅ |
| Pay-to-rank uitgesloten | ✗ (featured) | ✗ (verified) | ✗ | ✗ | ? | n.v.t. | ✅ (architectuur + test) |
| Schaal (aantal tools) | ●●●●● | ●●●● | ●●●●● | ●●●● | ●● | n.v.t. | ●● (bewust) |

✅ = aanwezig · ◐ = gedeeltelijk · ✗ = niet gevonden · ? = onbekend

## 4. White space

Niemand combineert:
1. **taak → stack → kosten**,
2. **bewijs per feit met status en datum**,
3. **historie en monitoring**, en
4. **een EU/AVG-lens**,

onder een **no-pay-to-rank**-belofte. Dat is de positie van AIToolsWijzer.

## 5. Moat-analyse (7 Powers)

| Power | Toepasbaar? | Hoe |
|---|---|---|
| **Counter-positioning** | ✅ sterk | Incumbents verdienen aan betaalde listings en verificatie ($347–$497). "Geen pay-to-rank" overnemen kost hen direct omzet |
| **Cornered resource** | ✅ groeit | Historische tijdreeksen (prijzen, features, wijzigingen) + bewijsarchief. Tijd valt niet te kopen |
| **Netwerkeffect (data)** | ◐ op termijn | Geanonimiseerde intentie → keuze ("wie X wil, kiest vaak Y"), stack-co-occurrence ("bedrijven zoals jij gebruiken…") |
| **Switching costs** | ◐ | Opgeslagen stacks + alerthistorie |
| **Brand** | ◐ op termijn | "Met bonnetje" als merkbelofte: betrouwbaarheid die je kunt controleren |
| Scale economies | ✗ | Niet relevant in fase 1 |
| Process power | ◐ | Een agent-pipeline met evidence anchoring is maanden werk om goed te krijgen |

## 6. Wat concurrenten morgen kunnen kopiëren, en waarom het dan nog werkt

| Als ze kopiëren… | …dan blijft ons voordeel |
|---|---|
| Een LLM-zoekbalk | Onze antwoorden rusten op gestructureerde, geverifieerde feiten met historie. Een LLM-balk op een ongeverifieerde database erft die onbetrouwbaarheid |
| Stack builder | Zonder kostendata met bron wordt het een lijstje. Zonder Watch is het eenmalig |
| Het design en de "bonnetjes"-stijl | Een bonnetje zonder echte bron is een leugen die gebruikers doorprikken |
| Onze claims ("geverifieerd") | Hun verdienmodel (betaalde verificatie) weerspreekt het |

## 7. Validatiechecklist vóór de launch (handmatig)

- [ ] Van TAAFT, Futurepedia, Toolify, dutchaitools.nl, aitoolhub.nl en softwarekiezer.nl nagaan of ze stacks, historie, EU-lens en rankingmethodologie tonen (screenshots in `docs/research/`).
- [ ] Verkeersinschattingen via een gelicenseerde bron (Similarweb/Semrush) als budget beschikbaar is.
- [ ] Merkcheck "AIToolsWijzer" in het BOIP-register.
- [ ] Zoekvolume NL vs EN voor 30 taakqueries (Keyword Planner of Search Console na launch).
