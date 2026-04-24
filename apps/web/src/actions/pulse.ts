'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { workspaceMembers, workspaces } from '@synterra/db';

import { db } from '@/lib/db';
import { refreshMarketPulse } from '@/lib/pulse';
import { getWorkspaceContext } from '@/lib/workspace-context';

export async function refreshPulseAction(formData: FormData) {
  const slug = formData.get('workspace') as string;
  const ctx = await getWorkspaceContext();
  if (!ctx) return;

  const ws = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaces.slug, slug), eq(workspaceMembers.userId, ctx.userId)))
    .then((r) => r[0] ?? null);
  if (!ws) return;

  await refreshMarketPulse(ws.id);
  revalidatePath(`/${slug}/pulse`);
}
