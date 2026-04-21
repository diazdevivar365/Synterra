import { desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';

import { brandChanges, createDb, serviceRoleQuery } from '@synterra/db';

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

export function createChangesRouter(): Hono<Env> {
  const router = new Hono<Env>();

  router.use('*', apiKeyAuthMiddleware);

  router.get('/', async (c) => {
    const workspaceId = c.get('workspaceId');
    const limit = Math.min(Number(c.req.query('limit') ?? 50), 100);
    const offset = Number(c.req.query('offset') ?? 0);

    const rows = await serviceRoleQuery(getDb(), (tx) =>
      tx
        .select()
        .from(brandChanges)
        .where(eq(brandChanges.workspaceId, workspaceId))
        .orderBy(desc(brandChanges.occurredAt))
        .limit(limit)
        .offset(offset),
    );

    return c.json({ data: rows, limit, offset });
  });

  return router;
}
