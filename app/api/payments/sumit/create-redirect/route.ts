import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createHostedCheckout } from '@/lib/payments/sumit';
import { createPendingOrder, setOrderCheckoutUrl, type ContentType } from '@/lib/payments/order-service';

export const runtime = 'nodejs';

const PURCHASABLE: ContentType[] = ['course', 'guide', 'playbook', 'resource', 'bundle'];

/**
 * POST { contentType, slug } -> { checkoutUrl, publicOrderId }
 * Creates a pending internal order and returns a hosted checkout URL.
 * Grants NOTHING — access is created only by the verified webhook.
 */
export async function POST(request: Request) {
  const auth = await getCurrentUser();
  if (!auth) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const contentType = body.contentType as ContentType | undefined;
  const slug = body.slug as string | undefined;
  if (!contentType || !PURCHASABLE.includes(contentType) || !slug) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  // Resolve the priced item. (V1: courses/guides live in content_items.)
  const supabase = await createClient();
  const { data: item } = await supabase
    .from('content_items')
    .select('id, slug, title, price_amount, price_currency, access_level')
    .eq('slug', slug)
    .maybeSingle();

  if (!item) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (item.access_level !== 'purchase_required') {
    return NextResponse.json({ error: 'not_purchasable' }, { status: 400 });
  }
  const amount = Number(item.price_amount ?? 0);
  if (!amount || amount <= 0) {
    return NextResponse.json({ error: 'no_price_set' }, { status: 400 });
  }
  const currency = item.price_currency ?? 'ILS';

  const order = await createPendingOrder({
    userId: auth.userId,
    contentType,
    contentId: item.id,
    amount,
    currency,
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const checkout = await createHostedCheckout({
    publicOrderId: order.public_order_id,
    amount,
    currency,
    description: item.title ?? 'Digitech Hub',
    customerEmail: auth.email,
    customerName: auth.profile.full_name,
    successUrl: `${appUrl}/payment/success?order=${order.public_order_id}`,
    failureUrl: `${appUrl}/payment/failed?order=${order.public_order_id}`,
  });

  await setOrderCheckoutUrl(order.id, checkout.checkoutUrl);

  return NextResponse.json({
    checkoutUrl: checkout.checkoutUrl,
    publicOrderId: order.public_order_id,
    mock: checkout.mock,
  });
}
