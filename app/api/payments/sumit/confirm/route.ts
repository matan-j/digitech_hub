import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getOrderByPublicId, type Order } from '@/lib/payments/order-service';
import { settleSumitOrder } from '@/lib/payments/sumit-settle';

export const runtime = 'nodejs';

/**
 * SUMIT Redirect return target — the ONLY place a paid entitlement is created.
 *
 * SUMIT sends the buyer here (GET) after checkout, appending ?OG-PaymentID=<id>
 * to the RedirectURL we provided. We verify the payment server-side, grant access
 * BEFORE redirecting, and only then send the user into the app. Idempotent:
 * markOrderPaid is a no-op once paid and grantEntitlement upserts on (user,resource),
 * so a double-hit never duplicates access.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || url.origin;
  const dest = (path: string) => NextResponse.redirect(new URL(path, appUrl));

  const publicOrderId = url.searchParams.get('order');
  // SUMIT appends OG-PaymentID; tolerate a couple of casings.
  const paymentIdParam =
    url.searchParams.get('OG-PaymentID') ??
    url.searchParams.get('og-paymentid') ??
    url.searchParams.get('PaymentID');
  // SUMIT may also append the created document id (the receipt/invoice).
  const documentIdParam =
    url.searchParams.get('OG-DocumentID') ??
    url.searchParams.get('og-documentid') ??
    url.searchParams.get('DocumentID');

  if (!publicOrderId) return dest('/payment/failed');

  const order = await getOrderByPublicId(publicOrderId);
  if (!order) return dest('/payment/failed');

  const slug = await courseSlug(order);
  const success = () => dest(`/learn/checkout/success?course=${encodeURIComponent(slug ?? '')}`);

  // Verify with SUMIT + grant access BEFORE redirecting the user into the app.
  // Idempotent: an already-paid order (e.g. the webhook beat us here) returns
  // 'already_paid' and we still send the user to success.
  const result = await settleSumitOrder({
    order,
    paymentIdHint: paymentIdParam,
    documentIdHint: documentIdParam,
    source: 'confirm',
    rawPayload: { publicOrderId, paymentIdParam, documentIdParam, query: Object.fromEntries(url.searchParams) },
  });

  if (result.outcome === 'granted' || result.outcome === 'already_paid') return success();
  return dest('/payment/failed');
}

async function courseSlug(order: Order): Promise<string | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('content_items')
    .select('slug')
    .eq('id', order.content_id)
    .maybeSingle();
  return (data?.slug as string | null) ?? null;
}
