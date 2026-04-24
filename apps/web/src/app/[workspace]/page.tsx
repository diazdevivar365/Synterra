import { and, eq } from 'drizzle-orm';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { workspaceMembers, workspaces } from '@synterra/db';

import { DailyBrief } from '@/components/daily-brief';
import { PulseMatrix, type PulseNode } from '@/components/pulse-matrix';
import { getBrandsForWorkspace } from '@/lib/brands';
import { getCommandCenter } from '@/lib/command-center';
import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

import type { CommandCenter, KpiTrend } from '@synterra/aquila-client';

type WorkspaceBrands = Awaited<ReturnType<typeof getBrandsForWorkspace>>['brands'];

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

  const [cc, brandsResult] = await Promise.all([
    getCommandCenter(ws.id),
    getBrandsForWorkspace(ws.id),
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

  return (
    <div className="min-h-dvh bg-[#000000] text-[#ffffff]">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(900px_500px_at_15%_0%,rgba(203,53,0,0.08),transparent_70%),radial-gradient(700px_400px_at_85%_80%,rgba(92,147,159,0.05),transparent_70%)]"
      />

      <div className="relative mx-auto max-w-[1400px] px-6 py-10 lg:px-10">
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

        {cc ? (
          <DashboardHero cc={cc} slug={slug} />
        ) : (
          <DisconnectedBanner slug={slug} brandCount={brands.length} wsName={ws.name} />
        )}

        <div className="mb-6 mt-6">
          <PulseMatrix nodes={pulseNodes} workspaceSlug={slug} />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
          <SignalFeed cc={cc} slug={slug} brandNameLookup={buildBrandNameLookup(brands)} />
          <LeadersColumn cc={cc} brands={brands} slug={slug} />
        </div>

        {cc && cc.riskRadar.length > 0 && (
          <div className="mt-6">
            <RiskRadar cc={cc} slug={slug} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── sections ───────────────────────────────────────────────────────────────

function DashboardHero({ cc, slug: _slug }: { cc: CommandCenter; slug: string }) {
  const kpis: KpiEntry[] = [
    { label: 'Brands tracked', trend: cc.kpis.brandsTracked },
    { label: 'Changes · 24h', trend: cc.kpis.changes24h },
    { label: 'Runs · 7d', trend: cc.kpis.runs7d },
    { label: 'Risk brands', trend: cc.kpis.riskBrands },
  ];
  const byline = `Aquila · ${formatTs(cc.generatedAt)}`;
  return (
    <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
      <DailyBrief text={cc.dailyBrief} byline={byline} />
      <div className="grid grid-cols-2 gap-4">
        {kpis.map((k) => (
          <KpiTile key={k.label} {...k} />
        ))}
      </div>
    </div>
  );
}

function DisconnectedBanner({
  slug,
  brandCount,
  wsName,
}: {
  slug: string;
  brandCount: number;
  wsName: string;
}) {
  return (
    <div className="rounded-[.75rem] border border-dashed border-[#cb3500]/40 bg-[#0a0a0a] p-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#cb3500]">
        aquila · not connected
      </p>
      <p className="mt-2 text-[18px] font-semibold text-[#ffffff]">
        {brandCount > 0
          ? `${brandCount} brands listadas en ${wsName}, pero falta conectar Aquila para ver intelligence en vivo.`
          : `Conectá Aquila para empezar a recibir daily briefs + change events en ${wsName}.`}
      </p>
      <Link
        href={`/${slug}/settings/integrations`}
        className="mt-4 inline-flex items-center gap-2 rounded-[.35rem] bg-[#cb3500] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-[#ffffff] shadow-[0_0_20px_rgba(203,53,0,0.3)] transition-all hover:bg-[#ed6d40]"
      >
        conectar aquila →
      </Link>
    </div>
  );
}

function SignalFeed({
  cc,
  slug,
  brandNameLookup,
}: {
  cc: CommandCenter | null;
  slug: string;
  brandNameLookup: (id: string) => string;
}) {
  const items = (cc?.activityFeed ?? []).slice(0, 8);
  return (
    <div className="rounded-[.75rem] border border-[#1b1b1b] bg-[#0a0a0a] p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#4a5464]">
            signal feed
          </p>
          <h3 className="mt-1 text-[18px] font-bold tracking-tight">Today&apos;s intelligence</h3>
        </div>
        <span className="font-mono text-[10px] text-[#4a5464]">auto-refresh · 60s</span>
      </div>

      {items.length === 0 ? (
        <EmptyFeed />
      ) : (
        <ul className="space-y-2">
          {items.map((ev, i) => {
            const label = ev.type === 'change' ? (ev.kind ?? 'change') : (ev.status ?? 'run_done');
            return (
              <li key={`${ev.brandId}-${i}`}>
                <Link
                  href={`/${slug}/brands/${ev.brandId}${ev.type === 'change' ? '/changes' : ''}`}
                  className="group flex items-center gap-4 rounded-[.35rem] border border-transparent px-3 py-3 transition-all hover:border-[#1b1b1b] hover:bg-[#0e0e0e]"
                >
                  <span
                    aria-hidden
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      ev.type === 'change'
                        ? 'bg-[#cb3500] shadow-[0_0_6px_rgba(203,53,0,0.9)] group-hover:shadow-[0_0_10px_rgba(203,53,0,1)]'
                        : 'bg-[#59a993] shadow-[0_0_6px_rgba(89,169,147,0.9)]'
                    } transition-shadow`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#888888]">
                        {label.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[11px] text-[#ffffff]">
                        {brandNameLookup(ev.brandId)}
                      </span>
                      <span className="ml-auto font-mono text-[10px] text-[#4a5464]">
                        {ev.ts
                          ? new Date(ev.ts).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })
                          : '—'}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function LeadersColumn({
  cc,
  brands,
  slug,
}: {
  cc: CommandCenter | null;
  brands: WorkspaceBrands;
  slug: string;
}) {
  const pinned = cc?.pinnedBrands ?? [];
  return (
    <div className="rounded-[.75rem] border border-[#1b1b1b] bg-[#0a0a0a] p-6">
      <div className="mb-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#4a5464]">
          pinned · top 6
        </p>
        <h3 className="mt-1 text-[18px] font-bold tracking-tight">Portfolio leaders</h3>
      </div>

      {pinned.length > 0 ? (
        <ol className="space-y-2">
          {pinned.slice(0, 6).map((b, i) => (
            <li key={b.brandId}>
              <Link
                href={`/${slug}/brands/${b.brandId}`}
                className="group flex items-center gap-3 rounded-[.35rem] border border-transparent px-3 py-2.5 transition-all hover:border-[#1b1b1b] hover:bg-[#0e0e0e]"
              >
                <span className="w-5 font-mono text-[10px] text-[#4a5464]">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-[#ffffff] group-hover:text-[#cb3500]">
                    {b.tagline ?? b.brandId}
                  </p>
                  <p className="truncate font-mono text-[10px] text-[#4a5464]">{b.url ?? '—'}</p>
                </div>
                {b.consistency !== null && <ScoreBadge score={b.consistency * 10} />}
              </Link>
            </li>
          ))}
        </ol>
      ) : (
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
      )}

      <Link
        href={`/${slug}/brands`}
        className="mt-4 flex items-center justify-center gap-2 rounded-[.35rem] border border-[#1b1b1b] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#dadada] transition-colors hover:border-[#cb3500] hover:text-[#ffffff]"
      >
        view all brands →
      </Link>
    </div>
  );
}

function RiskRadar({ cc, slug }: { cc: CommandCenter; slug: string }) {
  return (
    <div className="rounded-[.75rem] border border-[#1b1b1b] bg-[#0a0a0a] p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#ed6d40]">
            risk radar
          </p>
          <h3 className="mt-1 text-[18px] font-bold tracking-tight">Brands needing attention</h3>
        </div>
      </div>
      <ul className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
        {cc.riskRadar.map((r) => (
          <li key={r.brandId}>
            <Link
              href={`/${slug}/brands/${r.brandId}`}
              className="group flex items-center gap-3 rounded-[.35rem] border border-[#1b1b1b] bg-[#0e0e0e] px-3 py-2.5 transition-colors hover:border-[#ed6d40]"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-[#ffffff] group-hover:text-[#ed6d40]">
                  {r.tagline ?? r.brandId}
                </p>
                <p className="truncate font-mono text-[10px] text-[#4a5464]">
                  {r.reason} · {r.daysStale}d stale
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── helpers ────────────────────────────────────────────────────────────────

interface KpiEntry {
  label: string;
  trend: KpiTrend;
}

function KpiTile({ label, trend }: KpiEntry) {
  const trendColor =
    trend.direction === 'up'
      ? 'text-[#59a993]'
      : trend.direction === 'down'
        ? 'text-[#ed6d40]'
        : 'text-[#888888]';
  const deltaLabel =
    trend.deltaPct === null ? '—' : `${trend.deltaPct > 0 ? '+' : ''}${trend.deltaPct.toFixed(1)}%`;
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
        {trend.value}
      </p>
      <p className={`relative mt-2 font-mono text-[11px] ${trendColor}`}>{deltaLabel}</p>
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
      {Math.round(score)}
    </span>
  );
}

function EmptyFeed() {
  return (
    <div className="flex min-h-[140px] flex-col items-center justify-center gap-2 rounded-[.35rem] border border-dashed border-[#1b1b1b] px-6 py-8 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#4a5464]">all quiet</p>
      <p className="text-[13px] text-[#888888]">
        No signals detected in the last 24 hours. Launch a research run to prime the pipeline.
      </p>
    </div>
  );
}

function buildBrandNameLookup(brands: WorkspaceBrands): (id: string) => string {
  const map = new Map(brands.map((b) => [b.id, b.name]));
  return (id: string) => map.get(id) ?? id;
}

function formatTs(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return 'just now';
  }
}
