'use server';

import { and, eq } from 'drizzle-orm';

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

export interface MapsPlace {
  address?: string;
  phone?: string;
  rating?: number;
  reviews_count?: number;
  categories?: string[];
  hours?: string;
  website?: string;
  geo?: { lat: number; lng: number } | null;
}

export interface MapsSyncResult {
  brand_id: string;
  query?: string;
  found: boolean;
  data: MapsPlace;
}

export async function triggerMapsSync(
  _prev: MapsSyncResult | null,
  formData: FormData,
): Promise<MapsSyncResult | null> {
  const slug = formData.get('workspace') as string;
  const brandId = formData.get('brand_id') as string;
  const city = ((formData.get('city') as string) || 'Buenos Aires').trim();

  const ws = await resolveWorkspace(slug);
  if (!ws) return null;

  const result = await aquilaFetch<MapsSyncResult>(
    ws.id,
    `/brands/${encodeURIComponent(brandId)}/maps-sync?city=${encodeURIComponent(city)}`,
    { method: 'POST' },
  );

  return result ?? null;
}
