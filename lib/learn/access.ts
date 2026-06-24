// ============================================================
// Access model — single source of truth for the public-first Hub.
//
// Pure functions, no DB. Works BEFORE migration 018 is applied (derives the
// model from the legacy `status` + `is_premium` columns) and AFTER (reads the
// real `access_level` / `catalog_visibility` / `preview_enabled` columns).
// This lets Phase 1A ship against the current database and upgrade seamlessly
// once the migrations are applied.
// ============================================================

import { resolveFinalPrice } from '@/lib/payments/pricing';

export type AccessLevel =
  | 'open'
  | 'login_required'
  | 'purchase_required'
  | 'subscription_required';

export type CatalogVisibility = 'public' | 'unlisted';
export type PublicationStatus = 'draft' | 'published' | 'archived';

/** The subset of columns the access model reads. All optional → forward/back compatible. */
export type AccessFields = {
  status?: string | null;
  is_premium?: boolean | null;
  access_level?: AccessLevel | null;
  catalog_visibility?: CatalogVisibility | null;
  preview_enabled?: boolean | null;
  price_amount?: number | null;
  sale_amount?: number | null;
  price_currency?: string | null;
};

/** Effective access level — new column wins; legacy is_premium is the fallback. */
export function resolveAccessLevel(item: AccessFields): AccessLevel {
  if (item.access_level) return item.access_level;
  return item.is_premium ? 'subscription_required' : 'open';
}

export function resolveCatalogVisibility(item: AccessFields): CatalogVisibility {
  return item.catalog_visibility ?? 'public';
}

export function resolvePreviewEnabled(item: AccessFields): boolean {
  return item.preview_enabled ?? false;
}

/** Should this item appear in public discovery listings? */
export function isPubliclyListed(item: AccessFields): boolean {
  return (item.status ?? 'draft') === 'published' && resolveCatalogVisibility(item) === 'public';
}

/** A free, fully-open item — login is needed only for high-intent actions. */
export function isOpenAccess(item: AccessFields): boolean {
  return resolveAccessLevel(item) === 'open';
}

/** Why a gate is shown — drives CTA copy + which auth/purchase flow to open. */
export type GateReason = 'login' | 'purchase' | 'subscription';

export type AccessDecision =
  | { state: 'full' } // render the full body
  | { state: 'preview'; reason: GateReason } // render preview slice + gate CTA
  | { state: 'locked'; reason: GateReason }; // metadata only + gate CTA

/**
 * Decide what a viewer may see for an item's FULL body.
 *  - loggedIn:       there is an authenticated session
 *  - hasPremium:     legacy active Stripe subscription OR admin (lib/auth#hasPremiumAccess)
 *  - hasEntitlement: an active per-item paid entitlement (Phase 1C; defaults false)
 *
 * High-intent actions (save progress, download, workspace) are gated separately
 * at the action layer even for `open` content.
 */
export function decideAccess(
  item: AccessFields,
  opts: { loggedIn: boolean; hasPremium: boolean; hasEntitlement?: boolean },
): AccessDecision {
  const level = resolveAccessLevel(item);
  const preview = resolvePreviewEnabled(item);
  const previewOrLocked = (reason: GateReason): AccessDecision =>
    preview ? { state: 'preview', reason } : { state: 'locked', reason };

  switch (level) {
    case 'open':
      return { state: 'full' };
    case 'login_required':
      return opts.loggedIn ? { state: 'full' } : previewOrLocked('login');
    case 'purchase_required':
      return opts.hasEntitlement || opts.hasPremium ? { state: 'full' } : previewOrLocked('purchase');
    case 'subscription_required':
      return opts.hasPremium ? { state: 'full' } : previewOrLocked('subscription');
  }
}

/** "₪149" / "$49" / "€20" — null when there is no positive price. */
export function formatPrice(amount: number | null | undefined, currency: string | null | undefined): string | null {
  if (!amount || amount <= 0) return null;
  const sym = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₪';
  return `${sym}${amount % 1 === 0 ? amount : amount.toFixed(2)}`;
}

/**
 * Display-ready pricing for a card/landing CTA. Mirrors the server's
 * resolveFinalPrice (lib/payments/pricing.ts) so UI and API agree, and returns
 * pre-formatted strings. `final`/`original` are null when there's no price.
 */
export function resolveDisplayPrice(item: AccessFields): {
  final: string | null;
  original: string | null;
  hasDiscount: boolean;
  isFree: boolean;
} {
  const price = resolveFinalPrice(item);
  return {
    final: formatPrice(price.final, price.currency),
    original: formatPrice(price.original, price.currency),
    hasDiscount: price.hasDiscount,
    isFree: price.isFree,
  };
}

/** Hebrew CTA label for a gate reason. */
export function gateCtaLabel(reason: GateReason): string {
  switch (reason) {
    case 'login':
      return 'פתיחת גישה חינמית';
    case 'purchase':
      return 'רכישת גישה לקורס';
    case 'subscription':
      return 'הצטרפות למועדון';
  }
}
