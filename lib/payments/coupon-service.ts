// ============================================================
// lib/payments/coupon-service.ts
// Coupon validation, discount math, cart application + redemption. Service-role
// only (bypasses RLS) — coupons are an admin-owned table the buyer never reads
// directly. The discount is ALWAYS computed on the effective (post-sale) price,
// mirroring resolveFinalPrice() in lib/payments/pricing.ts.
//
// RULES:
//   * Discount only ever reduces the amount we charge. The coupon code is never
//     put on a webhook payload — only on the local order row (set at checkout).
//   * "Redeemed" is recorded ONLY for a verified, PAID order (recordRedemption,
//     called from the success webhook) — never when a coupon is typed in the cart.
//   * One coupon per cart (cart_coupons.user_id PK). No stacking.
// ============================================================

import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

export type CouponRow = {
  id: string;
  code: string;
  internal_name: string | null;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  applies_to: 'all' | 'specific';
  customer_scope: 'all' | 'specific';
  one_time_scope: 'none' | 'global' | 'per_customer';
  valid_from: string | null;
  valid_until: string | null;
  is_redeemed: boolean;
  is_active: boolean;
};

/** Minimal cart line the validator needs (kept independent of cart-service). */
export type CouponCartLine = { content_id: string; price_after: number };

export type CouponError =
  | 'not_found'
  | 'inactive'
  | 'redeemed'
  | 'not_yet_valid'
  | 'expired'
  | 'customer_not_allowed'
  | 'already_used'
  | 'no_matching_items'
  | 'empty_cart'
  | 'nothing_to_discount';

/** A successful application — the numbers the cart + checkout act on. */
export type CouponApplication = {
  coupon_id: string;
  code: string;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  /** Whole-cart vs only the linked products. */
  applies_to: 'all' | 'specific';
  /** Amount (ILS) subtracted from the cart's total_after. */
  discount: number;
  /** Cart total after the coupon (floored at 0). */
  total_after_coupon: number;
  /**
   * Per-line discount for a 'specific' coupon (content_id → ILS off that line).
   * Empty for an 'all' coupon, whose discount is cart-wide (shown in the summary).
   */
  line_discounts: Record<string, number>;
};

export type CouponResult =
  | ({ ok: true } & CouponApplication)
  | { ok: false; reason: CouponError };

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Validate a code for a user + cart and compute the discount. Pure read — does
 * NOT persist anything (no redemption, no cart row). Returns the priced
 * application or the reason it failed.
 */
export async function validateCoupon(
  rawCode: string,
  userId: string,
  lines: CouponCartLine[],
): Promise<CouponResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, reason: 'not_found' };

  const supabase = createServiceClient();
  const { data: row } = await supabase.from('coupons').select('*').eq('code', code).maybeSingle();
  const coupon = row as CouponRow | null;
  if (!coupon) return { ok: false, reason: 'not_found' };

  if (coupon.is_redeemed) return { ok: false, reason: 'redeemed' };
  if (!coupon.is_active) return { ok: false, reason: 'inactive' };

  const now = Date.now();
  if (coupon.valid_from && new Date(coupon.valid_from).getTime() > now) {
    return { ok: false, reason: 'not_yet_valid' };
  }
  if (coupon.valid_until && new Date(coupon.valid_until).getTime() < now) {
    return { ok: false, reason: 'expired' };
  }

  // Customer restriction.
  if (coupon.customer_scope === 'specific') {
    const { data: allowed } = await supabase
      .from('coupon_customers')
      .select('user_id')
      .eq('coupon_id', coupon.id)
      .eq('user_id', userId)
      .maybeSingle();
    if (!allowed) return { ok: false, reason: 'customer_not_allowed' };
  }

  // Per-customer one-time: a prior paid redemption by this user blocks reuse.
  // ('global' one-time is enforced by is_redeemed above.)
  if (coupon.one_time_scope === 'per_customer') {
    const { data: prior } = await supabase
      .from('coupon_redemptions')
      .select('id')
      .eq('coupon_id', coupon.id)
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();
    if (prior) return { ok: false, reason: 'already_used' };
  }

  if (lines.length === 0) return { ok: false, reason: 'empty_cart' };

  const value = Number(coupon.discount_value);
  const lineDiscounts: Record<string, number> = {};
  let discount: number;

  if (coupon.applies_to === 'specific') {
    // Only the linked products get a discount — and it shows on each of their
    // cart rows (line_discounts), not just the cart total.
    const { data: prods } = await supabase
      .from('coupon_products')
      .select('content_id')
      .eq('coupon_id', coupon.id);
    const allowedIds = new Set((prods ?? []).map((p) => p.content_id as string));
    const matching = lines.filter((l) => allowedIds.has(l.content_id) && l.price_after > 0);
    if (matching.length === 0) return { ok: false, reason: 'no_matching_items' };
    const base = matching.reduce((s, l) => s + l.price_after, 0);
    if (base <= 0) return { ok: false, reason: 'nothing_to_discount' };

    if (coupon.discount_type === 'percentage') {
      for (const l of matching) {
        const d = Math.min(l.price_after, round2((l.price_after * value) / 100));
        if (d > 0) lineDiscounts[l.content_id] = d;
      }
    } else {
      // Fixed amount spread proportionally across the matching lines (capped per
      // line at its own price). The last line absorbs the rounding remainder.
      const totalFixed = Math.min(value, base);
      let allocated = 0;
      matching.forEach((l, idx) => {
        const raw = idx === matching.length - 1
          ? round2(totalFixed - allocated)
          : round2((totalFixed * l.price_after) / base);
        const d = Math.max(0, Math.min(raw, l.price_after));
        if (d > 0) lineDiscounts[l.content_id] = d;
        allocated = round2(allocated + d);
      });
    }
    discount = round2(Object.values(lineDiscounts).reduce((s, d) => s + d, 0));
  } else {
    const base = lines.reduce((s, l) => s + l.price_after, 0);
    if (base <= 0) return { ok: false, reason: 'nothing_to_discount' };
    discount = round2(coupon.discount_type === 'percentage' ? (base * value) / 100 : Math.min(value, base));
  }

  if (discount <= 0) return { ok: false, reason: 'nothing_to_discount' };

  const cartTotal = lines.reduce((s, l) => s + l.price_after, 0);
  const total_after_coupon = Math.max(0, round2(cartTotal - discount));

  return {
    ok: true,
    coupon_id: coupon.id,
    code: coupon.code,
    discount_type: coupon.discount_type,
    discount_value: value,
    applies_to: coupon.applies_to,
    discount,
    total_after_coupon,
    line_discounts: lineDiscounts,
  };
}

/** The coupon code currently applied to a user's cart, or null. */
export async function getCartCouponCode(userId: string): Promise<string | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('cart_coupons')
    .select('coupons(code)')
    .eq('user_id', userId)
    .maybeSingle();
  const code = (data as { coupons?: { code?: string } } | null)?.coupons?.code;
  return code ?? null;
}

/** Apply (replace) the cart's single coupon. */
export async function setCartCoupon(userId: string, couponId: string): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from('cart_coupons')
    .upsert({ user_id: userId, coupon_id: couponId }, { onConflict: 'user_id' });
}

/** Remove any coupon applied to the cart. */
export async function clearCartCoupon(userId: string): Promise<void> {
  const supabase = createServiceClient();
  await supabase.from('cart_coupons').delete().eq('user_id', userId);
}

/**
 * Record a coupon redemption for a PAID order (called from the verified success
 * webhook). Idempotent on (coupon_id, order_id) so replays never double-record.
 * A 'global' one-time coupon is marked redeemed + deactivated here.
 */
export async function recordRedemption(params: {
  couponId: string;
  userId: string;
  orderId: string;
  discount: number;
}): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from('coupon_redemptions').upsert(
    {
      coupon_id: params.couponId,
      user_id: params.userId,
      order_id: params.orderId,
      discount_amount: params.discount,
    },
    { onConflict: 'coupon_id,order_id', ignoreDuplicates: true },
  );
  if (error) {
    console.error('[coupon-service] recordRedemption failed', params.orderId, error.message);
    return;
  }

  // Global one-time → burn it: mark redeemed + deactivate for everyone.
  const { data: coupon } = await supabase
    .from('coupons')
    .select('one_time_scope')
    .eq('id', params.couponId)
    .maybeSingle();
  if ((coupon as { one_time_scope?: string } | null)?.one_time_scope === 'global') {
    await supabase
      .from('coupons')
      .update({ is_redeemed: true, is_active: false })
      .eq('id', params.couponId);
  }
}
