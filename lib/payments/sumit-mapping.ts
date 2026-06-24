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
 * Single line item for a course purchase. UnitPrice is the server-computed final
 * price (sale price when a discount is active, else the regular price). One unit.
 * SUMIT currency is the ISO code string ('ILS').
 */
export function buildRedirectItem(course: { title?: string | null } & PriceFields): SumitItem {
  const price = resolveFinalPrice(course);
  return {
    Item: { Name: course.title ?? 'Course' },
    Quantity: 1,
    UnitPrice: price.final,
    Currency: price.currency || 'ILS',
  };
}
