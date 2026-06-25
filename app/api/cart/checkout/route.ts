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
// Coupon: a coupon applied to the cart (cart_coupons) is re-validated server-side
// here and only LOWERS `amount` to the post-coupon total — the field GROW already
// charges and validates against. The code is snapshotted on the local order
// (orders.coupon_*) but never added to the webhook payload. Redemption is recorded
// only once the order is verified paid (success webhook).
// ============================================================

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getCart, clearCartItems } from '@/lib/cart/cart-service';
import { clearCartCoupon, recordRedemption } from '@/lib/payments/coupon-service';
import { grantEntitlement } from '@/lib/payments/entitlement-service';
import {
  createPendingOrder,
  createOrderItems,
  getOpenPendingOrder,
  setOrderProviderRef,
  markRequestWebhook,
  markOrderFailed,
  markOrderPaid,
} from '@/lib/payments/order-service';
import {
  sendPurchaseRequestWebhook,
  israelDateTime,
  type PurchaseWebhookPayload,
} from '@/lib/payments/make-webhook';
import { ensureSquareCoverUrl } from '@/lib/images/square-cover';

export const runtime = 'nodejs';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Per-line coupon discount (content_id → ILS off that line) so each product's
 * webhook price_after_discount can reflect the coupon too — keeping the payload
 * STRUCTURE identical, only the values change, and Σ(price_after_discount) equals
 * the charged `amount`.
 *   - 'specific' coupon → use the validator's per-line breakdown as-is.
 *   - 'all' coupon → spread the cart-wide discount proportionally to each line's
 *     price_after; the last line absorbs the rounding remainder so the sum is exact.
 */
function couponLineDiscounts(
  items: { content_id: string; price_after: number }[],
  detail: { applies_to: 'all' | 'specific'; line_discounts: Record<string, number> } | null,
  totalDiscount: number,
): Record<string, number> {
  if (!detail || totalDiscount <= 0) return {};
  if (detail.applies_to === 'specific') return detail.line_discounts;

  const eligible = items.filter((i) => i.price_after > 0);
  const base = eligible.reduce((s, i) => s + i.price_after, 0);
  if (base <= 0) return {};
  const out: Record<string, number> = {};
  let allocated = 0;
  eligible.forEach((i, idx) => {
    const raw =
      idx === eligible.length - 1
        ? round2(totalDiscount - allocated)
        : round2((totalDiscount * i.price_after) / base);
    const d = Math.max(0, Math.min(raw, i.price_after));
    out[i.content_id] = d;
    allocated = round2(allocated + d);
  });
  return out;
}

export async function POST(request: Request) {
  const auth = await getCurrentUser();
  if (!auth) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const phoneInput = typeof body.phone === 'string' ? body.phone.trim() : '';

  // getCart already re-validates the coupon server-side on every load (and drops it
  // if stale), so its result is authoritative — no second validateCoupon round-trip
  // here. The profile read and the open-order lookup don't depend on the cart, so
  // fire all three together instead of sequentially.
  const supabase = await createClient();
  const [cart, profileResult, existing] = await Promise.all([
    getCart(auth.userId),
    supabase.from('profiles').select('phone, full_name').eq('id', auth.userId).maybeSingle(),
    getOpenPendingOrder(auth.userId, 'bundle', auth.userId),
  ]);
  const profileRow = profileResult.data;
  if (cart.count === 0) {
    return NextResponse.json({ error: 'empty_cart' }, { status: 400 });
  }

  // Reuse the coupon getCart already validated + priced. It only LOWERS `amount` —
  // the webhook payload shape is unchanged. The per-line breakdown is carried on the
  // cart rows (coupon_discount), so we reconstruct line_discounts without a re-read.
  const coupon = cart.coupon
    ? { id: cart.coupon.id, code: cart.coupon.code, discount: cart.coupon.discount }
    : null;
  const couponDetail: { applies_to: 'all' | 'specific'; line_discounts: Record<string, number> } | null =
    cart.coupon
      ? {
          applies_to: cart.coupon.applies_to,
          line_discounts: Object.fromEntries(
            cart.items.filter((i) => (i.coupon_discount ?? 0) > 0).map((i) => [i.content_id, i.coupon_discount]),
          ),
        }
      : null;
  const payable = cart.total_after_coupon;

  // A coupon that zeroes the basket → grant immediately, no payment link (mirrors
  // the single-item free path). Records the redemption against a paid £0 order.
  if (payable <= 0) {
    const order = await createPendingOrder({
      userId: auth.userId,
      contentType: 'bundle',
      contentId: auth.userId,
      amount: 0,
      originalAmount: cart.total_before,
      currency: cart.currency,
      coupon,
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
    await markOrderPaid(order.id, `free-${order.public_order_id}`);
    for (const i of cart.items) {
      await grantEntitlement({
        userId: auth.userId,
        resourceType: i.content_type,
        resourceId: i.content_id,
        orderId: order.id,
        source: 'purchase',
      });
    }
    if (coupon) {
      await recordRedemption({
        couponId: coupon.id,
        userId: auth.userId,
        orderId: order.id,
        discount: coupon.discount,
      });
    }
    await clearCartItems(auth.userId, cart.items.map((i) => i.content_id));
    await clearCartCoupon(auth.userId);
    return NextResponse.json({
      status: 'redirect',
      url: `/learn/checkout/success?order=${encodeURIComponent(order.public_order_id)}`,
    });
  }

  // Phone is required for the lead (same rule as single-item). Prefer the stored
  // profile phone (read above); accept + persist a freshly-collected one.
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
  // partial-unique index frees up, and build a fresh one. (`existing` fetched above.)
  if (existing) {
    if (existing.checkout_url && Number(existing.amount) === payable) {
      return NextResponse.json({ status: 'redirect', url: existing.checkout_url });
    }
    await markOrderFailed(existing.id);
  }

  // Distribute the coupon across lines so each product's price_after_discount is
  // the real post-coupon price (Σ == payable). Webhook structure is unchanged.
  const lineCoupon = couponLineDiscounts(
    cart.items.map((i) => ({ content_id: i.content_id, price_after: i.price_after })),
    couponDetail,
    coupon?.discount ?? 0,
  );

  // The order INSERT and the per-line 1:1 cover resolution are independent — run
  // them together. Covers are cached on the item (lazily generated + stored only on
  // first use); each falls back to the original cover, never to empty.
  const [order, products] = await Promise.all([
    createPendingOrder({
      userId: auth.userId,
      contentType: 'bundle',
      contentId: auth.userId, // one open bundle per user (partial-unique index)
      amount: payable,
      originalAmount: cart.total_before,
      currency: cart.currency,
      coupon,
    }),
    Promise.all(
      cart.items.map(async (i) => ({
        product_name: i.title,
        price_before_discount: i.price_before,
        // Effective per-line price after the item sale AND the coupon's share.
        price_after_discount: Math.max(0, round2(i.price_after - (lineCoupon[i.content_id] ?? 0))),
        image_url:
          (await ensureSquareCoverUrl({
            id: i.content_id,
            coverUrl: i.cover_url,
            coverSquareUrl: i.cover_square_url,
          })) ?? '',
      })),
    ),
  ]);

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
    // Post-coupon total — the only figure GROW charges. The coupon code itself is
    // intentionally NOT part of this payload (webhook contract unchanged).
    amount: payable,
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
