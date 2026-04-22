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

export interface GeoResult {
  geo: string;
  status_code?: number;
  final_url?: string;
  redirected?: boolean;
  title?: string;
  lang?: string;
  currency_detected?: string;
  error?: string;
}

export interface GeoDiff {
  field: string;
  values: Record<string, string | null>;
  unique_count: number;
  severity?: string;
}

export interface GeoScanResult {
  brand_id: string;
  url: string;
  geos: string[];
  results: GeoResult[];
  diffs: GeoDiff[];
  geos_scanned: number;
  geos_failed: number;
}

export async function triggerGeoScan(
  _prev: GeoScanResult | null,
  formData: FormData,
): Promise<GeoScanResult | null> {
  const slug = formData.get('workspace') as string;
  const brandId = formData.get('brand_id') as string;
  const geos = (formData.get('geos') as string) || 'ar,us,gb,jp';

  const ws = await resolveWorkspace(slug);
  if (!ws) return null;

  const result = await aquilaFetch<GeoScanResult>(
    ws.id,
    `/brands/${encodeURIComponent(brandId)}/geo-scan?geos=${encodeURIComponent(geos)}`,
    { method: 'POST' },
  );

  return result ?? null;
}
