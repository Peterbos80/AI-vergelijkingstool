/**
 * Tiny ICU-style message formatter (no dependencies).
 *
 * Supports:
 *   {name}                                     simple interpolation
 *   {count, plural, =0 {none} one {# tool} other {# tools}}
 *   {kind, select, price {…} other {…}}
 * Nested placeholders inside plural/select branches are supported.
 */
export type MessageTree = { [key: string]: string | MessageTree };
export type Vars = Record<string, string | number | null | undefined>;

export function lookup(tree: MessageTree, key: string): string | undefined {
  let node: string | MessageTree | undefined = tree;
  for (const part of key.split('.')) {
    if (node === undefined || typeof node === 'string') return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

function findClosing(src: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function parseBranches(body: string): Map<string, string> {
  const branches = new Map<string, string>();
  let i = 0;
  while (i < body.length) {
    while (i < body.length && /\s/.test(body[i]!)) i++;
    const selStart = i;
    while (i < body.length && body[i] !== '{' && !/\s/.test(body[i]!)) i++;
    const selector = body.slice(selStart, i);
    while (i < body.length && /\s/.test(body[i]!)) i++;
    if (body[i] !== '{') break;
    const close = findClosing(body, i);
    if (close < 0) break;
    branches.set(selector, body.slice(i + 1, close));
    i = close + 1;
  }
  return branches;
}

export function formatMessage(template: string, vars: Vars = {}, intlLocale = 'en'): string {
  let out = '';
  let i = 0;
  while (i < template.length) {
    const ch = template[i];
    if (ch !== '{') {
      out += ch;
      i++;
      continue;
    }
    const close = findClosing(template, i);
    if (close < 0) {
      out += template.slice(i);
      break;
    }
    const inner = template.slice(i + 1, close);
    const firstComma = inner.indexOf(',');
    if (firstComma < 0) {
      const name = inner.trim();
      const value = vars[name];
      out += value === undefined || value === null ? `{${name}}` : String(value);
    } else {
      const name = inner.slice(0, firstComma).trim();
      const rest = inner.slice(firstComma + 1);
      const secondComma = rest.indexOf(',');
      const kind = rest.slice(0, secondComma).trim();
      const branches = parseBranches(rest.slice(secondComma + 1));
      const raw = vars[name];
      let chosen: string | undefined;
      if (kind === 'plural') {
        const n = Number(raw ?? 0);
        chosen = branches.get(`=${n}`);
        if (chosen === undefined) {
          const cat = new Intl.PluralRules(intlLocale).select(n);
          chosen = branches.get(cat) ?? branches.get('other');
        }
        if (chosen !== undefined) {
          const formatted = new Intl.NumberFormat(intlLocale).format(n);
          chosen = formatMessage(chosen.replace(/#/g, formatted), vars, intlLocale);
        }
      } else if (kind === 'select') {
        chosen = branches.get(String(raw)) ?? branches.get('other');
        if (chosen !== undefined) chosen = formatMessage(chosen, vars, intlLocale);
      }
      out += chosen ?? '';
    }
    i = close + 1;
  }
  return out;
}

export type Translator = ((key: string, vars?: Vars) => string) & { locale: string; has: (key: string) => boolean };

export function createTranslator(
  locale: string,
  intlLocale: string,
  primary: MessageTree,
  fallbacks: MessageTree[] = [],
): Translator {
  const t = ((key: string, vars?: Vars) => {
    let template = lookup(primary, key);
    if (template === undefined) {
      for (const fb of fallbacks) {
        template = lookup(fb, key);
        if (template !== undefined) break;
      }
    }
    if (template === undefined) {
      if (process.env.NODE_ENV !== 'production') console.warn(`[i18n] missing key "${key}" (${locale})`);
      return key;
    }
    return formatMessage(template, vars, intlLocale);
  }) as Translator;
  t.locale = locale;
  t.has = (key: string) => lookup(primary, key) !== undefined;
  return t;
}

/** Flatten a message tree into dotted keys (used by i18n coverage checks). */
export function flattenKeys(tree: MessageTree, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(tree)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') keys.push(full);
    else keys.push(...flattenKeys(v, full));
  }
  return keys;
}
