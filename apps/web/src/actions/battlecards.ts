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

export async function generateBattlecard(formData: FormData) {
  const slug = formData.get('workspace') as string;
  const brandId = formData.get('brand_id') as string;
  const competitorId = formData.get('competitor_id') as string;
  const ws = await resolveWorkspace(slug);
  if (!ws) return;

  await aquilaFetch(
    ws.id,
    `/brands/${encodeURIComponent(brandId)}/battlecards?vs=${encodeURIComponent(competitorId)}`,
    { method: 'POST' },
  );

  revalidatePath(`/${slug}/battlecards`);
}

export async function deleteBattlecard(formData: FormData) {
  const slug = formData.get('workspace') as string;
  const cardId = formData.get('card_id') as string;
  const ws = await resolveWorkspace(slug);
  if (!ws) return;

  await aquilaFetch(ws.id, `/battlecards/${cardId}`, { method: 'DELETE' });
  revalidatePath(`/${slug}/battlecards`);
}
