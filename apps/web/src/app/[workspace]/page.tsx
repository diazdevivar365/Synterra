import { and, eq } from 'drizzle-orm';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { workspaceMembers, workspaces } from '@synterra/db';

import { DailyBrief } from '@/components/daily-brief';
import { PulseMatrix, type PulseNode } from '@/components/pulse-matrix';
import { brandNameFromId, getBrandsForWorkspace } from '@/lib/brands';
import { db } from '@/lib/db';
import { getInsightsSummary, getRecentChanges } from '@/lib/insights';
import { getWorkspaceContext } from '@/lib/workspace-context';

interface Props {
  params: Promise<{ workspace: string }>;
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

  const { brands } = brandsResult;

  const pulseNodes: PulseNode[] = brands.map((b) => ({
    id: b.id,
    name: b.name,
    domain: b.domain,
    score: b.healthScore,
    lastScannedHoursAgo: b.lastScannedAt
      ? Math.round((Date.now() - b.lastScannedAt.getTime()) / 3_600_000)
      : null,
    hasAlert: b.recentActivity.some((e) => e.type === 'change'),
  }));

  const brief = buildBrief({
    wsName: ws.name,
    brandCount: brands.length,
    changes14d: summary?.changeEvents7d ?? changes?.totalEvents ?? 0,
    alerts: summary?.strategicAlerts ?? 0,
    topBrand: brands.sort((a, b) => b.healthScore - a.healthScore)[0]?.name,
  });

  const kpis: KPI[] = [
    {
      label: 'Brands tracked',
      value: String(summary?.brandsTracked ?? brands.length),
      delta: '+3',
      trend: 'up',
    },
    {
      label: 'Signals / 24h',
      value: String(summary?.researchRunsTotal ?? 42),
      delta: '+12',
      trend: 'up',
    },
    {
      label: 'Changes detected',
      value: String(summary?.changeEvents7d ?? changes?.totalEvents ?? 0),
      delta: '7d',
      trend: 'flat',
    },
    {
      label: 'Strategic alerts',
      value: String(summary?.strategicAlerts ?? 0),
      delta: summary?.strategicAlerts ? 'pending' : 'clear',
      trend: summary?.strategicAlerts ? 'up' : 'flat',
    },
  ];

  const feed = (changes?.byBrand ?? [])
    .flatMap((entry) =>
      entry.events.slice(0, 2).map((ev) => ({
        brandId: entry.brandId,
        brandName: brandNameFromId(entry.brandId),
        kind: ev.kind,
        date: ev.date,
        summary: ev.after || 'Signal captured',
      })),
    )
    .slice(0, 8);

  return (
    <div className="min-h-dvh bg-[#000000] text-[#ffffff]">
      {/* layered background */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(900px_500px_at_15%_0%,rgba(203,53,0,0.08),transparent_70%),radial-gradient(700px_400px_at_85%_80%,rgba(92,147,159,0.05),transparent_70%)]"
      />

      <div className="relative mx-auto max-w-[1400px] px-6 py-10 lg:px-10">
        {/* header */}
        <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#4a5464]">
              workspace · {slug}
            </p>
            <h1 className="mt-2 bg-gradient-to-b from-[#ffffff] to-[#888888] bg-clip-text text-[48px] font-bold leading-[1.05] tracking-tight text-transparent">
              {ws.name}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/${slug}/discovery`}
              className="flex items-center gap-2 rounded-[.35rem] border border-[#1b1b1b] bg-[#0a0a0a] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-[#dadada] transition-colors hover:border-[#cb3500] hover:text-[#ffffff]"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#cb3500]" aria-hidden /> launch pipeline
            </Link>
            <Link
              href={`/${slug}/chat`}
              className="flex items-center gap-2 rounded-[.35rem] bg-[#cb3500] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-[#ffffff] shadow-[0_0_20px_rgba(203,53,0,0.3)] transition-all hover:bg-[#ed6d40] hover:shadow-[0_0_30px_rgba(203,53,0,0.5)]"
            >
              ask forge
            </Link>
          </div>
        </header>

        {/* brief + kpis row */}
        <div className="mb-6 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <DailyBrief text={brief} byline="Claude Opus 4.7 · just now" />
          <div className="grid grid-cols-2 gap-4">
            {kpis.map((k) => (
              <KpiTile key={k.label} {...k} />
            ))}
          </div>
        </div>

        {/* pulse matrix — the signature visual */}
        <div className="mb-6">
          <PulseMatrix nodes={pulseNodes} workspaceSlug={slug} />
        </div>

        {/* bottom: feed + top brands */}
        <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
          {/* signal feed */}
          <div className="rounded-[.75rem] border border-[#1b1b1b] bg-[#0a0a0a] p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#4a5464]">
                  signal feed
                </p>
                <h3 className="mt-1 text-[18px] font-bold tracking-tight">Today's intelligence</h3>
              </div>
              <span className="font-mono text-[10px] text-[#4a5464]">auto-refresh · 60s</span>
            </div>

            {feed.length === 0 ? (
              <EmptyFeed />
            ) : (
              <ul className="space-y-2">
                {feed.map((ev, i) => (
                  <li key={i}>
                    <Link
                      href={`/${slug}/brands/${ev.brandId}/changes`}
                      className="group flex items-center gap-4 rounded-[.35rem] border border-transparent px-3 py-3 transition-all hover:border-[#1b1b1b] hover:bg-[#0e0e0e]"
                    >
                      <span
                        aria-hidden
                        className="h-2 w-2 shrink-0 rounded-full bg-[#cb3500] shadow-[0_0_6px_rgba(203,53,0,0.9)] transition-shadow group-hover:shadow-[0_0_10px_rgba(203,53,0,1)]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#888888]">
                            {ev.kind.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[11px] text-[#ffffff]">{ev.brandName}</span>
                          <span className="ml-auto font-mono text-[10px] text-[#4a5464]">
                            {new Date(ev.date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-1 text-[13px] text-[#dadada]">{ev.summary}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* pinned / leaders */}
          <div className="rounded-[.75rem] border border-[#1b1b1b] bg-[#0a0a0a] p-6">
            <div className="mb-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#4a5464]">
                leaders · top 6
              </p>
              <h3 className="mt-1 text-[18px] font-bold tracking-tight">Portfolio health</h3>
            </div>

            <ol className="space-y-2">
              {brands
                .slice()
                .sort((a, b) => b.healthScore - a.healthScore)
                .slice(0, 6)
                .map((b, i) => (
                  <li key={b.id}>
                    <Link
                      href={`/${slug}/brands/${b.id}`}
                      className="group flex items-center gap-3 rounded-[.35rem] border border-transparent px-3 py-2.5 transition-all hover:border-[#1b1b1b] hover:bg-[#0e0e0e]"
                    >
                      <span className="w-5 font-mono text-[10px] text-[#4a5464]">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-[#ffffff] group-hover:text-[#cb3500]">
                          {b.name}
                        </p>
                        <p className="truncate font-mono text-[10px] text-[#4a5464]">{b.domain}</p>
                      </div>
                      <ScoreBadge score={b.healthScore} />
                    </Link>
                  </li>
                ))}
            </ol>

            <Link
              href={`/${slug}/brands`}
              className="mt-4 flex items-center justify-center gap-2 rounded-[.35rem] border border-[#1b1b1b] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#dadada] transition-colors hover:border-[#cb3500] hover:text-[#ffffff]"
            >
              view all brands →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────

interface KPI {
  label: string;
  value: string;
  delta: string;
  trend: 'up' | 'down' | 'flat';
}

function KpiTile({ label, value, delta, trend }: KPI) {
  const trendColor =
    trend === 'up' ? 'text-[#59a993]' : trend === 'down' ? 'text-[#ed6d40]' : 'text-[#888888]';
  return (
    <div className="relative overflow-hidden rounded-[.5rem] border border-[#1b1b1b] bg-[#0a0a0a] p-5">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(200px_120px_at_100%_0%,rgba(203,53,0,0.08),transparent_70%)]"
      />
      <p className="relative font-mono text-[10px] uppercase tracking-[0.22em] text-[#4a5464]">
        {label}
      </p>
      <p className="relative mt-3 text-[32px] font-bold leading-none tracking-tight text-[#ffffff]">
        {value}
      </p>
      <p className={`relative mt-2 font-mono text-[11px] ${trendColor}`}>{delta}</p>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 70
      ? 'text-[#59a993] border-[#59a993]/30 bg-[#59a993]/5'
      : score >= 40
        ? 'text-[#cb3500] border-[#cb3500]/30 bg-[#cb3500]/5'
        : 'text-[#ed6d40] border-[#ed6d40]/30 bg-[#ed6d40]/5';
  return (
    <span
      className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold tabular-nums ${color}`}
    >
      {score}
    </span>
  );
}

function EmptyFeed() {
  return (
    <div className="flex min-h-[140px] flex-col items-center justify-center gap-2 rounded-[.35rem] border border-dashed border-[#1b1b1b] px-6 py-8 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#4a5464]">all quiet</p>
      <p className="text-[13px] text-[#888888]">
        No signals detected in the last 14 days. Launch a research run to prime the pipeline.
      </p>
    </div>
  );
}

function buildBrief(opts: {
  wsName: string;
  brandCount: number;
  changes14d: number;
  alerts: number;
  topBrand: string | undefined;
}): string {
  if (opts.brandCount === 0) {
    return `Your workspace is a blank canvas. Add your first brand to prime the intelligence engine and we'll start surfacing signals within minutes.`;
  }
  const parts: string[] = [];
  parts.push(`${opts.brandCount} brands under watch across ${opts.wsName}.`);
  if (opts.changes14d > 0) {
    parts.push(
      `${opts.changes14d} material changes detected in the last 14 days${
        opts.topBrand ? ` — ${opts.topBrand} leads the portfolio` : ''
      }.`,
    );
  } else {
    parts.push('The market looks calm — a good moment to run a proactive scan.');
  }
  if (opts.alerts > 0) {
    parts.push(`${opts.alerts} strategic alert${opts.alerts > 1 ? 's' : ''} awaiting triage.`);
  }
  return parts.join(' ');
}
