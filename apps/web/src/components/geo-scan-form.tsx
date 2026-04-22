'use client';

import { useActionState } from 'react';

import { triggerGeoScan, type GeoScanResult } from '@/actions/geo';

const GEO_PRESETS = [
  { value: 'ar,us,gb,jp', label: 'AR · US · GB · JP (default)' },
  { value: 'ar,mx,br,co,cl', label: 'LATAM' },
  { value: 'us,gb,de,fr,au,jp,br,mx,ar,in', label: 'Global (10 geos)' },
];

const SEVERITY_CLASS: Record<string, string> = {
  high: 'text-danger',
  medium: 'text-yellow-400',
  low: 'text-muted-fg',
};

interface Props {
  slug: string;
  brandId: string;
}

export function GeoScanForm({ slug, brandId }: Props) {
  const [result, action, isPending] = useActionState<GeoScanResult | null, FormData>(
    triggerGeoScan,
    null,
  );

  return (
    <div className="space-y-6">
      <form action={action} className="flex items-center gap-2">
        <input type="hidden" name="workspace" value={slug} />
        <input type="hidden" name="brand_id" value={brandId} />
        <select
          name="geos"
          defaultValue="ar,us,gb,jp"
          className="bg-surface border-border text-fg rounded border px-2 py-1 text-xs"
        >
          {GEO_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={isPending}
          className="bg-surface-elevated border-border hover:border-accent/60 inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs transition-colors disabled:opacity-50"
        >
          {isPending ? 'Scanning…' : 'Run geo scan'}
        </button>
      </form>

      {result && (
        <div className="space-y-6">
          {/* Summary strip */}
          <div className="border-border bg-surface flex gap-6 rounded-[8px] border px-5 py-3">
            <div className="text-center">
              <p className="text-fg font-mono text-2xl font-bold tabular-nums">
                {result.geos_scanned}
              </p>
              <p className="text-muted-fg text-[10px] uppercase tracking-wider">Scanned</p>
            </div>
            <div className="text-center">
              <p className="text-danger font-mono text-2xl font-bold tabular-nums">
                {result.geos_failed}
              </p>
              <p className="text-muted-fg text-[10px] uppercase tracking-wider">Failed</p>
            </div>
            <div className="text-center">
              <p className="text-fg font-mono text-2xl font-bold tabular-nums">
                {result.diffs.length}
              </p>
              <p className="text-muted-fg text-[10px] uppercase tracking-wider">Diffs</p>
            </div>
          </div>

          {/* Diffs */}
          {result.diffs.length > 0 && (
            <div className="border-border bg-surface rounded-[8px] border p-4">
              <h3 className="text-muted-fg mb-3 font-mono text-[10px] uppercase tracking-wider">
                Detected Differences
              </h3>
              <div className="space-y-3">
                {result.diffs.map((diff) => (
                  <div
                    key={diff.field}
                    className="border-border border-b pb-3 last:border-0 last:pb-0"
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-fg text-xs font-medium capitalize">{diff.field}</span>
                      <span
                        className={`font-mono text-[10px] ${SEVERITY_CLASS[diff.severity ?? 'low'] ?? 'text-muted-fg'}`}
                      >
                        {diff.unique_count} variants
                        {diff.severity ? ` · ${diff.severity}` : ''}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(diff.values).map(([geo, val]) => (
                        <span
                          key={geo}
                          className="bg-surface-elevated border-border rounded border px-1.5 py-0.5 font-mono text-[10px]"
                        >
                          <span className="text-muted-fg uppercase">{geo}</span>
                          <span className="text-fg ml-1">{val ?? '—'}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Per-geo table */}
          <div className="border-border bg-surface rounded-[8px] border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-border border-b">
                  {['Geo', 'Status', 'Lang', 'Currency', 'Redirected', 'Final URL'].map((h) => (
                    <th
                      key={h}
                      className="text-muted-fg px-3 py-2 text-left font-mono text-[10px] uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.results.map((r) => (
                  <tr key={r.geo} className="border-border border-b last:border-0">
                    <td className="text-fg px-3 py-2 font-mono font-bold uppercase">{r.geo}</td>
                    <td className="px-3 py-2">
                      {r.error ? (
                        <span className="text-danger font-mono">ERR</span>
                      ) : (
                        <span
                          className={`font-mono ${r.status_code && r.status_code < 300 ? 'text-accent' : 'text-danger'}`}
                        >
                          {r.status_code ?? '—'}
                        </span>
                      )}
                    </td>
                    <td className="text-muted-fg px-3 py-2 font-mono">{r.lang ?? '—'}</td>
                    <td className="text-muted-fg px-3 py-2 font-mono uppercase">
                      {r.currency_detected ?? '—'}
                    </td>
                    <td className="px-3 py-2">
                      {r.redirected ? (
                        <span className="font-mono text-[10px] text-yellow-400">yes</span>
                      ) : (
                        <span className="text-muted-fg font-mono text-[10px]">no</span>
                      )}
                    </td>
                    <td className="text-muted-fg max-w-[200px] truncate px-3 py-2 font-mono text-[10px]">
                      {r.final_url ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
