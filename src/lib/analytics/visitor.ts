/**
 * Cookieless visitor identification (docs/strategy/06): a daily-rotating salted
 * hash of IP + user agent. The salt is derived from APP_SECRET and the date and
 * is never stored, so hashes cannot be linked across days or reversed.
 */
import { createHash, createHmac } from 'node:crypto';
import { appSecret, env } from '@/lib/env';

const BOT_UA =
  /bot|crawl|spider|slurp|preview|headless|lighthouse|pagespeed|curl|wget|python-requests|httpx|axios|node-fetch|go-http|java\/|facebookexternalhit|embedly|monitor|uptime|healthcheck|playwright|puppeteer/i;

export function isBot(ua: string | null | undefined): boolean {
  return !ua || BOT_UA.test(ua);
}

export function dailySalt(date: Date = new Date()): string {
  return createHmac('sha256', appSecret()).update(`visitor:${date.toISOString().slice(0, 10)}`).digest('hex');
}

export function visitorHash(ip: string, ua: string, date: Date = new Date()): string {
  return createHash('sha256').update(`${dailySalt(date)}|${ip}|${ua}`).digest('hex').slice(0, 32);
}

export function deviceOf(ua: string): 'mobile' | 'tablet' | 'desktop' {
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) return 'tablet';
  if (/mobi|iphone|android/i.test(ua)) return 'mobile';
  return 'desktop';
}

/**
 * The client address as seen by our own infrastructure. X-Forwarded-For is a
 * list a client can prepend anything to, so only entries added by trusted
 * proxies count: the n-th address from the right, n = TRUSTED_PROXY_HOPS
 * (default 1: one reverse proxy/load balancer). Without the header, Next.js
 * fills it with the socket address. Rate limits depend on this.
 */
export function clientIp(h: Headers, hops: number = env().TRUSTED_PROXY_HOPS): string {
  const list = (h.get('x-forwarded-for') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (list.length) return list[Math.max(0, list.length - Math.max(1, hops))]!;
  return h.get('x-real-ip')?.trim() || '0.0.0.0';
}

export function referrerDomain(h: Headers, ownHost: string | null): string | null {
  const ref = h.get('referer');
  if (!ref) return null;
  try {
    const host = new URL(ref).hostname.replace(/^www\./, '');
    if (ownHost && host === ownHost.replace(/^www\./, '').split(':')[0]) return null;
    return host;
  } catch {
    return null;
  }
}

/** Traffic channel from referrer + utm (used by the owner dashboard). */
export function channelOf(referrer: string | null, utmMedium: string | null): 'organic' | 'ai' | 'social' | 'email' | 'referral' | 'direct' {
  if (utmMedium && /mail/i.test(utmMedium)) return 'email';
  if (!referrer) return 'direct';
  // AI assistants first: gemini.google.com must not count as a search engine.
  if (/(chatgpt\.com|openai\.com|perplexity\.ai|claude\.ai|gemini\.google\.com|copilot\.microsoft\.com|you\.com|phind\.com)/i.test(referrer)) return 'ai';
  if (/(^|\.)((google|bing|duckduckgo|ecosia|yahoo|yandex|startpage|qwant|brave|baidu)\.)/i.test(referrer)) return 'organic';
  if (/(linkedin|facebook|instagram|x\.com|twitter|t\.co|reddit|youtube|tiktok|threads|bsky|mastodon)/i.test(referrer)) return 'social';
  return 'referral';
}
