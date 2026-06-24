-- 030_sumit_invoice.sql
-- Store the SUMIT receipt/invoice document on each order so the buyer (account
-- page) and admins (purchases console + user popup) can download it.
--
-- DESIGN RULES:
--   * Additive only. No drops/renames.
--   * SUMIT issues the document (SendDocumentByEmail in beginredirect). When we
--     verify the payment (confirm route / webhook) we capture the document id +
--     download URL, if the provider returns them, onto the order.
--   * RLS unchanged: orders are already owner/admin-readable (migration 020), and
--     all writes happen via the service role from the verified settle path.

-- ============================================================
-- 1. orders — SUMIT document (receipt/invoice) reference
-- ============================================================

alter table public.orders
  add column if not exists document_id text,    -- SUMIT document/receipt id
  add column if not exists document_url text;   -- direct PDF download URL (if provided)

comment on column public.orders.document_id is 'SUMIT receipt/invoice document id captured at payment verification.';
comment on column public.orders.document_url is 'Direct PDF URL for the SUMIT receipt/invoice, when the provider returns one.';
