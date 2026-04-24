import { and, eq } from 'drizzle-orm';
import { Plus } from 'lucide-react';
import { redirect } from 'next/navigation';

import { brandPins, workspaceMembers, workspaces } from '@synterra/db';
import { Button } from '@synterra/ui';

import { BrandCard } from '@/components/brand-card';
import { BrandSearch } from '@/components/brand-search';
import { getBrandsForWorkspace } from '@/lib/brands';
import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

interface Props {
  params: Promise<{ workspace: string }>;
}

export default async function BrandsPage({ params }: Props) {
  const { workspace: slug } = await params;
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/workspaces');

  const ws = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaces.slug, slug), eq(workspaceMembers.userId, ctx.userId)))
    .then((r) => r[0] ?? null);
  if (!ws) redirect('/workspaces');

  const { brands, fromSeed } = await getBrandsForWorkspace(ws.id);

  const pinnedRows = await db
    .select({ brandId: brandPins.brandId })
    .from(brandPins)
    .where(and(eq(brandPins.workspaceId, ws.id), eq(brandPins.userId, ctx.userId)));
  const pinnedSet = new Set(pinnedRows.map((r) => r.brandId));

  const lastSync = brands.reduce<Date | null>((latest, b) => {
    if (!b.lastScannedAt) return latest;
    if (!latest || b.lastScannedAt > latest) return b.lastScannedAt;
    return latest;
  }, null);

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8">
      {fromSeed && (
        <div className="border-border bg-surface mb-6 rounded-[8px] border px-4 py-3">
          <p className="text-muted-fg font-mono text-xs">
            Connecting to intelligence engine — showing example data.
          </p>
        </div>
      )}

      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-fg text-2xl font-bold">Brands</h1>
          <p className="text-muted-fg mt-0.5 font-mono text-xs">
            {brands.length} brand{brands.length !== 1 ? 's' : ''}
            {lastSync && (
              <> · synced {Math.round((Date.now() - lastSync.getTime()) / 60_000)}m ago</>
            )}
          </p>
        </div>
        <Button variant="default" size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Add Brand
        </Button>
      </div>

      <div className="mb-6">
        <BrandSearch workspaceSlug={slug} />
      </div>

      {brands.length === 0 ? (
        <div className="border-border flex min-h-[240px] items-center justify-center rounded-[8px] border">
          <p className="text-muted-fg font-mono text-sm">
            No brands yet — add your first to get started.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {brands.map((brand) => (
            <BrandCard
              key={brand.id}
              id={brand.id}
              name={brand.name}
              domain={brand.domain}
              healthScore={brand.healthScore}
              lastScannedAt={brand.lastScannedAt}
              workspaceSlug={slug}
              pinned={pinnedSet.has(brand.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
