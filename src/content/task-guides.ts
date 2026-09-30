/**
 * Plain-language guides per task, for people who are new to AI: what it is,
 * how to start in three steps, what to watch out for, and one tip. Shown on
 * the task pages and in the step-by-step finder. Editorial and general on
 * purpose: which tools to use comes from the engine, with sources.
 */
import type { Locale } from '@/i18n/config';

export interface TaskGuide {
  what: string;
  steps: [string, string, string];
  watch: string[];
  tip: string;
}

type Guides = Record<string, Partial<Record<Locale, TaskGuide>>>;

export const TASK_GUIDES: Guides = {
  'create-social-media-videos': {
    nl: {
      what: "Korte video's voor TikTok, Instagram, YouTube Shorts of LinkedIn. AI helpt bij het script, het monteren, de ondertitels en een stem als je die niet zelf wilt inspreken.",
      steps: ['Schrijf in één zin wat kijkers moeten onthouden en laat AI er een kort script van maken.', 'Film met je telefoon of laat beelden maken, en monteer met een eenvoudige video-app.', 'Zet er altijd ondertitels onder: de meeste mensen kijken zonder geluid.'],
      watch: ['Gebruik alleen muziek en beelden waarvan je de rechten hebt.', 'Gratis versies zetten soms een watermerk in de video.'],
      tip: 'Begin met drie video’s per week in hetzelfde format; dat werkt beter dan één perfecte video.',
    },
    en: {
      what: 'Short videos for TikTok, Instagram, YouTube Shorts or LinkedIn. AI helps with the script, the editing, subtitles and a voice if you do not want to record your own.',
      steps: ['Write in one sentence what viewers should remember and let AI turn it into a short script.', 'Film with your phone or have visuals generated, and edit in a simple video app.', 'Always add subtitles: most people watch without sound.'],
      watch: ['Only use music and footage you have the rights to.', 'Free plans sometimes add a watermark.'],
      tip: 'Start with three videos a week in the same format; that works better than one perfect video.',
    },
  },
  'long-videos-to-shorts': {
    nl: {
      what: "Uit een lange video, zoals een webinar, podcast of livestream, zoekt AI de beste stukjes en maakt er korte staande clips van, met ondertitels.",
      steps: ['Upload je lange video of plak de YouTube-link.', 'Laat AI de sterkste momenten kiezen en controleer de voorstellen.', 'Pas de ondertitels aan en plaats de clips verspreid over een paar weken.'],
      watch: ['AI kiest niet altijd het beste fragment: kijk zelf mee.', 'Vraag toestemming aan gasten voordat je hun fragmenten los deelt.'],
      tip: 'Eén uur video levert vaak genoeg clips op voor weken aan posts.',
    },
    en: {
      what: 'From a long video such as a webinar, podcast or livestream, AI picks the best moments and turns them into short vertical clips with subtitles.',
      steps: ['Upload your long video or paste the YouTube link.', 'Let AI pick the strongest moments and review its suggestions.', 'Adjust the subtitles and spread the clips over a few weeks.'],
      watch: ['AI does not always pick the best moment: check it yourself.', 'Ask guests for permission before sharing their clips on their own.'],
      tip: 'One hour of video often gives you enough clips for weeks of posts.',
    },
  },
  'build-website-no-code': {
    nl: {
      what: 'Een eigen website zonder te programmeren: je beschrijft wat je wilt, AI maakt een eerste versie en jij past teksten en foto’s aan met slepen en klikken.',
      steps: ['Schrijf op wie je bezoekers zijn en wat ze op je site moeten kunnen doen.', 'Laat een websitebouwer met AI een eerste ontwerp maken en kies een stijl.', 'Vervang de voorbeeldteksten door je eigen tekst, koppel je domeinnaam en publiceer.'],
      watch: ['Kijk naar de maandprijs ná de eerste periode en wat een eigen domeinnaam kost.', 'Voor een webshop of formulieren heb je vaak een duurder abonnement nodig.'],
      tip: 'Een simpele site met één duidelijke boodschap werkt beter dan veel pagina’s.',
    },
    en: {
      what: 'Your own website without coding: you describe what you want, AI builds a first version and you change texts and photos by dragging and clicking.',
      steps: ['Write down who your visitors are and what they should be able to do on your site.', 'Let an AI website builder make a first design and pick a style.', 'Replace the sample texts with your own, connect your domain name and publish.'],
      watch: ['Check the monthly price after the first period and what a custom domain costs.', 'A web shop or forms often need a more expensive plan.'],
      tip: 'A simple site with one clear message works better than many pages.',
    },
  },
  'write-seo-blog-posts': {
    nl: {
      what: 'Blogartikelen die mensen via Google vinden. AI helpt met onderwerpen kiezen, een opzet maken, schrijven en controleren of je de vragen van zoekers beantwoordt.',
      steps: ['Kies een vraag die je klanten vaak stellen; dat is je onderwerp.', 'Laat AI een opzet en eerste versie maken en vul die aan met je eigen ervaring.', 'Controleer feiten, voeg een duidelijke titel toe en publiceer regelmatig.'],
      watch: ['Google waardeert eigen ervaring en betrouwbare informatie; pure AI-tekst zonder toegevoegde waarde scoort slecht.', 'Controleer cijfers en claims altijd zelf.'],
      tip: 'Eén goed artikel per week over echte klantvragen is genoeg om te beginnen.',
    },
    en: {
      what: 'Blog posts people find through Google. AI helps you choose topics, outline, write and check that you answer what searchers ask.',
      steps: ['Pick a question your customers often ask; that is your topic.', 'Let AI draft an outline and first version, then add your own experience.', 'Check the facts, add a clear title and publish regularly.'],
      watch: ['Google values real experience and reliable information; AI text without added value ranks poorly.', 'Always check numbers and claims yourself.'],
      tip: 'One good article a week about real customer questions is enough to start.',
    },
  },
  'automatic-meeting-notes': {
    nl: {
      what: 'Een AI-notulist luistert mee met je online vergadering (Teams, Zoom of Google Meet) en maakt een verslag met samenvatting en actiepunten.',
      steps: ['Koppel de notulist aan je agenda of start hem in de vergadering.', 'Vertel de deelnemers aan het begin dat er wordt opgenomen.', 'Controleer na afloop de actiepunten en deel het verslag.'],
      watch: ['Opnemen mag alleen als deelnemers dat weten; vraag toestemming.', 'Let op waar opnames worden bewaard, zeker bij vertrouwelijke gesprekken.'],
      tip: 'Veel tools hebben een gratis versie met een beperkt aantal minuten per maand.',
    },
    en: {
      what: 'An AI note taker joins your online meeting (Teams, Zoom or Google Meet) and writes a summary with action items.',
      steps: ['Connect the note taker to your calendar or start it in the meeting.', 'Tell participants at the start that the meeting is recorded.', 'Check the action items afterwards and share the notes.'],
      watch: ['Only record when participants know; ask for consent.', 'Check where recordings are stored, especially for confidential meetings.'],
      tip: 'Many tools have a free plan with a limited number of minutes per month.',
    },
  },
  'create-product-photos': {
    nl: {
      what: 'Professionele productfoto’s zonder studio: AI maakt de achtergrond wit of zet je product in een passende sfeer.',
      steps: ['Fotografeer je product bij daglicht tegen een rustige achtergrond.', 'Laat AI de achtergrond verwijderen of een nieuwe sfeer maken.', 'Maak alle foto’s in hetzelfde formaat en dezelfde stijl.'],
      watch: ['Het product zelf moet echt blijven: klanten verwachten wat ze zien.', 'Marktplaatsen hebben eigen regels voor foto’s, zoals een witte achtergrond.'],
      tip: 'Een scherpe basisfoto maakt het AI-resultaat veel beter.',
    },
    en: {
      what: 'Professional product photos without a studio: AI makes the background white or places your product in a matching scene.',
      steps: ['Photograph your product in daylight against a plain background.', 'Let AI remove the background or create a new scene.', 'Use the same size and style for all photos.'],
      watch: ['The product itself must stay real: customers expect what they see.', 'Marketplaces have their own photo rules, such as a white background.'],
      tip: 'A sharp original photo makes the AI result much better.',
    },
  },
  'automate-work': {
    nl: {
      what: 'Terugkerende klusjes automatisch laten doen, zoals gegevens overzetten tussen apps, e-mails sorteren of formulieren verwerken. Je bouwt dat met blokjes, zonder te programmeren.',
      steps: ['Kies één klus die je elke week herhaalt en schrijf de stappen op.', 'Bouw die stappen na in een automatiseringstool met een kant-en-klaar sjabloon.', 'Test met een paar voorbeelden en zet hem dan aan.'],
      watch: ['Automatiseringen kosten vaak per uitgevoerde taak: kijk naar de limieten.', 'Geef tools alleen toegang tot wat ze echt nodig hebben.'],
      tip: 'Begin klein: één geslaagde automatisering bespaart vaak al uren per maand.',
    },
    en: {
      what: 'Let recurring chores run automatically, such as moving data between apps, sorting e-mail or processing forms. You build it with blocks, without coding.',
      steps: ['Pick one chore you repeat every week and write down the steps.', 'Rebuild those steps in an automation tool, starting from a ready-made template.', 'Test with a few examples, then switch it on.'],
      watch: ['Automations are often charged per task run: check the limits.', 'Only give tools access to what they really need.'],
      tip: 'Start small: one working automation often saves hours a month.',
    },
  },
  'code-with-ai': {
    nl: {
      what: 'Een AI-assistent in je code-editor die meedenkt, code schrijft, fouten zoekt en uitlegt wat code doet.',
      steps: ['Installeer de assistent in je editor en koppel je project.', 'Beschrijf in gewone taal wat je wilt bouwen of repareren.', 'Lees en test elke wijziging voordat je hem bewaart.'],
      watch: ['AI-code kan fouten of beveiligingslekken bevatten: review en test altijd.', 'Let op welke code en gegevens naar de dienst gaan.'],
      tip: 'Laat AI eerst tests schrijven; dan zie je sneller of een wijziging klopt.',
    },
    en: {
      what: 'An AI assistant in your code editor that thinks along, writes code, finds bugs and explains what code does.',
      steps: ['Install the assistant in your editor and open your project.', 'Describe in plain language what you want to build or fix.', 'Read and test every change before you keep it.'],
      watch: ['AI code can contain bugs or security holes: always review and test.', 'Check which code and data are sent to the service.'],
      tip: 'Let AI write tests first; you will see faster whether a change works.',
    },
  },
  'build-app-without-code': {
    nl: {
      what: 'Een eigen app of webapp laten bouwen door AI: je beschrijft je idee en krijgt een werkende eerste versie die je stap voor stap verbetert.',
      steps: ['Beschrijf je app in een paar zinnen: voor wie, en wat moet hij kunnen?', 'Laat AI een eerste versie bouwen en probeer die meteen uit.', 'Vraag om kleine verbeteringen, één tegelijk, tot hij doet wat je wilt.'],
      watch: ['Voor inloggen, betalingen of persoonsgegevens heb je extra zorg nodig; vraag zo nodig een ontwikkelaar mee te kijken.', 'Controleer wie eigenaar is van de code en waar de app draait.'],
      tip: 'Begin met de kleinste versie die al nuttig is.',
    },
    en: {
      what: 'Let AI build your own app or web app: you describe your idea and get a working first version that you improve step by step.',
      steps: ['Describe your app in a few sentences: who is it for and what should it do?', 'Let AI build a first version and try it right away.', 'Ask for small improvements, one at a time, until it does what you want.'],
      watch: ['Logins, payments or personal data need extra care; ask a developer to review if needed.', 'Check who owns the code and where the app runs.'],
      tip: 'Start with the smallest version that is already useful.',
    },
  },
  'customer-support-chatbot': {
    nl: {
      what: 'Een chatbot op je website die veelgestelde vragen beantwoordt, dag en nacht, en lastige vragen doorgeeft aan jou of je team.',
      steps: ['Verzamel je veelgestelde vragen, voorwaarden en productinformatie.', 'Laad die informatie in de chatbot en test hem met echte klantvragen.', 'Zet hem op je site met een duidelijke knop om een mens te spreken.'],
      watch: ['Een chatbot kan fouten maken: laat hem alleen antwoorden uit jouw informatie geven.', 'Vermeld dat klanten met een AI praten.'],
      tip: 'Bekijk elke week de vragen die de bot niet kon beantwoorden en vul je informatie aan.',
    },
    en: {
      what: 'A chatbot on your website that answers frequent questions day and night, and hands tricky ones to you or your team.',
      steps: ['Collect your FAQs, terms and product information.', 'Load that information into the chatbot and test it with real customer questions.', 'Put it on your site with a clear button to reach a human.'],
      watch: ['A chatbot can make mistakes: let it answer only from your information.', 'Tell customers they are talking to an AI.'],
      tip: 'Review the questions the bot could not answer every week and add to your information.',
    },
  },
  'make-presentations': {
    nl: {
      what: 'Een presentatie laten maken door AI: je geeft het onderwerp of een tekst, AI maakt de dia’s met opmaak en beelden.',
      steps: ['Schrijf de kernboodschap en de 3 tot 5 punten die je wilt maken.', 'Laat AI er dia’s van maken en kies een stijl.', 'Maak het persoonlijk: eigen voorbeelden, cijfers en een duidelijke afsluiting.'],
      watch: ['Controleer cijfers en beweringen die AI toevoegt.', 'Minder tekst per dia werkt beter; AI zet er vaak te veel op.'],
      tip: 'Oefen je verhaal hardop; de dia’s ondersteunen, jij vertelt.',
    },
    en: {
      what: 'Let AI make your presentation: you give the topic or a text, AI creates the slides with layout and images.',
      steps: ['Write down the key message and the 3 to 5 points you want to make.', 'Let AI turn them into slides and pick a style.', 'Make it personal: your own examples, numbers and a clear ending.'],
      watch: ['Check numbers and claims that AI adds.', 'Less text per slide works better; AI often adds too much.'],
      tip: 'Rehearse out loud; the slides support you, you tell the story.',
    },
  },
  'produce-podcast': {
    nl: {
      what: 'Een eigen podcast opnemen, ook met gasten op afstand, en die met AI netjes afwerken: ruis weg, stiltes eruit en een uitgeschreven tekst erbij.',
      steps: ['Kies een onderwerp en een vaste vorm, bijvoorbeeld 20 minuten per week.', 'Neem op met een opnamedienst die elke spreker apart vastlegt.', 'Laat AI het geluid opschonen en publiceer via een podcastplatform.'],
      watch: ['Een fatsoenlijke microfoon maakt meer verschil dan welke AI-bewerking ook.', 'Vraag gasten toestemming om de opname te publiceren.'],
      tip: 'Knip korte fragmenten uit je aflevering voor social media.',
    },
    en: {
      what: 'Record your own podcast, including remote guests, and let AI polish it: noise out, silences cut and a transcript added.',
      steps: ['Pick a topic and a fixed format, for example 20 minutes a week.', 'Record with a service that captures each speaker separately.', 'Let AI clean up the audio and publish through a podcast platform.'],
      watch: ['A decent microphone makes more difference than any AI editing.', 'Ask guests for permission to publish the recording.'],
      tip: 'Cut short clips from each episode for social media.',
    },
  },
  'make-music': {
    nl: {
      what: 'Muziek of een liedje laten maken door AI: je beschrijft de stijl en het onderwerp, en krijgt een nummer met of zonder zang.',
      steps: ['Beschrijf stijl, stemming en onderwerp, bijvoorbeeld: vrolijk verjaardagslied, pop.', 'Maak een paar versies en kies de beste.', 'Download het nummer en controleer wat je ermee mag.'],
      watch: ['Lees of je de muziek commercieel mag gebruiken; dat verschilt per abonnement.', 'Gebruik geen namen of stemmen van bestaande artiesten.'],
      tip: 'Schrijf zelf de songtekst voor een persoonlijk resultaat.',
    },
    en: {
      what: 'Let AI make music or a song: you describe the style and topic and get a track with or without vocals.',
      steps: ['Describe style, mood and topic, for example: cheerful birthday song, pop.', 'Make a few versions and pick the best.', 'Download the track and check what you may use it for.'],
      watch: ['Check whether you may use the music commercially; it depends on the plan.', 'Do not use names or voices of existing artists.'],
      tip: 'Write the lyrics yourself for a personal result.',
    },
  },
  'translate-and-dub-videos': {
    nl: {
      what: 'Je video in een andere taal laten spreken: AI vertaalt wat er gezegd wordt en spreekt het in, soms met je eigen stem en passende lipbewegingen.',
      steps: ['Upload je video en kies de talen.', 'Controleer de vertaalde tekst voordat hij wordt ingesproken.', 'Luister het resultaat terug en publiceer per taal.'],
      watch: ['Laat een moedertaalspreker meekijken bij belangrijke video’s.', 'Gebruik de stem van iemand anders alleen met toestemming.'],
      tip: 'Begin met je best bekeken video en kijk of het in die taal aanslaat.',
    },
    en: {
      what: 'Make your video speak another language: AI translates what is said and voices it, sometimes in your own voice with matching lip movements.',
      steps: ['Upload your video and pick the languages.', 'Check the translated text before it is voiced.', 'Listen back and publish per language.'],
      watch: ['Have a native speaker review important videos.', 'Only use someone else’s voice with permission.'],
      tip: 'Start with your most-watched video and see how it does in that language.',
    },
  },
  'research-with-sources': {
    nl: {
      what: 'Informatie opzoeken met een AI die zijn bronnen noemt, zodat je kunt nagaan waar een antwoord vandaan komt.',
      steps: ['Stel je vraag zo precies mogelijk, met land en periode.', 'Open de genoemde bronnen en lees de belangrijkste zelf.', 'Vergelijk minstens twee onafhankelijke bronnen voordat je iets overneemt.'],
      watch: ['AI kan bronnen verkeerd samenvatten; de bron zelf is leidend.', 'Recente gebeurtenissen kloppen niet altijd; kijk naar de datum.'],
      tip: 'Vraag de AI ook naar tegenargumenten; dan zie je het hele beeld.',
    },
    en: {
      what: 'Look things up with an AI that cites its sources, so you can check where an answer comes from.',
      steps: ['Ask your question as precisely as possible, with country and period.', 'Open the cited sources and read the key ones yourself.', 'Compare at least two independent sources before you use something.'],
      watch: ['AI can summarise sources wrongly; the source itself is what counts.', 'Recent events are not always right; check the date.'],
      tip: 'Ask the AI for counterarguments too; you will see the full picture.',
    },
  },
  'literature-review': {
    nl: {
      what: 'Wetenschappelijke artikelen vinden en begrijpen voor je studie of onderzoek. AI zoekt relevante papers, vat ze samen en laat zien wat studies concluderen.',
      steps: ['Formuleer je onderzoeksvraag in één zin.', 'Laat AI relevante studies zoeken en lees de samenvattingen.', 'Open de belangrijkste papers zelf en noteer de bronnen netjes.'],
      watch: ['Citeer altijd het originele artikel, nooit de AI-samenvatting.', 'Kijk naar het soort studie en de omvang: niet elk onderzoek weegt even zwaar.'],
      tip: 'Vraag naar studies die elkaar tegenspreken; daar zit vaak je discussie.',
    },
    en: {
      what: 'Find and understand scientific papers for your studies or research. AI searches relevant papers, summarises them and shows what studies conclude.',
      steps: ['Phrase your research question in one sentence.', 'Let AI find relevant studies and read the summaries.', 'Open the key papers yourself and note your sources properly.'],
      watch: ['Always cite the original paper, never the AI summary.', 'Look at the study type and size: not all research carries the same weight.'],
      tip: 'Ask for studies that contradict each other; that is often where your discussion is.',
    },
  },
  'design-logo-and-brand': {
    nl: {
      what: 'Een logo en huisstijl ontwerpen met AI: je geeft je bedrijfsnaam en stijl, AI maakt voorstellen voor logo, kleuren en lettertypes.',
      steps: ['Schrijf op wat je bedrijf doet en welke uitstraling je zoekt.', 'Laat AI logo’s voorstellen en kies er twee of drie.', 'Kies je favoriet en download hem in alle formaten die je nodig hebt.'],
      watch: ['Controleer of je logo niet lijkt op dat van een ander bedrijf.', 'Lees of je volledige rechten krijgt op het logo.'],
      tip: 'Een eenvoudig logo werkt het best, van visitekaartje tot app-icoon.',
    },
    en: {
      what: 'Design a logo and brand style with AI: you give your business name and style, AI suggests logos, colours and fonts.',
      steps: ['Write down what your business does and the look you want.', 'Let AI suggest logos and shortlist two or three.', 'Pick your favourite and download it in every format you need.'],
      watch: ['Check that your logo does not resemble another company’s.', 'Check that you get full rights to the logo.'],
      tip: 'A simple logo works best, from business card to app icon.',
    },
  },
  'email-marketing': {
    nl: {
      what: 'Nieuwsbrieven en e-mails naar klanten sturen. AI helpt met teksten, onderwerpregels en het automatisch versturen van reeksen, zoals een welkomstmail.',
      steps: ['Kies een e-maildienst en zet een aanmeldformulier op je site.', 'Laat AI een eerste nieuwsbrief schrijven en maak hem persoonlijk.', 'Verstuur op een vast moment en kijk welke onderwerpen worden geopend.'],
      watch: ['Mail alleen mensen die zich zelf hebben aangemeld (AVG) en bied altijd afmelden aan.', 'Veel diensten zijn gratis tot een bepaald aantal contacten.'],
      tip: 'Een welkomstmail die direct na aanmelden verstuurd wordt, wordt het best gelezen.',
    },
    en: {
      what: 'Send newsletters and e-mails to customers. AI helps with copy, subject lines and automatic sequences such as a welcome e-mail.',
      steps: ['Pick an e-mail service and put a sign-up form on your site.', 'Let AI write a first newsletter and make it personal.', 'Send at a fixed time and see which subjects get opened.'],
      watch: ['Only e-mail people who signed up themselves (GDPR) and always offer unsubscribe.', 'Many services are free up to a number of contacts.'],
      tip: 'A welcome e-mail sent right after sign-up is the most-read e-mail.',
    },
  },
  'analyze-data': {
    nl: {
      what: 'Je cijfers begrijpen zonder formules: upload een spreadsheet en stel vragen in gewone taal, AI rekent en maakt grafieken.',
      steps: ['Maak je spreadsheet netjes: één tabel, duidelijke kolomnamen.', 'Upload hem en stel een concrete vraag, zoals: welke maand verkocht het best?', 'Controleer een paar uitkomsten zelf voordat je conclusies trekt.'],
      watch: ['Upload geen persoonsgegevens of vertrouwelijke cijfers zonder toestemming.', 'AI kan rekenfouten maken of kolommen verkeerd lezen.'],
      tip: 'Vraag de AI hoe hij tot het antwoord kwam; zo leer je zelf ook.',
    },
    en: {
      what: 'Understand your numbers without formulas: upload a spreadsheet and ask questions in plain language, AI calculates and makes charts.',
      steps: ['Tidy your spreadsheet: one table, clear column names.', 'Upload it and ask a concrete question, such as: which month sold best?', 'Check a few results yourself before drawing conclusions.'],
      watch: ['Do not upload personal or confidential data without permission.', 'AI can miscalculate or misread columns.'],
      tip: 'Ask the AI how it got the answer; you will learn too.',
    },
  },
  'write-marketing-copy': {
    nl: {
      what: 'Wervende teksten voor je website, advertenties, productpagina’s en social media, in de toon die bij jouw merk past.',
      steps: ['Beschrijf je klant, je product en wat het oplevert.', 'Laat AI een paar varianten schrijven en kies de beste.', 'Maak hem van jou: eigen woorden, echte voorbeelden, geen overdrijving.'],
      watch: ['Beloof niets wat je product niet waarmaakt; dat is misleidend.', 'Controleer of claims kloppen, zoals ‘de beste’ of ‘gratis’.'],
      tip: 'Geef AI een tekst die je goed vindt als voorbeeld van je toon.',
    },
    en: {
      what: 'Persuasive copy for your website, ads, product pages and social media, in the tone of your brand.',
      steps: ['Describe your customer, your product and what it achieves.', 'Let AI write a few variants and pick the best.', 'Make it yours: your own words, real examples, no exaggeration.'],
      watch: ['Do not promise what your product does not deliver; that is misleading.', 'Check claims such as ‘the best’ or ‘free’.'],
      tip: 'Give AI a text you like as an example of your tone.',
    },
  },
  'generate-images': {
    nl: {
      what: 'Afbeeldingen laten maken door AI op basis van een beschrijving: van illustraties en sfeerbeelden tot fantasieplaatjes.',
      steps: ['Beschrijf wat je wilt zien: onderwerp, stijl, kleuren en sfeer.', 'Maak een paar varianten en pas je beschrijving aan tot het klopt.', 'Download in de juiste maat voor waar je hem gebruikt.'],
      watch: ['Maak geen beelden van echte personen zonder toestemming, en geen misleidende ‘echte’ foto’s.', 'Lees of je de beelden commercieel mag gebruiken.'],
      tip: 'Hoe concreter je beschrijving, hoe beter het resultaat.',
    },
    en: {
      what: 'Let AI create images from a description: illustrations, mood images or fantasy pictures.',
      steps: ['Describe what you want to see: subject, style, colours and mood.', 'Make a few variants and refine your description until it fits.', 'Download in the right size for where you will use it.'],
      watch: ['Do not create images of real people without consent, or misleading ‘real’ photos.', 'Check whether you may use the images commercially.'],
      tip: 'The more concrete your description, the better the result.',
    },
  },
  'training-videos-ai-presenter': {
    nl: {
      what: 'Uitleg- en trainingsvideo’s met een digitale presentator: je schrijft de tekst, een AI-avatar spreekt hem in beeld uit, in meerdere talen.',
      steps: ['Schrijf een kort script per onderwerp, maximaal een paar minuten.', 'Kies een avatar en stem, en voeg dia’s of schermbeelden toe.', 'Bekijk de video, pas de uitspraak aan waar nodig en deel hem.'],
      watch: ['Gebruik een avatar van een echt persoon alleen met diens toestemming.', 'Vertel kijkers dat de presentator door AI is gemaakt.'],
      tip: 'Korte video’s per onderwerp werken beter dan één lange training.',
    },
    en: {
      what: 'Explainer and training videos with a digital presenter: you write the text, an AI avatar presents it on screen, in several languages.',
      steps: ['Write a short script per topic, a few minutes at most.', 'Pick an avatar and voice, and add slides or screenshots.', 'Watch the video, fix pronunciation where needed and share it.'],
      watch: ['Only use an avatar of a real person with their consent.', 'Tell viewers the presenter is AI-generated.'],
      tip: 'Short videos per topic work better than one long training.',
    },
  },
  'create-ai-voiceovers': {
    nl: {
      what: 'Een tekst laten inspreken door een natuurlijk klinkende AI-stem, voor video’s, uitleg, reclame of luisterboeken.',
      steps: ['Schrijf je tekst zoals je hem wilt horen, met korte zinnen.', 'Kies een stem en taal, en luister een paar varianten.', 'Pas tempo en klemtoon aan en download het geluidsbestand.'],
      watch: ['Kloon nooit iemands stem zonder uitdrukkelijke toestemming.', 'Controleer of je de stem commercieel mag gebruiken.'],
      tip: 'Controleer namen en vaktermen: die spreekt AI weleens verkeerd uit.',
    },
    en: {
      what: 'Have a text read by a natural-sounding AI voice, for videos, explainers, ads or audiobooks.',
      steps: ['Write your text the way you want to hear it, in short sentences.', 'Pick a voice and language and listen to a few variants.', 'Adjust pace and emphasis and download the audio file.'],
      watch: ['Never clone someone’s voice without explicit consent.', 'Check whether you may use the voice commercially.'],
      tip: 'Check names and jargon: AI sometimes mispronounces them.',
    },
  },
  'edit-videos-faster': {
    nl: {
      what: 'Video’s monteren met hulp van AI: stiltes en verspreking eruit, automatisch ondertitels en knippen door de tekst aan te passen.',
      steps: ['Zet je beelden in een video-editor met AI-functies.', 'Laat AI stiltes verwijderen en ondertitels maken.', 'Maak de laatste keuzes zelf en exporteer in het juiste formaat.'],
      watch: ['Gratis versies hebben vaak een watermerk of een lagere kwaliteit.', 'Bewaar je originele beelden: AI-bewerkingen zijn niet altijd terug te draaien.'],
      tip: 'Bewerken via de uitgeschreven tekst is de snelste manier voor beginners.',
    },
    en: {
      what: 'Edit videos with AI help: remove silences and slips, get automatic subtitles and cut by editing the text.',
      steps: ['Load your footage into a video editor with AI features.', 'Let AI remove silences and create subtitles.', 'Make the final choices yourself and export in the right format.'],
      watch: ['Free plans often add a watermark or lower the quality.', 'Keep your original footage: AI edits cannot always be undone.'],
      tip: 'Editing through the transcript is the fastest way for beginners.',
    },
  },
  'proofread-writing': {
    nl: {
      what: 'Je teksten foutloos en helder maken: spelling, grammatica en stijl, ook in het Nederlands.',
      steps: ['Plak je tekst of installeer de schrijfhulp in je browser of tekstverwerker.', 'Bekijk de voorgestelde verbeteringen één voor één.', 'Kies wat past bij jouw toon; je hoeft niet alles over te nemen.'],
      watch: ['Plak geen vertrouwelijke teksten in gratis online tools.', 'Een AI-herschrijving kan de betekenis veranderen; lees hem na.'],
      tip: 'Vraag om ‘korter en duidelijker’; dat verbetert de meeste teksten.',
    },
    en: {
      what: 'Make your writing flawless and clear: spelling, grammar and style.',
      steps: ['Paste your text or install the writing assistant in your browser or word processor.', 'Go through the suggested improvements one by one.', 'Pick what fits your tone; you do not have to accept everything.'],
      watch: ['Do not paste confidential texts into free online tools.', 'An AI rewrite can change the meaning; read it back.'],
      tip: 'Ask for ‘shorter and clearer’; it improves most texts.',
    },
  },
  'plan-social-media': {
    nl: {
      what: 'Al je social-mediaberichten op één plek maken, inplannen en bijhouden, voor meerdere kanalen tegelijk.',
      steps: ['Koppel je accounts, zoals Instagram, Facebook en LinkedIn.', 'Maak een weekplanning en laat AI teksten voorstellen.', 'Plan de posts in en bekijk na een maand wat het best werkt.'],
      watch: ['Gratis versies hebben een limiet op accounts of geplande posts.', 'Reageer zelf op reacties; dat kun je niet automatiseren.'],
      tip: 'Plan één vast moment per week om alles in één keer in te plannen.',
    },
    en: {
      what: 'Create, schedule and track all your social media posts in one place, for several channels at once.',
      steps: ['Connect your accounts, such as Instagram, Facebook and LinkedIn.', 'Make a weekly plan and let AI suggest captions.', 'Schedule the posts and after a month see what works best.'],
      watch: ['Free plans limit accounts or scheduled posts.', 'Reply to comments yourself; that cannot be automated.'],
      tip: 'Set one fixed moment a week to schedule everything in one go.',
    },
  },
  'everyday-ai-assistant': {
    nl: {
      what: 'Een AI-assistent is een chatprogramma waaraan je in gewone taal van alles vraagt: een brief schrijven, iets uitgelegd krijgen, ideeën bedenken of een tekst samenvatten.',
      steps: ['Maak een gratis account bij een bekende AI-assistent.', 'Stel een vraag zoals je die aan een slimme collega zou stellen, met wat achtergrond.', 'Vraag door: ‘korter’, ‘eenvoudiger’ of ‘geef drie opties’.'],
      watch: ['AI kan zelfverzekerd fouten maken: controleer belangrijke feiten.', 'Deel geen wachtwoorden, BSN of vertrouwelijke bedrijfsgegevens.'],
      tip: 'Hoe meer context je geeft (voor wie, waarom, welke toon), hoe beter het antwoord.',
    },
    en: {
      what: 'An AI assistant is a chat program you can ask anything in plain language: write a letter, explain something, brainstorm or summarise a text.',
      steps: ['Create a free account with a well-known AI assistant.', 'Ask a question the way you would ask a smart colleague, with some background.', 'Follow up: ‘shorter’, ‘simpler’ or ‘give three options’.'],
      watch: ['AI can be confidently wrong: check important facts.', 'Do not share passwords, ID numbers or confidential business data.'],
      tip: 'The more context you give (who for, why, which tone), the better the answer.',
    },
  },
  'local-private-ai': {
    nl: {
      what: 'AI op je eigen computer laten draaien, zonder internet of cloud. Je gegevens verlaten je apparaat niet.',
      steps: ['Installeer een programma waarmee je open taalmodellen lokaal draait.', 'Download een klein model dat past bij het geheugen van je computer.', 'Stel je vragen gewoon in het programma; alles blijft lokaal.'],
      watch: ['Lokale modellen zijn vaak minder slim dan de grote clouddiensten.', 'Je hebt een redelijk snelle computer met genoeg geheugen nodig.'],
      tip: 'Begin met een klein model; grotere modellen zijn trager en hebben meer geheugen nodig.',
    },
    en: {
      what: 'Run AI on your own computer, without internet or cloud. Your data never leaves your device.',
      steps: ['Install an app that runs open language models locally.', 'Download a small model that fits your computer’s memory.', 'Ask your questions in the app; everything stays local.'],
      watch: ['Local models are often less capable than the big cloud services.', 'You need a reasonably fast computer with enough memory.'],
      tip: 'Start with a small model; bigger ones are slower and need more memory.',
    },
  },
  'transcribe-audio': {
    nl: {
      what: 'Opnames automatisch laten uitschrijven: interviews, colleges, spraakmemo’s of gesprekken worden tekst, ook in het Nederlands.',
      steps: ['Upload je opname of neem direct op in de app.', 'Kies de taal en laat de tekst maken.', 'Lees de tekst na en verbeter namen en vaktermen.'],
      watch: ['Vraag toestemming aan de mensen die je opneemt.', 'Let op waar gevoelige opnames worden opgeslagen.'],
      tip: 'Een rustige ruimte en de microfoon dicht bij de spreker geven een veel betere tekst.',
    },
    en: {
      what: 'Have recordings transcribed automatically: interviews, lectures, voice memos or conversations become text.',
      steps: ['Upload your recording or record directly in the app.', 'Pick the language and let it create the text.', 'Read the text back and fix names and jargon.'],
      watch: ['Ask the people you record for permission.', 'Check where sensitive recordings are stored.'],
      tip: 'A quiet room and the microphone close to the speaker give a much better transcript.',
    },
  },
  'write-cv-and-application': {
    nl: {
      what: 'Je cv verbeteren en een sollicitatiebrief schrijven die past bij de vacature, met hulp van een AI-assistent.',
      steps: ['Geef de AI de vacaturetekst en je huidige cv.', 'Vraag welke ervaring je moet benadrukken en laat een brief opstellen.', 'Maak het persoonlijk en controleer elk feit over jezelf.'],
      watch: ['Verzin geen ervaring of diploma’s; dat komt uit in het gesprek.', 'Haal je BSN en andere gevoelige gegevens uit je cv voordat je het deelt.'],
      tip: 'Laat de AI ook oefenvragen voor het sollicitatiegesprek bedenken.',
    },
    en: {
      what: 'Improve your CV and write a cover letter that matches the vacancy, with help from an AI assistant.',
      steps: ['Give the AI the job ad and your current CV.', 'Ask which experience to highlight and let it draft a letter.', 'Make it personal and check every fact about yourself.'],
      watch: ['Never invent experience or degrees; it will come out in the interview.', 'Remove ID numbers and other sensitive data from your CV before sharing it.'],
      tip: 'Ask the AI for practice questions for the job interview too.',
    },
  },
  'summarize-documents': {
    nl: {
      what: 'Lange documenten zoals pdf’s, rapporten en contracten laten samenvatten, en er vragen over stellen alsof je met het document praat.',
      steps: ['Upload het document in een AI-assistent die bestanden leest.', 'Vraag om een samenvatting in een paar punten.', 'Stel vervolgvragen en laat aanwijzen waar in het document het staat.'],
      watch: ['Upload geen vertrouwelijke documenten naar een dienst die ermee traint.', 'Een samenvatting kan iets belangrijks missen; lees bij twijfel het origineel.'],
      tip: 'Vraag: ‘Wat zijn de drie belangrijkste punten voor mij als …?’',
    },
    en: {
      what: 'Get long documents such as PDFs, reports and contracts summarised, and ask questions as if you were talking to the document.',
      steps: ['Upload the document to an AI assistant that reads files.', 'Ask for a summary in a few points.', 'Ask follow-up questions and have it point to where in the document it says so.'],
      watch: ['Do not upload confidential documents to a service that trains on them.', 'A summary can miss something important; read the original when in doubt.'],
      tip: 'Ask: ‘What are the three key points for me as …?’',
    },
  },
  'translate-texts': {
    nl: {
      what: 'Teksten, e-mails en hele documenten vertalen, met behoud van toon en opmaak.',
      steps: ['Plak je tekst of upload het document.', 'Kies de taal en eventueel formeel of informeel.', 'Laat belangrijke teksten nalezen door iemand die de taal goed kent.'],
      watch: ['Juridische of medische teksten vragen om een professionele vertaler.', 'Plak geen vertrouwelijke teksten in gratis online vertalers.'],
      tip: 'Vertaal korte stukken tegelijk; dan kun je makkelijker controleren.',
    },
    en: {
      what: 'Translate texts, e-mails and whole documents while keeping tone and layout.',
      steps: ['Paste your text or upload the document.', 'Pick the language and, if offered, formal or informal.', 'Have important texts reviewed by someone fluent in the language.'],
      watch: ['Legal or medical texts call for a professional translator.', 'Do not paste confidential texts into free online translators.'],
      tip: 'Translate shorter pieces at a time; they are easier to check.',
    },
  },
  'write-emails-faster': {
    nl: {
      what: 'E-mails sneller schrijven en beantwoorden: jij geeft de kern, AI maakt er een heldere mail van in de juiste toon.',
      steps: ['Schrijf in een paar woorden wat je wilt zeggen.', 'Laat AI er een mail van maken en kies de toon.', 'Lees hem na en verstuur hem zelf.'],
      watch: ['Controleer namen, datums en bedragen voordat je verstuurt.', 'Laat AI niet zelfstandig mails versturen namens jou.'],
      tip: 'Maak vaste sjablonen voor mails die je vaak stuurt.',
    },
    en: {
      what: 'Write and answer e-mails faster: you give the gist, AI turns it into a clear e-mail in the right tone.',
      steps: ['Write in a few words what you want to say.', 'Let AI turn it into an e-mail and choose the tone.', 'Read it back and send it yourself.'],
      watch: ['Check names, dates and amounts before sending.', 'Do not let AI send e-mails on your behalf on its own.'],
      tip: 'Create templates for e-mails you send often.',
    },
  },
  'remove-image-background': {
    nl: {
      what: 'De achtergrond van een foto in één klik weghalen of vervangen, bijvoorbeeld voor productfoto’s, profielfoto’s of ontwerpen.',
      steps: ['Upload je foto.', 'Laat de achtergrond verwijderen en controleer de randen.', 'Download als png met doorzichtige achtergrond, of kies een nieuwe achtergrond.'],
      watch: ['Haar en doorzichtige voorwerpen gaan soms niet perfect; zoom in.', 'Gratis versies leveren soms een lagere resolutie.'],
      tip: 'Een foto met duidelijk contrast tussen onderwerp en achtergrond geeft het beste resultaat.',
    },
    en: {
      what: 'Remove or replace the background of a photo in one click, for product photos, profile pictures or designs.',
      steps: ['Upload your photo.', 'Let it remove the background and check the edges.', 'Download as a PNG with a transparent background, or choose a new background.'],
      watch: ['Hair and transparent objects are not always perfect; zoom in.', 'Free plans sometimes give a lower resolution.'],
      tip: 'A photo with clear contrast between subject and background gives the best result.',
    },
  },
  'improve-photos': {
    nl: {
      what: 'Foto’s scherper, groter of mooier maken met AI, oude foto’s herstellen of storende dingen wegpoetsen.',
      steps: ['Upload de foto in de hoogste kwaliteit die je hebt.', 'Kies wat je wilt: vergroten, verscherpen, herstellen of iets weghalen.', 'Vergelijk met het origineel en bewaar allebei.'],
      watch: ['AI kan details verzinnen, zoals gezichten of tekst: kijk goed.', 'Bewerk geen foto’s zo dat ze iets misleidends laten zien.'],
      tip: 'Vergroot in kleine stappen; dan blijft het natuurlijker.',
    },
    en: {
      what: 'Make photos sharper, larger or nicer with AI, restore old photos or remove distracting objects.',
      steps: ['Upload the photo in the best quality you have.', 'Choose what you want: enlarge, sharpen, restore or remove something.', 'Compare with the original and keep both.'],
      watch: ['AI can invent details such as faces or text: look closely.', 'Do not edit photos so they show something misleading.'],
      tip: 'Enlarge in small steps; it stays more natural.',
    },
  },
  'add-subtitles-to-videos': {
    nl: {
      what: 'Automatisch ondertitels maken voor je video’s, in dezelfde taal of vertaald, zodat iedereen kan meekijken, ook zonder geluid.',
      steps: ['Upload je video en kies de gesproken taal.', 'Laat de ondertitels maken en verbeter namen en vaktermen.', 'Kies een leesbare stijl en exporteer, of download een ondertitelbestand.'],
      watch: ['Controleer altijd de tekst: een verkeerd woord valt meteen op.', 'Houd regels kort, zodat ze goed te lezen zijn op een telefoon.'],
      tip: 'Ondertitels maken je video’s ook toegankelijk voor doven en slechthorenden.',
    },
    en: {
      what: 'Create subtitles for your videos automatically, in the same language or translated, so everyone can follow, even without sound.',
      steps: ['Upload your video and pick the spoken language.', 'Let it create subtitles and fix names and jargon.', 'Choose a readable style and export, or download a subtitle file.'],
      watch: ['Always check the text: a wrong word stands out.', 'Keep lines short so they are easy to read on a phone.'],
      tip: 'Subtitles also make your videos accessible to deaf and hard-of-hearing viewers.',
    },
  },
  'study-with-ai': {
    nl: {
      what: 'Leren met AI als geduldige bijlesdocent: uitleg in eenvoudige woorden, oefenvragen en samenvattingen van je lesstof.',
      steps: ['Vraag om uitleg van een onderwerp ‘alsof ik 12 ben’ en vraag daarna door.', 'Laat oefenvragen maken van je aantekeningen en beantwoord ze zelf.', 'Controleer met je boek of docent als iets anders klinkt dan je geleerd hebt.'],
      watch: ['Houd je aan de regels van je school over AI bij opdrachten.', 'AI kan fouten maken, ook bij rekenen: reken belangrijke antwoorden na.'],
      tip: 'Laat AI je overhoren in plaats van het antwoord te geven; zo leer je het meest.',
    },
    en: {
      what: 'Learn with AI as a patient tutor: plain-language explanations, practice questions and summaries of your study material.',
      steps: ['Ask for an explanation ‘as if I were 12’ and keep asking.', 'Let it make practice questions from your notes and answer them yourself.', 'Check with your book or teacher when something sounds different from what you learned.'],
      watch: ['Follow your school’s rules on AI for assignments.', 'AI makes mistakes, also in maths: double-check important answers.'],
      tip: 'Let AI quiz you instead of giving the answer; that is how you learn most.',
    },
  },
  'prepare-lessons': {
    nl: {
      what: 'Sneller lessen voorbereiden: lesplannen, opdrachten, toetsvragen en presentaties, afgestemd op niveau en leerdoelen.',
      steps: ['Geef het vak, het niveau en het leerdoel van de les.', 'Laat een lesopzet, opdrachten en toetsvragen maken.', 'Pas aan op je klas en controleer de inhoud op juistheid.'],
      watch: ['Voer geen namen of gegevens van leerlingen in.', 'Controleer feiten en bronnen; AI kan onjuiste voorbeelden geven.'],
      tip: 'Vraag om drie niveaus van dezelfde opdracht; dat maakt differentiëren makkelijk.',
    },
    en: {
      what: 'Prepare lessons faster: lesson plans, assignments, test questions and slides, matched to level and learning goals.',
      steps: ['Give the subject, level and learning goal of the lesson.', 'Let it draft a lesson plan, assignments and test questions.', 'Adapt to your class and check the content for accuracy.'],
      watch: ['Do not enter names or data of students.', 'Check facts and sources; AI can give wrong examples.'],
      tip: 'Ask for three levels of the same assignment; it makes differentiation easy.',
    },
  },
  'write-book-or-story': {
    nl: {
      what: 'Een boek, verhaal of gedicht schrijven met AI als sparringpartner: voor ideeën, een plot, feedback en redactie.',
      steps: ['Beschrijf je idee, je lezers en de sfeer van het verhaal.', 'Werk met AI een plot of hoofdstukindeling uit.', 'Schrijf zelf en gebruik AI voor feedback en het laatste redactiewerk.'],
      watch: ['Je eigen stem maakt het verhaal; laat AI niet alles schrijven.', 'Uitgevers en schrijfwedstrijden hebben regels over AI-gebruik: lees die.'],
      tip: 'Vraag AI om kritische feedback als een strenge redacteur.',
    },
    en: {
      what: 'Write a book, story or poem with AI as a sparring partner: for ideas, a plot, feedback and editing.',
      steps: ['Describe your idea, your readers and the mood of the story.', 'Work out a plot or chapter outline with AI.', 'Write it yourself and use AI for feedback and final editing.'],
      watch: ['Your own voice makes the story; do not let AI write everything.', 'Publishers and writing contests have rules on AI use: read them.'],
      tip: 'Ask AI for critical feedback like a strict editor.',
    },
  },
  'clean-up-audio': {
    nl: {
      what: 'Slechte opnames laten klinken als in een studio: AI haalt ruis, galm en storende geluiden weg.',
      steps: ['Upload je opname.', 'Laat AI de spraak verbeteren en ruis verwijderen.', 'Luister terug en kies de sterkte die natuurlijk klinkt.'],
      watch: ['Te sterk filteren laat stemmen blikkerig klinken.', 'Een goede microfoon en een stille ruimte blijven de basis.'],
      tip: 'Bewaar altijd de originele opname.',
    },
    en: {
      what: 'Make poor recordings sound studio-like: AI removes noise, echo and distracting sounds.',
      steps: ['Upload your recording.', 'Let AI enhance the speech and remove noise.', 'Listen back and pick the strength that sounds natural.'],
      watch: ['Too much filtering makes voices sound tinny.', 'A good microphone and a quiet room are still the basis.'],
      tip: 'Always keep the original recording.',
    },
  },
  'create-social-media-posts': {
    nl: {
      what: 'Opvallende posts voor Instagram, Facebook en LinkedIn maken: beeld en tekst, in je eigen huisstijl.',
      steps: ['Kies een sjabloon in je eigen kleuren en lettertype.', 'Laat AI een tekst en een passend beeld voorstellen.', 'Maak een paar posts tegelijk en plan ze in.'],
      watch: ['Gebruik alleen beelden die je mag gebruiken.', 'Houd tekst op het beeld kort en leesbaar op een telefoon.'],
      tip: 'Vaste sjablonen maken je herkenbaar en besparen tijd.',
    },
    en: {
      what: 'Create eye-catching posts for Instagram, Facebook and LinkedIn: image and text, in your own brand style.',
      steps: ['Pick a template in your own colours and font.', 'Let AI suggest a caption and a matching image.', 'Make a few posts at once and schedule them.'],
      watch: ['Only use images you are allowed to use.', 'Keep text on the image short and readable on a phone.'],
      tip: 'Fixed templates make you recognisable and save time.',
    },
  },
  'take-notes-and-organize': {
    nl: {
      what: 'Al je notities, ideeën en documenten op één plek, doorzoekbaar en samengevat door AI.',
      steps: ['Kies één notitie-app en zet er je belangrijkste notities in.', 'Maak een paar vaste mappen of labels, niet te veel.', 'Laat AI samenvatten of antwoorden zoeken in je eigen notities.'],
      watch: ['Kijk waar je notities worden opgeslagen en of je ze kunt exporteren.', 'Bewaar geen wachtwoorden in gewone notities.'],
      tip: 'Schrijf elke dag één ding op dat je wilt onthouden; zo groeit je kennisbank vanzelf.',
    },
    en: {
      what: 'All your notes, ideas and documents in one place, searchable and summarised by AI.',
      steps: ['Pick one note app and put your most important notes in it.', 'Create a few fixed folders or tags, not too many.', 'Let AI summarise or find answers in your own notes.'],
      watch: ['Check where your notes are stored and whether you can export them.', 'Do not keep passwords in ordinary notes.'],
      tip: 'Write down one thing a day you want to remember; your knowledge base grows by itself.',
    },
  },
  'make-flyers-and-posters': {
    nl: {
      what: 'Flyers, posters, uitnodigingen en kaarten ontwerpen met sjablonen en AI-beelden, voor print of digitaal.',
      steps: ['Kies een sjabloon in het juiste formaat.', 'Vervang tekst en beelden; laat AI een passende afbeelding maken.', 'Controleer spelling en datums en download als pdf voor de drukker.'],
      watch: ['Voor drukwerk heb je een hoge resolutie en vaak afloop (marge) nodig.', 'Gebruik alleen beelden en lettertypes waarvan je de rechten hebt.'],
      tip: 'Eén grote kop en weinig tekst: een flyer moet in drie seconden duidelijk zijn.',
    },
    en: {
      what: 'Design flyers, posters, invitations and cards with templates and AI images, for print or digital.',
      steps: ['Pick a template in the right size.', 'Replace text and images; let AI create a matching image.', 'Check spelling and dates and download as a PDF for the printer.'],
      watch: ['Print needs high resolution and often bleed (margin).', 'Only use images and fonts you have the rights to.'],
      tip: 'One big headline and little text: a flyer should be clear in three seconds.',
    },
  },
  'generate-ai-videos': {
    nl: {
      what: 'Korte video’s laten maken door AI vanuit een beschrijving of een foto, zonder zelf te filmen.',
      steps: ['Beschrijf de scène: wat gebeurt er, waar, en in welke stijl.', 'Maak een paar korte varianten van enkele seconden.', 'Zet de beste clips achter elkaar in een video-editor en voeg geluid toe.'],
      watch: ['Maak geen video’s van echte personen zonder toestemming, en geen misleidende ‘echte’ beelden.', 'Vermeld dat beelden door AI zijn gemaakt; de Europese AI-verordening verplicht dat bij deepfakes.'],
      tip: 'Begin vanaf een foto; dat geeft meer controle dan alleen tekst.',
    },
    en: {
      what: 'Let AI make short videos from a description or a photo, without filming.',
      steps: ['Describe the scene: what happens, where, and in which style.', 'Make a few short variants of a few seconds.', 'Put the best clips together in a video editor and add sound.'],
      watch: ['Do not make videos of real people without consent, or misleading ‘real’ footage.', 'Say that the footage is AI-generated; the EU AI Act requires this for deepfakes.'],
      tip: 'Start from a photo; it gives more control than text alone.',
    },
  },
  'write-business-plan': {
    nl: {
      what: 'Een ondernemingsplan opstellen met AI als sparringpartner: idee, markt, concurrentie, cijfers en een pitch voor de bank of investeerders.',
      steps: ['Beschrijf je idee, je klant en wat je anders doet dan anderen.', 'Laat AI een opzet maken en werk elk hoofdstuk samen uit.', 'Reken de cijfers zelf na en laat het plan lezen door een ondernemer of adviseur.'],
      watch: ['AI verzint soms marktcijfers: zoek echte bronnen, bijvoorbeeld bij het CBS of de KVK.', 'Een bank kijkt vooral naar realistische cijfers en je eigen inbreng.'],
      tip: 'De KVK en je bank hebben vaak gratis voorbeeldplannen; gebruik die als basis.',
    },
    en: {
      what: 'Draft a business plan with AI as a sparring partner: idea, market, competition, numbers and a pitch for the bank or investors.',
      steps: ['Describe your idea, your customer and what you do differently.', 'Let AI draft an outline and work out each chapter together.', 'Check the numbers yourself and have the plan read by an entrepreneur or adviser.'],
      watch: ['AI sometimes invents market figures: find real sources, such as official statistics.', 'A bank mostly looks at realistic numbers and your own contribution.'],
      tip: 'Chambers of commerce and banks often have free sample plans; use one as your base.',
    },
  },
  'connect-llm-api': {
    nl: {
      what: 'Een taalmodel (LLM) gebruiken in je eigen app of workflow via een API: je stuurt tekst naar het model en krijgt een antwoord terug, per gebruik betaald.',
      steps: ['Kies een aanbieder en maak een API-sleutel aan; zet een uitgavenlimiet.', 'Test je prompt eerst in de testomgeving (playground) van de aanbieder.', 'Koppel via de officiële SDK of een automatiseringstool en log kosten en fouten.'],
      watch: ['Bewaar je API-sleutel nooit in de browser of in openbare code.', 'Controleer of je data voor training wordt gebruikt en waar ze wordt verwerkt (AVG).'],
      tip: 'Begin met een klein, goedkoop model en stap alleen over als de kwaliteit tekortschiet.',
    },
    en: {
      what: 'Use a language model (LLM) in your own app or workflow via an API: you send text to the model and get an answer back, paid per use.',
      steps: ['Pick a provider, create an API key and set a spending limit.', 'Test your prompt in the provider’s playground first.', 'Connect through the official SDK or an automation tool, and log costs and errors.'],
      watch: ['Never put your API key in the browser or in public code.', 'Check whether your data is used for training and where it is processed (GDPR).'],
      tip: 'Start with a small, cheap model and only move up when the quality falls short.',
    },
  },
};

/** The guide for a task in this locale, falling back to English, then Dutch. */
export function taskGuide(taskId: string, locale: Locale): TaskGuide | null {
  const g = TASK_GUIDES[taskId];
  if (!g) return null;
  return g[locale] ?? g.en ?? g.nl ?? null;
}
