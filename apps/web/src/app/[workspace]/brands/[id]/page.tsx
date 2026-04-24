import { and, eq } from 'drizzle-orm';
import { ArrowLeft, Download, Pin, Sword } from 'lucide-react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { brandPins, workspaceMembers, workspaces } from '@synterra/db';

import { togglePin } from '@/actions/pins';
import { ActivityFeed } from '@/components/activity-feed';
import { BrandDnaPanel } from '@/components/brand-dna';
import { DnaRadar } from '@/components/dna-radar';
import { DnaTwinsPanel } from '@/components/dna-twins';
import { StatCard } from '@/components/stat-card';
import { brandInitials, getHealthColor, getHealthLabel } from '@/lib/brand-utils';
import { getBrandById, getBrandDnaTwins, getBrandQuality, getFullBrandDna } from '@/lib/brands';
import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

interface Props {
  params: Promise<{ workspace: string; id: string }>;
}

const DIMENSION_META = [
  {
    key: 'voiceClarity' as const,
    label: 'Voice Clarity',
    desc: 'How consistently and clearly the brand communicates its core message.',
  },
  {
    key: 'toneConsistency' as const,
    label: 'Tone Consistency',
    desc: 'Alignment of emotional tone across all brand touchpoints.',
  },
  {
    key: 'marketPresence' as const,
    label: 'Market Presence',
    desc: 'Visibility and share-of-voice in target market segments.',
  },
  {
    key: 'competitivePosition' as const,
    label: 'Competitive Position',
    desc: 'Differentiation strength relative to direct competitors.',
  },
  {
    key: 'audienceAlignment' as const,
    label: 'Audience Alignment',
    desc: 'Resonance with intended customer personas and segments.',
  },
  {
    key: 'visualIdentity' as const,
    label: 'Visual Identity',
    desc: 'Coherence and recognition strength of visual brand elements.',
  },
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

  const [result, fullDna, twins, quality, pinRow] = await Promise.all([
    getBrandById(ws.id, id),
    getFullBrandDna(ws.id, id),
    getBrandDnaTwins(ws.id, id),
    getBrandQuality(ws.id, id),
    db
      .select({ id: brandPins.id })
      .from(brandPins)
      .where(
        and(
          eq(brandPins.workspaceId, ws.id),
          eq(brandPins.userId, ctx.userId),
          eq(brandPins.brandId, id),
        ),
      )
      .limit(1)
      .then((r) => r[0] ?? null),
  ]);

  const pinned = pinRow !== null;
  if (!result) notFound();

  const { brand, fromSeed } = result;
  const colorClass = getHealthColor(brand.healthScore);
  const healthLabel = getHealthLabel(brand.healthScore);

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8">
      {fromSeed && (
        <div className="border-border bg-surface mb-6 rounded-[8px] border px-4 py-3">
          <p className="text-muted-fg font-mono text-xs">
            Connecting to intelligence engine — showing example data.
          </p>
        </div>
      )}

      {/* Brand header */}
      <div className="mb-8">
        <Link
          href={`/${slug}/brands`}
          className="text-muted-fg hover:text-fg mb-4 inline-flex items-center gap-1.5 font-mono text-xs transition-colors duration-150"
        >
          <ArrowLeft className="h-3 w-3" />
          Brands
        </Link>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-surface-elevated text-accent flex h-12 w-12 shrink-0 items-center justify-center rounded-[8px] text-base font-bold">
              {brandInitials(brand.name)}
            </div>
            <div>
              <h1 className="text-fg text-2xl font-bold">{brand.name}</h1>
              <p className="text-muted-fg font-mono text-xs">{brand.domain}</p>
            </div>
          </div>
          <nav className="flex items-center gap-3">
            <Link
              href={`/${slug}/brands/${id}/timeline`}
              className="text-muted-fg hover:text-fg font-mono text-xs transition-colors duration-150"
            >
              Timeline
            </Link>
            <Link
              href={`/${slug}/brands/${id}/instagram`}
              className="text-muted-fg hover:text-fg font-mono text-xs transition-colors duration-150"
            >
              Instagram
            </Link>
            <Link
              href={`/${slug}/brands/${id}/graph`}
              className="text-muted-fg hover:text-fg font-mono text-xs transition-colors duration-150"
            >
              Graph
            </Link>
            <Link
              href={`/${slug}/brands/${id}/changes`}
              className="text-muted-fg hover:text-fg font-mono text-xs transition-colors duration-150"
            >
              Changes
            </Link>
            <Link
              href={`/${slug}/brands/${id}/pricing`}
              className="text-muted-fg hover:text-fg font-mono text-xs transition-colors duration-150"
            >
              Pricing
            </Link>
            <Link
              href={`/${slug}/brands/${id}/ads`}
              className="text-muted-fg hover:text-fg font-mono text-xs transition-colors duration-150"
            >
              Ads
            </Link>
            <Link
              href={`/${slug}/brands/${id}/geo`}
              className="text-muted-fg hover:text-fg font-mono text-xs transition-colors duration-150"
            >
              Geo
            </Link>
            <Link
              href={`/${slug}/brands/${id}/comments`}
              className="text-muted-fg hover:text-fg font-mono text-xs transition-colors duration-150"
            >
              Comments
            </Link>
            <form action={togglePin}>
              <input type="hidden" name="workspace" value={slug} />
              <input type="hidden" name="brand_id" value={id} />
              <input type="hidden" name="pinned" value={String(pinned)} />
              <button
                type="submit"
                className={`bg-surface-elevated border-border hover:border-accent/60 inline-flex items-center gap-1.5 rounded border px-2.5 py-1 font-mono text-xs transition-colors duration-150 ${
                  pinned ? 'text-accent' : 'text-muted-fg'
                }`}
                title={pinned ? 'Unpin' : 'Pin'}
              >
                <Pin className={`h-3 w-3 ${pinned ? 'fill-current' : ''}`} />
                {pinned ? 'Pinned' : 'Pin'}
              </button>
            </form>
            <a
              href={`/api/${slug}/brands/${id}/briefing`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-surface-elevated border-border hover:border-accent/60 inline-flex items-center gap-1.5 rounded border px-2.5 py-1 font-mono text-xs transition-colors duration-150"
              title="Download briefing PDF"
            >
              <Download className="h-3 w-3" />
              Briefing
            </a>
            <a
              href={`/api/${slug}/brands/${id}/moodboard`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-surface-elevated border-border hover:border-accent/60 inline-flex items-center gap-1.5 rounded border px-2.5 py-1 font-mono text-xs transition-colors duration-150"
              title="Download moodboard PDF"
            >
              <Download className="h-3 w-3" />
              Moodboard
            </a>
            <Link
              href={`/${slug}/brands/${id}/battlecards`}
              className="bg-surface-elevated border-border hover:border-accent/60 inline-flex items-center gap-1.5 rounded border px-2.5 py-1 font-mono text-xs transition-colors duration-150"
              title="Manage battlecards"
            >
              <Sword className="h-3 w-3" />
              Battlecards
            </Link>
          </nav>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-[65%_1fr]">
        {/* ── Left: DNA Panel ── */}
        <div className="space-y-4">
          <div className="border-border bg-surface rounded-[8px] border p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-fg text-base font-semibold">Brand Dimension Radar</h2>
              {brand.lastScannedAt && (
                <span className="text-muted-fg font-mono text-[10px]">
                  Analyzed {Math.round((Date.now() - brand.lastScannedAt.getTime()) / 3_600_000)}h
                  ago
                </span>
              )}
            </div>
            <div className="flex justify-center">
              <DnaRadar scores={brand.dna} />
            </div>
          </div>

          <BrandDnaPanel dna={fullDna} />

          {/* Dimension breakdown */}
          <div className="space-y-2">
            {DIMENSION_META.map(({ key, label, desc }) => {
              const score = brand.dna[key];
              const strong = score >= 70;
              return (
                <div
                  key={key}
                  className="border-border bg-surface flex items-center gap-4 rounded-[8px] border px-4 py-3"
                >
                  <span
                    className={`shrink-0 rounded-[4px] px-2 py-0.5 font-mono text-xs font-medium ${
                      strong ? 'bg-accent text-white' : 'border-border text-muted-fg border'
                    }`}
                  >
                    {score}
                  </span>
                  <div className="min-w-0">
                    <p className="text-fg text-sm font-medium">{label}</p>
                    <p className="text-muted-fg truncate text-xs">{desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Right: Intelligence sidebar ── */}
        <div className="space-y-4">
          {/* Health score */}
          <div className="border-border bg-surface rounded-[8px] border p-6 text-center">
            <p className={`font-mono text-5xl font-bold tabular-nums ${colorClass}`}>
              {brand.healthScore}
            </p>
            <p className="text-muted-fg mt-1 text-xs">DNA Health Score</p>
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
            <div className="border-border bg-surface rounded-[8px] border p-4">
              <h3 className="text-muted-fg mb-3 font-mono text-[10px] uppercase tracking-wider">
                Top Competitors
              </h3>
              <div className="space-y-2">
                {brand.competitors.slice(0, 3).map((c, i) => (
                  <div key={c.id} className="flex items-center gap-3">
                    <span className="text-muted-fg font-mono text-[10px]">#{i + 1}</span>
                    <div className="bg-surface-elevated text-muted-fg flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[10px] font-bold">
                      {brandInitials(c.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-fg truncate text-xs font-medium">{c.name}</p>
                      <p className="text-muted-fg font-mono text-[10px]">{c.domain}</p>
                    </div>
                    <span className="text-muted-fg shrink-0 font-mono text-xs">
                      {c.positionScore}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quality audit */}
          {quality && Object.keys(quality).length > 0 && (
            <div className="border-border bg-surface rounded-[8px] border p-4">
              <h3 className="text-muted-fg mb-3 font-mono text-[10px] uppercase tracking-wider">
                Quality Audit
              </h3>
              <div className="space-y-2">
                {Object.entries(quality).map(([field, q]) => {
                  const dot =
                    q.status === 'ok'
                      ? 'bg-accent'
                      : q.status === 'issue'
                        ? 'bg-danger'
                        : 'bg-surface-elevated border-border border';
                  const auditedLabel = q.auditedAt
                    ? new Date(q.auditedAt).toLocaleDateString()
                    : null;
                  return (
                    <div key={field} className="flex items-start gap-2.5">
                      <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-fg text-xs font-medium capitalize">
                            {field.replace(/_/g, ' ')}
                          </p>
                          <span className="text-muted-fg shrink-0 font-mono text-[10px] uppercase">
                            {q.status}
                          </span>
                        </div>
                        {q.reason && (
                          <p className="text-muted-fg line-clamp-2 text-[10px]">{q.reason}</p>
                        )}
                        {q.actionTaken && (
                          <p className="text-muted-fg mt-0.5 text-[10px]">
                            <span className="font-mono uppercase">action:</span> {q.actionTaken}
                            {q.removedCount > 0 && (
                              <span className="text-muted-fg/70"> ({q.removedCount} removed)</span>
                            )}
                          </p>
                        )}
                        {(q.auditSource ?? auditedLabel) && (
                          <p className="text-muted-fg/70 mt-0.5 font-mono text-[9px]">
                            {q.auditSource ?? ''}
                            {q.auditSource && auditedLabel ? ' · ' : ''}
                            {auditedLabel ?? ''}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* DNA Twins */}
          {twins !== null && <DnaTwinsPanel twins={twins} workspaceId={ws.id} parentBrandId={id} />}

          {/* Activity */}
          <div className="border-border bg-surface rounded-[8px] border p-4">
            <h3 className="text-muted-fg mb-3 font-mono text-[10px] uppercase tracking-wider">
              Recent Activity
            </h3>
            <ActivityFeed events={brand.recentActivity} max={8} />
          </div>
        </div>
      </div>
    </div>
  );
}
