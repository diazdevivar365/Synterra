import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../lib/session', () => ({ getSessionOrThrow: vi.fn() }));

// Mock DB dependencies so Vitest doesn't need a real Postgres connection.
// Tests only exercise RBAC paths — no DB calls are reached.
vi.mock('@synterra/db', () => ({
  createDb: vi.fn(() => ({})),
  withWorkspaceContext: vi.fn(),
  workspaceMembers: {},
  invites: {},
  auditLog: {},
}));
vi.mock('drizzle-orm', () => ({ eq: vi.fn(), and: vi.fn() }));

// eslint-disable-next-line import/order -- vi.mock hoisting requires mocks before named imports
import { getSessionOrThrow } from '../lib/session';
import { changeMemberRole, removeMember, transferOwnership } from './members';

const mockSession = { userId: 'user-1', email: 'a@b.com' };
beforeEach(() => vi.mocked(getSessionOrThrow).mockResolvedValue(mockSession));

describe('changeMemberRole', () => {
  it('guest cannot change roles', async () => {
    const result = await changeMemberRole({
      workspaceId: 'ws-1',
      callerRole: 'guest',
      targetUserId: 'user-2',
      newRole: 'editor',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('FORBIDDEN');
  });

  it('admin cannot promote to owner', async () => {
    const result = await changeMemberRole({
      workspaceId: 'ws-1',
      callerRole: 'admin',
      targetUserId: 'user-2',
      newRole: 'owner',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('FORBIDDEN');
  });
});

describe('removeMember', () => {
  it('viewer cannot remove members', async () => {
    const result = await removeMember({
      workspaceId: 'ws-1',
      callerRole: 'viewer',
      targetUserId: 'user-2',
      targetRole: 'editor',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('FORBIDDEN');
  });

  it('cannot remove owner', async () => {
    const result = await removeMember({
      workspaceId: 'ws-1',
      callerRole: 'admin',
      targetUserId: 'user-2',
      targetRole: 'owner',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('FORBIDDEN');
  });
});

describe('transferOwnership', () => {
  it('admin cannot transfer ownership', async () => {
    const result = await transferOwnership({
      workspaceId: 'ws-1',
      callerRole: 'admin',
      newOwnerUserId: 'user-2',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('FORBIDDEN');
  });
});
