import { and, eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';

import { workspaceMembers, workspaces } from '@synterra/db';

import { getAgent } from '@/lib/agents-server';
import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

interface Props {
  params: Promise<{ workspace: string; name: string }>;
}

export default async function AgentDetailPage({ params }: Props) {
  const { workspace: slug, name } = await params;
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/workspaces');

  const ws = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaces.slug, slug), eq(workspaceMembers.userId, ctx.userId)))
    .then((r) => r[0] ?? null);
  if (!ws) redirect('/workspaces');

  const agent = await getAgent(ws.id, name);
  if (!agent) notFound();

  return (
    <div className="mx-auto max-w-[1000px] px-6 py-8">
      <div className="mb-6">
        <a
          href={`/${slug}/agents`}
          className="text-muted-fg hover:text-fg font-mono text-[10px] uppercase tracking-wider"
        >
          ← agentes
        </a>
        <h1 className="text-fg mt-2 text-2xl font-bold">{agent.name}</h1>
        <p className="text-muted-fg font-mono text-xs">
          {agent.role} · v{agent.version}
          {agent.llm ? ` · ${agent.llm}` : ''}
        </p>
      </div>

      <section className="mb-6">
        <h2 className="text-muted-fg mb-2 font-mono text-[10px] uppercase tracking-wider">Goal</h2>
        <p className="text-fg text-sm leading-relaxed">{agent.goal}</p>
      </section>

      <section>
        <h2 className="text-muted-fg mb-2 font-mono text-[10px] uppercase tracking-wider">
          System prompt
        </h2>
        <pre className="border-border bg-surface max-h-[72vh] overflow-auto whitespace-pre-wrap rounded-[8px] border p-4 font-mono text-[11px] leading-relaxed">
          {agent.prompt}
        </pre>
      </section>
    </div>
  );
}
