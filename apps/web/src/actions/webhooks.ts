'use server';

import { createCipheriv, randomBytes } from 'node:crypto';

import { and, eq } from 'drizzle-orm';

import { webhookEndpoints, withWorkspaceContext } from '@synterra/db';

import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

export interface WebhookEndpointRow {
  id: string;
  url: string;
  eventTypes: string[];
  isEnabled: boolean;
  failureCount: number;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  createdAt: Date;
}

export interface CreateEndpointSuccess {
  ok: true;
  secret: string;
}

export interface ActionError {
  ok: false;
  code: string;
  message: string;
}

export type CreateEndpointState = CreateEndpointSuccess | ActionError | null;
export type DeleteEndpointState = { ok: true } | ActionError | null;

function encryptSecret(plaintext: string, hexKey: string): string {
  const key = Buffer.from(hexKey, 'hex');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

const ALL_EVENT_TYPES = ['brand.change.created'] as const;

export async function listWebhookEndpoints(): Promise<WebhookEndpointRow[]> {
  const ctx = await getWorkspaceContext();
  if (!ctx) return [];

  return withWorkspaceContext(db, { workspaceId: ctx.workspaceId, userId: ctx.userId }, (tx) =>
    tx
      .select({
        id: webhookEndpoints.id,
        url: webhookEndpoints.url,
        eventTypes: webhookEndpoints.eventTypes,
        isEnabled: webhookEndpoints.isEnabled,
        failureCount: webhookEndpoints.failureCount,
        lastSuccessAt: webhookEndpoints.lastSuccessAt,
        lastFailureAt: webhookEndpoints.lastFailureAt,
        createdAt: webhookEndpoints.createdAt,
      })
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.workspaceId, ctx.workspaceId))
      .orderBy(webhookEndpoints.createdAt),
  );
}

export async function createEndpointAction(
  _prev: CreateEndpointState,
  formData: FormData,
): Promise<CreateEndpointState> {
  const ctx = await getWorkspaceContext();
  if (!ctx) return { ok: false, code: 'UNAUTHORIZED', message: 'Not authenticated' };
  if (ctx.role !== 'owner' && ctx.role !== 'admin') {
    return { ok: false, code: 'FORBIDDEN', message: 'Insufficient permissions' };
  }

  const url = formData.get('url');
  if (typeof url !== 'string' || !url.startsWith('https://')) {
    return { ok: false, code: 'VALIDATION', message: 'URL must be an HTTPS URL' };
  }

  const encryptKey = process.env['WEBHOOK_SECRET_ENCRYPT_KEY'];
  if (!encryptKey) {
    return { ok: false, code: 'CONFIG', message: 'Webhook signing not configured' };
  }

  const rawSecret = randomBytes(32).toString('hex');
  const encryptedSecret = encryptSecret(rawSecret, encryptKey);

  await withWorkspaceContext(db, { workspaceId: ctx.workspaceId, userId: ctx.userId }, (tx) =>
    tx.insert(webhookEndpoints).values({
      workspaceId: ctx.workspaceId,
      url,
      secret: encryptedSecret,
      eventTypes: [...ALL_EVENT_TYPES],
    }),
  );

  return { ok: true, secret: rawSecret };
}

export async function deleteEndpointAction(
  _prev: DeleteEndpointState,
  formData: FormData,
): Promise<DeleteEndpointState> {
  const ctx = await getWorkspaceContext();
  if (!ctx) return { ok: false, code: 'UNAUTHORIZED', message: 'Not authenticated' };
  if (ctx.role !== 'owner' && ctx.role !== 'admin') {
    return { ok: false, code: 'FORBIDDEN', message: 'Insufficient permissions' };
  }

  const endpointId = formData.get('endpointId');
  if (typeof endpointId !== 'string') {
    return { ok: false, code: 'VALIDATION', message: 'Endpoint ID required' };
  }

  await withWorkspaceContext(db, { workspaceId: ctx.workspaceId, userId: ctx.userId }, (tx) =>
    tx
      .delete(webhookEndpoints)
      .where(
        and(eq(webhookEndpoints.id, endpointId), eq(webhookEndpoints.workspaceId, ctx.workspaceId)),
      ),
  );

  return { ok: true };
}
