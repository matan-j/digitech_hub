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
  content_slug: string;
  // Order totals (server-trusted), so Make has the full picture in one payload.
  amount: number;
  original_amount: number;
  currency: string;
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

export type WebhookResult =
  | { ok: true; paymentUrl: string | null; processId: string | null }
  | { ok: false; error: string };

/** Pull payment_url + process_id out of Make's response (tolerant of shapes). */
function parseMakeResponse(raw: string): { paymentUrl: string | null; processId: string | null } {
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { paymentUrl: null, processId: null };
  }
  const get = (keys: string[]): string | null => {
    for (const k of keys) {
      const v = body[k] ?? (body.data as Record<string, unknown> | undefined)?.[k];
      if (v != null && String(v).trim() !== '') return String(v).trim();
    }
    return null;
  };
  return {
    paymentUrl: get(['payment_url', 'paymentUrl', 'url']),
    processId: get(['process_id', 'processId', 'paymentLinkProcessId']),
  };
}

/**
 * Fire the purchase-request webhook to Make and read its synchronous response,
 * which carries the GROW payment link: { payment_url, process_id }. Returns a
 * result instead of throwing so the caller can store the process id, redirect the
 * buyer to payment_url, and mark the order's request_webhook_status.
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
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text().catch(() => '');
    if (!res.ok) {
      console.error('[make-webhook] non-2xx', res.status, text.slice(0, 300));
      return { ok: false, error: `webhook_status_${res.status}` };
    }
    const { paymentUrl, processId } = parseMakeResponse(text);
    console.info('[make-webhook] sent', payload.public_order_id, { hasPaymentUrl: !!paymentUrl, processId });
    return { ok: true, paymentUrl, processId };
  } catch (e) {
    const error = e instanceof Error ? e.message : 'unknown';
    console.error('[make-webhook] failed', payload.public_order_id, error);
    return { ok: false, error };
  }
}
