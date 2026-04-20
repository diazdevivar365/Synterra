'use server';

import crypto from 'node:crypto';

import { and, eq } from 'drizzle-orm';

import { createDb, invites, withWorkspaceContext, workspaceMembers } from '@synterra/db';

import { logAudit } from '../lib/audit';
import { ForbiddenError, NotFoundError, toActionError } from '../lib/errors';
import { assertCan, ROLE_HIERARCHY, type WorkspaceRole } from '../lib/rbac';
import { getSessionOrThrow } from '../lib/session';

import type { ActionResult } from './workspace';

const db = createDb(process.env['DATABASE_URL'] ?? '');

export interface InviteMemberInput {
  workspaceId: string;
  callerRole: WorkspaceRole;
  email: string;
  role: WorkspaceRole;
}

export async function inviteMember(
  input: InviteMemberInput,
): Promise<ActionResult<{ inviteId: string }>> {
  try {
    const session = await getSessionOrThrow();
    assertCan(input.callerRole, 'member:invite');

    if (ROLE_HIERARCHY[input.role] > ROLE_HIERARCHY[input.callerRole]) {
      throw new ForbiddenError('Cannot invite to a role higher than your own');
    }

    const tokenHash = crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [invite] = await db
      .insert(invites)
      .values({
        workspaceId: input.workspaceId,
        email: input.email.toLowerCase().trim(),
        role: input.role,
        invitedBy: session.userId,
        tokenHash,
        expiresAt,
      })
      .returning({ id: invites.id });

    if (!invite) throw new Error('Failed to create invite');

    await logAudit(db, {
      workspaceId: input.workspaceId,
      actorUserId: session.userId,
      action: 'member.invited',
      resourceType: 'invite',
      resourceId: invite.id,
      after: { email: input.email, role: input.role },
    });

    return { ok: true, data: { inviteId: invite.id } };
  } catch (err) {
    return toActionError(err);
  }
}

export interface AcceptInviteInput {
  tokenHash: string;
  userId: string;
}

export async function acceptInvite(
  input: AcceptInviteInput,
): Promise<ActionResult<{ workspaceId: string }>> {
  try {
    const [invite] = await db
      .select()
      .from(invites)
      .where(eq(invites.tokenHash, input.tokenHash))
      .limit(1);

    if (!invite) throw new NotFoundError('invite');
    if (invite.acceptedAt) throw new ForbiddenError('Invite already accepted');
    if (invite.revokedAt) throw new ForbiddenError('Invite has been revoked');
    if (invite.expiresAt < new Date()) throw new ForbiddenError('Invite has expired');

    await db.transaction(async (tx) => {
      await tx.insert(workspaceMembers).values({
        workspaceId: invite.workspaceId,
        userId: input.userId,
        role: invite.role,
        invitedBy: invite.invitedBy,
      });

      await tx.update(invites).set({ acceptedAt: new Date() }).where(eq(invites.id, invite.id));

      await logAudit(tx, {
        workspaceId: invite.workspaceId,
        actorUserId: input.userId,
        action: 'member.joined',
        resourceType: 'workspace_member',
        resourceId: invite.workspaceId,
        after: { role: invite.role },
      });
    });

    return { ok: true, data: { workspaceId: invite.workspaceId } };
  } catch (err) {
    return toActionError(err);
  }
}

export interface ChangeMemberRoleInput {
  workspaceId: string;
  callerRole: WorkspaceRole;
  targetUserId: string;
  newRole: WorkspaceRole;
}

export async function changeMemberRole(input: ChangeMemberRoleInput): Promise<ActionResult> {
  try {
    const session = await getSessionOrThrow();
    assertCan(input.callerRole, 'member:change-role');

    if (input.newRole === 'owner' && input.callerRole !== 'owner') {
      throw new ForbiddenError('Only an owner can promote to owner');
    }

    await withWorkspaceContext(
      db,
      { workspaceId: input.workspaceId, userId: session.userId },
      async (tx) => {
        const [member] = await tx
          .select({ role: workspaceMembers.role })
          .from(workspaceMembers)
          .where(
            and(
              eq(workspaceMembers.workspaceId, input.workspaceId),
              eq(workspaceMembers.userId, input.targetUserId),
            ),
          )
          .limit(1);

        if (!member) throw new NotFoundError('workspace_member');

        await tx
          .update(workspaceMembers)
          .set({ role: input.newRole })
          .where(
            and(
              eq(workspaceMembers.workspaceId, input.workspaceId),
              eq(workspaceMembers.userId, input.targetUserId),
            ),
          );

        await logAudit(tx, {
          workspaceId: input.workspaceId,
          actorUserId: session.userId,
          action: 'member.role_changed',
          resourceType: 'workspace_member',
          resourceId: input.targetUserId,
          before: { role: member.role },
          after: { role: input.newRole },
        });
      },
    );

    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export interface RemoveMemberInput {
  workspaceId: string;
  callerRole: WorkspaceRole;
  targetUserId: string;
  targetRole: WorkspaceRole;
}

export async function removeMember(input: RemoveMemberInput): Promise<ActionResult> {
  try {
    const session = await getSessionOrThrow();
    assertCan(input.callerRole, 'member:remove');

    if (input.targetRole === 'owner') {
      throw new ForbiddenError('Cannot remove the workspace owner — transfer ownership first');
    }

    await withWorkspaceContext(
      db,
      { workspaceId: input.workspaceId, userId: session.userId },
      async (tx) => {
        await tx
          .delete(workspaceMembers)
          .where(
            and(
              eq(workspaceMembers.workspaceId, input.workspaceId),
              eq(workspaceMembers.userId, input.targetUserId),
            ),
          );

        await logAudit(tx, {
          workspaceId: input.workspaceId,
          actorUserId: session.userId,
          action: 'member.removed',
          resourceType: 'workspace_member',
          resourceId: input.targetUserId,
          before: { role: input.targetRole },
        });
      },
    );

    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export interface TransferOwnershipInput {
  workspaceId: string;
  callerRole: WorkspaceRole;
  newOwnerUserId: string;
}

export async function transferOwnership(input: TransferOwnershipInput): Promise<ActionResult> {
  try {
    const session = await getSessionOrThrow();
    assertCan(input.callerRole, 'ownership:transfer');

    await withWorkspaceContext(
      db,
      { workspaceId: input.workspaceId, userId: session.userId },
      async (tx) => {
        await tx
          .update(workspaceMembers)
          .set({ role: 'admin' })
          .where(
            and(
              eq(workspaceMembers.workspaceId, input.workspaceId),
              eq(workspaceMembers.userId, session.userId),
            ),
          );

        await tx
          .update(workspaceMembers)
          .set({ role: 'owner' })
          .where(
            and(
              eq(workspaceMembers.workspaceId, input.workspaceId),
              eq(workspaceMembers.userId, input.newOwnerUserId),
            ),
          );

        await logAudit(tx, {
          workspaceId: input.workspaceId,
          actorUserId: session.userId,
          action: 'workspace.ownership_transferred',
          resourceType: 'workspace',
          resourceId: input.workspaceId,
          before: { ownerId: session.userId },
          after: { ownerId: input.newOwnerUserId },
        });
      },
    );

    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}
