// Synterra Postgres schema — aggregator module.
//
// The real schema lives one-file-per-domain (workspace.ts, user.ts, billing.ts,
// audit.ts, …) under `./schemas/*` and gets re-exported from here. That layout
// lands in W0-2 per PLAN.md §B.2. Until then this file only exposes a shared
// `timestamps` column helper plus a re-export of `pgTable` so downstream code
// can `import { pgTable, timestamps } from '@synterra/db'` today and keep those
// imports stable through the domain split.

import { sql } from 'drizzle-orm';
import { pgTable, timestamp } from 'drizzle-orm/pg-core';

/**
 * Reusable `created_at` / `updated_at` columns with database-side defaults.
 *
 * Spread into any `pgTable(...)` columns object:
 *   `pgTable('workspace', { id: ..., ...timestamps })`
 */
export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .default(sql`now()`),
} as const;

export { pgTable };
