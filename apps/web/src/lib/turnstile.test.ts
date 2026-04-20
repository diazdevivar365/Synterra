import { describe, expect, it, vi } from 'vitest';

describe('verifyTurnstileToken', () => {
  it('returns true on success:true response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ json: vi.fn().mockResolvedValue({ success: true }) }),
    );
    process.env['CLOUDFLARE_TURNSTILE_SECRET_KEY'] = 'test-secret';
    const { verifyTurnstileToken } = await import('./turnstile.js');
    expect(await verifyTurnstileToken('valid-token', '1.2.3.4')).toBe(true);
    vi.unstubAllGlobals();
  });

  it('returns false on success:false response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ json: vi.fn().mockResolvedValue({ success: false }) }),
    );
    process.env['CLOUDFLARE_TURNSTILE_SECRET_KEY'] = 'test-secret';
    const { verifyTurnstileToken } = await import('./turnstile.js');
    expect(await verifyTurnstileToken('bad-token', '1.2.3.4')).toBe(false);
    vi.unstubAllGlobals();
  });
});
