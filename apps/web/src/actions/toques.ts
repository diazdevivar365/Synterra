'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { workspaceMembers, workspaces } from '@synterra/db';

import { aquilaFetch } from '@/lib/aquila-server';
import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

import type { Toque, ToqueKind } from '@/lib/toques';

interface ActionResult {
  ok: boolean;
  error?: string;
  toque?: Toque;
}

const VALID_KINDS: readonly ToqueKind[] = ['style', 'url', 'book', 'author', 'quote', 'free_text'];

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

export async function createToqueAction(formData: FormData): Promise<ActionResult> {
  const slug = formData.get('workspace') as string;
  const kind = formData.get('kind') as string;
  const label = (formData.get('label') as string | null)?.trim() ?? '';
  const content = (formData.get('content') as string | null)?.trim() ?? '';
  const shared = formData.get('shared') === 'on';

  if (!VALID_KINDS.includes(kind as ToqueKind)) {
    return { ok: false, error: 'kind inválido' };
  }
  if (!label) return { ok: false, error: 'label requerido' };
  if (kind !== 'style' && !content) {
    return { ok: false, error: 'content requerido para este tipo de toque' };
  }

  const ws = await resolveWorkspace(slug);
  if (!ws) return { ok: false, error: 'workspace no encontrado' };

  const toque = await aquilaFetch<Toque>(ws.id, '/toques', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind,
      label,
      content: content || null,
      payload: {},
      shared,
    }),
  });
  if (!toque) return { ok: false, error: 'Aquila no respondió' };

  revalidatePath(`/${slug}/toques`);
  return { ok: true, toque };
}

export async function deleteToqueAction(formData: FormData): Promise<ActionResult> {
  const slug = formData.get('workspace') as string;
  const id = formData.get('toque_id') as string;
  if (!id) return { ok: false, error: 'toque_id requerido' };

  const ws = await resolveWorkspace(slug);
  if (!ws) return { ok: false, error: 'workspace no encontrado' };

  await aquilaFetch<unknown>(ws.id, `/toques/${id}`, { method: 'DELETE' });
  revalidatePath(`/${slug}/toques`);
  return { ok: true };
}

export async function reextractToqueAction(formData: FormData): Promise<ActionResult> {
  const slug = formData.get('workspace') as string;
  const id = formData.get('toque_id') as string;
  if (!id) return { ok: false, error: 'toque_id requerido' };

  const ws = await resolveWorkspace(slug);
  if (!ws) return { ok: false, error: 'workspace no encontrado' };

  await aquilaFetch<unknown>(ws.id, `/toques/${id}/extract`, { method: 'POST' });
  return { ok: true };
}

export async function refetchToqueAction(formData: FormData): Promise<ActionResult> {
  const slug = formData.get('workspace') as string;
  const id = formData.get('toque_id') as string;
  if (!id) return { ok: false, error: 'toque_id requerido' };

  const ws = await resolveWorkspace(slug);
  if (!ws) return { ok: false, error: 'workspace no encontrado' };

  const fresh = await aquilaFetch<Toque>(ws.id, `/toques/${id}`);
  if (!fresh) return { ok: false, error: 'toque no encontrado' };
  return { ok: true, toque: fresh };
}
