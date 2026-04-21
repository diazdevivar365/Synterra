'use server';

import { createHash, randomBytes } from 'node:crypto';

import { and, eq, isNull } from 'drizzle-orm';

import { publicApiKeys, withWorkspaceContext } from '@synterra/db';

import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

export interface CreateKeySuccess {
  ok: true;
  key: string;
  name: string;
  keyId: string;
}

export interface ActionError {
  ok: false;
  code: string;
  message: string;
}

export type CreateKeyState = CreateKeySuccess | ActionError | null;
export type RevokeKeyState = { ok: true } | ActionError | null;

export interface ApiKeyRow {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  createdAt: Date;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
}

export async function listApiKeys(): Promise<ApiKeyRow[]> {
  const ctx = await getWorkspaceContext();
  if (!ctx) return [];

  return withWorkspaceContext(db, { workspaceId: ctx.workspaceId, userId: ctx.userId }, (tx) =>
    tx
      .select({
        id: publicApiKeys.id,
        name: publicApiKeys.name,
        keyPrefix: publicApiKeys.keyPrefix,
        scopes: publicApiKeys.scopes,
        createdAt: publicApiKeys.createdAt,
        expiresAt: publicApiKeys.expiresAt,
        lastUsedAt: publicApiKeys.lastUsedAt,
      })
      .from(publicApiKeys)
      .where(and(eq(publicApiKeys.workspaceId, ctx.workspaceId), isNull(publicApiKeys.revokedAt)))
      .orderBy(publicApiKeys.createdAt),
  );
}

export async function createKeyAction(
  _prev: CreateKeyState,
  formData: FormData,
): Promise<CreateKeyState> {
  const ctx = await getWorkspaceContext();
  if (!ctx) return { ok: false, code: 'UNAUTHORIZED', message: 'Not authenticated' };

  const name = formData.get('name');
  if (typeof name !== 'string' || name.trim().length === 0) {
    return { ok: false, code: 'VALIDATION', message: 'Name is required' };
  }

  const rawKey = `fgk_${randomBytes(20).toString('hex')}`;
  const keyHash = createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = rawKey.slice(0, 16);

  const [row] = await withWorkspaceContext(
    db,
    { workspaceId: ctx.workspaceId, userId: ctx.userId },
    (tx) =>
      tx
        .insert(publicApiKeys)
        .values({
          workspaceId: ctx.workspaceId,
          createdBy: ctx.userId,
          name: name.trim(),
          keyHash,
          keyPrefix,
          scopes: ['read'],
        })
        .returning({ id: publicApiKeys.id }),
  );

  if (!row) return { ok: false, code: 'DB_ERROR', message: 'Failed to create key' };

  return { ok: true, key: rawKey, name: name.trim(), keyId: row.id };
}

export async function revokeKeyAction(
  _prev: RevokeKeyState,
  formData: FormData,
): Promise<RevokeKeyState> {
  const ctx = await getWorkspaceContext();
  if (!ctx) return { ok: false, code: 'UNAUTHORIZED', message: 'Not authenticated' };

  const keyId = formData.get('keyId');
  if (typeof keyId !== 'string') {
    return { ok: false, code: 'VALIDATION', message: 'Key ID required' };
  }

  await withWorkspaceContext(db, { workspaceId: ctx.workspaceId, userId: ctx.userId }, (tx) =>
    tx
      .update(publicApiKeys)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(publicApiKeys.id, keyId),
          eq(publicApiKeys.workspaceId, ctx.workspaceId),
          isNull(publicApiKeys.revokedAt),
        ),
      ),
  );

  return { ok: true };
}
