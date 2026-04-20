import { NextResponse } from 'next/server';

import { stripe } from '@/lib/stripe';
import { getStripeEventsQueue } from '@/lib/stripe-queue';

export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<NextResponse> {
  // Must use req.text() — req.json() would corrupt the raw body that Stripe
  // needs for HMAC signature verification. Never change this to req.json().
  const rawBody = await req.text();

  const sig = req.headers.get('stripe-signature');
  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  const webhookSecret = process.env['STRIPE_WEBHOOK_SECRET'];
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  let event: ReturnType<typeof stripe.webhooks.constructEvent>;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch {
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
  }

  await getStripeEventsQueue().add(event.type, event, {
    jobId: event.id,
    removeOnComplete: 100,
    removeOnFail: 500,
  });

  return NextResponse.json({ received: true }, { status: 200 });
}
