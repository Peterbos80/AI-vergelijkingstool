'use server';

import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db/client';
import { adminUsers } from '@/lib/db/schema';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { audit, createSession } from '@/lib/auth/session';
import { clientIp } from '@/lib/analytics/visitor';
import { rateLimit } from '@/lib/security/rate-limit';

export interface LoginState {
  error: 'failed' | 'rateLimited' | null;
  /** Echoed back so the field survives React's form reset after a failed attempt. */
  email: string;
}

let dummyHash: Promise<string> | null = null;
/** Verify against a real hash even for unknown e-mails, so timing does not reveal accounts. */
const dummy = () => (dummyHash ??= hashPassword('timing-equalizer-not-a-real-password'));
const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 24);

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase().slice(0, 200);
  const password = String(formData.get('password') ?? '').slice(0, 500);
  const h = await headers();
  const ipOk = await rateLimit(`login:ip:${sha(clientIp(h))}`, 20, 900);
  const emailOk = await rateLimit(`login:email:${sha(email)}`, 5, 900);
  if (!ipOk || !emailOk) {
    await audit(null, 'login_rate_limited', 'admin_user', undefined, { email: sha(email) });
    return { error: 'rateLimited', email };
  }
  const db = getDb();
  const [user] = email ? await db.select().from(adminUsers).where(eq(adminUsers.email, email)) : [];
  const ok = await verifyPassword(password, user?.passwordHash ?? (await dummy()));
  if (!user || user.disabled || !ok) {
    await audit(null, 'login_failed', 'admin_user', user?.id, { email: sha(email) });
    return { error: 'failed', email };
  }
  await createSession(user.id, h.get('user-agent'));
  await db.update(adminUsers).set({ lastLoginAt: new Date() }).where(eq(adminUsers.id, user.id));
  await audit({ id: user.id, email: user.email, name: user.name, role: user.role }, 'login');
  redirect('/admin');
}
