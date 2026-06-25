// ============================================================
// /api/cart — the per-user mini cart.
//   GET    → the current user's cart (priced server-side).
//   POST   { slug, contentType? } → add one unit (courses only for now).
//   DELETE { contentId }          → remove one product.
// All require an authenticated session (the cart is per-user and persistent).
// ============================================================

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getCart, addToCart, removeFromCart } from '@/lib/cart/cart-service';
import type { ContentType } from '@/lib/payments/order-service';

export const runtime = 'nodejs';

// Courses and bundles can be added to the cart. A bundle line is expanded into
// its course entitlements on paid checkout (grantPurchaseAccess, migration 036).
const CART_ALLOWED: ContentType[] = ['course', 'bundle'];

export async function GET() {
  const auth = await getCurrentUser();
  if (!auth) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const cart = await getCart(auth.userId);
  return NextResponse.json(cart);
}

export async function POST(request: Request) {
  const auth = await getCurrentUser();
  if (!auth) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const contentType = (body.contentType as ContentType | undefined) ?? 'course';
  const slug = typeof body.slug === 'string' ? body.slug : '';
  if (!slug || !CART_ALLOWED.includes(contentType)) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  try {
    const cart = await addToCart(auth.userId, contentType, slug);
    return NextResponse.json(cart);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error';
    if (msg === 'not_found') return NextResponse.json({ error: 'not_found' }, { status: 404 });
    console.error('[cart] add failed', slug, msg);
    return NextResponse.json({ error: 'error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await getCurrentUser();
  if (!auth) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const contentId = typeof body.contentId === 'string' ? body.contentId : '';
  if (!contentId) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  const cart = await removeFromCart(auth.userId, contentId);
  return NextResponse.json(cart);
}
