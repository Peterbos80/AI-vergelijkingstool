/**
 * Minimal schedule format (no cron dependency), evaluated in Europe/Amsterdam:
 *   every:15m | every:6h | daily:HH:MM | weekly:D:HH:MM (0=Sun…6=Sat) | monthly:DD:HH:MM
 */
const TZ = 'Europe/Amsterdam';

function tzParts(d: Date): { y: number; mo: number; day: number; h: number; mi: number; wd: number } {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  });
  const parts = Object.fromEntries(f.formatToParts(d).map((p) => [p.type, p.value]));
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday!);
  return { y: +parts.year!, mo: +parts.month!, day: +parts.day!, h: +parts.hour! % 24, mi: +parts.minute!, wd };
}

/** Offset (ms) of Europe/Amsterdam from UTC at instant d. */
function tzOffset(d: Date): number {
  const p = tzParts(d);
  const asUtc = Date.UTC(p.y, p.mo - 1, p.day, p.h, p.mi);
  return asUtc - Math.floor(d.getTime() / 60000) * 60000;
}

/** UTC instant for a wall-clock time in Europe/Amsterdam. */
function zoned(y: number, mo: number, day: number, h: number, mi: number): Date {
  const guess = new Date(Date.UTC(y, mo - 1, day, h, mi));
  return new Date(guess.getTime() - tzOffset(guess));
}

export function validSchedule(s: string): boolean {
  return /^(every:\d+[mh]|daily:\d{2}:\d{2}|weekly:[0-6]:\d{2}:\d{2}|monthly:\d{2}:\d{2}:\d{2})$/.test(s);
}

export function nextRun(schedule: string, after: Date): Date {
  const [kind, ...rest] = schedule.split(':');
  if (kind === 'every') {
    const m = /^(\d+)([mh])$/.exec(rest[0] ?? '');
    const n = m ? Number(m[1]) : 60;
    const ms = m?.[2] === 'h' ? n * 3600_000 : n * 60_000;
    return new Date(after.getTime() + ms);
  }
  const p = tzParts(after);
  if (kind === 'daily') {
    const [h, mi] = rest.map(Number) as [number, number];
    let cand = zoned(p.y, p.mo, p.day, h, mi);
    if (cand <= after) cand = zoned(p.y, p.mo, p.day + 1, h, mi);
    return cand;
  }
  if (kind === 'weekly') {
    const [wd, h, mi] = rest.map(Number) as [number, number, number];
    for (let i = 0; i < 8; i++) {
      const cand = zoned(p.y, p.mo, p.day + i, h, mi);
      if (tzParts(cand).wd === wd && cand > after) return cand;
    }
  }
  if (kind === 'monthly') {
    const [dd, h, mi] = rest.map(Number) as [number, number, number];
    let cand = zoned(p.y, p.mo, dd, h, mi);
    if (cand <= after) cand = zoned(p.y, p.mo + 1, dd, h, mi);
    return cand;
  }
  return new Date(after.getTime() + 3600_000);
}

/** Expected maximum gap between runs (for "agent stale" detection). */
export function maxGapMs(schedule: string): number {
  const [kind, ...rest] = schedule.split(':');
  if (kind === 'every') {
    const m = /^(\d+)([mh])$/.exec(rest[0] ?? '');
    const n = m ? Number(m[1]) : 60;
    return (m?.[2] === 'h' ? n * 3600_000 : n * 60_000) * 2 + 15 * 60_000;
  }
  if (kind === 'daily') return 2 * 86_400_000;
  if (kind === 'weekly') return 8 * 86_400_000;
  return 32 * 86_400_000;
}
