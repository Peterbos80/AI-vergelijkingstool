import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { adminContext } from '@/lib/admin/context';
import { getAdmin } from '@/lib/auth/session';
import { Logo } from '@/components/site/Logo';
import { LoginForm } from './LoginForm';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminContext();
  return { title: t('admin.login.title') };
}

export default async function LoginPage() {
  if (await getAdmin()) redirect('/admin');
  const { t } = await adminContext();
  return (
    <main id="main" className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm p-6 md:p-8">
        <div className="mb-6 flex items-center gap-2 font-bold">
          <Logo />
          <span>{t('meta.siteName')}</span>
        </div>
        <h1 className="text-2xl">{t('admin.login.title')}</h1>
        <p className="mt-1 mb-6 text-sm text-ink-3">{t('admin.login.intro')}</p>
        <LoginForm
          labels={{
            email: t('admin.login.email'),
            password: t('admin.login.password'),
            submit: t('admin.login.submit'),
            failed: t('admin.login.failed'),
            rateLimited: t('admin.login.rateLimited'),
          }}
        />
        <p className="mt-6 text-xs text-ink-3">{t('admin.login.setup')}</p>
      </div>
    </main>
  );
}
