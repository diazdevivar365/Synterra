'use client';

import { useActionState } from 'react';

import { discoverBrands, type DiscoveryResult } from '@/actions/discovery';

interface Props {
  slug: string;
}

const STATUS_LABEL: Record<string, string> = {
  auto_resolved: 'Resolved',
  needs_review: 'Needs review',
  instagram_detected: 'Instagram',
  error: 'Error',
  skipped_exists: 'Already exists',
};

export function DiscoveryForm({ slug }: Props) {
  const [result, action, isPending] = useActionState<DiscoveryResult | null, FormData>(
    discoverBrands,
    null,
  );

  return (
    <div className="space-y-6">
      <form
        action={action}
        className="bg-surface-elevated border-border space-y-4 rounded-lg border p-5"
      >
        <input type="hidden" name="workspace" value={slug} />

        <div className="space-y-1">
          <label className="text-fg text-sm font-medium">URLs or brand names</label>
          <p className="text-muted-fg text-xs">
            One per line. Accepts URLs, domains, brand names, or @instagram handles.
          </p>
          <textarea
            name="urls"
            rows={6}
            placeholder={'apple.com\nCoca Cola Argentina\n@nike\nhttps://notion.so'}
            className="bg-surface border-border text-fg placeholder:text-muted-fg focus:ring-accent w-full resize-none rounded border px-3 py-2 font-mono text-sm focus:outline-none focus:ring-1"
            required
          />
        </div>

        <div className="flex items-center gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-muted-fg text-xs">Depth</label>
            <select
              name="depth"
              defaultValue="rendered"
              className="bg-surface border-border text-fg rounded border px-3 py-1.5 text-sm"
            >
              <option value="light">Light (fast, no JS)</option>
              <option value="rendered">Rendered (full, JS)</option>
              <option value="ig-only">Instagram only</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="bg-accent hover:bg-accent/90 self-end rounded px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {isPending ? 'Queuing…' : 'Add brands'}
          </button>
        </div>
      </form>

      {result && (
        <div className="space-y-4">
          <div className="bg-surface-elevated border-border rounded-lg border p-4">
            <p className="text-fg text-sm font-semibold">
              {result.queued} brand{result.queued !== 1 ? 's' : ''} queued for research
            </p>
            {result.items.length > 0 && (
              <ul className="mt-2 space-y-1">
                {result.items.map((item) => (
                  <li key={item.run_id} className="text-muted-fg font-mono text-xs">
                    {item.brand_id} — {item.url}{' '}
                    <span className="text-accent">({item.run_id})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {result.discoveries && result.discoveries.length > 0 && (
            <div className="bg-surface-elevated border-border space-y-3 rounded-lg border p-4">
              <h3 className="text-fg text-sm font-semibold">Resolution Details</h3>
              {result.discoveries.map((d, i) => (
                <div key={i} className="bg-surface border-border rounded border px-3 py-2">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-fg text-xs font-medium">{d.input}</span>
                    <span
                      className={`text-[10px] font-semibold uppercase ${
                        d.status === 'error'
                          ? 'text-danger'
                          : d.status === 'needs_review'
                            ? 'text-yellow-400'
                            : 'text-accent'
                      }`}
                    >
                      {STATUS_LABEL[d.status] ?? d.status}
                    </span>
                    {d.confidence !== undefined && (
                      <span className="text-muted-fg text-[10px]">
                        {Math.round(d.confidence * 100)}% conf.
                      </span>
                    )}
                  </div>
                  {d.resolved_url && (
                    <p className="text-muted-fg font-mono text-xs">{d.resolved_url}</p>
                  )}
                  {d.error && <p className="text-danger text-xs">{d.error}</p>}
                  {d.candidates && d.candidates.length > 0 && (
                    <div className="mt-1">
                      <p className="text-muted-fg mb-1 text-[10px]">
                        Candidates (re-submit chosen URL):
                      </p>
                      {d.candidates.map((c, j) => (
                        <p key={j} className="text-muted-fg font-mono text-xs">
                          {c.url}
                          {c.name ? ` — ${c.name}` : ''}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
