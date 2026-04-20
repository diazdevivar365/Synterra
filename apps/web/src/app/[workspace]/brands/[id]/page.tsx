import { and, eq } from 'drizzle-orm';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { workspaceMembers, workspaces } from '@synterra/db';

import { ActivityFeed } from '@/components/activity-feed';
import { DnaRadar } from '@/components/dna-radar';
import { StatCard } from '@/components/stat-card';
import { getBrandById } from '@/lib/brands';
import { brandInitials, getHealthColor, getHealthLabel } from '@/lib/brand-utils';
import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

interface Props {
  params: Promise<{ workspace: string; id: string }>;
}

const DIMENSION_META = [
  { key: 'voiceClarity'        as const, label: 'Voice Clarity',       desc: 'How consistently and clearly the brand communicates its core message.' },
  { key: 'toneConsistency'     as const, label: 'Tone Consistency',     desc: 'Alignment of emotional tone across all brand touchpoints.' },
  { key: 'marketPresence'      as const, label: 'Market Presence',      desc: 'Visibility and share-of-voice in target market segments.' },
  { key: 'competitivePosition' as const, label: 'Competitive Position', desc: 'Differentiation strength relative to direct competitors.' },
  { key: 'audienceAlignment'   as const, label: 'Audience Alignment',   desc: 'Resonance with intended customer personas and segments.' },
  { key: 'visualIdentity'      as const, label: 'Visual Identity',      desc: 'Coherence and recognition strength of visual brand elements.' },
];

export default async function BrandDetailPage({ params }: Props) {
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

  const result = await getBrandById(ws.id, id);
  if (!result) notFound();

  const { brand, fromSeed } = result;
  const colorClass = getHealthColor(brand.healthScore);
  const healthLabel = getHealthLabel(brand.healthScore);

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8">
      {fromSeed && (
        <div className="mb-6 rounded-[8px] border border-border bg-surface px-4 py-3">
          <p className="font-mono text-xs text-muted-fg">
            Connecting to intelligence engine — showing example data.
          </p>
        </div>
      )}

      {/* Brand header */}
      <div className="mb-8">
        <Link
          href={`/${slug}/brands`}
          className="mb-4 inline-flex items-center gap-1.5 font-mono text-xs text-muted-fg transition-colors duration-150 hover:text-fg"
        >
          <ArrowLeft className="h-3 w-3" />
          Brands
        </Link>
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[8px] bg-surface-elevated text-base font-bold text-accent">
            {brandInitials(brand.name)}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-fg">{brand.name}</h1>
            <p className="font-mono text-xs text-muted-fg">{brand.domain}</p>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-[65%_1fr]">
        {/* ── Left: DNA Panel ── */}
        <div className="space-y-4">
          <div className="rounded-[8px] border border-border bg-surface p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-base font-semibold text-fg">Brand DNA</h2>
              {brand.lastScannedAt && (
                <span className="font-mono text-[10px] text-muted-fg">
                  Analyzed{' '}
                  {Math.round((Date.now() - brand.lastScannedAt.getTime()) / 3_600_000)}h ago
                </span>
              )}
            </div>
            <div className="flex justify-center">
              <DnaRadar scores={brand.dna} />
            </div>
          </div>

          {/* Dimension breakdown */}
          <div className="space-y-2">
            {DIMENSION_META.map(({ key, label, desc }) => {
              const score = brand.dna[key];
              const strong = score >= 70;
              return (
                <div
                  key={key}
                  className="flex items-center gap-4 rounded-[8px] border border-border bg-surface px-4 py-3"
                >
                  <span
                    className={`shrink-0 rounded-[4px] px-2 py-0.5 font-mono text-xs font-medium ${
                      strong
                        ? 'bg-accent text-white'
                        : 'border border-border text-muted-fg'
                    }`}
                  >
                    {score}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-fg">{label}</p>
                    <p className="truncate text-xs text-muted-fg">{desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Right: Intelligence sidebar ── */}
        <div className="space-y-4">
          {/* Health score */}
          <div className="rounded-[8px] border border-border bg-surface p-6 text-center">
            <p className={`font-mono text-5xl font-bold tabular-nums ${colorClass}`}>
              {brand.healthScore}
            </p>
            <p className="mt-1 text-xs text-muted-fg">DNA Health Score</p>
            <span
              className={`mt-3 inline-block rounded-[4px] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${
                colorClass === 'text-accent'
                  ? 'bg-accent/10 text-accent'
                  : colorClass === 'text-danger'
                    ? 'bg-danger/10 text-danger'
                    : 'bg-surface-elevated text-muted-fg'
              }`}
            >
              {healthLabel}
            </span>
          </div>

          {/* Stats */}
          <StatCard label="Competitors tracked" value={brand.competitors.length} />
          <StatCard label="Research runs" value="—" sub="Connect Aquila to track" />

          {/* Top competitors */}
          {brand.competitors.length > 0 && (
            <div className="rounded-[8px] border border-border bg-surface p-4">
              <h3 className="mb-3 font-mono text-[10px] uppercase tracking-wider text-muted-fg">
                Top Competitors
              </h3>
              <div className="space-y-2">
                {brand.competitors.slice(0, 3).map((c, i) => (
                  <div key={c.id} className="flex items-center gap-3">
                    <span className="font-mono text-[10px] text-muted-fg">#{i + 1}</span>
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-elevated text-[10px] font-bold text-muted-fg">
                      {brandInitials(c.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-fg">{c.name}</p>
                      <p className="font-mono text-[10px] text-muted-fg">{c.domain}</p>
                    </div>
                    <span className="shrink-0 font-mono text-xs text-muted-fg">
                      {c.positionScore}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activity */}
          <div className="rounded-[8px] border border-border bg-surface p-4">
            <h3 className="mb-3 font-mono text-[10px] uppercase tracking-wider text-muted-fg">
              Recent Activity
            </h3>
            <ActivityFeed events={brand.recentActivity} max={8} />
          </div>
        </div>
      </div>
    </div>
  );
}
