import { getTableName } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { INFLIGHT_STATUS, inflightBootstrap } from './inflight.js';

describe('inflightBootstrap schema', () => {
  it('exports INFLIGHT_STATUS with correct values', () => {
    expect(INFLIGHT_STATUS).toEqual(['pending', 'running', 'preview_ready', 'claimed', 'failed']);
  });

  it('table name is inflight_bootstrap', () => {
    expect(getTableName(inflightBootstrap)).toBe('inflight_bootstrap');
  });

  it('has required non-nullable columns', () => {
    const cols = inflightBootstrap;
    // These columns must exist on the table object
    expect(cols.id).toBeDefined();
    expect(cols.urlInput).toBeDefined();
    expect(cols.ipHash).toBeDefined();
    expect(cols.status).toBeDefined();
    expect(cols.createdAt).toBeDefined();
    expect(cols.expiresAt).toBeDefined();
  });

  it('has nullable optional columns', () => {
    const cols = inflightBootstrap;
    expect(cols.email).toBeDefined();
    expect(cols.aquilaRunId).toBeDefined();
    expect(cols.workspaceId).toBeDefined();
    expect(cols.previewData).toBeDefined();
    expect(cols.error).toBeDefined();
    expect(cols.claimedAt).toBeDefined();
  });
});
