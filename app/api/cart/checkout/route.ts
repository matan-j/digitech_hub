// ============================================================
// POST /api/cart/checkout
// Checkout for the whole mini cart. Mirrors the single-item Make.com lead flow
// (app/api/purchase/route.ts → paidViaMake) but for MANY products at once:
//
//   * Recomputes every line price server-side (never trusts the client).
//   * Creates ONE pending order (content_type='bundle', content_id=user_id so the
//     existing partial-unique index allows just one open bundle per user) plus one
//     order_items row per product (the price + title + cover snapshot).
//   * Fires the SAME outbound webhook payload shape (PurchaseWebhookPayload) — the
//     products[] array now carries every cart item (incl. image_url), amount is the
//     basket total. No webhook structure change.
//   * Returns the GROW payment link. Access is granted only later by the verified
//     success webhook, which grants one entitlement per order_items row.
//
// Coupon (future): when a real coupon exists, reduce `amount` here to the post-
// coupon total — it is already the field GROW charges and we validate against.
// ============================================================

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getCart } from '@/lib/cart/cart-service';
import {
  createPendingOrder,
  createOrderItems,
  getOpenPendingOrder,
  setOrderProviderRef,
  markRequestWebhook,
  markOrderFailed,
} from '@/lib/payments/order-service';
import {
  sendPurchaseRequestWebhook,
  israelDateTime,
  type PurchaseWebhookPayload,
} from '@/lib/payments/make-webhook';
import { ensureSquareCoverUrl } from '@/lib/images/square-cover';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const auth = await getCurrentUser();
  if (!auth) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const phoneInput = typeof body.phone === 'string' ? body.phone.trim() : '';

  const cart = await getCart(auth.userId);
  if (cart.count === 0) {
    return NextResponse.json({ error: 'empty_cart' }, { status: 400 });
  }
  // A fully-free basket can't go through the payment link. Out of V1 scope —
  // free items are handled by the single-item flow.
  if (cart.total_after <= 0) {
    return NextResponse.json({ error: 'nothing_to_charge' }, { status: 400 });
  }

  // Phone is required for the lead (same rule as single-item). Prefer the stored
  // profile phone; accept + persist a freshly-collected one from the request.
  const supabase = await createClient();
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('phone, full_name')
    .eq('id', auth.userId)
    .maybeSingle();
  let phone = (profileRow?.phone as string | null) ?? '';
  if (!phone && phoneInput) {
    phone = phoneInput;
    const service = createServiceClient();
    await service.from('profiles').update({ phone }).eq('id', auth.userId);
  }
  if (!phone) {
    return NextResponse.json({ error: 'phone_required' }, { status: 400 });
  }

  // Reuse an open bundle order on a genuine double-click (same total + has link).
  // Otherwise the cart changed since last attempt → retire the stale order so the
  // partial-unique index frees up, and build a fresh one.
  const existing = await getOpenPendingOrder(auth.userId, 'bundle', auth.userId);
  if (existing) {
    if (existing.checkout_url && Number(existing.amount) === cart.total_after) {
      return NextResponse.json({ status: 'redirect', url: existing.checkout_url });
    }
    await markOrderFailed(existing.id);
  }

  const order = await createPendingOrder({
    userId: auth.userId,
    contentType: 'bundle',
    contentId: auth.userId, // one open bundle per user (partial-unique index)
    amount: cart.total_after,
    originalAmount: cart.total_before,
    currency: cart.currency,
  });

  await createOrderItems(
    order.id,
    cart.items.map((i) => ({
      contentType: i.content_type,
      contentId: i.content_id,
      productTitle: i.title,
      coverUrl: i.cover_url,
      priceBefore: i.price_before,
      priceAfter: i.price_after,
    })),
  );

  // Resolve a pre-cropped 1:1 cover per line (cached on the item; lazily generated
  // + stored on first use). Falls back to the original cover, never to empty.
  const products = await Promise.all(
    cart.items.map(async (i) => ({
      product_name: i.title,
      price_before_discount: i.price_before,
      price_after_discount: i.price_after,
      image_url:
        (await ensureSquareCoverUrl({
          id: i.content_id,
          coverUrl: i.cover_url,
          coverSquareUrl: i.cover_square_url,
        })) ?? '',
    })),
  );

  const payload: PurchaseWebhookPayload = {
    customer_name: (profileRow?.full_name as string | null) ?? auth.profile.full_name ?? '',
    customer_email: auth.email,
    customer_phone: phone,
    current_datetime: israelDateTime(),
    products,
    public_order_id: order.public_order_id,
    user_id: auth.userId,
    content_type: 'bundle',
    content_id: auth.userId,
    content_slug: 'cart',
    amount: cart.total_after,
    original_amount: cart.total_before,
    currency: cart.currency,
  };

  const sent = await sendPurchaseRequestWebhook(payload);
  if (!sent.ok) {
    await markRequestWebhook(order.id, 'failed', sent.error);
    return NextResponse.json(
      { error: 'webhook_failed', publicOrderId: order.public_order_id },
      { status: 502 },
    );
  }
  await markRequestWebhook(order.id, 'sent');

  if (sent.processId || sent.paymentUrl) {
    await setOrderProviderRef(order.id, {
      checkoutUrl: sent.paymentUrl ?? undefined,
      transactionId: sent.processId ?? undefined,
    });
  }
  if (sent.paymentUrl) {
    return NextResponse.json({ status: 'redirect', url: sent.paymentUrl });
  }

  // No link came back → branded pending page (same fallback as single-item).
  return NextResponse.json({
    status: 'pending',
    redirect: `/learn/checkout/pending?order=${encodeURIComponent(order.public_order_id)}`,
  });
}
