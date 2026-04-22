'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { workspaceMembers, workspaces } from '@synterra/db';

import { aquilaFetch } from '@/lib/aquila-server';
import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

interface ConsolidateResult {
  ok: boolean;
  error?: string;
  dream_id?: string;
}

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

interface ConsolidateWire {
  dream_id: string;
  narrative: string;
  memory: Record<string, unknown>;
}

export async function consolidateDreamAction(formData: FormData): Promise<ConsolidateResult> {
  const slug = formData.get('workspace') as string;
  const brandId = formData.get('brand_id') as string;
  if (!brandId) return { ok: false, error: 'brand_id requerido' };

  const ws = await resolveWorkspace(slug);
  if (!ws) return { ok: false, error: 'workspace no encontrado' };

  const res = await aquilaFetch<ConsolidateWire>(ws.id, '/dreamer/consolidate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brand_id: brandId }),
  });
  if (!res) return { ok: false, error: 'Aquila no pudo consolidar (sin datos o LLM caído)' };

  revalidatePath(`/${slug}/brands/${brandId}/dream`);
  return { ok: true, dream_id: res.dream_id };
}
