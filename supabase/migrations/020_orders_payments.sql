-- 020_orders_payments.sql
-- Internal orders + provider payment events for SUMIT (V1 payment provider).
--
-- DESIGN RULES:
--   * Additive only. Stripe tables (007_stripe_events) untouched.
--   * Access is NEVER granted from a frontend redirect. The webhook handler
--     (verified) creates the order->paid transition and the entitlement.
--   * Idempotency: payment_events.provider_event_id is unique; entitlement
--     creation is keyed on the order so replays are no-ops.

-- ============================================================
-- 1. orders — one internal order per purchase attempt
-- ============================================================

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  public_order_id text not null unique,           -- human/url-safe id (e.g. DGH-XXXX)
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'sumit' check (provider in ('sumit')),
  content_type text not null check (content_type in ('course','guide','playbook','resource','bundle')),
  content_id uuid not null,
  amount numeric(10,2) not null,
  currency text not null default 'ILS',
  status text not null default 'pending'
    check (status in ('pending','paid','failed','cancelled','refunded')),
  provider_transaction_id text,
  checkout_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_user_idx on public.orders(user_id);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists orders_content_idx on public.orders(content_type, content_id);
create index if not exists orders_provider_txn_idx on public.orders(provider_transaction_id);

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- Now that orders exists, wire the entitlements.order_id FK (added loose in 019).
alter table public.entitlements
  drop constraint if exists entitlements_order_id_fkey;
alter table public.entitlements
  add constraint entitlements_order_id_fkey
  foreign key (order_id) references public.orders(id) on delete set null;

-- ============================================================
-- 2. payment_events — raw provider webhook/event log (idempotency source)
-- ============================================================

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete set null,
  provider text not null default 'sumit',
  provider_event_id text not null,
  event_type text not null,
  raw_payload jsonb not null default '{}'::jsonb,
  processing_status text not null default 'received'
    check (processing_status in ('received','processed','ignored','error')),
  processing_error text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create index if not exists payment_events_order_idx on public.payment_events(order_id);

-- ============================================================
-- 3. RLS — orders readable by owner/admin; events admin-only.
--    Writes for both are service-role only (bypasses RLS) from the
--    create-redirect route and the verified webhook handler.
-- ============================================================

alter table public.orders enable row level security;

create policy "orders_select_own_or_admin"
  on public.orders for select
  using (user_id = auth.uid() or public.is_admin());

create policy "orders_admin_write"
  on public.orders for all
  using (public.is_admin())
  with check (public.is_admin());

alter table public.payment_events enable row level security;

create policy "payment_events_admin_select"
  on public.payment_events for select
  using (public.is_admin());

create policy "payment_events_admin_write"
  on public.payment_events for all
  using (public.is_admin())
  with check (public.is_admin());
