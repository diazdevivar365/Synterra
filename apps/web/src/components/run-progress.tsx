'use client';

import { useEffect, useRef, useState } from 'react';

interface ProgressEvent {
  type: 'progress';
  step: string;
  percent: number;
  worker?: string;
  phase?: string;
}

interface Step {
  step: string;
  percent: number;
  worker?: string;
  done: boolean;
}

const STEP_LABELS: Record<string, string> = {
  scraping: 'Scraping website',
  rendered: 'Rendering pages',
  enriching: 'Enriching brand data',
  dna: 'Building Brand DNA',
  graph: 'Updating knowledge graph',
  social: 'Scanning social profiles',
  news: 'Fetching news signals',
  done: 'Complete',
};

export function RunProgress({ runId, onComplete }: { runId: string; onComplete?: () => void }) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [percent, setPercent] = useState(0);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(`/api/research/${runId}/stream`);
    esRef.current = es;

    es.addEventListener('progress', (e) => {
      try {
        const data = JSON.parse((e as MessageEvent<string>).data) as ProgressEvent;
        setPercent(data.percent);
        setSteps((prev) => {
          const idx = prev.findIndex((s) => s.step === data.step);
          const next: Step = {
            step: data.step,
            percent: data.percent,
            done: data.phase === 'done',
            ...(data.worker !== undefined && { worker: data.worker }),
          };
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = next;
            return updated;
          }
          return [...prev, next];
        });
      } catch {
        // ignore malformed event
      }
    });

    es.addEventListener('done', () => {
      setFinished(true);
      es.close();
      onComplete?.();
    });

    es.addEventListener('error', (e) => {
      try {
        const raw = (e as MessageEvent<string>).data;
        const data = JSON.parse(raw) as { error?: string };
        setError(data.error ?? 'Stream error');
      } catch {
        setError('Stream disconnected');
      }
      es.close();
    });

    es.addEventListener('timeout', () => {
      setError('Stream timed out — refresh to check current status');
      es.close();
    });

    return () => {
      es.close();
    };
  }, [runId, onComplete]);

  if (error) {
    return (
      <div className="border-danger/30 bg-danger/10 rounded-[8px] border px-4 py-3">
        <p className="text-danger font-mono text-xs">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-muted-fg font-mono text-xs">
            {finished ? 'Complete' : 'Analysing…'}
          </span>
          <span className="text-muted-fg font-mono text-xs tabular-nums">{percent}%</span>
        </div>
        <div className="bg-surface-elevated h-1.5 overflow-hidden rounded-full">
          <div
            className="bg-accent h-full rounded-full transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {steps.length > 0 && (
        <div className="space-y-1">
          {steps.map((s) => (
            <div key={s.step} className="flex items-center gap-2">
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  s.done ? 'bg-accent' : 'bg-muted-fg animate-pulse'
                }`}
              />
              <span className="text-muted-fg font-mono text-xs">
                {STEP_LABELS[s.step] ?? s.step}
              </span>
              {s.done && <span className="text-accent ml-auto font-mono text-[10px]">done</span>}
            </div>
          ))}
        </div>
      )}

      {steps.length === 0 && !finished && (
        <p className="text-muted-fg font-mono text-xs">Waiting for pipeline to start…</p>
      )}
    </div>
  );
}
