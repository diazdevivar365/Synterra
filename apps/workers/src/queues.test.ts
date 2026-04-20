import { describe, expect, it } from 'vitest';

import { QUEUE_NAMES } from './queues.js';

describe('QUEUE_NAMES', () => {
  it('has BOOTSTRAP_ANON queue name', () => {
    expect(QUEUE_NAMES.BOOTSTRAP_ANON).toBe('synterra-bootstrap-anon');
  });
});
