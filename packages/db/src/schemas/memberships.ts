import { sql } from 'drizzle-orm';
import { boolean, index, pgEnum, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

import { users } from './users';
import { workspaces } from './workspaces';

export const workspaceRole = pgEnum('workspace_role', [
  'owner',
  'admin',
  'manager',
  'editor',
  'viewer',
  'guest',
]);

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: workspaceRole('role').notNull().default('editor'),
    invitedBy: uuid('invited_by').references(() => users.id),
    joinedAt: timestamp('joined_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }),
    isDisabled: boolean('is_disabled').notNull().default(false),
  },
  (t) => [
    unique('uq_members_workspace_user').on(t.workspaceId, t.userId),
    index('ix_members_user')
      .on(t.userId)
      .where(sql`NOT is_disabled`),
    index('ix_members_ws')
      .on(t.workspaceId)
      .where(sql`NOT is_disabled`),
  ],
);

export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
export type NewWorkspaceMember = typeof workspaceMembers.$inferInsert;
