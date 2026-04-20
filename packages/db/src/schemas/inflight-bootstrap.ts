import { sql } from 'drizzle-orm';
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { users } from './users';
import { workspaces } from './workspaces';

export const inflightBootstrap = pgTable('inflight_bootstrap', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  sessionId: text('session_id').notNull().unique(),
  url: text('url').notNull(),
  ip: text('ip'),
  email: text('email'),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'set null' }),
  aquilaRunId: text('aquila_run_id'),
  result: jsonb('result'),
  status: text('status').notNull().default('pending'),
  expiresAt: timestamp('expires_at', { withTimezone: true })
    .notNull()
    .default(sql`now() + INTERVAL '24 hours'`),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export type InflightBootstrap = typeof inflightBootstrap.$inferSelect;
export type NewInflightBootstrap = typeof inflightBootstrap.$inferInsert;
