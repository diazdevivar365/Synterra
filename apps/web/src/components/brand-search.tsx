'use client';

import { Search } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

interface SearchResult {
  brandId: string;
  url: string | null;
  tagline: string | null;
  matchField: string | null;
  matchSnippet: string | null;
}

interface Props {
  workspaceSlug: string;
}

export function BrandSearch({ workspaceSlug }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setOpen(false);
      return;
    }

    const timer = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);

      fetch(`/api/${workspaceSlug}/brands/search?q=${encodeURIComponent(q)}`, {
        signal: controller.signal,
      })
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .then((data: { results: SearchResult[] }) => {
          setResults(data.results);
          setOpen(true);
        })
        .catch((err: unknown) => {
          if (!(err instanceof Error) || err.name !== 'AbortError') setResults([]);
        })
        .finally(() => setLoading(false));
    }, 220);

    return () => {
      clearTimeout(timer);
    };
  }, [query, workspaceSlug]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, []);

  return (
    <div ref={wrapperRef} className="relative w-full max-w-md">
      <div className="bg-surface border-border focus-within:border-accent/60 flex items-center gap-2 rounded border px-3 py-1.5 transition-colors">
        <Search className="text-muted-fg h-3.5 w-3.5 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim() && setOpen(true)}
          placeholder="Search brands, taglines, positioning…"
          className="text-fg placeholder:text-muted-fg w-full bg-transparent text-sm focus:outline-none"
        />
        {loading && (
          <span className="border-accent h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-t-transparent" />
        )}
      </div>

      {open && results.length > 0 && (
        <div className="bg-surface-elevated border-border absolute left-0 right-0 top-full z-20 mt-1 max-h-[400px] overflow-y-auto rounded border shadow-lg">
          <ul>
            {results.map((r) => (
              <li key={r.brandId} className="border-border border-b last:border-b-0">
                <Link
                  href={`/${workspaceSlug}/brands/${encodeURIComponent(r.brandId)}`}
                  onClick={() => {
                    setOpen(false);
                    setQuery('');
                  }}
                  className="hover:bg-surface block px-3 py-2 transition-colors"
                >
                  <div className="flex items-baseline gap-2">
                    <span className="text-fg text-sm font-medium">{r.brandId}</span>
                    {r.matchField && (
                      <span className="text-muted-fg font-mono text-[10px] uppercase">
                        {r.matchField}
                      </span>
                    )}
                  </div>
                  {r.matchSnippet && (
                    <p className="text-muted-fg line-clamp-1 text-xs">{r.matchSnippet}</p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {open && !loading && query.trim() && results.length === 0 && (
        <div className="bg-surface-elevated border-border absolute left-0 right-0 top-full z-20 mt-1 rounded border p-3 text-xs shadow-lg">
          <p className="text-muted-fg">No brands match &ldquo;{query}&rdquo;.</p>
        </div>
      )}
    </div>
  );
}
