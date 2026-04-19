// Vitest stub for `server-only`.
// In production Next.js builds this package throws when imported from a
// Client Component. In the Vitest node environment (no Next.js runtime) we
// simply no-op so server-only modules can be unit-tested directly.
export {};
