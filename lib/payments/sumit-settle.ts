// ============================================================
// lib/payments/sumit-settle.ts
// The single, shared "verify a SUMIT payment and grant access" routine.
//
// Used by BOTH entry points so they cannot diverge:
//   * /api/payments/sumit/confirm           — the redirect return (primary)
//   * /api/webhooks/sumit/payment-success   — the trigger webhook (backup)
//
// NON-NEGOTIABLE (mirrors migration 020 design rules):
//   * Access is NEVER granted from a payload alone. We always re-fetch the
//     payment from SUMIT (sumitGetPayment) and grant only when ValidPayment.
//   * Idempotent: a paid order is a no-op; markOrderPaid is guarded with
//     `neq('paid')` and grantEntitlement upserts on (user,resource), so a
//     second confirm/webhook for the same order never duplicates access.
// ============================================================

import 'server-only';
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { sumitGetPayment, sumitGetDocumentDownloadUrl } from './sumit';
import { markOrderPaid, markOrderFailed, setOrderInvoice, validatePaymentAgainstOrder, type Order } from './order-service';
import { grantEntitlement } from './entitlement-service';

export type SettleSource = 'confirm' | 'webhook';

export type SettleOutcome =
  | 'granted' // verified + access granted now
  | 'already_paid' // order was already settled — nothing to do
  | 'no_payment_id' // no SUMIT payment id available to verify against
  | 'verify_error' // calling SUMIT to verify threw
  | 'not_valid' // SUMIT says the payment is not valid
  | 'mismatch'; // verified payment doesn't match the order (amount/currency)

export type SettleResult = {
  outcome: SettleOutcome;
  transactionId: string | null;
  error?: string;
};

/** Append a row to payment_events. Deterministic ids let webhook replays dedupe. */
async function logEvent(params: {
  orderId: string;
  source: SettleSource;
  eventId: string;
  status: 'processed' | 'error' | 'ignored';
  raw: unknown;
  error?: string | null;
}): Promise<void> {
  const supabase = createServiceClient();
  await supabase.from('payment_events').upsert(
    {
      order_id: params.orderId,
      provider: 'sumit',
      provider_event_id: params.eventId,
      event_type: params.source,
      raw_payload: (params.raw ?? {}) as Record<string, unknown>,
      processing_status: params.status,
      processing_error: params.error ?? null,
      processed_at: new Date().toISOString(),
    },
    { onConflict: 'provider,provider_event_id', ignoreDuplicates: true },
  );
}

/**
 * Verify a SUMIT payment for `order` and, if valid and matching, mark the order
 * paid + grant the entitlement. Returns the outcome; callers map it to a redirect
 * (confirm) or HTTP status (webhook). Never throws for expected failure paths.
 *
 * @param paymentIdHint payment id parsed from the redirect/webhook; falls back to
 *        the id we stored at checkout (order.provider_transaction_id).
 * @param eventId deterministic id for the payment_events row. For webhooks pass a
 *        value derived from the payment id so duplicate deliveries collapse.
 */
export async function settleSumitOrder(params: {
  order: Order;
  paymentIdHint?: string | null;
  /** SUMIT document/receipt id (redirect OG-DocumentID or trigger EntityID), if known. */
  documentIdHint?: string | null;
  source: SettleSource;
  rawPayload?: unknown;
  eventId?: string;
}): Promise<SettleResult> {
  const { order, source } = params;
  const eventId = params.eventId ?? `${source}-${crypto.randomUUID()}`;

  // Idempotent re-entry: already settled → do nothing (the other path won the race).
  if (order.status === 'paid') {
    await logEvent({ orderId: order.id, source, eventId, status: 'ignored', raw: params.rawPayload, error: 'already paid' });
    return { outcome: 'already_paid', transactionId: order.provider_transaction_id };
  }

  const paymentId = params.paymentIdHint ?? order.provider_transaction_id;
  if (!paymentId) {
    await logEvent({ orderId: order.id, source, eventId, status: 'ignored', raw: params.rawPayload, error: 'missing payment id' });
    return { outcome: 'no_payment_id', transactionId: null };
  }

  // ALWAYS re-verify with SUMIT — never trust the inbound payload to grant access.
  let payment;
  try {
    payment = await sumitGetPayment(String(paymentId));
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error(`[sumit:settle:${source}] verify failed`, order.public_order_id, error);
    await logEvent({ orderId: order.id, source, eventId, status: 'error', raw: { error }, error });
    return { outcome: 'verify_error', transactionId: null, error };
  }

  // Diagnostic: exactly what SUMIT returned for this payment, next to our order.
  console.info(`[sumit:settle:${source}] verified`, {
    order: order.public_order_id,
    valid: payment.valid,
    sumitAmount: payment.amount,
    sumitCurrency: payment.currency,
    orderAmount: order.amount,
    orderCurrency: order.currency,
    paymentId,
  });

  if (!payment.valid) {
    await markOrderFailed(order.id);
    await logEvent({ orderId: order.id, source, eventId, status: 'processed', raw: payment.raw, error: 'payment not valid' });
    return { outcome: 'not_valid', transactionId: payment.transactionId };
  }

  // Defence-in-depth: the verified AMOUNT must match the order. Currency is
  // normalised first — this flow only ever charges ILS, and SUMIT may report the
  // currency as an enum / symbol / blank rather than the literal "ILS", which must
  // NOT fail an otherwise-valid ILS payment. We reject only a clearly *different*
  // real currency (USD/EUR/GBP).
  const verifiedCurrency = normalizeCurrency(payment.currency);
  let mismatch = validatePaymentAgainstOrder(order, {
    amount: payment.amount,
    currency: verifiedCurrency,
    providerTransactionId: payment.transactionId,
  });
  if (!mismatch && verifiedCurrency !== 'ILS') {
    mismatch = `currency not ILS: ${payment.currency}`;
  }
  if (mismatch) {
    await markOrderFailed(order.id);
    await logEvent({ orderId: order.id, source, eventId, status: 'error', raw: payment.raw, error: mismatch });
    return { outcome: 'mismatch', transactionId: payment.transactionId, error: mismatch };
  }

  // Verified + matching → settle and grant. Both steps are idempotent.
  await markOrderPaid(order.id, payment.transactionId);
  await grantEntitlement({
    userId: order.user_id,
    resourceType: order.content_type,
    resourceId: order.content_id,
    orderId: order.id,
    source: 'purchase',
  });

  // Capture the receipt/invoice document for later download (best-effort, never
  // fatal). The document id arrives on the redirect (OG-DocumentID) or the trigger
  // (EntityID); the Payment object itself carries no document reference.
  if (params.documentIdHint) {
    const documentUrl = await sumitGetDocumentDownloadUrl(params.documentIdHint);
    await setOrderInvoice(order.id, { documentId: params.documentIdHint, documentUrl });
  }

  await logEvent({ orderId: order.id, source, eventId, status: 'processed', raw: payment.raw });
  return { outcome: 'granted', transactionId: payment.transactionId };
}

/**
 * Map SUMIT's many currency representations to an ISO code. OfficeGuy/SUMIT may
 * return ILS as the enum 0, "0", "ILS", "NIS", "₪", or blank. Known foreign codes
 * map to their ISO; anything unrecognised falls back to ILS because this flow
 * only ever creates ILS orders — so the amount check (not currency) is the real
 * guard, and an unfamiliar ILS representation must never fail a valid payment.
 */
function normalizeCurrency(c: string | number | null | undefined): string {
  if (c == null || c === '') return 'ILS';
  const s = String(c).trim().toUpperCase();
  if (['1', 'USD', '$', 'US$', 'DOLLAR'].includes(s)) return 'USD';
  if (['2', 'EUR', '€', 'EURO'].includes(s)) return 'EUR';
  if (['3', 'GBP', '£'].includes(s)) return 'GBP';
  return 'ILS';
}
