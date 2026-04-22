import { and, eq } from 'drizzle-orm';
import { ArrowLeft, BarChart2, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { workspaceMembers, workspaces } from '@synterra/db';

import { StatCard } from '@/components/stat-card';
import { getBrandById, getBrandInstagram } from '@/lib/brands';
import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

interface Props {
  params: Promise<{ workspace: string; id: string }>;
}

function fmtNum(n: number | null): string {
  if (n === null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtUnixDate(ts: number | null): string {
  if (!ts) return '';
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default async function InstagramPage({ params }: Props) {
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

  const [brandResult, igData] = await Promise.all([
    getBrandById(ws.id, id),
    getBrandInstagram(ws.id, id),
  ]);
  if (!brandResult) notFound();

  const { brand, fromSeed } = brandResult;
  const profile = igData?.profile ?? null;
  const history = igData?.history ?? [];

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
          <h1 className="text-fg text-2xl font-bold">Instagram</h1>
          {profile?.scannedAt && (
            <span className="text-muted-fg font-mono text-xs">
              Scanned{' '}
              {new Date(profile.scannedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </span>
          )}
        </div>
      </div>

      {!profile ? (
        <div className="border-border flex min-h-[240px] items-center justify-center rounded-[8px] border">
          <p className="text-muted-fg font-mono text-sm">
            No Instagram data yet — trigger a scan from research settings.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Profile header */}
          <div className="border-border bg-surface rounded-[8px] border p-6">
            <div className="flex items-start gap-4">
              {profile.profilePic && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.profilePic}
                  alt={profile.handle ?? ''}
                  className="h-14 w-14 rounded-full object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-fg text-lg font-semibold">
                    {profile.name ?? profile.handle}
                  </h2>
                  {profile.verified && (
                    <span className="bg-accent/10 text-accent rounded px-1.5 font-mono text-[10px]">
                      verified
                    </span>
                  )}
                  {profile.isBusinessAccount && (
                    <span className="bg-surface-elevated text-muted-fg rounded px-1.5 font-mono text-[10px]">
                      business
                    </span>
                  )}
                </div>
                {profile.handle && (
                  <p className="text-muted-fg font-mono text-xs">@{profile.handle}</p>
                )}
                {profile.bio && <p className="text-fg mt-2 text-sm">{profile.bio}</p>}
                {profile.externalUrl && (
                  <a
                    href={profile.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent mt-1 inline-flex items-center gap-1 font-mono text-xs hover:underline"
                  >
                    {profile.externalUrl.replace(/^https?:\/\//, '')}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Followers" value={fmtNum(profile.followers)} />
            <StatCard label="Following" value={fmtNum(profile.following)} />
            <StatCard label="Posts" value={fmtNum(profile.postsCount)} />
            <StatCard
              label="Engagement"
              value={
                profile.engagementRate !== null
                  ? `${(profile.engagementRate * 100).toFixed(2)}%`
                  : '—'
              }
              {...(profile.postFrequencyDays !== null && {
                sub: `${profile.postFrequencyDays.toFixed(1)}d / post`,
              })}
            />
          </div>

          {/* Recent posts */}
          {profile.recentPosts.length > 0 && (
            <div>
              <h3 className="text-muted-fg mb-3 font-mono text-[10px] uppercase tracking-wider">
                Recent Posts
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {profile.recentPosts.slice(0, 9).map((post, i) => (
                  <div key={i} className="border-border bg-surface rounded-[8px] border p-3">
                    <div className="mb-2 flex items-center gap-3">
                      <span className="text-accent font-mono text-xs">♥ {fmtNum(post.likes)}</span>
                      <span className="text-muted-fg font-mono text-xs">
                        💬 {fmtNum(post.comments)}
                      </span>
                      {post.isVideo && (
                        <span className="text-muted-fg ml-auto font-mono text-[10px]">video</span>
                      )}
                    </div>
                    {post.caption && (
                      <p className="text-muted-fg line-clamp-3 text-xs">{post.caption}</p>
                    )}
                    {post.timestamp && (
                      <p className="text-muted-fg mt-2 font-mono text-[10px]">
                        {fmtUnixDate(post.timestamp)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Follower history bar chart */}
          {history.length > 1 && (
            <div className="border-border bg-surface rounded-[8px] border p-4">
              <div className="mb-3 flex items-center gap-2">
                <BarChart2 className="text-muted-fg h-3.5 w-3.5" />
                <h3 className="text-muted-fg font-mono text-[10px] uppercase tracking-wider">
                  Follower History
                </h3>
                <span className="text-muted-fg ml-auto font-mono text-[10px]">
                  {history.length} snapshots
                </span>
              </div>
              <div className="space-y-1.5">
                {history.slice(-10).map((pt, i) => {
                  const maxF = Math.max(...history.map((h) => h.followers ?? 0));
                  const pct = maxF > 0 && pt.followers !== null ? (pt.followers / maxF) * 100 : 0;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-muted-fg w-20 shrink-0 font-mono text-[10px]">
                        {new Date(pt.capturedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                      <div className="bg-surface-elevated h-2 flex-1 overflow-hidden rounded-full">
                        <div
                          className="bg-accent h-full rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-muted-fg w-12 shrink-0 text-right font-mono text-[10px]">
                        {fmtNum(pt.followers)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
