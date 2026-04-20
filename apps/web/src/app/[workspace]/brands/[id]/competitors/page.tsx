import { and, eq } from 'drizzle-orm';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { workspaceMembers, workspaces } from '@synterra/db';

import { brandInitials } from '@/lib/brand-utils';
import { getBrandById } from '@/lib/brands';
import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

interface Props {
  params: Promise<{ workspace: string; id: string }>;
}

export default async function CompetitorsPage({ params }: Props) {
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

  const sorted = [...brand.competitors].sort((a, b) => b.positionScore - a.positionScore);

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8">
      {fromSeed && (
        <div className="mb-6 rounded-[8px] border border-border bg-surface px-4 py-3">
          <p className="font-mono text-xs text-muted-fg">
            Connecting to intelligence engine — showing example data.
          </p>
        </div>
      )}

      <div className="mb-8">
        <Link
          href={`/${slug}/brands/${id}`}
          className="mb-4 inline-flex items-center gap-1.5 font-mono text-xs text-muted-fg transition-colors duration-150 hover:text-fg"
        >
          <ArrowLeft className="h-3 w-3" />
          {brand.name}
        </Link>
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-bold text-fg">Competitors</h1>
          <span className="font-mono text-xs text-muted-fg">
            {sorted.length} tracked
          </span>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="flex min-h-[240px] items-center justify-center rounded-[8px] border border-border">
          <p className="font-mono text-sm text-muted-fg">
            No competitors tracked yet — connect Aquila to populate this list.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((c, i) => {
            const isLeader = c.positionScore >= 80;
            return (
              <div
                key={c.id}
                className="flex items-center gap-4 rounded-[8px] border border-border bg-surface px-4 py-3 transition-colors duration-150"
              >
                <span className="w-7 shrink-0 font-mono text-[10px] text-muted-fg">
                  #{i + 1}
                </span>

                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] bg-surface-elevated text-[11px] font-bold text-muted-fg">
                  {brandInitials(c.name)}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg">{c.name}</p>
                  <p className="font-mono text-[10px] text-muted-fg">{c.domain}</p>
                </div>

                <div className="flex flex-col items-end gap-0.5">
                  <span
                    className={`font-mono text-base font-bold tabular-nums ${
                      isLeader ? 'text-accent' : 'text-muted-fg'
                    }`}
                  >
                    {c.positionScore}
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-wider text-muted-fg">
                    position
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
