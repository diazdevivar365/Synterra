import { and, eq } from 'drizzle-orm';
import { MessageSquare, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { workspaceMembers, workspaces } from '@synterra/db';

import { deleteComment } from '@/actions/comments';
import { AddCommentForm } from '@/components/add-comment-form';
import { brandNameFromId } from '@/lib/brands';
import { getComments } from '@/lib/comments';
import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

export default async function BrandCommentsPage({
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

  const comments = await getComments(ws.id, id);
  const brandName = brandNameFromId(id);

  return (
    <div className="mx-auto max-w-[780px] space-y-6 px-6 py-8">
      <div>
        <Link
          href={`/${slug}/brands/${id}`}
          className="text-muted-fg hover:text-fg mb-4 inline-flex items-center gap-1.5 font-mono text-xs transition-colors"
        >
          ← {brandName}
        </Link>
        <div className="flex items-center gap-3">
          <MessageSquare className="text-accent h-5 w-5" />
          <h1 className="text-fg text-xl font-semibold">Comments</h1>
          {comments.length > 0 && (
            <span className="bg-surface-elevated border-border rounded-full border px-2 py-0.5 font-mono text-[10px]">
              {comments.length}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {comments.length === 0 ? (
          <div className="border-border rounded-lg border border-dashed py-12 text-center">
            <p className="text-muted-fg text-sm">No comments yet.</p>
            <p className="text-muted-fg mt-1 text-xs">Be the first to annotate this brand.</p>
          </div>
        ) : (
          comments.map((c) => (
            <div
              key={c.id}
              className={`border-border bg-surface rounded-[8px] border p-4 ${
                c.parent_comment_id ? 'border-l-accent/30 ml-6 border-l-2' : ''
              }`}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <span className="text-fg text-xs font-medium">{c.user_email}</span>
                  {c.section_anchor && c.section_anchor !== 'general' && (
                    <span className="bg-surface-elevated border-border ml-2 rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase">
                      {c.section_anchor}
                    </span>
                  )}
                  <span className="text-muted-fg ml-2 font-mono text-[10px]">
                    {new Date(c.created_at).toLocaleDateString()}
                  </span>
                </div>
                {c.is_own && (
                  <form action={deleteComment}>
                    <input type="hidden" name="workspace" value={slug} />
                    <input type="hidden" name="brand_id" value={id} />
                    <input type="hidden" name="comment_id" value={String(c.id)} />
                    <button
                      type="submit"
                      className="text-muted-fg hover:text-danger transition-colors"
                      title="Delete comment"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </form>
                )}
              </div>
              <p className="text-fg whitespace-pre-wrap text-sm">{c.text}</p>
              {c.mentions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {c.mentions.map((m) => (
                    <span
                      key={m}
                      className="bg-accent/10 text-accent rounded px-1.5 py-0.5 font-mono text-[9px]"
                    >
                      @{m}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="border-border bg-surface rounded-[8px] border p-4">
        <h3 className="text-muted-fg mb-3 font-mono text-[10px] uppercase tracking-wider">
          New comment
        </h3>
        <AddCommentForm slug={slug} brandId={id} />
      </div>
    </div>
  );
}
