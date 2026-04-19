// Public entrypoint for `@synterra/db`.

export { createDb, type CreateDbOptions, type Database } from './client.js';
export { withWorkspaceContext, serviceRoleQuery, type WorkspaceContext } from './context.js';
export * from './schema.js';
