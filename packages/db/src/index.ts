// Public entrypoint for `@synterra/db`.
//
// - Drizzle client factory (`createDb`) + `Database` type alias
// - Schema helpers (`timestamps`, `pgTable` re-export) until the one-file-per-
//   domain split lands in W0-2 (see PLAN.md §B.2).

export { createDb, type CreateDbOptions, type Database } from './client.js';
export { timestamps, pgTable } from './schema.js';
