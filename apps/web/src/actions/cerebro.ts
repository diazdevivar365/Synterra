'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { workspaceMembers, workspaces } from '@synterra/db';

import { aquilaFetch } from '@/lib/aquila-server';
import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

import type { SignalCounts, StrategyBrief } from '@/lib/cerebro';

interface AnalyzeResponse {
  brief_id: string;
  brief: StrategyBrief;
  signal_counts: SignalCounts;
}

export interface AnalyzeResult {
  ok: boolean;
  briefId?: string;
  brief?: StrategyBrief;
  signalCounts?: SignalCounts;
  error?: string;
}

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

export async function analyzeBrandAction(formData: FormData): Promise<AnalyzeResult> {
  const slug = formData.get('workspace') as string;
  const brandId = formData.get('brand_id') as string;
  const intent = (formData.get('intent') as string) || 'audit';
  const query = (formData.get('query') as string) || '';

  if (!brandId) return { ok: false, error: 'brand_id requerido' };
  if (!query || query.trim().length < 3) {
    return { ok: false, error: 'query requerido (mínimo 3 caracteres)' };
  }

  const ws = await resolveWorkspace(slug);
  if (!ws) return { ok: false, error: 'workspace no encontrado' };

  const data = await aquilaFetch<AnalyzeResponse>(ws.id, '/brain/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brand_id: brandId, intent, query }),
  });

  if (!data) {
    return {
      ok: false,
      error: 'Aquila no devolvió respuesta. Verificá credenciales o intentá nuevamente.',
    };
  }

  revalidatePath(`/${slug}/cerebro`);
  return {
    ok: true,
    briefId: data.brief_id,
    brief: data.brief,
    signalCounts: data.signal_counts,
  };
}
