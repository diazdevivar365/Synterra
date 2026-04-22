'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { workspaceMembers, workspaces } from '@synterra/db';

import { aquilaFetch } from '@/lib/aquila-server';
import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

import type { Reference, ReferenceKind } from '@/lib/references';

interface ActionResult {
  ok: boolean;
  error?: string;
  reference?: Reference;
}

const VALID_KINDS: readonly ReferenceKind[] = ['image', 'doc', 'url', 'note', 'video'];

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

export async function createReferenceAction(formData: FormData): Promise<ActionResult> {
  const slug = formData.get('workspace') as string;
  const kind = formData.get('kind') as string;
  const title = (formData.get('title') as string | null)?.trim() ?? '';
  const url = (formData.get('url') as string | null)?.trim() ?? '';
  const notes = (formData.get('notes') as string | null)?.trim() ?? '';
  const brandId = (formData.get('brand_id') as string | null)?.trim() ?? '';
  const rawTags = (formData.get('tags') as string | null)?.trim() ?? '';
  const shared = formData.get('shared') === 'on';

  if (!VALID_KINDS.includes(kind as ReferenceKind)) {
    return { ok: false, error: 'kind inválido' };
  }
  if (!title) return { ok: false, error: 'título requerido' };
  if (kind !== 'note' && !url) {
    return { ok: false, error: 'URL requerido para este tipo de referencia' };
  }

  const tags = rawTags
    ? rawTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  const ws = await resolveWorkspace(slug);
  if (!ws) return { ok: false, error: 'workspace no encontrado' };

  const reference = await aquilaFetch<Reference>(ws.id, '/references', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind,
      title,
      brand_id: brandId || null,
      url: url || null,
      notes: notes || null,
      tags,
      shared,
    }),
  });
  if (!reference) return { ok: false, error: 'Aquila no respondió' };

  revalidatePath(`/${slug}/references`);
  return { ok: true, reference };
}

export async function deleteReferenceAction(formData: FormData): Promise<ActionResult> {
  const slug = formData.get('workspace') as string;
  const id = formData.get('reference_id') as string;
  if (!id) return { ok: false, error: 'reference_id requerido' };
  const ws = await resolveWorkspace(slug);
  if (!ws) return { ok: false, error: 'workspace no encontrado' };
  await aquilaFetch<unknown>(ws.id, `/references/${id}`, { method: 'DELETE' });
  revalidatePath(`/${slug}/references`);
  return { ok: true };
}

export async function touchReferenceAction(formData: FormData): Promise<ActionResult> {
  const slug = formData.get('workspace') as string;
  const id = formData.get('reference_id') as string;
  if (!id) return { ok: false, error: 'reference_id requerido' };
  const ws = await resolveWorkspace(slug);
  if (!ws) return { ok: false, error: 'workspace no encontrado' };
  const ref = await aquilaFetch<Reference>(ws.id, `/references/${id}/touch`, { method: 'POST' });
  if (!ref) return { ok: false, error: 'no encontrado' };
  return { ok: true, reference: ref };
}
