import 'server-only';

const BASE = process.env['AQUILA_BASE_URL'] ?? '';
const KEY = process.env['AQUILA_API_KEY'] ?? '';

function aquilaHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
}

export interface BrandVoiceResult {
  result: string;
  brandId: string;
}

export async function rewriteBrandVoice(
  text: string,
  brandId: string,
): Promise<BrandVoiceResult | null> {
  if (!BASE || !KEY) return null;
  try {
    const res = await fetch(`${BASE}/generate/brand-voice`, {
      method: 'POST',
      headers: aquilaHeaders(),
      body: JSON.stringify({ text, brand_id: brandId }),
    });
    if (!res.ok) return null;
    return (await res.json()) as BrandVoiceResult;
  } catch {
    return null;
  }
}

export interface BattlecardResult {
  id: string;
  summary: string;
  generated_at: string;
  pdf_url: string | null;
}

export async function generateBattlecard(
  brandId: string,
  competitorId: string,
): Promise<BattlecardResult | null> {
  if (!BASE || !KEY) return null;
  try {
    const res = await fetch(
      `${BASE}/brands/${encodeURIComponent(brandId)}/battlecards?vs=${encodeURIComponent(competitorId)}`,
      { method: 'POST', headers: aquilaHeaders(), body: '{}' },
    );
    if (!res.ok) return null;
    return (await res.json()) as BattlecardResult;
  } catch {
    return null;
  }
}
