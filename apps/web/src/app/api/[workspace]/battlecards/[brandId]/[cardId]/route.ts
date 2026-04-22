import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { workspaceMembers, workspaces } from '@synterra/db';

import { aquilaFetchRaw } from '@/lib/aquila-server';
import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workspace: string; brandId: string; cardId: string }> },
) {
  const { workspace: slug, brandId, cardId } = await params;

  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const ws = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaces.slug, slug), eq(workspaceMembers.userId, ctx.userId)))
    .then((r) => r[0] ?? null);
  if (!ws) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const aquilaRes = await aquilaFetchRaw(
    ws.id,
    `/brands/${encodeURIComponent(brandId)}/battlecards/${encodeURIComponent(cardId)}.pdf`,
  );
  if (!aquilaRes) {
    return NextResponse.json({ error: 'battlecard not found' }, { status: 404 });
  }

  const body = await aquilaRes.arrayBuffer();
  const disposition =
    aquilaRes.headers.get('content-disposition') ??
    `attachment; filename="battlecard-${brandId}-vs-competitor.pdf"`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': disposition,
    },
  });
}
