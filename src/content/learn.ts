/**
 * "AI for beginners": short guides in plain language. General advice only;
 * which tools fit a task comes from the engine, with sources. Legal topics
 * are explained in general terms and are not legal advice.
 */
import type { Locale } from '@/i18n/config';

export interface LearnSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface LearnGuide {
  id: string;
  /** Related tasks (their guides and tools). */
  tasks: string[];
  minutes: number;
  text: Partial<Record<Locale, { slug: string; title: string; summary: string; sections: LearnSection[] }>>;
}

export const LEARN: LearnGuide[] = [
  {
    id: 'what-is-ai',
    tasks: ['everyday-ai-assistant'],
    minutes: 3,
    text: {
      nl: {
        slug: 'wat-is-ai',
        title: 'Wat is AI (en wat niet)?',
        summary: 'In gewone taal: wat AI is, waar het goed in is, waar niet, en hoe je begint.',
        sections: [
          { heading: 'In één zin', paragraphs: ['AI is software die van heel veel voorbeelden heeft geleerd om taken te doen die vroeger mensenwerk waren: schrijven, samenvatten, vertalen, beelden maken of gesprekken uitschrijven.'] },
          {
            heading: 'Hoe werkt een AI-chatbot?',
            paragraphs: [
              'Achter een chatbot zit een taalmodel. Dat heeft enorm veel tekst gelezen en voorspelt telkens het meest passende volgende woord. Daardoor klinkt het antwoord als dat van een mens.',
              'Maar een taalmodel ‘weet’ niet zoals wij iets weten. Het kan daarom ook fouten maken, met grote stelligheid. Dat heet een hallucinatie.',
            ],
          },
          { heading: 'Waar is AI goed in?', bullets: ['Een eerste versie van een tekst, mail of presentatie', 'Lange teksten samenvatten en moeilijke dingen uitleggen', 'Ideeën bedenken en meedenken', 'Vertalen en herschrijven', 'Beelden, stemmen, muziek en video maken', 'Saaie, terugkerende klusjes automatiseren'] },
          { heading: 'Waar is AI minder goed in?', bullets: ['Actuele feiten zonder bron: controleer ze', 'Precieze berekeningen: reken belangrijke cijfers na', 'Beslissingen met grote gevolgen, zoals medisch, juridisch of financieel', 'Alles met vertrouwelijke of persoonlijke gegevens: denk eerst aan privacy'] },
          { heading: 'Hoe begin je?', paragraphs: ['Kies één taak die je vaak doet, probeer een gratis AI-assistent en controleer het resultaat. Weet je niet waar je moet beginnen? Gebruik onze stap-voor-stapkiezer: je klikt aan wat je wilt doen en krijgt een advies.'] },
        ],
      },
      en: {
        slug: 'what-is-ai',
        title: 'What is AI (and what is it not)?',
        summary: 'In plain language: what AI is, what it is good at, what not, and how to start.',
        sections: [
          { heading: 'In one sentence', paragraphs: ['AI is software that learned from very many examples to do tasks that used to be human work: writing, summarising, translating, making images or transcribing conversations.'] },
          {
            heading: 'How does an AI chatbot work?',
            paragraphs: [
              'Behind a chatbot is a language model. It has read enormous amounts of text and keeps predicting the most fitting next word. That is why its answers sound human.',
              'But a language model does not ‘know’ things the way we do. It can make mistakes with great confidence. That is called a hallucination.',
            ],
          },
          { heading: 'What is AI good at?', bullets: ['A first draft of a text, e-mail or presentation', 'Summarising long texts and explaining difficult things', 'Brainstorming and thinking along', 'Translating and rewriting', 'Making images, voices, music and video', 'Automating boring, repetitive chores'] },
          { heading: 'What is AI less good at?', bullets: ['Current facts without a source: check them', 'Precise calculations: double-check important numbers', 'Decisions with big consequences, such as medical, legal or financial ones', 'Anything with confidential or personal data: think about privacy first'] },
          { heading: 'How to start', paragraphs: ['Pick one task you do often, try a free AI assistant and check the result. Not sure where to start? Use our step-by-step finder: click what you want to do and get advice.'] },
        ],
      },
    },
  },
  {
    id: 'first-week',
    tasks: ['everyday-ai-assistant', 'write-emails-faster', 'summarize-documents'],
    minutes: 4,
    text: {
      nl: {
        slug: 'eerste-week-met-ai',
        title: 'Je eerste week met AI: zeven kleine opdrachten',
        summary: 'Elke dag één kleine opdracht. Na een week weet je waar AI jou echt mee helpt.',
        sections: [
          { heading: 'Wat heb je nodig?', paragraphs: ['Alleen een gratis account bij een AI-assistent. Voer in deze week geen privégegevens of vertrouwelijke informatie in.'] },
          {
            heading: 'De zeven opdrachten',
            bullets: [
              'Dag 1 – Laat een lastige mail herschrijven: ‘Maak deze mail vriendelijker en korter: …’',
              'Dag 2 – Laat een lang artikel samenvatten in vijf punten.',
              'Dag 3 – Vraag uitleg over iets wat je altijd lastig vond: ‘Leg uit wat inflatie is, alsof ik twaalf ben.’',
              'Dag 4 – Brainstorm: ‘Geef tien ideeën voor …’ (een verjaardag, een post, een productnaam).',
              'Dag 5 – Plan iets: een weekmenu, een reis of je werkweek.',
              'Dag 6 – Laat een tekst vertalen en vergelijk het met je eigen vertaling.',
              'Dag 7 – Maak een afbeelding met een beeldgenerator.',
            ],
          },
          { heading: 'En dan?', paragraphs: ['Kijk terug: bij welke opdracht hielp het echt? Die taak is je startpunt. Zoek daarvoor de best passende tool, gratis of betaald.'] },
        ],
      },
      en: {
        slug: 'first-week-with-ai',
        title: 'Your first week with AI: seven small tasks',
        summary: 'One small task a day. After a week you know where AI really helps you.',
        sections: [
          { heading: 'What do you need?', paragraphs: ['Just a free account with an AI assistant. Do not enter private data or confidential information this week.'] },
          {
            heading: 'The seven tasks',
            bullets: [
              'Day 1 – Have a difficult e-mail rewritten: ‘Make this e-mail friendlier and shorter: …’',
              'Day 2 – Have a long article summarised in five points.',
              'Day 3 – Ask for an explanation of something you always found hard: ‘Explain inflation as if I were twelve.’',
              'Day 4 – Brainstorm: ‘Give me ten ideas for …’ (a birthday, a post, a product name).',
              'Day 5 – Plan something: a weekly menu, a trip or your working week.',
              'Day 6 – Have a text translated and compare it with your own translation.',
              'Day 7 – Make an image with an image generator.',
            ],
          },
          { heading: 'And then?', paragraphs: ['Look back: which task did it really help with? That task is your starting point. Find the best-fitting tool for it, free or paid.'] },
        ],
      },
    },
  },
  {
    id: 'good-prompts',
    tasks: ['everyday-ai-assistant', 'write-marketing-copy'],
    minutes: 3,
    text: {
      nl: {
        slug: 'goede-vraag-stellen',
        title: 'Zo stel je een goede vraag aan AI',
        summary: 'Vijf ingrediënten voor een betere prompt, met een voorbeeld.',
        sections: [
          { heading: 'De vijf ingrediënten', bullets: ['Rol: ‘Je bent een ervaren …’', 'Doel: wat wil je bereiken?', 'Context: voor wie is het, wat is de achtergrond?', 'Vorm: lengte, opsomming of tekst, toon', 'Voorbeeld: plak een tekst die je goed vindt'] },
          {
            heading: 'Een voorbeeld',
            paragraphs: [
              'Minder goed: ‘Schrijf een tekst over mijn bakkerij.’',
              'Beter: ‘Schrijf een Instagram-bericht van hooguit 80 woorden voor mijn bakkerij in Utrecht over ons nieuwe zuurdesembrood. Toon: warm en huiselijk. Sluit af met een uitnodiging om zaterdag te komen proeven.’',
            ],
          },
          { heading: 'Vraag door', bullets: ['‘Korter’ of ‘eenvoudiger’', '‘Geef drie varianten’', '‘Stel me eerst drie vragen voordat je begint’', '‘Wat zijn de zwakke punten van dit antwoord?’'] },
          { heading: 'Controleer altijd', paragraphs: ['Lees het resultaat na en controleer namen, cijfers en feiten voordat je het gebruikt.'] },
        ],
      },
      en: {
        slug: 'asking-good-questions',
        title: 'How to ask AI a good question',
        summary: 'Five ingredients for a better prompt, with an example.',
        sections: [
          { heading: 'The five ingredients', bullets: ['Role: ‘You are an experienced …’', 'Goal: what do you want to achieve?', 'Context: who is it for, what is the background?', 'Format: length, bullets or prose, tone', 'Example: paste a text you like'] },
          {
            heading: 'An example',
            paragraphs: [
              'Weaker: ‘Write a text about my bakery.’',
              'Better: ‘Write an Instagram post of at most 80 words for my bakery in Utrecht about our new sourdough bread. Tone: warm and homely. End with an invitation to come and taste it on Saturday.’',
            ],
          },
          { heading: 'Keep asking', bullets: ['‘Shorter’ or ‘simpler’', '‘Give three variants’', '‘Ask me three questions before you start’', '‘What are the weak points of this answer?’'] },
          { heading: 'Always check', paragraphs: ['Read the result and check names, numbers and facts before you use it.'] },
        ],
      },
    },
  },
  {
    id: 'free-or-paid',
    tasks: [],
    minutes: 3,
    text: {
      nl: {
        slug: 'gratis-of-betalen',
        title: 'Gratis of betalen? Zo kies je',
        summary: 'Waar het verschil zit tussen gratis en betaald, en hoe je voorkomt dat je te veel betaalt.',
        sections: [
          { heading: 'Begin gratis', paragraphs: ['De meeste AI-tools hebben een gratis versie of een proefperiode. Probeer eerst of een tool je echt helpt voordat je betaalt.'] },
          { heading: 'Waar zit het verschil?', bullets: ['Limieten: aantal berichten, credits of minuten per maand', 'Kwaliteit: betaalde versies geven vaak toegang tot de nieuwste modellen', 'Watermerk op afbeeldingen of video', 'Of je het resultaat commercieel mag gebruiken', 'Privacy-instellingen en afspraken voor zakelijk gebruik', 'Samenwerken met een team'] },
          { heading: 'Een simpele rekensom', paragraphs: ['Bespaart een tool je per maand meer tijd dan hij kost? Voorbeeld: twee uur per maand keer wat jouw uur waard is. Is dat meer dan de maandprijs, dan loont het.'] },
          { heading: 'Let op bij abonnementen', bullets: ['Maandprijs of jaarprijs (per maand omgerekend)', 'Prijs per gebruiker bij teams', 'Btw: prijzen zijn vaak exclusief', 'Automatisch verlengen en opzegtermijn'] },
          { heading: 'Tip', paragraphs: ['Neem één betaald abonnement op de tool die je het meest gebruikt en stapel geen abonnementen die hetzelfde doen. Onze Stack Doctor laat zien waar je dubbel betaalt.'] },
        ],
      },
      en: {
        slug: 'free-or-paid',
        title: 'Free or paid? How to choose',
        summary: 'What differs between free and paid, and how to avoid paying too much.',
        sections: [
          { heading: 'Start free', paragraphs: ['Most AI tools have a free version or a trial. First check whether a tool really helps before you pay.'] },
          { heading: 'What is the difference?', bullets: ['Limits: number of messages, credits or minutes per month', 'Quality: paid plans often give access to the newest models', 'A watermark on images or video', 'Whether you may use the result commercially', 'Privacy settings and terms for business use', 'Working together as a team'] },
          { heading: 'A simple sum', paragraphs: ['Does a tool save you more time per month than it costs? Example: two hours a month times what your hour is worth. If that is more than the monthly price, it pays off.'] },
          { heading: 'Watch out with subscriptions', bullets: ['Monthly or annual price (converted per month)', 'Price per user for teams', 'VAT: prices are often excluding VAT', 'Automatic renewal and notice period'] },
          { heading: 'Tip', paragraphs: ['Take one paid plan for the tool you use most and do not stack plans that do the same thing. Our Stack Doctor shows where you pay twice.'] },
        ],
      },
    },
  },
  {
    id: 'privacy',
    tasks: ['local-private-ai'],
    minutes: 3,
    text: {
      nl: {
        slug: 'privacy-en-ai',
        title: 'Privacy en AI: wat kun je veilig invoeren?',
        summary: 'Wat je beter niet invoert, hoe je je gegevens beschermt en waar bedrijven op letten.',
        sections: [
          { heading: 'Vuistregel', paragraphs: ['Voer niets in wat je niet op een ansichtkaart zou schrijven, tenzij je weet hoe de dienst ermee omgaat.'] },
          { heading: 'Liever niet invoeren', bullets: ['Wachtwoorden en inloggegevens', 'Je BSN, paspoort- of bankgegevens', 'Medische gegevens', 'Gegevens van klanten, collega’s of leerlingen', 'Vertrouwelijke bedrijfsinformatie'] },
          { heading: 'Wat je kunt doen', bullets: ['Zet ‘training op mijn gegevens’ uit als dat kan', 'Anonimiseer: vervang namen door ‘klant A’', 'Gebruik voor werk een zakelijke versie met een verwerkersovereenkomst', 'Kies voor gevoelige zaken een dienst met dataopslag in de EU, of AI die lokaal op je computer draait'] },
          { heading: 'Voor bedrijven', paragraphs: ['Onder de AVG mag je persoonsgegevens alleen verwerken met een goede reden, en heb je een verwerkersovereenkomst nodig met diensten die ze voor jou verwerken. Maak met je team afspraken over wat wel en niet in AI-tools mag. Dit is algemene informatie, geen juridisch advies.'] },
          { heading: 'Op deze site', paragraphs: ['Bij elke tool tonen we in de EU-lens wat we met een bron hebben vastgelegd, zoals dataopslag in de EU en of een dienst op je gegevens traint.'] },
        ],
      },
      en: {
        slug: 'privacy-and-ai',
        title: 'Privacy and AI: what can you safely enter?',
        summary: 'What better not to enter, how to protect your data and what businesses look at.',
        sections: [
          { heading: 'Rule of thumb', paragraphs: ['Do not enter anything you would not write on a postcard, unless you know how the service handles it.'] },
          { heading: 'Better not to enter', bullets: ['Passwords and login details', 'Your ID, passport or bank details', 'Medical data', 'Data about customers, colleagues or students', 'Confidential business information'] },
          { heading: 'What you can do', bullets: ['Switch off ‘training on my data’ where possible', 'Anonymise: replace names with ‘customer A’', 'For work, use a business version with a data processing agreement', 'For sensitive matters, choose a service with EU data storage, or AI running locally on your computer'] },
          { heading: 'For businesses', paragraphs: ['Under the GDPR you may only process personal data with a valid reason, and you need a data processing agreement with services that process it for you. Agree with your team what may and may not go into AI tools. This is general information, not legal advice.'] },
          { heading: 'On this site', paragraphs: ['For every tool, the EU lens shows what we have recorded with a source, such as EU data storage and whether a service trains on your data.'] },
        ],
      },
    },
  },
  {
    id: 'checking',
    tasks: ['research-with-sources'],
    minutes: 3,
    text: {
      nl: {
        slug: 'ai-antwoorden-controleren',
        title: 'AI-antwoorden controleren: zo herken je fouten',
        summary: 'Een korte checklist om fouten en verzinsels van AI te herkennen.',
        sections: [
          { heading: 'Waarom controleren?', paragraphs: ['AI kan overtuigend klinken en toch fout zitten. Het verzint soms bronnen, cijfers of citaten.'] },
          { heading: 'De checklist', bullets: ['Vraag naar bronnen en open ze zelf', 'Kloppen namen, datums en bedragen?', 'Reken cijfers na', 'Vraag de AI: ‘Wat zijn de zwakke punten van dit antwoord?’', 'Vergelijk met een tweede, onafhankelijke bron', 'Let op of de informatie actueel is'] },
          { heading: 'Rode vlaggen', bullets: ['Een bron die niet te vinden is', 'Heel precieze cijfers zonder bron', 'Tegenstrijdigheden in hetzelfde antwoord', 'Te mooi om waar te zijn'] },
          { heading: 'Wanneer altijd een mens?', paragraphs: ['Bij medisch, juridisch of financieel advies, en bij beslissingen over mensen. Gebruik AI daar hooguit als voorbereiding, nooit als eindoordeel.'] },
        ],
      },
      en: {
        slug: 'checking-ai-answers',
        title: 'Checking AI answers: how to spot mistakes',
        summary: 'A short checklist to spot AI mistakes and made-up facts.',
        sections: [
          { heading: 'Why check?', paragraphs: ['AI can sound convincing and still be wrong. It sometimes invents sources, numbers or quotes.'] },
          { heading: 'The checklist', bullets: ['Ask for sources and open them yourself', 'Are names, dates and amounts right?', 'Recalculate numbers', 'Ask the AI: ‘What are the weak points of this answer?’', 'Compare with a second, independent source', 'Check whether the information is current'] },
          { heading: 'Red flags', bullets: ['A source you cannot find', 'Very precise numbers without a source', 'Contradictions within the same answer', 'Too good to be true'] },
          { heading: 'When should a human always decide?', paragraphs: ['For medical, legal or financial advice, and for decisions about people. Use AI there as preparation at most, never as the final judgement.'] },
        ],
      },
    },
  },
];

export function learnText(g: LearnGuide, locale: Locale) {
  return g.text[locale] ?? g.text.en ?? g.text.nl ?? null;
}

export function findLearnGuide(slug: string, locale: Locale): LearnGuide | undefined {
  return LEARN.find((g) => learnText(g, locale)?.slug === slug) ?? LEARN.find((g) => Object.values(g.text).some((x) => x?.slug === slug));
}
