import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { resolveFinalPrice } from '@/lib/payments/pricing';
import {
  createPendingOrder,
  getOpenPendingOrder,
  setOrderProviderRef,
  markOrderPaid,
  type ContentType,
} from '@/lib/payments/order-service';
import { grantEntitlement } from '@/lib/payments/entitlement-service';
import { enrollInCourse } from '@/lib/learn/enrollment';
import { resolveAccessLevel } from '@/lib/learn/access';
import { isSumitConfigured, sumitBeginRedirect } from '@/lib/payments/sumit';
import { buildCustomer, buildRedirectItem } from '@/lib/payments/sumit-mapping';

export const runtime = 'nodejs';

const PURCHASABLE: ContentType[] = ['course', 'guide'];

/**
 * POST { contentType, slug } — the single V1 purchase entry point.
 *
 * Server-trusted price (the client's numbers are never read):
 *   final == 0 → FREE: grant access immediately, record it, → success page.
 *   final  > 0 → PAID: create ONE pending order, open a SUMIT hosted Redirect
 *                checkout, and return its URL. NO access is granted here — that
 *                happens only in /api/payments/sumit/confirm after SUMIT verifies.
 */
export async function POST(request: Request) {
  const auth = await getCurrentUser();
  if (!auth) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const contentType = (body.contentType as ContentType | undefined) ?? 'course';
  const slug = body.slug as string | undefined;
  if (!slug || !PURCHASABLE.includes(contentType)) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  // Read the course via the service client: a purchase_required row is hidden by
  // RLS (migration 022) from a user who doesn't own it yet — exactly the buyer.
  // This is server-trusted pricing metadata; the price is still recomputed here,
  // never taken from the client.
  const service = createServiceClient();
  const { data: item } = await service
    .from('content_items')
    .select('id, slug, title, access_level, is_premium, price_amount, sale_amount, price_currency, status')
    .eq('slug', slug)
    .eq('type', contentType)
    .maybeSingle();
  if (!item || item.status !== 'published') {
    console.error('[purchase] course not found / unpublished', { slug, contentType, found: !!item, status: item?.status });
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const supabase = await createClient();

  const level = resolveAccessLevel(item);
  const price = resolveFinalPrice(item);

  // ----------------------------------------------------------------
  // FREE path — final price 0 (genuinely free OR fully discounted).
  // Grant immediately and record it. No SUMIT payment is created.
  // ----------------------------------------------------------------
  if (price.isFree) {
    if (level === 'open' || level === 'login_required') {
      const result = await enrollInCourse(slug);
      if (!result.ok && result.reason !== 'error') {
        return NextResponse.json({ error: result.reason }, { status: 400 });
      }
    } else {
      const existing = await getOpenPendingOrder(auth.userId, contentType, item.id);
      const order =
        existing ??
        (await createPendingOrder({
          userId: auth.userId,
          contentType,
          contentId: item.id,
          amount: 0,
          originalAmount: price.original,
          currency: price.currency,
        }));
      await markOrderPaid(order.id, null);
      await grantEntitlement({
        userId: auth.userId,
        resourceType: contentType,
        resourceId: item.id,
        orderId: order.id,
        source: 'purchase',
      });
    }
    return NextResponse.json({
      status: 'free',
      redirect: `/learn/checkout/success?course=${encodeURIComponent(slug)}`,
    });
  }

  // ----------------------------------------------------------------
  // PAID path — open a SUMIT Redirect checkout. No access granted here.
  // ----------------------------------------------------------------
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('phone, full_name')
    .eq('id', auth.userId)
    .maybeSingle();
  const phone = (profileRow?.phone as string | null) ?? '';
  if (!phone) {
    // The client gates on ContactInfoProvider; this is a server-side safety net.
    return NextResponse.json({ error: 'phone_required' }, { status: 400 });
  }

  if (!isSumitConfigured()) {
    return NextResponse.json({ error: 'provider_unconfigured' }, { status: 502 });
  }

  // Reuse an open order (idempotency). If it already has a checkout URL, reuse it
  // instead of creating a second SUMIT payment on a double-click / refresh.
  const existing = await getOpenPendingOrder(auth.userId, contentType, item.id);
  if (existing?.checkout_url) {
    return NextResponse.json({ status: 'redirect', url: existing.checkout_url });
  }
  const order =
    existing ??
    (await createPendingOrder({
      userId: auth.userId,
      contentType,
      contentId: item.id,
      amount: price.final,
      originalAmount: price.original,
      currency: price.currency,
      provider: 'sumit',
    }));

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const redirectUrl = `${appUrl}/api/payments/sumit/confirm?order=${encodeURIComponent(order.public_order_id)}`;

  try {
    const result = await sumitBeginRedirect({
      customer: buildCustomer({ name: profileRow?.full_name as string | null, email: auth.email, phone }),
      item: buildRedirectItem(item),
      redirectUrl,
      externalIdentifier: order.public_order_id,
    });
    await setOrderProviderRef(order.id, { checkoutUrl: result.redirectUrl, transactionId: result.paymentId });
    return NextResponse.json({ status: 'redirect', url: result.redirectUrl });
  } catch (e) {
    console.error('[purchase] SUMIT beginredirect failed', order.public_order_id, e);
    return NextResponse.json({ error: 'payment_init_failed' }, { status: 502 });
  }
}
