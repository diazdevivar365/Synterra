import { eq, sql } from 'drizzle-orm';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import {
  auditLog,
  serviceRoleQuery,
  subscriptions,
  workspaceQuotas,
  workspaces,
} from '@synterra/db';

import { verifyCloudflareAccess } from '@/lib/cloudflare-access';
import { db } from '@/lib/db';

import type { ReactNode } from 'react';

interface Props {
  params: Promise<{ workspaceId: string }>;
}

export default async function WorkspaceOpsPage({ params }: Props) {
  const { workspaceId } = await params;

  const [ws] = await serviceRoleQuery(db, (tx) =>
    tx.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1),
  );
  if (!ws) notFound();

  const [quota] = await serviceRoleQuery(db, (tx) =>
    tx.select().from(workspaceQuotas).where(eq(workspaceQuotas.workspaceId, workspaceId)).limit(1),
  );

  const [sub] = await serviceRoleQuery(db, (tx) =>
    tx
      .select({ stripeCustomerId: subscriptions.stripeCustomerId })
      .from(subscriptions)
      .where(eq(subscriptions.workspaceId, workspaceId))
      .limit(1),
  );

  async function changePlanAction(formData: FormData) {
    'use server';
    const h = await headers();
    const identity = await verifyCloudflareAccess(h);
    if (!identity) return;
    const rawPlanId = formData.get('planId');
    const planId = typeof rawPlanId === 'string' ? rawPlanId.trim() : '';
    if (!planId) return;
    await serviceRoleQuery(db, async (tx) => {
      await tx
        .update(workspaces)
        .set({ planId, updatedAt: new Date() })
        .where(eq(workspaces.id, workspaceId));
      await tx.insert(auditLog).values({
        workspaceId,
        actorKind: 'admin',
        action: 'admin.plan.change',
        resourceType: 'workspace',
        resourceId: workspaceId,
        after: { planId, adminEmail: identity.email },
      });
    });
    redirect(`/admin/workspaces/${workspaceId}/ops`);
  }

  async function grantCreditsAction(formData: FormData) {
    'use server';
    const h = await headers();
    const identity = await verifyCloudflareAccess(h);
    if (!identity) return;
    const rawCredits = formData.get('credits');
    const extra = parseInt(typeof rawCredits === 'string' ? rawCredits : '0', 10);
    if (!extra || extra <= 0) return;
    await serviceRoleQuery(db, async (tx) => {
      await tx.execute(
        sql`UPDATE workspace_quotas SET credits_granted = credits_granted + ${extra}, updated_at = now() WHERE workspace_id = ${workspaceId}`,
      );
      await tx.insert(auditLog).values({
        workspaceId,
        actorKind: 'admin',
        action: 'admin.credits.grant',
        resourceType: 'workspace',
        resourceId: workspaceId,
        after: { extra, adminEmail: identity.email },
      });
    });
    redirect(`/admin/workspaces/${workspaceId}/ops`);
  }

  async function suspendAction(formData: FormData) {
    'use server';
    const h = await headers();
    const identity = await verifyCloudflareAccess(h);
    if (!identity) return;
    const rawReason = formData.get('reason');
    const reason = (typeof rawReason === 'string' ? rawReason.trim() : '') || 'Suspended by admin';
    await serviceRoleQuery(db, async (tx) => {
      await tx
        .update(workspaces)
        .set({ suspendedAt: new Date(), suspensionReason: reason, updatedAt: new Date() })
        .where(eq(workspaces.id, workspaceId));
      await tx.insert(auditLog).values({
        workspaceId,
        actorKind: 'admin',
        action: 'admin.workspace.suspend',
        resourceType: 'workspace',
        resourceId: workspaceId,
        after: { reason, adminEmail: identity.email },
      });
    });
    redirect(`/admin/workspaces/${workspaceId}/ops`);
  }

  async function unsuspendAction() {
    'use server';
    const h = await headers();
    const identity = await verifyCloudflareAccess(h);
    if (!identity) return;
    await serviceRoleQuery(db, async (tx) => {
      await tx
        .update(workspaces)
        .set({ suspendedAt: null, suspensionReason: null, updatedAt: new Date() })
        .where(eq(workspaces.id, workspaceId));
      await tx.insert(auditLog).values({
        workspaceId,
        actorKind: 'admin',
        action: 'admin.workspace.unsuspend',
        resourceType: 'workspace',
        resourceId: workspaceId,
        after: { adminEmail: identity.email },
      });
    });
    redirect(`/admin/workspaces/${workspaceId}/ops`);
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <a
          href={`/admin/workspaces/${workspaceId}`}
          className="mb-2 block text-sm text-blue-600 hover:underline"
        >
          ← {ws.name}
        </a>
        <h1 className="text-xl font-semibold text-gray-900">Workspace ops</h1>
      </div>

      <OpsCard title="Plan">
        <p className="mb-3 text-sm text-gray-500">
          Current: <span className="font-mono font-medium">{ws.planId}</span> ({ws.planStatus})
        </p>
        <form action={changePlanAction} className="flex gap-3">
          <input
            name="planId"
            defaultValue={ws.planId}
            placeholder="Plan ID (e.g. growth)"
            className="flex-1 rounded border border-gray-300 px-3 py-1.5 font-mono text-sm"
          />
          <button type="submit" className="rounded bg-gray-800 px-4 py-1.5 text-sm text-white">
            Update
          </button>
        </form>
        {sub && (
          <p className="mt-2 text-xs text-gray-400">
            Stripe customer:{' '}
            <a
              href={`https://dashboard.stripe.com/customers/${sub.stripeCustomerId}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-blue-500 hover:underline"
            >
              {sub.stripeCustomerId}
            </a>
          </p>
        )}
      </OpsCard>

      <OpsCard title="Credits">
        {quota ? (
          <p className="mb-3 text-sm text-gray-500">
            Period ends{' '}
            <span className="font-medium">
              {new Date(quota.periodEnd).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>{' '}
            — <span className="font-mono">{quota.creditsConsumed}</span> /{' '}
            <span className="font-mono">{quota.creditsGranted}</span> used
          </p>
        ) : (
          <p className="mb-3 text-sm italic text-gray-400">No quota record.</p>
        )}
        <form action={grantCreditsAction} className="flex gap-3">
          <input
            name="credits"
            type="number"
            min="1"
            placeholder="Credits to add"
            className="flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm"
          />
          <button type="submit" className="rounded bg-green-700 px-4 py-1.5 text-sm text-white">
            Grant
          </button>
        </form>
      </OpsCard>

      <OpsCard title="Suspension">
        {ws.suspendedAt ? (
          <div>
            <p className="mb-3 text-sm text-orange-700">Reason: {ws.suspensionReason}</p>
            <form action={unsuspendAction}>
              <button
                type="submit"
                className="rounded bg-orange-600 px-4 py-1.5 text-sm text-white"
              >
                Unsuspend workspace
              </button>
            </form>
          </div>
        ) : (
          <form action={suspendAction} className="space-y-2">
            <input
              name="reason"
              placeholder="Suspension reason"
              required
              className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
            />
            <button type="submit" className="rounded bg-red-600 px-4 py-1.5 text-sm text-white">
              Suspend workspace
            </button>
          </form>
        )}
      </OpsCard>
    </div>
  );
}

function OpsCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">{title}</h2>
      {children}
    </div>
  );
}
