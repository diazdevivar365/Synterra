import { and, desc, eq } from 'drizzle-orm';
import { Pin } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { brandPins, workspaceMembers, workspaces } from '@synterra/db';

import { togglePin } from '@/actions/pins';
import { brandInitials } from '@/lib/brand-utils';
import { brandNameFromId } from '@/lib/brands';
import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

export default async function PinsPage({ params }: { params: Promise<{ workspace: string }> }) {
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

  const pins = await db
    .select({ brandId: brandPins.brandId, pinnedAt: brandPins.pinnedAt })
    .from(brandPins)
    .where(and(eq(brandPins.workspaceId, ws.id), eq(brandPins.userId, ctx.userId)))
    .orderBy(desc(brandPins.pinnedAt));

  return (
    <div className="mx-auto max-w-[900px] space-y-6 px-6 py-8">
      <div className="flex items-center gap-3">
        <Pin className="text-accent h-5 w-5" />
        <h1 className="text-fg text-xl font-semibold">Pinned Brands</h1>
        {pins.length > 0 && (
          <span className="bg-surface-elevated border-border rounded-full border px-2 py-0.5 font-mono text-[10px]">
            {pins.length}
          </span>
        )}
      </div>

      {pins.length === 0 ? (
        <div className="border-border rounded-lg border border-dashed py-16 text-center">
          <p className="text-muted-fg text-sm">No pinned brands yet.</p>
          <p className="text-muted-fg mt-1 text-xs">
            Open any brand and click the pin button to save it here.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pins.map(({ brandId, pinnedAt }) => {
            const name = brandNameFromId(brandId);
            return (
              <div
                key={brandId}
                className="border-border bg-surface flex items-start gap-3 rounded-[8px] border p-4"
              >
                <div className="bg-surface-elevated text-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] text-sm font-bold">
                  {brandInitials(name)}
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/${slug}/brands/${brandId}`}
                    className="text-fg hover:text-accent truncate text-sm font-medium transition-colors"
                  >
                    {name}
                  </Link>
                  <p className="text-muted-fg font-mono text-[10px]">
                    Pinned {new Date(pinnedAt).toLocaleDateString()}
                  </p>
                </div>
                <form action={togglePin}>
                  <input type="hidden" name="workspace" value={slug} />
                  <input type="hidden" name="brand_id" value={brandId} />
                  <input type="hidden" name="pinned" value="true" />
                  <button
                    type="submit"
                    className="text-accent hover:text-muted-fg transition-colors"
                    title="Unpin"
                  >
                    <Pin className="h-4 w-4 fill-current" />
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
