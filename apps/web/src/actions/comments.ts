'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { workspaceMembers, workspaces } from '@synterra/db';

import { aquilaFetch } from '@/lib/aquila-server';
import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

async function resolveWorkspace(slug: string) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return null;
  return db
    .select({ id: workspaces.id })
    .from(workspaces)
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaces.slug, slug), eq(workspaceMembers.userId, ctx.userId)))
    .then((r) => r[0] ?? null);
}

export async function addComment(formData: FormData) {
  const slug = formData.get('workspace') as string;
  const brandId = formData.get('brand_id') as string;
  const text = (formData.get('text') as string).trim();
  const sectionAnchor = (formData.get('section_anchor') as string) || 'general';

  if (!text) return;

  const ws = await resolveWorkspace(slug);
  if (!ws) return;

  await aquilaFetch(ws.id, `/brands/${encodeURIComponent(brandId)}/comments`, {
    method: 'POST',
    body: JSON.stringify({ text, section_anchor: sectionAnchor }),
  });

  revalidatePath(`/${slug}/brands/${brandId}/comments`);
}

export async function deleteComment(formData: FormData) {
  const slug = formData.get('workspace') as string;
  const brandId = formData.get('brand_id') as string;
  const commentId = formData.get('comment_id') as string;

  const ws = await resolveWorkspace(slug);
  if (!ws) return;

  await aquilaFetch(ws.id, `/comments/${encodeURIComponent(commentId)}`, {
    method: 'DELETE',
  });

  revalidatePath(`/${slug}/brands/${brandId}/comments`);
}
