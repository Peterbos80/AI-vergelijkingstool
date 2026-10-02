/**
 * The safe fetcher used by all agents (docs/strategy/08 §8):
 *  - http(s) only, no credentials, ports 80/443;
 *  - SSRF guard on the resolved address of every redirect hop (max 5);
 *  - robots.txt respected (24 h cache) with our own user agent;
 *  - ≥ 5 s between requests per domain, max 2 concurrent per domain;
 *  - time and size limits, content-type allow-list;
 *  - external content is data: bodies are returned as text, never executed.
 */
import { env } from '@/lib/env';
import { assertPublicHost, checkUrlShape, dnsResolver, type Resolver } from './ssrf';
import { isAllowed, parseRobots, type RobotsRules } from './robots';
import { API_HOSTS, type FetchOptions, type FetchResult, type Fetcher } from './types';

interface FetcherConfig {
  userAgent: string;
  minDelayMs: number;
  maxBytes: number;
  timeoutMs: number;
  resolver: Resolver;
  /** Injected transport (tests). */
  transport?: typeof fetch;
}

const ACCEPT: Record<NonNullable<FetchOptions['accept']>, RegExp> = {
  html: /text\/html|application\/xhtml\+xml|text\/plain/i,
  xml: /xml|rss|atom|text\/plain|text\/html/i,
  json: /json/i,
  any: /.*/,
};

export function createFetcher(partial: Partial<FetcherConfig> = {}): Fetcher {
  const cfg: FetcherConfig = {
    userAgent: partial.userAgent ?? env().AGENT_USER_AGENT,
    minDelayMs: partial.minDelayMs ?? 5000,
    maxBytes: partial.maxBytes ?? 2 * 1024 * 1024,
    timeoutMs: partial.timeoutMs ?? 15_000,
    resolver: partial.resolver ?? dnsResolver,
    transport: partial.transport,
  };
  const transport = cfg.transport ?? fetch;
  const lastHit = new Map<string, number>();
  const active = new Map<string, number>();
  const robotsCache = new Map<string, { at: number; rules: RobotsRules }>();

  async function throttle(host: string) {
    for (;;) {
      const inFlight = active.get(host) ?? 0;
      const wait = (lastHit.get(host) ?? 0) + cfg.minDelayMs - Date.now();
      if (inFlight < 2 && wait <= 0) break;
      await new Promise((r) => setTimeout(r, Math.max(50, Math.min(wait, 1000))));
    }
    lastHit.set(host, Date.now());
    active.set(host, (active.get(host) ?? 0) + 1);
  }
  function release(host: string) {
    active.set(host, Math.max(0, (active.get(host) ?? 1) - 1));
  }

  async function raw(url: URL, opts: FetchOptions, light: boolean, postBody?: string) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? cfg.timeoutMs);
    try {
      const res = await transport(url, {
        method: postBody === undefined ? 'GET' : 'POST',
        body: postBody,
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': cfg.userAgent,
          Accept: opts.accept === 'json' ? 'application/json' : opts.accept === 'xml' ? 'application/rss+xml, application/atom+xml, application/xml, text/xml' : 'text/html,application/xhtml+xml',
          'Accept-Language': 'en,nl;q=0.8',
          ...(postBody === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(opts.headers ?? {}),
        },
      });
      let body = '';
      if (res.body && !(res.status >= 300 && res.status < 400)) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let total = 0;
        const limit = light ? 16 * 1024 : cfg.maxBytes;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          total += value.byteLength;
          if (total > limit) {
            await reader.cancel();
            if (!light) throw Object.assign(new Error('response too large'), { kind: 'too_large' as const });
            break;
          }
          body += decoder.decode(value, { stream: true });
        }
        body += decoder.decode();
      }
      return { status: res.status, headers: res.headers, body };
    } finally {
      clearTimeout(timer);
    }
  }

  async function robotsFor(origin: URL): Promise<RobotsRules> {
    const key = origin.origin;
    const hit = robotsCache.get(key);
    if (hit && Date.now() - hit.at < 24 * 3600_000) return hit.rules;
    let rules: RobotsRules = { rules: [] };
    try {
      await assertPublicHost(origin.hostname, cfg.resolver);
      const res = await raw(new URL('/robots.txt', origin), { accept: 'any', timeoutMs: 8000 }, false);
      if (res.status === 200) rules = parseRobots(res.body.slice(0, 200_000), cfg.userAgent);
      // 401/403 on robots.txt: treat as full disallow (conservative); 404: allowed.
      if (res.status === 401 || res.status === 403) rules = { rules: [{ allow: false, pattern: '/' }] };
    } catch {
      rules = { rules: [] };
    }
    robotsCache.set(key, { at: Date.now(), rules });
    return rules;
  }

  return {
    async get(input: string, opts: FetchOptions = {}): Promise<FetchResult> {
      const started = Date.now();
      const redirects: string[] = [];
      const fail = (errorKind: FetchResult['errorKind'], error: string, status: number | null = null, finalUrl = input): FetchResult => ({
        ok: false,
        url: input,
        finalUrl,
        status,
        contentType: null,
        body: '',
        durationMs: Date.now() - started,
        errorKind,
        error,
        redirects,
      });
      let url = checkUrlShape(input);
      if (!url) return fail('invalid_url', 'URL not allowed');
      for (let hop = 0; hop <= 5; hop++) {
        try {
          await assertPublicHost(url.hostname, cfg.resolver);
        } catch (e) {
          return fail('ssrf', e instanceof Error ? e.message : 'blocked host', null, url.toString());
        }
        if (opts.api) {
          if (!API_HOSTS.has(url.hostname)) return fail('invalid_url', 'api option only for documented API hosts', null, url.toString());
        } else {
          const robots = await robotsFor(url);
          if (!isAllowed(robots, url.pathname + url.search)) return fail('robots', 'disallowed by robots.txt', null, url.toString());
        }
        await throttle(url.hostname);
        let res: Awaited<ReturnType<typeof raw>>;
        try {
          res = await raw(url, opts, Boolean(opts.light));
        } catch (e) {
          const err = e as Error & { kind?: 'too_large'; name?: string };
          if (err.kind === 'too_large') return fail('too_large', err.message, null, url.toString());
          if (err.name === 'AbortError') return fail('timeout', 'timeout', null, url.toString());
          return fail('network', err.message, null, url.toString());
        } finally {
          release(url.hostname);
        }
        if (res.status >= 300 && res.status < 400) {
          const loc = res.headers.get('location');
          if (!loc) return fail('http', 'redirect without location', res.status, url.toString());
          const next = checkUrlShape(new URL(loc, url).toString());
          if (!next) return fail('invalid_url', 'redirect to disallowed URL', res.status, url.toString());
          redirects.push(next.toString());
          url = next;
          continue;
        }
        const contentType = res.headers.get('content-type');
        if (res.status >= 400) return { ...fail('http', `HTTP ${res.status}`, res.status, url.toString()), contentType };
        if (contentType && !ACCEPT[opts.accept ?? 'html'].test(contentType)) {
          return { ...fail('content_type', `unexpected content-type ${contentType}`, res.status, url.toString()), contentType };
        }
        return {
          ok: true,
          url: input,
          finalUrl: url.toString(),
          status: res.status,
          contentType,
          body: res.body,
          durationMs: Date.now() - started,
          redirects,
        };
      }
      return fail('redirects', 'too many redirects');
    },

    async post(input: string, body: string, opts: FetchOptions = {}): Promise<FetchResult> {
      const started = Date.now();
      const fail = (errorKind: FetchResult['errorKind'], error: string, status: number | null = null): FetchResult => ({
        ok: false,
        url: input,
        finalUrl: input,
        status,
        contentType: null,
        body: '',
        durationMs: Date.now() - started,
        errorKind,
        error,
        redirects: [],
      });
      const url = checkUrlShape(input);
      if (!url || url.protocol !== 'https:' || !opts.api || !API_HOSTS.has(url.hostname)) return fail('invalid_url', 'POST only to documented API hosts');
      if (body.length > 8192) return fail('too_large', 'request body too large');
      try {
        await assertPublicHost(url.hostname, cfg.resolver);
      } catch (e) {
        return fail('ssrf', e instanceof Error ? e.message : 'blocked host');
      }
      await throttle(url.hostname);
      let res: Awaited<ReturnType<typeof raw>>;
      try {
        res = await raw(url, { ...opts, accept: opts.accept ?? 'json' }, false, body);
      } catch (e) {
        const err = e as Error & { kind?: 'too_large'; name?: string };
        if (err.kind === 'too_large') return fail('too_large', err.message);
        if (err.name === 'AbortError') return fail('timeout', 'timeout');
        return fail('network', err.message);
      } finally {
        release(url.hostname);
      }
      const contentType = res.headers.get('content-type');
      if (res.status >= 300 && res.status < 400) return fail('http', 'redirects are not followed for POST', res.status);
      if (res.status >= 400) return { ...fail('http', `HTTP ${res.status}`, res.status), contentType };
      if (contentType && !ACCEPT[opts.accept ?? 'json'].test(contentType)) return { ...fail('content_type', `unexpected content-type ${contentType}`, res.status), contentType };
      return { ok: true, url: input, finalUrl: url.toString(), status: res.status, contentType, body: res.body, durationMs: Date.now() - started, redirects: [] };
    },
  };
}

/** A fetcher backed by fixtures (tests, dry runs). POST requests are looked up as "POST <url>". */
export function fixtureFetcher(pages: Record<string, { status?: number; body: string; contentType?: string } | Error>): Fetcher {
  const fetcher: Fetcher = {
    async get(url) {
      const p = pages[url];
      const base = { url, finalUrl: url, durationMs: 1, redirects: [] as string[] };
      if (!p) return { ...base, ok: false, status: 404, contentType: null, body: '', errorKind: 'http', error: 'HTTP 404' };
      if (p instanceof Error) return { ...base, ok: false, status: null, contentType: null, body: '', errorKind: 'network', error: p.message };
      const status = p.status ?? 200;
      return {
        ...base,
        ok: status < 400,
        status,
        contentType: p.contentType ?? 'text/html; charset=utf-8',
        body: status < 400 ? p.body : '',
        ...(status >= 400 ? { errorKind: 'http' as const, error: `HTTP ${status}` } : {}),
      };
    },
    async post(url, _body, opts) {
      return fetcher.get(`POST ${url}`, opts);
    },
  };
  return fetcher;
}
