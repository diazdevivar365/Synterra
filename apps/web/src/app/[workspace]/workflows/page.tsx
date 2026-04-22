import { and, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { workspaceMembers, workspaces } from '@synterra/db';

import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

import { WorkflowCanvas } from './workflow-canvas';

interface Props {
  params: Promise<{ workspace: string }>;
}

export default async function WorkflowsPage({ params }: Props) {
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

  return (
    <div className="min-h-dvh bg-[#000000] text-[#ffffff]">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(800px_500px_at_20%_10%,rgba(203,53,0,0.08),transparent_70%),radial-gradient(600px_400px_at_80%_90%,rgba(92,147,159,0.06),transparent_70%)]"
      />

      <div className="relative mx-auto max-w-[1500px] px-6 py-10 lg:px-10">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#4a5464]">
              workspace · {slug} · workflows
            </p>
            <h1 className="mt-2 bg-gradient-to-b from-[#ffffff] to-[#888888] bg-clip-text text-[44px] font-bold leading-[1.05] tracking-tight text-transparent">
              Intelligence Graph
            </h1>
            <p className="mt-2 max-w-[640px] text-[15px] leading-relaxed text-[#888888]">
              Compose multi-step agentic flows. Each node is a specialist. Connect, configure, run.
              Watch live as the graph executes across the Aquila data plane.
            </p>
          </div>
        </header>

        <WorkflowCanvas workspaceSlug={slug} />
      </div>
    </div>
  );
}
