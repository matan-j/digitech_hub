// ============================================================
// app/api/webhooks/grow/payment-success/route.ts
// Inbound webhook for the GROW (Meshulam/גרואו) payment page you build in Make.
// After a buyer pays on the GROW page, Make POSTs the payment data here and we
// settle the matching local order + grant access.
//
// SECURITY:
//   * Optional shared secret (GROW_WEBHOOK_SECRET): when set, the request must
//     present it (header x-webhook-secret / x-grow-secret, ?secret=, or body
//     `secret`) or we 401.
//   * Access is granted only when the paid AMOUNT + CURRENCY match the local
//     order and the status is successful — never from an arbitrary payload.
//   * Idempotent: a paid order is a no-op; duplicate deliveries never double-grant.
//
// The buyer's local order id MUST be echoed back in the payload (we sent it to
// Make as `public_order_id`). Map it on the GROW/Make side to any of the keys
// below (e.g. a GROW custom field "cField1"). Field parsing is case-insensitive
// and searches nested objects.
// ============================================================

import { NextResponse } from 'next/server';
import {
  getOrderByPublicId,
  getOrderByProviderTransactionId,
  getOrderItems,
  markOrderPaid,
  setOrderInvoice,
  validatePaymentAgainstOrder,
} from '@/lib/payments/order-service';
import { grantEntitlement } from '@/lib/payments/entitlement-service';
import { clearCartItems } from '@/lib/cart/cart-service';
import { recordRedemption, clearCartCoupon } from '@/lib/payments/coupon-service';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/** First present value among keys, searched case-insensitively + nested. */
function pick(obj: Record<string, unknown>, keys: string[]): string | null {
  const lower = new Map<string, unknown>();
  const walk = (o: unknown, depth: number) => {
    if (!o || typeof o !== 'object' || depth > 4) return;
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (v != null && typeof v !== 'object') {
        const lk = k.toLowerCase();
        if (!lower.has(lk)) lower.set(lk, v);
      }
      if (v && typeof v === 'object') walk(v, depth + 1);
    }
  };
  walk(obj, 0);
  for (const key of keys) {
    const v = lower.get(key.toLowerCase());
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return null;
}

async function parsePayload(request: Request, url: URL): Promise<Record<string, unknown>> {
  const raw = await request.text().catch(() => '');
  let body: Record<string, unknown> = {};
  if (raw) {
    try {
      body = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      try {
        body = Object.fromEntries(new URLSearchParams(raw));
      } catch {
        body = { _raw: raw };
      }
    }
  }
  return { ...body, ...Object.fromEntries(url.searchParams) };
}

function secretOk(request: Request, payload: Record<string, unknown>): boolean {
  const expected = process.env.GROW_WEBHOOK_SECRET;
  if (!expected) {
    console.warn('[grow:webhook] GROW_WEBHOOK_SECRET not set — accepting webhook on amount/currency match only. Set it in production.');
    return true;
  }
  const provided =
    request.headers.get('x-webhook-secret') ??
    request.headers.get('x-grow-secret') ??
    pick(payload, ['secret', 'webhook_secret', 'token']);
  return provided === expected;
}

/** Heuristic success check across GROW/Make field shapes. */
function isSuccess(payload: Record<string, unknown>, transactionId: string | null): boolean {
  const status = pick(payload, ['payment_status', 'status', 'transaction_status', 'StatusCode', 'statusCode']);
  if (status) {
    const s = status.toLowerCase();
    if (['1', '2', 'success', 'succeeded', 'paid', 'approved', 'completed', 'ok', 'true', 'שולם', 'הצליח'].includes(s)) return true;
    if (['0', 'failed', 'declined', 'error', 'cancelled', 'canceled', 'false', 'נכשל', 'בוטל'].includes(s)) return false;
  }
  // No explicit/parseable status → treat a present transaction reference as success.
  return !!transactionId;
}

function num(v: string | null): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function logEvent(params: {
  orderId: string | null;
  eventId: string;
  status: 'processed' | 'error' | 'ignored';
  raw: unknown;
  error?: string | null;
}) {
  const supabase = createServiceClient();
  await supabase.from('payment_events').upsert(
    {
      order_id: params.orderId,
      provider: 'grow',
      provider_event_id: params.eventId,
      event_type: 'webhook',
      raw_payload: (params.raw ?? {}) as Record<string, unknown>,
      processing_status: params.status,
      processing_error: params.error ?? null,
      processed_at: new Date().toISOString(),
    },
    { onConflict: 'provider,provider_event_id', ignoreDuplicates: true },
  );
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const payload = await parsePayload(request, url);
  console.info('[grow:webhook] received', JSON.stringify(payload).slice(0, 2000));

  if (!secretOk(request, payload)) {
    console.error('[grow:webhook] rejected: bad/missing secret');
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Our local order id (digi-XXXXXX). In the Make/GROW payload it arrives as
  // `order_number` (mapped from the GROW custom field cField1).
  const publicOrderId = pick(payload, [
    'order_number', 'public_order_id', 'order', 'order_id', 'orderid',
    'ExternalIdentifier', 'external_identifier', 'cField1', 'customField1', 'reference',
  ]);
  // GROW payment link process id (we stored it on the order at checkout).
  const processId = pick(payload, ['process_id', 'processId', 'paymentLinkProcessId']);
  // GROW transaction id ({{3.data.transactionId}}). Persisted on the order as
  // provider_transaction_id (via markOrderPaid below) for reconciliation. The
  // invoice webhook (/api/webhooks/grow/invoice) matches by public_order_id, not
  // by this value.
  const transactionId = pick(payload, [
    'transaction_id', 'transactionId', 'TransactionID', 'payment_reference',
    'reference_number', 'asmachta', 'paymentId', 'payment_id', 'transactionToken',
  ]) ?? processId;
  const amount = num(pick(payload, ['payment_amount', 'amount', 'sum', 'Amount', 'Sum', 'total', 'paymentSum']));
  const currency = pick(payload, ['currency', 'Currency', 'coin']) ?? 'ILS';
  const documentUrl = pick(payload, ['document_url', 'invoice_url', 'documentUrl', 'invoiceUrl', 'pdf', 'pdfUrl']);
  // Buyer email — for cross-check / debugging. The order already binds the
  // customer (user_id) + products (content_id), so order_number is the real link;
  // email is logged so an unmatched payment can still be reconciled by hand.
  const payerEmail = pick(payload, ['payer_email', 'email', 'customer_email', 'payerEmail', 'EmailAddress']);

  // Match by our order id first, then by the GROW process id / transaction id we
  // stored on the order at checkout.
  const order =
    (publicOrderId ? await getOrderByPublicId(publicOrderId) : null) ??
    (processId ? await getOrderByProviderTransactionId(processId) : null) ??
    (transactionId ? await getOrderByProviderTransactionId(transactionId) : null);

  const eventId = `grow-${transactionId ?? publicOrderId ?? Math.abs(hashStr(JSON.stringify(payload)))}`;

  if (!order) {
    await logEvent({ orderId: null, eventId: `${eventId}-unmatched`, status: 'ignored', raw: payload, error: 'no matching order' });
    console.error('[grow:webhook] no matching order', { publicOrderId, processId, transactionId, payerEmail });
    return NextResponse.json({ received: true, matched: false, order_number: publicOrderId ?? null });
  }

  // Idempotent: already settled → nothing to do.
  if (order.status === 'paid') {
    await logEvent({ orderId: order.id, eventId, status: 'ignored', raw: payload, error: 'already paid' });
    return NextResponse.json({ received: true, outcome: 'already_paid' });
  }

  // Must be a successful payment.
  if (!isSuccess(payload, transactionId)) {
    await logEvent({ orderId: order.id, eventId, status: 'processed', raw: payload, error: 'payment not successful' });
    return NextResponse.json({ received: true, outcome: 'not_successful' });
  }

  // Amount + currency must match the local order (never trust an arbitrary sum),
  // and the currency must be ILS.
  let mismatch = validatePaymentAgainstOrder(order, {
    amount,
    currency,
    providerTransactionId: transactionId ?? `grow-${order.public_order_id}`,
  });
  if (!mismatch && currency.toUpperCase() !== 'ILS') mismatch = `currency not ILS: ${currency}`;
  if (mismatch) {
    await logEvent({ orderId: order.id, eventId, status: 'error', raw: payload, error: mismatch });
    console.error('[grow:webhook] mismatch', order.public_order_id, mismatch);
    return NextResponse.json({ received: true, outcome: 'mismatch', error: mismatch });
  }

  // Verified enough → settle + grant (both idempotent).
  await markOrderPaid(order.id, transactionId);

  // Multi-item (cart "bundle") order → grant one entitlement per line and clear
  // exactly those items from the buyer's cart. A single-item order has no
  // order_items rows → fall back to the order's own content_id (back-compatible).
  const items = await getOrderItems(order.id);
  if (items.length > 0) {
    for (const it of items) {
      await grantEntitlement({
        userId: order.user_id,
        resourceType: it.content_type,
        resourceId: it.content_id,
        orderId: order.id,
        source: 'purchase',
      });
    }
    await clearCartItems(order.user_id, items.map((it) => it.content_id));
  } else {
    await grantEntitlement({
      userId: order.user_id,
      resourceType: order.content_type,
      resourceId: order.content_id,
      orderId: order.id,
      source: 'purchase',
    });
  }
  // Coupon (if any was applied at checkout) → record the redemption now that the
  // order is verified paid. recordRedemption is idempotent and burns a 'global'
  // one-time coupon (is_redeemed + deactivate). The code lives on the order row,
  // not the webhook payload.
  if (order.coupon_id) {
    await recordRedemption({
      couponId: order.coupon_id,
      userId: order.user_id,
      orderId: order.id,
      discount: order.coupon_discount != null ? Number(order.coupon_discount) : 0,
    });
    await clearCartCoupon(order.user_id);
  }

  if (documentUrl) await setOrderInvoice(order.id, { documentUrl });
  await logEvent({ orderId: order.id, eventId, status: 'processed', raw: payload });

  return NextResponse.json({ received: true, outcome: 'granted' });
}

/** Stable deterministic hash for an unmatched-event id (no Date/random). */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}
