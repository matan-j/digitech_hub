// ============================================================
// lib/payments/purchase-history.ts
// Read models for the "my purchases" UIs (account page, admin purchases console,
// and the admin user popup). Service-role only — callers MUST scope by the right
// user (account/popup) or be admin-gated (full list).
//
// Returns EVERY order (pending / paid / failed / …) so a buyer sees their failed
// attempts too, with the product title resolved and an invoice flag.
//
// RESILIENT: the document_id/document_url columns come from migration 030. If
// that migration hasn't been applied yet, the SELECT falls back to the columns
// that always exist — so the purchases lists keep working (just without the
// invoice link) instead of erroring out to an empty page.
// ============================================================

import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import type { OrderStatus, ContentType } from './order-service';

export type PurchaseRow = {
  /** Human/url-safe id shown to the user (e.g. digi-XXXXXX). */
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
  /** GROW payment link — present while the order is still unpaid, for resuming payment. */
  checkout_url: string | null;
};

export type AdminPurchaseRow = PurchaseRow & {
  user_id: string;
  user_email: string | null;
  user_name: string | null;
};

const COLS_BASE = 'public_order_id, created_at, content_type, content_id, status, amount, currency, checkout_url, user_id';
const COLS_FULL = `${COLS_BASE}, document_id, document_url`;

type RawOrder = {
  public_order_id: string;
  created_at: string;
  content_type: ContentType;
  content_id: string;
  status: OrderStatus;
  amount: number;
  currency: string;
  checkout_url: string | null;
  user_id: string;
  document_id?: string | null;
  document_url?: string | null;
};

/**
 * Run an orders query, preferring the columns that include the invoice document,
 * but transparently falling back to the base columns if migration 030 isn't
 * applied yet (so a missing column never blanks the whole purchases page).
 */
async function selectOrders(
  build: (cols: string) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<RawOrder[]> {
  const full = await build(COLS_FULL);
  if (!full.error) return (full.data ?? []) as RawOrder[];
  console.warn('[purchase-history] full select failed (migration 030 not applied?) — falling back', full.error);
  const base = await build(COLS_BASE);
  if (base.error) {
    console.error('[purchase-history] base select failed', base.error);
    return [];
  }
  return (base.data ?? []) as RawOrder[];
}

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
    checkout_url: o.checkout_url ?? null,
  };
}

/** All purchase attempts for one user, newest first. Scope by the auth'd user. */
export async function getUserPurchases(userId: string): Promise<PurchaseRow[]> {
  const supabase = createServiceClient();
  const orders = await selectOrders((cols) =>
    supabase.from('orders').select(cols).eq('user_id', userId).order('created_at', { ascending: false }),
  );
  const titles = await titlesFor(orders.map((o) => o.content_id));
  return orders.map((o) => toRow(o, titles));
}

/** Every purchase attempt across all users (admin console), newest first. */
export async function getAllPurchases(limit = 1000): Promise<AdminPurchaseRow[]> {
  const supabase = createServiceClient();
  const orders = await selectOrders((cols) =>
    supabase.from('orders').select(cols).order('created_at', { ascending: false }).limit(limit),
  );
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
