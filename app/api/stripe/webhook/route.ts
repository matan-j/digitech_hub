import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

type DBStatus = 'active' | 'cancelled' | 'past_due' | 'none';

function mapStatus(s: Stripe.Subscription.Status): DBStatus {
  switch (s) {
    case 'active':
    case 'trialing':
      return 'active';
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    case 'canceled':
    case 'incomplete_expired':
      return 'cancelled';
    default:
      return 'none';
  }
}

async function syncSubscription(sub: Stripe.Subscription) {
  const supabase = createServiceClient();
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const userId = (sub.metadata?.supabase_user_id as string | undefined) ?? null;

  const status = mapStatus(sub.status);
  // Resolve current_period_end from the first subscription item (Stripe API surface).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const periodEndUnix: number | undefined = (sub as any).current_period_end
    ?? sub.items?.data?.[0]?.current_period_end;
  const periodEnd = periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : null;

  const update = {
    stripe_subscription_id: sub.id,
    subscription_status: status,
    current_period_end: periodEnd,
    stripe_customer_id: customerId,
  };

  if (userId) {
    await supabase.from('profiles').update(update).eq('id', userId);
  } else {
    await supabase.from('profiles').update(update).eq('stripe_customer_id', customerId);
  }
}

export async function POST(request: Request) {
  const sig = request.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) {
    return NextResponse.json({ error: 'missing_signature' }, { status: 400 });
  }

  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid_signature';
    console.error('[stripe webhook] signature verification failed:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Idempotency: if we already processed this event id, return early.
  const admin = createServiceClient();
  const { data: existing } = await admin
    .from('stripe_events')
    .select('id')
    .eq('id', event.id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === 'subscription' && session.subscription) {
          const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
          const sub = await getStripe().subscriptions.retrieve(subId);
          if (session.client_reference_id) {
            sub.metadata = { ...sub.metadata, supabase_user_id: session.client_reference_id };
          }
          await syncSubscription(sub);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      }
      default:
        // Ignore other events for V1.
        break;
    }

    // Mark processed only after successful handling
    await admin.from('stripe_events').insert({ id: event.id, type: event.type });
  } catch (err) {
    console.error('[stripe webhook] handler error:', err);
    return NextResponse.json({ error: 'handler_error' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
