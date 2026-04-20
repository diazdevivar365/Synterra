import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { users, workspaceMembers } from '@synterra/db';

import { MembersList } from '@/components/members-list';
import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

export default async function MembersSettingsPage() {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/workspaces');

  const members = await db
    .select({
      userId: workspaceMembers.userId,
      role: workspaceMembers.role,
      joinedAt: workspaceMembers.joinedAt,
      email: users.email,
      name: users.name,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(eq(workspaceMembers.workspaceId, ctx.workspaceId));

  return (
    <MembersList
      workspaceId={ctx.workspaceId}
      callerUserId={ctx.userId}
      callerRole={ctx.role}
      members={members}
    />
  );
}
