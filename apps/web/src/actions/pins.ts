'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { brandPins, workspaceMembers, workspaces } from '@synterra/db';

import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

export async function togglePin(formData: FormData) {
  const slug = formData.get('workspace') as string;
  const brandId = formData.get('brand_id') as string;
  const currentlyPinned = formData.get('pinned') === 'true';

  const ctx = await getWorkspaceContext();
  if (!ctx) return;

  const ws = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaces.slug, slug), eq(workspaceMembers.userId, ctx.userId)))
    .then((r) => r[0] ?? null);
  if (!ws) return;

  if (currentlyPinned) {
    await db
      .delete(brandPins)
      .where(
        and(
          eq(brandPins.workspaceId, ws.id),
          eq(brandPins.userId, ctx.userId),
          eq(brandPins.brandId, brandId),
        ),
      );
  } else {
    await db
      .insert(brandPins)
      .values({ workspaceId: ws.id, userId: ctx.userId, brandId })
      .onConflictDoNothing();
  }

  revalidatePath(`/${slug}/brands/${brandId}`);
  revalidatePath(`/${slug}/pins`);
}
