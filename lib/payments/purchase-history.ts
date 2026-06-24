// ============================================================
// lib/payments/purchase-history.ts
// Read models for the "my purchases" UIs (account page, admin purchases console,
// and the admin user popup). Service-role only — callers MUST scope by the right
// user (account/popup) or be admin-gated (full list).
//
// Returns EVERY order (pending / paid / failed / …) so a buyer sees their failed
// attempts too, with the product title resolved and an invoice flag.
// ============================================================

import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import type { OrderStatus, ContentType } from './order-service';

export type PurchaseRow = {
  /** Human/url-safe id shown to the user (e.g. DGH-XXXX). */
  public_order_id: string;
  created_at: string;
  content_type: ContentType;
  content_id: string;
  product_title: string;
  status: OrderStatus;
  amount: number;
  currency: string;
  /** True when a downloadable receipt/invoice exists for this order. */
  has_invoice: boolean;
};

export type AdminPurchaseRow = PurchaseRow & {
  user_id: string;
  user_email: string | null;
  user_name: string | null;
};

const SELECT = 'public_order_id, created_at, content_type, content_id, status, amount, currency, document_id, document_url, user_id';

type RawOrder = {
  public_order_id: string;
  created_at: string;
  content_type: ContentType;
  content_id: string;
  status: OrderStatus;
  amount: number;
  currency: string;
  document_id: string | null;
  document_url: string | null;
  user_id: string;
};

async function titlesFor(contentIds: string[]): Promise<Map<string, string>> {
  if (contentIds.length === 0) return new Map();
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('content_items')
    .select('id, title')
    .in('id', Array.from(new Set(contentIds)));
  return new Map((data ?? []).map((c) => [c.id as string, (c.title as string) ?? '(תוכן נמחק)']));
}

function toRow(o: RawOrder, titles: Map<string, string>): PurchaseRow {
  return {
    public_order_id: o.public_order_id,
    created_at: o.created_at,
    content_type: o.content_type,
    content_id: o.content_id,
    product_title: titles.get(o.content_id) ?? '(תוכן נמחק)',
    status: o.status,
    amount: Number(o.amount),
    currency: o.currency,
    has_invoice: Boolean(o.document_url || o.document_id),
  };
}

/** All purchase attempts for one user, newest first. Scope by the auth'd user. */
export async function getUserPurchases(userId: string): Promise<PurchaseRow[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('orders')
    .select(SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  const orders = (data ?? []) as RawOrder[];
  const titles = await titlesFor(orders.map((o) => o.content_id));
  return orders.map((o) => toRow(o, titles));
}

/** Every purchase attempt across all users (admin console), newest first. */
export async function getAllPurchases(limit = 1000): Promise<AdminPurchaseRow[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('orders')
    .select(SELECT)
    .order('created_at', { ascending: false })
    .limit(limit);
  const orders = (data ?? []) as RawOrder[];
  const titles = await titlesFor(orders.map((o) => o.content_id));

  const [{ data: authData }, { data: profiles }] = await Promise.all([
    supabase.auth.admin.listUsers({ perPage: 1000 }),
    supabase.from('profiles').select('id, full_name'),
  ]);
  const emailById = new Map<string, string>((authData?.users ?? []).map((u) => [u.id, u.email ?? '']));
  const nameById = new Map<string, string | null>((profiles ?? []).map((p) => [p.id as string, (p.full_name as string | null) ?? null]));

  return orders.map((o) => ({
    ...toRow(o, titles),
    user_id: o.user_id,
    user_email: emailById.get(o.user_id) ?? null,
    user_name: nameById.get(o.user_id) ?? null,
  }));
}
