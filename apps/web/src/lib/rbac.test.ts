import { describe, expect, it } from 'vitest';

import { ForbiddenError } from './errors';
import { assertCan, canDo, ROLE_HIERARCHY } from './rbac';

describe('ROLE_HIERARCHY', () => {
  it('owner > admin > manager > editor > viewer > guest', () => {
    expect(ROLE_HIERARCHY.owner).toBeGreaterThan(ROLE_HIERARCHY.admin);
    expect(ROLE_HIERARCHY.admin).toBeGreaterThan(ROLE_HIERARCHY.manager);
    expect(ROLE_HIERARCHY.manager).toBeGreaterThan(ROLE_HIERARCHY.editor);
    expect(ROLE_HIERARCHY.editor).toBeGreaterThan(ROLE_HIERARCHY.viewer);
    expect(ROLE_HIERARCHY.viewer).toBeGreaterThan(ROLE_HIERARCHY.guest);
  });
});

describe('canDo', () => {
  it('owner can do everything', () => {
    expect(canDo('owner', 'workspace:update')).toBe(true);
    expect(canDo('owner', 'workspace:delete')).toBe(true);
    expect(canDo('owner', 'ownership:transfer')).toBe(true);
  });

  it('admin can invite + update but not delete workspace or transfer ownership', () => {
    expect(canDo('admin', 'member:invite')).toBe(true);
    expect(canDo('admin', 'workspace:update')).toBe(true);
    expect(canDo('admin', 'workspace:delete')).toBe(false);
    expect(canDo('admin', 'ownership:transfer')).toBe(false);
  });

  it('viewer can only read', () => {
    expect(canDo('viewer', 'workspace:read')).toBe(true);
    expect(canDo('viewer', 'member:invite')).toBe(false);
  });

  it('guest cannot read workspace', () => {
    expect(canDo('guest', 'workspace:read')).toBe(false);
  });
});

describe('assertCan', () => {
  it('throws ForbiddenError when not permitted', () => {
    expect(() => assertCan('viewer', 'member:invite')).toThrow(ForbiddenError);
  });

  it('does not throw when permitted', () => {
    expect(() => assertCan('admin', 'member:invite')).not.toThrow();
  });
});
