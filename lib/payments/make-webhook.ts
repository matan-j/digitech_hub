// ============================================================
// lib/payments/make-webhook.ts
// Outbound "purchase request" lead webhook (Make.com), V1 paid path.
//
// IMPORTANT: this is a NOTIFICATION only. Sending it grants NOTHING — the
// purchase API has already created a PENDING order. Access is granted solely by
// the free path (final price 0) or, in the future, a verified payment callback.
//
// Server-only: never call from the browser (keeps the URL off the client and
// avoids CORS/spoofing). Configure MAKE_PURCHASE_WEBHOOK_URL in env; the literal
// fallback keeps V1 working before env is set.
// ============================================================

import 'server-only';

const FALLBACK_URL = 'https://hook.eu2.make.com/qag86wnr8is4wbrh85bl4nhfgryjyu6o';

export type PurchaseWebhookProduct = {
  product_name: string;
  price_before_discount: number;
  price_after_discount: number;
};

export type PurchaseWebhookPayload = {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  /** Israel local time, DD/MM/YYYY HH:mm. */
  current_datetime: string;
  products: PurchaseWebhookProduct[];
  // Safe internal references so Make.com can reconcile back to our order.
  public_order_id: string;
  user_id: string;
  content_type: string;
  content_id: string;
};

/** Israel-local timestamp formatted as DD/MM/YYYY HH:mm (e.g. 26/06/2026 14:30). */
export function israelDateTime(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  // en-GB hour can be "24" at midnight; normalise to "00".
  const hh = get('hour') === '24' ? '00' : get('hour');
  return `${get('day')}/${get('month')}/${get('year')} ${hh}:${get('minute')}`;
}

export type WebhookResult = { ok: true } | { ok: false; error: string };

/**
 * Fire the purchase-request webhook. Returns a result instead of throwing so the
 * caller can mark the order's request_webhook_status and surface a retry to the
 * user without leaving the order in an undefined state.
 */
export async function sendPurchaseRequestWebhook(
  payload: PurchaseWebhookPayload,
): Promise<WebhookResult> {
  const url = process.env.MAKE_PURCHASE_WEBHOOK_URL || FALLBACK_URL;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      // Don't hang the request forever if Make.com is slow/unreachable.
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('[make-webhook] non-2xx', res.status, detail.slice(0, 300));
      return { ok: false, error: `webhook_status_${res.status}` };
    }
    console.info('[make-webhook] sent', payload.public_order_id);
    return { ok: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : 'unknown';
    console.error('[make-webhook] failed', payload.public_order_id, error);
    return { ok: false, error };
  }
}
