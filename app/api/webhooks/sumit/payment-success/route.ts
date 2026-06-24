// ============================================================
// app/api/webhooks/sumit/payment-success/route.ts
// SUMIT payment-success trigger webhook — the BACKUP path that settles an order
// when the buyer paid but never returned to the app (so the redirect confirm
// route at /api/payments/sumit/confirm never ran).
//
// Configure a SUMIT trigger ("נתונים לטריגר" → HTTP Webhook) to POST here on a
// successful credit-card payment, mapping at minimum:
//   * our external identifier (the order's public_order_id, e.g. DGH-XXXX)
//   * the SUMIT payment id
// (customer email / amount / currency are logged but NOT trusted for granting).
//
// SECURITY (non-negotiable, mirrors the confirm route):
//   * Access is NEVER granted from the payload. settleSumitOrder re-fetches the
//     payment from SUMIT and grants only when ValidPayment + amount/currency match.
//   * Optional shared secret (SUMIT_WEBHOOK_SECRET): when set, the request must
//     present it (header x-webhook-secret, ?secret=, or body.secret) or we 401.
//   * Idempotent: a paid order is a no-op; a duplicate delivery never double-grants.
// ============================================================

import { NextResponse } from 'next/server';
import {
  getOrderByPublicId,
  getOrderByProviderTransactionId,
} from '@/lib/payments/order-service';
import { settleSumitOrder } from '@/lib/payments/sumit-settle';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/** First present value among the given keys, searched case-insensitively + nested. */
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

/** Parse the body as JSON or form-encoded, then merge query params on top. */
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
  const query = Object.fromEntries(url.searchParams);
  return { ...body, ...query };
}

function secretOk(request: Request, payload: Record<string, unknown>): boolean {
  const expected = process.env.SUMIT_WEBHOOK_SECRET;
  if (!expected) {
    // No secret configured: still safe (we re-verify via SUMIT), but warn so it
    // can be locked down in production.
    console.warn('[sumit:webhook] SUMIT_WEBHOOK_SECRET not set — accepting unauthenticated webhook (still re-verified via SUMIT API).');
    return true;
  }
  const provided =
    request.headers.get('x-webhook-secret') ??
    request.headers.get('x-sumit-secret') ??
    pick(payload, ['secret', 'webhook_secret', 'token']);
  return provided === expected;
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const payload = await parsePayload(request, url);

  // Always log the raw payload (redacting nothing sensitive here — SUMIT triggers
  // carry order/email/amount metadata, not card data).
  console.info('[sumit:webhook] received', JSON.stringify(payload).slice(0, 2000));

  if (!secretOk(request, payload)) {
    console.error('[sumit:webhook] rejected: bad/missing secret');
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const publicOrderId = pick(payload, [
    'ExternalIdentifier', 'external_identifier', 'externalidentifier',
    'OG-ExternalIdentifier', 'public_order_id', 'order', 'orderid', 'order_id',
  ]);
  const paymentId = pick(payload, [
    'OG-PaymentID', 'PaymentID', 'payment_id', 'paymentid', 'PaymentId',
    'transaction_id', 'TransactionID', 'transactionid',
  ]);
  // The trigger delivers the document/receipt id as EntityID; tolerate other names.
  const documentId = pick(payload, [
    'EntityID', 'entityid', 'DocumentID', 'document_id', 'documentid', 'DocumentNumber',
  ]);

  // Resolve the order: prefer our external identifier; fall back to the SUMIT
  // payment id we stored at checkout.
  const order =
    (publicOrderId ? await getOrderByPublicId(publicOrderId) : null) ??
    (paymentId ? await getOrderByProviderTransactionId(paymentId) : null);

  if (!order) {
    // Log the unmatched delivery for debugging; ack 200 so SUMIT stops retrying.
    const supabase = createServiceClient();
    await supabase.from('payment_events').insert({
      order_id: null,
      provider: 'sumit',
      provider_event_id: `webhook-unmatched-${paymentId ?? publicOrderId ?? Math.abs(hashStr(JSON.stringify(payload)))}`,
      event_type: 'webhook',
      raw_payload: payload as Record<string, unknown>,
      processing_status: 'ignored',
      processing_error: 'no matching order',
      processed_at: new Date().toISOString(),
    });
    console.error('[sumit:webhook] no matching order', { publicOrderId, paymentId });
    return NextResponse.json({ received: true, matched: false });
  }

  const result = await settleSumitOrder({
    order,
    paymentIdHint: paymentId,
    documentIdHint: documentId,
    source: 'webhook',
    rawPayload: payload,
    // Deterministic id → duplicate deliveries for the same payment collapse.
    eventId: `webhook-${paymentId ?? order.provider_transaction_id ?? order.public_order_id}`,
  });

  // verify_error → 500 so SUMIT retries later (transient). Everything else is
  // terminal from our side → 200 (we logged it; access state is correct/idempotent).
  if (result.outcome === 'verify_error') {
    return NextResponse.json({ received: true, outcome: result.outcome }, { status: 500 });
  }
  return NextResponse.json({ received: true, outcome: result.outcome });
}

/** Tiny deterministic string hash for a stable unmatched-event id (no Date/random). */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}
