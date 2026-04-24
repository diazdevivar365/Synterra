import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { workspaceMembers, workspaces } from '@synterra/db';

import { aquilaFetch } from '@/lib/aquila-server';
import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ workspace: string; brandId: string }> },
) {
  const { workspace: slug, brandId } = await params;

  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const ws = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaces.slug, slug), eq(workspaceMembers.userId, ctx.userId)))
    .then((r) => r[0] ?? null);
  if (!ws) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { from_date?: string };
  const fromDate = body.from_date?.trim();
  if (!fromDate || !/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
    return NextResponse.json({ error: 'from_date must be YYYY-MM-DD' }, { status: 400 });
  }

  const result = await aquilaFetch<{
    brand_id: string;
    from_date: string;
    narrative: string;
  }>(
    ws.id,
    `/brands/${encodeURIComponent(brandId)}/timeline-narrate?from_date=${encodeURIComponent(fromDate)}`,
    { method: 'POST' },
  );

  if (!result) {
    return NextResponse.json({ error: 'Aquila unavailable' }, { status: 502 });
  }

  return NextResponse.json(result);
}
