import { describe, expect, it } from 'vitest';

import { PLANS } from './index.js';

describe('@synterra/billing public surface', () => {
  it('exposes PLANS as a (possibly empty) array', () => {
    expect(Array.isArray(PLANS)).toBe(true);
  });
});
