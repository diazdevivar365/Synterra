'use server';

import {
  generateBattlecard,
  rewriteBrandVoice,
  type BattlecardResult,
  type BrandVoiceResult,
} from '../lib/generate';
import { getSessionOrThrow } from '../lib/session';
import { getWorkspaceContext } from '../lib/workspace-context';

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string };

export async function brandVoiceAction(
  formData: FormData,
): Promise<ActionResult<BrandVoiceResult>> {
  await getSessionOrThrow();
  const ctx = await getWorkspaceContext();
  if (!ctx) return { ok: false, code: 'UNAUTHORIZED', message: 'No workspace context' };

  const text = (formData.get('text') as string | null)?.trim() ?? '';
  const brandId = (formData.get('brandId') as string | null)?.trim() ?? '';

  if (!text) return { ok: false, code: 'VALIDATION', message: 'Text is required' };
  if (!brandId) return { ok: false, code: 'VALIDATION', message: 'Brand is required' };

  const result = await rewriteBrandVoice(ctx.workspaceId, text, brandId);
  if (!result) {
    return {
      ok: false,
      code: 'AQUILA_UNAVAILABLE',
      message: 'Intelligence engine unavailable — connect Aquila to use this feature',
    };
  }

  return { ok: true, data: result };
}

export async function battlecardAction(
  formData: FormData,
): Promise<ActionResult<BattlecardResult>> {
  await getSessionOrThrow();
  const ctx = await getWorkspaceContext();
  if (!ctx) return { ok: false, code: 'UNAUTHORIZED', message: 'No workspace context' };

  const brandId = (formData.get('brandId') as string | null)?.trim() ?? '';
  const competitorId = (formData.get('competitorId') as string | null)?.trim() ?? '';

  if (!brandId) return { ok: false, code: 'VALIDATION', message: 'Brand is required' };
  if (!competitorId) return { ok: false, code: 'VALIDATION', message: 'Competitor is required' };

  const result = await generateBattlecard(ctx.workspaceId, brandId, competitorId);
  if (!result) {
    return {
      ok: false,
      code: 'AQUILA_UNAVAILABLE',
      message: 'Intelligence engine unavailable — connect Aquila to use this feature',
    };
  }

  return { ok: true, data: result };
}
