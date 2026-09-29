/**
 * Request-time clock for Server Components. Server Components render once per
 * request, so reading the clock is intentional (e.g. latency, receipt dates).
 */
export function nowMs(): number {
  return Date.now();
}

export function nowDate(): Date {
  return new Date();
}
