import { and, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { workspaceMembers, workspaces } from '@synterra/db';

import { listBriefs } from '@/lib/cerebro';
import { db } from '@/lib/db';
import {
  getWorkspaceUsage,
  listRecentAlertFires,
  listRecentResearchRuns,
  type ResearchRunRow,
} from '@/lib/monitors';
import { listWorkflows, listWorkflowRuns } from '@/lib/workflows-server';
import { getWorkspaceContext } from '@/lib/workspace-context';

interface Props {
  params: Promise<{ workspace: string }>;
}

export const dynamic = 'force-dynamic';

export default async function MonitorsPage({ params }: Props) {
  const { workspace: slug } = await params;
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/workspaces');

  const ws = await db
    .select({ id: workspaces.id, name: workspaces.name, slug: workspaces.slug })
    .from(workspaces)
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaces.slug, slug), eq(workspaceMembers.userId, ctx.userId)))
    .then((r) => r[0] ?? null);
  if (!ws) redirect('/workspaces');

  const [usage, runs, alerts, briefs, workflows] = await Promise.all([
    getWorkspaceUsage(ws.id, 'current_month', ws.slug),
    listRecentResearchRuns(ws.id, 30),
    listRecentAlertFires(ws.id, 10),
    listBriefs(ws.id, { limit: 7 }),
    listWorkflows(ws.id),
  ]);

  // Aggregate workflow runs across all workflows (up to 50 recent per wf).
  // Guard the fetch per wf — one slow wf shouldn't block the dashboard.
  const runsByWorkflow = await Promise.all(
    workflows.slice(0, 10).map(async (w) => {
      const runs = await listWorkflowRuns(ws.id, w.slug, 20);
      return { slug: w.slug, name: w.name, runs };
    }),
  );
  const totalWfRuns = runsByWorkflow.reduce((s, x) => s + x.runs.length, 0);
  const pendingWfRuns = runsByWorkflow.reduce(
    (s, x) => s + x.runs.filter((r) => r.status === 'pending').length,
    0,
  );
  const failedWfRuns = runsByWorkflow.reduce(
    (s, x) => s + x.runs.filter((r) => r.status === 'failed').length,
    0,
  );

  const now = Date.now();
  const last7dMs = 7 * 24 * 60 * 60 * 1000;
  const runs7d = runs.filter((r) => now - new Date(r.created_at).getTime() < last7dMs);
  const runsDone = runs7d.filter((r) => r.status === 'done').length;
  const runsFailed = runs7d.filter((r) => r.status === 'error').length;
  const runsRunning = runs.filter((r) => r.status === 'running').length;
  const avgDurationSec = avgDuration(runs7d);

  const briefAvgConf =
    briefs.length > 0
      ? Math.round((briefs.reduce((s, b) => s + (b.confidence ?? 0), 0) / briefs.length) * 100)
      : null;

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-8">
      <div className="mb-8">
        <h1 className="text-fg text-2xl font-bold">Monitores</h1>
        <p className="text-muted-fg font-mono text-xs">
          Estado operativo del workspace. Refrescá la página para update.
        </p>
      </div>

      <section className="mb-8">
        <h2 className="text-muted-fg mb-3 font-mono text-[10px] uppercase tracking-wider">
          Uso del mes
        </h2>
        <div className="grid gap-3 md:grid-cols-4">
          <Metric
            label="LLM calls"
            value={usage ? fmt(usage.llm_calls) : '—'}
            sub={usage ? `${fmt(usage.tokens_in + usage.tokens_out)} tokens` : 'sin datos aún'}
          />
          <Metric
            label="Costo estimado"
            value={usage?.cost_usd != null ? `$${usage.cost_usd.toFixed(2)}` : '—'}
            sub={usage?.period ?? ''}
            tone={usage?.cost_usd != null && usage.cost_usd > 50 ? 'amber' : undefined}
          />
          <Metric
            label="Research runs"
            value={usage ? fmt(usage.research_runs) : fmt(runs7d.length)}
            sub="mes actual"
          />
          <Metric label="Marcas bajo watch" value={usage ? fmt(usage.brands) : '—'} sub="total" />
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-muted-fg mb-3 font-mono text-[10px] uppercase tracking-wider">
          Research — últimos 7 días
        </h2>
        <div className="grid gap-3 md:grid-cols-4">
          <Metric
            label="En curso"
            value={fmt(runsRunning)}
            tone={runsRunning > 0 ? 'sky' : undefined}
          />
          <Metric label="Completados" value={fmt(runsDone)} sub="7d" tone="emerald" />
          <Metric
            label="Fallidos"
            value={fmt(runsFailed)}
            sub="7d"
            tone={runsFailed > 0 ? 'red' : undefined}
          />
          <Metric
            label="Duración promedio"
            value={avgDurationSec != null ? `${avgDurationSec}s` : '—'}
            sub="7d"
          />
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-muted-fg mb-3 font-mono text-[10px] uppercase tracking-wider">
          Workflows (LangGraph)
        </h2>
        <div className="grid gap-3 md:grid-cols-4">
          <Metric label="Definiciones" value={fmt(workflows.length)} sub="workspace" />
          <Metric label="Runs totales" value={fmt(totalWfRuns)} sub="recientes" />
          <Metric
            label="Pending"
            value={fmt(pendingWfRuns)}
            sub="esperando executor"
            tone={pendingWfRuns > 0 ? 'amber' : undefined}
          />
          <Metric
            label="Failed"
            value={fmt(failedWfRuns)}
            tone={failedWfRuns > 0 ? 'red' : undefined}
          />
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-muted-fg mb-3 font-mono text-[10px] uppercase tracking-wider">
          Cerebro (estrategia)
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          <Metric label="Briefs" value={fmt(briefs.length)} sub="últimos 7" />
          <Metric
            label="Confianza promedio"
            value={briefAvgConf != null ? `${briefAvgConf}%` : '—'}
            tone={
              briefAvgConf == null
                ? undefined
                : briefAvgConf >= 70
                  ? 'emerald'
                  : briefAvgConf >= 40
                    ? 'amber'
                    : 'red'
            }
          />
          <Metric
            label="Último brief"
            value={
              briefs[0]
                ? new Date(briefs[0].created_at).toLocaleString('es-AR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '—'
            }
            sub={briefs[0]?.brand_id ?? ''}
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div>
          <h2 className="text-muted-fg mb-3 font-mono text-[10px] uppercase tracking-wider">
            Actividad research reciente
          </h2>
          <RecentRunsTable runs={runs.slice(0, 8)} />
        </div>
        <div>
          <h2 className="text-muted-fg mb-3 font-mono text-[10px] uppercase tracking-wider">
            Alertas recientes
          </h2>
          {alerts.length === 0 ? (
            <div className="border-border flex min-h-[120px] items-center justify-center rounded-[8px] border">
              <p className="text-muted-fg font-mono text-xs">Sin alertas recientes.</p>
            </div>
          ) : (
            <div className="border-border bg-surface divide-border divide-y overflow-hidden rounded-[8px] border">
              {alerts.map((a) => (
                <div key={a.id} className="flex items-start justify-between gap-3 px-3 py-2">
                  <div>
                    <div className="text-fg text-xs font-semibold">
                      {a.rule_name ?? `rule #${a.rule_id}`}
                    </div>
                    <div className="text-muted-fg font-mono text-[10px]">
                      {a.trigger}
                      {a.brand_id ? ` · ${a.brand_id}` : ''}
                    </div>
                  </div>
                  <span className="text-muted-fg font-mono text-[10px]">
                    {new Date(a.fired_at).toLocaleString('es-AR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

type MetricTone = 'emerald' | 'amber' | 'red' | 'sky';

function Metric({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string | undefined;
  tone?: MetricTone | undefined;
}) {
  const toneClass = tone
    ? {
        emerald: 'text-emerald-400',
        amber: 'text-amber-400',
        red: 'text-red-400',
        sky: 'text-sky-400',
      }[tone]
    : 'text-fg';
  return (
    <div className="border-border bg-surface rounded-[8px] border p-4">
      <div className="text-muted-fg font-mono text-[10px] uppercase tracking-wider">{label}</div>
      <div className={`mt-1 font-mono text-xl font-bold ${toneClass}`}>{value}</div>
      {sub && <div className="text-muted-fg mt-0.5 font-mono text-[10px]">{sub}</div>}
    </div>
  );
}

function RecentRunsTable({ runs }: { runs: ResearchRunRow[] }) {
  if (runs.length === 0) {
    return (
      <div className="border-border flex min-h-[120px] items-center justify-center rounded-[8px] border">
        <p className="text-muted-fg font-mono text-xs">Sin runs recientes.</p>
      </div>
    );
  }
  const statusTone: Record<string, string> = {
    done: 'text-emerald-400',
    error: 'text-red-400',
    running: 'text-sky-400',
    queued: 'text-amber-400',
  };
  return (
    <div className="border-border bg-surface divide-border divide-y overflow-hidden rounded-[8px] border">
      {runs.map((r) => (
        <div key={r.run_id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
          <div className="min-w-0 flex-1">
            <div className="text-fg font-mono text-[11px]">{r.brand_id ?? '(sin brand)'}</div>
            <div className="text-muted-fg font-mono text-[10px]">
              {r.depth} ·{' '}
              {new Date(r.created_at).toLocaleString('es-AR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>
          <span className={`font-mono text-[10px] ${statusTone[r.status] ?? 'text-muted-fg'}`}>
            {r.status}
          </span>
        </div>
      ))}
    </div>
  );
}

function fmt(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString('es-AR');
}

function avgDuration(runs: ResearchRunRow[]): number | null {
  const withDuration = runs.filter((r) => r.duration_ms != null && r.status === 'done');
  if (withDuration.length === 0) return null;
  const total = withDuration.reduce((s, r) => s + (r.duration_ms ?? 0), 0);
  return Math.round(total / withDuration.length / 1000);
}
