import { sql } from 'drizzle-orm';
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { workspaces } from './workspaces.js';

export const INFLIGHT_STATUS = [
  'pending',
  'running',
  'preview_ready',
  'claimed',
  'failed',
] as const;
export type InflightStatus = (typeof INFLIGHT_STATUS)[number];

export const inflightBootstrap = pgTable('inflight_bootstrap', {
  id: uuid('id').primaryKey().defaultRandom(),
  urlInput: text('url_input').notNull(),
  email: text('email'),
  aquilaRunId: text('aquila_run_id'),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  status: text('status').notNull().$type<InflightStatus>().default('pending'),
  previewData: jsonb('preview_data'),
  error: text('error'),
  ipHash: text('ip_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  claimedAt: timestamp('claimed_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true })
    .notNull()
    .default(sql`now() + interval '24 hours'`),
});

export type InflightBootstrap = typeof inflightBootstrap.$inferSelect;
export type NewInflightBootstrap = typeof inflightBootstrap.$inferInsert;
