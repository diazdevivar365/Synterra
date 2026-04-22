import 'server-only';

import { aquilaFetch } from '@/lib/aquila-server';

import type { Reference, ReferenceKind } from '@/lib/references';

interface ListResp {
  items: Reference[];
  total: number;
}

export async function listReferences(
  workspaceId: string,
  opts: { kind?: ReferenceKind; brandId?: string; tag?: string; limit?: number } = {},
): Promise<Reference[]> {
  const q = new URLSearchParams();
  if (opts.kind) q.set('kind', opts.kind);
  if (opts.brandId) q.set('brand_id', opts.brandId);
  if (opts.tag) q.set('tag', opts.tag);
  q.set('limit', String(opts.limit ?? 100));
  const data = await aquilaFetch<ListResp>(workspaceId, `/references?${q.toString()}`);
  return data?.items ?? [];
}

export async function getMostUsedReferences(workspaceId: string, limit = 10): Promise<Reference[]> {
  const data = await aquilaFetch<ListResp>(workspaceId, `/references/most-used?limit=${limit}`);
  return data?.items ?? [];
}
