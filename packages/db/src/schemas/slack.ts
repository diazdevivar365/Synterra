import { sql } from 'drizzle-orm';
import { boolean, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

import { workspaces } from './workspaces';

export const slackConnections = pgTable('slack_connections', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  workspaceId: uuid('workspace_id')
    .notNull()
    .unique()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  teamId: varchar('team_id', { length: 20 }).notNull(),
  teamName: varchar('team_name', { length: 100 }).notNull(),
  encryptedBotToken: text('encrypted_bot_token').notNull(),
  defaultChannelId: varchar('default_channel_id', { length: 20 }).notNull(),
  defaultChannelName: varchar('default_channel_name', { length: 100 }).notNull(),
  isEnabled: boolean('is_enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export type SlackConnection = typeof slackConnections.$inferSelect;
export type NewSlackConnection = typeof slackConnections.$inferInsert;
