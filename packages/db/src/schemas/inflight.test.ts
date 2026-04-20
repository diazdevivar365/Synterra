import { describe, expect, it } from 'vitest';

import { INFLIGHT_STATUS, inflightBootstrap } from './inflight.js';

describe('inflightBootstrap schema', () => {
  it('exports INFLIGHT_STATUS tuple', () => {
    expect(INFLIGHT_STATUS).toEqual(['pending', 'running', 'preview_ready', 'claimed', 'failed']);
  });

  it('inflightBootstrap table is defined with correct columns', () => {
    expect(inflightBootstrap).toBeDefined();
    // Verify key columns exist on the schema
    expect(inflightBootstrap.id).toBeDefined();
    expect(inflightBootstrap.urlInput).toBeDefined();
    expect(inflightBootstrap.status).toBeDefined();
    expect(inflightBootstrap.ipHash).toBeDefined();
  });
});
