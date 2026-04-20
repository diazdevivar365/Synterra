import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getPlanBySlug, PLANS } from '@synterra/billing';
import { subscriptions } from '@synterra/db';

import { db } from '@/lib/db';
import { stripe } from '@/lib/stripe';

const bodySchema = z.object({
  planSlug: z.enum(['starter', 'growth', 'scale']),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

export async function POST(req: Request): Promise<NextResponse> {
  const workspaceId = req.headers.get('x-workspace-id');
  const userId = req.headers.get('x-user-id');

  if (!workspaceId || !userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body: unknown = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { planSlug, successUrl, cancelUrl } = parsed.data;

  const plan = getPlanBySlug(planSlug);
  if (!plan || plan.stripePriceIdMonthlyEnvVar === null) {
    return NextResponse.json(
      { error: `Plan '${planSlug}' is not available for self-serve checkout` },
      { status: 400 },
    );
  }

  const priceId = process.env[plan.stripePriceIdMonthlyEnvVar];
  if (!priceId) {
    return NextResponse.json(
      { error: `Stripe price ID not configured for plan '${planSlug}'` },
      { status: 500 },
    );
  }

  // Look up existing subscription for this workspace.
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.workspaceId, workspaceId))
    .limit(1);

  if (sub?.status === 'active' && sub.planId === planSlug) {
    return NextResponse.json({ url: null, message: 'already subscribed' }, { status: 200 });
  }

  // Resolve or create the Stripe customer.
  let stripeCustomerId = sub?.stripeCustomerId ?? 'cus_pending';

  if (stripeCustomerId === 'cus_pending') {
    const cus = await stripe.customers.create({
      metadata: { workspace_id: workspaceId },
    });
    stripeCustomerId = cus.id;

    await db
      .update(subscriptions)
      .set({ stripeCustomerId: cus.id })
      .where(eq(subscriptions.workspaceId, workspaceId));
  }

  // Create the Checkout session.
  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    automatic_tax: { enabled: true },
    subscription_data: {
      metadata: {
        workspace_id: workspaceId,
        plan_slug: planSlug,
      },
    },
  });

  return NextResponse.json({ url: session.url });
}

// Expose visible plan list for the pricing page.
export async function GET(): Promise<NextResponse> {
  const visible = PLANS.filter((p) => p.slug !== 'trial' && p.slug !== 'enterprise').map((p) => ({
    slug: p.slug,
    name: p.name,
    priceCents: p.priceCents,
    currency: p.currency,
    quotas: p.quotas,
    features: p.features,
  }));
  return NextResponse.json({ plans: visible });
}
