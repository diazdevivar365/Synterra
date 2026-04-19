import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { workspaces } from './workspaces.js';

export const ssoConnections = pgTable(
  'sso_connections',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    workosOrganizationId: varchar('workos_organization_id', { length: 80 }).notNull(),
    workosConnectionId: varchar('workos_connection_id', { length: 80 }),
    workosDirectoryId: varchar('workos_directory_id', { length: 80 }),
    domain: varchar('domain', { length: 253 }).notNull(),
    enabled: boolean('enabled').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [uniqueIndex('uq_sso_workspace').on(t.workspaceId), index('ix_sso_domain').on(t.domain)],
);

export type SsoConnection = typeof ssoConnections.$inferSelect;
export type NewSsoConnection = typeof ssoConnections.$inferInsert;
