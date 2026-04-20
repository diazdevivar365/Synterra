const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyTurnstileToken(token: string, ip: string): Promise<boolean> {
  const secret = process.env['CLOUDFLARE_TURNSTILE_SECRET_KEY'];
  if (!secret) throw new Error('CLOUDFLARE_TURNSTILE_SECRET_KEY is not set');

  const body = new URLSearchParams({ secret, response: token, remoteip: ip });
  const res = await fetch(TURNSTILE_VERIFY_URL, { method: 'POST', body });
  const data = (await res.json()) as { success: boolean };
  return data.success;
}
