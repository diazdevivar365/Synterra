import { ForbiddenError } from './errors.js';

export type WorkspaceRole = 'owner' | 'admin' | 'manager' | 'editor' | 'viewer' | 'guest';

export type WorkspaceAction =
  | 'workspace:read'
  | 'workspace:update'
  | 'workspace:delete'
  | 'member:invite'
  | 'member:remove'
  | 'member:change-role'
  | 'ownership:transfer';

export const ROLE_HIERARCHY: Record<WorkspaceRole, number> = {
  owner: 100,
  admin: 80,
  manager: 60,
  editor: 40,
  viewer: 20,
  guest: 0,
};

const PERMISSIONS: Record<WorkspaceAction, WorkspaceRole[]> = {
  'workspace:read': ['viewer', 'editor', 'manager', 'admin', 'owner'],
  'workspace:update': ['admin', 'owner'],
  'workspace:delete': ['owner'],
  'member:invite': ['admin', 'owner'],
  'member:remove': ['admin', 'owner'],
  'member:change-role': ['admin', 'owner'],
  'ownership:transfer': ['owner'],
};

export function canDo(role: WorkspaceRole, action: WorkspaceAction): boolean {
  return PERMISSIONS[action].includes(role);
}

export function assertCan(role: WorkspaceRole, action: WorkspaceAction): void {
  if (!canDo(role, action)) {
    throw new ForbiddenError(`Role '${role}' cannot perform '${action}'`);
  }
}
