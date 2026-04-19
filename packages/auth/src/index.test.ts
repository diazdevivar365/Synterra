import { describe, expect, it } from 'vitest';

import { createAuth, type AuthConfig } from './index.js';

const validConfig: AuthConfig = {
  databaseUrl: 'postgres://localhost/synterra',
  secret: 'x'.repeat(32),
  baseUrl: 'http://localhost:3000',
};

describe('@synterra/auth createAuth', () => {
  it('is a function', () => {
    expect(typeof createAuth).toBe('function');
  });

  it('rejects incomplete config', () => {
    expect(() => createAuth({ ...validConfig, databaseUrl: '' })).toThrow(/databaseUrl/);
    expect(() => createAuth({ ...validConfig, secret: '' })).toThrow(/secret/);
    expect(() => createAuth({ ...validConfig, baseUrl: '' })).toThrow(/baseUrl/);
  });

  it('returns an object whose methods reject with the not-yet-wired error', async () => {
    const auth = createAuth(validConfig);
    await expect(auth.signIn()).rejects.toThrow(/not yet configured/);
    await expect(auth.signOut()).rejects.toThrow(/not yet configured/);
    await expect(auth.getSession()).rejects.toThrow(/not yet configured/);
  });
});
