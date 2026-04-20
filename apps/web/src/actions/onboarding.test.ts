import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/turnstile.js', () => ({
  verifyTurnstileToken: vi.fn().mockResolvedValue(true),
}));
vi.mock('../lib/rate-limit.js', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 2 }),
}));
vi.mock('../lib/queue.js', () => ({
  getBootstrapAnonQueue: vi.fn().mockReturnValue({
    add: vi.fn().mockResolvedValue({ id: 'job-1' }),
  }),
}));
vi.mock('@synterra/db', () => ({
  createDb: vi.fn().mockReturnValue({
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'inflight-uuid-1' }]),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ status: 'preview_ready', workspaceId: null }]),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  }),
  inflightBootstrap: {},
}));
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Map([['cf-connecting-ip', '1.2.3.4']])),
}));
vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(() => ({
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
  })),
}));

describe('startOnboarding', () => {
  it('returns ok=true with inflightId for valid URL', async () => {
    const { startOnboarding } = await import('./onboarding.js');
    const result = await startOnboarding('example.com', 'valid-token');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.inflightId).toBe('inflight-uuid-1');
  });

  it('returns INVALID_URL for garbage input', async () => {
    const { startOnboarding } = await import('./onboarding.js');
    const result = await startOnboarding('not a url !!!', 'token');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('INVALID_URL');
  });

  it('returns RATE_LIMITED when checkRateLimit disallows', async () => {
    const { checkRateLimit } = await import('../lib/rate-limit.js');
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ allowed: false, remaining: 0 });
    const { startOnboarding } = await import('./onboarding.js');
    const result = await startOnboarding('valid.com', 'token');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('RATE_LIMITED');
  });
});

describe('claimOnboarding', () => {
  it('returns ok=true for a preview_ready inflight', async () => {
    const { claimOnboarding } = await import('./onboarding.js');
    const result = await claimOnboarding('inflight-uuid-1', 'workspace-uuid-1');
    expect(result.ok).toBe(true);
  });
});
