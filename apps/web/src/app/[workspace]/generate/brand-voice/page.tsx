'use client';

import { ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useActionState } from 'react';

import { Button } from '@synterra/ui';

import { brandVoiceAction } from '@/actions/generate';

import type { BrandVoiceResult } from '@/lib/generate';

type State =
  | { ok: true; data: BrandVoiceResult }
  | { ok: false; code: string; message: string }
  | null;

export default function BrandVoicePage() {
  const { workspace: slug } = useParams<{ workspace: string }>();
  const [state, action, pending] = useActionState<State, FormData>(
    async (_prev, formData) => brandVoiceAction(formData),
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
        <Sparkles className="text-muted-fg h-5 w-5" />
        <h1 className="text-fg text-2xl font-bold">Brand Voice Rewriter</h1>
      </div>

      <form action={action} className="space-y-4">
        <div className="space-y-1.5">
          <label
            htmlFor="brandId"
            className="text-muted-fg block font-mono text-xs uppercase tracking-wider"
          >
            Brand ID
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
            htmlFor="text"
            className="text-muted-fg block font-mono text-xs uppercase tracking-wider"
          >
            Copy to rewrite
          </label>
          <textarea
            id="text"
            name="text"
            rows={6}
            placeholder="Paste the copy you want rewritten in your brand voice…"
            className="border-border bg-surface text-fg placeholder:text-muted-fg focus:border-accent w-full resize-y rounded-[8px] border px-4 py-2.5 font-mono text-sm focus:outline-none"
          />
        </div>

        {state?.ok === false && (
          <p className="border-danger/30 bg-danger/10 text-danger rounded-[6px] border px-3 py-2 font-mono text-xs">
            {state.message}
          </p>
        )}

        <Button type="submit" disabled={pending} className="gap-2">
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {pending ? 'Rewriting…' : 'Rewrite in brand voice'}
        </Button>
      </form>

      {state?.ok === true && (
        <div className="mt-8 space-y-2">
          <p className="text-muted-fg font-mono text-xs uppercase tracking-wider">Result</p>
          <div className="border-accent/30 bg-surface text-fg whitespace-pre-wrap rounded-[8px] border p-5 font-mono text-sm">
            {state.data.result}
          </div>
        </div>
      )}
    </div>
  );
}
