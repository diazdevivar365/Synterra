import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    }),
  },
}));

vi.mock('@synterra/db', () => ({
  ssoConnections: {},
  workspaces: {},
}));

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      signInMagicLink: vi.fn().mockResolvedValue({ status: true }),
    },
  },
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

describe('sendMagicLink', () => {
  it('calls auth.api.signInMagicLink with email from FormData', async () => {
    const { sendMagicLink } = await import('./_actions.js');
    const { auth } = await import('@/lib/auth');

    const formData = new FormData();
    formData.set('email', 'test@forgentic.io');

    await sendMagicLink(formData);

    expect((auth.api as any).signInMagicLink).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ email: 'test@forgentic.io' }),
      }),
    );
  });

  it('throws on invalid email', async () => {
    const { sendMagicLink } = await import('./_actions.js');
    const formData = new FormData();
    formData.set('email', 'not-an-email');

    await expect(sendMagicLink(formData)).rejects.toThrow('valid email');
  });

  it('sets callbackURL to /dashboard?inflight=<id> when inflight is provided', async () => {
    const { sendMagicLink } = await import('./_actions.js');
    const { auth } = await import('@/lib/auth');

    const formData = new FormData();
    formData.set('email', 'user@forgentic.io');
    formData.set('inflight', 'abc-123');

    await sendMagicLink(formData);

    expect((auth.api as any).signInMagicLink).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ callbackURL: '/dashboard?inflight=abc-123' }),
      }),
    );
  });

  it('sets callbackURL to /dashboard when inflight is empty', async () => {
    const { sendMagicLink } = await import('./_actions.js');
    const { auth } = await import('@/lib/auth');

    const formData = new FormData();
    formData.set('email', 'user@forgentic.io');
    formData.set('inflight', '');

    await sendMagicLink(formData);

    expect((auth.api as any).signInMagicLink).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ callbackURL: '/dashboard' }),
      }),
    );
  });
});
