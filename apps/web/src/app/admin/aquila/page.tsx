import { sql } from 'drizzle-orm';

import { aquilaFetch } from '@/lib/aquila-server';
import { db } from '@/lib/db';

interface WorkspaceRow {
  id: string;
  slug: string;
  name: string;
}

interface UsageWire {
  org_id: string;
  counters: {
    brands_total: number;
    research_runs: { total: number; succeeded: number; failed: number };
    briefings_sent?: number;
    battlecards_generated?: number;
    alerts_fired?: number;
  };
  llm: { cost_usd_est: number; source: 'usage_events' | 'pending' };
  period: string;
}

interface WorkflowListWire {
  items: { id: string; slug: string; enabled: boolean }[];
}
interface RunListWire {
  items: { id: string; status: string; created_at: string }[];
}
interface BriefsWire {
  items: { id: string; confidence: number | null }[];
}

async function listWorkspaces(): Promise<WorkspaceRow[]> {
  const rows = await db.execute(
    sql`SELECT id::text, slug, name
        FROM workspaces
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 50`,
  );
  return rows as unknown as WorkspaceRow[];
}

interface Snapshot {
  ws: WorkspaceRow;
  connected: boolean;
  usage: UsageWire | null;
  workflows: number;
  runsPending: number;
  runsFailed: number;
  briefs: number;
  briefAvgConfidence: number | null;
}

async function snapshotFor(ws: WorkspaceRow): Promise<Snapshot> {
  const [usage, workflows, briefs] = await Promise.all([
    aquilaFetch<UsageWire>(ws.id, `/orgs/${ws.slug}/usage?period=current_month`),
    aquilaFetch<WorkflowListWire>(ws.id, '/workflows?enabled_only=false'),
    aquilaFetch<BriefsWire>(ws.id, '/brain/briefs?limit=30'),
  ]);

  // Runs aggregation: up to first 5 workflows scanned in parallel.
  let runsPending = 0;
  let runsFailed = 0;
  const wfs = workflows?.items ?? [];
  const runLists = await Promise.all(
    wfs
      .slice(0, 5)
      .map((w) => aquilaFetch<RunListWire>(ws.id, `/workflows/${w.slug}/runs?limit=50`)),
  );
  for (const rl of runLists) {
    for (const r of rl?.items ?? []) {
      if (r.status === 'pending') runsPending += 1;
      if (r.status === 'failed') runsFailed += 1;
    }
  }

  const briefItems = briefs?.items ?? [];
  const confValues = briefItems
    .map((b) => b.confidence)
    .filter((v): v is number => typeof v === 'number');
  const briefAvgConfidence =
    confValues.length > 0
      ? Math.round((confValues.reduce((a, b) => a + b, 0) / confValues.length) * 100)
      : null;

  return {
    ws,
    connected: usage !== null,
    usage,
    workflows: wfs.length,
    runsPending,
    runsFailed,
    briefs: briefItems.length,
    briefAvgConfidence,
  };
}

export const dynamic = 'force-dynamic';

export default async function AdminAquilaPage() {
  const workspaces = await listWorkspaces();
  const snaps = await Promise.all(workspaces.map(snapshotFor));

  const connected = snaps.filter((s) => s.connected);
  const totals = connected.reduce(
    (acc, s) => ({
      brands: acc.brands + (s.usage?.counters.brands_total ?? 0),
      runs: acc.runs + (s.usage?.counters.research_runs.total ?? 0),
      runsFailed7d: acc.runsFailed7d + (s.usage?.counters.research_runs.failed ?? 0),
      briefs: acc.briefs + s.briefs,
      workflows: acc.workflows + s.workflows,
      runsPending: acc.runsPending + s.runsPending,
      runsFailedWf: acc.runsFailedWf + s.runsFailed,
      llm: acc.llm + (s.usage?.llm.cost_usd_est ?? 0),
    }),
    {
      brands: 0,
      runs: 0,
      runsFailed7d: 0,
      briefs: 0,
      workflows: 0,
      runsPending: 0,
      runsFailedWf: 0,
      llm: 0,
    },
  );

  const topByCost = [...snaps]
    .filter((s) => s.usage)
    .sort((a, b) => (b.usage?.llm.cost_usd_est ?? 0) - (a.usage?.llm.cost_usd_est ?? 0))
    .slice(0, 5);

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-8">
      <div className="mb-8">
        <h1 className="text-fg text-2xl font-bold">Aquila health</h1>
        <p className="text-muted-fg font-mono text-xs">
          Vista cross-tenant. {connected.length}/{snaps.length} workspaces conectados. Métricas por
          tenant + totales. Para infra-level ver Grafana (aquila.lan:3000).
        </p>
      </div>

      <section className="mb-8">
        <h2 className="text-muted-fg mb-3 font-mono text-[10px] uppercase tracking-wider">
          Totales (current month)
        </h2>
        <div className="grid gap-3 md:grid-cols-4">
          <Metric label="Marcas" value={totals.brands.toLocaleString('es-AR')} />
          <Metric label="Research runs" value={totals.runs.toLocaleString('es-AR')} />
          <Metric
            label="Failed runs"
            value={totals.runsFailed7d.toLocaleString('es-AR')}
            tone={totals.runsFailed7d > 0 ? 'red' : undefined}
          />
          <Metric
            label="LLM cost (est)"
            value={`$${totals.llm.toFixed(2)}`}
            tone={totals.llm > 50 ? 'amber' : undefined}
          />
          <Metric label="Workflows defs" value={totals.workflows.toLocaleString('es-AR')} />
          <Metric
            label="Workflow pending"
            value={totals.runsPending.toLocaleString('es-AR')}
            tone={totals.runsPending > 0 ? 'amber' : undefined}
          />
          <Metric
            label="Workflow failed"
            value={totals.runsFailedWf.toLocaleString('es-AR')}
            tone={totals.runsFailedWf > 0 ? 'red' : undefined}
          />
          <Metric label="Cerebro briefs" value={totals.briefs.toLocaleString('es-AR')} />
        </div>
      </section>

      {topByCost.length > 0 && (
        <section className="mb-8">
          <h2 className="text-muted-fg mb-3 font-mono text-[10px] uppercase tracking-wider">
            Top 5 LLM cost
          </h2>
          <div className="border-border bg-surface divide-border divide-y rounded-[8px] border">
            {topByCost.map((s) => (
              <div key={s.ws.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-fg text-sm font-semibold">{s.ws.name}</div>
                  <div className="text-muted-fg font-mono text-[10px]">{s.ws.slug}</div>
                </div>
                <div className="text-right">
                  <div className="text-fg font-mono text-sm">
                    ${(s.usage?.llm.cost_usd_est ?? 0).toFixed(2)}
                  </div>
                  <div className="text-muted-fg font-mono text-[10px]">
                    {s.usage?.llm.source ?? '—'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-muted-fg mb-3 font-mono text-[10px] uppercase tracking-wider">
          Per-workspace snapshot
        </h2>
        <div className="border-border bg-surface overflow-hidden rounded-[8px] border">
          <table className="w-full text-sm">
            <thead className="border-border bg-surface-elevated border-b">
              <tr className="text-muted-fg font-mono text-[10px] uppercase tracking-wider">
                <th className="px-3 py-2 text-left">Workspace</th>
                <th className="px-3 py-2 text-right">Conectado</th>
                <th className="px-3 py-2 text-right">Marcas</th>
                <th className="px-3 py-2 text-right">Runs</th>
                <th className="px-3 py-2 text-right">Failed</th>
                <th className="px-3 py-2 text-right">Workflows</th>
                <th className="px-3 py-2 text-right">WF pending</th>
                <th className="px-3 py-2 text-right">Briefs</th>
                <th className="px-3 py-2 text-right">Conf avg</th>
                <th className="px-3 py-2 text-right">LLM $</th>
              </tr>
            </thead>
            <tbody>
              {snaps.map((s) => (
                <tr key={s.ws.id} className="border-border border-b last:border-0">
                  <td className="px-3 py-2">
                    <div className="text-fg font-semibold">{s.ws.name}</div>
                    <div className="text-muted-fg font-mono text-[10px]">{s.ws.slug}</div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-[11px]">
                    {s.connected ? (
                      <span className="text-emerald-400">✓</span>
                    ) : (
                      <span className="text-red-400">✗</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-[11px]">
                    {s.usage?.counters.brands_total ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-[11px]">
                    {s.usage?.counters.research_runs.total ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-[11px]">
                    <span
                      className={
                        (s.usage?.counters.research_runs.failed ?? 0) > 0 ? 'text-red-400' : ''
                      }
                    >
                      {s.usage?.counters.research_runs.failed ?? '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-[11px]">{s.workflows}</td>
                  <td className="px-3 py-2 text-right font-mono text-[11px]">
                    <span className={s.runsPending > 0 ? 'text-amber-400' : ''}>
                      {s.runsPending}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-[11px]">{s.briefs}</td>
                  <td className="px-3 py-2 text-right font-mono text-[11px]">
                    {s.briefAvgConfidence != null ? `${s.briefAvgConfidence}%` : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-[11px]">
                    ${(s.usage?.llm.cost_usd_est ?? 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

type MetricTone = 'emerald' | 'amber' | 'red';

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: MetricTone | undefined;
}) {
  const toneClass = tone
    ? {
        emerald: 'text-emerald-400',
        amber: 'text-amber-400',
        red: 'text-red-400',
      }[tone]
    : 'text-fg';
  return (
    <div className="border-border bg-surface rounded-[8px] border p-4">
      <div className="text-muted-fg font-mono text-[10px] uppercase tracking-wider">{label}</div>
      <div className={`mt-1 font-mono text-xl font-bold ${toneClass}`}>{value}</div>
    </div>
  );
}
