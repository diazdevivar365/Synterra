import { describe, expect, it } from 'vitest';

import { parseAuthEnv } from './env.js';

const validEnv = {
  BETTER_AUTH_SECRET: 'a'.repeat(32),
  BETTER_AUTH_URL: 'https://app.forgentic.io',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/synterra',
};

describe('parseAuthEnv', () => {
  it('parses valid env', () => {
    const result = parseAuthEnv(validEnv);
    expect(result.BETTER_AUTH_SECRET).toBe(validEnv.BETTER_AUTH_SECRET);
    expect(result.BETTER_AUTH_URL).toBe(validEnv.BETTER_AUTH_URL);
  });

  it('throws when BETTER_AUTH_SECRET is too short', () => {
    expect(() => parseAuthEnv({ ...validEnv, BETTER_AUTH_SECRET: 'short' })).toThrow(
      'at least 32 characters',
    );
  });

  it('throws when BETTER_AUTH_SECRET is missing', () => {
    const { BETTER_AUTH_SECRET: _, ...rest } = validEnv;
    expect(() => parseAuthEnv(rest)).toThrow('Auth env validation failed');
  });

  it('throws when DATABASE_URL is not a valid URL', () => {
    expect(() => parseAuthEnv({ ...validEnv, DATABASE_URL: 'not-a-url' })).toThrow(
      'valid postgres URL',
    );
  });

  it('allows optional OAuth credentials to be absent', () => {
    const result = parseAuthEnv(validEnv);
    expect(result.GOOGLE_CLIENT_ID).toBeUndefined();
    expect(result.GITHUB_CLIENT_ID).toBeUndefined();
    expect(result.RESEND_API_KEY).toBeUndefined();
  });
});
