'use client';

import { useState, useTransition } from 'react';

import { consolidateDreamAction } from '@/actions/dreamer';

import type { BrandDream } from '@/lib/dreamer-server';

export function DreamClient({
  workspace,
  brandId,
  initialLatest,
  history,
}: {
  workspace: string;
  brandId: string;
  initialLatest: BrandDream | null;
  history: BrandDream[];
}) {
  const [latest, setLatest] = useState<BrandDream | null>(initialLatest);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onConsolidate() {
    setError(null);
    const fd = new FormData();
    fd.set('workspace', workspace);
    fd.set('brand_id', brandId);
    startTransition(async () => {
      const res = await consolidateDreamAction(fd);
      if (!res.ok) {
        setError(res.error ?? 'error');
        return;
      }
      // Refetch not needed — revalidatePath fires server. UI will pick up
      // next navigation. For this transition, optimistic: clear latest
      // so user sees fresh render.
      window.location.reload();
    });
  }

  const totalSources = latest?.sources_used
    ? Object.values(latest.sources_used).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          {latest ? (
            <p className="text-muted-fg font-mono text-xs">
              Última consolidación: {new Date(latest.created_at).toLocaleString('es-AR')} · por{' '}
              {latest.created_by ?? 'desconocido'} · {totalSources}{' '}
              {totalSources === 1 ? 'señal' : 'señales'}
            </p>
          ) : (
            <p className="text-muted-fg font-mono text-xs">Sin dream todavía.</p>
          )}
        </div>
        <button
          type="button"
          onClick={onConsolidate}
          disabled={isPending}
          className="bg-accent hover:bg-accent/90 text-accent-fg rounded-[6px] px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50"
        >
          {isPending ? 'Consolidando…' : latest ? 'Re-consolidar' : 'Consolidar'}
        </button>
      </div>

      {error && <p className="font-mono text-xs text-red-400">Error: {error}</p>}

      {latest && (
        <>
          <section className="border-accent/40 bg-accent/5 rounded-[8px] border p-6">
            <div className="text-muted-fg mb-2 font-mono text-[10px] uppercase tracking-wider">
              El sueño
            </div>
            <p className="text-fg text-base leading-relaxed">{latest.narrative}</p>
          </section>

          <section>
            <h2 className="text-muted-fg mb-3 font-mono text-[10px] uppercase tracking-wider">
              Señales usadas
            </h2>
            <div className="flex flex-wrap gap-2">
              {Object.entries(latest.sources_used)
                .filter(([, v]) => v > 0)
                .map(([k, v]) => (
                  <span
                    key={k}
                    className="border-border bg-surface-elevated text-fg inline-flex items-center gap-1.5 rounded-[4px] border px-2 py-1 text-xs"
                  >
                    <span className="font-mono text-[11px] font-semibold">{v}</span>
                    <span className="text-muted-fg font-mono text-[10px]">{k}</span>
                  </span>
                ))}
            </div>
          </section>

          <section>
            <h2 className="text-muted-fg mb-3 font-mono text-[10px] uppercase tracking-wider">
              El código (memoria estructurada)
            </h2>
            <pre className="border-border bg-surface max-h-[500px] overflow-auto rounded-[8px] border p-4 font-mono text-[11px] leading-relaxed">
              {JSON.stringify(latest.memory, null, 2)}
            </pre>
          </section>
        </>
      )}

      {history.length > 1 && (
        <section>
          <h2 className="text-muted-fg mb-3 font-mono text-[10px] uppercase tracking-wider">
            Historial ({history.length})
          </h2>
          <div className="border-border bg-surface divide-border divide-y overflow-hidden rounded-[8px] border">
            {history.map((d) => {
              const sources = Object.values(d.sources_used).reduce((a, b) => a + b, 0);
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setLatest(d)}
                  className="hover:bg-surface-elevated flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-fg line-clamp-2 text-xs">{d.narrative}</div>
                    <div className="text-muted-fg mt-1 font-mono text-[10px]">
                      {new Date(d.created_at).toLocaleString('es-AR')} · {d.created_by ?? '—'}
                    </div>
                  </div>
                  <span className="text-muted-fg font-mono text-[10px]">{sources} señales</span>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
