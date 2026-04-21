import { ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { RunProgress } from '@/components/run-progress';
import { getResearchRunById } from '@/lib/research';
import { getWorkspaceContext } from '@/lib/workspace-context';

interface Props {
  params: Promise<{ workspace: string; runId: string }>;
}

export default async function RunDetailPage({ params }: Props) {
  const { workspace: slug, runId } = await params;
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/workspaces');

  const result = await getResearchRunById(runId);
  if (!result) notFound();

  const { run, fromSeed } = result;
  const isLive = run.status === 'queued' || run.status === 'running';
  const isDone = run.status === 'done';
  const isError = run.status === 'error';

  return (
    <div className="mx-auto max-w-[800px] px-6 py-8">
      {fromSeed && (
        <div className="border-border bg-surface mb-6 rounded-[8px] border px-4 py-3">
          <p className="text-muted-fg font-mono text-xs">
            Connecting to intelligence engine — showing example data.
          </p>
        </div>
      )}

      <Link
        href={`/${slug}/research`}
        className="text-muted-fg hover:text-fg mb-6 inline-flex items-center gap-1.5 font-mono text-xs transition-colors duration-150"
      >
        <ArrowLeft className="h-3 w-3" />
        Research
      </Link>

      <div className="mb-6">
        <h1 className="text-fg break-all font-mono text-lg font-bold">{run.url}</h1>
        <p className="text-muted-fg mt-1 font-mono text-[10px]">
          Run {run.runId} · started {new Date(run.createdAt).toLocaleString()}
        </p>
      </div>

      <div className="border-border bg-surface rounded-[8px] border p-6">
        {isLive && (
          <>
            <h2 className="text-fg mb-4 text-sm font-semibold">Live Progress</h2>
            <RunProgress runId={runId} />
          </>
        )}

        {isDone && (
          <div className="flex items-center gap-3">
            <CheckCircle className="text-accent h-5 w-5 shrink-0" />
            <div>
              <p className="text-fg text-sm font-medium">Analysis complete</p>
              <p className="text-muted-fg font-mono text-xs">
                Finished {run.completedAt ? new Date(run.completedAt).toLocaleString() : '—'}
              </p>
            </div>
            {run.brandId && (
              <Link
                href={`/${slug}/brands/${run.brandId}`}
                className="text-accent ml-auto font-mono text-xs hover:underline"
              >
                View brand →
              </Link>
            )}
          </div>
        )}

        {isError && (
          <div className="flex items-center gap-3">
            <XCircle className="text-danger h-5 w-5 shrink-0" />
            <div>
              <p className="text-fg text-sm font-medium">Run failed</p>
              <p className="text-muted-fg font-mono text-xs">
                {run.completedAt ? new Date(run.completedAt).toLocaleString() : '—'}
              </p>
            </div>
            <Link
              href={`/${slug}/research/new`}
              className="text-accent ml-auto font-mono text-xs hover:underline"
            >
              Retry →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
