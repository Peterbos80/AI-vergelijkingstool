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
}

export interface Fetcher {
  get: (url: string, opts?: FetchOptions) => Promise<FetchResult>;
}
