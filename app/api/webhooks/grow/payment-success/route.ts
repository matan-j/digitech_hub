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
  markOrderPaid,
  setOrderInvoice,
  validatePaymentAgainstOrder,
} from '@/lib/payments/order-service';
import { grantEntitlement } from '@/lib/payments/entitlement-service';
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
  const status = pick(payload, ['status', 'payment_status', 'transaction_status', 'StatusCode', 'transactionTypeId']);
  if (status) {
    const s = status.toLowerCase();
    if (['1', 'success', 'succeeded', 'paid', 'approved', 'completed', 'ok', 'true'].includes(s)) return true;
    if (['0', 'failed', 'declined', 'error', 'cancelled', 'canceled', 'false'].includes(s)) return false;
  }
  // No explicit status → treat a present transaction reference as success.
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

  const publicOrderId = pick(payload, [
    'public_order_id', 'order', 'order_id', 'orderid', 'ExternalIdentifier',
    'external_identifier', 'cField1', 'customField1', 'reference',
  ]);
  const transactionId = pick(payload, [
    'transaction_id', 'transactionId', 'TransactionID', 'asmachta', 'paymentId',
    'payment_id', 'transactionToken', 'processId',
  ]);
  const amount = num(pick(payload, ['amount', 'sum', 'Amount', 'Sum', 'total', 'paymentSum']));
  const currency = pick(payload, ['currency', 'Currency', 'coin']) ?? 'ILS';
  const documentUrl = pick(payload, ['document_url', 'invoice_url', 'documentUrl', 'invoiceUrl', 'pdf', 'pdfUrl']);

  const order =
    (publicOrderId ? await getOrderByPublicId(publicOrderId) : null) ??
    (transactionId ? await getOrderByProviderTransactionId(transactionId) : null);

  const eventId = `grow-${transactionId ?? publicOrderId ?? Math.abs(hashStr(JSON.stringify(payload)))}`;

  if (!order) {
    await logEvent({ orderId: null, eventId: `${eventId}-unmatched`, status: 'ignored', raw: payload, error: 'no matching order' });
    console.error('[grow:webhook] no matching order', { publicOrderId, transactionId });
    return NextResponse.json({ received: true, matched: false });
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
  await grantEntitlement({
    userId: order.user_id,
    resourceType: order.content_type,
    resourceId: order.content_id,
    orderId: order.id,
    source: 'purchase',
  });
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
