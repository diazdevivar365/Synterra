import { and, eq } from 'drizzle-orm';
import { MapPin } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { workspaceMembers, workspaces } from '@synterra/db';

import { MapsSyncForm } from '@/components/maps-sync-form';
import { brandNameFromId } from '@/lib/brands';
import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

export default async function BrandMapsPage({
  params,
}: {
  params: Promise<{ workspace: string; id: string }>;
}) {
  const { workspace: slug, id } = await params;

  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/workspaces');

  const ws = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaces.slug, slug), eq(workspaceMembers.userId, ctx.userId)))
    .then((r) => r[0] ?? null);
  if (!ws) redirect('/workspaces');

  const brandName = brandNameFromId(id);

  return (
    <div className="mx-auto max-w-[1100px] space-y-6 px-6 py-8">
      <div>
        <Link
          href={`/${slug}/brands/${id}`}
          className="text-muted-fg hover:text-fg mb-4 inline-flex items-center gap-1.5 font-mono text-xs transition-colors"
        >
          ← {brandName}
        </Link>
        <div className="flex items-center gap-3">
          <MapPin className="text-accent h-5 w-5" />
          <h1 className="text-fg text-xl font-semibold">Google Maps</h1>
        </div>
        <p className="text-muted-fg mt-1 text-xs">
          Find the brand's local business listing: address, rating, reviews, categories. LLM-parsed
          from Google Local with token-overlap + website cross-check to avoid false matches.
        </p>
      </div>

      <MapsSyncForm slug={slug} brandId={id} />
    </div>
  );
}
