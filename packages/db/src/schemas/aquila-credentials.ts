import { sql } from 'drizzle-orm';
import { customType, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

import { workspaces } from './workspaces.js';

// BYTEA custom type for the envelope-encrypted API key secret.
const bytea = customType<{ data: Buffer; notNull: true; default: false }>({
  dataType: () => 'bytea',
  toDriver: (v) => v,
  fromDriver: (v) => v as Buffer,
});

export const aquilaCredentials = pgTable('aquila_credentials', {
  workspaceId: uuid('workspace_id')
    .primaryKey()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  apiKeyId: uuid('api_key_id').notNull(),
  apiKeyPrefix: varchar('api_key_prefix', { length: 16 }).notNull(),
  // Envelope-encrypted secret — plaintext NEVER stored.
  apiKeySecretEnc: bytea('api_key_secret_enc').notNull(),
  scopes: text('scopes')
    .array()
    .notNull()
    .default(sql`'{*}'::text[]`),
  lastRotatedAt: timestamp('last_rotated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export type AquilaCredential = typeof aquilaCredentials.$inferSelect;
export type NewAquilaCredential = typeof aquilaCredentials.$inferInsert;
