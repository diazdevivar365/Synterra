import { and, eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';

import { workspaceMembers, workspaces } from '@synterra/db';

import { aquilaFetchRaw } from '@/lib/aquila-server';
import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
};

function errorStream(message: string): NextResponse {
  return new NextResponse(`event: error\ndata: ${JSON.stringify({ error: message })}\n\n`, {
    status: 200,
    headers: SSE_HEADERS,
  });
}

/**
 * Proxy SSE stream for a workflow run.
 *
 * Flow:
 *   1. Authenticate the caller + resolve the workspace.
 *   2. aquilaFetchRaw mints a short-lived service JWT under the hood and
 *      calls GET /workflow-runs/{id}/stream on Aquila. Aquila accepts the
 *      Authorization header as an alternative to the ?token= query param
 *      precisely so this kind of server-side proxy works.
 *   3. Stream the upstream body straight back to the browser EventSource.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ workspace: string; runId: string }> },
) {
  const { workspace: slug, runId } = await params;

  const ctx = await getWorkspaceContext();
  if (!ctx) return errorStream('unauthorized');

  const ws = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaces.slug, slug), eq(workspaceMembers.userId, ctx.userId)))
    .then((r) => r[0] ?? null);
  if (!ws) return errorStream('workspace not found');

  const upstream = await aquilaFetchRaw(
    ws.id,
    `/workflow-runs/${encodeURIComponent(runId)}/stream`,
  );
  if (!upstream?.ok || !upstream.body) {
    return errorStream('upstream unavailable');
  }

  return new NextResponse(upstream.body, { status: 200, headers: SSE_HEADERS });
}
