// ============================================================
// lib/payments/sumit.ts
// SUMIT payment provider adapter for Digitech Hub (V1 provider).
//
// LIVE vs MOCK:
//   * Live mode is OFF unless ALL of these are set:
//       SUMIT_API_KEY, SUMIT_COMPANY_ID, SUMIT_WEBHOOK_SECRET, SUMIT_LIVE=true
//   * Until then we run a MOCK hosted checkout so the full order ->
//     webhook -> entitlement flow is testable end-to-end without real money.
//   * Access is NEVER granted from the redirect — only the verified webhook
//     (verifyWebhookSignature + parseWebhookEvent) drives entitlement creation.
//
// SUMIT integration notes (fill in from real API docs before enabling live):
//   * Hosted redirect / "דף תשלום": POST to SUMIT billing endpoint with company
//     credentials + amount + a return URL; SUMIT returns a hosted payment URL.
//   * Webhook: SUMIT posts payment notifications; verify with the shared secret
//     (HMAC or token) then map to {providerEventId, type, transactionId, amount}.
// ============================================================

import crypto from 'crypto';

export type SumitWebhookEvent = {
  providerEventId: string;
  eventType: string;          // e.g. payment.succeeded | payment.failed
  status: 'paid' | 'failed' | 'unknown';
  publicOrderId: string | null;
  providerTransactionId: string | null;
  amount: number | null;
  currency: string | null;
  raw: unknown;
};

/** True only when every SUMIT credential is present and SUMIT_LIVE=true. */
export function isSumitLive(): boolean {
  return (
    process.env.SUMIT_LIVE === 'true' &&
    !!process.env.SUMIT_API_KEY &&
    !!process.env.SUMIT_COMPANY_ID &&
    !!process.env.SUMIT_WEBHOOK_SECRET
  );
}

/** Human/url-safe order id, e.g. DGH-7F3K9Q2A. */
export function generatePublicOrderId(): string {
  const raw = crypto.randomBytes(6).toString('hex').toUpperCase(); // 12 hex chars
  return `DGH-${raw}`;
}

// NOTE: outbound hosted-checkout (createHostedCheckout) was removed in the V1
// purchase system — the active paid path is the Make.com lead webhook
// (see app/api/purchase + lib/payments/make-webhook). The inbound verified-
// payment helpers below are kept for the FUTURE real-payment grant path.

/**
 * Verify an inbound webhook. Live: HMAC-SHA256 of the raw body with the shared
 * secret, compared to the provider signature header. Mock: a static token so
 * the local mock-checkout page can exercise the real handler.
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!isSumitLive()) {
    return signature === (process.env.SUMIT_MOCK_TOKEN ?? 'mock-sumit-token');
  }
  if (!signature) return false;
  const expected = crypto
    .createHmac('sha256', process.env.SUMIT_WEBHOOK_SECRET!)
    .update(rawBody)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

/** Normalise a raw webhook payload into our internal event shape. */
export function parseWebhookEvent(payload: Record<string, unknown>): SumitWebhookEvent {
  // MOCK payload shape (from /payment/mock-checkout):
  //   { id, type, publicOrderId, transactionId, status, amount, currency }
  // LIVE: remap from real SUMIT notification fields here.
  const status =
    payload.status === 'paid' || payload.type === 'payment.succeeded'
      ? 'paid'
      : payload.status === 'failed' || payload.type === 'payment.failed'
        ? 'failed'
        : 'unknown';

  return {
    providerEventId: String(payload.id ?? payload.providerEventId ?? crypto.randomUUID()),
    eventType: String(payload.type ?? payload.eventType ?? 'unknown'),
    status,
    publicOrderId: (payload.publicOrderId as string) ?? (payload.ExternalIdentifier as string) ?? null,
    providerTransactionId:
      (payload.transactionId as string) ?? (payload.PaymentID as string) ?? null,
    amount: payload.amount != null ? Number(payload.amount) : null,
    currency: (payload.currency as string) ?? null,
    raw: payload,
  };
}
