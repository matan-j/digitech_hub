// ============================================================
// lib/payments/order-service.ts
// Internal order lifecycle. Service-role only (bypasses RLS) — call from the
// create-redirect route and the verified webhook handler.
// ============================================================

import { createServiceClient } from '@/lib/supabase/server';
import { generatePublicOrderId } from './sumit';

export type ContentType = 'course' | 'guide' | 'playbook' | 'resource' | 'bundle';
export type OrderStatus = 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded';
export type OrderProvider = 'sumit' | 'manual';
export type RequestWebhookStatus = 'pending' | 'sent' | 'failed';

export type Order = {
  id: string;
  public_order_id: string;
  user_id: string;
  provider: OrderProvider;
  content_type: ContentType;
  content_id: string;
  amount: number;
  original_amount: number | null;
  currency: string;
  status: OrderStatus;
  provider_transaction_id: string | null;
  checkout_url: string | null;
  document_id: string | null;
  document_url: string | null;
  coupon_id: string | null;
  coupon_code: string | null;
  coupon_discount: number | null;
  request_webhook_status: RequestWebhookStatus;
  request_webhook_sent_at: string | null;
  request_webhook_error: string | null;
  created_at: string;
  updated_at: string;
};

export async function createPendingOrder(params: {
  userId: string;
  contentType: ContentType;
  contentId: string;
  amount: number;
  originalAmount?: number | null;
  currency: string;
  provider?: OrderProvider;
  /** Snapshot of the applied coupon (local only — never sent to any webhook). */
  coupon?: { id: string; code: string; discount: number } | null;
}): Promise<Order> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('orders')
    .insert({
      public_order_id: generatePublicOrderId(),
      user_id: params.userId,
      provider: params.provider ?? 'manual',
      content_type: params.contentType,
      content_id: params.contentId,
      amount: params.amount,
      original_amount: params.originalAmount ?? params.amount,
      currency: params.currency,
      status: 'pending',
      coupon_id: params.coupon?.id ?? null,
      coupon_code: params.coupon?.code ?? null,
      coupon_discount: params.coupon?.discount ?? null,
    })
    .select('*')
    .single();
  if (error) throw new Error(`createPendingOrder failed: ${error.message}`);
  return data as Order;
}

// ============================================================
// order_items — line items for multi-item ("bundle") cart orders (migration 032).
// A single-item order keeps using orders.content_id; a bundle order also writes
// one row here per product. The verified webhook grants one entitlement per row.
// ============================================================

export type OrderItem = {
  id: string;
  order_id: string;
  content_type: ContentType;
  content_id: string;
  product_title: string | null;
  cover_url: string | null;
  price_before: number;
  price_after: number;
};

export type OrderItemInput = {
  contentType: ContentType;
  contentId: string;
  productTitle?: string | null;
  coverUrl?: string | null;
  priceBefore: number;
  priceAfter: number;
};

/** Insert the line items for an order (bundle checkout). Service-role only. */
export async function createOrderItems(orderId: string, items: OrderItemInput[]): Promise<void> {
  if (items.length === 0) return;
  const supabase = createServiceClient();
  const rows = items.map((i) => ({
    order_id: orderId,
    content_type: i.contentType,
    content_id: i.contentId,
    product_title: i.productTitle ?? null,
    cover_url: i.coverUrl ?? null,
    price_before: i.priceBefore,
    price_after: i.priceAfter,
  }));
  const { error } = await supabase.from('order_items').insert(rows);
  if (error) throw new Error(`createOrderItems failed: ${error.message}`);
}

/** All line items for an order (empty for legacy single-item orders). */
export async function getOrderItems(orderId: string): Promise<OrderItem[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });
  return (data ?? []) as OrderItem[];
}

/** The current open (pending) order for this user+item, if any. Used to avoid
 *  creating duplicate orders / resending the webhook on double-click or refresh. */
export async function getOpenPendingOrder(
  userId: string,
  contentType: ContentType,
  contentId: string,
): Promise<Order | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .eq('content_type', contentType)
    .eq('content_id', contentId)
    .eq('status', 'pending')
    .maybeSingle();
  return (data as Order) ?? null;
}

/** Record the outbound purchase-request webhook result on the order. */
export async function markRequestWebhook(
  orderId: string,
  status: RequestWebhookStatus,
  error?: string | null,
): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from('orders')
    .update({
      request_webhook_status: status,
      request_webhook_sent_at: status === 'sent' ? new Date().toISOString() : null,
      request_webhook_error: error ?? null,
    })
    .eq('id', orderId);
}

export async function setOrderCheckoutUrl(orderId: string, checkoutUrl: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('orders')
    .update({ checkout_url: checkoutUrl })
    .eq('id', orderId);
  if (error) throw new Error(`setOrderCheckoutUrl failed: ${error.message}`);
}

/** Persist the provider's hosted checkout URL + payment reference on a pending order. */
export async function setOrderProviderRef(
  orderId: string,
  params: { checkoutUrl?: string | null; transactionId?: string | null },
): Promise<void> {
  const supabase = createServiceClient();
  const patch: Record<string, unknown> = {};
  if (params.checkoutUrl !== undefined) patch.checkout_url = params.checkoutUrl;
  if (params.transactionId !== undefined) patch.provider_transaction_id = params.transactionId;
  if (!Object.keys(patch).length) return;
  const { error } = await supabase.from('orders').update(patch).eq('id', orderId);
  if (error) throw new Error(`setOrderProviderRef failed: ${error.message}`);
}

/** Persist the SUMIT receipt/invoice document reference on an order (best-effort). */
export async function setOrderInvoice(
  orderId: string,
  params: { documentId?: string | null; documentUrl?: string | null },
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (params.documentId != null) patch.document_id = params.documentId;
  if (params.documentUrl != null) patch.document_url = params.documentUrl;
  if (!Object.keys(patch).length) return;
  const supabase = createServiceClient();
  const { error } = await supabase.from('orders').update(patch).eq('id', orderId);
  if (error) console.error('[order-service] setOrderInvoice failed', orderId, error.message);
}

export async function getOrderByPublicId(publicOrderId: string): Promise<Order | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('orders')
    .select('*')
    .eq('public_order_id', publicOrderId)
    .maybeSingle();
  return (data as Order) ?? null;
}

/**
 * Find an order by the SUMIT payment/transaction id we stored at checkout.
 * Webhook fallback for the case where the trigger payload omits our external
 * identifier but carries the SUMIT payment id. Newest first, so a re-used
 * checkout never resolves to a stale row.
 */
export async function getOrderByProviderTransactionId(transactionId: string): Promise<Order | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('orders')
    .select('*')
    .eq('provider_transaction_id', transactionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Order) ?? null;
}

/** Marks an order paid. Idempotent — re-marking a paid order is a no-op. */
export async function markOrderPaid(
  orderId: string,
  providerTransactionId: string | null,
): Promise<Order> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('orders')
    .update({ status: 'paid', provider_transaction_id: providerTransactionId })
    .eq('id', orderId)
    .neq('status', 'paid')
    .select('*')
    .maybeSingle();
  if (error) throw new Error(`markOrderPaid failed: ${error.message}`);
  if (data) return data as Order;
  // Already paid — return current row.
  const { data: existing } = await supabase.from('orders').select('*').eq('id', orderId).single();
  return existing as Order;
}

export async function markOrderFailed(orderId: string): Promise<void> {
  const supabase = createServiceClient();
  await supabase.from('orders').update({ status: 'failed' }).eq('id', orderId).eq('status', 'pending');
}

/**
 * Validate that a webhook event matches its order before granting access.
 * Returns the reason it is INVALID, or null if valid.
 */
export function validatePaymentAgainstOrder(
  order: Order,
  event: { amount: number | null; currency: string | null; providerTransactionId: string | null },
): string | null {
  if (!event.providerTransactionId) return 'missing provider transaction id';
  if (event.amount != null && Number(event.amount) !== Number(order.amount)) {
    return `amount mismatch: order=${order.amount} event=${event.amount}`;
  }
  // Currency is normalised before comparing: SUMIT/OfficeGuy returns ILS as the
  // enum 0 (not the literal "ILS"), so a raw !== would wrongly fail a valid ILS
  // payment. The amount check above is the real guard.
  if (event.currency != null && normalizeCurrency(event.currency) !== normalizeCurrency(order.currency)) {
    return `currency mismatch: order=${order.currency} event=${event.currency}`;
  }
  return null;
}

/**
 * Map SUMIT's currency representations to an ISO code. ILS may arrive as the enum
 * 0, "0", "ILS", "NIS", "₪" or blank. Known foreign codes map to their ISO;
 * anything unrecognised falls back to ILS, because this flow only ever creates ILS
 * orders — so an unfamiliar ILS representation must never reject a valid payment.
 */
function normalizeCurrency(c: string | number | null | undefined): string {
  if (c == null || c === '') return 'ILS';
  const s = String(c).trim().toUpperCase();
  if (['1', 'USD', '$', 'US$', 'DOLLAR'].includes(s)) return 'USD';
  if (['2', 'EUR', '€', 'EURO'].includes(s)) return 'EUR';
  if (['3', 'GBP', '£'].includes(s)) return 'GBP';
  return 'ILS';
}
