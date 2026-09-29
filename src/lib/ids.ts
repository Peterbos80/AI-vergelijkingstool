import { randomBytes, randomUUID } from 'node:crypto';

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** ULID: 48-bit time + 80-bit randomness, lexicographically sortable. */
export function ulid(now: number = Date.now()): string {
  let time = '';
  let t = now;
  for (let i = 0; i < 10; i++) {
    time = CROCKFORD[t % 32] + time;
    t = Math.floor(t / 32);
  }
  const bytes = randomBytes(16);
  let rand = '';
  for (let i = 0; i < 16; i++) rand += CROCKFORD[bytes[i]! % 32];
  return time + rand;
}

/** Short, URL-safe public id (stacks). */
export function publicId(length = 10): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += CROCKFORD[bytes[i]! % 32]!.toLowerCase();
  return out;
}

export function uuid(): string {
  return randomUUID();
}

export function token(bytes = 24): string {
  return randomBytes(bytes).toString('base64url');
}
