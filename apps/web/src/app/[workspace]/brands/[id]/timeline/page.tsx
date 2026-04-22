import { and, eq } from 'drizzle-orm';
import { ArrowLeft, Clock, Globe } from 'lucide-react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { workspaceMembers, workspaces } from '@synterra/db';

import { getBrandById, getBrandTimeline } from '@/lib/brands';
import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

interface Props {
  params: Promise<{ workspace: string; id: string }>;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso.slice(0, 10);
  }
}

export default async function TimelinePage({ params }: Props) {
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

  const [brandResult, timeline] = await Promise.all([
    getBrandById(ws.id, id),
    getBrandTimeline(ws.id, id),
  ]);
  if (!brandResult) notFound();

  const { brand, fromSeed } = brandResult;
  const brandSnapshots = timeline?.brandSnapshots ?? [];
  const waybackSnapshots = timeline?.waybackSnapshots ?? [];

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8">
      {fromSeed && (
        <div className="border-border bg-surface mb-6 rounded-[8px] border px-4 py-3">
          <p className="text-muted-fg font-mono text-xs">
            Connecting to intelligence engine — showing example data.
          </p>
        </div>
      )}

      <div className="mb-8">
        <Link
          href={`/${slug}/brands/${id}`}
          className="text-muted-fg hover:text-fg mb-4 inline-flex items-center gap-1.5 font-mono text-xs transition-colors duration-150"
        >
          <ArrowLeft className="h-3 w-3" />
          {brand.name}
        </Link>
        <div className="flex items-baseline justify-between">
          <h1 className="text-fg text-2xl font-bold">Brand Timeline</h1>
          {timeline?.waybackSyncedAt && (
            <span className="text-muted-fg font-mono text-xs">
              Wayback synced {formatDate(timeline.waybackSyncedAt)}
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Research snapshots */}
        <div>
          <div className="mb-4 flex items-center gap-2">
            <Clock className="text-muted-fg h-3.5 w-3.5" />
            <h2 className="text-muted-fg font-mono text-xs uppercase tracking-wider">
              Research Snapshots
            </h2>
            <span className="text-muted-fg ml-auto font-mono text-xs">{brandSnapshots.length}</span>
          </div>

          {brandSnapshots.length === 0 ? (
            <div className="border-border flex min-h-[160px] items-center justify-center rounded-[8px] border">
              <p className="text-muted-fg font-mono text-xs">
                No snapshots yet — re-run research to create one.
              </p>
            </div>
          ) : (
            <div className="relative space-y-0">
              <div className="bg-border absolute bottom-2 left-[7px] top-2 w-px" />
              {brandSnapshots.map((snap, i) => (
                <div key={i} className="relative flex gap-4 pb-4">
                  <div className="border-accent bg-surface relative z-10 mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full border-2" />
                  <div className="border-border bg-surface min-w-0 flex-1 rounded-[8px] border p-3">
                    <p className="text-muted-fg mb-1 font-mono text-[10px]">
                      {formatDate(snap.date)}
                    </p>
                    {snap.tagline && (
                      <p className="text-fg mb-1 text-sm font-medium">
                        &ldquo;{snap.tagline}&rdquo;
                      </p>
                    )}
                    {snap.tone && <p className="text-muted-fg truncate text-xs">{snap.tone}</p>}
                    {snap.positioning && snap.positioning !== 'None' && (
                      <p className="text-muted-fg mt-1 line-clamp-2 text-[10px]">
                        {snap.positioning}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Wayback history */}
        <div>
          <div className="mb-4 flex items-center gap-2">
            <Globe className="text-muted-fg h-3.5 w-3.5" />
            <h2 className="text-muted-fg font-mono text-xs uppercase tracking-wider">
              Wayback Machine
            </h2>
            <span className="text-muted-fg ml-auto font-mono text-xs">
              {waybackSnapshots.length}
            </span>
          </div>

          {waybackSnapshots.length === 0 ? (
            <div className="border-border flex min-h-[160px] items-center justify-center rounded-[8px] border">
              <p className="text-muted-fg font-mono text-xs">
                No wayback history — trigger a wayback sync from research settings.
              </p>
            </div>
          ) : (
            <div className="relative space-y-0">
              <div className="bg-border absolute bottom-2 left-[7px] top-2 w-px" />
              {waybackSnapshots.map((snap, i) => (
                <div key={i} className="relative flex gap-4 pb-4">
                  <div className="border-border bg-surface-elevated relative z-10 mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full border-2" />
                  <div className="border-border bg-surface min-w-0 flex-1 rounded-[8px] border p-3">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="text-muted-fg font-mono text-[10px]">{formatDate(snap.date)}</p>
                      {snap.snapshotUrl && (
                        <a
                          href={snap.snapshotUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent font-mono text-[10px] hover:underline"
                        >
                          view ↗
                        </a>
                      )}
                    </div>
                    {(snap.title ?? snap.h1) && (
                      <p className="text-fg mb-1 truncate text-sm font-medium">
                        {snap.title ?? snap.h1}
                      </p>
                    )}
                    {snap.metaDescription && (
                      <p className="text-muted-fg line-clamp-2 text-xs">{snap.metaDescription}</p>
                    )}
                    {snap.paletteHex.length > 0 && (
                      <div className="mt-2 flex gap-1">
                        {snap.paletteHex.slice(0, 5).map((hex) => (
                          <div
                            key={hex}
                            className="border-border/50 h-3 w-3 rounded-sm border"
                            style={{ backgroundColor: hex }}
                            title={hex}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
