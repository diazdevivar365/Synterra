'use client';

import { useActionState } from 'react';

import { triggerReactionsScan, type ReactionsScanResult } from '@/actions/reactions';

const SENTIMENT_CLASS: Record<string, string> = {
  positive: 'text-accent',
  neutral: 'text-muted-fg',
  mixed: 'text-yellow-400',
  negative: 'text-danger',
};

interface Props {
  slug: string;
  brandId: string;
}

export function ReactionsScanForm({ slug, brandId }: Props) {
  const [result, action, isPending] = useActionState<ReactionsScanResult | null, FormData>(
    triggerReactionsScan,
    null,
  );

  return (
    <div className="space-y-6">
      <form action={action} className="flex items-center gap-2">
        <input type="hidden" name="workspace" value={slug} />
        <input type="hidden" name="brand_id" value={brandId} />
        <button
          type="submit"
          disabled={isPending}
          className="bg-surface-elevated border-border hover:border-accent/60 inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs transition-colors disabled:opacity-50"
        >
          {isPending ? 'Scanning Reddit + HN…' : 'Run reactions scan'}
        </button>
      </form>

      {result && (
        <div className="space-y-6">
          <div className="border-border bg-surface flex gap-6 rounded-[8px] border px-5 py-3">
            <div className="text-center">
              <p className="text-fg font-mono text-2xl font-bold tabular-nums">
                {result.total_mentions}
              </p>
              <p className="text-muted-fg text-[10px] uppercase tracking-wider">Mentions</p>
            </div>
            {Object.entries(result.raw_counts).map(([source, n]) => (
              <div key={source} className="text-center">
                <p className="text-fg font-mono text-2xl font-bold tabular-nums">{n}</p>
                <p className="text-muted-fg text-[10px] uppercase tracking-wider">{source}</p>
              </div>
            ))}
            {result.analysis.sentiment && (
              <div className="text-center">
                <p
                  className={`font-mono text-2xl font-bold uppercase ${SENTIMENT_CLASS[result.analysis.sentiment.toLowerCase()] ?? 'text-fg'}`}
                >
                  {result.analysis.sentiment}
                </p>
                <p className="text-muted-fg text-[10px] uppercase tracking-wider">Sentiment</p>
              </div>
            )}
          </div>

          {result.analysis.summary && (
            <div className="border-border bg-surface rounded-[8px] border p-4">
              <h3 className="text-muted-fg mb-2 font-mono text-[10px] uppercase tracking-wider">
                Summary
              </h3>
              <p className="text-fg text-xs italic">{result.analysis.summary}</p>
            </div>
          )}

          {result.analysis.crisis_signals && result.analysis.crisis_signals.length > 0 && (
            <div className="border-danger bg-surface rounded-[8px] border p-4">
              <div className="mb-2 flex items-center gap-2">
                <h3 className="text-danger font-mono text-[10px] uppercase tracking-wider">
                  Crisis Signals
                </h3>
                {result.analysis.urgency_24h && (
                  <span className="bg-danger/10 text-danger rounded px-1.5 py-0.5 font-mono text-[10px] uppercase">
                    24h urgency
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {result.analysis.crisis_signals.map((s) => (
                  <span
                    key={s}
                    className="bg-danger/10 text-danger border-danger/30 rounded border px-1.5 py-0.5 font-mono text-[10px]"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {result.analysis.topic_clusters && result.analysis.topic_clusters.length > 0 && (
            <div className="border-border bg-surface rounded-[8px] border p-4">
              <h3 className="text-muted-fg mb-2 font-mono text-[10px] uppercase tracking-wider">
                Topic Clusters
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {result.analysis.topic_clusters.map((t) => (
                  <span
                    key={t.name}
                    className="bg-surface-elevated border-border rounded border px-2 py-1 font-mono text-[10px]"
                  >
                    {t.name}
                    {t.count != null && <span className="text-muted-fg"> · {t.count}</span>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {result.analysis.recommended_response && (
            <div className="border-accent/40 bg-surface rounded-[8px] border p-4">
              <h3 className="text-muted-fg mb-2 font-mono text-[10px] uppercase tracking-wider">
                Recommended Response Angle
              </h3>
              <p className="text-fg text-xs">{result.analysis.recommended_response}</p>
            </div>
          )}

          {result.sample_posts.length > 0 && (
            <div className="border-border bg-surface rounded-[8px] border">
              <h3 className="text-muted-fg border-border border-b px-4 py-2 font-mono text-[10px] uppercase tracking-wider">
                Sample posts · top {result.sample_posts.length}
              </h3>
              <ul className="divide-border divide-y">
                {result.sample_posts.map((p, i) => (
                  <li key={p.url ?? i} className="px-4 py-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-fg font-mono text-[10px] uppercase">
                        {p.source}
                      </span>
                      {p.score != null && (
                        <span className="text-muted-fg font-mono text-[10px]">· {p.score} pts</span>
                      )}
                      {p.created_at && (
                        <span className="text-muted-fg font-mono text-[10px]">
                          · {p.created_at.slice(0, 10)}
                        </span>
                      )}
                    </div>
                    {p.url ? (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-fg hover:text-accent line-clamp-2 text-[11px] transition-colors"
                      >
                        {p.title ?? p.url}
                      </a>
                    ) : (
                      <span className="text-fg line-clamp-2 text-[11px]">{p.title ?? '—'}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
