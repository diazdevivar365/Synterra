'use client';

import { useEffect, useRef, useState } from 'react';

interface WorkspaceOption {
  id: string;
  name: string;
  slug: string;
  role: string;
}

interface Props {
  current: WorkspaceOption;
  options: WorkspaceOption[];
}

export function WorkspaceSwitcher({ current, options }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    function onClickOut(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClickOut);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClickOut);
    };
  }, []);

  async function handleSwitch(ws: WorkspaceOption) {
    if (ws.id === current.id) {
      setOpen(false);
      return;
    }
    setLoading(ws.id);
    try {
      const res = await fetch('/api/workspace/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: ws.id }),
      });
      if (!res.ok) throw new Error('Switch failed');
      // Full-page nav (not router.push) — the RSC router cache would otherwise
      // reuse the prior workspace's content segments when the slug changes.
      window.location.assign(`/${ws.slug}`);
    } finally {
      setLoading(null);
      setOpen(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-fg hover:bg-surface-elevated flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-semibold transition-colors"
        title="Switch workspace (⌘K)"
      >
        <span className="max-w-36 truncate">{current.name}</span>
        <svg
          className="text-muted-fg h-3 w-3 shrink-0"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M2 4l4 4 4-4" />
        </svg>
      </button>

      {open && (
        <div className="border-border bg-surface absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border py-1 shadow-md">
          {options.map((ws) => (
            <button
              key={ws.id}
              type="button"
              disabled={loading === ws.id}
              onClick={() => void handleSwitch(ws)}
              className="hover:bg-surface-elevated flex w-full items-center justify-between px-3 py-2 text-left transition-colors disabled:opacity-50"
            >
              <span>
                <span className="text-fg block text-sm font-medium">{ws.name}</span>
                <span className="text-muted-fg block text-xs">{ws.role}</span>
              </span>
              {ws.id === current.id && <span className="text-muted-fg text-xs">✓</span>}
              {loading === ws.id && <span className="text-muted-fg text-xs">…</span>}
            </button>
          ))}
          <div className="border-border mt-1 border-t pt-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                window.location.assign('/workspaces');
              }}
              className="text-muted-fg hover:text-fg hover:bg-surface-elevated w-full px-3 py-2 text-left text-xs transition-colors"
            >
              All workspaces
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
