'use client';

import { Sparkles } from 'lucide-react';
import { useState } from 'react';

interface Props {
  workspaceSlug: string;
  brandId: string;
  snapshotDates: string[];
}

export function TimelineNarrate({ workspaceSlug, brandId, snapshotDates }: Props) {
  const oldest = snapshotDates[snapshotDates.length - 1] ?? '';
  const [fromDate, setFromDate] = useState<string>(oldest);
  const [loading, setLoading] = useState(false);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!fromDate || loading) return;
    setLoading(true);
    setError(null);
    setNarrative(null);
    try {
      const iso = fromDate.slice(0, 10);
      const res = await fetch(
        `/api/${workspaceSlug}/brands/${encodeURIComponent(brandId)}/timeline-narrate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ from_date: iso }),
        },
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { narrative: string };
      setNarrative(data.narrative);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  if (!snapshotDates.length) return null;

  return (
    <div className="border-border bg-surface mb-6 rounded-[8px] border p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="text-accent h-3.5 w-3.5" />
          <h3 className="text-muted-fg font-mono text-[10px] uppercase tracking-wider">
            Narrate evolution
          </h3>
        </div>

        <label className="text-muted-fg ml-auto font-mono text-[10px]">since:</label>
        <select
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          disabled={loading}
          className="bg-surface-elevated border-border text-fg rounded-[6px] border px-2 py-1 font-mono text-xs disabled:opacity-50"
        >
          {snapshotDates.map((d) => (
            <option key={d} value={d}>
              {d.slice(0, 10)}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={run}
          disabled={loading || !fromDate}
          className="bg-accent hover:bg-accent/90 rounded-[6px] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {loading ? 'Narrating…' : 'Generate narrative'}
        </button>
      </div>

      {error && <p className="text-danger mt-3 font-mono text-xs">{error}</p>}

      {narrative && (
        <div className="border-accent/30 bg-surface-elevated mt-3 rounded-[6px] border-l-2 p-3">
          <p className="text-fg whitespace-pre-wrap text-sm leading-relaxed">{narrative}</p>
        </div>
      )}
    </div>
  );
}
