import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { PLANS } from '@synterra/billing';
import { subscriptions, withWorkspaceContext, workspaceQuotas } from '@synterra/db';

import { BillingActions } from '@/components/billing-actions';
import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

const PLAN_FEATURES: Readonly<Record<string, readonly string[]>> = {
  starter: [
    '1,000 credits / month',
    '3 seats',
    '1 workspace',
    'Brand DNA + Research',
    'Battlecards',
    'Generate tools',
  ],
  growth: [
    '8,000 credits / month',
    '10 seats',
    '3 workspaces',
    'Everything in Starter',
    'Slack integration',
    'Priority support',
  ],
  scale: [
    '30,000 credits / month',
    '25 seats',
    'Unlimited workspaces',
    'Everything in Growth',
    'Audit logs',
    'SSO / SAML',
  ],
};

export default async function BillingPage() {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/workspaces');

  const [sub, quota] = await withWorkspaceContext(
    db,
    { workspaceId: ctx.workspaceId, userId: ctx.userId },
    async (tx) => {
      const [s] = await tx
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.workspaceId, ctx.workspaceId))
        .limit(1);
      const [q] = await tx
        .select()
        .from(workspaceQuotas)
        .where(eq(workspaceQuotas.workspaceId, ctx.workspaceId))
        .limit(1);
      return [s ?? null, q ?? null] as const;
    },
  );

  const currentPlanSlug = sub?.planId ?? 'trial';
  const subscriptionStatus = sub?.status ?? null;
  const creditsGranted = quota?.creditsGranted ?? 0;
  const creditsConsumed = quota?.creditsConsumed ?? 0;

  const plans = PLANS.filter((p) => p.slug !== 'trial' && p.slug !== 'enterprise').map((p) => ({
    slug: p.slug,
    name: p.name,
    priceCents: p.priceCents,
    features: PLAN_FEATURES[p.slug] ?? [],
  }));

  return (
    <div className="mx-auto max-w-[900px] px-6 py-8">
      <div className="mb-8">
        <h1 className="text-fg text-2xl font-bold">Billing</h1>
        <p className="text-muted-fg mt-0.5 font-mono text-xs">
          Manage your subscription and usage.
        </p>
      </div>

      <BillingActions
        currentPlanSlug={currentPlanSlug}
        subscriptionStatus={subscriptionStatus}
        creditsGranted={creditsGranted}
        creditsConsumed={creditsConsumed}
        plans={plans}
      />
    </div>
  );
}
