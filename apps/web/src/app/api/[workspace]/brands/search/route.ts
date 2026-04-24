import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { workspaceMembers, workspaces } from '@synterra/db';

import { aquilaFetch } from '@/lib/aquila-server';
import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

interface RawResult {
  brand_id: string;
  url: string | null;
  tagline: string | null;
  match_field: string | null;
  match_snippet: string | null;
  updated_at: string | null;
}

export async function GET(req: Request, { params }: { params: Promise<{ workspace: string }> }) {
  const { workspace: slug } = await params;
  const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';
  if (q.length < 1) return NextResponse.json({ results: [] });

  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const ws = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaces.slug, slug), eq(workspaceMembers.userId, ctx.userId)))
    .then((r) => r[0] ?? null);
  if (!ws) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const data = await aquilaFetch<{ results: RawResult[] }>(
    ws.id,
    `/brands/search?q=${encodeURIComponent(q)}&limit=12`,
  );

  if (!data) return NextResponse.json({ results: [] });

  return NextResponse.json({
    results: data.results.map((r) => ({
      brandId: r.brand_id,
      url: r.url,
      tagline: r.tagline,
      matchField: r.match_field,
      matchSnippet: r.match_snippet,
    })),
  });
}
