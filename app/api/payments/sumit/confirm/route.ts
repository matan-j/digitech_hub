import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { sumitGetPayment } from '@/lib/payments/sumit';
import {
  getOrderByPublicId,
  markOrderPaid,
  markOrderFailed,
  validatePaymentAgainstOrder,
  type Order,
} from '@/lib/payments/order-service';
import { grantEntitlement } from '@/lib/payments/entitlement-service';

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

  if (!publicOrderId) return dest('/payment/failed');

  const order = await getOrderByPublicId(publicOrderId);
  if (!order) return dest('/payment/failed');

  const supabase = createServiceClient();
  const slug = await courseSlug(order);

  // Already settled (idempotent re-entry) — don't re-verify or re-grant.
  if (order.status === 'paid') {
    return dest(`/learn/checkout/success?course=${encodeURIComponent(slug ?? '')}`);
  }

  const paymentId = paymentIdParam ?? order.provider_transaction_id;

  const log = async (status: 'processed' | 'error' | 'ignored', raw: unknown, error?: string) => {
    await supabase.from('payment_events').insert({
      order_id: order.id,
      provider: 'sumit',
      provider_event_id: `confirm-${crypto.randomUUID()}`,
      event_type: 'confirm',
      raw_payload: (raw ?? {}) as Record<string, unknown>,
      processing_status: status,
      processing_error: error ?? null,
      processed_at: new Date().toISOString(),
    });
  };

  if (!paymentId) {
    await log('ignored', { reason: 'missing payment id', publicOrderId });
    return dest('/payment/failed');
  }

  let payment;
  try {
    payment = await sumitGetPayment(String(paymentId));
  } catch (e) {
    console.error('[sumit:confirm] verify failed', publicOrderId, e);
    await log('error', { error: String(e) }, String(e));
    return dest('/payment/failed');
  }

  // Verified-not-valid → never grant access.
  if (!payment.valid) {
    await markOrderFailed(order.id);
    await log('processed', payment.raw, 'payment not valid');
    return dest('/payment/failed');
  }

  // Defence-in-depth: the verified amount/currency must match our order.
  const mismatch = validatePaymentAgainstOrder(order, {
    amount: payment.amount,
    currency: payment.currency,
    providerTransactionId: payment.transactionId,
  });
  if (mismatch) {
    await markOrderFailed(order.id);
    await log('error', payment.raw, mismatch);
    return dest('/payment/failed');
  }

  // Grant access BEFORE redirecting the user back into the app.
  await markOrderPaid(order.id, payment.transactionId);
  await grantEntitlement({
    userId: order.user_id,
    resourceType: order.content_type,
    resourceId: order.content_id,
    orderId: order.id,
    source: 'purchase',
  });
  await log('processed', payment.raw);

  return dest(`/learn/checkout/success?course=${encodeURIComponent(slug ?? '')}`);
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
