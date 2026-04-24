import { and, eq } from 'drizzle-orm';
import { Share2 } from 'lucide-react';
import { redirect } from 'next/navigation';

import { workspaceMembers, workspaces } from '@synterra/db';

import { TenantGraph } from '@/components/tenant-graph';
import { db } from '@/lib/db';
import { getTenantGraph } from '@/lib/graph-tenant';
import { getWorkspaceContext } from '@/lib/workspace-context';

export default async function TenantGraphPage({
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

  const graph = await getTenantGraph(ws.id);

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Share2 className="text-accent h-6 w-6" />
        <div>
          <h1 className="text-fg text-xl font-semibold">Knowledge Graph</h1>
          <p className="text-muted-fg text-sm">
            Tenant-wide topology — brands, tech, social, competitors
          </p>
        </div>
      </div>

      {!graph || graph.nodes.length === 0 ? (
        <div className="border-border flex min-h-[320px] items-center justify-center rounded-[8px] border">
          <p className="text-muted-fg font-mono text-sm">
            Graph empty — run research on brands to populate nodes.
          </p>
        </div>
      ) : (
        <TenantGraph graph={graph} workspaceSlug={slug} />
      )}
    </div>
  );
}
