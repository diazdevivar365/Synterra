'use client';

import { useEffect, useRef, useState } from 'react';

type Phase = 'url' | 'waiting' | 'sent';

const POLL_INTERVAL_MS = 3000;

const STEPS = [
  'Fetching homepage…',
  'Detecting brand tone…',
  'Identifying competitors…',
  'Building brand DNA…',
];

export default function StartPage() {
  const [phase, setPhase] = useState<Phase>('url');
  const [url, setUrl] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [researchReady, setResearchReady] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (phase !== 'waiting') return;
    const t = setInterval(() => {
      setStepIndex((i) => (i + 1 < STEPS.length ? i + 1 : i));
    }, 4000);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'waiting' || !sessionId) return;

    pollRef.current = setInterval(() => {
      void (async () => {
        try {
          const res = await fetch(`/api/start/${sessionId}/status`);
          if (!res.ok) return;
          const data = (await res.json()) as { status: string };
          if (data.status === 'ready' || data.status === 'claimed') {
            setResearchReady(true);
            if (pollRef.current) clearInterval(pollRef.current);
          }
        } catch {
          // ignore transient poll errors
        }
      })();
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [phase, sessionId]);

  async function handleUrlSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/start/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = (await res.json()) as { sessionId?: string; error?: string };
      if (!res.ok || !data.sessionId) {
        setError(data.error ?? 'Something went wrong — try again.');
        return;
      }
      setSessionId(data.sessionId);
      setPhase('waiting');
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/start/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, sessionId }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Failed to send link — try again.');
        return;
      }
      setPhase('sent');
    } finally {
      setLoading(false);
    }
  }

  if (phase === 'sent') {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-8">
        <div className="flex w-full max-w-sm flex-col gap-4 text-center">
          <p className="text-4xl">✉️</p>
          <h1 className="text-fg text-2xl font-semibold">Check your inbox</h1>
          <p className="text-muted-fg text-sm">
            We sent a sign-in link to <span className="text-fg font-medium">{email}</span>. Click it
            to finish setting up your workspace.
          </p>
          {researchReady && (
            <p className="text-brand-500 text-sm font-medium">
              ✓ Brand analysis complete — it&apos;ll be waiting when you sign in.
            </p>
          )}
        </div>
      </main>
    );
  }

  if (phase === 'waiting') {
    const currentStep = STEPS[stepIndex] ?? STEPS[STEPS.length - 1] ?? STEPS[0];
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-8 p-8">
        <div className="flex w-full max-w-sm flex-col gap-6">
          <div className="flex flex-col gap-3">
            <p className="text-muted-fg text-xs font-medium uppercase tracking-wider">
              Analyzing {url}
            </p>
            <div className="bg-surface-elevated h-1.5 w-full overflow-hidden rounded-full">
              <div
                className="bg-brand-500 h-full rounded-full transition-all duration-1000"
                style={{
                  width: researchReady ? '100%' : `${((stepIndex + 1) / STEPS.length) * 85}%`,
                }}
              />
            </div>
            <p className="text-muted-fg text-sm">
              {researchReady ? '✓ Analysis complete' : currentStep}
            </p>
          </div>

          <div className="border-border bg-surface rounded-xl border p-5">
            <p className="text-fg mb-4 text-sm font-medium">
              Where should we send your workspace link?
            </p>
            <form onSubmit={(e) => void handleEmailSubmit(e)} className="flex flex-col gap-3">
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="border-border bg-bg text-fg placeholder:text-muted-fg focus:border-brand-500 focus:ring-brand-500/20 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
              />
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="bg-brand-500 hover:bg-brand-400 text-fg rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
              >
                {loading ? 'Sending…' : 'Send magic link →'}
              </button>
            </form>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 p-8">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col gap-2 text-center">
          <h1 className="text-fg text-3xl font-bold tracking-tight">
            Know your brand in 90 seconds
          </h1>
          <p className="text-muted-fg text-sm">
            Enter your company website — we&apos;ll analyze it before you finish signing up.
          </p>
        </div>

        <form onSubmit={(e) => void handleUrlSubmit(e)} className="flex flex-col gap-3">
          <input
            type="text"
            required
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://acme.com"
            className="border-border bg-surface text-fg placeholder:text-muted-fg focus:border-brand-500 focus:ring-brand-500/20 w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="bg-brand-500 hover:bg-brand-400 text-fg rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'Analyzing…' : 'Start Now →'}
          </button>
        </form>

        <p className="text-muted-fg text-center text-xs">
          No credit card required · 14-day free trial
        </p>
      </div>
    </main>
  );
}
