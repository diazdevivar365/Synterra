import { createHash } from 'node:crypto';

import { and, eq, isNull } from 'drizzle-orm';

import { createDb, publicApiKeys, serviceRoleQuery } from '@synterra/db';

import { env } from '../config.js';

import type { MiddlewareHandler } from 'hono';

export interface ApiKeyVariables {
  workspaceId: string;
  apiKeyUserId: string;
  apiKeyScopes: string[];
}

let _db: ReturnType<typeof createDb> | undefined;
function getDb() {
  _db ??= createDb(env.DATABASE_URL);
  return _db;
}

export const apiKeyAuthMiddleware: MiddlewareHandler<{
  Variables: ApiKeyVariables & { requestId: string };
}> = async (c, next) => {
  const authHeader = c.req.header('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'missing_token' }, 401);
  }

  const rawToken = authHeader.slice(7).trim();
  if (!rawToken.startsWith('fgk_')) {
    return c.json({ error: 'invalid_token' }, 401);
  }

  const tokenHash = createHash('sha256').update(rawToken).digest('hex');

  const row = await serviceRoleQuery(getDb(), (tx) =>
    tx
      .select({
        workspaceId: publicApiKeys.workspaceId,
        createdBy: publicApiKeys.createdBy,
        scopes: publicApiKeys.scopes,
        expiresAt: publicApiKeys.expiresAt,
      })
      .from(publicApiKeys)
      .where(and(eq(publicApiKeys.keyHash, tokenHash), isNull(publicApiKeys.revokedAt)))
      .then((r) => r[0] ?? null),
  );

  if (!row) return c.json({ error: 'invalid_token' }, 401);
  if (row.expiresAt && row.expiresAt < new Date()) return c.json({ error: 'token_expired' }, 401);

  void serviceRoleQuery(getDb(), (tx) =>
    tx
      .update(publicApiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(publicApiKeys.keyHash, tokenHash)),
  );

  c.set('workspaceId', row.workspaceId);
  c.set('apiKeyUserId', row.createdBy);
  c.set('apiKeyScopes', row.scopes);

  return next();
};
