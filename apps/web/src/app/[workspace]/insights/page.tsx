import { and, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { workspaceMembers, workspaces } from '@synterra/db';

import { brandNameFromId } from '@/lib/brands';
import { db } from '@/lib/db';
import { getIndustryGaps, getInsightsClusters, getInsightsSummary } from '@/lib/insights';
import { getWorkspaceContext } from '@/lib/workspace-context';

interface Props {
  params: Promise<{ workspace: string }>;
}

const CLUSTER_COLORS = [
  'border-accent/40 bg-accent/5',
  'border-purple-500/40 bg-purple-500/5',
  'border-orange-500/40 bg-orange-500/5',
  'border-pink-500/40 bg-pink-500/5',
  'border-teal-500/40 bg-teal-500/5',
];

export default async function InsightsPage({ params }: Props) {
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

  const [summary, clusters, gaps] = await Promise.all([
    getInsightsSummary(ws.id),
    getInsightsClusters(ws.id),
    getIndustryGaps(ws.id),
  ]);

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8">
      <div className="mb-8">
        <h1 className="text-fg text-2xl font-bold">Insights</h1>
        <p className="text-muted-fg font-mono text-xs">
          {summary
            ? `${summary.brandsTracked} brands · ${summary.changeEvents7d} changes (7d)`
            : 'Portfolio analysis'}
        </p>
      </div>

      <div className="space-y-8">
        {/* DNA Clusters */}
        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-fg text-base font-semibold">DNA Clusters</h2>
            {clusters && (
              <span className="text-muted-fg font-mono text-xs">
                {clusters.totalBrands} brands · {clusters.k} groups
              </span>
            )}
          </div>

          {!clusters ? (
            <div className="border-border flex min-h-[120px] items-center justify-center rounded-[8px] border">
              <p className="text-muted-fg font-mono text-xs">
                Need ≥3 brands with DNA embeddings to compute clusters.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {clusters.clusters.map((cluster, i) => (
                <div
                  key={cluster.clusterId}
                  className={`rounded-[8px] border p-4 ${CLUSTER_COLORS[i % CLUSTER_COLORS.length]}`}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-muted-fg font-mono text-[10px] uppercase tracking-wider">
                      Cluster {i + 1}
                    </span>
                    <span className="text-muted-fg font-mono text-xs">{cluster.size}</span>
                  </div>
                  {cluster.commonTones.length > 0 && (
                    <p className="text-fg mb-2 text-xs font-medium">
                      {cluster.commonTones.slice(0, 2).join(' · ')}
                    </p>
                  )}
                  {cluster.commonIndustries.length > 0 && (
                    <p className="text-muted-fg mb-3 font-mono text-[10px]">
                      {cluster.commonIndustries.join(', ')}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {cluster.members.slice(0, 6).map((bid) => (
                      <a
                        key={bid}
                        href={`/${slug}/brands/${bid}`}
                        className="bg-surface text-fg hover:text-accent rounded-[4px] px-2 py-0.5 font-mono text-[10px]"
                      >
                        {brandNameFromId(bid)}
                      </a>
                    ))}
                    {cluster.members.length > 6 && (
                      <span className="text-muted-fg font-mono text-[10px]">
                        +{cluster.members.length - 6}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Industry Coverage */}
        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-fg text-base font-semibold">Industry Coverage</h2>
            {gaps && (
              <span className="text-muted-fg font-mono text-xs">
                {gaps.industriesWithCoverage} industries
              </span>
            )}
          </div>

          {!gaps || gaps.items.length === 0 ? (
            <div className="border-border flex min-h-[120px] items-center justify-center rounded-[8px] border">
              <p className="text-muted-fg font-mono text-xs">
                Need ≥2 brands per industry with DNA to show gaps.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {gaps.items.slice(0, 8).map((item) => (
                <div
                  key={item.industry}
                  className="border-border bg-surface rounded-[8px] border p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-4">
                    <h3 className="text-fg text-sm font-semibold capitalize">{item.industry}</h3>
                    <span className="text-muted-fg font-mono text-[10px]">
                      {item.brands.length} brand{item.brands.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {item.brands.map((bid) => (
                      <a
                        key={bid}
                        href={`/${slug}/brands/${bid}`}
                        className="border-border bg-surface-elevated text-fg hover:text-accent rounded-[4px] border px-2 py-0.5 font-mono text-[10px]"
                      >
                        {brandNameFromId(bid)}
                      </a>
                    ))}
                  </div>
                  {item.tonesCovered.length > 0 && (
                    <div className="mt-3">
                      <p className="text-muted-fg mb-1.5 font-mono text-[9px] uppercase tracking-wider">
                        Tones covered
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {item.tonesCovered.slice(0, 5).map((tone) => (
                          <span
                            key={tone}
                            className="bg-surface-elevated text-muted-fg rounded px-1.5 py-0.5 font-mono text-[9px]"
                          >
                            {tone}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {item.dominantTech.length > 0 && (
                    <div className="mt-2">
                      <p className="text-muted-fg mb-1.5 font-mono text-[9px] uppercase tracking-wider">
                        Common tech
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {item.dominantTech.slice(0, 5).map((tech) => (
                          <span
                            key={tech}
                            className="bg-accent/10 text-accent rounded px-1.5 py-0.5 font-mono text-[9px]"
                          >
                            {tech}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
