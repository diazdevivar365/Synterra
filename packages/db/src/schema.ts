// Aggregator — re-exports all Synterra domain schemas.
// Every table/type lives in src/schemas/<domain>.ts; import from here.

export { timestamps } from './timestamps';
export { pgTable } from 'drizzle-orm/pg-core';

// Domain schemas
export * from './schemas/users';
export * from './schemas/workspaces';
export * from './schemas/memberships';
export * from './schemas/invites';
export * from './schemas/aquila-credentials';
export * from './schemas/billing';
export * from './schemas/usage';
export * from './schemas/quota';
export * from './schemas/audit';
export * from './schemas/notifications';
export * from './schemas/public-api-keys';
export * from './schemas/webhooks';
export * from './schemas/auth';
export * from './schemas/sso';
export * from './schemas/inflight-bootstrap';
export * from './schemas/brand-changes';
export * from './schemas/slack';
export * from './schemas/brand-pins';
