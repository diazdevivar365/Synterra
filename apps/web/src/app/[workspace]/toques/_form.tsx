'use client';

import { useEffect, useState, useTransition } from 'react';

import {
  createToqueAction,
  deleteToqueAction,
  reextractToqueAction,
  refetchToqueAction,
} from '@/actions/toques';
import { TOQUE_KINDS, type Toque, type ToqueKind } from '@/lib/toques';

const KIND_EMOJI: Record<ToqueKind, string> = {
  style: '◎',
  url: '→',
  book: '▤',
  author: '✒',
  quote: '❝',
  free_text: '✎',
};

const KIND_BADGE_STYLE: Record<ToqueKind, string> = {
  style: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  url: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
  book: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  author: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  quote: 'bg-pink-500/10 text-pink-400 border-pink-500/30',
  free_text: 'bg-surface-elevated text-muted-fg border-border',
};

const KIND_LABEL: Record<ToqueKind, string> = Object.fromEntries(
  TOQUE_KINDS.map((k) => [k.value, k.label]),
) as Record<ToqueKind, string>;

export function ToquesClient({
  workspace,
  initialToques,
}: {
  workspace: string;
  initialToques: Toque[];
}) {
  const [toques, setToques] = useState<Toque[]>(initialToques);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<ToqueKind>('style');
  const [isPending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createToqueAction(formData);
      if (!res.ok) {
        setError(res.error ?? 'error al crear');
        return;
      }
      const created = res.toque;
      if (created) {
        setToques((prev) => [created, ...prev]);
        (document.getElementById('toque-form') as HTMLFormElement | null)?.reset();
        setKind('style');
      }
    });
  }

  function onDelete(id: string) {
    const fd = new FormData();
    fd.set('workspace', workspace);
    fd.set('toque_id', id);
    startTransition(async () => {
      const res = await deleteToqueAction(fd);
      if (!res.ok) {
        setError(res.error ?? 'error al borrar');
        return;
      }
      setToques((prev) => prev.filter((t) => t.id !== id));
    });
  }

  function onReextract(id: string) {
    const fd = new FormData();
    fd.set('workspace', workspace);
    fd.set('toque_id', id);
    startTransition(async () => {
      const res = await reextractToqueAction(fd);
      if (!res.ok) setError(res.error ?? 'error al re-extraer');
      // Background task — auto-polling below picks up the updated row.
    });
  }

  // Auto-poll toques missing extracted_flags so the Art Director's output
  // appears live. Stops as soon as every toque has flags.
  useEffect(() => {
    const pending = toques.filter((t) => t.extracted_flags == null);
    if (pending.length === 0) return;

    const state: { cancelled: boolean } = { cancelled: false };
    let attempt = 0;
    const tick = async () => {
      if (state.cancelled) return;
      attempt += 1;
      // Exponential-ish backoff capped at 10 attempts (~2.5min total).
      if (attempt > 10) return;
      const updates = await Promise.all(
        pending.map(async (t) => {
          const fd = new FormData();
          fd.set('workspace', workspace);
          fd.set('toque_id', t.id);
          const res = await refetchToqueAction(fd);
          return res.ok ? res.toque : null;
        }),
      );
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (state.cancelled) return;
      setToques((prev) =>
        prev.map((t) => {
          const match = updates.find((u) => u?.id === t.id);
          return match ?? t;
        }),
      );
      setTimeout(
        () => {
          void tick();
        },
        Math.min(3000 + attempt * 2000, 20000),
      );
    };
    const timer = setTimeout(() => {
      void tick();
    }, 3000);
    return () => {
      state.cancelled = true;
      clearTimeout(timer);
    };
  }, [toques, workspace]);

  const currentHint = TOQUE_KINDS.find((k) => k.value === kind)?.hint ?? '';

  return (
    <div className="space-y-8">
      <form
        id="toque-form"
        action={onSubmit}
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
              onChange={(e) => setKind(e.target.value as ToqueKind)}
              className="border-border bg-surface-elevated text-fg w-full rounded-[6px] border px-3 py-2 text-sm"
            >
              {TOQUE_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
            <p className="text-muted-fg font-mono text-[10px]">{currentHint}</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-muted-fg font-mono text-[10px] uppercase tracking-wider">
              Nombre
            </label>
            <input
              name="label"
              required
              maxLength={200}
              placeholder="Ej: Voz Cortázar · Paleta Bauhaus · Blog de X"
              className="border-border bg-surface-elevated text-fg w-full rounded-[6px] border px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-muted-fg font-mono text-[10px] uppercase tracking-wider">
            {kind === 'url'
              ? 'URL'
              : kind === 'book'
                ? 'Título + autor'
                : kind === 'author'
                  ? 'Autor + referencia'
                  : kind === 'quote'
                    ? 'Cita'
                    : kind === 'style'
                      ? 'Descripción del estilo (opcional)'
                      : 'Contenido'}
          </label>
          <textarea
            name="content"
            rows={3}
            maxLength={5000}
            placeholder={contentPlaceholder(kind)}
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
            {isPending ? 'Guardando…' : 'Agregar toque'}
          </button>
        </div>

        {error && <p className="font-mono text-xs text-red-400">Error: {error}</p>}
      </form>

      {toques.length === 0 ? (
        <div className="border-border flex min-h-[200px] items-center justify-center rounded-[8px] border">
          <div className="text-center">
            <p className="text-fg text-sm">Todavía no hay toques en este workspace.</p>
            <p className="text-muted-fg mt-1 font-mono text-[10px]">
              Agregá uno arriba — el cerebro + agentes lo van a usar como overlay creativo.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {toques.map((t) => (
            <ToqueCard
              key={t.id}
              toque={t}
              onDelete={() => onDelete(t.id)}
              onReextract={() => onReextract(t.id)}
              disabled={isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ToqueCard({
  toque,
  onDelete,
  onReextract,
  disabled,
}: {
  toque: Toque;
  onDelete: () => void;
  onReextract: () => void;
  disabled: boolean;
}) {
  const kind = toque.kind;
  return (
    <div className="border-border bg-surface flex flex-col gap-3 rounded-[8px] border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <span
            className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] border font-mono text-[11px] ${KIND_BADGE_STYLE[kind]}`}
          >
            {KIND_EMOJI[kind]}
          </span>
          <div>
            <div className="text-fg text-sm font-semibold leading-tight">{toque.label}</div>
            <div className="text-muted-fg font-mono text-[10px]">
              {KIND_LABEL[kind]}
              {toque.shared ? ' · compartido' : ''}
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

      {toque.content && (
        <p className="text-fg line-clamp-3 text-xs leading-relaxed">{toque.content}</p>
      )}

      {!toque.extracted_flags ? (
        <div className="border-border flex items-center justify-between gap-2 border-t pt-2">
          <div className="text-muted-fg font-mono text-[10px]">Art Director extrayendo flags…</div>
          <button
            type="button"
            onClick={onReextract}
            disabled={disabled}
            className="text-muted-fg hover:text-fg font-mono text-[10px] transition-colors disabled:opacity-40"
          >
            re-extraer
          </button>
        </div>
      ) : (
        <div className="border-border border-t pt-2">
          <div className="mb-1 flex items-center justify-between gap-2">
            <div className="text-muted-fg font-mono text-[10px] uppercase tracking-wider">
              Flags
            </div>
            <button
              type="button"
              onClick={onReextract}
              disabled={disabled}
              className="text-muted-fg hover:text-fg font-mono text-[10px] transition-colors disabled:opacity-40"
            >
              re-extraer
            </button>
          </div>
          <pre className="text-muted-fg max-h-40 overflow-auto font-mono text-[10px] leading-tight">
            {JSON.stringify(toque.extracted_flags, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function contentPlaceholder(kind: ToqueKind): string {
  switch (kind) {
    case 'url':
      return 'https://ejemplo.com/post';
    case 'book':
      return 'Rayuela — Julio Cortázar';
    case 'author':
      return 'Roland Barthes — Mitologías';
    case 'quote':
      return '"La simplicidad es la máxima sofisticación." — Leonardo da Vinci';
    case 'style':
      return 'Paleta: terracota + crema. Tono: íntimo, seco. Referencias visuales: Bauhaus, Helvetica.';
    case 'free_text':
      return 'Describí el toque en un párrafo.';
  }
}
