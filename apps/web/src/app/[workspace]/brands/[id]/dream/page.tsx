import { and, eq } from 'drizzle-orm';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { workspaceMembers, workspaces } from '@synterra/db';

import { brandNameFromId } from '@/lib/brands';
import { db } from '@/lib/db';
import { getLatestDream, listDreamHistory } from '@/lib/dreamer-server';
import { getWorkspaceContext } from '@/lib/workspace-context';

import { DreamClient } from './_client';

interface Props {
  params: Promise<{ workspace: string; id: string }>;
}

export const dynamic = 'force-dynamic';

export default async function BrandDreamPage({ params }: Props) {
  const { workspace: slug, id } = await params;
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/workspaces');

  const ws = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaces.slug, slug), eq(workspaceMembers.userId, ctx.userId)))
    .then((r) => r[0] ?? null);
  if (!ws) redirect('/workspaces');

  const [latest, history] = await Promise.all([
    getLatestDream(ws.id, id),
    listDreamHistory(ws.id, id, 10),
  ]);

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-8">
      <Link
        href={`/${slug}/brands/${id}`}
        className="text-muted-fg hover:text-fg mb-4 inline-flex items-center gap-1.5 font-mono text-xs transition-colors duration-150"
      >
        <ArrowLeft className="h-3 w-3" />
        {brandNameFromId(id)}
      </Link>

      <div className="mb-8">
        <h1 className="text-fg text-2xl font-bold">Brand Dream</h1>
        <p className="text-muted-fg font-mono text-xs">
          Memory Architect (Dreamer) consolida señales del workspace (intel + snapshots + change
          events + pulse + battlecards + toques + briefs previos) en un artefacto de marca
          accionable.
        </p>
      </div>

      <DreamClient workspace={slug} brandId={id} initialLatest={latest} history={history} />
    </div>
  );
}
