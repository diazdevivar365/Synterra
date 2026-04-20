'use server';

import { eq } from 'drizzle-orm';

import { createDb, withWorkspaceContext, workspaces, workspaceMembers, subscriptions } from '@synterra/db';
import { WorkspaceSlugSchema } from '@synterra/shared';

import { logAudit } from '../lib/audit';
import { ConflictError, toActionError } from '../lib/errors';
import { getProvisionQueue } from '../lib/queue';
import { assertCan, type WorkspaceRole } from '../lib/rbac';
import { getSessionOrThrow } from '../lib/session';

const db = createDb(process.env['DATABASE_URL'] ?? '');

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string };

export interface CreateWorkspaceInput {
  name: string;
  slug: string;
}

export async function createWorkspace(
  input: CreateWorkspaceInput,
): Promise<ActionResult<{ workspaceId: string }>> {
  try {
    const session = await getSessionOrThrow();

    const nameTrimmed = input.name.trim();
    if (!nameTrimmed) {
      return { ok: false, code: 'VALIDATION', message: 'Name is required' };
    }

    const slugParsed = WorkspaceSlugSchema.safeParse(input.slug);
    if (!slugParsed.success) {
      return {
        ok: false,
        code: 'VALIDATION',
        message: slugParsed.error.errors[0]?.message ?? 'Invalid slug',
      };
    }
    const slug = slugParsed.data;

    const workspaceId = await db.transaction(async (tx) => {
      const [workspace] = await tx
        .insert(workspaces)
        .values({ name: nameTrimmed, slug, aquilaOrgSlug: slug })
        .returning({ id: workspaces.id })
        .onConflictDoNothing();

      if (!workspace) throw new ConflictError(`Slug '${slug}' is already taken`);

      await tx.insert(workspaceMembers).values({
        workspaceId: workspace.id,
        userId: session.userId,
        role: 'owner',
      });

      const now = new Date();
      await tx.insert(subscriptions).values({
        workspaceId: workspace.id,
        stripeCustomerId: 'cus_pending',
        stripeSubscriptionId: `sub_trial_${workspace.id}`,
        planId: 'trial',
        status: 'trialing',
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
        seatCount: 3,
      });

      await logAudit(tx as unknown as typeof db, {
        workspaceId: workspace.id,
        actorUserId: session.userId,
        action: 'workspace.created',
        resourceType: 'workspace',
        resourceId: workspace.id,
        after: { name: nameTrimmed, slug },
      });

      return workspace.id;
    });

    await getProvisionQueue().add('provision', {
      workspaceId,
      workspaceSlug: slug,
      workspaceName: nameTrimmed,
    });

    return { ok: true, data: { workspaceId } };
  } catch (err) {
    return toActionError(err);
  }
}

export interface UpdateWorkspaceSettingsInput {
  workspaceId: string;
  callerRole: WorkspaceRole;
  name?: string;
  settings?: Record<string, unknown>;
  branding?: Record<string, unknown>;
}

export async function updateWorkspaceSettings(
  input: UpdateWorkspaceSettingsInput,
): Promise<ActionResult> {
  try {
    const session = await getSessionOrThrow();
    assertCan(input.callerRole, 'workspace:update');

    // Build updates only with keys that are actually provided.
    // exactOptionalPropertyTypes forbids assigning undefined to optional fields.
    const updates: {
      updatedAt: Date;
      name?: string;
      settings?: Record<string, unknown>;
      branding?: Record<string, unknown>;
    } = { updatedAt: new Date() };

    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) return { ok: false, code: 'VALIDATION', message: 'Name is required' };
      updates.name = name;
    }
    if (input.settings !== undefined) updates.settings = input.settings;
    if (input.branding !== undefined) updates.branding = input.branding;

    await withWorkspaceContext(
      db,
      { workspaceId: input.workspaceId, userId: session.userId },
      async (tx) => {
        const [before] = await tx
          .select({ name: workspaces.name, settings: workspaces.settings })
          .from(workspaces)
          .where(eq(workspaces.id, input.workspaceId))
          .limit(1);

        await tx.update(workspaces).set(updates).where(eq(workspaces.id, input.workspaceId));

        await logAudit(tx, {
          workspaceId: input.workspaceId,
          actorUserId: session.userId,
          action: 'workspace.updated',
          resourceType: 'workspace',
          resourceId: input.workspaceId,
          before,
          after: updates,
        });
      },
    );

    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}
