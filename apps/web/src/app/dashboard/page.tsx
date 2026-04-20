import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { createDb, workspaceMembers } from '@synterra/db';

import { claimOnboarding } from '@/actions/onboarding.js';
import { auth } from '@/lib/auth';

interface Props {
  searchParams: Promise<{ inflight?: string }>;
}

export default async function DashboardPage({ searchParams }: Props) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/sign-in');

  const { inflight } = await searchParams;
  if (inflight) {
    const db = createDb(process.env['DATABASE_URL'] ?? '');
    const rows = await db
      .select({ workspaceId: workspaceMembers.workspaceId })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.userId, session.user.id))
      .limit(1);
    const workspaceId = rows[0]?.workspaceId;
    if (workspaceId) {
      await claimOnboarding(inflight, workspaceId);
    }
    redirect('/dashboard');
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6">
      <h1 className="text-fg text-2xl font-semibold">Dashboard</h1>
      <p className="text-muted-fg text-sm">
        Signed in as <span className="text-fg font-medium">{session.user.email}</span>
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
