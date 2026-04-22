import { and, eq } from 'drizzle-orm';
import { Activity, BarChart2, Bell, Layers } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { workspaceMembers, workspaces } from '@synterra/db';

import { StatCard } from '@/components/stat-card';
import { getHealthColor } from '@/lib/brand-utils';
import { brandNameFromId, getBrandsForWorkspace } from '@/lib/brands';
import { db } from '@/lib/db';
import { getInsightsSummary, getRecentChanges } from '@/lib/insights';
import { getWorkspaceContext } from '@/lib/workspace-context';

interface Props {
  params: Promise<{ workspace: string }>;
}

function kindLabel(kind: string): string {
  return kind.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function WorkspaceOverviewPage({ params }: Props) {
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

  const [summary, brandsResult, changes] = await Promise.all([
    getInsightsSummary(ws.id),
    getBrandsForWorkspace(ws.id),
    getRecentChanges(ws.id),
  ]);

  const { brands, fromSeed } = brandsResult;
  const topBrands = [...brands].sort((a, b) => b.healthScore - a.healthScore).slice(0, 6);

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
        <h1 className="text-fg text-2xl font-bold">{ws.name}</h1>
        <p className="text-muted-fg font-mono text-xs">Command center</p>
      </div>

      {/* Summary stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Brands tracked" value={summary?.brandsTracked ?? brands.length} />
        <StatCard label="Research runs" value={summary?.researchRunsTotal ?? '—'} />
        <StatCard label="Changes (14d)" value={summary?.changeEvents7d ?? '—'} />
        <StatCard label="Alerts" value={summary?.strategicAlerts ?? '—'} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Left: Brand portfolio */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="text-muted-fg h-3.5 w-3.5" />
              <h2 className="text-muted-fg font-mono text-[10px] uppercase tracking-wider">
                Portfolio
              </h2>
            </div>
            <Link
              href={`/${slug}/brands`}
              className="text-accent font-mono text-[10px] hover:underline"
            >
              View all →
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {topBrands.map((brand) => {
              const colorClass = getHealthColor(brand.healthScore);
              return (
                <Link
                  key={brand.id}
                  href={`/${slug}/brands/${brand.id}`}
                  className="border-border bg-surface hover:border-accent/40 group rounded-[8px] border p-4 transition-colors duration-150"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-fg group-hover:text-accent truncate text-sm font-semibold">
                        {brand.name}
                      </p>
                      <p className="text-muted-fg font-mono text-[10px]">{brand.domain}</p>
                    </div>
                    <span
                      className={`shrink-0 font-mono text-lg font-bold tabular-nums ${colorClass}`}
                    >
                      {brand.healthScore}
                    </span>
                  </div>
                  {brand.lastScannedAt && (
                    <p className="text-muted-fg mt-2 font-mono text-[10px]">
                      Scanned {Math.round((Date.now() - brand.lastScannedAt.getTime()) / 3_600_000)}
                      h ago
                    </p>
                  )}
                </Link>
              );
            })}
          </div>

          {brands.length === 0 && (
            <div className="border-border flex min-h-[120px] items-center justify-center rounded-[8px] border">
              <p className="text-muted-fg font-mono text-xs">
                No brands yet —{' '}
                <Link href={`/${slug}/research`} className="text-accent hover:underline">
                  run research
                </Link>{' '}
                to add your first.
              </p>
            </div>
          )}
        </div>

        {/* Right: Recent changes + last run */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Activity className="text-muted-fg h-3.5 w-3.5" />
            <h2 className="text-muted-fg font-mono text-[10px] uppercase tracking-wider">
              Recent Changes
            </h2>
            {changes && changes.totalEvents > 0 && (
              <span className="text-accent ml-auto font-mono text-[10px]">
                {changes.totalEvents}
              </span>
            )}
          </div>

          {!changes || changes.totalEvents === 0 ? (
            <div className="border-border flex min-h-[120px] items-center justify-center rounded-[8px] border">
              <p className="text-muted-fg font-mono text-xs">No changes in the last 14 days.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {changes.byBrand.slice(0, 8).flatMap((entry) =>
                entry.events.slice(0, 2).map((ev, j) => (
                  <Link
                    key={`${entry.brandId}-${j}`}
                    href={`/${slug}/brands/${entry.brandId}/changes`}
                    className="border-border bg-surface hover:border-accent/40 block rounded-[8px] border p-3 transition-colors duration-150"
                  >
                    <div className="flex items-center gap-2">
                      <span className="bg-surface-elevated text-muted-fg rounded px-1.5 font-mono text-[9px]">
                        {kindLabel(ev.kind)}
                      </span>
                      <span className="text-muted-fg ml-auto font-mono text-[9px]">
                        {new Date(ev.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                    <p className="text-muted-fg mt-1 font-mono text-[10px] font-medium">
                      {brandNameFromId(entry.brandId)}
                    </p>
                    {ev.after && (
                      <p className="text-fg mt-0.5 line-clamp-1 text-[10px]">{ev.after}</p>
                    )}
                  </Link>
                )),
              )}
            </div>
          )}

          {summary?.lastRun && (
            <div className="border-border bg-surface rounded-[8px] border p-3">
              <div className="flex items-center gap-2">
                <BarChart2 className="text-muted-fg h-3 w-3" />
                <span className="text-muted-fg font-mono text-[10px]">Last research run</span>
              </div>
              <p className="text-fg mt-1 text-xs font-medium">
                {brandNameFromId(summary.lastRun.brandId)}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className={`font-mono text-[10px] ${
                    summary.lastRun.status === 'done' ? 'text-accent' : 'text-muted-fg'
                  }`}
                >
                  {summary.lastRun.status}
                </span>
                {summary.lastRun.finishedAt && (
                  <span className="text-muted-fg font-mono text-[10px]">
                    ·{' '}
                    {new Date(summary.lastRun.finishedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                )}
              </div>
            </div>
          )}

          {summary && summary.strategicAlerts > 0 && (
            <div className="border-danger/30 bg-danger/5 flex items-center gap-3 rounded-[8px] border p-3">
              <Bell className="text-danger h-4 w-4 shrink-0" />
              <p className="text-fg text-sm">
                <span className="text-danger font-semibold">{summary.strategicAlerts}</span>{' '}
                strategic alert{summary.strategicAlerts !== 1 ? 's' : ''} pending
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
