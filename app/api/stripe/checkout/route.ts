import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { getStripe, appUrl } from '@/lib/stripe';

export async function POST(request: Request) {
  const auth = await getCurrentUser();
  if (!auth) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    return NextResponse.json({ error: 'STRIPE_PRICE_ID missing' }, { status: 500 });
  }

  let returnTo: string | undefined;
  try {
    const body = await request.json();
    if (typeof body?.returnTo === 'string') returnTo = body.returnTo;
  } catch {
    // empty body — fine
  }

  // Reuse stripe_customer_id if we already have one, otherwise let Checkout create.
  let customerId = auth.profile.stripe_customer_id ?? undefined;
  if (!customerId) {
    const customer = await getStripe().customers.create({
      email: auth.email,
      metadata: { supabase_user_id: auth.userId },
    });
    customerId = customer.id;

    const admin = createServiceClient();
    await admin.from('profiles').update({ stripe_customer_id: customerId }).eq('id', auth.userId);
  }

  const successPath = `/upgrade/success${returnTo ? `?return=${encodeURIComponent(returnTo)}` : ''}`;

  const session = await getStripe().checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: appUrl(successPath),
    cancel_url: appUrl('/upgrade'),
    allow_promotion_codes: false,
    client_reference_id: auth.userId,
    subscription_data: {
      metadata: { supabase_user_id: auth.userId },
    },
  });

  return NextResponse.json({ url: session.url });
}
