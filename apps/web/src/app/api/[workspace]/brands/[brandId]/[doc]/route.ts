import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { workspaceMembers, workspaces } from '@synterra/db';

import { aquilaFetchRaw } from '@/lib/aquila-server';
import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

const ALLOWED_DOCS = new Set(['briefing', 'moodboard']);

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workspace: string; brandId: string; doc: string }> },
) {
  const { workspace: slug, brandId, doc } = await params;

  if (!ALLOWED_DOCS.has(doc)) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

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
    `/brands/${encodeURIComponent(brandId)}/${doc}.pdf`,
  );
  if (!aquilaRes) {
    return NextResponse.json({ error: `${doc} not found` }, { status: 404 });
  }

  const body = await aquilaRes.arrayBuffer();
  const disposition =
    aquilaRes.headers.get('content-disposition') ?? `attachment; filename="${doc}-${brandId}.pdf"`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': disposition,
    },
  });
}
