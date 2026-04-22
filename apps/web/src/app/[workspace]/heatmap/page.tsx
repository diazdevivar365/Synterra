import { and, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { workspaceMembers, workspaces } from '@synterra/db';

import { brandNameFromId, getHeatmap } from '@/lib/brands';
import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

interface Props {
  params: Promise<{ workspace: string }>;
}

const TONE_COLORS = [
  'bg-accent border-accent/60',
  'bg-purple-500 border-purple-400',
  'bg-orange-500 border-orange-400',
  'bg-pink-500 border-pink-400',
  'bg-teal-500 border-teal-400',
  'bg-yellow-500 border-yellow-400',
];

export default async function HeatmapPage({ params }: Props) {
  const { workspace: slug } = await params;
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/workspaces');

  const ws = await db
    .select({ id: workspaces.id, name: workspaces.name })
    .from(workspaces)
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaces.slug, slug), eq(workspaceMembers.userId, ctx.userId)))
    .then((r) => r[0] ?? null);
  if (!ws) redirect('/workspaces');

  const heatmap = await getHeatmap(ws.id);

  const toneIndex: Record<string, number> = {};
  let nextColor = 0;
  if (heatmap) {
    for (const p of heatmap.points) {
      const key = p.tone ?? p.industry ?? 'other';
      if (!(key in toneIndex)) {
        toneIndex[key] = nextColor++ % TONE_COLORS.length;
      }
    }
  }

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8">
      <div className="mb-8">
        <h1 className="text-fg text-2xl font-bold">Portfolio Heatmap</h1>
        <p className="text-muted-fg font-mono text-xs">
          {heatmap
            ? `${heatmap.nBrands} brands · ${heatmap.method.toUpperCase()} projection`
            : '2D brand positioning scatter'}
        </p>
      </div>

      {!heatmap ? (
        <div className="border-border flex min-h-[400px] items-center justify-center rounded-[8px] border">
          <p className="text-muted-fg font-mono text-sm">
            Need ≥3 brands with DNA embeddings to render heatmap.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
          {/* Scatter plot */}
          <div
            className="border-border bg-surface relative overflow-hidden rounded-[8px] border"
            style={{ height: '520px' }}
          >
            <div className="pointer-events-none absolute inset-0">
              <div className="bg-border absolute left-1/2 top-0 h-full w-px opacity-40" />
              <div className="bg-border absolute left-0 top-1/2 h-px w-full opacity-40" />
            </div>
            <span className="text-muted-fg pointer-events-none absolute bottom-2 right-3 font-mono text-[9px]">
              PC1 →
            </span>
            <span
              className="text-muted-fg pointer-events-none absolute left-2 top-3 font-mono text-[9px]"
              style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
            >
              PC2 ↑
            </span>

            {heatmap.points.map((pt) => {
              const left = ((pt.x + 1) / 2) * 100;
              const bottom = ((pt.y + 1) / 2) * 100;
              const colorKey = pt.tone ?? pt.industry ?? 'other';
              const colorClass = TONE_COLORS[toneIndex[colorKey] ?? 0];
              const name = brandNameFromId(pt.brandId);
              return (
                <a
                  key={pt.brandId}
                  href={`/${slug}/brands/${pt.brandId}`}
                  title={`${name}${pt.tone ? ` · ${pt.tone}` : ''}${pt.industry ? ` · ${pt.industry}` : ''}`}
                  className="group absolute -translate-x-1/2 translate-y-1/2"
                  style={{ left: `${left}%`, bottom: `${bottom}%` }}
                >
                  <div
                    className={`h-3 w-3 rounded-full border-2 transition-all duration-150 group-hover:scale-150 ${colorClass}`}
                  />
                  <span className="bg-surface-elevated text-fg pointer-events-none absolute left-4 top-0 hidden whitespace-nowrap rounded px-1.5 py-0.5 font-mono text-[9px] shadow group-hover:block">
                    {name}
                    {pt.tone && <span className="text-muted-fg ml-1">· {pt.tone}</span>}
                  </span>
                </a>
              );
            })}
          </div>

          {/* Legend + brand list */}
          <div className="space-y-4">
            {Object.keys(toneIndex).length > 0 && (
              <div className="border-border bg-surface rounded-[8px] border p-4">
                <h3 className="text-muted-fg mb-3 font-mono text-[10px] uppercase tracking-wider">
                  Tone / Industry
                </h3>
                <div className="space-y-2">
                  {Object.entries(toneIndex).map(([key, idx]) => (
                    <div key={key} className="flex items-center gap-2">
                      <div
                        className={`h-2.5 w-2.5 shrink-0 rounded-full border-2 ${TONE_COLORS[idx]}`}
                      />
                      <span className="text-fg font-mono text-[10px] capitalize">{key}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="border-border bg-surface rounded-[8px] border p-4">
              <h3 className="text-muted-fg mb-3 font-mono text-[10px] uppercase tracking-wider">
                All Brands
              </h3>
              <div className="space-y-2">
                {heatmap.points.map((pt) => (
                  <a
                    key={pt.brandId}
                    href={`/${slug}/brands/${pt.brandId}`}
                    className="hover:bg-surface-elevated flex items-start gap-2 rounded-[4px] p-1.5"
                  >
                    <div
                      className={`mt-0.5 h-2 w-2 shrink-0 rounded-full border ${TONE_COLORS[toneIndex[pt.tone ?? pt.industry ?? 'other'] ?? 0]}`}
                    />
                    <div className="min-w-0">
                      <p className="text-fg truncate text-[11px] font-medium">
                        {brandNameFromId(pt.brandId)}
                      </p>
                      {pt.positioning && (
                        <p className="text-muted-fg line-clamp-1 font-mono text-[9px]">
                          {pt.positioning}
                        </p>
                      )}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
