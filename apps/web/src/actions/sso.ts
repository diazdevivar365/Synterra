'use server';

import { eq } from 'drizzle-orm';

import { createWorkOSClient, createWorkOSOrganization, getAdminPortalLink } from '@synterra/auth';
import { ssoConnections } from '@synterra/db';

import { db } from '../lib/db';
import { toActionError } from '../lib/errors';
import { assertCan, type WorkspaceRole } from '../lib/rbac';

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string };

export async function enableSso(opts: {
  workspaceId: string;
  workspaceName: string;
  domain: string;
  callerRole: WorkspaceRole;
}): Promise<ActionResult<{ orgId: string }>> {
  try {
    assertCan(opts.callerRole, 'workspace:update');

    const domain = opts.domain.trim().toLowerCase();
    if (
      !domain ||
      !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domain)
    ) {
      return { ok: false, code: 'VALIDATION', message: 'Invalid domain format' };
    }

    const apiKey = process.env['WORKOS_API_KEY'];
    if (!apiKey) {
      return { ok: false, code: 'NOT_CONFIGURED', message: 'SSO is not available' };
    }

    const workos = createWorkOSClient(apiKey);
    const org = await createWorkOSOrganization(workos, opts.workspaceName, domain);

    await db
      .insert(ssoConnections)
      .values({
        workspaceId: opts.workspaceId,
        workosOrganizationId: org.id,
        domain,
        enabled: false,
      })
      .onConflictDoUpdate({
        target: ssoConnections.workspaceId,
        set: { workosOrganizationId: org.id, domain, updatedAt: new Date() },
      });

    return { ok: true, data: { orgId: org.id } };
  } catch (err) {
    return toActionError(err);
  }
}

export async function getAdminPortalUrl(opts: {
  workspaceId: string;
  intent: 'sso' | 'dsync';
  callerRole: WorkspaceRole;
}): Promise<ActionResult<{ url: string }>> {
  try {
    assertCan(opts.callerRole, 'workspace:update');

    const apiKey = process.env['WORKOS_API_KEY'];
    if (!apiKey) {
      return { ok: false, code: 'NOT_CONFIGURED', message: 'SSO is not available' };
    }

    const rows = await db
      .select({ orgId: ssoConnections.workosOrganizationId })
      .from(ssoConnections)
      .where(eq(ssoConnections.workspaceId, opts.workspaceId))
      .limit(1);

    const conn = rows[0];
    if (!conn) {
      return { ok: false, code: 'NOT_FOUND', message: 'SSO not set up for this workspace' };
    }

    const workos = createWorkOSClient(apiKey);
    const url = await getAdminPortalLink(workos, conn.orgId, opts.intent);
    return { ok: true, data: { url } };
  } catch (err) {
    return toActionError(err);
  }
}

export async function toggleSso(opts: {
  workspaceId: string;
  enabled: boolean;
  callerRole: WorkspaceRole;
}): Promise<ActionResult> {
  try {
    assertCan(opts.callerRole, 'workspace:update');

    await db
      .update(ssoConnections)
      .set({ enabled: opts.enabled, updatedAt: new Date() })
      .where(eq(ssoConnections.workspaceId, opts.workspaceId));

    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}
