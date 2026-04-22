import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { workspaceMembers, workspaces } from '@synterra/db';

import { aquilaFetchRaw } from '@/lib/aquila-server';
import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

const ALLOWED_FORMATS = new Set(['json', 'csv', 'md']);

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workspace: string; format: string }> },
) {
  const { workspace: slug, format } = await params;

  if (!ALLOWED_FORMATS.has(format)) {
    return NextResponse.json({ error: 'invalid format' }, { status: 400 });
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

  const aquilaRes = await aquilaFetchRaw(ws.id, `/brands/export/portfolio.${format}`);
  if (!aquilaRes) {
    return NextResponse.json({ error: 'export unavailable' }, { status: 502 });
  }

  const contentType = aquilaRes.headers.get('content-type') ?? 'application/octet-stream';
  const disposition =
    aquilaRes.headers.get('content-disposition') ?? `attachment; filename="portfolio.${format}"`;

  const body = await aquilaRes.arrayBuffer();
  return new Response(body, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': disposition,
    },
  });
}
