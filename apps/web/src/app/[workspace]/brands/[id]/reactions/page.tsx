import { and, eq } from 'drizzle-orm';
import { MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { workspaceMembers, workspaces } from '@synterra/db';

import { ReactionsScanForm } from '@/components/reactions-scan-form';
import { brandNameFromId } from '@/lib/brands';
import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

export default async function BrandReactionsPage({
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
          <MessageSquare className="text-accent h-5 w-5" />
          <h1 className="text-fg text-xl font-semibold">War Room · Reactions</h1>
        </div>
        <p className="text-muted-fg mt-1 text-xs">
          Scrape Reddit + HackerNews mentions, LLM extracts sentiment, crisis signals, topic
          clusters, and recommended response angle.
        </p>
      </div>

      <ReactionsScanForm slug={slug} brandId={id} />
    </div>
  );
}
