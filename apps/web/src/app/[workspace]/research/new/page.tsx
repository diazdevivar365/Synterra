'use client';

import { ArrowLeft, FlaskConical, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useActionState } from 'react';

import { Button } from '@synterra/ui';

import { createResearchRun } from '@/actions/research';

type State = { ok: false; code: string; message: string } | null;

export default function NewResearchPage() {
  const { workspace: slug } = useParams<{ workspace: string }>();
  const [state, action, pending] = useActionState<State, FormData>(async (_prev, formData) => {
    const result = await createResearchRun(formData);
    if (!result.ok) return result;
    return null;
  }, null);

  return (
    <div className="mx-auto max-w-[640px] px-6 py-8">
      <Link
        href={`/${slug}/research`}
        className="text-muted-fg hover:text-fg mb-6 inline-flex items-center gap-1.5 font-mono text-xs transition-colors duration-150"
      >
        <ArrowLeft className="h-3 w-3" />
        Research
      </Link>

      <div className="mb-8 flex items-center gap-3">
        <FlaskConical className="text-muted-fg h-5 w-5" />
        <h1 className="text-fg text-2xl font-bold">New Research Run</h1>
      </div>

      <form action={action} className="space-y-4">
        <div className="space-y-1.5">
          <label
            htmlFor="url"
            className="text-muted-fg block font-mono text-xs uppercase tracking-wider"
          >
            Website URL
          </label>
          <input
            id="url"
            name="url"
            type="text"
            placeholder="https://example.com"
            autoFocus
            className="border-border bg-surface text-fg placeholder:text-muted-fg focus:border-accent w-full rounded-[8px] border px-4 py-2.5 font-mono text-sm focus:outline-none"
          />
          <p className="text-muted-fg font-mono text-[10px]">
            Aquila will scrape, enrich, and build a Brand DNA profile for this URL.
          </p>
        </div>

        {state?.ok === false && (
          <p className="border-danger/30 bg-danger/10 text-danger rounded-[6px] border px-3 py-2 font-mono text-xs">
            {state.message}
          </p>
        )}

        <Button type="submit" disabled={pending} className="w-full gap-2">
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {pending ? 'Starting run…' : 'Start research run'}
        </Button>
      </form>
    </div>
  );
}
