import { desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';

import {
  brandChanges,
  createDb,
  serviceRoleQuery,
  workspaceMembers,
  workspaces,
} from '@synterra/db';

import { env } from '../../config.js';
import { apiKeyAuthMiddleware, type ApiKeyVariables } from '../../middleware/api-key-auth.js';

import type { RequestIdVariables } from '../../middleware/request-id.js';

interface Env {
  Variables: ApiKeyVariables & RequestIdVariables;
}

let _db: ReturnType<typeof createDb> | undefined;
function getDb() {
  _db ??= createDb(env.DATABASE_URL);
  return _db;
}

export function createGdprRouter(): Hono<Env> {
  const router = new Hono<Env>();

  router.use('*', apiKeyAuthMiddleware);

  router.post('/export', async (c) => {
    const workspaceId = c.get('workspaceId');

    const [ws, members, changes] = await Promise.all([
      serviceRoleQuery(getDb(), (tx) =>
        tx.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1),
      ).then((r) => r[0] ?? null),

      serviceRoleQuery(getDb(), (tx) =>
        tx.select().from(workspaceMembers).where(eq(workspaceMembers.workspaceId, workspaceId)),
      ),

      serviceRoleQuery(getDb(), (tx) =>
        tx
          .select()
          .from(brandChanges)
          .where(eq(brandChanges.workspaceId, workspaceId))
          .orderBy(desc(brandChanges.occurredAt))
          .limit(10_000),
      ),
    ]);

    const payload = {
      exported_at: new Date().toISOString(),
      workspace: ws
        ? {
            id: ws.id,
            slug: ws.slug,
            name: ws.name,
            plan: ws.planId,
            created_at: ws.createdAt,
          }
        : null,
      members: members.map((m) => ({
        user_id: m.userId,
        role: m.role,
        joined_at: m.joinedAt,
      })),
      brand_changes: changes.map((ch) => ({
        id: ch.id,
        brand_id: ch.brandId,
        event_type: ch.eventType,
        severity: ch.severity,
        title: ch.title,
        description: ch.description,
        occurred_at: ch.occurredAt,
      })),
    };

    return new Response(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="forgentic-export-${workspaceId}.json"`,
      },
    });
  });

  return router;
}
