'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface WorkspaceOption {
  id: string;
  name: string;
  slug: string;
  role: string;
}

export function WorkspaceList({ workspaces }: { workspaces: WorkspaceOption[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleSelect(workspaceId: string, slug: string) {
    setLoading(workspaceId);
    try {
      const res = await fetch('/api/workspace/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      });
      if (!res.ok) throw new Error('Failed to switch workspace');
      router.push(`/${slug}/dashboard`);
    } finally {
      setLoading(null);
    }
  }

  if (workspaces.length === 0) {
    return <p className="text-muted-fg text-sm">You don&apos;t have access to any workspaces.</p>;
  }

  return (
    <ul className="flex w-full max-w-sm flex-col gap-2">
      {workspaces.map((ws) => (
        <li key={ws.id}>
          <button
            type="button"
            disabled={loading === ws.id}
            onClick={() => void handleSelect(ws.id, ws.slug)}
            className="border-border bg-surface hover:bg-surface-elevated flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors disabled:opacity-50"
          >
            <span>
              <span className="text-fg block text-sm font-medium">{ws.name}</span>
              <span className="text-muted-fg block text-xs">{ws.role}</span>
            </span>
            <span className="text-muted-fg text-xs">{loading === ws.id ? '…' : '→'}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
