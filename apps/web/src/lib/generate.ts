import 'server-only';

import { aquilaFetch } from '@/lib/aquila-server';

export interface BrandVoiceResult {
  result: string;
  brand_id: string;
}

export async function rewriteBrandVoice(
  workspaceId: string,
  text: string,
  brandId: string,
): Promise<BrandVoiceResult | null> {
  return aquilaFetch<BrandVoiceResult>(workspaceId, '/generate/brand-voice', {
    method: 'POST',
    body: JSON.stringify({ text, brand_id: brandId }),
  });
}

export interface BattlecardData {
  summary?: string;
  strengths?: string[];
  weaknesses?: string[];
  pricing_delta?: Record<string, unknown>;
  messaging_diff?: Record<string, unknown>;
  win_loss?: string;
  recommendations?: string[];
}

export interface BattlecardResult {
  id: string;
  brand_id: string;
  competitor_id: string;
  regen_count: number;
  pdf_size: number;
  pdf_url: string;
  data: BattlecardData;
}

export async function generateBattlecard(
  workspaceId: string,
  brandId: string,
  competitorId: string,
): Promise<BattlecardResult | null> {
  return aquilaFetch<BattlecardResult>(
    workspaceId,
    `/brands/${encodeURIComponent(brandId)}/battlecards?vs=${encodeURIComponent(competitorId)}`,
    { method: 'POST', body: '{}' },
  );
}
