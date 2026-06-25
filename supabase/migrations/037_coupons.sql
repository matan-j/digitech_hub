-- 037_coupons.sql
-- Admin-managed discount coupons + cart application + redemption tracking.
--
-- DESIGN RULES (consistent with 019 / 020 / 024 / 033):
--   * Additive only. No drops/renames.
--   * The webhook contract is UNCHANGED. A coupon only reduces orders.amount —
--     the figure GROW already charges and validates against. The coupon code is
--     NEVER added to any webhook payload; it lives only on the local order row
--     (orders.coupon_code / coupon_discount) for the purchase card + redemption.
--   * Coupons are ADMIN-ONLY (RLS via is_admin()). Cart validation + redemption
--     run through the service client (bypass RLS), exactly like the rest of the
--     checkout flow.
--   * A coupon is marked redeemed ONLY after a verified, PAID order — never when
--     it is merely typed into the cart.
--   * No stacking: cart_coupons.user_id is the PK → at most one coupon per cart.
--   * Discount is always computed on the EFFECTIVE (post-sale) price, mirroring
--     resolveFinalPrice() in lib/payments/pricing.ts.
--
-- ⚠️ RLS CHANGE — review + apply per the project's RLS approval process (CLAUDE.md).
--   Safe to apply after 020 (orders) and 033 (cart_items / order_items).

-- ============================================================
-- 1. coupons — the coupon definition (admin-authored)
-- ============================================================

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  -- Public code the buyer types. UPPERCASE only (enforced here + in the app).
  code text not null unique
    check (code = upper(code) and length(code) between 2 and 40),
  -- Admin-only label for identifying the coupon internally (never shown to buyers).
  internal_name text,
  discount_type text not null check (discount_type in ('percentage','fixed_amount')),
  -- Percent (1..100) when 'percentage'; an ILS amount when 'fixed_amount'.
  discount_value numeric(10,2) not null check (discount_value > 0),
  check (discount_type <> 'percentage' or discount_value <= 100),
  -- 'all' → whole cart; 'specific' → only the linked products (coupon_products).
  applies_to text not null default 'all' check (applies_to in ('all','specific')),
  -- 'all' → any customer; 'specific' → only the linked customers (coupon_customers).
  customer_scope text not null default 'all' check (customer_scope in ('all','specific')),
  -- 'none' → reusable; 'global' → once ever; 'per_customer' → once per customer.
  one_time_scope text not null default 'none'
    check (one_time_scope in ('none','global','per_customer')),
  valid_from timestamptz,   -- null = no start bound
  valid_until timestamptz,  -- null = never expires
  -- The "מומש / לא מומש" flag. Set true once a 'global' one-time coupon is
  -- redeemed by a paid order (and is_active flips to false at the same time).
  is_redeemed boolean not null default false,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists coupons_code_idx on public.coupons(code);

drop trigger if exists coupons_set_updated_at on public.coupons;
create trigger coupons_set_updated_at
  before update on public.coupons
  for each row execute function public.set_updated_at();

-- ============================================================
-- 2. coupon_products — products a 'specific' coupon applies to
-- ============================================================

create table if not exists public.coupon_products (
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  content_type text not null default 'course'
    check (content_type in ('course','guide','playbook','resource','bundle')),
  content_id uuid not null,
  primary key (coupon_id, content_id)
);

create index if not exists coupon_products_coupon_idx on public.coupon_products(coupon_id);

-- ============================================================
-- 3. coupon_customers — customers a 'specific' coupon is limited to
-- ============================================================

create table if not exists public.coupon_customers (
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (coupon_id, user_id)
);

create index if not exists coupon_customers_coupon_idx on public.coupon_customers(coupon_id);

-- ============================================================
-- 4. coupon_redemptions — audit + per-customer one-time enforcement
-- ============================================================
-- One row per coupon actually used on a PAID order. unique(coupon_id, order_id)
-- keeps a webhook replay from double-recording the same order. The service layer
-- enforces 'per_customer' by checking for an existing (coupon_id, user_id) row.

create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  discount_amount numeric(10,2) not null default 0,
  redeemed_at timestamptz not null default now(),
  unique (coupon_id, order_id)
);

create index if not exists coupon_redemptions_coupon_idx on public.coupon_redemptions(coupon_id);
create index if not exists coupon_redemptions_user_idx on public.coupon_redemptions(user_id);

-- ============================================================
-- 5. cart_coupons — the (single) coupon applied to a user's cart
-- ============================================================
-- user_id PK ⇒ at most one coupon per cart (no stacking). Cleared on a paid
-- bundle checkout (alongside the cart_items) or when the buyer removes it.

create table if not exists public.cart_coupons (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 6. orders — snapshot the applied coupon on the order (local only)
-- ============================================================

-- coupon_id is set null if the coupon is later deleted — the text snapshot
-- (coupon_code / coupon_discount) preserves it on the purchase card regardless.
alter table public.orders add column if not exists coupon_id uuid references public.coupons(id) on delete set null;
alter table public.orders add column if not exists coupon_code text;
alter table public.orders add column if not exists coupon_discount numeric(10,2);

-- ============================================================
-- 7. RLS
-- ============================================================
-- Coupon definitions + links + redemptions are admin-only. Buyers never read the
-- coupon table directly — the cart validates server-side via the service client.

alter table public.coupons enable row level security;
create policy "coupons_admin_all"
  on public.coupons for all
  using (public.is_admin())
  with check (public.is_admin());

alter table public.coupon_products enable row level security;
create policy "coupon_products_admin_all"
  on public.coupon_products for all
  using (public.is_admin())
  with check (public.is_admin());

alter table public.coupon_customers enable row level security;
create policy "coupon_customers_admin_all"
  on public.coupon_customers for all
  using (public.is_admin())
  with check (public.is_admin());

alter table public.coupon_redemptions enable row level security;
-- A customer may read their own redemptions; admins read all. Writes are
-- service-role only (the verified webhook), so no client write policy.
create policy "coupon_redemptions_select_own_or_admin"
  on public.coupon_redemptions for select
  using (user_id = auth.uid() or public.is_admin());
create policy "coupon_redemptions_admin_write"
  on public.coupon_redemptions for all
  using (public.is_admin())
  with check (public.is_admin());

alter table public.cart_coupons enable row level security;
-- Owner manages their own applied coupon; admins full access. Server writes go
-- through the service client but these keep direct client access safe.
create policy "cart_coupons_select_own_or_admin"
  on public.cart_coupons for select
  using (user_id = auth.uid() or public.is_admin());
create policy "cart_coupons_insert_own"
  on public.cart_coupons for insert
  with check (user_id = auth.uid());
create policy "cart_coupons_delete_own"
  on public.cart_coupons for delete
  using (user_id = auth.uid());
create policy "cart_coupons_admin_write"
  on public.cart_coupons for all
  using (public.is_admin())
  with check (public.is_admin());
