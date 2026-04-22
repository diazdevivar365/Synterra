import { and, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { workspaceMembers, workspaces } from '@synterra/db';

import { listAgents } from '@/lib/agents-server';
import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

interface Props {
  params: Promise<{ workspace: string }>;
}

const ROLE_TONE: { pattern: RegExp; tone: string }[] = [
  { pattern: /strateg|strategist|estrateg/i, tone: 'border-sky-500/30 bg-sky-500/5' },
  { pattern: /art|creative|visual/i, tone: 'border-purple-500/30 bg-purple-500/5' },
  { pattern: /copy|redact|writer|voice/i, tone: 'border-amber-500/30 bg-amber-500/5' },
  { pattern: /eval|quality|auditor/i, tone: 'border-emerald-500/30 bg-emerald-500/5' },
  { pattern: /naming|brand/i, tone: 'border-pink-500/30 bg-pink-500/5' },
  { pattern: /dream|memory|caio/i, tone: 'border-indigo-500/30 bg-indigo-500/5' },
];

function toneFor(role: string): string {
  for (const r of ROLE_TONE) {
    if (r.pattern.test(role)) return r.tone;
  }
  return 'border-border bg-surface';
}

export default async function AgentsPage({ params }: Props) {
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

  const items = await listAgents(ws.id);

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8">
      <div className="mb-8">
        <h1 className="text-fg text-2xl font-bold">Agentes</h1>
        <p className="text-muted-fg font-mono text-xs">
          {items.length} agentes disponibles · seed prompts en Aquila · accesibles desde workflows +
          cerebro + dreamer. Per-workspace overrides llegan con Sprint 2.1.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="border-border flex min-h-[200px] items-center justify-center rounded-[8px] border">
          <p className="text-muted-fg font-mono text-xs">No hay agentes en el registry.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((a) => (
            <a
              key={a.name}
              href={`/${slug}/agents/${a.name}`}
              className={`hover:border-accent/40 block rounded-[8px] border p-4 transition-colors ${toneFor(a.role)}`}
            >
              <div className="mb-1 flex items-start justify-between gap-3">
                <div className="text-fg text-sm font-semibold">{a.name}</div>
                {a.llm && (
                  <span className="text-muted-fg font-mono text-[9px]">{a.llm.split('/')[0]}</span>
                )}
              </div>
              <div className="text-muted-fg mb-2 font-mono text-[10px] uppercase tracking-wider">
                {a.role}
              </div>
              <p className="text-fg line-clamp-3 text-xs leading-relaxed">{a.goal}</p>
              <div className="text-muted-fg mt-3 flex items-center gap-3 font-mono text-[10px]">
                <span>v{a.version}</span>
                <span>·</span>
                <span>{a.prompt_length.toLocaleString('es-AR')} chars</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
