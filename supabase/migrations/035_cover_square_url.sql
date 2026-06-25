-- 035_cover_square_url.sql
-- A pre-cropped 1:1 (square) variant of a content item's cover image.
--
-- WHY: the purchase webhook to Make/GROW must always carry a square cover image
-- URL (both quick-buy and cart). Instead of cropping at purchase time, we crop
-- once when the cover is uploaded and cache the resulting public URL here. The
-- purchase flow then just reads this column; if it's ever empty (e.g. a cover
-- uploaded before this feature), it lazily crops + stores it on first use
-- (lib/images/square-cover.ts#ensureSquareCoverUrl).
--
-- Additive only. Nothing reads this column for on-page display — covers still
-- render from cover_url. This is purely the webhook image source.

alter table public.content_items
  add column if not exists cover_square_url text;
