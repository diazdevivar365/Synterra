import { sql } from 'drizzle-orm';
import { index, inet, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

// Partitioned compliance-grade audit log. PARTITION BY RANGE(created_at) is in
// migration 0009 — Drizzle ORM uses this definition for type inference only.
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id').notNull(),
    actorUserId: uuid('actor_user_id'),
    actorKind: varchar('actor_kind', { length: 20 }).notNull(),
    action: varchar('action', { length: 80 }).notNull(),
    resourceType: varchar('resource_type', { length: 40 }),
    resourceId: text('resource_id'),
    before: jsonb('before'),
    after: jsonb('after'),
    ip: inet('ip'),
    userAgent: text('user_agent'),
    requestId: text('request_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index('ix_audit_ws_time').on(t.workspaceId, t.createdAt),
    index('ix_audit_actor').on(t.actorUserId, t.createdAt),
  ],
);

export type AuditLogEntry = typeof auditLog.$inferSelect;
export type NewAuditLogEntry = typeof auditLog.$inferInsert;
