import { describe, expect, it } from 'vitest';

import { createDb, timestamps } from './index.js';

describe('@synterra/db public surface', () => {
  it('exposes createDb as a function', () => {
    expect(typeof createDb).toBe('function');
  });

  it('rejects an empty connection string', () => {
    expect(() => createDb('')).toThrow(/connectionString is required/i);
  });

  it('timestamps helper has createdAt + updatedAt columns', () => {
    expect(timestamps).toHaveProperty('createdAt');
    expect(timestamps).toHaveProperty('updatedAt');
  });
});
