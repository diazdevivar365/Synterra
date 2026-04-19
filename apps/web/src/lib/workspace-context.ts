import 'server-only';

import { headers } from 'next/headers';

import type { WorkspaceRole } from '@synterra/auth';

export interface WorkspaceContext {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  slug: string;
}

export async function getWorkspaceContext(): Promise<WorkspaceContext | null> {
  const h = await headers();
  const workspaceId = h.get('x-workspace-id');
  const userId = h.get('x-user-id');
  const role = h.get('x-workspace-role') as WorkspaceRole | null;
  const slug = h.get('x-workspace-slug');

  if (!workspaceId || !userId || !role || !slug) return null;

  return { workspaceId, userId, role, slug };
}
