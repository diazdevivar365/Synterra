import { describe, expect, it } from 'vitest';

import { buildAuditEntry } from './audit';

describe('buildAuditEntry', () => {
  it('builds entry for a user actor', () => {
    const entry = buildAuditEntry({
      workspaceId: 'ws-1',
      actorUserId: 'u-1',
      action: 'workspace.update',
      resourceType: 'workspace',
      resourceId: 'ws-1',
      before: { name: 'Old' },
      after: { name: 'New' },
    });
    expect(entry.workspaceId).toBe('ws-1');
    expect(entry.actorUserId).toBe('u-1');
    expect(entry.actorKind).toBe('user');
    expect(entry.action).toBe('workspace.update');
    expect(entry.before).toEqual({ name: 'Old' });
    expect(entry.after).toEqual({ name: 'New' });
  });

  it('sets actorKind=system when no actorUserId', () => {
    const entry = buildAuditEntry({ workspaceId: 'ws-1', action: 'workspace.provisioned' });
    expect(entry.actorKind).toBe('system');
    expect(entry.actorUserId).toBeUndefined();
  });
});
