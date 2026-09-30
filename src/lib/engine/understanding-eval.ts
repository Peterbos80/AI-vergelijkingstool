/**
 * Understanding set: how people without AI knowledge actually phrase what
 * they want (informal words, diminutives, compounds, typos, whole sentences).
 * It measures whether Match understands the goal, separately from the golden
 * set (which checks complete recommendations).
 *
 * These queries are held out: they must never be copied into the intent
 * phrases of data/taxonomy.json (a unit test enforces this), so the score
 * says how well the engine generalises, not how well it memorises.
 */
import type { Locale } from '@/i18n/config';

export interface UnderstandingCase {
  q: string;
  locale: Locale;
  /** Acceptable task ids (any of them is a correct understanding). */
  tasks: string[];
}

const nl = (q: string, ...tasks: string[]): UnderstandingCase => ({ q, locale: 'nl', tasks });
const en = (q: string, ...tasks: string[]): UnderstandingCase => ({ q, locale: 'en', tasks });

export const UNDERSTANDING: UnderstandingCase[] = [
  // Video for social media
  nl('filmpjes maken voor instagram', 'create-social-media-videos', 'edit-videos-faster'),
  nl('ik wil tiktoks maken voor mijn kapsalon', 'create-social-media-videos'),
  nl('reels maken voor mijn bakkerij', 'create-social-media-videos'),
  nl("leuke video's voor op facebook maken", 'create-social-media-videos'),
  nl('hoe maak ik makkelijk een promotiefilmpje', 'create-social-media-videos', 'edit-videos-faster'),
  nl("youtube kanaal starten met video's", 'create-social-media-videos', 'edit-videos-faster'),
  en('make videos for my instagram', 'create-social-media-videos', 'edit-videos-faster'),
  en('tiktok videos for my small business', 'create-social-media-videos'),

  // Long videos → shorts
  nl('mijn podcast knippen in korte clips voor tiktok', 'long-videos-to-shorts'),
  nl('van een webinar korte stukjes maken', 'long-videos-to-shorts'),
  nl('lange youtube video opknippen in shorts', 'long-videos-to-shorts'),
  en('turn my podcast into short clips', 'long-videos-to-shorts'),

  // Website
  nl('ik wil een website maar kan niet programmeren', 'build-website-no-code'),
  nl('site maken voor mijn zzp bedrijf', 'build-website-no-code'),
  nl('hoe maak ik een websiet', 'build-website-no-code'),
  nl('homepage voor mijn fotografie portfolio', 'build-website-no-code'),
  nl('een simpele webpagina voor mijn vereniging', 'build-website-no-code'),
  en('i need a website for my bakery', 'build-website-no-code'),

  // SEO blogs
  nl('beter gevonden worden in google met blogs', 'write-seo-blog-posts'),
  nl('blogjes schrijven voor mijn website', 'write-seo-blog-posts'),
  nl('artikelen schrijven die hoog scoren in google', 'write-seo-blog-posts'),
  en('blog posts that rank on google', 'write-seo-blog-posts'),

  // Meeting notes
  nl('notulen maken van teams vergadering', 'automatic-meeting-notes'),
  nl('iets dat meeluistert met mijn zoom calls en een verslag maakt', 'automatic-meeting-notes'),
  nl('vergaderverslagen automatisch', 'automatic-meeting-notes'),
  nl('actiepunten uit een overleg halen', 'automatic-meeting-notes'),
  nl('vergadering notuleren automaties', 'automatic-meeting-notes'),
  en('take notes during my zoom meetings', 'automatic-meeting-notes'),

  // Product photos
  nl("mooie foto's van mijn producten voor bol.com", 'create-product-photos'),
  nl('productafbeeldingen voor mijn etsy shop', 'create-product-photos'),
  nl("foto's van sieraden professioneel laten lijken", 'create-product-photos', 'improve-photos'),
  en('nice photos of my products for amazon', 'create-product-photos'),

  // Automation
  nl('saaie taken automatisch laten doen', 'automate-work'),
  nl('facturen automatisch verwerken en in excel zetten', 'automate-work'),
  nl('koppelingen maken tussen mijn apps zonder programmeren', 'automate-work'),
  nl('iets zoals zapier maar goedkoper', 'automate-work'),
  en('automate boring tasks', 'automate-work'),

  // Coding
  nl('hulp bij programmeren in python', 'code-with-ai'),
  nl('bugs in mijn code oplossen', 'code-with-ai'),
  nl('beste ai voor programmeurs', 'code-with-ai'),
  en('help me fix bugs in my javascript', 'code-with-ai'),

  // Apps without code
  nl('een app maken voor mijn sportschool zonder te coderen', 'build-app-without-code'),
  nl('ik heb een idee voor een app, hoe maak ik die', 'build-app-without-code'),
  nl('prototype van een app bouwen met ai', 'build-app-without-code'),
  en('create a mobile app with no coding skills', 'build-app-without-code'),

  // Support chatbot
  nl('chatbot op mijn website die vragen van klanten beantwoordt', 'customer-support-chatbot'),
  nl('klantvragen automatisch beantwoorden', 'customer-support-chatbot', 'write-emails-faster'),
  nl('een chatfunctie voor mijn webwinkel', 'customer-support-chatbot'),
  en('answer customer questions automatically', 'customer-support-chatbot'),

  // Presentations
  nl('powerpointje in elkaar zetten voor maandag', 'make-presentations'),
  nl("dia's voor een spreekbeurt", 'make-presentations', 'study-with-ai'),
  nl('presentatie voor mijn werk in elkaar zetten', 'make-presentations'),
  nl('sheets maken voor mijn presentatie', 'make-presentations'),
  nl('presentatei maken', 'make-presentations'),
  en('make a powerpoint', 'make-presentations'),
  en('presentaton slides', 'make-presentations'),

  // Podcast
  nl('ik wil een podcast beginnen', 'produce-podcast'),
  nl('podcast opnemen met gasten op afstand', 'produce-podcast'),
  en('start a podcast', 'produce-podcast'),

  // Music
  nl('liedje maken voor verjaardag van mijn moeder', 'make-music'),
  nl('muziek componeren met ai', 'make-music'),
  nl('een jingle voor mijn bedrijf', 'make-music'),
  nl('songtekst en muziek maken', 'make-music'),
  en('create a song with ai', 'make-music'),

  // Dubbing
  nl('mijn video in het engels laten inspreken', 'translate-and-dub-videos'),
  nl('video nasynchroniseren naar het duits', 'translate-and-dub-videos'),
  en('dub my video into french', 'translate-and-dub-videos'),

  // Research with sources
  nl('betrouwbare informatie opzoeken met bronnen', 'research-with-sources'),
  nl('ai die bronnen vermeldt', 'research-with-sources'),
  nl('iets uitzoeken voor een artikel met bronvermelding', 'research-with-sources'),
  en('find reliable sources for an article', 'research-with-sources'),

  // Literature
  nl('wetenschappelijke artikelen vinden voor mijn onderzoek', 'literature-review'),
  nl('literatuuronderzoek voor mijn thesis', 'literature-review'),
  nl('papers samenvatten voor mijn studie', 'literature-review', 'summarize-documents', 'study-with-ai'),
  en('find peer reviewed papers on sleep', 'literature-review'),

  // Logo
  nl('logootje maken voor mijn bedrijfje', 'design-logo-and-brand'),
  nl('huisstijl ontwerpen', 'design-logo-and-brand'),
  nl('bedrijfslogo laten maken gratis', 'design-logo-and-brand'),
  en('design a logo for my company', 'design-logo-and-brand'),

  // Email marketing
  nl('nieuwsbrief versturen naar mijn klanten', 'email-marketing'),
  nl('goedkoper dan mailchimp', 'email-marketing'),
  nl('mailings sturen naar klanten', 'email-marketing'),
  en('send newsletters to my customers', 'email-marketing'),

  // Data
  nl('excel formules maken', 'analyze-data'),
  nl('grafieken maken van mijn verkoopcijfers', 'analyze-data'),
  nl('mijn spreadsheet laten doorrekenen', 'analyze-data'),
  nl('inzicht in mijn cijfers krijgen', 'analyze-data'),
  en('analyze my sales spreadsheet', 'analyze-data'),

  // Marketing copy
  nl('wervende teksten voor mijn webshop', 'write-marketing-copy'),
  nl('teksten voor mijn producten laten schrijven', 'write-marketing-copy'),
  nl('advertentie tekst voor facebook', 'write-marketing-copy'),
  nl('slogan bedenken', 'write-marketing-copy'),
  en('copy for my online store', 'write-marketing-copy'),

  // Images
  nl('plaatjes maken met ai', 'generate-images'),
  nl('foto laten maken door ai van een kat op de maan', 'generate-images'),
  nl('tekening maken met ai', 'generate-images'),
  nl('ai afbeelding generator gratis', 'generate-images'),
  nl('afbeelding genereeren', 'generate-images'),
  nl("welke ai kan foto's maken", 'generate-images'),
  en('ai picture generator', 'generate-images'),

  // AI presenter
  nl("instructievideo's zonder dat ik zelf in beeld hoef", 'training-videos-ai-presenter'),
  nl('ai avatar die mijn tekst uitspreekt in een video', 'training-videos-ai-presenter'),
  nl("e-learning video's maken voor personeel", 'training-videos-ai-presenter'),
  en('training videos with an avatar', 'training-videos-ai-presenter'),

  // Voice-overs
  nl('tekst laten voorlezen door een ai stem', 'create-ai-voiceovers'),
  nl('ingesproken tekst voor mijn filmpje', 'create-ai-voiceovers'),
  nl('computerstem die natuurlijk klinkt', 'create-ai-voiceovers'),
  nl('stem van mijzelf namaken voor voice-overs', 'create-ai-voiceovers'),
  en('realistic ai voice for my video', 'create-ai-voiceovers'),

  // Video editing
  nl('video bewerken voor beginners', 'edit-videos-faster'),
  nl('vakantiefilmpje monteren', 'edit-videos-faster'),
  nl('trouwvideo knippen en mooi maken', 'edit-videos-faster'),
  en('edit my holiday video', 'edit-videos-faster'),

  // Proofreading
  nl('spelfouten uit mijn tekst halen', 'proofread-writing'),
  nl('mijn nederlands verbeteren in teksten', 'proofread-writing'),
  nl('tekst controleren op fouten', 'proofread-writing'),
  nl('zakelijke brief netter formuleren', 'proofread-writing', 'write-emails-faster'),
  nl('mijn scriptie nakijken op taalfouten', 'proofread-writing'),
  en('fix grammar mistakes in my essay', 'proofread-writing'),

  // Social planning
  nl('berichten inplannen op instagram en linkedin', 'plan-social-media'),
  nl('social media van mijn bedrijf bijhouden', 'plan-social-media'),
  en('schedule instagram posts', 'plan-social-media'),

  // Everyday assistant
  nl('welke chatbot is het beste', 'everyday-ai-assistant'),
  nl('chatgpt gebruiken voor mijn werk', 'everyday-ai-assistant'),
  nl('slimme assistent die me helpt met van alles', 'everyday-ai-assistant'),
  nl('ik wil gewoon ai gebruiken maar weet niet waar te beginnen', 'everyday-ai-assistant'),
  nl('wat is beter chatgpt of gemini', 'everyday-ai-assistant'),
  nl('recepten bedenken met wat ik in huis heb', 'everyday-ai-assistant'),
  nl('reis plannen met ai', 'everyday-ai-assistant'),
  en('which chatbot should i use', 'everyday-ai-assistant'),

  // Local
  nl('ai zonder internet op mijn laptop', 'local-private-ai'),
  nl('chatgpt maar dan privé op eigen computer', 'local-private-ai'),
  en('private ai that runs offline', 'local-private-ai'),

  // Transcription
  nl('spraakmemo omzetten naar tekst', 'transcribe-audio'),
  nl('gesprek uittypen', 'transcribe-audio'),
  nl('opname van een lezing omzetten naar tekst', 'transcribe-audio'),
  en('convert voice memo to text', 'transcribe-audio'),
  en('transcibe interview', 'transcribe-audio'),

  // CV and application
  nl('cv verbeteren', 'write-cv-and-application'),
  nl('sollicitatiebrief schrijven met ai', 'write-cv-and-application'),
  nl('motivatiebrief voor een baan', 'write-cv-and-application'),
  nl('hulp bij solliciteren', 'write-cv-and-application'),
  en('improve my resume', 'write-cv-and-application'),
  en('write a cover letter', 'write-cv-and-application'),

  // Summarise documents
  nl('lange pdf samenvatten', 'summarize-documents'),
  nl('rapport van 80 paginas samenvatten', 'summarize-documents'),
  nl('vragen stellen over een document', 'summarize-documents'),
  nl('boek samenvatting maken', 'summarize-documents', 'study-with-ai'),
  en('summarize a long pdf', 'summarize-documents'),

  // Translate texts
  nl('tekst vertalen naar het engels', 'translate-texts'),
  nl('document vertalen naar frans', 'translate-texts'),
  nl('beter dan google translate', 'translate-texts'),
  en('translate a document to german', 'translate-texts'),

  // E-mail
  nl('e-mails sneller beantwoorden', 'write-emails-faster'),
  nl('hulp bij het schrijven van mails', 'write-emails-faster'),
  nl('nette mail naar mijn baas', 'write-emails-faster'),
  nl('ik wil dat ai mijn mails schrijft', 'write-emails-faster'),
  en('reply to emails faster', 'write-emails-faster'),

  // Background removal
  nl('achtergrond van foto weghalen', 'remove-image-background'),
  nl('foto uitknippen zonder achtergrond', 'remove-image-background'),
  nl('witte achtergrond voor productfoto', 'remove-image-background', 'create-product-photos'),
  en('make the background of my picture transparent', 'remove-image-background'),

  // Improve photos
  nl("oude foto's verbeteren", 'improve-photos'),
  nl('wazige foto scherper maken', 'improve-photos'),
  nl('foto vergroten zonder kwaliteitsverlies', 'improve-photos'),
  nl('iets van een foto weghalen', 'improve-photos'),
  nl("ik ben fotograaf en wil mijn foto's sneller bewerken", 'improve-photos'),
  en('make a blurry photo sharper', 'improve-photos'),

  // Subtitles
  nl('ondertiteling toevoegen aan mijn video', 'add-subtitles-to-videos'),
  nl('automatisch ondertitels maken', 'add-subtitles-to-videos'),
  nl('tekst onder mijn filmpje zetten', 'add-subtitles-to-videos'),
  nl('ondertitels maaken', 'add-subtitles-to-videos'),
  en('add captions to my video', 'add-subtitles-to-videos'),

  // Study
  nl('huiswerk hulp', 'study-with-ai'),
  nl('leren voor mijn tentamen met ai', 'study-with-ai'),
  nl('uitleg over wiskunde', 'study-with-ai'),
  nl('oefenvragen maken van mijn aantekeningen', 'study-with-ai'),
  en('help with homework', 'study-with-ai'),

  // Lessons
  nl('lesmateriaal maken als docent', 'prepare-lessons'),
  nl('ik ben juf en wil lessen voorbereiden', 'prepare-lessons'),
  nl('werkbladen maken voor mijn klas', 'prepare-lessons'),
  en('lesson plans for my class', 'prepare-lessons'),

  // Books and stories
  nl('een boek schrijven met ai', 'write-book-or-story'),
  nl('kinderverhaal schrijven', 'write-book-or-story'),
  nl('hulp bij mijn roman', 'write-book-or-story'),
  en("write a children's book", 'write-book-or-story'),

  // Audio clean-up
  nl('ruis uit opname verwijderen', 'clean-up-audio'),
  nl('geluid van mijn video verbeteren', 'clean-up-audio'),
  nl('echo weghalen uit opname', 'clean-up-audio'),
  en('remove background noise from a recording', 'clean-up-audio'),

  // Social posts (visual)
  nl('instagram posts ontwerpen', 'create-social-media-posts'),
  nl('mooie posts maken voor facebook', 'create-social-media-posts'),
  nl('social media plaatjes met tekst', 'create-social-media-posts'),
  en('design instagram posts', 'create-social-media-posts'),

  // Notes
  nl('notities ordenen', 'take-notes-and-organize'),
  nl('tweede brein opbouwen', 'take-notes-and-organize'),
  nl('al mijn aantekeningen op een plek', 'take-notes-and-organize'),
  en('organize my notes', 'take-notes-and-organize'),

  // Flyers and posters
  nl('flyer maken voor een evenement', 'make-flyers-and-posters'),
  nl('poster ontwerpen', 'make-flyers-and-posters'),
  nl('uitnodiging maken voor een feestje', 'make-flyers-and-posters'),
  en('make a flyer', 'make-flyers-and-posters'),

  // AI video generation
  nl('video maken van een foto met ai', 'generate-ai-videos'),
  nl('tekst omzetten naar video', 'generate-ai-videos', 'create-social-media-videos'),
  nl('ai filmpje genereren', 'generate-ai-videos'),
  nl('sora alternatief', 'generate-ai-videos'),
  nl("welke ai kan video's maken", 'generate-ai-videos', 'create-social-media-videos'),
  en('turn a photo into a video', 'generate-ai-videos'),

  // Business plan
  nl('ondernemingsplan schrijven', 'write-business-plan'),
  nl('businessplan voor mijn startup', 'write-business-plan'),
  nl('plan maken voor de bank om een lening te krijgen', 'write-business-plan'),
  en('help me draft a plan for my new company', 'write-business-plan'),

  // Mixed and vague: any sensible reading counts
  nl('mijn baas wil een presentatie over de cijfers', 'make-presentations', 'analyze-data'),
  nl('iets om mijn huiswerk te checken', 'study-with-ai', 'proofread-writing'),
  nl('transcriberen van audio', 'transcribe-audio'),
];

/**
 * Second held-out set, written after the engine was tuned on the set above:
 * its score is the honest estimate of how well Match generalises.
 */
export const UNDERSTANDING_FRESH: UnderstandingCase[] = [
  nl('ik moet een verslag van een congres uitwerken dat ik heb opgenomen', 'transcribe-audio'),
  nl('mijn dochter moet een werkstuk maken, kan ai helpen', 'study-with-ai'),
  nl("ik verkoop kaarsen online en wil betere foto's", 'create-product-photos', 'improve-photos'),
  nl('hoe krijg ik meer bezoekers op mijn website via google', 'write-seo-blog-posts'),
  nl('een filmpje voor de verjaardag van opa met foto\'s en muziek', 'edit-videos-faster', 'generate-ai-videos'),
  nl('ik wil dat mijn klanten 24 uur per dag antwoord krijgen', 'customer-support-chatbot'),
  nl('een app voor mijn voetbalclub', 'build-app-without-code'),
  nl('lesbrief maken over het klimaat voor groep 7', 'prepare-lessons'),
  nl('gedichtje schrijven voor sinterklaas', 'write-book-or-story'),
  nl('pdf met huurcontract laten uitleggen', 'summarize-documents'),
  nl('mijn engels is slecht, kan ai mijn mail vertalen', 'translate-texts', 'write-emails-faster'),
  nl('mijn stem klinkt blikkerig op de opname', 'clean-up-audio'),
  nl('ondertiteling in het nederlands bij een youtube video', 'add-subtitles-to-videos'),
  nl('kerstkaart ontwerpen', 'make-flyers-and-posters'),
  nl('ik wil een eigen muzieknummer maken zonder instrumenten', 'make-music'),
  nl('overzicht van mijn uitgaven in een grafiek', 'analyze-data'),
  nl('wekelijks een nieuwsbrief naar leden sturen', 'email-marketing'),
  nl('een logo voor mijn foodtruck', 'design-logo-and-brand'),
  nl('ai die meeschrijft tijdens een sollicitatie', 'write-cv-and-application'),
  nl('ik wil een podcast over voetbal opnemen met een vriend', 'produce-podcast'),
  nl('lange youtube interviews omzetten in korte filmpjes', 'long-videos-to-shorts'),
  nl('gesprekken met klanten automatisch samenvatten na een videocall', 'automatic-meeting-notes'),
  nl('een pratende avatar voor mijn cursus', 'training-videos-ai-presenter'),
  nl('filmpje van mijn product maken zonder camera', 'generate-ai-videos', 'create-social-media-videos'),
  nl('ai die mijn code nakijkt', 'code-with-ai'),
  nl('een webshop website bouwen zonder technische kennis', 'build-website-no-code'),
  nl('bronnen checken voor mijn journalistieke artikel', 'research-with-sources'),
  nl('studies over voeding opzoeken voor mijn afstudeeronderzoek', 'literature-review'),
  nl('mijn instagram vullen met mooie posts', 'create-social-media-posts', 'plan-social-media'),
  nl('facebook berichten vooruit plannen', 'plan-social-media'),
  nl('mijn eigen gegevens niet naar amerika, ai op mijn eigen pc', 'local-private-ai'),
  nl('handige ai voor dagelijkse klusjes zoals boodschappenlijstjes', 'everyday-ai-assistant'),
  nl('achtergrond van mijn profielfoto veranderen', 'remove-image-background'),
  nl('krassen uit een oude foto van mijn oma halen', 'improve-photos'),
  nl('tekst van een presentatie laten voorlezen', 'create-ai-voiceovers'),
  nl('een beschrijving voor mijn airbnb schrijven', 'write-marketing-copy'),
  nl('boekhouding automatiseren tussen mijn bank en excel', 'automate-work'),
  nl('mijn notities van colleges bij elkaar houden', 'take-notes-and-organize', 'study-with-ai'),
  nl('financieel plan voor een eigen bakkerij', 'write-business-plan'),
  nl('een fantasietekening van een draak laten maken', 'generate-images'),
  nl('mijn tekst klinkt stijf, kan het vlotter', 'proofread-writing'),
  nl('presentatie maken over mijn stage', 'make-presentations'),
  nl('youtube video in het spaans laten praten met mijn eigen stem', 'translate-and-dub-videos'),
  nl('een stripverhaal voor mijn kind', 'write-book-or-story', 'generate-images'),
  en('i run a dental clinic and want a chatbot for bookings questions', 'customer-support-chatbot'),
  en('help my teenager revise for a biology test', 'study-with-ai'),
  en('turn my blog post into a short video', 'generate-ai-videos', 'create-social-media-videos'),
  en('make my zoom recording sound better', 'clean-up-audio'),
  en('write a toast for my sister wedding', 'everyday-ai-assistant', 'write-book-or-story'),
  en('design a menu for my cafe', 'make-flyers-and-posters'),
  en('get a transcript of my voicemail', 'transcribe-audio'),
  en('write product descriptions for shopify', 'write-marketing-copy'),
  en('create a quiz for my students', 'prepare-lessons'),
  en('summarize this 50 page contract', 'summarize-documents'),
  en('fix the spelling in my thesis', 'proofread-writing'),
  en('make an app for my club without programming', 'build-app-without-code'),
  en('which ai makes the best pictures', 'generate-images'),
  en('explain my python error', 'code-with-ai'),
  en('translate my website into german', 'translate-texts'),
  en('plan my instagram posts for next month', 'plan-social-media'),
];

