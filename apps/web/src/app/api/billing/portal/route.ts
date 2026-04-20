import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { subscriptions } from '@synterra/db';

import { db } from '@/lib/db';
import { stripe } from '@/lib/stripe';

const bodySchema = z.object({
  returnUrl: z.string().url(),
});

export async function POST(req: Request): Promise<NextResponse> {
  const workspaceId = req.headers.get('x-workspace-id');
  const userId = req.headers.get('x-user-id');

  if (!workspaceId || !userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.workspaceId, workspaceId))
    .limit(1);

  if (!sub) {
    return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
  }

  if (sub.stripeCustomerId === 'cus_pending') {
    return NextResponse.json(
      { error: 'No payment method on file. Start a subscription first.' },
      { status: 400 },
    );
  }

  const body: unknown = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: parsed.data.returnUrl,
  });

  return NextResponse.json({ url: session.url });
}
