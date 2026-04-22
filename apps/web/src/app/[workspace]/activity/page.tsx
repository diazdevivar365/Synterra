import { and, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { workspaceMembers, workspaces } from '@synterra/db';

import { getActivityFeed, type ActivityItem } from '@/lib/activity';
import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

interface Props {
  params: Promise<{ workspace: string }>;
}

const TYPE_LABELS: Record<ActivityItem['type'], string> = {
  run: 'Research',
  change: 'Change',
  fire: 'Alert',
};

const TYPE_COLORS: Record<ActivityItem['type'], string> = {
  run: 'bg-accent/10 text-accent',
  change: 'bg-purple-500/10 text-purple-400',
  fire: 'bg-orange-500/10 text-orange-400',
};

const STATUS_DOT: Record<ActivityItem['status'], string> = {
  ok: 'bg-accent',
  error: 'bg-danger',
  info: 'bg-muted-fg',
};

export default async function ActivityPage({ params }: Props) {
  const { workspace: slug } = await params;
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/workspaces');

  const ws = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaces.slug, slug), eq(workspaceMembers.userId, ctx.userId)))
    .then((r) => r[0] ?? null);
  if (!ws) redirect('/workspaces');

  const items = await getActivityFeed(ws.id, slug);

  const counts = { run: 0, change: 0, fire: 0 };
  for (const item of items) counts[item.type]++;

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8">
      <div className="mb-8">
        <h1 className="text-fg text-2xl font-bold">Activity Feed</h1>
        <p className="text-muted-fg font-mono text-xs">
          {items.length} events · {counts.run} runs · {counts.change} changes · {counts.fire} alerts
        </p>
      </div>

      {items.length === 0 ? (
        <div className="border-border flex min-h-[240px] items-center justify-center rounded-[8px] border">
          <p className="text-muted-fg font-mono text-sm">No activity yet.</p>
        </div>
      ) : (
        <div className="relative">
          <div className="bg-border absolute left-[7px] top-2 h-full w-px" />
          <div className="space-y-1">
            {items.map((item) => (
              <div key={item.id} className="relative flex gap-4 pb-4">
                <div
                  className={`border-bg relative z-10 mt-3.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 ${STATUS_DOT[item.status]}`}
                />
                {item.href ? (
                  <a
                    href={item.href}
                    className="border-border bg-surface hover:border-accent/40 flex-1 rounded-[8px] border p-3 transition-colors duration-150"
                  >
                    <ActivityCard item={item} />
                  </a>
                ) : (
                  <div className="border-border bg-surface flex-1 rounded-[8px] border p-3">
                    <ActivityCard item={item} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ActivityCard({ item }: { item: ActivityItem }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded px-1.5 py-0.5 font-mono text-[9px] ${TYPE_COLORS[item.type]}`}>
          {TYPE_LABELS[item.type]}
        </span>
        <span className="text-fg text-xs font-medium">{item.title}</span>
        <span className="text-muted-fg ml-auto font-mono text-[10px]">
          {new Date(item.date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
      {item.subtitle && (
        <p className="text-muted-fg mt-1 line-clamp-1 font-mono text-[10px]">{item.subtitle}</p>
      )}
    </>
  );
}
