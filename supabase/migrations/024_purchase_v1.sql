-- 024_purchase_v1.sql
-- V1 purchase / access system on top of the public-first access model (018–022).
--
-- DESIGN RULES (non-negotiable):
--   * Additive only. No drops/renames of existing columns or tables.
--   * Access is NEVER granted because a webhook was sent. Paid purchases create a
--     PENDING order + fire an outbound lead webhook (Make.com) only. The single
--     place a *paid* entitlement is created stays the verified-payment handler.
--   * Free / final-price-0 purchases grant immediately (app code), recorded as an
--     enrollment (open/login_required) or a 0-amount paid order + entitlement.
--
-- What this adds:
--   1. content_items.sale_amount  — discounted price (price_amount = before discount).
--   2. orders: 'manual' provider (Make.com lead model), original_amount snapshot,
--      and outbound request-webhook tracking columns.
--   3. A partial unique index that allows only ONE open (pending) order per
--      user+item — the DB-level guard against duplicate webhooks on double-click.
--   4. content_items_public view recreated to expose sale_amount.

-- ============================================================
-- 1. content_items — discounted price
-- ============================================================

alter table public.content_items
  add column if not exists sale_amount numeric(10,2);

-- ============================================================
-- 2. orders — lead-webhook (Make.com) model
-- ============================================================

-- Allow the V1 lead model alongside the (future) SUMIT provider.
alter table public.orders
  drop constraint if exists orders_provider_check;
alter table public.orders
  add constraint orders_provider_check
  check (provider in ('sumit', 'manual'));

alter table public.orders
  add column if not exists original_amount numeric(10,2),
  add column if not exists request_webhook_status text not null default 'pending',
  add column if not exists request_webhook_sent_at timestamptz,
  add column if not exists request_webhook_error text;

alter table public.orders
  drop constraint if exists orders_request_webhook_status_check;
alter table public.orders
  add constraint orders_request_webhook_status_check
  check (request_webhook_status in ('pending', 'sent', 'failed'));

-- One OPEN request per user+item. Blocks duplicate orders/webhooks from a
-- double-click or refresh; paid/failed/cancelled rows are unaffected.
create unique index if not exists orders_unique_pending
  on public.orders(user_id, content_type, content_id)
  where status = 'pending';

-- ============================================================
-- 3. content_items_public — expose sale_amount (recreate from 022)
-- ============================================================

create or replace view public.content_items_public
with (security_invoker = false) as
  select
    ci.id, ci.type, ci.slug, ci.title, ci.tagline, ci.description,
    ci.cover_url, ci.cover_style, ci.audience, ci.tags, ci.domain,
    ci.duration_minutes, ci.creator_id, ci.content_kind, ci.is_featured,
    ci.seo_title, ci.seo_description, ci.og_image_url,
    ci.access_level, ci.catalog_visibility, ci.preview_enabled,
    ci.price_amount, ci.sale_amount, ci.price_currency, ci.is_premium,
    ci.status, ci.published_at, ci.created_at, ci.updated_at
  from public.content_items ci
  where ci.status = 'published';

grant select on public.content_items_public to anon, authenticated;
