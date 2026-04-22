import { and, eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';

import { workspaceMembers, workspaces } from '@synterra/db';

import { db } from '@/lib/db';
import { getWorkflowRun } from '@/lib/workflows-server';
import { getWorkspaceContext } from '@/lib/workspace-context';

import { RunStreamClient } from './_client';

interface Props {
  params: Promise<{ workspace: string; slug: string; runId: string }>;
}

export const dynamic = 'force-dynamic';

export default async function RunDetailPage({ params }: Props) {
  const { workspace: ws_slug, slug: wfSlug, runId } = await params;
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/workspaces');

  const ws = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaces.slug, ws_slug), eq(workspaceMembers.userId, ctx.userId)))
    .then((r) => r[0] ?? null);
  if (!ws) redirect('/workspaces');

  const run = await getWorkflowRun(ws.id, runId);
  if (!run) notFound();

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8">
      <div className="mb-6">
        <a
          href={`/${ws_slug}/workflows/${wfSlug}`}
          className="text-muted-fg hover:text-fg font-mono text-[10px] uppercase tracking-wider"
        >
          ← volver al workflow
        </a>
        <h1 className="text-fg mt-2 text-xl font-bold">Run {runId.slice(0, 8)}</h1>
        <p className="text-muted-fg font-mono text-xs">
          creado {new Date(run.created_at).toLocaleString('es-AR')} · por{' '}
          {run.created_by ?? 'desconocido'}
        </p>
      </div>

      <RunStreamClient workspace={ws_slug} runId={runId} initial={run} />
    </div>
  );
}
