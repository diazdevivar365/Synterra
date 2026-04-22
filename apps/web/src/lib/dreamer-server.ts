import 'server-only';

import { aquilaFetch } from '@/lib/aquila-server';

export interface BrandDream {
  id: string;
  org_id: string;
  brand_id: string;
  narrative: string;
  memory: Record<string, unknown>;
  sources_used: Record<string, number>;
  created_by: string | null;
  created_at: string;
}

interface HistoryResp {
  items: BrandDream[];
  total: number;
}

export async function getLatestDream(
  workspaceId: string,
  brandId: string,
): Promise<BrandDream | null> {
  return aquilaFetch<BrandDream>(workspaceId, `/dreamer/brand/${encodeURIComponent(brandId)}`);
}

export async function listDreamHistory(
  workspaceId: string,
  brandId: string,
  limit = 20,
): Promise<BrandDream[]> {
  const data = await aquilaFetch<HistoryResp>(
    workspaceId,
    `/dreamer/brand/${encodeURIComponent(brandId)}/history?limit=${limit}`,
  );
  return data?.items ?? [];
}
