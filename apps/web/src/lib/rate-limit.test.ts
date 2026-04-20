import { describe, expect, it, vi } from 'vitest';

describe('checkRateLimit', () => {
  it('allows first request and returns remaining=2', async () => {
    const redisMock = {
      incr: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
    };
    const { checkRateLimit } = await import('./rate-limit.js');
    const result = await checkRateLimit(redisMock as never, '1.2.3.4');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
    expect(redisMock.expire).toHaveBeenCalledWith(
      expect.stringContaining('ratelimit:onboarding:'),
      3600,
    );
  });

  it('blocks 4th request', async () => {
    const redisMock = {
      incr: vi.fn().mockResolvedValue(4),
      expire: vi.fn().mockResolvedValue(1),
    };
    const { checkRateLimit } = await import('./rate-limit.js');
    const result = await checkRateLimit(redisMock as never, '1.2.3.4');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });
});
