import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/sign-in');

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6">
      <h1 className="text-fg text-2xl font-semibold">Dashboard</h1>
      <p className="text-muted-fg text-sm">
        Signed in as{' '}
        <span className="text-fg font-medium">{session.user.email}</span>
      </p>
      <form
        action={async () => {
          'use server';
          const { auth: a } = await import('@/lib/auth');
          const { headers: h } = await import('next/headers');
          await a.api.signOut({ headers: await h() });
          redirect('/sign-in');
        }}
      >
        <button
          type="submit"
          className="border-border bg-surface text-muted-fg hover:text-fg rounded-lg border px-4 py-2 text-sm transition-colors"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
