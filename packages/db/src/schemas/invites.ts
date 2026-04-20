import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { workspaceRole } from './memberships';
import { users } from './users';
import { workspaces } from './workspaces';

export const invites = pgTable('invites', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  // CITEXT in DB — TEXT here is sufficient for type inference.
  email: text('email').notNull(),
  role: workspaceRole('role').notNull().default('editor'),
  invitedBy: uuid('invited_by')
    .notNull()
    .references(() => users.id),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export type Invite = typeof invites.$inferSelect;
export type NewInvite = typeof invites.$inferInsert;
