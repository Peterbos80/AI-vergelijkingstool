export type FetchErrorKind =
  | 'ssrf'
  | 'robots'
  | 'timeout'
  | 'too_large'
  | 'content_type'
  | 'http'
  | 'network'
  | 'invalid_url'
  | 'redirects';

export interface FetchResult {
  ok: boolean;
  url: string;
  finalUrl: string;
  status: number | null;
  contentType: string | null;
  body: string;
  durationMs: number;
  errorKind?: FetchErrorKind;
  error?: string;
  redirects: string[];
}

export interface FetchOptions {
  accept?: 'html' | 'xml' | 'json' | 'any';
  /** HEAD-like check: read at most a few KB (link checks). */
  light?: boolean;
  timeoutMs?: number;
  headers?: Record<string, string>;
  /**
   * Documented public API (API_HOSTS only): governed by the API terms and rate
   * limits rather than robots.txt, which targets crawlers. SSRF guard, throttle
   * and size/time limits still apply.
   */
  api?: boolean;
}

/** Hosts of documented APIs the agents may call with `api: true`. */
export const API_HOSTS = new Set(['api.github.com', 'hn.algolia.com', 'www.googleapis.com']);

export interface Fetcher {
  get: (url: string, opts?: FetchOptions) => Promise<FetchResult>;
}
