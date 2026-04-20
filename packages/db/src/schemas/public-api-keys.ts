import { sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

import { users } from './users';
import { workspaces } from './workspaces';

export const publicApiKeys = pgTable(
  'public_api_keys',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    name: text('name').notNull(),
    keyHash: text('key_hash').notNull().unique(),
    keyPrefix: varchar('key_prefix', { length: 16 }).notNull(),
    scopes: text('scopes')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index('ix_pk_workspace')
      .on(t.workspaceId)
      .where(sql`revoked_at IS NULL`),
  ],
);

export type PublicApiKey = typeof publicApiKeys.$inferSelect;
export type NewPublicApiKey = typeof publicApiKeys.$inferInsert;
