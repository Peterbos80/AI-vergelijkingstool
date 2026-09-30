/**
 * Admin sessions (docs/strategy/08 §10): random 256-bit tokens in an
 * httpOnly, SameSite=Strict cookie scoped to /admin; only a SHA-256 of the
 * token is stored. Sliding 7-day expiry. Roles: owner > editor > viewer.
 */
import { createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, eq, gt, lt } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { adminSessions, adminUsers, auditLog } from '@/lib/db/schema';
import { token } from '@/lib/ids';
import { siteUrl } from '@/lib/env';

export const SESSION_COOKIE = 'aitw_admin';
const TTL_MS = 7 * 86_400_000;
const REFRESH_WHEN_LEFT_MS = 6 * 86_400_000;

export type Role = 'owner' | 'editor' | 'viewer';
const RANK: Record<Role, number> = { viewer: 0, editor: 1, owner: 2 };

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
}

export const hashSessionToken = (t: string) => createHash('sha256').update(t).digest('hex');

function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: siteUrl().startsWith('https://'),
    path: '/admin',
    maxAge: maxAgeSeconds,
  };
}

export async function createSession(userId: string, userAgent: string | null): Promise<void> {
  const raw = token(32);
  const db = getDb();
  await db.insert(adminSessions).values({ id: hashSessionToken(raw), userId, expiresAt: new Date(Date.now() + TTL_MS), userAgent: userAgent?.slice(0, 200) ?? null });
  // Opportunistic cleanup of expired sessions.
  await db.delete(adminSessions).where(lt(adminSessions.expiresAt, new Date()));
  (await cookies()).set(SESSION_COOKIE, raw, cookieOptions(TTL_MS / 1000));
}

export async function getAdmin(): Promise<AdminUser | null> {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!raw || raw.length < 20 || raw.length > 200) return null;
  const db = getDb();
  const id = hashSessionToken(raw);
  const [row] = await db
    .select({ session: adminSessions, user: adminUsers })
    .from(adminSessions)
    .innerJoin(adminUsers, eq(adminUsers.id, adminSessions.userId))
    .where(and(eq(adminSessions.id, id), gt(adminSessions.expiresAt, new Date()), eq(adminUsers.disabled, false)));
  if (!row) return null;
  if (row.session.expiresAt.getTime() - Date.now() < REFRESH_WHEN_LEFT_MS) {
    await db.update(adminSessions).set({ expiresAt: new Date(Date.now() + TTL_MS) }).where(eq(adminSessions.id, id));
  }
  return { id: row.user.id, email: row.user.email, name: row.user.name, role: row.user.role };
}

/** For pages and server actions: redirect to login, or refuse an insufficient role. */
export async function requireAdmin(min: Role = 'viewer'): Promise<AdminUser> {
  const user = await getAdmin();
  if (!user) redirect('/admin/login');
  if (RANK[user.role] < RANK[min]) redirect('/admin?flash=forbidden');
  return user;
}

export function can(user: AdminUser, min: Role): boolean {
  return RANK[user.role] >= RANK[min];
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (raw) await getDb().delete(adminSessions).where(eq(adminSessions.id, hashSessionToken(raw)));
  jar.set(SESSION_COOKIE, '', cookieOptions(0));
}

export async function audit(user: AdminUser | null, action: string, entityType?: string, entityId?: string, detail?: Record<string, unknown>): Promise<void> {
  try {
    await getDb().insert(auditLog).values({ userId: user?.id ?? null, action, entityType: entityType ?? null, entityId: entityId ?? null, detail: detail ?? null });
  } catch {
    /* auditing must not break the action */
  }
}
