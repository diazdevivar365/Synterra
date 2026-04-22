import { and, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { workspaceMembers, workspaces } from '@synterra/db';

import { db } from '@/lib/db';
import { listWorkflows } from '@/lib/workflows-server';
import { getWorkspaceContext } from '@/lib/workspace-context';

import { WorkflowsClient } from './_client';

import type { Workflow } from '@/lib/workflows';

interface Props {
  params: Promise<{ workspace: string }>;
}

export default async function WorkflowsPage({ params }: Props) {
  const { workspace: slug } = await params;
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/workspaces');

  const ws = await db
    .select({ id: workspaces.id, name: workspaces.name })
    .from(workspaces)
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaces.slug, slug), eq(workspaceMembers.userId, ctx.userId)))
    .then((r) => r[0] ?? null);
  if (!ws) redirect('/workspaces');

  const items: Workflow[] = await listWorkflows(ws.id);

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8">
      <div className="mb-8 flex items-baseline justify-between">
        <div>
          <h1 className="text-fg text-2xl font-bold">Workflows</h1>
          <p className="text-muted-fg font-mono text-xs">
            Flujos agénticos multi-paso. Cada run se orquesta con LangGraph en Aquila. Canvas visual
            (preview) en <code>/workflows/canvas</code>.
          </p>
        </div>
        <a
          href={`/${slug}/workflows/canvas`}
          className="text-muted-fg hover:text-fg rounded-[6px] border border-[#3a4452] px-3 py-1.5 font-mono text-[11px] transition-colors"
        >
          Ver canvas ↗
        </a>
      </div>

      <WorkflowsClient workspace={slug} initialWorkflows={items} />
    </div>
  );
}
