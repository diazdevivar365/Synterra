import { and, eq } from 'drizzle-orm';
import { Ghost, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { workspaceMembers, workspaces } from '@synterra/db';

import { triggerGhostScan } from '@/actions/ghost';
import { brandNameFromId, getBrandAds } from '@/lib/brands';
import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

const GEO_OPTIONS = [
  { value: 'us', label: 'United States' },
  { value: 'ar', label: 'Argentina' },
  { value: 'gb', label: 'United Kingdom' },
  { value: 'mx', label: 'Mexico' },
  { value: 'br', label: 'Brazil' },
  { value: 'es', label: 'Spain' },
];

export default async function BrandAdsPage({
  params,
}: {
  params: Promise<{ workspace: string; id: string }>;
}) {
  const { workspace: slug, id } = await params;

  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/workspaces');

  const ws = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaces.slug, slug), eq(workspaceMembers.userId, ctx.userId)))
    .then((r) => r[0] ?? null);
  if (!ws) redirect('/workspaces');

  const ads = await getBrandAds(ws.id, id);
  const brandName = brandNameFromId(id);

  const metaAds = ads?.sources?.meta_ads;
  const tiktokAds = ads?.sources?.tiktok_ads;
  const analysis = ads?.ai_analysis;

  return (
    <div className="mx-auto max-w-[1100px] space-y-6 px-6 py-8">
      <div>
        <Link
          href={`/${slug}/brands/${id}`}
          className="text-muted-fg hover:text-fg mb-4 inline-flex items-center gap-1.5 font-mono text-xs transition-colors"
        >
          ← {brandName}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Ghost className="text-accent h-5 w-5" />
            <h1 className="text-fg text-xl font-semibold">Ghost Scan — Ads Library</h1>
          </div>
          <form action={triggerGhostScan} className="flex items-center gap-2">
            <input type="hidden" name="workspace" value={slug} />
            <input type="hidden" name="brand_id" value={id} />
            <select
              name="geo"
              defaultValue="us"
              className="bg-surface border-border text-fg rounded border px-2 py-1 text-xs"
            >
              {GEO_OPTIONS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="bg-surface-elevated border-border hover:border-accent/60 inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Run scan
            </button>
          </form>
        </div>
        {ads?.scanned_at && (
          <p className="text-muted-fg mt-1 text-xs">
            Last scanned {new Date(ads.scanned_at).toLocaleDateString()}
            {ads.geo && (
              <>
                {' · '}Geo: <span className="font-semibold uppercase">{ads.geo}</span>
              </>
            )}
          </p>
        )}
      </div>

      {!ads ? (
        <div className="border-border rounded-lg border border-dashed py-16 text-center">
          <p className="text-muted-fg text-sm">No ad data yet.</p>
          <p className="text-muted-fg mt-1 text-xs">
            Select a geo and run a scan to scrape Meta Ads Library + TikTok ads.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {analysis && (
            <div className="bg-surface-elevated border-border space-y-3 rounded-lg border p-5">
              <h2 className="text-fg text-sm font-semibold">AI Analysis</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {analysis.dominant_messages && analysis.dominant_messages.length > 0 && (
                  <div>
                    <h3 className="text-muted-fg mb-1 text-xs font-semibold uppercase">
                      Dominant Messages
                    </h3>
                    <ul className="space-y-1">
                      {analysis.dominant_messages.map((m, i) => (
                        <li key={i} className="text-fg flex gap-2 text-xs">
                          <span className="text-accent">·</span> {m}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {analysis.creative_formats && analysis.creative_formats.length > 0 && (
                  <div>
                    <h3 className="text-muted-fg mb-1 text-xs font-semibold uppercase">
                      Creative Formats
                    </h3>
                    <div className="flex flex-wrap gap-1">
                      {analysis.creative_formats.map((f, i) => (
                        <span
                          key={i}
                          className="bg-surface border-border text-fg rounded border px-2 py-0.5 text-xs"
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {analysis.text_overlay_style && (
                  <div>
                    <h3 className="text-muted-fg mb-1 text-xs font-semibold uppercase">
                      Text Style
                    </h3>
                    <p className="text-fg text-xs">{analysis.text_overlay_style}</p>
                  </div>
                )}
                {analysis.color_palette_summary && (
                  <div>
                    <h3 className="text-muted-fg mb-1 text-xs font-semibold uppercase">
                      Color Palette
                    </h3>
                    <p className="text-fg text-xs">{analysis.color_palette_summary}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {metaAds && (
            <div className="space-y-3">
              <h2 className="text-fg text-sm font-semibold">
                Meta Ads Library
                <span className="text-muted-fg ml-2 text-xs font-normal">
                  ({metaAds.count} found)
                </span>
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {metaAds.samples.map((ad, i) => (
                  <div
                    key={i}
                    className="bg-surface-elevated border-border space-y-2 rounded-lg border p-4"
                  >
                    {ad.format && (
                      <span className="bg-accent/10 text-accent rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                        {ad.format}
                      </span>
                    )}
                    {ad.headline && <p className="text-fg text-xs font-medium">{ad.headline}</p>}
                    {ad.body && <p className="text-muted-fg line-clamp-3 text-xs">{ad.body}</p>}
                    {ad.cta && <p className="text-accent text-xs font-medium">CTA: {ad.cta}</p>}
                    {ad.started_at && (
                      <p className="text-muted-fg font-mono text-[10px]">
                        {ad.started_at.slice(0, 10)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {tiktokAds && (
            <div className="space-y-3">
              <h2 className="text-fg text-sm font-semibold">
                TikTok Ads
                <span className="text-muted-fg ml-2 text-xs font-normal">
                  ({tiktokAds.count} found)
                </span>
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {tiktokAds.samples.map((ad, i) => (
                  <div
                    key={i}
                    className="bg-surface-elevated border-border space-y-2 rounded-lg border p-4"
                  >
                    {ad.format && (
                      <span className="bg-accent/10 text-accent rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                        {ad.format}
                      </span>
                    )}
                    {ad.headline && <p className="text-fg text-xs font-medium">{ad.headline}</p>}
                    {ad.body && <p className="text-muted-fg line-clamp-3 text-xs">{ad.body}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
