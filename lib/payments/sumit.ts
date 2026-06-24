// ============================================================
// lib/payments/sumit.ts
// SUMIT (formerly OfficeGuy) payment provider — Redirect API.
//
// Flow (NO webhooks):
//   1. beginRedirect → SUMIT returns a hosted payment URL; we send the buyer there.
//   2. SUMIT redirects back to our RedirectURL with ?OG-PaymentID=<id> appended.
//   3. Our server confirm route calls getPayment(id) and grants access ONLY when
//      ValidPayment === true. Access is NEVER granted from the redirect alone.
//
// Server-only: private credentials live in env and never reach the client.
//   SUMIT_COMPANY_ID, SUMIT_API_KEY, SUMIT_API_BASE_URL (default api.sumit.co.il)
// ============================================================

import 'server-only';
import crypto from 'crypto';

const BASE_URL = process.env.SUMIT_API_BASE_URL || 'https://api.sumit.co.il';

/** True only when both private credentials are present. */
export function isSumitConfigured(): boolean {
  return !!process.env.SUMIT_COMPANY_ID && !!process.env.SUMIT_API_KEY;
}

function credentials() {
  return {
    CompanyID: Number(process.env.SUMIT_COMPANY_ID),
    APIKey: process.env.SUMIT_API_KEY,
  };
}

/** Human/url-safe order id, e.g. DGH-7F3K9Q2A. */
export function generatePublicOrderId(): string {
  const raw = crypto.randomBytes(6).toString('hex').toUpperCase(); // 12 hex chars
  return `DGH-${raw}`;
}

// ---- Request shapes (the non-secret parts are built by sumit-mapping.ts) ----

export type SumitCustomer = {
  Name: string;
  EmailAddress: string;
  Phone?: string | null;
};

export type SumitItem = {
  Item: { Name: string };
  Quantity: number;
  UnitPrice: number;
  Currency: string; // 'ILS'
};

export type BeginRedirectInput = {
  customer: SumitCustomer;
  item: SumitItem;
  /** Absolute URL SUMIT returns the buyer to (our server confirm route). */
  redirectUrl: string;
  /** Our public order id — echoed for reconciliation. */
  externalIdentifier: string;
};

export type BeginRedirectResult = { redirectUrl: string; paymentId: string | null };

/** OfficeGuy/SUMIT response envelope: Status === 0 means success. */
type SumitEnvelope<T> = {
  Status: number;
  UserErrorMessage?: string | null;
  TechnicalErrorDetails?: string | null;
  Data?: T;
};

async function postSumit<T>(path: string, body: Record<string, unknown>): Promise<SumitEnvelope<T>> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ Credentials: credentials(), ...body }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`SUMIT ${path} HTTP ${res.status}: ${txt.slice(0, 300)}`);
  }
  return (await res.json()) as SumitEnvelope<T>;
}

/**
 * Create a hosted Redirect payment and return the URL to send the buyer to.
 * Throws (with SUMIT's message) when the provider rejects the request.
 */
export async function sumitBeginRedirect(input: BeginRedirectInput): Promise<BeginRedirectResult> {
  if (!isSumitConfigured()) throw new Error('SUMIT is not configured (SUMIT_COMPANY_ID / SUMIT_API_KEY).');

  const env = await postSumit<{ RedirectURL?: string; Payment?: { ID?: number | string }; PaymentID?: number | string }>(
    '/billing/payments/beginredirect/',
    {
      Customer: input.customer,
      Items: [input.item],
      VATIncluded: true,
      Language: 'Hebrew',
      DraftDocument: false,
      SendDocumentByEmail: true,
      RedirectURL: input.redirectUrl,
      ExternalIdentifier: input.externalIdentifier,
    },
  );

  if (env.Status !== 0 || !env.Data?.RedirectURL) {
    throw new Error(`SUMIT beginredirect failed: ${env.UserErrorMessage ?? `status ${env.Status}`}`);
  }
  const pid = env.Data.Payment?.ID ?? env.Data.PaymentID ?? null;
  return { redirectUrl: env.Data.RedirectURL, paymentId: pid != null ? String(pid) : null };
}

export type SumitPaymentStatus = {
  valid: boolean;
  amount: number | null;
  currency: string | null;
  transactionId: string | null;
  raw: unknown;
};

/**
 * Server-side verification of a single payment by id. The confirm route grants
 * access only when `valid` is true. Parsed defensively across SUMIT field shapes.
 */
export async function sumitGetPayment(paymentId: string): Promise<SumitPaymentStatus> {
  if (!isSumitConfigured()) throw new Error('SUMIT is not configured.');

  const env = await postSumit<{
    Payment?: { ID?: number | string; ValidPayment?: boolean; Amount?: number; Currency?: string };
    ValidPayment?: boolean;
    Amount?: number;
    Currency?: string;
  }>('/billing/payments/get/', { PaymentID: paymentId });

  const p = env.Data?.Payment;
  const valid = env.Status === 0 && Boolean(p?.ValidPayment ?? env.Data?.ValidPayment);
  const amount = p?.Amount ?? env.Data?.Amount ?? null;
  const currency = p?.Currency ?? env.Data?.Currency ?? null;
  const transactionId = (p?.ID ?? paymentId) != null ? String(p?.ID ?? paymentId) : null;
  return { valid, amount: amount != null ? Number(amount) : null, currency, transactionId, raw: env };
}
