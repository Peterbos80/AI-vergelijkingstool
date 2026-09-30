/**
 * Scheduler entry point for hosts without a long-running worker (cron,
 * Vercel Cron, GitHub Actions…): runs the agents that are due, within a time
 * budget, then pings the external heartbeat.
 *
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://…/api/cron/agents
 *
 * GET is accepted too because some schedulers (e.g. Vercel Cron) only send GET;
 * both require the bearer secret. Lease locks prevent overlapping runs.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { runDueAgents } from '@/agents/runner';
import { pingHeartbeat } from '@/lib/ops/dependencies';
import { bearer, safeEqual } from '@/lib/security/secrets';
import { rateLimit } from '@/lib/security/rate-limit';
import { logError } from '@/lib/ops/errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const headers = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };

async function handle(req: NextRequest) {
  const secret = env().CRON_SECRET;
  if (!secret || secret.length < 16) return NextResponse.json({ error: 'cron_not_configured' }, { status: 503, headers });
  const token = bearer(req.headers.get('authorization'));
  if (!token || !safeEqual(token, secret)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: { ...headers, 'WWW-Authenticate': 'Bearer' } });
  }
  if (!(await rateLimit('cron:agents', 30, 60))) return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: { ...headers, 'Retry-After': '60' } });
  try {
    const runs = await runDueAgents({ trigger: 'api', budgetMs: 240_000 });
    const failedHealth = runs.some((r) => r.agent === 'health' && r.status === 'failed');
    await pingHeartbeat(failedHealth ? 'fail' : 'ok');
    return NextResponse.json(
      { ran: runs.map((r) => ({ agent: r.agent, status: r.status, summary: r.summary, durationMs: r.durationMs })) },
      { status: 200, headers },
    );
  } catch (err) {
    await logError('api', 'cron run failed', err);
    await pingHeartbeat('fail');
    return NextResponse.json({ error: 'run_failed' }, { status: 500, headers });
  }
}

export const POST = handle;
export const GET = handle;
