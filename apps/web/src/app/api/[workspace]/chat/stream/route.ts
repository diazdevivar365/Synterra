import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { workspaceMembers, workspaces } from '@synterra/db';

import { aquilaFetchRaw } from '@/lib/aquila-server';
import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ workspace: string }> }) {
  const { workspace: slug } = await params;

  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const ws = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaces.slug, slug), eq(workspaceMembers.userId, ctx.userId)))
    .then((r) => r[0] ?? null);
  if (!ws) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    message?: string;
    brand_id?: string | null;
    history?: { role: string; content: string }[];
  };

  const aquilaRes = await aquilaFetchRaw(ws.id, '/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: body.message ?? '',
      brand_id: body.brand_id ?? null,
      history: body.history ?? [],
    }),
  });

  if (!aquilaRes?.body) {
    return NextResponse.json({ error: 'Aquila unavailable' }, { status: 502 });
  }

  return new Response(aquilaRes.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store, no-transform',
      Connection: 'keep-alive',
    },
  });
}
