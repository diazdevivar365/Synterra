// @synterra/auth — authentication surface for the Synterra control plane.
//
// Wraps `better-auth` (decision logged in PLAN.md §C.1). The real wiring —
// Drizzle adapter, WorkOS proxy for enterprise SSO, session cookies, email
// OTP — lands in W1-1. Until then `createAuth` returns a typed stub so
// downstream packages can depend on the shape.

const NOT_WIRED = 'auth not yet configured — see W1-1';

export interface AuthConfig {
  /** Postgres connection string used by the better-auth Drizzle adapter. */
  databaseUrl: string;
  /** HMAC secret for signing session cookies. 32+ bytes. */
  secret: string;
  /** Canonical base URL (e.g. `https://app.forgentic.io`). */
  baseUrl: string;
}

export interface Session {
  userId: string;
  expiresAt: Date;
}

export interface AuthClient {
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  getSession(): Promise<Session | null>;
}

/**
 * Build an auth client for the given config. Currently a stub — every method
 * rejects with a clear error pointing at W1-1. The config is still validated
 * at call time so misconfiguration is caught before downstream consumers hit
 * the stubbed methods.
 */
export function createAuth(config: AuthConfig): AuthClient {
  if (!config.databaseUrl) throw new Error('createAuth: databaseUrl is required');
  if (!config.secret) throw new Error('createAuth: secret is required');
  if (!config.baseUrl) throw new Error('createAuth: baseUrl is required');

  // Rejected-promise factories — sync bodies so ESLint's require-await is
  // satisfied while still returning `Promise<T>` per the `AuthClient`
  // interface contract.
  const notWired = (): Promise<never> => Promise.reject(new Error(NOT_WIRED));

  return {
    signIn: notWired,
    signOut: notWired,
    getSession: notWired,
  };
}
