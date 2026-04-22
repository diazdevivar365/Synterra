'use client';

import { useState, useTransition } from 'react';

import { createWorkflowAction, disableWorkflowAction } from '@/actions/workflows';
import { WORKFLOW_INTENTS, type Workflow } from '@/lib/workflows';

export function WorkflowsClient({
  workspace,
  initialWorkflows,
}: {
  workspace: string;
  initialWorkflows: Workflow[];
}) {
  const [workflows, setWorkflows] = useState<Workflow[]>(initialWorkflows);
  const [showForm, setShowForm] = useState(workflows.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onCreate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createWorkflowAction(formData);
      if (!res.ok) {
        setError(res.error ?? 'error');
        return;
      }
      const created = res.data;
      if (created) {
        setWorkflows((prev) => [created, ...prev]);
        setShowForm(false);
        (document.getElementById('wf-form') as HTMLFormElement | null)?.reset();
      }
    });
  }

  function onDisable(wfSlug: string) {
    const fd = new FormData();
    fd.set('workspace', workspace);
    fd.set('workflow_slug', wfSlug);
    startTransition(async () => {
      const res = await disableWorkflowAction(fd);
      if (!res.ok) {
        setError(res.error ?? 'error');
        return;
      }
      setWorkflows((prev) => prev.map((w) => (w.slug === wfSlug ? { ...w, enabled: false } : w)));
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <span className="text-muted-fg font-mono text-xs">
          {workflows.length} {workflows.length === 1 ? 'workflow' : 'workflows'}
        </span>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="bg-accent hover:bg-accent/90 text-accent-fg rounded-[6px] px-3 py-1.5 text-xs font-semibold transition-colors"
        >
          {showForm ? 'Cerrar' : 'Nuevo workflow'}
        </button>
      </div>

      {showForm && (
        <form
          id="wf-form"
          action={onCreate}
          className="border-border bg-surface space-y-4 rounded-[8px] border p-6"
        >
          <input type="hidden" name="workspace" value={workspace} />

          <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
            <div className="space-y-1.5">
              <label className="text-muted-fg font-mono text-[10px] uppercase tracking-wider">
                Slug
              </label>
              <input
                name="slug"
                required
                pattern="^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$"
                placeholder="brand-audit-weekly"
                className="border-border bg-surface-elevated text-fg w-full rounded-[6px] border px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-muted-fg font-mono text-[10px] uppercase tracking-wider">
                Intent
              </label>
              <select
                name="intent"
                defaultValue="audit"
                className="border-border bg-surface-elevated text-fg w-full rounded-[6px] border px-3 py-2 text-sm"
              >
                {WORKFLOW_INTENTS.map((i) => (
                  <option key={i.value} value={i.value}>
                    {i.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-muted-fg font-mono text-[10px] uppercase tracking-wider">
              Nombre
            </label>
            <input
              name="name"
              required
              maxLength={200}
              placeholder="Auditoría semanal de marcas premium"
              className="border-border bg-surface-elevated text-fg w-full rounded-[6px] border px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-muted-fg font-mono text-[10px] uppercase tracking-wider">
              Descripción (opcional)
            </label>
            <textarea
              name="description"
              rows={2}
              maxLength={2000}
              className="border-border bg-surface-elevated text-fg w-full rounded-[6px] border px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-muted-fg font-mono text-[10px]">
              Ejecución async via LangGraph · runs se persisten al crearlos (executor ships
              post-demo).
            </p>
            <button
              type="submit"
              disabled={isPending}
              className="bg-accent hover:bg-accent/90 text-accent-fg rounded-[6px] px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {isPending ? 'Creando…' : 'Crear workflow'}
            </button>
          </div>

          {error && <p className="font-mono text-xs text-red-400">Error: {error}</p>}
        </form>
      )}

      {workflows.length === 0 ? (
        !showForm && (
          <div className="border-border flex min-h-[200px] items-center justify-center rounded-[8px] border">
            <div className="text-center">
              <p className="text-fg text-sm">Todavía no hay workflows.</p>
              <p className="text-muted-fg mt-1 font-mono text-[10px]">
                Creá el primero con el botón de arriba.
              </p>
            </div>
          </div>
        )
      ) : (
        <div className="border-border bg-surface overflow-hidden rounded-[8px] border">
          <table className="w-full text-sm">
            <thead className="border-border bg-surface-elevated border-b">
              <tr className="text-muted-fg font-mono text-[10px] uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Workflow</th>
                <th className="px-4 py-3 text-left">Intent</th>
                <th className="px-4 py-3 text-left">Creado</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {workflows.map((w) => (
                <tr key={w.id} className="border-border border-b last:border-0">
                  <td className="px-4 py-3">
                    <a href={`/${workspace}/workflows/${w.slug}`} className="block">
                      <div className="text-fg font-semibold">{w.name}</div>
                      <div className="text-muted-fg font-mono text-[10px]">{w.slug}</div>
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <span className="bg-surface-elevated text-fg rounded-[4px] px-2 py-0.5 font-mono text-[10px]">
                      {w.intent}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[10px] text-[#888]">
                    {new Date(w.created_at).toLocaleDateString('es-AR')}
                  </td>
                  <td className="px-4 py-3">
                    {w.enabled ? (
                      <span className="rounded-[4px] border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-400">
                        activo
                      </span>
                    ) : (
                      <span className="border-border bg-surface-elevated text-muted-fg rounded-[4px] border px-2 py-0.5 font-mono text-[10px]">
                        deshabilitado
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {w.enabled && (
                      <button
                        type="button"
                        onClick={() => onDisable(w.slug)}
                        disabled={isPending}
                        className="text-muted-fg font-mono text-[10px] transition-colors hover:text-red-400 disabled:opacity-40"
                      >
                        deshabilitar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
