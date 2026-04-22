'use client';

import { ArrowLeft, Loader2, Swords } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useActionState } from 'react';

import { Button } from '@synterra/ui';

import { battlecardAction } from '@/actions/generate';

import type { BattlecardResult } from '@/lib/generate';

type State =
  | { ok: true; data: BattlecardResult }
  | { ok: false; code: string; message: string }
  | null;

export default function BattlecardPage() {
  const { workspace: slug } = useParams<{ workspace: string }>();
  const [state, action, pending] = useActionState<State, FormData>(
    async (_prev, formData) => battlecardAction(formData),
    null,
  );

  return (
    <div className="mx-auto max-w-[800px] px-6 py-8">
      <Link
        href={`/${slug}/generate`}
        className="text-muted-fg hover:text-fg mb-6 inline-flex items-center gap-1.5 font-mono text-xs transition-colors duration-150"
      >
        <ArrowLeft className="h-3 w-3" />
        Generate
      </Link>

      <div className="mb-8 flex items-center gap-3">
        <Swords className="text-muted-fg h-5 w-5" />
        <h1 className="text-fg text-2xl font-bold">Competitive Battlecard</h1>
      </div>

      <form action={action} className="space-y-4">
        <div className="space-y-1.5">
          <label
            htmlFor="brandId"
            className="text-muted-fg block font-mono text-xs uppercase tracking-wider"
          >
            Your brand ID
          </label>
          <input
            id="brandId"
            name="brandId"
            type="text"
            placeholder="e.g. seed-1"
            className="border-border bg-surface text-fg placeholder:text-muted-fg focus:border-accent w-full rounded-[8px] border px-4 py-2.5 font-mono text-sm focus:outline-none"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="competitorId"
            className="text-muted-fg block font-mono text-xs uppercase tracking-wider"
          >
            Competitor brand ID
          </label>
          <input
            id="competitorId"
            name="competitorId"
            type="text"
            placeholder="e.g. c1"
            className="border-border bg-surface text-fg placeholder:text-muted-fg focus:border-accent w-full rounded-[8px] border px-4 py-2.5 font-mono text-sm focus:outline-none"
          />
        </div>

        {state?.ok === false && (
          <p className="border-danger/30 bg-danger/10 text-danger rounded-[6px] border px-3 py-2 font-mono text-xs">
            {state.message}
          </p>
        )}

        <Button type="submit" disabled={pending} className="gap-2">
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {pending ? 'Generating...' : 'Generate battlecard'}
        </Button>
      </form>

      {state?.ok === true && (
        <div className="mt-8 space-y-4">
          <div className="flex items-baseline justify-between">
            <p className="text-muted-fg font-mono text-xs uppercase tracking-wider">Battlecard</p>
            <span className="text-muted-fg font-mono text-[10px]">
              regen #{state.data.regen_count} · {Math.round(state.data.pdf_size / 1024)} KB
            </span>
          </div>
          <div className="border-accent/30 bg-surface space-y-3 rounded-[8px] border p-5">
            {state.data.data.summary && (
              <p className="text-fg text-sm">{state.data.data.summary}</p>
            )}
            {state.data.data.win_loss && (
              <p className="text-muted-fg text-xs italic">{state.data.data.win_loss}</p>
            )}
            <a
              href={`/api/${slug}/battlecards/${encodeURIComponent(state.data.brand_id)}/${encodeURIComponent(state.data.id)}`}
              target="_blank"
              rel="noreferrer"
              className="text-accent inline-block font-mono text-xs hover:underline"
            >
              Download PDF
            </a>
          </div>
          {state.data.data.strengths && state.data.data.strengths.length > 0 && (
            <div className="border-border bg-surface rounded-[8px] border p-5">
              <h3 className="text-muted-fg mb-2 font-mono text-[10px] uppercase tracking-wider">
                Strengths
              </h3>
              <ul className="text-fg list-disc space-y-1 pl-5 text-sm">
                {state.data.data.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {state.data.data.weaknesses && state.data.data.weaknesses.length > 0 && (
            <div className="border-border bg-surface rounded-[8px] border p-5">
              <h3 className="text-muted-fg mb-2 font-mono text-[10px] uppercase tracking-wider">
                Weaknesses
              </h3>
              <ul className="text-fg list-disc space-y-1 pl-5 text-sm">
                {state.data.data.weaknesses.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {state.data.data.recommendations && state.data.data.recommendations.length > 0 && (
            <div className="border-accent/40 bg-surface rounded-[8px] border p-5">
              <h3 className="text-muted-fg mb-2 font-mono text-[10px] uppercase tracking-wider">
                Recommendations
              </h3>
              <ul className="text-fg list-disc space-y-1 pl-5 text-sm">
                {state.data.data.recommendations.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
