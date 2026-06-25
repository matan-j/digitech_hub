// ============================================================
// lib/cart/cart-service.ts
// The per-user shopping cart. Service-role only — every function is scoped by the
// caller-supplied userId (the API routes resolve it from the session first).
//
// RULES:
//   * One unit per product (DB UNIQUE(user_id, content_id)); adding an existing
//     item is a no-op, never a duplicate / quantity bump.
//   * Only purchasable, published items live in a cart. Currently the API guards
//     to courses; this layer stays generic.
//   * Prices are ALWAYS recomputed here from the content row (resolveFinalPrice) —
//     the client's numbers are never trusted, exactly like /api/purchase.
// ============================================================

import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveFinalPrice } from '@/lib/payments/pricing';
import type { ContentType } from '@/lib/payments/order-service';
import {
  getCartCouponCode,
  validateCoupon,
  clearCartCoupon,
  type CouponApplication,
} from '@/lib/payments/coupon-service';

/** A cart line enriched with the current (server-trusted) price + display data. */
export type CartLine = {
  content_type: ContentType;
  content_id: string;
  slug: string;
  title: string;
  cover_url: string | null;
  /** Pre-cropped 1:1 cover for the purchase webhook (may be null until generated). */
  cover_square_url: string | null;
  /** List price before discount. */
  price_before: number;
  /** Server-trusted price the customer pays for this line. */
  price_after: number;
  hasDiscount: boolean;
  currency: string;
  added_at: string;
};

/** The coupon currently applied to the cart (validated, priced). */
export type AppliedCoupon = {
  code: string;
  /** Amount (ILS) the coupon takes off total_after. */
  discount: number;
  applies_to: 'all' | 'specific';
};

export type CartSummary = {
  items: CartLine[];
  /** Sum of list prices. */
  total_before: number;
  /** Sum of final prices (what the customer pays before any coupon). */
  total_after: number;
  /** The applied coupon (null when none / auto-dropped as invalid). */
  coupon: AppliedCoupon | null;
  /** total_after minus the coupon discount (what we actually charge). */
  total_after_coupon: number;
  currency: string;
  count: number;
};

type CartRow = { content_type: ContentType; content_id: string; added_at: string };

/**
 * Load the user's cart, joined to live content rows and priced server-side.
 * Silently drops items whose content row is gone or no longer published, so a
 * stale cart never blocks checkout.
 */
export async function getCart(userId: string): Promise<CartSummary> {
  const supabase = createServiceClient();
  const { data: rows } = await supabase
    .from('cart_items')
    .select('content_type, content_id, added_at')
    .eq('user_id', userId)
    .order('added_at', { ascending: true });

  const cart = (rows ?? []) as CartRow[];
  if (cart.length === 0) {
    // An empty cart can hold no coupon — drop any stale application.
    await clearCartCoupon(userId);
    return {
      items: [],
      total_before: 0,
      total_after: 0,
      coupon: null,
      total_after_coupon: 0,
      currency: 'ILS',
      count: 0,
    };
  }

  const ids = cart.map((r) => r.content_id);
  const { data: contentRows } = await supabase
    .from('content_items')
    .select('id, slug, title, cover_url, cover_square_url, price_amount, sale_amount, price_currency, status')
    .in('id', ids);

  const byId = new Map(
    (contentRows ?? []).map((c) => [c.id as string, c as Record<string, unknown>]),
  );

  const items: CartLine[] = [];
  for (const row of cart) {
    const c = byId.get(row.content_id);
    if (!c || c.status !== 'published') continue; // drop deleted/unpublished
    const price = resolveFinalPrice({
      price_amount: c.price_amount as number | null,
      sale_amount: c.sale_amount as number | null,
      price_currency: c.price_currency as string | null,
    });
    items.push({
      content_type: row.content_type,
      content_id: row.content_id,
      slug: c.slug as string,
      title: (c.title as string) ?? (c.slug as string),
      cover_url: (c.cover_url as string | null) ?? null,
      cover_square_url: (c.cover_square_url as string | null) ?? null,
      price_before: price.original,
      price_after: price.final,
      hasDiscount: price.hasDiscount,
      currency: price.currency,
      added_at: row.added_at,
    });
  }

  const total_before = items.reduce((s, i) => s + i.price_before, 0);
  const total_after = items.reduce((s, i) => s + i.price_after, 0);

  // Apply the cart's coupon if one is set. Re-validated on every load against the
  // live cart — if it no longer holds (expired, cart changed, etc.) we drop it so
  // the cart never shows a phantom discount.
  let coupon: AppliedCoupon | null = null;
  let total_after_coupon = total_after;
  const code = await getCartCouponCode(userId);
  if (code) {
    const res = await validateCoupon(
      code,
      userId,
      items.map((i) => ({ content_id: i.content_id, price_after: i.price_after })),
    );
    if (res.ok) {
      coupon = { code: res.code, discount: res.discount, applies_to: res.applies_to };
      total_after_coupon = res.total_after_coupon;
    } else {
      await clearCartCoupon(userId);
    }
  }

  return {
    items,
    total_before,
    total_after,
    coupon,
    total_after_coupon,
    currency: items[0]?.currency ?? 'ILS',
    count: items.length,
  };
}

/** Exposed for the checkout route's server-trusted re-validation. */
export type { CouponApplication };

/**
 * Add one unit of a product to the cart. Idempotent — the UNIQUE constraint means
 * a second add of the same product is ignored (never a duplicate). Returns the
 * refreshed cart. Throws if the slug isn't a published, purchasable item.
 */
export async function addToCart(
  userId: string,
  contentType: ContentType,
  slug: string,
): Promise<CartSummary> {
  const supabase = createServiceClient();
  const { data: item } = await supabase
    .from('content_items')
    .select('id, status')
    .eq('slug', slug)
    .eq('type', contentType)
    .maybeSingle();
  if (!item || item.status !== 'published') {
    throw new Error('not_found');
  }

  await supabase
    .from('cart_items')
    .upsert(
      { user_id: userId, content_type: contentType, content_id: item.id as string },
      { onConflict: 'user_id,content_id', ignoreDuplicates: true },
    );

  return getCart(userId);
}

/** Remove one product from the cart by its content id. Returns the refreshed cart. */
export async function removeFromCart(userId: string, contentId: string): Promise<CartSummary> {
  const supabase = createServiceClient();
  await supabase.from('cart_items').delete().eq('user_id', userId).eq('content_id', contentId);
  return getCart(userId);
}

/**
 * Remove a specific set of products from the cart (called by the success webhook
 * after a bundle is paid, to clear exactly what was purchased). No-op on empty.
 */
export async function clearCartItems(userId: string, contentIds: string[]): Promise<void> {
  if (contentIds.length === 0) return;
  const supabase = createServiceClient();
  await supabase.from('cart_items').delete().eq('user_id', userId).in('content_id', contentIds);
}
