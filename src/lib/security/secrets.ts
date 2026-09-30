/**
 * Constant-time secret comparison (no early exit, no length leak): both
 * values are hashed first so timingSafeEqual always sees equal lengths.
 */
import { createHash, timingSafeEqual } from 'node:crypto';

export function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** Parse "Authorization: Bearer <token>". */
export function bearer(header: string | null): string | null {
  const m = /^Bearer\s+(\S+)$/i.exec(header ?? '');
  return m ? m[1]! : null;
}
