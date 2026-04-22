'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { workspaceMembers, workspaces } from '@synterra/db';

import { aquilaFetch } from '@/lib/aquila-server';
import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

import type { Workflow, WorkflowRun } from '@/lib/workflows';

interface ActionResult<T = undefined> {
  ok: boolean;
  error?: string;
  data?: T;
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

export async function createWorkflowAction(formData: FormData): Promise<ActionResult<Workflow>> {
  const slug = formData.get('workspace') as string;
  const wfSlug = (formData.get('slug') as string | null)?.trim() ?? '';
  const name = (formData.get('name') as string | null)?.trim() ?? '';
  const description = (formData.get('description') as string | null)?.trim() ?? '';
  const intent = (formData.get('intent') as string | null)?.trim() ?? '';

  if (!/^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$/.test(wfSlug)) {
    return { ok: false, error: 'slug inválido (minúsculas, guiones, 3-80 chars)' };
  }
  if (!name) return { ok: false, error: 'nombre requerido' };
  if (!intent) return { ok: false, error: 'intent requerido' };

  const ws = await resolveWorkspace(slug);
  if (!ws) return { ok: false, error: 'workspace no encontrado' };

  const wf = await aquilaFetch<Workflow>(ws.id, '/workflows', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      slug: wfSlug,
      name,
      description: description || null,
      intent,
      config: {},
    }),
  });
  if (!wf) return { ok: false, error: 'Aquila no respondió (slug puede existir)' };

  revalidatePath(`/${slug}/workflows`);
  return { ok: true, data: wf };
}

export async function enqueueRunAction(formData: FormData): Promise<ActionResult<WorkflowRun>> {
  const slug = formData.get('workspace') as string;
  const wfSlug = formData.get('workflow_slug') as string;
  const rawInput = (formData.get('input') as string | null)?.trim() ?? '{}';

  if (!wfSlug) return { ok: false, error: 'workflow_slug requerido' };

  let input: Record<string, unknown> = {};
  try {
    input = JSON.parse(rawInput) as Record<string, unknown>;
  } catch {
    return { ok: false, error: 'input debe ser JSON válido' };
  }

  const ws = await resolveWorkspace(slug);
  if (!ws) return { ok: false, error: 'workspace no encontrado' };

  const run = await aquilaFetch<WorkflowRun>(ws.id, `/workflows/${wfSlug}/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input }),
  });
  if (!run) return { ok: false, error: 'Aquila no respondió' };

  revalidatePath(`/${slug}/workflows/${wfSlug}`);
  return { ok: true, data: run };
}

export async function disableWorkflowAction(formData: FormData): Promise<ActionResult> {
  const slug = formData.get('workspace') as string;
  const wfSlug = formData.get('workflow_slug') as string;
  if (!wfSlug) return { ok: false, error: 'workflow_slug requerido' };

  const ws = await resolveWorkspace(slug);
  if (!ws) return { ok: false, error: 'workspace no encontrado' };

  await aquilaFetch<unknown>(ws.id, `/workflows/${wfSlug}`, { method: 'DELETE' });
  revalidatePath(`/${slug}/workflows`);
  return { ok: true };
}
