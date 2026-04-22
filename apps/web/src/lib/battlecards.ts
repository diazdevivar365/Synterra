import 'server-only';

import { aquilaFetch } from '@/lib/aquila-server';

export interface Battlecard {
  id: number;
  competitorId: string;
  competitorTagline: string | null;
  summary: string;
  generatedAt: string | null;
  regenCount: number;
  triggeredBy: string;
  pdfSize: number;
  pdfUrl: string;
}

interface RawBattlecard {
  id: number;
  competitor_id: string;
  competitor_tagline: string | null;
  summary: string;
  generated_at: string | null;
  regen_count: number;
  triggered_by: string;
  pdf_size: number;
  pdf_url: string;
}

export async function getBattlecardsForBrand(
  workspaceId: string,
  brandId: string,
): Promise<Battlecard[]> {
  const data = await aquilaFetch<{ brand_id: string; battlecards: RawBattlecard[] }>(
    workspaceId,
    `/brands/${encodeURIComponent(brandId)}/battlecards`,
  );
  return (data?.battlecards ?? []).map((b) => ({
    id: b.id,
    competitorId: b.competitor_id,
    competitorTagline: b.competitor_tagline,
    summary: b.summary,
    generatedAt: b.generated_at,
    regenCount: b.regen_count,
    triggeredBy: b.triggered_by,
    pdfSize: b.pdf_size,
    pdfUrl: b.pdf_url,
  }));
}
