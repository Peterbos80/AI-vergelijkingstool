# 06 · Taal en eenvoud: audit en stijlgids

*2 okt 2026. Agent B5, Eenvoud-redacteur. Basis: alle bezoekersteksten in `src/i18n/messages/{nl,en,de,fr}.json`, de componenten in `src/` en de live-build. Maatstaf: een slimme 14-jarige begrijpt elke tekst in één keer.*

## 1. Samenvatting

- **474 van de 1.241 bezoekerssleutels** zijn herschreven, in het Nederlands en het Engels. Dezelfde sleutels zijn ook in het Duits en Frans vereenvoudigd.
- **Het menu** is nu: Alle tools · Vergelijk · Check je tools · Wat is nieuw · Uitleg. In het Engels: All tools · Compare · Check your tools · What's new · Learn. Het blijven vijf items, en ze passen op 1024 px.
- **Geen vakwoorden meer** in menu's, titels, intro's, knoppen en meldingen. Weg zijn onder meer stack, agents, criterium, Pulse, Stack Doctor, Fair Fight, Match, Advanced, affiliate, versheid en gelogd.
- **Een automatische bewaker** (`tests/unit/plain-language.test.ts`) houdt dit vast. Op de oude teksten vindt hij 95 overtredingen, op de nieuwe 0.
- **Kortere zinnen.** Gemeten over alle intro's en meldingen:

  | | Gemiddeld (woorden per zin) | Langste zin | Zinnen boven 15 woorden |
  |---|---|---|---|
  | nl, voor | 8,4 | 22 | 13 |
  | nl, na | 8,0 | 17 | 6 |
  | en, voor | 8,5 | 23 | 11 |
  | en, na | 8,0 | 18 | 4 |

- **Alleen tekst.** Geen sleutels hernoemd of verwijderd. Geen routes, CSS of layout veranderd. In de code zijn alleen teksten aangepast: de algemene 404 haalt zijn woorden nu uit de berichten, en een paar losse teksten kregen de nieuwe namen (§5).

## 2. Stijlgids (vaste regels)

Deze regels gelden voor elke tekst die een bezoeker ziet. De bewaker test regel 1, 2 en 4 automatisch. Regel 3 en 5 tot en met 9 controleert de redactie.

1. **Korte zinnen.** Gemiddeld 12 woorden of minder, nooit meer dan 20. Eén gedachte per zin.
2. **Gewone woorden.** Schrijf zoals je tegen een slimme 14-jarige praat.
   - Geen vakjargon: stack, agent, provenance, LLM, API, workflow, use case, criterium, capability, quota, plan-tier, integratie.
   - Geen Engels in de Nederlandse tekst: Advanced, Pulse, Doctor, Fair Fights, Match.
   - Kun je een woord niet missen? Leg het dan in dezelfde zin uit, bijvoorbeeld "API (voor ontwikkelaars)".
3. **Zeg wat de bezoeker krijgt of moet doen.** Gebruik werkwoorden en "je". Wel: "Vergelijk twee tools." Niet: "Vergelijkingsfunctionaliteit".
4. **Menu-items hebben 1 tot 3 woorden** en zeggen wat je daar vindt. Dat geldt ook voor korte labels in drukke plekken: de weergaveknop, statuslabels in toolrijen, filters en "+ Vergelijk".
5. **Knoppen beginnen met een werkwoord**: "Laat de tools zien", "Zoek tools", "Check mijn tools", "Toon tools".
6. **Lege staten en meldingen** zeggen wat er is, wat je kunt doen en waarom. Geen interne termen zoals agent, pipeline of queue. Voorbeeld: "We vonden geen tools die hierbij passen. Haal een paar filters weg."
7. **Cijfers en status in gewone taal.**
   - "Onderbouwd" blijft een vast merkwoord, maar altijd met uitleg erbij: "Er staat een bron bij: meerdere bronnen zeggen hetzelfde, of de officiële site noemt het."
   - "Onbevestigd" wordt "Nog niet gecontroleerd".
8. **De technische weergave** mag vakwoorden houden (API, integraties, zelf hosten), want die is voor ontwikkelaars. De Basis-weergave en alle menu's zijn eenvoudig.
9. **Niet veranderen:**
   - de betekenis van juridische teksten (privacy, hoe we geld verdienen);
   - feiten met een bron, namen van tools, URL's, routes en i18n-sleutels.

   Geen nieuwe beloftes, en geen verzonnen cijfers.

### Vaste woorden

Gebruik overal hetzelfde woord, zodat een bezoeker het herkent.

| Niet | Wel (nl) | Wel (en) |
|---|---|---|
| stack | je tools, advies, bonnetje | your tools, advice, receipt |
| Verkennen / Explore | Alle tools | All tools |
| Stack Doctor | Check je tools | Check your tools |
| (AI) Pulse | Wat is nieuw | What's new |
| Match | Stel je vraag, advies | Ask a question, advice |
| Fair Fight | Eerlijk vergeleken | Fair comparison |
| Advanced (& Developer) | Technisch | Advanced |
| agents | onze software | our software |
| criterium | punt, wat we vergelijken | point, what we compare |
| Onbevestigd | Nog niet gecontroleerd | Not checked yet |
| Community (status) | Van gebruikers | From users |
| Verwerkersovereenkomst | Privacycontract (AVG) | Privacy contract (GDPR) |
| Traint op jouw data | Leert van jouw data | Learns from your data |
| Zelf te hosten | Draait op je eigen server | Runs on your own server |
| Commercieel gebruik | Zakelijk gebruik | Business use |
| Instapprijs | Prijs vanaf | Price from |
| Prijsmodel | Hoe je betaalt | How you pay |
| Platforms | Werkt op | Works on |
| affiliatelink | partnerlink | partner link |
| versheid | laatst gecontroleerd, hoe recent | last checked, how recent |
| betrouwbaarheid (getal) | hoe zeker we zijn | how sure we are |
| gedetecteerd | gezien | spotted |
| gelogd | genoteerd | noted |
| transcriberen | uitschrijven | turn audio into text |
| nasynchroniseren | vertalen met een AI-stem | translate with an AI voice |
| plekken (seats) | personen | people |
| Methodologie | Zo werken we | How we work |
| Disclosure | Hoe we geld verdienen | How we make money |
| Correcties | Fout melden | Report a mistake |

## 3. Top-80: wat er veranderde en waarom

De teksten staan in het Nederlands. Bij de punten die de eigenaar noemde, staat ook het Engels. "Waar" noemt de pagina en de sleutel.

### Menu, header en footer

| # | Waar | Oud | Nieuw | Waarom |
|---|---|---|---|---|
| 1 | Menu · `nav.explore` | Verkennen (en: Explore) | Alle tools (All tools) | Zegt wat je vindt. "Verkennen" zegt alleen wat je doet. |
| 2 | Menu · `nav.compare` | Vergelijken | Vergelijk | Korter, en een opdracht. |
| 3 | Menu · `nav.doctor` | Stack Doctor | Check je tools (Check your tools) | Twee Engelse woorden. "Stack" kent een 14-jarige niet. |
| 4 | Menu · `nav.pulse` | Pulse | Wat is nieuw (What's new) | Merknaam zonder betekenis. Nu zie je wat je er vindt. |
| 5 | Menu · `nav.learn` | Leren | Uitleg | Zegt wat er staat, niet wat jij moet doen. |
| 6 | Header · `hub.levelAdvancedShort`, `hub.levelAdvanced` | Advanced / Advanced & Developer | Technisch | Engels in de Nederlandse tekst. "Basis \| Technisch" is een duidelijk paar. |
| 7 | Home · `hub.badgeBeginner`, `hub.badgeAdvanced` | Beginner / Advanced | Makkelijk / Technisch | Hetzelfde woordpaar als de makkelijk-kolom in de tabel. |
| 8 | Menu (meer) en footer · `nav.match` | Match | Stel je vraag | "Match" is een productnaam. Nu zie je wat je daar doet. |
| 9 | Zoeken · `nav.searchLabel` | Zoek in de tooldatabase | Zoek tussen alle tools | "Database" is een vakwoord. |
| 10 | Footer · `footer.methodology` | Methodologie | Zo werken we | Moeilijk woord. Het nieuwe zegt wat de pagina uitlegt. |
| 11 | Footer · `footer.disclosure` | Disclosure | Geld en reclame | Engels juridisch woord. |
| 12 | Footer · `footer.corrections` | Correcties | Fout melden | Zegt wat je er kunt doen. |
| 13 | Footer · `footer.api` | Data-API | Onze data gebruiken | Vakwoord. Het nieuwe zegt wat je ermee kunt. |
| 14 | Footer · `footer.explanation` | Onafhankelijk: geld verandert nooit de volgorde. Elke bewering heeft een bron, een datum en een status. | Wij zijn onafhankelijk: geld bepaalt nooit wie bovenaan staat. Bij elk feit zie je de bron, de datum en hoe goed we het controleerden. | "Status" en "bewering" waren vaag. Nu staat er wat je ziet. |

### Home

| # | Waar | Oud | Nieuw | Waarom |
|---|---|---|---|---|
| 15 | Hero · `home.heroSub` | Beschrijf je doel. Je krijgt een onderbouwde stack: welke tools, waarom, wat het kost, met bronnen en alternatieven. | Kies uit een lijst of typ je vraag. Je ziet welke AI-tools passen, wat ze kosten en waarom. Bij elk feit staat waar we het vonden. | Geen "stack". Past bij allebei de manieren om te vragen. |
| 16 | Hero (en) · `home.heroSub` | Describe your goal. You get a reasoned stack: which tools, why, what it costs — with sources and alternatives. | Pick from a list or type your question. You see which AI tools fit, what they cost and why. Every fact shows where we found it. | Same reasons as #15. |
| 17 | Zoekmachines · `meta.defaultDescription` | … krijg een onderbouwde AI-stack: welke tools, waarom, wat het kost, met bronnen, versheid en alternatieven. | Vertel wat je wilt doen. Je ziet welke AI-tools passen, wat ze kosten en waar dat staat. | Geen "stack" en geen "versheid". |
| 18 | Hero · `home.proof` | … {supported}% onderbouwd met meerdere bronnen … | … {supported}% met een officiële bron of meer bronnen … | Zegt wat "onderbouwd" hier betekent, en dat klopt nu ook met de telling. |
| 19 | Sectie · `home.fightsTitle` | Fair Fights | Eerlijk vergeleken | Engels merkwoord. |
| 20 | Sectie · `home.fightsSub` | Twee tools, dezelfde criteria, geen totaalwinnaar. | Twee tools naast elkaar, op dezelfde punten. Er is geen winnaar: wat beter is, hangt af van wat jij nodig hebt. | "Criteria" en "totaalwinnaar" zijn moeilijk. |
| 21 | Podium · `home.stageHint` | Typ wat je wilt doen. De wijzer zoekt de plek die erbij hoort. | Kies of typ wat je wilt doen. Dan zie je hier de plek die erbij past. | Past bij de lijst én het typen. |
| 22 | Podium · `home.stageEnter` | Bekijk deze wereld | Bekijk de tools | Zegt wat je krijgt als je klikt. |
| 23 | Voorbeeld · `hub.prompts.api.label` | LLM via API koppelen | AI koppelen aan je eigen app | Twee vakwoorden. |
| 24 | Voorbeeld · `hub.prompts.notes.label` | Notuleren zonder kosten | Gratis verslag van vergaderingen | "Notuleren" kent een 14-jarige niet. |
| 25 | Tabel · `hub.matrixNote` | Volgorde op functies en data, nooit op sponsoring. Wat we niet met een bron hebben vastgelegd, laten we weg (–). | We zetten tools op volgorde van wat ze kunnen, nooit omdat iemand betaalt. Hebben we geen bron, dan zie je een streepje (–). | "Sponsoring" en "vastgelegd" vervangen door wat er gebeurt. |
| 26 | Tabel · `hub.fullStack` | Bekijk je complete stack | Bekijk het hele advies | Geen "stack". |
| 27 | Radar · `hub.radarTitle` | AI-trend- en nieuwsradar | Wat er speelt in AI | Drie zware woorden in één. |
| 28 | Radar · `hub.radarSub` | Automatisch verzameld door onze agents: elk uur … | Onze software haalt dit elk uur op: … | "Agents" is een intern woord. |
| 29 | Stappenplannen · `hub.startStack` | Stel mijn stack samen | Toon mijn advies | Geen "stack". Hetzelfde als de knop in "Stap voor stap". |
| 30 | Vraag · `match.submit` | Match | Zoek tools | Een knop begint met een werkwoord. |

### Vergelijken

| # | Waar | Oud | Nieuw | Waarom |
|---|---|---|---|---|
| 31 | Intro · `compare.intro` | Kies 2 tot 4 tools. We tonen per criterium de waarde en de status; geen totaalwinnaar, wel wanneer je welke kiest. | Kies 2 tot 4 tools. Je ziet ze naast elkaar, punt voor punt. Wij kiezen geen winnaar, maar zeggen wanneer je welke tool kiest. | "Criterium", "waarde" en "status" in één zin. |
| 32 | Intro (en) · `compare.intro` | Pick 2 to 4 tools. We show the value and status per criterion; no overall winner, but when to choose which. | Pick 2 to 4 tools. You see them side by side, point by point. We don't pick a winner, but we tell you when to choose which. | Same reasons as #31. |
| 33 | Tabel · `compare.criterion` | Criterium | Wat we vergelijken | Vakwoord. |
| 34 | Tabel · `compare.criteria.entry_price` | Instapprijs | Prijs vanaf | "Instap" is jargon uit de prijswereld. |
| 35 | Tabel · `compare.criteria.pricing_model` | Prijsmodel | Hoe je betaalt | Zegt wat je wilt weten. |
| 36 | Tabel · `compare.criteria.platforms` | Platforms | Werkt op | Gewone woorden. Hetzelfde als op de home. |
| 37 | Tabel · `compare.criteria.gdpr_dpa` | Verwerkersovereenkomst | Privacycontract (AVG) | Juridisch vakwoord. |
| 38 | Tabel · `compare.criteria.self_hostable` | Zelf te hosten | Draait op je eigen server | "Hosten" is een vakwoord. |
| 39 | Tabel · `compare.criteria.trains_on_user_data` | Traint op jouw data | Leert van jouw data | Zegt wat er gebeurt. |
| 40 | Tabel · `compare.criteria.api` | API | API (voor ontwikkelaars) | Niet te missen, dus uitgelegd in hetzelfde label. |
| 41 | Duel · `compare.fairFightIntro` | Een Fair Fight: dezelfde criteria, dezelfde bronnen-eisen, en geen totaalwinnaar. … | Een eerlijke vergelijking: beide tools op dezelfde punten, met dezelfde eisen aan bronnen. Er is geen winnaar. … | Geen Engels en geen "criteria". |
| 42 | Wanneer kies je wat · `compare.noVerdict` | Op basis van bekende gegevens springt {name} nergens duidelijk uit. | Met wat we nu weten, is {name} nergens duidelijk beter. | Korter en gewoner. |
| 43 | Wanneer kies je wat · `compare.reasons.platform` | op {platform} werkt | {platform} wilt gebruiken | Las als "Kies Claude als je … op API werkt". |
| 44 | EU-alternatief · `euAlt.shared` | Gedeelde kernfuncties: {caps} | Kunnen allebei: {caps} | "Kernfuncties" is zwaar. |

### Wat is nieuw (was Pulse)

| # | Waar | Oud | Nieuw | Waarom |
|---|---|---|---|---|
| 45 | Titel · `pulse.title` | AI Pulse | Wat is nieuw bij AI-tools (en: What's new in AI tools) | Merknaam zonder betekenis. |
| 46 | Intro · `pulse.intro` | Echte wijzigingen, gedetecteerd door onze agents of redactie, elk met bron en status. | Hier zie je wat er verandert bij AI-tools. We houden het automatisch en met de hand bij. Bij elk bericht staat de bron en hoe zeker we zijn. | "Gedetecteerd", "agents" en "status" waren intern. |
| 47 | Intro (en) · `pulse.intro` | Real changes, detected by our agents or editors, each with source and status. | Here you see what changes in AI tools. We track it automatically and by hand. Every item shows its source and how sure we are. | Same reasons as #46. |
| 48 | Filters · `pulse.types.*` | Alles · Prijzen · Plannen · Product · Status · Nieuws (en: All · Prices · Plans · Product · Status · News) | Alles · Prijzen · Abonnementen · Nieuwe functies · Storing of gestopt · Nieuws (All · Prices · Subscriptions · New features · Down or stopped · News) | "Product" en "Status" zeiden niet wat erin zit. |
| 49 | Filters · `pulse.filter` | Filter op soort | Kies wat je wilt zien | Zegt wat je doet. |
| 50 | Lege staat · `pulse.empty` | Nog geen wijzigingen in deze categorie. | Nog geen wijzigingen van deze soort. Kies hierboven iets anders. | Zegt wat je nu kunt doen. |
| 51 | Bericht · `pulse.detected` | gedetecteerd {date} | gezien op {date} | Vakwoord. |
| 52 | Soort · `eventKind.*` | Release · Statuswijziging · Financiering · Buzz · Site onbereikbaar | Nieuwe versie · Status veranderd · Geld opgehaald · Veel besproken · Site werkt niet | Engelse en zakelijke woorden. |

### Toolpagina

| # | Waar | Oud | Nieuw | Waarom |
|---|---|---|---|---|
| 53 | Status · `status.unverified.label` | Onbevestigd | Nog niet gecontroleerd | Vaste regel 7. Vormt een paar met "Gecontroleerd". |
| 54 | Status · `status.community.label` | Community | Van gebruikers | Engels. |
| 55 | Status · `status.supported.tooltip` | Meerdere onafhankelijke bronnen komen overeen, of de officiële bron noemt het maar het is nog niet letterlijk gecontroleerd. | Er staat een bron bij: meerdere bronnen zeggen hetzelfde, of de officiële site noemt het. We zagen het nog niet woord voor woord. | "Onderbouwd" blijft, maar met de uitleg "er staat een bron bij". |
| 56 | Sectie · `tool.dna` | DNA | Wat het kan | Beeldspraak die niet zegt wat er staat. |
| 57 | Zijkolom · `tool.vitals` | Vitals | Wat we controleren | Engels. |
| 58 | Blokken · `tool.bestFor`, `tool.notFor`, `tool.limitations` | Beste voor · Niet ideaal voor · Beperkingen | Handig voor · Minder handig voor · Let op | Gewone woorden. "Beste" was een oordeel dat we niet geven. |
| 59 | Zijkolom · `tool.euLens` | EU-lens | Privacy en Europa | Zegt wat erin staat. |
| 60 | Tijdlijn · `tool.timelineEmpty` | Nog geen wijzigingen gedetecteerd. Onze agents houden deze tool in de gaten. | We zagen nog geen wijzigingen. We houden deze tool in de gaten. | Geen interne woorden. |
| 61 | Prijzen · `plans.history` | Prijsgeschiedenis (Time Machine) | Prijsgeschiedenis | Engelse merknaam weg. |
| 62 | Prijzen · `plans.pendingNotice` | … We zagen een andere prijs op de officiële pagina en bevestigen die nog; tot die tijd blijft de laatst geverifieerde prijs staan. | … We zagen een andere prijs op de officiële site en controleren die nog. Tot dan zie je de laatste prijs die we zeker weten. | Zin van 22 woorden, en "geverifieerd". |
| 63 | Bezoekknop · `tool.affiliateLabel`, `disclosure.note` | affiliatelink · "we kunnen commissie ontvangen" | partnerlink · "koop je via zo'n link, dan kunnen wij geld krijgen" | Zelfde betekenis, gewone woorden. Ook op de pagina "Hoe we geld verdienen". |
| 64 | Bronnen · `receipts.explainer` | … Onze agents controleren de officiële pagina's automatisch; wat nog niet letterlijk is bevestigd, staat als Onderbouwd of Onbevestigd. | … Onze software controleert de officiële sites. Staat het er nog niet woord voor woord? Dan zie je Onderbouwd of Nog niet gecontroleerd. | Geen "agents", kortere zinnen. |

### Alle tools (was Verkennen)

| # | Waar | Oud | Nieuw | Waarom |
|---|---|---|---|---|
| 65 | Titel · `explorer.title` | Verken AI-tools | Alle AI-tools | Hetzelfde als het menu. |
| 66 | Intro · `explorer.intro` | Filter op wat je nodig hebt. Elke prijs heeft een bron, een datum en een status. | Kies wat je nodig hebt, dan zie je welke tools passen. Bij elke prijs staan een bron en een datum. | Zegt wat je krijgt. |
| 67 | Filter · `explorer.level` | Maximaal niveau | Hoe moeilijk mag het zijn? | Een vraag die je meteen kunt beantwoorden. |
| 68 | Volgorde · `explorer.sortFresh`, `explorer.sortRelevance` | Versheid · Relevantie | Laatst gecontroleerd · Best passend | Vakwoorden. |
| 69 | Knop · `explorer.apply` | Filteren | Toon tools | Zegt wat er gebeurt. |
| 70 | Lege staat · `explorer.emptyTitle`, `explorer.emptyBody` | Daar hebben we (nog) geen bonnetje voor. · Probeer minder filters, of beschrijf wat je wilt doen in Match. | We vonden geen tools die hierbij passen. · Haal een paar filters weg. Of vertel ons wat je wilt doen, dan zoeken wij mee. | Grapje zonder uitleg, en "Match". |
| 71 | Uitleg volgorde · `explorer.rankingNote` | Volgorde op relevantie, naam, prijs of versheid. Affiliatelinks hebben geen invloed. | Jij kiest de volgorde. Partnerlinks veranderen daar niets aan. | Korter, zonder vakwoorden. |

### Check je tools (was Stack Doctor)

| # | Waar | Oud | Nieuw | Waarom |
|---|---|---|---|---|
| 72 | Intro · `doctor.intro` | Vul in welke AI-tools je nu gebruikt. We zoeken overlap, onnodige kosten, risico's en betere alternatieven. | Kies de AI-tools die je nu gebruikt. Wij kijken of tools hetzelfde doen, waar je geld kunt besparen en wat beter kan. | "Overlap" uitgelegd als "hetzelfde doen". |
| 73 | Knop · `doctor.submit` | Diagnose | Check mijn tools | Een knop is een werkwoord. |
| 74 | Uitslag · `doctor.diagnosis`, `doctor.overlapTitle`, `doctor.recipeTitle` | Diagnose · Overlap · Recept | Uitslag · Dubbel werk · Wat je kunt doen | Dokterswoorden zonder dokter. |
| 75 | Risico · `doctor.risk.trains_on_data` | {tool} kan je data gebruiken voor training. | {tool} kan van jouw data leren. | "Training" is vakjargon. |
| 76 | Uitslag · `doctor.monthly`, `doctor.nothing` | Je stack kost nu ongeveer · Je stack is gezond. | Je tools kosten nu ongeveer · Je tools zijn een goede mix. | Geen "stack". |

### Kosten

| # | Waar | Oud | Nieuw | Waarom |
|---|---|---|---|---|
| 77 | Rekenhulp · `costs.meters.transcribe.title` | Audio transcriberen | Audio uitschrijven | Vakwoord. |
| 78 | Rekenhulp · `costs.meters.dubbing.title` | Video nasynchroniseren | Video vertalen met AI-stem | Vakwoord. |
| 79 | Bedrag · `costs.usageHour` | {price} per uur, naar rato van je gebruik | {price} per uur, je betaalt wat je gebruikt | "Naar rato" kent een 14-jarige niet. |
| 80 | Team · `costs.team.minSeats` | minimaal {min} plekken | minimaal {min} personen | "Plek" (seat) is jargon. |

## 4. Wat bewust bleef staan

- **Merkwoorden**: AIToolsWijzer, "AI-tools, met bonnetje", "Basis" en "Onderbouwd". Die laatste staat nu altijd met uitleg: "er staat een bron bij".
- **De technische weergave**: de kolommen API, Integraties, Zelf hosten, Prijsmodel en Niveau, en de hint bij "Technisch". Die is voor ontwikkelaars (regel 8).
- **De voorbeeldvragen zelf** (`hub.prompts.*.query`). Het systeem moet ze blijven begrijpen, en de test op de home verwacht "API" in de technische vraag. Alleen hun labels zijn vereenvoudigd.
- **Vaste juridische namen en termen**: "YouTube API Services", "Grondslag: gerechtvaardigd belang", de Autoriteit Persoonsgegevens en art. 6:193e BW. De bewaartermijnen en beloftes in de privacytekst zijn gelijk gebleven.
- **Pagina's voor een ander publiek**: de API-pagina (ontwikkelaars), de crawlerpagina (`bot.*`, voor beheerders van websites) en Admin (de eigenaar).
- **Woorden die al eenvoudig zijn en die tests vastleggen**: "Wat krijg je echt gratis?", "Teamkosten", "Europees alternatief", "Bewaar dit bonnetje" en "Zo begin je".
- **"Advanced" in het Engels.** Dat is gewoon Engels. In het Nederlands heet de weergave "Technisch".
- **Titels die software bij een wijziging maakt** (`agentEvent.*`). Die worden bij het maken in de database gezet. "Nieuw in de catalogus" is al duidelijk, en een test verwacht het.
- **"Nog niet gecontroleerd" is langer dan "Onbevestigd".** De coördinator vroeg statuslabels kort te houden. Het label heeft 3 woorden, en de bewaker houdt het bij 3. Bij prijzen komt het weinig voor (7 van de 330 prijzen in de testdata). In de compacte statuschip staat alleen een icoon, met deze naam als label.
- **De foutpagina voor routes** (`error.tsx`) houdt haar eigen tweetalige teksten. Een clientcomponent kan de berichten niet laden zonder ze helemaal mee te sturen. De tekst is wel gelijk aan `errors.*` ("genoteerd" in plaats van "gelogd").
- **`data/tools/*`**: de nieuwe tools van de Design Director. Die heb ik niet aangeraakt.

## 5. Buiten de berichtenbestanden

- `src/app/global-not-found.tsx`: de tweetalige 404 buiten de taalroutes haalt titel en knop nu uit `errors.notFoundTitle` en `errors.notFoundCta`. Eerder stond er "Deze pagina heeft geen bonnetje." in de code.
- `src/app/[locale]/error.tsx`: dezelfde woorden als `errors.*`.
- `src/content/learn.ts`: de tip in "Gratis of betalen?" verwijst naar "Check je tools" in plaats van Stack Doctor.
- `src/app/llms.txt/route.ts` en twee alt-teksten van deelafbeeldingen: de nieuwe paginanamen.

Verder vond ik geen zichtbare tekst in de code. De velden "Website" in de formulieren zijn verborgen velden tegen spam.

## 6. De bewaker

`tests/unit/plain-language.test.ts` controleert de Nederlandse en Engelse teksten. Bij een overtreding noemt de test de taal en de sleutel. De fix is dan één waarde in `src/i18n/messages/{nl,en}.json`.

| Regel | Waarop |
|---|---|
| Hoogstens 3 woorden | menu, footer, weergaveknop, statuslabels in toolrijen, filters van Wat is nieuw, "+ Vergelijk" |
| Geen vakwoorden en geen Engelse productnamen in het Nederlands | menu's, titels (h1), intro's, knoppen, lege staten en meldingen |
| Geen zin langer dan 20 woorden | intro's en meldingen |
| Gemiddeld hoogstens 12 woorden per zin | intro's en meldingen samen |

- **Uitgezonderd**: de technische weergave, Admin, de API-pagina, de crawlerpagina en de inhoud van e-mails.
- **De lijst met vakwoorden** staat in de test. Komt er een nieuw vakwoord bij? Zet het in die lijst.
- **Op de teksten van vóór deze ronde** vindt de bewaker 95 overtredingen: 88 vakwoorden, 6 te lange zinnen en 1 menulabel van 4 woorden. Op de nieuwe teksten: 0.

## 7. Open punten

1. **Visuele baselines.** De teksten op de home en de toolpagina zijn veranderd. Draai na het samenvoegen `npx playwright test visual --update-snapshots` en bekijk de verschillen.
2. **Inhoud buiten de berichten.** De gidsen in `src/content` (uitleg, stappenplannen, woordenlijst) zijn al in gewone taal geschreven. Ik heb ze alleen nagelopen op oude namen. Een volledige toets op B1-niveau is een volgende stap.
3. **Toolteksten in `data/tools`** (taglines, "handig voor") vallen buiten de bewaker. Die schrijft de Design Director in deze ronde.
4. **E-mails** (`digest.*`) zijn alleen bij het onderwerp, de intro en de nieuwsbriefnaam vereenvoudigd.
5. **Duits en Frans** zijn nog niet live. De teksten zijn vereenvoudigd en correct, maar niet nagelezen door een moedertaalspreker.
6. **Regel 5 (knoppen beginnen met een werkwoord)** test de bewaker niet. In twee talen is dat niet betrouwbaar automatisch te doen. De redactie controleert het.
