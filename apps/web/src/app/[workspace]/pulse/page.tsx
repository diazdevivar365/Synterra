import { and, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { workspaceMembers, workspaces } from '@synterra/db';

import { brandNameFromId } from '@/lib/brands';
import { db } from '@/lib/db';
import { getInsightsSummary, getRecentChanges } from '@/lib/insights';
import { getWorkspaceContext } from '@/lib/workspace-context';

interface Props {
  params: Promise<{ workspace: string }>;
}

function kindLabel(kind: string): string {
  return kind.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function kindColor(kind: string): string {
  if (kind.includes('messaging') || kind.includes('tone')) return 'text-accent bg-accent/10';
  if (kind.includes('visual') || kind.includes('palette') || kind.includes('logo'))
    return 'text-purple-400 bg-purple-500/10';
  if (kind.includes('product') || kind.includes('pricing'))
    return 'text-orange-400 bg-orange-500/10';
  if (kind.includes('social') || kind.includes('instagram') || kind.includes('twitter'))
    return 'text-pink-400 bg-pink-500/10';
  if (kind.includes('tech') || kind.includes('domain')) return 'text-teal-400 bg-teal-500/10';
  return 'text-muted-fg bg-surface-elevated';
}

interface FlatEvent {
  brandId: string;
  kind: string;
  before: string;
  after: string;
  date: string;
}

export default async function PulsePage({ params }: Props) {
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

  const [summary, changes] = await Promise.all([
    getInsightsSummary(ws.id),
    getRecentChanges(ws.id),
  ]);

  const events: FlatEvent[] = changes
    ? changes.byBrand.flatMap((b) => b.events.map((ev) => ({ brandId: b.brandId, ...ev })))
    : [];

  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const kindCounts: Record<string, number> = {};
  for (const ev of events) {
    kindCounts[ev.kind] = (kindCounts[ev.kind] ?? 0) + 1;
  }
  const topKinds = Object.entries(kindCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8">
      <div className="mb-8">
        <h1 className="text-fg text-2xl font-bold">Market Pulse</h1>
        <p className="text-muted-fg font-mono text-xs">
          {changes
            ? `${changes.totalEvents} changes · last ${changes.windowDays}d`
            : 'Brand change feed'}
        </p>
      </div>

      {/* Stats strip */}
      {summary && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="border-border bg-surface rounded-[8px] border p-3">
            <p className="text-muted-fg font-mono text-[10px] uppercase tracking-wider">Brands</p>
            <p className="text-fg mt-1 text-xl font-bold tabular-nums">{summary.brandsTracked}</p>
          </div>
          <div className="border-border bg-surface rounded-[8px] border p-3">
            <p className="text-muted-fg font-mono text-[10px] uppercase tracking-wider">
              Changes (7d)
            </p>
            <p className="text-fg mt-1 text-xl font-bold tabular-nums">{summary.changeEvents7d}</p>
          </div>
          <div className="border-border bg-surface rounded-[8px] border p-3">
            <p className="text-muted-fg font-mono text-[10px] uppercase tracking-wider">Runs</p>
            <p className="text-fg mt-1 text-xl font-bold tabular-nums">
              {summary.researchRunsDone}
            </p>
          </div>
          <div className="border-border bg-surface rounded-[8px] border p-3">
            <p className="text-muted-fg font-mono text-[10px] uppercase tracking-wider">Alerts</p>
            <p
              className={`mt-1 text-xl font-bold tabular-nums ${summary.strategicAlerts > 0 ? 'text-danger' : 'text-fg'}`}
            >
              {summary.strategicAlerts}
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_240px]">
        {/* Feed */}
        <div>
          {events.length === 0 ? (
            <div className="border-border flex min-h-[200px] items-center justify-center rounded-[8px] border">
              <p className="text-muted-fg font-mono text-xs">No changes in the last 14 days.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {events.map((ev, i) => (
                <a
                  key={i}
                  href={`/${slug}/brands/${ev.brandId}/changes`}
                  className="border-border bg-surface hover:border-accent/40 block rounded-[8px] border p-4 transition-colors duration-150"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono text-[9px] ${kindColor(ev.kind)}`}
                    >
                      {kindLabel(ev.kind)}
                    </span>
                    <span className="text-fg font-mono text-xs font-semibold">
                      {brandNameFromId(ev.brandId)}
                    </span>
                    <span className="text-muted-fg ml-auto font-mono text-[10px]">
                      {new Date(ev.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  {ev.after && <p className="text-fg mt-2 line-clamp-2 text-[11px]">{ev.after}</p>}
                  {ev.before && ev.after && (
                    <p className="text-muted-fg mt-1 line-clamp-1 text-[10px] line-through">
                      {ev.before}
                    </p>
                  )}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar: change type breakdown */}
        {topKinds.length > 0 && (
          <div>
            <div className="border-border bg-surface rounded-[8px] border p-4">
              <h3 className="text-muted-fg mb-4 font-mono text-[10px] uppercase tracking-wider">
                Top Change Types
              </h3>
              <div className="space-y-3">
                {topKinds.map(([kind, count]) => {
                  const pct = Math.round((count / events.length) * 100);
                  return (
                    <div key={kind}>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-fg font-mono text-[10px]">{kindLabel(kind)}</span>
                        <span className="text-muted-fg font-mono text-[10px]">{count}</span>
                      </div>
                      <div className="bg-surface-elevated h-1 overflow-hidden rounded-full">
                        <div
                          className="bg-accent h-full rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
