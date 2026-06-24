// ============================================================
// lib/payments/sumit-mapping.ts
// PURE mapping from the app's existing course/profile model → SUMIT request
// parts. No DB, no env, no secrets (Credentials are injected in sumit.ts).
//
// Reuses the app's real pricing fields (price_amount / sale_amount /
// price_currency) via resolveFinalPrice — the server-trusted final price. The
// price shown in the browser is never used here.
// ============================================================

import { resolveFinalPrice, type PriceFields } from './pricing';
import type { SumitCustomer, SumitItem } from './sumit';

/** Customer block from the signed-in user's profile + auth email. */
export function buildCustomer(params: {
  name: string | null | undefined;
  email: string;
  phone: string | null | undefined;
}): SumitCustomer {
  return {
    Name: (params.name ?? '').trim() || params.email,
    EmailAddress: params.email,
    Phone: params.phone ?? undefined,
  };
}

/**
 * Line items for a course purchase. UnitPrice is the server-computed price — the
 * client's number is never used. SUMIT currency is the ISO code string ('ILS').
 *
 * No discount → a single line at the final price.
 * Discount active → two lines so the SUMIT payment page SHOWS the saving:
 *   1) the course at its full (regular) price,
 *   2) a negative "discount" line.
 * The two lines sum to the sale price (resolveFinalPrice().final), so the total
 * charged still equals the order amount the confirm route validates.
 */
export function buildRedirectItems(course: { title?: string | null } & PriceFields): SumitItem[] {
  const price = resolveFinalPrice(course);
  const name = course.title ?? 'Course';
  const currency = price.currency || 'ILS';

  if (!price.hasDiscount) {
    return [{ Item: { Name: name }, Quantity: 1, UnitPrice: price.final, Currency: currency }];
  }

  const discount = Math.round((price.original - price.final) * 100) / 100;
  return [
    { Item: { Name: name }, Quantity: 1, UnitPrice: price.original, Currency: currency },
    { Item: { Name: `הנחה — ${name}` }, Quantity: 1, UnitPrice: -discount, Currency: currency },
  ];
}
