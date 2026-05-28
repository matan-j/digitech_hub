import Stripe from 'stripe';

let _stripe: Stripe | null = null;

/**
 * Lazy Stripe client. Only instantiated when first called — avoids build-time
 * failures when STRIPE_SECRET_KEY is not yet set on the environment (e.g.
 * initial production deploy before Stripe is configured).
 *
 * Throws at call time if the key is missing — surfaces as a clear runtime error
 * on /api/stripe/* routes, while leaving the rest of the app buildable.
 */
export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      'STRIPE_SECRET_KEY is not set. Configure it in your environment to enable Stripe.',
    );
  }
  _stripe = new Stripe(key, {
    apiVersion: '2026-04-22.dahlia',
    typescript: true,
  });
  return _stripe;
}

export function appUrl(path = ''): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3030';
  return `${base.replace(/\/$/, '')}${path}`;
}
