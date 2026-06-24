import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getStripe, appUrl } from '@/lib/stripe';

export async function POST() {
  const auth = await getCurrentUser();
  if (!auth) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const customerId = auth.profile.stripe_customer_id;
  if (!customerId) {
    return NextResponse.json({ error: 'no_customer' }, { status: 400 });
  }

  const session = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: appUrl('/learn/account'),
  });

  return NextResponse.json({ url: session.url });
}
