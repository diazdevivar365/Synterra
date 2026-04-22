import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { workspaceMembers, workspaces } from '@synterra/db';

import { aquilaFetch } from '@/lib/aquila-server';
import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

interface OmiContext {
  pathname?: string | null;
  brand_id?: string | null;
  route_hint?: string | null; // e.g. "cerebro", "brands/acme", "pulse"
}

interface OmiRequest {
  message?: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
  context?: OmiContext;
}

/**
 * OMI floating chat endpoint. Wraps Aquila /chat/sync with route-aware
 * context so the assistant can ground answers in whatever page the
 * user is looking at.
 */
export async function POST(req: Request, { params }: { params: Promise<{ workspace: string }> }) {
  const { workspace: slug } = await params;

  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const ws = await db
    .select({ id: workspaces.id, name: workspaces.name })
    .from(workspaces)
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaces.slug, slug), eq(workspaceMembers.userId, ctx.userId)))
    .then((r) => r[0] ?? null);
  if (!ws) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const body = (await req.json()) as OmiRequest;
  const message = (body.message ?? '').trim();
  if (!message) return NextResponse.json({ error: 'empty message' }, { status: 400 });

  const omiCtx = body.context ?? {};
  const contextPrelude = buildContextPrelude(ws.name, slug, omiCtx);
  const enriched = contextPrelude ? `${contextPrelude}\n\nPregunta: ${message}` : message;

  const result = await aquilaFetch<{
    answer: string;
    context_size_chars: number;
    brand_id_focus: string | null;
  }>(ws.id, '/chat/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: enriched,
      brand_id: omiCtx.brand_id ?? null,
      history: body.history ?? [],
    }),
  });

  if (!result) {
    return NextResponse.json({ error: 'Aquila unavailable' }, { status: 502 });
  }

  return NextResponse.json(result);
}

function buildContextPrelude(workspaceName: string, slug: string, ctx: OmiContext): string {
  const parts: string[] = [`Workspace: ${workspaceName} (${slug}).`];
  if (ctx.route_hint) parts.push(`Usuario está viendo: ${ctx.route_hint}.`);
  if (ctx.brand_id) parts.push(`Marca en foco: ${ctx.brand_id}.`);
  if (ctx.pathname && !ctx.route_hint) parts.push(`Ruta actual: ${ctx.pathname}.`);
  return parts.join(' ');
}
