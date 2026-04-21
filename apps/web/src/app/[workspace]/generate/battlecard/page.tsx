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
          <p className="text-muted-fg font-mono text-xs uppercase tracking-wider">Battlecard</p>
          <div className="border-accent/30 bg-surface rounded-[8px] border p-5">
            <p className="text-fg font-mono text-sm">{state.data.summary}</p>
            <p className="text-muted-fg mt-3 font-mono text-[10px]">
              Generated {new Date(state.data.generated_at).toLocaleString()}
            </p>
            {state.data.pdf_url && (
              <a
                href={state.data.pdf_url}
                target="_blank"
                rel="noreferrer"
                className="text-accent mt-3 inline-block font-mono text-xs hover:underline"
              >
                Download PDF
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
