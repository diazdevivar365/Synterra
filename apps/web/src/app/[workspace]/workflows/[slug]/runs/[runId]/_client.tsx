'use client';

import { useEffect, useRef, useState } from 'react';

import type { WorkflowRun } from '@/lib/workflows';

interface StreamEvent {
  kind: 'hello' | 'progress' | 'done' | 'error' | 'timeout';
  raw: string;
  parsed?: Record<string, unknown> | undefined;
  at: number;
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  running: 'border-sky-500/30 bg-sky-500/10 text-sky-400',
  succeeded: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  failed: 'border-red-500/30 bg-red-500/10 text-red-400',
  cancelled: 'border-border bg-surface-elevated text-muted-fg',
};

export function RunStreamClient({
  workspace,
  runId,
  initial,
}: {
  workspace: string;
  runId: string;
  initial: WorkflowRun;
}) {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [status, setStatus] = useState<string>(initial.status);
  const [ended, setEnded] = useState<boolean>(
    ['succeeded', 'failed', 'cancelled'].includes(initial.status),
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ended) return;
    const url = `/api/${workspace}/workflow-runs/${runId}/stream`;
    const es = new EventSource(url);

    const append = (kind: StreamEvent['kind'], raw: string) => {
      let parsed: Record<string, unknown> | undefined;
      try {
        parsed = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        parsed = undefined;
      }
      setEvents((prev) => [...prev, { kind, raw, parsed, at: Date.now() }]);
      const evtStatus = parsed?.['status'];
      if (typeof evtStatus === 'string') setStatus(evtStatus);
      if (parsed?.['type'] === 'workflow.succeeded') setStatus('succeeded');
      if (parsed?.['type'] === 'workflow.failed') setStatus('failed');
    };

    const readData = (e: Event): string => {
      const msg = e as MessageEvent<string>;
      return typeof msg.data === 'string' ? msg.data : '';
    };

    es.addEventListener('hello', (e) => {
      append('hello', readData(e));
    });
    es.addEventListener('progress', (e) => {
      append('progress', readData(e));
    });
    es.addEventListener('done', (e) => {
      append('done', readData(e));
      setEnded(true);
      es.close();
    });
    es.addEventListener('error', (e) => {
      append('error', readData(e) || 'stream error');
      setEnded(true);
      es.close();
    });
    es.addEventListener('timeout', (e) => {
      append('timeout', readData(e));
      setEnded(true);
      es.close();
    });

    return () => es.close();
  }, [workspace, runId, ended]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [events]);

  const tone = STATUS_COLOR[status] ?? STATUS_COLOR['pending'];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <section className="space-y-4">
        <div className="border-border bg-surface flex items-center justify-between gap-4 rounded-[8px] border p-4">
          <div>
            <div className="text-muted-fg font-mono text-[10px] uppercase tracking-wider">
              Estado
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className={`rounded-[4px] border px-2 py-0.5 font-mono text-xs ${tone}`}>
                {status}
              </span>
              {!ended && status === 'running' && (
                <span className="text-muted-fg font-mono text-[10px]">streaming…</span>
              )}
            </div>
          </div>
          {initial.started_at && (
            <div className="text-right">
              <div className="text-muted-fg font-mono text-[10px] uppercase tracking-wider">
                Inició
              </div>
              <div className="text-fg font-mono text-xs">
                {new Date(initial.started_at).toLocaleTimeString('es-AR')}
              </div>
            </div>
          )}
        </div>

        <div>
          <h2 className="text-muted-fg mb-3 font-mono text-[10px] uppercase tracking-wider">
            Eventos del graph ({events.length})
          </h2>
          <div
            ref={scrollRef}
            className="border-border bg-surface max-h-[480px] space-y-2 overflow-y-auto rounded-[8px] border p-4"
          >
            {events.length === 0 ? (
              <p className="text-muted-fg font-mono text-xs">
                {ended
                  ? 'Sin eventos capturados (run terminó antes de conectar al stream).'
                  : 'Conectando…'}
              </p>
            ) : (
              events.map((e, i) => <EventRow key={i} evt={e} />)
            )}
          </div>
        </div>

        {initial.output && Object.keys(initial.output).length > 0 && (
          <div>
            <h2 className="text-muted-fg mb-3 font-mono text-[10px] uppercase tracking-wider">
              Output final
            </h2>
            <pre className="border-border bg-surface max-h-[400px] overflow-auto rounded-[8px] border p-4 font-mono text-[11px] leading-tight">
              {JSON.stringify(initial.output, null, 2)}
            </pre>
          </div>
        )}

        {initial.error && (
          <div className="rounded-[8px] border border-red-500/30 bg-red-500/5 p-4">
            <div className="text-muted-fg mb-1 font-mono text-[10px] uppercase tracking-wider">
              Error
            </div>
            <p className="font-mono text-xs text-red-400">{initial.error}</p>
          </div>
        )}
      </section>

      <aside className="space-y-4">
        <div className="border-border bg-surface rounded-[8px] border p-4">
          <h3 className="text-muted-fg mb-2 font-mono text-[10px] uppercase tracking-wider">
            Input
          </h3>
          <pre className="text-muted-fg max-h-[200px] overflow-auto font-mono text-[10px] leading-tight">
            {JSON.stringify(initial.input, null, 2)}
          </pre>
        </div>
        {initial.state_snapshot && (
          <div className="border-border bg-surface rounded-[8px] border p-4">
            <h3 className="text-muted-fg mb-2 font-mono text-[10px] uppercase tracking-wider">
              State snapshot
            </h3>
            <pre className="text-muted-fg max-h-[280px] overflow-auto font-mono text-[10px] leading-tight">
              {JSON.stringify(initial.state_snapshot, null, 2)}
            </pre>
          </div>
        )}
      </aside>
    </div>
  );
}

function EventRow({ evt }: { evt: StreamEvent }) {
  const ts = new Date(evt.at).toLocaleTimeString('es-AR');
  const type =
    evt.kind === 'progress' ? ((evt.parsed?.['type'] as string | undefined) ?? 'event') : evt.kind;

  const tone =
    evt.kind === 'error'
      ? 'border-red-500/30 text-red-400'
      : evt.kind === 'done' || type === 'workflow.succeeded'
        ? 'border-emerald-500/30 text-emerald-400'
        : type === 'workflow.failed'
          ? 'border-red-500/30 text-red-400'
          : 'border-sky-500/30 text-sky-400';

  return (
    <div className="flex items-start gap-2 font-mono text-[11px] leading-tight">
      <span className={`bg-surface shrink-0 rounded-[4px] border px-1.5 py-0.5 text-[9px] ${tone}`}>
        {type}
      </span>
      <span className="text-muted-fg shrink-0">{ts}</span>
      <span className="text-fg line-clamp-2 flex-1">{summarise(evt)}</span>
    </div>
  );
}

function summarise(evt: StreamEvent): string {
  if (!evt.parsed) return evt.raw;
  const relevant: string[] = [];
  for (const key of [
    'run_id',
    'type',
    'status',
    'step',
    'worker',
    'phase',
    'percent',
    'has_output',
  ]) {
    const v = evt.parsed[key];
    if (v === undefined || v === null) continue;
    const s =
      typeof v === 'string'
        ? v
        : typeof v === 'number' || typeof v === 'boolean'
          ? String(v)
          : JSON.stringify(v);
    relevant.push(`${key}=${s.slice(0, 60)}`);
  }
  return relevant.join(' · ') || evt.raw.slice(0, 160);
}
