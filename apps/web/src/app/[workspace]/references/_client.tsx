'use client';

import { useState, useTransition } from 'react';

import {
  createReferenceAction,
  deleteReferenceAction,
  touchReferenceAction,
} from '@/actions/references';
import { REFERENCE_KINDS, type Reference, type ReferenceKind } from '@/lib/references';

const KIND_EMOJI: Record<ReferenceKind, string> = {
  image: '◱',
  doc: '▤',
  url: '→',
  note: '✎',
  video: '▸',
};

const KIND_TONE: Record<ReferenceKind, string> = {
  image: 'border-purple-500/30 bg-purple-500/5 text-purple-400',
  doc: 'border-amber-500/30 bg-amber-500/5 text-amber-400',
  url: 'border-sky-500/30 bg-sky-500/5 text-sky-400',
  note: 'border-border bg-surface-elevated text-muted-fg',
  video: 'border-pink-500/30 bg-pink-500/5 text-pink-400',
};

export function ReferencesClient({
  workspace,
  initial,
  mostUsed,
}: {
  workspace: string;
  initial: Reference[];
  mostUsed: Reference[];
}) {
  const [refs, setRefs] = useState<Reference[]>(initial);
  const [showForm, setShowForm] = useState(initial.length === 0);
  const [kind, setKind] = useState<ReferenceKind>('url');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onCreate(fd: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createReferenceAction(fd);
      if (!res.ok) {
        setError(res.error ?? 'error');
        return;
      }
      const created = res.reference;
      if (created) {
        setRefs((prev) => [created, ...prev]);
        setShowForm(false);
        (document.getElementById('ref-form') as HTMLFormElement | null)?.reset();
      }
    });
  }

  function onDelete(id: string) {
    const fd = new FormData();
    fd.set('workspace', workspace);
    fd.set('reference_id', id);
    startTransition(async () => {
      await deleteReferenceAction(fd);
      setRefs((prev) => prev.filter((r) => r.id !== id));
    });
  }

  function onTouch(id: string) {
    const fd = new FormData();
    fd.set('workspace', workspace);
    fd.set('reference_id', id);
    startTransition(async () => {
      const res = await touchReferenceAction(fd);
      if (res.ok && res.reference) {
        const updated = res.reference;
        setRefs((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      }
    });
  }

  return (
    <div className="space-y-8">
      {mostUsed.length > 0 && (
        <section>
          <h2 className="text-muted-fg mb-3 font-mono text-[10px] uppercase tracking-wider">
            Más usadas
          </h2>
          <div className="flex flex-wrap gap-2">
            {mostUsed.map((r) => (
              <a
                key={r.id}
                href={r.url ?? '#'}
                target={r.url ? '_blank' : undefined}
                rel="noreferrer"
                className="border-accent/30 bg-accent/5 text-accent hover:bg-accent/10 inline-flex items-center gap-2 rounded-[4px] border px-2 py-1 text-xs transition-colors"
              >
                <span className="font-mono text-[10px]">×{r.usage_count}</span>
                <span className="max-w-[240px] truncate">{r.title}</span>
              </a>
            ))}
          </div>
        </section>
      )}

      <div className="flex items-center justify-between">
        <span className="text-muted-fg font-mono text-xs">
          {refs.length} {refs.length === 1 ? 'referencia' : 'referencias'}
        </span>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="bg-accent hover:bg-accent/90 text-accent-fg rounded-[6px] px-3 py-1.5 text-xs font-semibold transition-colors"
        >
          {showForm ? 'Cerrar' : 'Nueva referencia'}
        </button>
      </div>

      {showForm && (
        <form
          id="ref-form"
          action={onCreate}
          className="border-border bg-surface space-y-4 rounded-[8px] border p-6"
        >
          <input type="hidden" name="workspace" value={workspace} />

          <div className="grid gap-4 md:grid-cols-[220px_1fr]">
            <div className="space-y-1.5">
              <label className="text-muted-fg font-mono text-[10px] uppercase tracking-wider">
                Tipo
              </label>
              <select
                name="kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as ReferenceKind)}
                className="border-border bg-surface-elevated text-fg w-full rounded-[6px] border px-3 py-2 text-sm"
              >
                {REFERENCE_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
              <p className="text-muted-fg font-mono text-[10px]">
                {REFERENCE_KINDS.find((k) => k.value === kind)?.hint ?? ''}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-muted-fg font-mono text-[10px] uppercase tracking-wider">
                Título
              </label>
              <input
                name="title"
                required
                maxLength={300}
                placeholder="Ej: Packaging Aesop 2024"
                className="border-border bg-surface-elevated text-fg w-full rounded-[6px] border px-3 py-2 text-sm"
              />
            </div>
          </div>

          {kind !== 'note' && (
            <div className="space-y-1.5">
              <label className="text-muted-fg font-mono text-[10px] uppercase tracking-wider">
                URL
              </label>
              <input
                name="url"
                type="url"
                maxLength={2000}
                placeholder="https://..."
                className="border-border bg-surface-elevated text-fg w-full rounded-[6px] border px-3 py-2 text-sm"
              />
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
            <div className="space-y-1.5">
              <label className="text-muted-fg font-mono text-[10px] uppercase tracking-wider">
                Marca (opcional)
              </label>
              <input
                name="brand_id"
                maxLength={200}
                placeholder="brand_id"
                className="border-border bg-surface-elevated text-fg w-full rounded-[6px] border px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-muted-fg font-mono text-[10px] uppercase tracking-wider">
                Tags (coma)
              </label>
              <input
                name="tags"
                placeholder="minimalista, terracota, editorial"
                className="border-border bg-surface-elevated text-fg w-full rounded-[6px] border px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-muted-fg font-mono text-[10px] uppercase tracking-wider">
              Notas
            </label>
            <textarea
              name="notes"
              rows={3}
              maxLength={5000}
              placeholder="Por qué sirve · qué transmite · cuándo aplicar"
              className="border-border bg-surface-elevated text-fg w-full rounded-[6px] border px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-muted-fg inline-flex items-center gap-2 text-xs">
              <input type="checkbox" name="shared" className="accent-accent" />
              Compartido con el workspace
            </label>
            <button
              type="submit"
              disabled={isPending}
              className="bg-accent hover:bg-accent/90 text-accent-fg rounded-[6px] px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {isPending ? 'Guardando…' : 'Agregar'}
            </button>
          </div>

          {error && <p className="font-mono text-xs text-red-400">Error: {error}</p>}
        </form>
      )}

      {refs.length === 0 ? (
        !showForm && (
          <div className="border-border flex min-h-[180px] items-center justify-center rounded-[8px] border">
            <p className="text-muted-fg text-sm">
              Sin referencias. Agregá la primera — el tagger las describe para vos.
            </p>
          </div>
        )
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {refs.map((r) => (
            <RefCard
              key={r.id}
              ref_={r}
              onDelete={() => onDelete(r.id)}
              onTouch={() => onTouch(r.id)}
              disabled={isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RefCard({
  ref_,
  onDelete,
  onTouch,
  disabled,
}: {
  ref_: Reference;
  onDelete: () => void;
  onTouch: () => void;
  disabled: boolean;
}) {
  const tone = KIND_TONE[ref_.kind];
  return (
    <div className="border-border bg-surface flex flex-col gap-2 rounded-[8px] border p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <span
            className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] border font-mono text-[11px] ${tone}`}
          >
            {KIND_EMOJI[ref_.kind]}
          </span>
          <div>
            <div className="text-fg text-sm font-semibold leading-tight">{ref_.title}</div>
            <div className="text-muted-fg font-mono text-[10px]">
              {ref_.kind}
              {ref_.brand_id ? ` · ${ref_.brand_id}` : ''}
              {ref_.shared ? ' · compartido' : ''}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onDelete}
          disabled={disabled}
          className="text-muted-fg font-mono text-[10px] transition-colors hover:text-red-400 disabled:opacity-40"
        >
          eliminar
        </button>
      </div>

      {ref_.url && (
        <a
          href={ref_.url}
          target="_blank"
          rel="noreferrer"
          onClick={() => onTouch()}
          className="text-accent truncate font-mono text-[10px] hover:underline"
        >
          {ref_.url}
        </a>
      )}

      {ref_.notes && <p className="text-fg line-clamp-3 text-xs leading-relaxed">{ref_.notes}</p>}

      {ref_.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {ref_.tags.map((t) => (
            <span
              key={t}
              className="bg-surface-elevated text-muted-fg rounded-[4px] px-1.5 py-0.5 font-mono text-[9px]"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="border-border text-muted-fg flex items-center justify-between gap-2 border-t pt-2 font-mono text-[10px]">
        <span>
          usado ×{ref_.usage_count}
          {ref_.last_used_at
            ? ` · última ${new Date(ref_.last_used_at).toLocaleDateString('es-AR')}`
            : ''}
        </span>
        {!ref_.extracted_flags && <span>tagger…</span>}
      </div>

      {ref_.extracted_flags && Array.isArray(ref_.extracted_flags['keywords']) && (
        <div className="border-border border-t pt-2">
          <div className="flex flex-wrap gap-1">
            {(ref_.extracted_flags['keywords'] as unknown[]).slice(0, 6).map((k, i) => (
              <span
                key={i}
                className="border-accent/30 bg-accent/5 text-accent rounded-[4px] border px-1.5 py-0.5 font-mono text-[9px]"
              >
                {String(k)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
