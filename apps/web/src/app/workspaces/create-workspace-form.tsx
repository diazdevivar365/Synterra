'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { createWorkspace } from '@/actions/workspace';

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export function CreateWorkspaceForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleNameChange(v: string) {
    setName(v);
    if (!slugTouched) setSlug(toSlug(v));
  }

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await createWorkspace({ name, slug });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const res = await fetch('/api/workspace/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: result.data.workspaceId }),
      });
      if (!res.ok) {
        setError('Workspace created but could not switch — refresh and try again.');
        return;
      }
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-muted-fg hover:text-fg text-sm underline-offset-2 hover:underline"
      >
        + Create a new workspace
      </button>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="flex w-full max-w-sm flex-col gap-3">
      <div className="space-y-1.5">
        <label htmlFor="ws-name" className="text-fg block text-sm font-medium">
          Workspace name
        </label>
        <input
          id="ws-name"
          type="text"
          required
          autoFocus
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="Acme Corp"
          className="border-border bg-surface text-fg placeholder:text-muted-fg focus:border-brand-500 focus:ring-brand-500/20 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="ws-slug" className="text-fg block text-sm font-medium">
          Slug <span className="text-muted-fg font-normal">(URL-safe, 2–48 chars)</span>
        </label>
        <input
          id="ws-slug"
          type="text"
          required
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
          placeholder="acme-corp"
          className="border-border bg-surface text-fg placeholder:text-muted-fg focus:border-brand-500 focus:ring-brand-500/20 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
        />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="bg-brand-500 hover:bg-brand-400 text-fg flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {loading ? 'Creating…' : 'Create workspace'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
            setName('');
            setSlug('');
            setSlugTouched(false);
          }}
          className="border-border bg-surface text-muted-fg rounded-lg border px-4 py-2.5 text-sm transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
