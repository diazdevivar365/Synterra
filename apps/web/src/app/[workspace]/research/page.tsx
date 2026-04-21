import { FlaskConical, Plus } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { buttonVariants, cn } from '@synterra/ui';

import { getResearchRuns, type RunStatus } from '@/lib/research';
import { getWorkspaceContext } from '@/lib/workspace-context';

interface Props {
  params: Promise<{ workspace: string }>;
}

function statusBadge(status: RunStatus) {
  const map: Record<RunStatus, { label: string; cls: string }> = {
    queued: { label: 'queued', cls: 'border-border text-muted-fg border' },
    running: { label: 'running', cls: 'bg-accent/10 text-accent' },
    done: { label: 'done', cls: 'bg-accent text-white' },
    error: { label: 'error', cls: 'bg-danger/10 text-danger' },
    cancelled: { label: 'cancelled', cls: 'border-border text-muted-fg border' },
  };
  const { label, cls } = map[status];
  return (
    <span
      className={`rounded-[4px] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${cls}`}
    >
      {label}
    </span>
  );
}

function elapsedLabel(from: string, to: string | null): string {
  const start = new Date(from).getTime();
  const end = to ? new Date(to).getTime() : Date.now();
  const s = Math.round((end - start) / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.round(s / 60)}m`;
}

export default async function ResearchPage({ params }: Props) {
  const { workspace: slug } = await params;
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/workspaces');

  const { runs, fromSeed } = await getResearchRuns(ctx.workspaceId);

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8">
      {fromSeed && (
        <div className="border-border bg-surface mb-6 rounded-[8px] border px-4 py-3">
          <p className="text-muted-fg font-mono text-xs">
            Connecting to intelligence engine — showing example data.
          </p>
        </div>
      )}

      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-fg text-2xl font-bold">Research</h1>
          <p className="text-muted-fg mt-0.5 font-mono text-xs">
            {runs.length} run{runs.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href={`/${slug}/research/new`}
          className={cn(buttonVariants({ variant: 'default', size: 'sm' }), 'gap-1.5')}
        >
          <Plus className="h-3.5 w-3.5" />
          New run
        </Link>
      </div>

      {runs.length === 0 ? (
        <div className="border-border flex min-h-[240px] flex-col items-center justify-center gap-4 rounded-[8px] border">
          <FlaskConical className="text-muted-fg h-8 w-8" />
          <p className="text-muted-fg font-mono text-sm">
            No research runs yet — start one to analyse a brand.
          </p>
          <Link
            href={`/${slug}/research/new`}
            className={buttonVariants({ variant: 'default', size: 'sm' })}
          >
            New run
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {runs.map((run) => (
            <Link
              key={run.runId}
              href={`/${slug}/research/${run.runId}`}
              className="border-border bg-surface hover:border-accent/40 flex items-center gap-4 rounded-[8px] border px-4 py-3 transition-colors duration-150"
            >
              <div className="min-w-0 flex-1">
                <p className="text-fg truncate font-mono text-sm">{run.url}</p>
                <p className="text-muted-fg font-mono text-[10px]">
                  {new Date(run.createdAt).toLocaleString()} ·{' '}
                  {elapsedLabel(run.createdAt, run.completedAt)}
                </p>
              </div>
              <div className="shrink-0">{statusBadge(run.status)}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
