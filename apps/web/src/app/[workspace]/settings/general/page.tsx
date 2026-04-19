import { eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';

import { workspaces } from '@synterra/db';

import { GeneralSettingsForm } from '@/components/general-settings-form';
import { db } from '@/lib/db.js';
import { getWorkspaceContext } from '@/lib/workspace-context';

export default async function GeneralSettingsPage() {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/workspaces');

  const [workspace] = await db
    .select({ id: workspaces.id, name: workspaces.name, slug: workspaces.slug })
    .from(workspaces)
    .where(eq(workspaces.id, ctx.workspaceId))
    .limit(1);

  if (!workspace) notFound();

  return (
    <GeneralSettingsForm
      workspaceId={workspace.id}
      workspaceName={workspace.name}
      workspaceSlug={workspace.slug}
      callerRole={ctx.role}
    />
  );
}
