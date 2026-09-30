/**
 * HTML → normalised text for evidence anchoring and change hashing.
 */
import { createHash } from 'node:crypto';
import * as cheerio from 'cheerio';

export interface PageText {
  title: string | null;
  description: string | null;
  text: string;
  links: { href: string; text: string }[];
}

const BLOCK = 'p,div,section,article,li,tr,td,th,h1,h2,h3,h4,h5,h6,br,header,footer,main,aside,dd,dt,span';

export function htmlToText(html: string, baseUrl: string): PageText {
  const $ = cheerio.load(html);
  $('script,style,noscript,svg,iframe,template,canvas').remove();
  const title = $('title').first().text().trim() || null;
  const description = $('meta[name="description"]').attr('content')?.trim() || null;
  const links: { href: string; text: string }[] = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    try {
      links.push({ href: new URL(href, baseUrl).toString(), text: $(el).text().replace(/\s+/g, ' ').trim().slice(0, 80) });
    } catch {
      /* ignore bad hrefs */
    }
  });
  $(BLOCK).each((_, el) => {
    $(el).prepend('\n');
  });
  const text = $('body').text() || $.root().text();
  return { title, description, text: normalizeText(text), links: links.slice(0, 500) };
}

/** Normalisation used for anchoring: NFKC, quotes/dashes, zero-width, whitespace. */
export function normalizeText(s: string): string {
  return s
    .normalize('NFKC')
    .replace(/[​-‍﻿]/g, '')
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[‐‑‒–—―]/g, '-')
    .replace(/ /g, ' ')
    .replace(/([$€£])\s+(\d)/g, '$1$2')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

export function contentHash(text: string): string {
  return createHash('sha256').update(text.toLowerCase().replace(/\s+/g, ' ')).digest('hex');
}
