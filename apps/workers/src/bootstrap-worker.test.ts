import { describe, expect, it, vi } from 'vitest';

import type { BootstrapAnonJobData } from './queues.js';
import type { Job } from 'bullmq';

vi.mock('@synterra/aquila-client', () => ({
  createAquilaClient: vi.fn().mockReturnValue({
    createResearchRun: vi.fn().mockResolvedValue({
      id: 'run-abc',
      status: 'queued',
      organizationId: 'anon-org',
      query: 'https://acme.com',
      createdAt: '2026-04-20T00:00:00Z',
      completedAt: null,
    }),
    getResearchRun: vi.fn().mockResolvedValue({
      id: 'run-abc',
      status: 'succeeded',
      organizationId: 'anon-org',
      query: 'https://acme.com',
      createdAt: '2026-04-20T00:00:00Z',
      completedAt: '2026-04-20T00:01:10Z',
    }),
  }),
  SUPPORTED_CONTRACT_VERSION: '2026-04',
}));

const mockWhere = vi.fn().mockResolvedValue([]);
const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });

vi.mock('@synterra/db', () => ({
  createDb: vi.fn().mockReturnValue({ update: mockUpdate }),
  inflightBootstrap: {},
}));

vi.mock('./config.js', () => ({
  env: {
    DATABASE_URL: 'postgres://test',
    AQUILA_BASE_URL: 'http://aquila',
    AQUILA_ANON_API_KEY: 'anon-key',
    AQUILA_ANON_ORG_SLUG: 'synterra_anon',
    AQUILA_ANON_ORG_ID: 'anon-org-id',
  },
}));

vi.mock('./logger.js', () => ({
  default: { info: vi.fn(), error: vi.fn() },
}));

describe('bootstrapAnonHandler', () => {
  it('calls createResearchRun with urlInput as query and marks preview_ready on success', async () => {
    // Override setTimeout to avoid actual 4s wait
    vi.useFakeTimers();

    const { bootstrapAnonHandler } = await import('./bootstrap-worker.js');
    const { createAquilaClient } = await import('@synterra/aquila-client');

    const job = {
      id: 'job-1',
      name: 'bootstrap-anon',
      data: { inflightId: 'if-1', urlInput: 'https://acme.com' },
    } as Job<BootstrapAnonJobData>;

    const handlerPromise = bootstrapAnonHandler(job);
    // Advance past the first poll interval
    await vi.runAllTimersAsync();
    await handlerPromise;

    const client = vi.mocked(createAquilaClient).mock.results[0]!.value;
    expect(client.createResearchRun).toHaveBeenCalledWith(
      'anon-org-id',
      expect.objectContaining({ query: 'https://acme.com' }),
    );
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ status: 'preview_ready' }));

    vi.useRealTimers();
  });
});
