import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { resolveFinalPrice } from '@/lib/payments/pricing';
import {
  createPendingOrder,
  getOpenPendingOrder,
  markRequestWebhook,
  markOrderPaid,
  type ContentType,
} from '@/lib/payments/order-service';
import { grantEntitlement } from '@/lib/payments/entitlement-service';
import { enrollInCourse } from '@/lib/learn/enrollment';
import { resolveAccessLevel } from '@/lib/learn/access';
import {
  sendPurchaseRequestWebhook,
  israelDateTime,
  type PurchaseWebhookPayload,
} from '@/lib/payments/make-webhook';

export const runtime = 'nodejs';

const PURCHASABLE: ContentType[] = ['course', 'guide'];

/**
 * POST { contentType, slug, phone? } — the single V1 purchase entry point.
 *
 * Decision (server-trusted price; the client's numbers are never trusted):
 *   final price == 0  → FREE: grant access immediately, record it, redirect to
 *                       the branded success page.
 *   final price  > 0  → PAID: require a phone, create ONE pending order, fire the
 *                       Make.com lead webhook, redirect to the branded pending
 *                       page. NO access is granted and NO payment link is opened.
 */
export async function POST(request: Request) {
  const auth = await getCurrentUser();
  if (!auth) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const contentType = (body.contentType as ContentType | undefined) ?? 'course';
  const slug = body.slug as string | undefined;
  const phoneInput = typeof body.phone === 'string' ? body.phone.trim() : '';
  if (!slug || !PURCHASABLE.includes(contentType)) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: item } = await supabase
    .from('content_items')
    .select('id, slug, title, access_level, is_premium, price_amount, sale_amount, price_currency, status')
    .eq('slug', slug)
    .eq('type', contentType)
    .maybeSingle();
  if (!item || item.status !== 'published') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const level = resolveAccessLevel(item);
  const price = resolveFinalPrice(item);

  // ----------------------------------------------------------------
  // FREE path — final price 0 (genuinely free OR fully discounted).
  // Grant immediately and record it. Never send a payment webhook.
  // ----------------------------------------------------------------
  if (price.isFree) {
    if (level === 'open' || level === 'login_required') {
      const result = await enrollInCourse(slug);
      if (!result.ok && result.reason !== 'error') {
        return NextResponse.json({ error: result.reason }, { status: 400 });
      }
    } else {
      // purchase_required but final price is 0 → mint a 0-amount paid order and
      // grant the entitlement (idempotent on user+resource).
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
  // PAID path — request only. Pending order + lead webhook. No access.
  // ----------------------------------------------------------------

  // Phone is required for the lead. Prefer the stored profile phone; accept and
  // persist a freshly-collected one from the request.
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

  // Reuse an existing open order (idempotency) — never create a second one.
  const existing = await getOpenPendingOrder(auth.userId, contentType, item.id);
  const order =
    existing ??
    (await createPendingOrder({
      userId: auth.userId,
      contentType,
      contentId: item.id,
      amount: price.final,
      originalAmount: price.original,
      currency: price.currency,
    }));

  // If we already sent the webhook for this open order, don't resend it on a
  // double-click / refresh — just route to the pending page again.
  if (existing && order.request_webhook_status === 'sent') {
    return NextResponse.json({
      status: 'pending',
      redirect: `/learn/checkout/pending?order=${encodeURIComponent(order.public_order_id)}`,
    });
  }

  const payload: PurchaseWebhookPayload = {
    customer_name: (profileRow?.full_name as string | null) ?? auth.profile.full_name ?? '',
    customer_email: auth.email,
    customer_phone: phone,
    current_datetime: israelDateTime(),
    products: [
      {
        product_name: item.title ?? slug,
        price_before_discount: price.original,
        price_after_discount: price.final,
      },
    ],
    public_order_id: order.public_order_id,
    user_id: auth.userId,
    content_type: contentType,
    content_id: item.id,
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

  return NextResponse.json({
    status: 'pending',
    redirect: `/learn/checkout/pending?order=${encodeURIComponent(order.public_order_id)}`,
  });
}
