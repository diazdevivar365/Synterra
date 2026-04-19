import { describe, expect, it } from 'vitest';

import { parseAuthEnv } from './index.js';

describe('@synterra/auth public exports', () => {
  it('exports parseAuthEnv', () => {
    expect(typeof parseAuthEnv).toBe('function');
  });

  it('parseAuthEnv throws on empty env', () => {
    expect(() => parseAuthEnv({})).toThrow('Auth env validation failed');
  });
});
