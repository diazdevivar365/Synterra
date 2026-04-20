import { describe, expect, it } from 'vitest';

import { QUEUE_NAMES } from './queues.js';

describe('QUEUE_NAMES.NOTIFICATIONS invariant', () => {
  it('does not contain a colon', () => {
    expect(QUEUE_NAMES.NOTIFICATIONS).not.toContain(':');
  });

  it('has the expected stable value', () => {
    expect(QUEUE_NAMES.NOTIFICATIONS).toBe('synterra-notifications');
  });
});
