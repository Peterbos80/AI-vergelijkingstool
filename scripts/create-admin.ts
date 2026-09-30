/**
 * Create or reset an admin user.
 *   npm run admin:create -- --email you@example.com --password '…' [--role owner|editor|viewer] [--name "…"]
 * Falls back to ADMIN_EMAIL / ADMIN_PASSWORD from the environment.
 */
import './_env';
import { eq } from 'drizzle-orm';
import { closeDb, getDb } from '../src/lib/db/client';
import { adminSessions, adminUsers } from '../src/lib/db/schema';
import { hashPassword } from '../src/lib/auth/password';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = (arg('email') ?? process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const password = arg('password') ?? process.env.ADMIN_PASSWORD ?? '';
  const role = (arg('role') ?? 'owner') as 'owner' | 'editor' | 'viewer';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Provide a valid --email (or ADMIN_EMAIL)');
  if (!['owner', 'editor', 'viewer'].includes(role)) throw new Error('--role must be owner, editor or viewer');
  const passwordHash = await hashPassword(password);
  const db = getDb();
  const [existing] = await db.select().from(adminUsers).where(eq(adminUsers.email, email));
  if (existing) {
    await db.update(adminUsers).set({ passwordHash, role, disabled: false, name: arg('name') ?? existing.name }).where(eq(adminUsers.id, existing.id));
    // A new password ends every existing session of this account.
    const revoked = await db.delete(adminSessions).where(eq(adminSessions.userId, existing.id)).returning({ id: adminSessions.id });
    console.log(`[admin] updated ${email} (${role}); ${revoked.length} session(s) revoked`);
  } else {
    await db.insert(adminUsers).values({ email, passwordHash, role, name: arg('name') ?? null });
    console.log(`[admin] created ${email} (${role})`);
  }
}

main()
  .catch((err) => {
    console.error('[admin] failed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
