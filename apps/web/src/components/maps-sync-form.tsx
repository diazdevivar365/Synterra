'use client';

import { useActionState } from 'react';

import { triggerMapsSync, type MapsSyncResult } from '@/actions/maps';

interface Props {
  slug: string;
  brandId: string;
}

export function MapsSyncForm({ slug, brandId }: Props) {
  const [result, action, isPending] = useActionState<MapsSyncResult | null, FormData>(
    triggerMapsSync,
    null,
  );

  return (
    <div className="space-y-6">
      <form action={action} className="flex items-center gap-2">
        <input type="hidden" name="workspace" value={slug} />
        <input type="hidden" name="brand_id" value={brandId} />
        <input
          name="city"
          defaultValue="Buenos Aires"
          className="bg-surface border-border text-fg rounded border px-2 py-1 text-xs"
          placeholder="City"
        />
        <button
          type="submit"
          disabled={isPending}
          className="bg-surface-elevated border-border hover:border-accent/60 inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs transition-colors disabled:opacity-50"
        >
          {isPending ? 'Searching…' : 'Run maps sync'}
        </button>
      </form>

      {result && (
        <div className="border-border bg-surface space-y-3 rounded-[8px] border p-4">
          <div className="flex items-center gap-2">
            <span
              className={`font-mono text-[10px] uppercase tracking-wider ${result.found ? 'text-accent' : 'text-danger'}`}
            >
              {result.found ? 'Match found' : 'Not found'}
            </span>
            {result.query && (
              <span className="text-muted-fg font-mono text-[10px]">· query: "{result.query}"</span>
            )}
          </div>

          {result.found && (
            <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-xs">
              {result.data.address && (
                <>
                  <dt className="text-muted-fg font-mono text-[10px] uppercase">Address</dt>
                  <dd className="text-fg">{result.data.address}</dd>
                </>
              )}
              {result.data.rating != null && (
                <>
                  <dt className="text-muted-fg font-mono text-[10px] uppercase">Rating</dt>
                  <dd className="text-fg">
                    {result.data.rating}★
                    {result.data.reviews_count != null && (
                      <span className="text-muted-fg"> ({result.data.reviews_count} reviews)</span>
                    )}
                  </dd>
                </>
              )}
              {result.data.phone && (
                <>
                  <dt className="text-muted-fg font-mono text-[10px] uppercase">Phone</dt>
                  <dd className="text-fg font-mono">{result.data.phone}</dd>
                </>
              )}
              {result.data.categories && result.data.categories.length > 0 && (
                <>
                  <dt className="text-muted-fg font-mono text-[10px] uppercase">Categories</dt>
                  <dd className="text-fg">{result.data.categories.join(', ')}</dd>
                </>
              )}
              {result.data.hours && (
                <>
                  <dt className="text-muted-fg font-mono text-[10px] uppercase">Hours</dt>
                  <dd className="text-fg text-[11px]">{result.data.hours}</dd>
                </>
              )}
              {result.data.website && (
                <>
                  <dt className="text-muted-fg font-mono text-[10px] uppercase">Website</dt>
                  <dd className="text-accent truncate font-mono text-[11px]">
                    {result.data.website}
                  </dd>
                </>
              )}
              {result.data.geo && (
                <>
                  <dt className="text-muted-fg font-mono text-[10px] uppercase">Geo</dt>
                  <dd className="text-muted-fg font-mono text-[11px]">
                    {result.data.geo.lat}, {result.data.geo.lng}
                  </dd>
                </>
              )}
            </dl>
          )}
        </div>
      )}
    </div>
  );
}
