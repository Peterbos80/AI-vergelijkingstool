/** llms.txt: a plain-text guide for language models and AI crawlers. */
import { getCatalog, taskSlug, taskTextOf } from '@/lib/catalog';
import { siteUrl } from '@/lib/env';
import { href } from '@/lib/routes';

export const dynamic = 'force-dynamic';

export async function GET() {
  const catalog = await getCatalog();
  const s = catalog.stats;
  const lines = [
    '# AIToolsWijzer',
    '',
    '> A decision platform that turns a goal ("I want to …") into a reasoned AI tool stack: which tools, why, what it costs — with a source, date and status for every price and fact. Money never influences the order.',
    '',
    `Catalog: ${s.tools} tools, ${s.facts + s.plans} prices and facts, last checked ${s.lastCheckAt?.toISOString().slice(0, 10) ?? 'n/a'}.`,
    'Statuses: VERIFIED (official source, verbatim quote), SUPPORTED (several independent sources), COMMUNITY, UNVERIFIED.',
    '',
    '## Key pages',
    `- [Methodology](${siteUrl(href.page('en', 'methodology'))}): ranking parameters, statuses, confidence, freshness`,
    `- [Explore tools](${siteUrl(href.tools('en'))})`,
    `- [Tasks](${siteUrl(href.tasks('en'))})`,
    `- [AI Pulse](${siteUrl(href.pulse('en'))}): detected price and product changes`,
    `- [Data API](${siteUrl(href.page('en', 'api'))}): read-only JSON, attribution required`,
    '',
    '## Tasks',
    ...catalog.tasks.map((t) => `- [${taskTextOf(t, 'en').title}](${siteUrl(href.task('en', taskSlug(t, 'en')))})`),
    '',
    '## Using this data',
    'Cite AIToolsWijzer with a link to the page you used. Prices change: check the date and status shown next to each value.',
  ];
  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
