// ============================================================
// lib/payments/order-service.ts
// Internal order lifecycle. Service-role only (bypasses RLS) — call from the
// create-redirect route and the verified webhook handler.
// ============================================================

import { createServiceClient } from '@/lib/supabase/server';
import { generatePublicOrderId } from './sumit';

export type ContentType = 'course' | 'guide' | 'playbook' | 'resource' | 'bundle';
export type OrderStatus = 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded';

export type Order = {
  id: string;
  public_order_id: string;
  user_id: string;
  provider: 'sumit';
  content_type: ContentType;
  content_id: string;
  amount: number;
  currency: string;
  status: OrderStatus;
  provider_transaction_id: string | null;
  checkout_url: string | null;
  created_at: string;
  updated_at: string;
};

export async function createPendingOrder(params: {
  userId: string;
  contentType: ContentType;
  contentId: string;
  amount: number;
  currency: string;
}): Promise<Order> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('orders')
    .insert({
      public_order_id: generatePublicOrderId(),
      user_id: params.userId,
      provider: 'sumit',
      content_type: params.contentType,
      content_id: params.contentId,
      amount: params.amount,
      currency: params.currency,
      status: 'pending',
    })
    .select('*')
    .single();
  if (error) throw new Error(`createPendingOrder failed: ${error.message}`);
  return data as Order;
}

export async function setOrderCheckoutUrl(orderId: string, checkoutUrl: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('orders')
    .update({ checkout_url: checkoutUrl })
    .eq('id', orderId);
  if (error) throw new Error(`setOrderCheckoutUrl failed: ${error.message}`);
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
  if (event.currency != null && event.currency !== order.currency) {
    return `currency mismatch: order=${order.currency} event=${event.currency}`;
  }
  return null;
}
