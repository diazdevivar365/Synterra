import { sql } from 'drizzle-orm';

import type { Database } from './client';

export interface WorkspaceContext {
  workspaceId: string;
  userId?: string;
}

/**
 * Wraps a Drizzle transaction with per-request Postgres session variables so
 * that RLS policies on every tenant-scoped table automatically filter to the
 * right workspace.
 *
 * Usage:
 *   const rows = await withWorkspaceContext(db, { workspaceId, userId }, (tx) =>
 *     tx.select().from(workspaces),
 *   );
 */
export async function withWorkspaceContext<T>(
  db: Database,
  ctx: WorkspaceContext,
  fn: (db: Database) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('synterra.workspace_id', ${ctx.workspaceId}, true)`);
    if (ctx.userId) {
      await tx.execute(sql`SELECT set_config('synterra.user_id', ${ctx.userId}, true)`);
    }
    return fn(tx as unknown as Database);
  });
}

/**
 * Escape hatch for admin-console queries that must read across workspace
 * boundaries (e.g. usage aggregation, global search, billing reconciliation).
 *
 * This MUST NOT be called from user-facing request handlers. The caller is
 * responsible for ensuring the result is never returned raw to a tenant user.
 */
export async function serviceRoleQuery<T>(
  db: Database,
  fn: (db: Database) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    // Set synterra.service_role so audit triggers can record the escape.
    await tx.execute(sql`SELECT set_config('synterra.service_role', 'true', true)`);
    return fn(tx as unknown as Database);
  });
}
