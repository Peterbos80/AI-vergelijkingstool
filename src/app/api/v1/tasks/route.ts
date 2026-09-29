import type { NextRequest } from 'next/server';
import { getCatalog, stepLabel, taskTextOf } from '@/lib/catalog';
import { siteUrl } from '@/lib/env';
import { href } from '@/lib/routes';
import { apiGuard, apiLocale, ATTRIBUTION, json } from '@/lib/api/public';

export async function GET(req: NextRequest) {
  const limited = await apiGuard(req);
  if (limited) return limited;
  const locale = apiLocale(req);
  const catalog = await getCatalog();
  return json({
    attribution: ATTRIBUTION,
    tasks: catalog.tasks.map((task) => {
      const text = taskTextOf(task, locale);
      return {
        id: task.id,
        title: text.title,
        summary: text.summary,
        url: siteUrl(href.task(locale, text.slug)),
        steps: task.steps.map((s) => ({ key: s.key, label: stepLabel(s, locale).label, required: s.required, capabilities: s.capabilityIds })),
      };
    }),
  });
}
