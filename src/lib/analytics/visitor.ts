/**
 * Cookieless visitor identification (docs/strategy/06): a daily-rotating salted
 * hash of IP + user agent. The salt is derived from APP_SECRET and the date and
 * is never stored, so hashes cannot be linked across days or reversed.
 */
import { createHash, createHmac } from 'node:crypto';
import { appSecret } from '@/lib/env';

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

export function clientIp(h: Headers): string {
  const fwd = h.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return h.get('x-real-ip') ?? '0.0.0.0';
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
  if (/(^|\.)((google|bing|duckduckgo|ecosia|yahoo|yandex|startpage|qwant|brave|baidu)\.)/i.test(referrer)) return 'organic';
  if (/(chatgpt\.com|openai\.com|perplexity\.ai|claude\.ai|gemini\.google\.com|copilot\.microsoft\.com|you\.com|phind\.com)/i.test(referrer)) return 'ai';
  if (/(linkedin|facebook|instagram|x\.com|twitter|t\.co|reddit|youtube|tiktok|threads|bsky|mastodon)/i.test(referrer)) return 'social';
  return 'referral';
}
