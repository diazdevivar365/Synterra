import { and, eq } from 'drizzle-orm';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { workspaceMembers, workspaces } from '@synterra/db';

import { ChangeEventCard } from '@/components/change-event-card';
import { getBrandChanges } from '@/lib/brand-changes';
import { getBrandById } from '@/lib/brands';
import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

interface Props {
  params: Promise<{ workspace: string; id: string }>;
}

export default async function ChangesPage({ params }: Props) {
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

  const brandResult = await getBrandById(ws.id, id);
  if (!brandResult) notFound();

  const { brand, fromSeed } = brandResult;
  const changes = await getBrandChanges(ws.id, id, 50);

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
          <h1 className="text-2xl font-bold text-fg">Change Feed</h1>
          <span className="font-mono text-xs text-muted-fg">
            {changes.length} event{changes.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {changes.length === 0 ? (
        <div className="flex min-h-[240px] items-center justify-center rounded-[8px] border border-border">
          <p className="font-mono text-sm text-muted-fg">
            No change events yet — send a webhook from Aquila to populate this feed.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {changes.map((event) => (
            <ChangeEventCard
              key={event.id}
              id={event.id}
              eventType={event.eventType}
              severity={event.severity}
              title={event.title}
              description={event.description}
              occurredAt={event.occurredAt}
            />
          ))}
        </div>
      )}
    </div>
  );
}
