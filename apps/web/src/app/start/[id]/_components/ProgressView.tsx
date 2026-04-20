'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

type InflightStatus = 'pending' | 'running' | 'preview_ready' | 'claimed' | 'failed';

interface StatusEvent {
  status: InflightStatus;
  previewData: unknown;
  error: string | null;
}

interface Props {
  inflightId: string;
}

const STATUS_LABELS: Record<InflightStatus, string> = {
  pending: 'Queuing your analysis…',
  running: 'Analyzing your brand…',
  preview_ready: 'Preview ready!',
  claimed: 'All set — redirecting…',
  failed: 'Analysis failed.',
};

const STATUS_PROGRESS: Record<InflightStatus, number> = {
  pending: 10,
  running: 55,
  preview_ready: 100,
  claimed: 100,
  failed: 100,
};

export function ProgressView({ inflightId }: Props) {
  const [status, setStatus] = useState<InflightStatus>('pending');
  const [previewData, setPreviewData] = useState<unknown>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [isPending, startTransition] = useTransition();
  const esRef = useRef<EventSource | null>(null);
  const router = useRouter();

  useEffect(() => {
    const es = new EventSource(`/api/onboarding/${inflightId}/stream`);
    esRef.current = es;

    es.addEventListener('status', (e: MessageEvent) => {
      const data = JSON.parse(e.data as string) as StatusEvent;
      setStatus(data.status);
      if (data.previewData) setPreviewData(data.previewData);
    });

    es.addEventListener('error', (e: MessageEvent) => {
      const data = JSON.parse((e.data as string | undefined) ?? '{}') as { message?: string };
      setStreamError(data.message ?? 'An unexpected error occurred.');
      es.close();
    });

    es.onerror = () => {
      es.close();
    };

    return () => es.close();
  }, [inflightId]);

  const handleClaim = (e: React.SyntheticEvent) => {
    e.preventDefault();
    startTransition(() => {
      sessionStorage.setItem('pendingInflightId', inflightId);
      router.push(`/sign-in?email=${encodeURIComponent(email)}&inflight=${inflightId}`);
    });
  };

  return (
    <div className="space-y-8 text-center">
      <h2 className="text-2xl font-bold text-white">{STATUS_LABELS[status]}</h2>

      {status !== 'failed' && (
        <div className="h-2 w-full rounded-full bg-neutral-800">
          <div
            className="h-2 rounded-full bg-indigo-500 transition-all duration-700"
            style={{ width: `${STATUS_PROGRESS[status]}%` }}
          />
        </div>
      )}

      {(status === 'failed' || streamError) && (
        <p className="text-red-400">{streamError ?? 'Analysis failed. Please try again.'}</p>
      )}

      {status === 'preview_ready' && Boolean(previewData) && (
        <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-6 text-left">
          <h3 className="mb-3 text-lg font-semibold text-white">Brand Preview</h3>
          <pre className="overflow-auto whitespace-pre-wrap text-sm text-neutral-300">
            {JSON.stringify(previewData, null, 2)}
          </pre>
        </div>
      )}

      {status === 'preview_ready' && (
        <form onSubmit={handleClaim} className="flex flex-col gap-3">
          <p className="text-neutral-400">
            Enter your email to save this analysis and unlock the full report.
          </p>
          <div className="flex gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@yourcompany.com"
              className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
            >
              {isPending ? 'Sending…' : 'Get full report →'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
