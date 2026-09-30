'use server';

import { redirect } from 'next/navigation';
import { audit, destroySession, getAdmin } from '@/lib/auth/session';

export async function logoutAction(): Promise<void> {
  const user = await getAdmin();
  await destroySession();
  if (user) await audit(user, 'logout');
  redirect('/admin/login');
}
