// ============================================================
// /api/cart/coupon — apply / remove the cart's single coupon.
//   POST   { code } → validate against the live cart + apply (no stacking).
//   DELETE          → remove the applied coupon.
// Returns the refreshed, coupon-priced cart (same shape as GET /api/cart).
// Validation is server-trusted; the code is re-checked again at checkout.
// ============================================================

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getCart } from '@/lib/cart/cart-service';
import {
  validateCoupon,
  setCartCoupon,
  clearCartCoupon,
  type CouponError,
} from '@/lib/payments/coupon-service';

export const runtime = 'nodejs';

// Buyer-facing Hebrew messages per failure reason.
const REASON_MESSAGE: Record<CouponError, string> = {
  not_found: 'קוד הקופון לא נמצא.',
  inactive: 'הקופון אינו פעיל.',
  redeemed: 'הקופון כבר מומש.',
  not_yet_valid: 'הקופון עדיין לא בתוקף.',
  expired: 'תוקף הקופון פג.',
  customer_not_allowed: 'הקופון אינו זמין לחשבון הזה.',
  already_used: 'כבר השתמשת בקופון הזה.',
  no_matching_items: 'הקופון לא חל על הפריטים שבסל.',
  empty_cart: 'הסל ריק.',
  nothing_to_discount: 'אין סכום להחלת ההנחה.',
};

export async function POST(request: Request) {
  const auth = await getCurrentUser();
  if (!auth) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const code = typeof body.code === 'string' ? body.code : '';
  if (!code.trim()) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  // Validate against the current (coupon-free) cart lines.
  const cart = await getCart(auth.userId);
  const res = await validateCoupon(
    code,
    auth.userId,
    cart.items.map((i) => ({ content_id: i.content_id, price_after: i.price_after })),
  );
  if (!res.ok) {
    return NextResponse.json(
      { error: 'invalid_coupon', reason: res.reason, message: REASON_MESSAGE[res.reason] },
      { status: 400 },
    );
  }

  await setCartCoupon(auth.userId, res.coupon_id);
  return NextResponse.json(await getCart(auth.userId));
}

export async function DELETE() {
  const auth = await getCurrentUser();
  if (!auth) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  await clearCartCoupon(auth.userId);
  return NextResponse.json(await getCart(auth.userId));
}
