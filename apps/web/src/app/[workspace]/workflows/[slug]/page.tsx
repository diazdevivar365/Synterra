import { and, eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';

import { workspaceMembers, workspaces } from '@synterra/db';

import { db } from '@/lib/db';
import { getWorkflow, listWorkflowRuns } from '@/lib/workflows-server';
import { getWorkspaceContext } from '@/lib/workspace-context';

import { WorkflowDetailClient } from './_client';

interface Props {
  params: Promise<{ workspace: string; slug: string }>;
}

export default async function WorkflowDetailPage({ params }: Props) {
  const { workspace: ws_slug, slug } = await params;
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/workspaces');

  const ws = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaces.slug, ws_slug), eq(workspaceMembers.userId, ctx.userId)))
    .then((r) => r[0] ?? null);
  if (!ws) redirect('/workspaces');

  const [workflow, runs] = await Promise.all([
    getWorkflow(ws.id, slug),
    listWorkflowRuns(ws.id, slug, 50),
  ]);
  if (!workflow) notFound();

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8">
      <div className="mb-8">
        <a
          href={`/${ws_slug}/workflows`}
          className="text-muted-fg hover:text-fg mb-3 inline-block font-mono text-[10px] uppercase tracking-wider"
        >
          ← workflows
        </a>
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h1 className="text-fg text-2xl font-bold">{workflow.name}</h1>
            <p className="text-muted-fg font-mono text-xs">
              {workflow.slug} · intent: {workflow.intent} ·{' '}
              {workflow.enabled ? 'activo' : 'deshabilitado'}
            </p>
          </div>
          {workflow.enabled && (
            <span className="rounded-[4px] border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 font-mono text-[10px] text-emerald-400">
              activo
            </span>
          )}
        </div>
        {workflow.description && (
          <p className="text-fg mt-3 max-w-[700px] text-sm leading-relaxed">
            {workflow.description}
          </p>
        )}
      </div>

      <WorkflowDetailClient workspace={ws_slug} workflow={workflow} initialRuns={runs} />
    </div>
  );
}
