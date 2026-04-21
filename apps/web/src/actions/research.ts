'use server';

import { redirect } from 'next/navigation';

import { createResearchRunRequest } from '../lib/research';
import { getSessionOrThrow } from '../lib/session';
import { getWorkspaceContext } from '../lib/workspace-context';

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string };

export async function createResearchRun(
  formData: FormData,
): Promise<ActionResult<{ runId: string }>> {
  await getSessionOrThrow();
  const ctx = await getWorkspaceContext();
  if (!ctx) return { ok: false, code: 'UNAUTHORIZED', message: 'No workspace context' };

  const url = (formData.get('url') as string | null)?.trim() ?? '';
  if (!url) return { ok: false, code: 'VALIDATION', message: 'URL is required' };

  let parsed: URL;
  try {
    parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
  } catch {
    return { ok: false, code: 'VALIDATION', message: 'Invalid URL' };
  }

  const run = await createResearchRunRequest({
    url: parsed.toString(),
    orgSlug: ctx.slug,
  });

  if (!run) {
    return {
      ok: false,
      code: 'AQUILA_UNAVAILABLE',
      message: 'Intelligence engine unavailable — try again shortly',
    };
  }

  redirect(`/${ctx.slug}/research/${run.runId}`);
}
