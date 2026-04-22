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

export interface DiscoveryResult {
  queued: number;
  items: { brand_id: string; url: string; run_id: string }[];
  discoveries?: {
    input: string;
    status: string;
    confidence?: number;
    resolved_url?: string;
    brand_id?: string;
    candidates?: { url: string; name?: string }[];
    error?: string;
  }[];
}

export async function discoverBrands(
  _prev: DiscoveryResult | null,
  formData: FormData,
): Promise<DiscoveryResult | null> {
  const slug = formData.get('workspace') as string;
  const raw = formData.get('urls') as string;
  const depth = (formData.get('depth') as string) || 'rendered';

  const urls = raw
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  if (!urls.length) return null;

  const ws = await resolveWorkspace(slug);
  if (!ws) return null;

  const result = await aquilaFetch<DiscoveryResult>(ws.id, '/research/quick-add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls, depth }),
  });

  revalidatePath(`/${slug}/discovery`);
  revalidatePath(`/${slug}/brands`);
  return result ?? null;
}

export async function discoverCompetitors(formData: FormData) {
  const slug = formData.get('workspace') as string;
  const brandId = formData.get('brand_id') as string;
  const ws = await resolveWorkspace(slug);
  if (!ws) return;

  await aquilaFetch(ws.id, `/brands/${encodeURIComponent(brandId)}/discover-competitors`, {
    method: 'POST',
  });

  revalidatePath(`/${slug}/brands/${brandId}`);
}
