import { describe, expect, it, vi, beforeEach } from 'vitest';

// vi.hoisted — variables declared here are available inside vi.mock factories
// (which are hoisted to the top of the file by Vitest's transform).
const { mockAdd, mockDbInsert } = vi.hoisted(() => {
  const dbChain: Record<string, ReturnType<typeof vi.fn>> = {
    values: vi.fn(),
    returning: vi.fn(),
    onConflictDoNothing: vi.fn().mockResolvedValue([{ id: 'ws-1' }]),
  };
  dbChain['values']!.mockReturnValue(dbChain);
  dbChain['returning']!.mockReturnValue(dbChain);

  return {
    mockDbInsert: vi.fn(() => dbChain),
    mockAdd: vi.fn().mockResolvedValue({ id: 'job-1' }),
  };
});

vi.mock('../lib/session', () => ({ getSessionOrThrow: vi.fn() }));
vi.mock('../lib/queue', () => ({ getProvisionQueue: vi.fn(() => ({ add: mockAdd })) }));
vi.mock('@synterra/db', () => ({
  createDb: vi.fn(() => ({ insert: mockDbInsert })),
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
  it('enqueues a provision job on success', async () => {
    mockAdd.mockClear();
    const result = await createWorkspace({ name: 'Acme Corp', slug: 'acme-corp' });
    expect(result.ok).toBe(true);
    expect(mockAdd).toHaveBeenCalledWith(
      'provision',
      expect.objectContaining({ workspaceId: 'ws-1', workspaceSlug: 'acme-corp' }),
    );
  });

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
