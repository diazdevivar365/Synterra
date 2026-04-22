'use client';

import { useActionState, useRef } from 'react';

import { addComment } from '@/actions/comments';

interface Props {
  slug: string;
  brandId: string;
}

export function AddCommentForm({ slug, brandId }: Props) {
  const formRef = useRef<HTMLFormElement>(null);

  async function action(_prev: undefined, formData: FormData) {
    await addComment(formData);
    formRef.current?.reset();
    return undefined;
  }

  const [, dispatch, isPending] = useActionState<undefined, FormData>(action, undefined);

  return (
    <form ref={formRef} action={dispatch} className="space-y-2">
      <input type="hidden" name="workspace" value={slug} />
      <input type="hidden" name="brand_id" value={brandId} />
      <input type="hidden" name="section_anchor" value="general" />
      <textarea
        name="text"
        rows={3}
        placeholder="Add a comment… Use @email to mention teammates."
        className="bg-surface border-border text-fg placeholder:text-muted-fg focus:ring-accent/50 w-full rounded border px-3 py-2 text-xs focus:outline-none focus:ring-1"
        required
        maxLength={4000}
      />
      <button
        type="submit"
        disabled={isPending}
        className="bg-accent hover:bg-accent/90 rounded px-3 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-50"
      >
        {isPending ? 'Posting…' : 'Post comment'}
      </button>
    </form>
  );
}
