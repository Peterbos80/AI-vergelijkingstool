# SEO

The approach: only pages with enough unique, sourced data are indexable, every language version is a real translation, and every page carries the evidence that makes it worth ranking. Strategy (in Dutch): [`docs/strategy/05-information-architecture.md`](strategy/05-information-architecture.md).

## Indexability gates

A page is indexable only when its gate passes. Otherwise it renders normally for visitors, but with `noindex, follow`, and it is left out of the sitemap. The sitemap (`src/lib/sitemap.ts`) and each page's metadata apply the **same** gates, and the owner report counts indexable pages from the same function.

| Page | Gate |
| --- | --- |
| Tool `/…/tools/<slug>` | published, not shut down, a primary capability, quality score ≥ 60 (`src/lib/quality/score.ts`), and the tool's own text in this locale |
| Pricing `/…/tools/<slug>/pricing` | tool gate + at least one plan, pricing at least SUPPORTED, not stale, own text |
| Alternatives `/…/tools/<slug>/alternatives` | tool gate + at least 3 alternatives, own text |
| Task `/…/tasks/<slug>` | every required step has ≥ 2 live tools, and the task's own text in this locale |
| Capability `/…/capabilities/<slug>` | ≥ 4 live tools with it as primary capability, own text |
| Category `/…/categories/<slug>` | own text in this locale |
| Fair Fight `/…/compare/<a>-vs-<b>` | a shared primary capability, pricing at least SUPPORTED for both, an editorial or sourced alternative relation, ≥ 4 differing criteria, neither discontinued |
| Hubs and static pages | always |
| Match, My stack, shared stacks, newsletter confirm/unsubscribe, admin, `/go`, API | never (`noindex`, and disallowed in robots.txt) |

Gates follow the data: the quality agent recomputes snapshots hourly. A tool whose price goes stale drops out of the index until the pricing agent re-verifies it, then returns automatically.

## URLs, canonicals and hreflang

- Every public URL has a locale prefix (`/nl/…`, `/en/…`). `/` redirects based on `Accept-Language` (`Vary: Accept-Language`).
- Slugs are localised for taxonomy and tasks. A wrong or old slug gets a permanent redirect to the canonical one.
- `alternates()` (`src/lib/seo.ts`) sets a self-referencing canonical, plus hreflang links only to live locales where the page has its own text, and `x-default` → English when available.
- A configured locale that is not live yet answers 404, not a half-translated page.

## Sitemap and robots

- `/sitemap.xml` lists every indexable URL with hreflang alternates and `lastModified` from real check dates: the tool's last check, or the price check for pricing pages. The newsletter page is included only when an e-mail provider is configured.
- `/robots.txt` allows everything except `/go/`, `/api/`, `/admin`, Match, stacks, My stack and newsletter confirmation paths, and points to the sitemap.
- `/llms.txt` summarises the site, its methodology and the API for language models.

## Structured data

JSON-LD, nonce-tagged and `<`-escaped (`src/components/ui/JsonLd.tsx`):

| Page | Types |
| --- | --- |
| Tool | `SoftwareApplication` with `Offer`s from current plans, and the vendor as `Organization` |
| Capability | `ItemList` of ranked tools |
| Task | `FAQPage` answered from the composed stacks (can it be done for free, how few tools are needed) |
| Every page with breadcrumbs | `BreadcrumbList` |

No `AggregateRating` or `Review` markup: we have no reviews, and we do not invent them.

## Social cards ("OG receipts")

`opengraph-image.tsx` routes render a receipt-style card with `next/og` for the home page, each tool (entry price, status stamp, check date), each Fair Fight, and each shared stack. Fonts are bundled from `src/lib/og/fonts` (WOFF, OFL-licensed).

## Metadata

Titles and descriptions come from i18n templates filled with real data (entry price, plan count, year, free tier yes/no/unknown), clipped to sensible lengths. Nothing in them is invented: unknown values say "unknown".

## Performance

Pages are server-rendered with little client JavaScript. `perf.spec.ts` enforces per template: LCP < 2.5 s, CLS < 0.1, TTFB < 800 ms and JS < 200 KB. Measured on the production build: LCP about 150–300 ms, CLS about 0, and about 140 KB of JS.

## Taking a new locale live (de, fr)

German and French already have every public UI string (`npm run i18n:check` shows 100%). They stay dark because the **content** does not exist yet. Checklist:

1. **Taxonomy text** in `data/taxonomy.json` for the locale: category names, slugs and descriptions; capability names, slugs and **synonyms**; task titles, slugs, summaries and **intent phrases**; step labels. Run `npm run db:seed`, which upserts taxonomy. Synonyms and intent phrases are what the lexical Match engine understands, so write them the way people actually ask.
2. **Match quality**: add golden cases in the new language to `src/lib/engine/golden.ts` and make them pass (`npm test`). The text normaliser is tuned for Dutch and English; check stemming for the new language.
3. **Tool texts**: either write them (editorial), or enable the locale and let the content agent machine-translate reviewed English texts, 10 tools per day, labelled `machine_translated`. Until a tool has its own text in the locale, its page there falls back to English and stays `noindex`, out of the sitemap and out of hreflang.
4. **Legal pages**: have the privacy page, disclosure and methodology texts checked by a native speaker.
5. **Enable**: `ENABLED_LOCALES=nl,en,de`. Sitemap, hreflang, the language switcher and the API pick it up automatically. Run the e2e suite, whose SEO spec checks canonicals, hreflang and noindex rules.

## Search Console

Not connected in this version. The dependency register lists it as "not configured", and the weekly report states that organic search data is unmeasured rather than showing zero. To use it: verify the domain, submit `/sitemap.xml`, and read the data in Search Console itself.
