import { and, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { workspaceMembers, workspaces } from '@synterra/db';

import { db } from '@/lib/db';
import { getMostUsedReferences, listReferences } from '@/lib/references-server';
import { getWorkspaceContext } from '@/lib/workspace-context';

import { ReferencesClient } from './_client';

interface Props {
  params: Promise<{ workspace: string }>;
}

export default async function ReferencesPage({ params }: Props) {
  const { workspace: slug } = await params;
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/workspaces');

  const ws = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaces.slug, slug), eq(workspaceMembers.userId, ctx.userId)))
    .then((r) => r[0] ?? null);
  if (!ws) redirect('/workspaces');

  const [items, mostUsed] = await Promise.all([
    listReferences(ws.id, { limit: 100 }),
    getMostUsedReferences(ws.id, 6),
  ]);

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8">
      <div className="mb-8">
        <h1 className="text-fg text-2xl font-bold">Banco de referencias</h1>
        <p className="text-muted-fg font-mono text-xs">
          Catálogo de inspiración del workspace · tagger agent extrae keywords + mood + aesthetics
          async · usage tracking te muestra qué se usa y qué podés archivar.
        </p>
      </div>

      <ReferencesClient workspace={slug} initial={items} mostUsed={mostUsed} />
    </div>
  );
}
