'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { workspaces } from '@synterra/db';

import { aquilaFetch } from '@/lib/aquila-server';
import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

export async function excludeTwinAction(workspaceId: string, brandId: string, twinId: string) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return { error: 'Unauthorized' };

  // Verify workspace exists and user has access
  const ws = await db
    .select({ slug: workspaces.slug })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!ws) return { error: 'Workspace not found' };

  // POST /brands/{id}/dna-twins/exclude
  const res = await aquilaFetch<{ ok: boolean }>(
    workspaceId,
    `/brands/${encodeURIComponent(brandId)}/dna-twins/exclude`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ twinId }),
    },
  );

  if (!res) {
    return { error: 'Failed to exclude twin' };
  }

  revalidatePath(`/${ws.slug}/brands/${brandId}`);
  return { success: true };
}
