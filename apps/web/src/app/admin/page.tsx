import { sql } from 'drizzle-orm';

import { aquilaFetch } from '@/lib/aquila-server';
import { db } from '@/lib/db';

import { impersonateWorkspaceAction } from './_actions';

interface WorkspaceRow {
  id: string;
  slug: string;
  name: string;
  created_at: Date;
}

interface AquilaUsageWire {
  org_id: string;
  counters: {
    brands_total: number;
    research_runs: { total: number; succeeded: number; failed: number };
  };
  llm: { cost_usd_est: number; source: 'usage_events' | 'pending' };
}

async function listWorkspaces(): Promise<WorkspaceRow[]> {
  const rows = await db.execute(
    sql`SELECT id::text, slug, name, created_at
        FROM workspaces
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 50`,
  );
  return rows as unknown as WorkspaceRow[];
}

async function getWorkspaceKpis(ws: WorkspaceRow) {
  const usage = await aquilaFetch<AquilaUsageWire>(ws.id, `/orgs/${ws.slug}/usage?period=last_7d`);
  return {
    workspace: ws,
    brands: usage?.counters.brands_total ?? null,
    runs7d: usage?.counters.research_runs.total ?? null,
    succeeded7d: usage?.counters.research_runs.succeeded ?? null,
    failed7d: usage?.counters.research_runs.failed ?? null,
    llm7d: usage?.llm.cost_usd_est ?? null,
    llmSource: usage?.llm.source ?? null,
    connected: usage !== null,
  };
}

export default async function AdminOverviewPage() {
  const workspaces = await listWorkspaces();
  const kpis = await Promise.all(workspaces.map(getWorkspaceKpis));

  const totals = kpis.reduce(
    (acc, k) => ({
      brands: acc.brands + (k.brands ?? 0),
      runs: acc.runs + (k.runs7d ?? 0),
      llm: acc.llm + (k.llm7d ?? 0),
    }),
    { brands: 0, runs: 0, llm: 0 },
  );

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Portfolio</h1>

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Workspaces" value={workspaces.length} />
        <StatCard label="Marcas totales" value={totals.brands} />
        <StatCard label="Runs (7d)" value={totals.runs} />
        <StatCard label="LLM spend (7d)" value={`$${totals.llm.toFixed(2)}`} />
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">Workspace</th>
              <th className="px-4 py-3 text-right">Marcas</th>
              <th className="px-4 py-3 text-right">Runs 7d</th>
              <th className="px-4 py-3 text-right">OK / Fail</th>
              <th className="px-4 py-3 text-right">LLM 7d</th>
              <th className="px-4 py-3 text-left">Aquila</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {kpis.map((k) => (
              <tr key={k.workspace.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <span className="font-medium text-gray-900">{k.workspace.name}</span>
                  <span className="ml-2 font-mono text-xs text-gray-400">{k.workspace.slug}</span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{fmt(k.brands)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{fmt(k.runs7d)}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  <span className="text-green-600">{fmt(k.succeeded7d)}</span>
                  <span className="mx-1 text-gray-300">/</span>
                  <span className="text-red-600">{fmt(k.failed7d)}</span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {k.llm7d !== null ? `$${k.llm7d.toFixed(2)}` : '—'}
                  {k.llmSource === 'pending' && (
                    <span className="ml-1 text-xs text-gray-400">(pend)</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {k.connected ? (
                    <span className="rounded bg-green-50 px-2 py-0.5 text-xs text-green-700">
                      linked
                    </span>
                  ) : (
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                      seed
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <form action={impersonateWorkspaceAction}>
                    <input type="hidden" name="workspaceId" value={k.workspace.id} />
                    <button
                      type="submit"
                      className="rounded bg-gray-900 px-2 py-1 text-xs text-white hover:bg-gray-700"
                    >
                      Entrar
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {kpis.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  Sin workspaces todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function fmt(n: number | null): string {
  return n === null ? '—' : n.toLocaleString('es-AR');
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
