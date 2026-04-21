'use server';

import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { getPlanBySlug } from '@synterra/billing';
import { subscriptions, withWorkspaceContext } from '@synterra/db';

import { db } from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { getWorkspaceContext } from '@/lib/workspace-context';

export interface BillingErrorResult {
  ok: false;
  code: string;
  message: string;
}

export async function checkoutAction(formData: FormData): Promise<BillingErrorResult> {
  const ctx = await getWorkspaceContext();
  if (!ctx) return { ok: false, code: 'UNAUTHORIZED', message: 'Not authenticated' };

  const planSlug = formData.get('planSlug');
  if (typeof planSlug !== 'string' || !planSlug) {
    return { ok: false, code: 'VALIDATION', message: 'Plan is required' };
  }

  const plan = getPlanBySlug(planSlug);
  if (!plan?.stripePriceIdMonthlyEnvVar) {
    return {
      ok: false,
      code: 'INVALID_PLAN',
      message: 'Plan not available for self-serve checkout',
    };
  }

  const priceId = process.env[plan.stripePriceIdMonthlyEnvVar];
  if (!priceId) {
    return { ok: false, code: 'CONFIG', message: 'Plan not configured — contact support' };
  }

  const [sub] = await withWorkspaceContext(
    db,
    { workspaceId: ctx.workspaceId, userId: ctx.userId },
    (tx) =>
      tx
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.workspaceId, ctx.workspaceId))
        .limit(1),
  );

  if (sub?.status === 'active' && sub.planId === planSlug) {
    return { ok: false, code: 'ALREADY_SUBSCRIBED', message: 'Already on this plan' };
  }

  let stripeCustomerId = sub?.stripeCustomerId ?? null;
  if (!stripeCustomerId || stripeCustomerId === 'cus_pending') {
    const cus = await stripe.customers.create({ metadata: { workspace_id: ctx.workspaceId } });
    stripeCustomerId = cus.id;
  }

  const origin = process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000';
  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/${ctx.slug}/billing?upgraded=1`,
    cancel_url: `${origin}/${ctx.slug}/billing`,
    automatic_tax: { enabled: true },
    subscription_data: {
      metadata: { workspace_id: ctx.workspaceId, plan_slug: planSlug },
    },
  });

  if (!session.url) throw new Error('Stripe checkout session missing URL');
  redirect(session.url);
}

export async function portalAction(): Promise<BillingErrorResult> {
  const ctx = await getWorkspaceContext();
  if (!ctx) return { ok: false, code: 'UNAUTHORIZED', message: 'Not authenticated' };

  const [sub] = await withWorkspaceContext(
    db,
    { workspaceId: ctx.workspaceId, userId: ctx.userId },
    (tx) =>
      tx
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.workspaceId, ctx.workspaceId))
        .limit(1),
  );

  if (!sub?.stripeCustomerId || sub.stripeCustomerId === 'cus_pending') {
    return { ok: false, code: 'NO_SUBSCRIPTION', message: 'No active subscription found' };
  }

  const origin = process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000';
  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${origin}/${ctx.slug}/billing`,
  });

  redirect(session.url);
}
