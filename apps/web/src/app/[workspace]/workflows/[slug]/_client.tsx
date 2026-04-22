'use client';

import { useState, useTransition } from 'react';

import { enqueueRunAction } from '@/actions/workflows';

import type { Workflow, WorkflowRun } from '@/lib/workflows';

const STATUS_COLOR: Record<WorkflowRun['status'], string> = {
  pending: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  running: 'border-sky-500/30 bg-sky-500/10 text-sky-400',
  succeeded: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  failed: 'border-red-500/30 bg-red-500/10 text-red-400',
  cancelled: 'border-border bg-surface-elevated text-muted-fg',
};

export function WorkflowDetailClient({
  workspace,
  workflow,
  initialRuns,
}: {
  workspace: string;
  workflow: Workflow;
  initialRuns: WorkflowRun[];
}) {
  const [runs, setRuns] = useState<WorkflowRun[]>(initialRuns);
  const [input, setInput] = useState('{}');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onTrigger() {
    setError(null);
    const fd = new FormData();
    fd.set('workspace', workspace);
    fd.set('workflow_slug', workflow.slug);
    fd.set('input', input);
    startTransition(async () => {
      const res = await enqueueRunAction(fd);
      if (!res.ok) {
        setError(res.error ?? 'error');
        return;
      }
      const created = res.data;
      if (created) setRuns((prev) => [created, ...prev]);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-fg text-base font-semibold">Runs</h2>
          <span className="text-muted-fg font-mono text-xs">{runs.length}</span>
        </div>

        {runs.length === 0 ? (
          <div className="border-border flex min-h-[160px] items-center justify-center rounded-[8px] border">
            <p className="text-muted-fg font-mono text-xs">
              Sin runs todavía. Dispará uno desde la derecha.
            </p>
          </div>
        ) : (
          <div className="border-border bg-surface overflow-hidden rounded-[8px] border">
            <table className="w-full text-sm">
              <thead className="border-border bg-surface-elevated border-b">
                <tr className="text-muted-fg font-mono text-[10px] uppercase tracking-wider">
                  <th className="px-3 py-2 text-left">Run ID</th>
                  <th className="px-3 py-2 text-left">Estado</th>
                  <th className="px-3 py-2 text-left">Creado</th>
                  <th className="px-3 py-2 text-left">Duración</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => {
                  const duration =
                    r.started_at && r.finished_at
                      ? `${Math.round(
                          (new Date(r.finished_at).getTime() - new Date(r.started_at).getTime()) /
                            1000,
                        )}s`
                      : r.started_at
                        ? 'en curso'
                        : '-';
                  return (
                    <tr key={r.id} className="border-border border-b last:border-0">
                      <td className="px-3 py-2 font-mono text-[10px]">
                        <a
                          href={`/${workspace}/workflows/${workflow.slug}/runs/${r.id}`}
                          className="text-accent hover:underline"
                        >
                          {r.id.slice(0, 8)}
                        </a>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-[4px] border px-2 py-0.5 font-mono text-[10px] ${STATUS_COLOR[r.status]}`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-[10px] text-[#888]">
                        {new Date(r.created_at).toLocaleString('es-AR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-3 py-2 font-mono text-[10px] text-[#888]">{duration}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <aside className="space-y-4">
        <div className="border-border bg-surface rounded-[8px] border p-4">
          <h3 className="text-fg mb-2 text-sm font-semibold">Disparar run</h3>
          <p className="text-muted-fg mb-3 font-mono text-[10px]">
            Persiste como pending. El executor lo procesa async (Sprint 1.3).
          </p>
          <label className="text-muted-fg mb-1 block font-mono text-[10px] uppercase tracking-wider">
            Input (JSON)
          </label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={6}
            className="border-border bg-surface-elevated text-fg mb-3 w-full rounded-[6px] border px-3 py-2 font-mono text-xs"
          />
          <button
            type="button"
            onClick={onTrigger}
            disabled={isPending || !workflow.enabled}
            className="bg-accent hover:bg-accent/90 text-accent-fg w-full rounded-[6px] px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {isPending ? 'Enviando…' : 'Disparar run'}
          </button>
          {!workflow.enabled && (
            <p className="text-muted-fg mt-2 font-mono text-[10px]">
              Workflow deshabilitado. Reactivalo desde la lista.
            </p>
          )}
          {error && <p className="mt-2 font-mono text-xs text-red-400">Error: {error}</p>}
        </div>

        <div className="border-border bg-surface rounded-[8px] border p-4">
          <h3 className="text-muted-fg mb-2 font-mono text-[10px] uppercase tracking-wider">
            Config
          </h3>
          <pre className="text-muted-fg max-h-[240px] overflow-auto font-mono text-[10px] leading-tight">
            {JSON.stringify(workflow.config, null, 2)}
          </pre>
        </div>
      </aside>
    </div>
  );
}
