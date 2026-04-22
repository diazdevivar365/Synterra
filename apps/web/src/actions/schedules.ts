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

export async function createSchedule(formData: FormData) {
  const slug = formData.get('workspace') as string;
  const ws = await resolveWorkspace(slug);
  if (!ws) return;

  await aquilaFetch(ws.id, '/schedules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      brand_id: formData.get('brand_id'),
      url: formData.get('url'),
      cadence_hours: Number(formData.get('cadence_hours') ?? 168),
      depth: formData.get('depth') ?? 'rendered',
      geo: formData.get('geo') ?? null,
      enabled: true,
    }),
  });

  revalidatePath(`/${slug}/schedules`);
}

export async function deleteSchedule(formData: FormData) {
  const slug = formData.get('workspace') as string;
  const scheduleId = formData.get('schedule_id') as string;
  const ws = await resolveWorkspace(slug);
  if (!ws) return;

  await aquilaFetch(ws.id, `/schedules/${scheduleId}`, { method: 'DELETE' });
  revalidatePath(`/${slug}/schedules`);
}

export async function toggleSchedule(formData: FormData) {
  const slug = formData.get('workspace') as string;
  const scheduleId = formData.get('schedule_id') as string;
  const enabled = formData.get('enabled') === 'true';
  const ws = await resolveWorkspace(slug);
  if (!ws) return;

  await aquilaFetch(ws.id, `/schedules/${scheduleId}/enable?enabled=${String(enabled)}`, {
    method: 'PATCH',
  });
  revalidatePath(`/${slug}/schedules`);
}
