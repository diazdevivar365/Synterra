import { and, eq } from 'drizzle-orm';
import { Swords } from 'lucide-react';
import { redirect } from 'next/navigation';

import { workspaceMembers, workspaces } from '@synterra/db';

import { getBrandsForWorkspace } from '@/lib/brands';
import { type ClashResult, runClash } from '@/lib/clash';
import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

const AGREEMENT_COLOR: Record<ClashResult['agreement'], string> = {
  high: 'text-green-400',
  partial: 'text-yellow-400',
  low: 'text-red-400',
};

const EXPLOIT_COLOR: Record<string, string> = {
  high: 'text-red-400',
  medium: 'text-yellow-400',
  low: 'text-green-400',
};

export default async function ClashPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ brand_a?: string; brand_b?: string }>;
}) {
  const { workspace: slug } = await params;
  const { brand_a, brand_b } = await searchParams;

  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/workspaces');

  const ws = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaces.slug, slug), eq(workspaceMembers.userId, ctx.userId)))
    .then((r) => r[0] ?? null);
  if (!ws) redirect('/workspaces');

  const { brands } = await getBrandsForWorkspace(ws.id);

  let result: ClashResult | null = null;
  if (brand_a && brand_b && brand_a !== brand_b) {
    result = await runClash(ws.id, brand_a, brand_b);
  }

  const nameOf = (id: string) => brands.find((b) => b.id === id)?.name ?? id;

  return (
    <div className="space-y-8 p-6">
      <div className="flex items-center gap-3">
        <Swords className="text-accent h-6 w-6" />
        <div>
          <h1 className="text-fg text-xl font-semibold">Brand Clash Simulator</h1>
          <p className="text-muted-fg text-sm">LLM ensemble — Gemini + Claude in parallel</p>
        </div>
      </div>

      {/* GET form — appends search params on submit */}
      <form
        method="GET"
        className="bg-surface-elevated border-border space-y-4 rounded-lg border p-5"
      >
        <h2 className="text-fg text-sm font-semibold">Configure Clash</h2>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-muted-fg text-xs">Attacker (your brand)</label>
            <select
              name="brand_a"
              defaultValue={brand_a ?? ''}
              className="bg-surface border-border text-fg min-w-[180px] rounded border px-3 py-1.5 text-sm"
            >
              <option value="">Select brand…</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="text-muted-fg text-sm font-bold">vs.</div>

          <div className="flex flex-col gap-1">
            <label className="text-muted-fg text-xs">Defender (competitor)</label>
            <select
              name="brand_b"
              defaultValue={brand_b ?? ''}
              className="bg-surface border-border text-fg min-w-[180px] rounded border px-3 py-1.5 text-sm"
            >
              <option value="">Select brand…</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="bg-accent hover:bg-accent/90 rounded px-4 py-1.5 text-sm font-medium text-white"
          >
            Run Clash
          </button>
        </div>
        <p className="text-muted-fg text-xs">Analysis takes 10–30 seconds via LLM ensemble.</p>
      </form>

      {brand_a && brand_b && brand_a === brand_b && (
        <p className="text-danger text-sm">Select two different brands.</p>
      )}

      {result && (
        <div className="space-y-6">
          {/* Header strip */}
          <div className="bg-surface-elevated border-border rounded-lg border p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="text-fg flex items-center gap-3 font-semibold">
                <span>{nameOf(result.attacker)}</span>
                <span className="text-muted-fg">⚔</span>
                <span>{nameOf(result.defender)}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted-fg text-xs">Model agreement:</span>
                <span className={`font-semibold capitalize ${AGREEMENT_COLOR[result.agreement]}`}>
                  {result.agreement}
                </span>
                <span className="text-muted-fg text-xs">
                  ({Math.round(result.overlap_ratio * 100)}% overlap)
                </span>
              </div>
            </div>
          </div>

          {/* Synthesis */}
          {result.synthesis && (
            <div className="bg-surface-elevated border-border space-y-4 rounded-lg border p-5">
              <h2 className="text-fg text-sm font-semibold">Executive Synthesis</h2>
              <p className="text-fg text-sm">{result.synthesis.final_verdict}</p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="text-muted-fg mb-2 text-xs font-semibold uppercase">
                    Consensus Moves
                  </h3>
                  <ul className="space-y-1">
                    {result.synthesis.consensus_moves.map((m, i) => (
                      <li key={i} className="text-fg flex gap-2 text-xs">
                        <span className="text-accent">✓</span> {m}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-muted-fg mb-2 text-xs font-semibold uppercase">
                    Disputed Areas
                  </h3>
                  <ul className="space-y-1">
                    {result.synthesis.disputed_areas.map((d, i) => (
                      <li key={i} className="text-fg flex gap-2 text-xs">
                        <span className="text-yellow-400">?</span> {d}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="bg-accent/10 border-accent/30 rounded border p-3">
                <span className="text-muted-fg mr-2 text-xs font-semibold uppercase">
                  Priority Action:
                </span>
                <span className="text-fg text-sm">{result.synthesis.priority_action}</span>
              </div>
            </div>
          )}

          {/* Model outputs */}
          {(['gemini', 'claude'] as const).map((model) => {
            const out = result[model];
            return (
              <div
                key={model}
                className="bg-surface-elevated border-border space-y-4 rounded-lg border p-5"
              >
                <h2 className="text-fg text-sm font-semibold capitalize">{model} Analysis</h2>

                {out.killer_insight && (
                  <div className="bg-surface border-border rounded border p-3">
                    <span className="text-accent mr-2 text-xs font-semibold">Killer Insight:</span>
                    <span className="text-fg text-sm italic">{out.killer_insight}</span>
                  </div>
                )}

                {out.vulnerabilities && out.vulnerabilities.length > 0 && (
                  <div>
                    <h3 className="text-muted-fg mb-2 text-xs font-semibold uppercase">
                      Defender Vulnerabilities
                    </h3>
                    <div className="space-y-2">
                      {out.vulnerabilities.map((v, i) => (
                        <div key={i} className="bg-surface border-border rounded border px-3 py-2">
                          <div className="mb-1 flex items-center justify-between">
                            <span className="text-fg text-xs font-medium">{v.area}</span>
                            <span
                              className={`text-[10px] font-semibold uppercase ${EXPLOIT_COLOR[v.exploitability] ?? ''}`}
                            >
                              {v.exploitability}
                            </span>
                          </div>
                          <p className="text-muted-fg text-xs">{v.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {out.offensive_moves && out.offensive_moves.length > 0 && (
                  <div>
                    <h3 className="text-muted-fg mb-2 text-xs font-semibold uppercase">
                      Offensive Moves
                    </h3>
                    <div className="space-y-2">
                      {out.offensive_moves.map((m, i) => (
                        <div
                          key={i}
                          className="bg-surface border-border space-y-1 rounded border px-3 py-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-fg text-xs font-medium">{m.headline}</span>
                            <span className="text-muted-fg shrink-0 text-[10px]">
                              {m.time_to_execute}
                            </span>
                          </div>
                          <p className="text-muted-fg text-xs">{m.rationale}</p>
                          {m.risk && <p className="text-xs text-yellow-400/80">Risk: {m.risk}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {out.error && <p className="text-danger text-xs">Model error: {out.error}</p>}
              </div>
            );
          })}
        </div>
      )}

      {!result && brand_a && brand_b && brand_a !== brand_b && (
        <p className="text-muted-fg text-sm">
          No results — Aquila may still be processing. Try again.
        </p>
      )}
    </div>
  );
}
