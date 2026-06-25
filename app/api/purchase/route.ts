import { NextResponse } from 'next/server';
import { getCurrentUser, type AuthState } from '@/lib/auth';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { resolveFinalPrice, type ResolvedPrice } from '@/lib/payments/pricing';
import {
  createPendingOrder,
  getOpenPendingOrder,
  setOrderProviderRef,
  markOrderPaid,
  markRequestWebhook,
  type ContentType,
} from '@/lib/payments/order-service';
import { grantPurchaseAccess } from '@/lib/payments/entitlement-service';
import { enrollInCourse } from '@/lib/learn/enrollment';
import { resolveAccessLevel } from '@/lib/learn/access';
import { isSumitConfigured, sumitBeginRedirect } from '@/lib/payments/sumit';
import { buildCustomer, buildRedirectItems } from '@/lib/payments/sumit-mapping';
import {
  sendPurchaseRequestWebhook,
  israelDateTime,
  type PurchaseWebhookPayload,
} from '@/lib/payments/make-webhook';
import { ensureSquareCoverUrl } from '@/lib/images/square-cover';

export const runtime = 'nodejs';

const PURCHASABLE: ContentType[] = ['course', 'guide', 'bundle'];

type PurchaseItem = {
  id: string;
  slug: string;
  title: string | null;
  cover_url: string | null;
  cover_square_url: string | null;
  price_amount: number | null;
  sale_amount: number | null;
  price_currency: string | null;
};

/**
 * Active paid-checkout flow. Default 'make' (the lead-webhook model). The full
 * SUMIT Redirect flow stays in the codebase — set PAYMENT_FLOW=sumit to use it.
 */
function paidFlow(): 'make' | 'sumit' {
  return process.env.PAYMENT_FLOW === 'sumit' ? 'sumit' : 'make';
}

/**
 * POST { contentType, slug, phone? } — the single V1 purchase entry point.
 *
 * Server-trusted price (the client's numbers are never read):
 *   final == 0 → FREE: grant access immediately, record it, → success page.
 *   final  > 0 → PAID: depends on PAYMENT_FLOW —
 *                'make' (default): pending order + Make.com lead webhook → pending page.
 *                'sumit':          SUMIT hosted Redirect checkout.
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

  // Read the course via the service client: a purchase_required row is hidden by
  // RLS (migration 022) from a user who doesn't own it yet — exactly the buyer.
  // This is server-trusted pricing metadata; the price is still recomputed here,
  // never taken from the client.
  const service = createServiceClient();
  const { data: item } = await service
    .from('content_items')
    .select('id, slug, title, cover_url, cover_square_url, access_level, is_premium, price_amount, sale_amount, price_currency, status')
    .eq('slug', slug)
    .eq('type', contentType)
    .maybeSingle();
  if (!item || item.status !== 'published') {
    console.error('[purchase] course not found / unpublished', { slug, contentType, found: !!item, status: item?.status });
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const level = resolveAccessLevel(item);
  const price = resolveFinalPrice(item);

  // ----------------------------------------------------------------
  // FREE path — final price 0 (genuinely free OR fully discounted).
  // Grant immediately and record it. No payment webhook / link.
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
      // Expands a 'bundle' into a course entitlement per contained course (036).
      await grantPurchaseAccess({
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
  // PAID path — route to the active flow.
  // ----------------------------------------------------------------
  return paidFlow() === 'sumit'
    ? paidViaSumit(request, auth, item as PurchaseItem, contentType, price)
    : paidViaMake(auth, item as PurchaseItem, contentType, price, phoneInput);
}

/**
 * PAID — Make.com lead model. Create ONE pending order, fire the lead webhook
 * with all the data, and send the buyer to the branded pending page. No access is
 * granted here and no payment link is opened — that happens out-of-band.
 */
async function paidViaMake(
  auth: AuthState,
  item: PurchaseItem,
  contentType: ContentType,
  price: ResolvedPrice,
  phoneInput: string,
) {
  const supabase = await createClient();

  // Phone is required for the lead. The profile read and the open-order lookup are
  // independent, so fire them together instead of one after the other.
  const [profileResult, existing] = await Promise.all([
    supabase.from('profiles').select('phone, full_name').eq('id', auth.userId).maybeSingle(),
    getOpenPendingOrder(auth.userId, contentType, item.id),
  ]);
  const profileRow = profileResult.data;

  // Prefer the stored profile phone; accept + persist a freshly-collected one.
  let phone = (profileRow?.phone as string | null) ?? '';
  if (!phone && phoneInput) {
    phone = phoneInput;
    const service = createServiceClient();
    await service.from('profiles').update({ phone }).eq('id', auth.userId);
  }
  if (!phone) {
    return NextResponse.json({ error: 'phone_required' }, { status: 400 });
  }

  // Already have a GROW payment link for this open order → reuse it on a
  // double-click / refresh instead of creating a second link.
  if (existing?.checkout_url) {
    return NextResponse.json({ status: 'redirect', url: existing.checkout_url });
  }

  // The order INSERT and the 1:1 cover resolution are independent — run them
  // together. The cover is cached on the item (lazily generated + stored only on
  // first use) and falls back to the original cover, never to empty.
  const [order, squareImage] = await Promise.all([
    existing ??
      createPendingOrder({
        userId: auth.userId,
        contentType,
        contentId: item.id,
        amount: price.final,
        originalAmount: price.original,
        currency: price.currency,
      }),
    ensureSquareCoverUrl({
      id: item.id,
      coverUrl: item.cover_url,
      coverSquareUrl: item.cover_square_url,
    }),
  ]);

  const payload: PurchaseWebhookPayload = {
    customer_name: (profileRow?.full_name as string | null) ?? auth.profile.full_name ?? '',
    customer_email: auth.email,
    customer_phone: phone,
    current_datetime: israelDateTime(),
    products: [
      {
        product_name: item.title ?? item.slug,
        price_before_discount: price.original,
        price_after_discount: price.final,
        image_url: squareImage ?? '',
      },
    ],
    public_order_id: order.public_order_id,
    user_id: auth.userId,
    content_type: contentType,
    content_id: item.id,
    content_slug: item.slug,
    amount: price.final,
    original_amount: price.original,
    currency: price.currency,
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

  // Make returns the GROW payment link + process id. Persist them (process id is
  // how the GROW webhook later matches this order) and send the buyer to pay.
  if (sent.processId || sent.paymentUrl) {
    await setOrderProviderRef(order.id, {
      checkoutUrl: sent.paymentUrl ?? undefined,
      transactionId: sent.processId ?? undefined,
    });
  }
  if (sent.paymentUrl) {
    return NextResponse.json({ status: 'redirect', url: sent.paymentUrl });
  }

  // No payment link came back → fall back to the branded pending page.
  return NextResponse.json({
    status: 'pending',
    redirect: `/learn/checkout/pending?order=${encodeURIComponent(order.public_order_id)}`,
  });
}

/**
 * PAID — SUMIT hosted Redirect checkout (ON HOLD; enable with PAYMENT_FLOW=sumit).
 * No access granted here — that happens only in /api/payments/sumit/confirm (or
 * the trigger webhook) after SUMIT verifies the payment.
 */
async function paidViaSumit(
  request: Request,
  auth: AuthState,
  item: PurchaseItem,
  contentType: ContentType,
  price: ResolvedPrice,
) {
  const supabase = await createClient();
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
      items: buildRedirectItems(item),
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
