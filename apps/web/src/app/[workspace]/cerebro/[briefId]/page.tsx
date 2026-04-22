import { and, eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';

import { workspaceMembers, workspaces } from '@synterra/db';

import { brandNameFromId } from '@/lib/brands';
import { getBrief, type SignalCounts } from '@/lib/cerebro';
import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

import { BriefCard } from '../_form';

interface SignalsSnapshot {
  brand?: unknown;
  battlecards?: unknown[];
  pulse_items?: unknown[];
  recent_alerts?: unknown[];
  recent_runs?: unknown[];
  snapshot_deltas?: unknown[];
  prior_cases?: unknown[];
}

function countsFromSnapshot(snap: unknown): SignalCounts {
  const s = (snap ?? {}) as SignalsSnapshot;
  const asLen = (x: unknown) => (Array.isArray(x) ? x.length : 0);
  return {
    brand: s.brand ? 1 : 0,
    battlecards: asLen(s.battlecards),
    pulse_items: asLen(s.pulse_items),
    recent_alerts: asLen(s.recent_alerts),
    recent_runs: asLen(s.recent_runs),
    snapshot_deltas: asLen(s.snapshot_deltas),
    prior_cases: asLen(s.prior_cases),
  };
}

interface Props {
  params: Promise<{ workspace: string; briefId: string }>;
}

export default async function BriefDetailPage({ params }: Props) {
  const { workspace: slug, briefId } = await params;
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/workspaces');

  const ws = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaces.slug, slug), eq(workspaceMembers.userId, ctx.userId)))
    .then((r) => r[0] ?? null);
  if (!ws) redirect('/workspaces');

  const row = await getBrief(ws.id, briefId);
  if (!row) notFound();

  const when = new Date(row.created_at).toLocaleString('es-AR');

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8">
      <div className="mb-8">
        <div className="text-muted-fg font-mono text-[10px] uppercase tracking-wider">Brief</div>
        <h1 className="text-fg text-2xl font-bold">{brandNameFromId(row.brand_id)}</h1>
        <p className="text-muted-fg font-mono text-xs">
          {row.intent} · {when} · por {row.created_by ?? 'desconocido'}
        </p>
        {row.query && (
          <div className="border-border bg-surface mt-4 rounded-[6px] border p-3">
            <div className="text-muted-fg mb-1 font-mono text-[10px] uppercase tracking-wider">
              Pregunta
            </div>
            <p className="text-fg text-sm">{row.query}</p>
          </div>
        )}
      </div>

      <BriefCard
        brief={row.brief}
        signalCounts={countsFromSnapshot(row.signals_snapshot)}
        workspace={slug}
      />

      <div className="mt-8">
        <a
          href={`/${slug}/cerebro?brand=${row.brand_id}`}
          className="text-muted-fg hover:text-fg font-mono text-xs underline"
        >
          ← volver al cerebro
        </a>
      </div>
    </div>
  );
}
