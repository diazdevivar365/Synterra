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

export async function createAlertRule(formData: FormData) {
  const slug = formData.get('workspace') as string;
  const ws = await resolveWorkspace(slug);
  if (!ws) return;

  const body = {
    name: formData.get('name') as string,
    description: (formData.get('description') as string) || null,
    trigger_type: formData.get('trigger_type') as string,
    conditions: JSON.parse((formData.get('conditions') as string) || '{}') as Record<
      string,
      unknown
    >,
    action_type: formData.get('action_type') as string,
    action_config: JSON.parse((formData.get('action_config') as string) || '{}') as Record<
      string,
      unknown
    >,
    enabled: true,
  };

  await aquilaFetch(ws.id, '/alerting/rules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  revalidatePath(`/${slug}/alerts`);
}

export async function deleteAlertRule(formData: FormData) {
  const slug = formData.get('workspace') as string;
  const ruleId = formData.get('rule_id') as string;
  const ws = await resolveWorkspace(slug);
  if (!ws) return;

  await aquilaFetch(ws.id, `/alerting/rules/${ruleId}`, { method: 'DELETE' });
  revalidatePath(`/${slug}/alerts`);
}

export async function toggleAlertRule(formData: FormData) {
  const slug = formData.get('workspace') as string;
  const ruleId = formData.get('rule_id') as string;
  const enabled = formData.get('enabled') === 'true';
  const ws = await resolveWorkspace(slug);
  if (!ws) return;

  await aquilaFetch(ws.id, `/alerting/rules/${ruleId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
  revalidatePath(`/${slug}/alerts`);
}

export async function testAlertRule(formData: FormData) {
  const slug = formData.get('workspace') as string;
  const ruleId = formData.get('rule_id') as string;
  const ws = await resolveWorkspace(slug);
  if (!ws) return;

  await aquilaFetch(ws.id, `/alerting/rules/${ruleId}/test`, { method: 'POST' });
  revalidatePath(`/${slug}/alerts`);
}
