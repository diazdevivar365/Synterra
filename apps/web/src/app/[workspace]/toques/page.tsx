import { and, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { workspaceMembers, workspaces } from '@synterra/db';

import { db } from '@/lib/db';
import { listToques } from '@/lib/toques-server';
import { getWorkspaceContext } from '@/lib/workspace-context';

import { ToquesClient } from './_form';

interface Props {
  params: Promise<{ workspace: string }>;
}

export default async function ToquesPage({ params }: Props) {
  const { workspace: slug } = await params;
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/workspaces');

  const ws = await db
    .select({ id: workspaces.id, name: workspaces.name })
    .from(workspaces)
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaces.slug, slug), eq(workspaceMembers.userId, ctx.userId)))
    .then((r) => r[0] ?? null);
  if (!ws) redirect('/workspaces');

  const toques = await listToques(ws.id);

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-8">
      <div className="mb-8">
        <h1 className="text-fg text-2xl font-bold">Toque personal</h1>
        <p className="text-muted-fg font-mono text-xs">
          Referencias creativas que el cerebro + agentes aplican como overlay. 6 tipos (estilo / URL
          / libro / autor / cita / texto libre). Compartí los que sirven al equipo.
        </p>
      </div>

      <ToquesClient workspace={slug} initialToques={toques} />
    </div>
  );
}
