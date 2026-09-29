# 09 — Monetisatiearchitectuur

## 1. De ene regel

**Geld beïnvloedt nooit de volgorde.** De ranking-module (`src/lib/engine`) importeert geen monetisatiecode. De test `ranking-independence` vergelijkt resultaten met en zonder affiliatelinks en sponsoring, en ze moeten identiek zijn. Betaalde zichtbaarheid bestaat alleen in gelabelde slots.

## 2. Inkomstenstromen: wat nu, wat later

| Stroom | Status in de MVP | Hoe het werkt | Voorwaarden |
|---|---|---|---|
| **Affiliate** | ✅ gebouwd | `/go/{tool}` → een click_id wordt als subID in de affiliate-URL gezet → conversies worden geïmporteerd (CSV/handmatig) → omzet per pagina | Goedgekeurd programma, disclosure op de pagina, `rel="sponsored"` |
| **B2B-leads ("AI-stackadvies voor mkb")** | ✅ gebouwd | Doctor/Match → formulier met toestemming → leadbeheer in Admin → doorverwijzen naar een partner of eigen audit | Partnerafspraken (handmatig) |
| **Nieuwsbriefsponsoring** | ✅ architectuur (abonnees, double opt-in, omzetregistratie) | Gelabelde sponsorblokken in de digest | Vanaf ~1.000 bevestigde abonnees |
| **Gesponsorde plaatsing** | ✅ architectuur (placements-tabel, slotcomponent, Admin) | Eén slot op de home, duidelijk "Gesponsord", buiten de organische resultaten | Vanaf ~10k bezoekers/maand |
| Premium-alerts | ⏳ later | Snellere of uitgebreidere Watch | Aangetoonde vraag (Watch-opt-in) |
| Teamaccounts | ⏳ later | Gedeelde stacks, AVG-rapportage | Vraag vanuit leads |
| Vendor-intelligence | ⏳ later | Geaggregeerde, geanonimiseerde vraagdata per vendor | ≥ 10k Matches/maand (statistische zin) |
| Data-API (commercieel) | ⏳ later | Een betaalde tier boven de gratis publieke API | Vraag van AI- en SaaS-partijen |
| AI-procurement | ⏳ later | Inkoopbegeleiding voor teams | Vertrouwen + volume |
| AdSense/display | ❌ niet | Ondermijnt het vertrouwen en levert weinig op bij laag verkeer | — |
| Listing fees | ❌ niet | Botst met no-pay-to-rank | — |

## 3. Datamodel en attributie

```
Pagina (pad, type, locale)
  └─ klik op "Bezoek site" → /go/{tool}?src={pageType}&pos={n}&mq={matchQueryId}
        ├─ outbound_clicks: click_id (ULID), tool, linktype, pagina, positie, match_query, bezoekershash
        ├─ affiliate_links.url_template: https://partner.example/?ref=abc&sub_id={click_id}
        └─ 302 → vendor (rel="sponsored nofollow" op de link; /go is disallowed in robots)

Netwerkrapport (CSV, met subID-kolom) → Admin → Import → conversions (click_id, bedrag, status)
  → omzet per pagina = SUM(conversions JOIN outbound_clicks ON click_id) GROUP BY page_path
```

**Waarom een eigen redirect:**
1. Omzet per pagina, paginatype, positie en Match-taak wordt meetbaar.
2. Er is één plek om affiliate aan of uit te zetten.
3. Linkgezondheid (Monetization Agent).
4. Minder last van adblock-lijsten die directe affiliatedomeinen blokkeren.

## 4. Disclosure (automatisch)

- Toont een pagina minstens één tool met een actieve affiliatelink, dan verschijnt bovenaan de resultaten: *"Sommige links zijn affiliatelinks: we kunnen commissie ontvangen. Dat beïnvloedt de volgorde niet. [Hoe we rangschikken]"*.
- Per link staat een klein label "affiliate".
- Gesponsorde slots hebben altijd het label **"Gesponsord"**, een afwijkende stijl en een link naar `/disclosure`.
- De Monetization Agent controleert dagelijks dat geen pagina met een affiliatelink de disclosure mist (dit is ook een test).

## 5. Het €500-dashboard (Admin → Revenue)

Het dashboard toont:
- **Doel:** €500/maand, met de voortgang in de huidige maand, de vorige maand en een trend.
- **Traffic:** bezoekers (unieke hashes per dag, opgeteld), pageviews, Matches, per bron (organisch, AI-referrals als chatgpt.com/perplexity.ai, direct, social, e-mail).
- **Affiliate clicks:** totaal, naar tools met en zonder programma, per paginatype, per tool.
- **Affiliate conversions en revenue:** pending/approved/paid, per programma.
- **Sponsored, lead- en newsletter-revenue:** uit `revenue_entries` en leads.
- **Welke pagina's leveren geld op:** een tabel met pad, bezoekers, outbound kliks, CTR, conversies, omzet en **EPC** (omzet per outbound klik) en **RPM** (omzet per 1.000 bezoekers).
- **Gemiste kansen:** tools met veel outbound kliks maar zonder programma (lijst voor outreach).
- **Scenariomodel** met aanpasbare parameters, naast de gemeten waarden (zie §6).

**Regels voor echte data (doc 12 §6.2):**
- Elke omzettegel toont de bron en "data t/m {datum}".
- **Onbekend is nooit €0.** Zonder import of koppeling toont de tegel "—" met de reden en de actie.
- Omzet komt binnen via een netwerk-API waar die bestaat (connector per netwerk, klasse B). Anders via een CSV-import (maandelijks, ±15 min per netwerk). Een import ouder dan 35 dagen wordt één keer geëscaleerd en staat daarna in elk weekrapport.

## 6. Scenario's naar €500/maand

> Dit zijn **projecties met expliciete aannames, geen feiten**. Het dashboard vervangt elke aanname door de gemeten waarde zodra er data is.

### Formule

```
Affiliate €/mnd  = V × o × a × c × r
  V = bezoekers per maand
  o = outbound kliks per bezoeker
  a = aandeel kliks naar tools met een actief affiliateprogramma
      (laag, omdat ChatGPT, Claude en Midjourney geen publiek programma hebben)
  c = betaalde conversie per affiliateklik
  r = gerealiseerde commissie per betalende klant (bijv. 22–25% van $6–$29/mnd over de looptijd)
Nieuwsbrief €/mnd = (S / 1000) × CPM × 4 verzendingen × fill-rate   (pas vanaf S ≥ 1.000)
Leads €/mnd       = V × lead-ratio × kwalificatie × waarde per lead
Sponsoring €/mnd  = actieve slots × slotprijs                         (pas vanaf V ≥ 10.000)
```

### Aannames

| Parameter | Conservatief | Basis | Optimistisch |
|---|---|---|---|
| o (kliks/bezoeker) | 0,20 | 0,30 | 0,40 |
| a (aandeel met programma) | 25% | 35% | 45% |
| c (betaalde conversie) | 1,0% | 1,5% | 2,5% |
| r (commissie per klant) | €15 | €22 | €35 |
| **→ affiliate € per bezoeker** | **€0,0075** | **€0,0347** | **€0,1575** |
| **→ bezoekers nodig voor €500 (alleen affiliate)** | **≈ 66.700** | **≈ 14.400** | **≈ 3.200** |
| Nieuwsbrief-aanmelding per bezoeker | 0,3% | 1,0% | 1,5% |
| CPM nieuwsbrief / fill-rate | €25 / 25% | €35 / 50% | €50 / 75% |
| Leads: ratio × kwalificatie × waarde | 0,02% × 30% × €50 | 0,05% × 40% × €75 | 0,08% × 50% × €100 |
| Sponsorslots (bij ≥ 10k bezoekers) | 0 | 1 × €150 | 2 × €250 |

### Verkeersgroei (aanname) en uitkomst

| Maand | Conservatief V | €/mnd | Basis V | €/mnd | Optimistisch V | €/mnd |
|---|---|---|---|---|---|---|
| 3 | 800 | ≈ €8 | 1.500 | ≈ €74 | 3.000 | ≈ €593 |
| 6 | 2.000 | ≈ €21 | 4.000 | ≈ €199 | 9.000 | ≈ €1.778 |
| 9 | 3.500 | ≈ €37 | 8.000 | ≈ €397 | 18.000 | ≈ €4.210 |
| 12 | 5.000 | ≈ €53 | 12.000 | ≈ €746 | 30.000 | ≈ €6.743 |
| 18 | 9.000 | ≈ €95 | 20.000 | ≈ €1.248 | 45.000 | ≈ €10.169 |
| **Eerste maand ≥ €500** | | **niet binnen 18 mnd** | | **maand 11** | | **maand 3** |

*(Berekend met de formules hierboven. Verkeer is lineair geïnterpoleerd tussen de ankerpunten en de nieuwsbrief rekent met 2% afmeldingen per maand. In het basisscenario draagt de nieuwsbrief pas vanaf maand 17–18 bij, omdat de drempel van 1.000 abonnees laat wordt gehaald; in het conservatieve scenario wordt die drempel binnen 18 maanden niet gehaald. Bedragen zijn afgerond op hele euro's (half naar boven). Het rekenscript staat in `scripts/revenue-scenarios.ts` en dezelfde logica zit in het Admin-dashboard.)*

### Conclusies

1. **Basis:** €500/maand rond **maand 11**, niet in maand 4.
2. **Conservatief:** €500 wordt met dit model **niet** gehaald binnen 18 maanden. Het kill- en pivotcriterium uit document 01 treedt dan in werking: verschuif naar B2B-stackaudits (hoger ticket, minder verkeer nodig), bijvoorbeeld 2 audits × €250 = €500.
3. **De grootste hefboom is `a` en `r`,** niet verkeer alleen. Taken waar de beste tools *wel* een programma hebben (video, voice, SEO, e-mail, websites) zijn commercieel sterker dan "algemene chatbot"-queries. **Dat stuurt de contentprioriteit, niet de ranking.**
4. **Meet vanaf dag 1** o, a, c en r per paginatype. Na 60 dagen vervangen gemeten waarden de aannames.

### Kosten (indicatie per maand)

| Post | Bedrag |
|---|---|
| Hosting (Vercel Pro of VPS) | €6–20 |
| Database (Neon of lokaal) | €0–19 |
| LLM Match-intentie (optioneel; standaardmodel `claude-opus-5-5`, met caching en gating: de LLM draait bij ±40% van de Matches, ±$0,011–0,018 per call) | ±$9–14 per 2.000 Matches · ±$45–72 per 10.000 Matches |
| LLM voor de autonome operatie (extractie, classificatie, concepten, rapport; zie doc 12 §11) | ±$5–10 |
| E-mail (Resend free tier tot 3.000 mails/mnd) | €0–20 |
| Domein | ≈ €1 |
| **Totaal** | **≈ €20–150** (bovengrens bij 10.000 LLM-Matches) |

*De Match-LLM is het enige onderdeel dat met het verkeer meeschaalt. De kosten per Match staan in het weekrapport naast de gemeten meerwaarde. Een goedkoper model kiezen (`ANTHROPIC_MODEL`) is een keuze van de eigenaar, geen automatische.*

## 7. Aanbod richting vendors (wanneer het bereik er is)

| Product | Inhoud | Prijsindicatie | Voorwaarde |
|---|---|---|---|
| Gratis: Claim & correct | Feiten corrigeren met bewijs; badge "Prijs gecontroleerd" | €0 | Altijd |
| Gesponsord slot | Home of taakpagina, gelabeld, buiten de ranking | €150–500/mnd | ≥ 10k bezoekers/mnd |
| Nieuwsbriefsponsor | Eén gelabeld blok per editie | CPM €25–50 | ≥ 1.000 abonnees |
| Vendor-intelligence | "Waarvoor word je overwogen, tegen wie verlies je, welke bezwaren" (geaggregeerd, k-anonimiteit ≥ 20) | €99–299/mnd | ≥ 10k Matches/mnd |

## 8. Juridische checklist monetisatie

- [x] Een disclosure-component dat automatisch verschijnt bij affiliatelinks.
- [x] `rel="sponsored"` op affiliatelinks, `/go/` disallowed in robots.txt.
- [x] Rankingparameters openbaar op `/methodology` (Omnibus, art. 6:193e BW).
- [x] Gesponsorde slots gelabeld en gescheiden (Reclamecode art. 11).
- [x] Geen trackingcookies. Kliktracking zonder persoonsgegevens (bezoekershash met dagelijkse salt).
- [ ] Affiliatevoorwaarden per programma nalopen (brand bidding, disclosuretekst, verboden claims) bij aanmelding.
- [ ] Btw en valuta voor buitenlandse commissies afstemmen met de boekhouder.

## 9. Autonome omzetlussen (samenvatting van doc 12 §9)

| Lus | Het systeem doet zelf | De eigenaar doet |
|---|---|---|
| Contentprioriteit (vraag × EPC) | Kansen rangschikken; datapagina's aanmaken die door de poort komen | Nieuwe taken en categorieën goedkeuren |
| Programmadekking | Detecteert affiliateprogramma's bij tools met veel kliks en berekent de verwachte waarde: `kliks (30 d) × c × r`, gelabeld als schatting | Aanmelden (contract) |
| Linkgezondheid | Controleert redirectketens en valt terug op een directe link | — |
| Readiness | Signaleert drempels: ≥ 1.000 abonnees, ≥ 10k bezoekers/mnd, ≥ 10k Matches/mnd | Aanbod, prijs, contract |
| LLM-kosten tegenover meerwaarde | Stuurt de gatingdrempel binnen de grenzen van de eigenaar | Grenzen en modelkeuze |

**Omzetdata stuurt nooit de ranking, de volgorde van aanbevelingen of de keuze van interne links** (§1 en doc 12 C11).
