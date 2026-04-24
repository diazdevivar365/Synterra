'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { workspaceMembers, workspaces } from '@synterra/db';

import { aquilaFetch } from '@/lib/aquila-server';
import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

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

function parseJsonOrEmpty(raw: string | null): Record<string, unknown> {
  if (!raw?.trim()) return {};
  try {
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function createEventPolicy(formData: FormData): Promise<void> {
  const slug = formData.get('workspace') as string;
  const ws = await resolveWorkspace(slug);
  if (!ws) return;

  const body = {
    name: (formData.get('name') as string).trim(),
    description: ((formData.get('description') as string) || '').trim() || null,
    trigger_type: formData.get('trigger_type') as string,
    conditions: parseJsonOrEmpty(formData.get('conditions') as string),
    workflow_slug: (formData.get('workflow_slug') as string).trim(),
    workflow_input: parseJsonOrEmpty(formData.get('workflow_input') as string),
    cooldown_seconds: Number(formData.get('cooldown_seconds') ?? 300),
    max_fires_per_hour: Number(formData.get('max_fires_per_hour') ?? 10),
    max_chain_depth: Number(formData.get('max_chain_depth') ?? 3),
    enabled: formData.get('enabled') === 'on',
  };

  await aquilaFetch(ws.id, '/event-policies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  revalidatePath(`/${slug}/automations`);
}

export async function togglePolicy(formData: FormData): Promise<void> {
  const slug = formData.get('workspace') as string;
  const policyId = formData.get('policy_id') as string;
  const enabled = formData.get('enabled') === 'true';
  const ws = await resolveWorkspace(slug);
  if (!ws) return;

  await aquilaFetch(ws.id, `/event-policies/${policyId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
  revalidatePath(`/${slug}/automations`);
}

export async function deleteEventPolicy(formData: FormData): Promise<void> {
  const slug = formData.get('workspace') as string;
  const policyId = formData.get('policy_id') as string;
  const ws = await resolveWorkspace(slug);
  if (!ws) return;

  await aquilaFetch(ws.id, `/event-policies/${policyId}`, { method: 'DELETE' });
  revalidatePath(`/${slug}/automations`);
}
