-- 033_cart.sql
-- Mini shopping cart (V1) + multi-item ("bundle") orders.
--
-- DESIGN RULES (consistent with 020 / 024):
--   * Additive only. The single-item purchase flow (/api/purchase) is untouched.
--   * The cart is PER-USER and persistent. One unit per product — enforced by a
--     UNIQUE(user_id, content_id). No quantities, no duplicates.
--   * A cart checkout creates ONE order (content_type='bundle') + one row per line
--     in order_items. Access is still granted ONLY by the verified GROW success
--     webhook — never from a redirect. On success it grants an entitlement per
--     order_items row and clears those items from the cart.
--   * Currently only courses can be added (app-level guard); the schema is generic.

-- ============================================================
-- 1. cart_items — the user's saved cart (one unit per product)
-- ============================================================

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content_type text not null default 'course'
    check (content_type in ('course','guide','playbook','resource','bundle')),
  content_id uuid not null,
  added_at timestamptz not null default now(),
  unique (user_id, content_id)   -- one unit per product, no duplicates
);

create index if not exists cart_items_user_idx on public.cart_items(user_id);

alter table public.cart_items enable row level security;

-- Owner can read/insert/delete their own cart; admin full access. Server-side
-- writes go through the service client (bypasses RLS) but these keep it safe
-- even if a future client writes directly.
create policy "cart_items_select_own_or_admin"
  on public.cart_items for select
  using (user_id = auth.uid() or public.is_admin());

create policy "cart_items_insert_own"
  on public.cart_items for insert
  with check (user_id = auth.uid());

create policy "cart_items_delete_own"
  on public.cart_items for delete
  using (user_id = auth.uid());

create policy "cart_items_admin_write"
  on public.cart_items for all
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- 2. order_items — line items for a (possibly multi-item) order
-- ============================================================
--
-- A single-item order keeps using orders.content_id (back-compatible). A cart
-- ("bundle") order also writes one row here per product, with a price snapshot
-- and title/cover for display on the purchase card. The success webhook grants
-- one entitlement per row.

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  content_type text not null
    check (content_type in ('course','guide','playbook','resource','bundle')),
  content_id uuid not null,
  product_title text,
  cover_url text,
  price_before numeric(10,2) not null default 0,   -- list price (before discount)
  price_after  numeric(10,2) not null default 0,   -- server-trusted price paid
  created_at timestamptz not null default now()
);

create index if not exists order_items_order_idx on public.order_items(order_id);

alter table public.order_items enable row level security;

-- Readable by the order's owner or an admin. Writes are service-role only
-- (create-checkout route + verified webhook), so no client write policy.
create policy "order_items_select_own_or_admin"
  on public.order_items for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (o.user_id = auth.uid() or public.is_admin())
    )
  );

create policy "order_items_admin_write"
  on public.order_items for all
  using (public.is_admin())
  with check (public.is_admin());
