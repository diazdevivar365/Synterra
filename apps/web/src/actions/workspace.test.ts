import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../lib/session', () => ({ getSessionOrThrow: vi.fn() }));

// Mock DB dependencies so Vitest doesn't need a real Postgres connection.
// Tests only exercise validation and RBAC paths — no DB calls are reached.
vi.mock('@synterra/db', () => ({
  createDb: vi.fn(() => ({})),
  withWorkspaceContext: vi.fn(),
  workspaces: {},
  workspaceMembers: {},
  auditLog: {},
}));
vi.mock('drizzle-orm', () => ({ eq: vi.fn() }));

// eslint-disable-next-line import/order -- vi.mock hoisting requires mocks before named imports
import { getSessionOrThrow } from '../lib/session';
import { createWorkspace, updateWorkspaceSettings } from './workspace';

const mockSession = { userId: 'user-1', email: 'a@b.com' };
beforeEach(() => vi.mocked(getSessionOrThrow).mockResolvedValue(mockSession));

describe('createWorkspace', () => {
  it('returns VALIDATION when name is empty', async () => {
    const result = await createWorkspace({ name: '', slug: 'my-ws' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('VALIDATION');
  });

  it('returns VALIDATION when slug has invalid chars', async () => {
    const result = await createWorkspace({ name: 'My WS', slug: 'My WS!' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('VALIDATION');
  });

  it('returns VALIDATION when slug is too short', async () => {
    const result = await createWorkspace({ name: 'My WS', slug: 'ab' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('VALIDATION');
  });
});

describe('updateWorkspaceSettings', () => {
  it('returns FORBIDDEN when caller is viewer', async () => {
    const result = await updateWorkspaceSettings({
      workspaceId: 'ws-1',
      callerRole: 'viewer',
      name: 'New Name',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('FORBIDDEN');
  });

  it('returns FORBIDDEN when caller is guest', async () => {
    const result = await updateWorkspaceSettings({
      workspaceId: 'ws-1',
      callerRole: 'guest',
      name: 'New Name',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('FORBIDDEN');
  });
});
