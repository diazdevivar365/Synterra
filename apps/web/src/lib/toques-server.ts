import 'server-only';

import { aquilaFetch } from '@/lib/aquila-server';

import type { Toque, ToqueKind } from '@/lib/toques';

interface ListResponse {
  items: Toque[];
  total: number;
}

export async function listToques(
  workspaceId: string,
  opts: { kind?: ToqueKind; limit?: number } = {},
): Promise<Toque[]> {
  const q = new URLSearchParams();
  if (opts.kind) q.set('kind', opts.kind);
  q.set('limit', String(opts.limit ?? 100));
  const data = await aquilaFetch<ListResponse>(workspaceId, `/toques?${q.toString()}`);
  return data?.items ?? [];
}

export async function getToque(workspaceId: string, id: string): Promise<Toque | null> {
  return aquilaFetch<Toque>(workspaceId, `/toques/${id}`);
}
