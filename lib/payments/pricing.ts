// ============================================================
// lib/payments/pricing.ts
// Single source of truth for course pricing. PURE — no DB, no env. Used by the
// purchase API (server-trusted final price) AND the UI (display). The client's
// reported amount is NEVER trusted; the server always recomputes from the row.
//
// Model (migration 024):
//   price_amount  = price before discount (list price)
//   sale_amount   = discounted price (optional)
//   final         = sale_amount when it is a valid number in [0, price_amount],
//                   else price_amount. Floored at 0. A final of 0 (or no positive
//                   price) means FREE → access is granted immediately, no webhook.
// ============================================================

export type PriceFields = {
  price_amount?: number | null;
  sale_amount?: number | null;
  price_currency?: string | null;
};

export type ResolvedPrice = {
  /** List price before discount (0 when unset). */
  original: number;
  /** Server-trusted price the customer actually pays. */
  final: number;
  currency: string;
  /** A genuine discount: a positive sale below the list price. */
  hasDiscount: boolean;
  /** final <= 0 → grant immediately, never send a payment webhook. */
  isFree: boolean;
};

function clean(n: number | null | undefined): number {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/** Resolve the effective price for an item. Pure and deterministic. */
export function resolveFinalPrice(item: PriceFields): ResolvedPrice {
  const original = clean(item.price_amount);
  const sale = clean(item.sale_amount);
  // A sale only applies when it's positive AND below the list price.
  const hasDiscount = sale > 0 && original > 0 && sale < original;
  const final = hasDiscount ? sale : original;
  return {
    original,
    final,
    currency: item.price_currency ?? 'ILS',
    hasDiscount,
    isFree: final <= 0,
  };
}
