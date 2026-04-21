import { createRemoteJWKSet, jwtVerify } from 'jose';

export interface AdminIdentity {
  email: string;
  sub: string;
}

// Cache the JWKS fetcher for the process lifetime — jose handles key rotation internally.
let _jwks: ReturnType<typeof createRemoteJWKSet> | undefined;
function getJwks(teamDomain: string): ReturnType<typeof createRemoteJWKSet> {
  _jwks ??= createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`));
  return _jwks;
}

/**
 * Verifies the Cloudflare Access JWT from the `Cf-Access-Jwt-Assertion` header.
 * Returns admin identity on success, null if token is missing or invalid.
 *
 * Required env vars:
 *   CF_ACCESS_TEAM_DOMAIN — e.g. "forgentic.cloudflareaccess.com"
 *   CF_ACCESS_AUD         — Application AUD tag from CF Access dashboard
 */
export async function verifyCloudflareAccess(headers: Headers): Promise<AdminIdentity | null> {
  const teamDomain = process.env['CF_ACCESS_TEAM_DOMAIN'];
  const aud = process.env['CF_ACCESS_AUD'];

  if (!teamDomain || !aud) return null;

  const token = headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getJwks(teamDomain), {
      audience: aud,
      issuer: `https://${teamDomain}`,
    });

    const email = typeof payload['email'] === 'string' ? payload['email'] : null;
    const sub = typeof payload.sub === 'string' ? payload.sub : null;

    if (!email || !sub) return null;

    return { email, sub };
  } catch {
    return null;
  }
}
