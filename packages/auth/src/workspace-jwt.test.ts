import { describe, expect, it } from 'vitest';

import { signWorkspaceJwt, verifyWorkspaceJwt, type WorkspaceJwtPayload } from './workspace-jwt';

const SECRET = 'test-secret-at-least-32-bytes-long!!';
const PAYLOAD: WorkspaceJwtPayload = {
  workspaceId: '018e1234-0000-7000-8000-000000000001',
  userId: '018e1234-0000-7000-8000-000000000002',
  role: 'editor',
  slug: 'acme-corp',
};

describe('signWorkspaceJwt', () => {
  it('returns a JWT string with three parts', async () => {
    const token = await signWorkspaceJwt(PAYLOAD, SECRET);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });
});

describe('verifyWorkspaceJwt', () => {
  it('round-trips the payload', async () => {
    const token = await signWorkspaceJwt(PAYLOAD, SECRET);
    const result = await verifyWorkspaceJwt(token, SECRET);
    expect(result.workspaceId).toBe(PAYLOAD.workspaceId);
    expect(result.userId).toBe(PAYLOAD.userId);
    expect(result.role).toBe(PAYLOAD.role);
    expect(result.slug).toBe(PAYLOAD.slug);
  });

  it('throws on tampered token', async () => {
    const token = await signWorkspaceJwt(PAYLOAD, SECRET);
    const tampered = token.slice(0, -4) + 'XXXX';
    await expect(verifyWorkspaceJwt(tampered, SECRET)).rejects.toThrow();
  });

  it('throws on wrong secret', async () => {
    const token = await signWorkspaceJwt(PAYLOAD, SECRET);
    await expect(verifyWorkspaceJwt(token, 'wrong-secret-xxxxxxxxxxxxxxxxxxxxx')).rejects.toThrow();
  });

  it('throws on expired token', async () => {
    const token = await signWorkspaceJwt(PAYLOAD, SECRET, { expiresIn: '-1s' });
    await expect(verifyWorkspaceJwt(token, SECRET)).rejects.toThrow();
  });
});
