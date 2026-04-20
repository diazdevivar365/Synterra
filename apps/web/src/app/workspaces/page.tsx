import { and, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { workspaceMembers, workspaces } from '@synterra/db';

import { db } from '@/lib/db';
import { ForbiddenError } from '@/lib/errors';
import { getSessionOrThrow } from '@/lib/session';

import { WorkspaceList } from './workspace-list';

export default async function WorkspacesPage() {
  let session;
  try {
    session = await getSessionOrThrow();
  } catch (err) {
    if (err instanceof ForbiddenError) redirect('/sign-in');
    throw err;
  }

  const rows = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(
      and(eq(workspaceMembers.userId, session.userId), eq(workspaceMembers.isDisabled, false)),
    );

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 p-8">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-fg text-2xl font-semibold">Choose a workspace</h1>
        <p className="text-muted-fg text-sm">Select a workspace to continue</p>
      </div>
      <WorkspaceList workspaces={rows} />
    </main>
  );
}
