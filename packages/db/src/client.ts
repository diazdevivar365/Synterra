// Typed Drizzle client factory.
//
// `createDb(connectionString)` builds a postgres-js pool bounded to sane
// local-dev defaults and wraps it with drizzle-orm. The function is lazy: no
// TCP connection is opened until the first query runs, which keeps module
// import cheap for tests and one-shot CLIs.

import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

export interface CreateDbOptions {
  /** Max pooled connections. Matches api/workers defaults in PLAN.md §M.1. */
  max?: number;
  /** Seconds an idle connection lives before eviction. */
  idleTimeout?: number;
}

const DEFAULTS: Required<CreateDbOptions> = {
  max: 10,
  idleTimeout: 30,
};

/**
 * Build a drizzle-orm client backed by postgres-js. Safe to call at module
 * scope — no connection is opened until a query executes.
 */
export function createDb(
  connectionString: string,
  options: CreateDbOptions = {},
): PostgresJsDatabase {
  if (!connectionString) {
    throw new Error('createDb: connectionString is required');
  }
  const merged = { ...DEFAULTS, ...options };
  const sql = postgres(connectionString, {
    max: merged.max,
    idle_timeout: merged.idleTimeout,
  });
  return drizzle(sql);
}

export type Database = ReturnType<typeof createDb>;
