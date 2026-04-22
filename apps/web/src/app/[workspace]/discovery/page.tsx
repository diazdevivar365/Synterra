import { and, eq } from 'drizzle-orm';
import { Plus } from 'lucide-react';
import { redirect } from 'next/navigation';

import { workspaceMembers, workspaces } from '@synterra/db';

import { DiscoveryForm } from '@/components/discovery-form';
import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

export default async function DiscoveryPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;

  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/workspaces');

  const ws = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaces.slug, slug), eq(workspaceMembers.userId, ctx.userId)))
    .then((r) => r[0] ?? null);
  if (!ws) redirect('/workspaces');

  return (
    <div className="max-w-2xl space-y-8 p-6">
      <div className="flex items-center gap-3">
        <Plus className="text-accent h-6 w-6" />
        <div>
          <h1 className="text-fg text-xl font-semibold">Brand Discovery</h1>
          <p className="text-muted-fg text-sm">
            Add brands by URL, domain, name, or Instagram handle
          </p>
        </div>
      </div>

      <DiscoveryForm slug={slug} />
    </div>
  );
}
