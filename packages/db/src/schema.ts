// Aggregator — re-exports all Synterra domain schemas.
// Every table/type lives in src/schemas/<domain>.ts; import from here.

export { timestamps } from './timestamps.js';
export { pgTable } from 'drizzle-orm/pg-core';

// Domain schemas
export * from './schemas/users.js';
export * from './schemas/workspaces.js';
export * from './schemas/memberships.js';
export * from './schemas/invites.js';
export * from './schemas/aquila-credentials.js';
export * from './schemas/billing.js';
export * from './schemas/usage.js';
export * from './schemas/quota.js';
export * from './schemas/audit.js';
export * from './schemas/notifications.js';
export * from './schemas/public-api-keys.js';
export * from './schemas/webhooks.js';
export * from './schemas/auth.js';
export * from './schemas/sso.js';
export * from './schemas/inflight.js';
