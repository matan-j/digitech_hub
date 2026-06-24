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
  /** One line for a plain sale, or full-price + negative-discount lines. */
  items: SumitItem[];
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
      Items: input.items,
      VATIncluded: true,
      Language: 'Hebrew',
      DraftDocument: false,
      // Issue a receipt/invoice and email it to the buyer (Customer.EmailAddress).
      // Requires the documents/invoicing module to be active on the SUMIT account.
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
  /** SUMIT receipt/invoice document id, when the payment produced one. */
  documentId: string | null;
  /** Direct PDF download URL for the receipt/invoice, when SUMIT returns one. */
  documentUrl: string | null;
  raw: unknown;
};

/**
 * Server-side verification of a single payment by id. The confirm route grants
 * access only when `valid` is true. Parsed defensively across SUMIT field shapes.
 * Also extracts the receipt/invoice document id + URL if present so callers can
 * store it on the order for later download.
 */
export async function sumitGetPayment(paymentId: string): Promise<SumitPaymentStatus> {
  if (!isSumitConfigured()) throw new Error('SUMIT is not configured.');

  const env = await postSumit<{
    Payment?: {
      ID?: number | string;
      ValidPayment?: boolean;
      Amount?: number;
      Currency?: string;
      DocumentID?: number | string;
      DocumentURL?: string;
    };
    ValidPayment?: boolean;
    Amount?: number;
    Currency?: string;
    DocumentID?: number | string;
    DocumentURL?: string;
    Document?: { ID?: number | string; DocumentDownloadURL?: string; URL?: string };
  }>('/billing/payments/get/', { PaymentID: paymentId });

  const p = env.Data?.Payment;
  const doc = env.Data?.Document;
  const valid = env.Status === 0 && Boolean(p?.ValidPayment ?? env.Data?.ValidPayment);
  const amount = p?.Amount ?? env.Data?.Amount ?? null;
  const currency = p?.Currency ?? env.Data?.Currency ?? null;
  const transactionId = (p?.ID ?? paymentId) != null ? String(p?.ID ?? paymentId) : null;
  const documentIdRaw = p?.DocumentID ?? env.Data?.DocumentID ?? doc?.ID ?? null;
  const documentUrl = p?.DocumentURL ?? env.Data?.DocumentURL ?? doc?.DocumentDownloadURL ?? doc?.URL ?? null;
  return {
    valid,
    amount: amount != null ? Number(amount) : null,
    currency,
    transactionId,
    documentId: documentIdRaw != null ? String(documentIdRaw) : null,
    documentUrl: documentUrl ?? null,
    raw: env,
  };
}

/**
 * Best-effort: resolve a fresh PDF download URL for a SUMIT document id. Returns
 * null (never throws) if the provider doesn't return one — the caller then simply
 * doesn't offer a download. Field shapes are parsed defensively.
 */
export async function sumitGetDocumentUrl(documentId: string): Promise<string | null> {
  if (!isSumitConfigured()) return null;
  try {
    const env = await postSumit<{
      DownloadURL?: string;
      PDFURL?: string;
      URL?: string;
      Document?: { DocumentDownloadURL?: string; URL?: string; PDFURL?: string };
    }>('/accounting/documents/getpdf/', { DocumentID: documentId });
    if (env.Status !== 0) return null;
    const d = env.Data;
    return d?.DownloadURL ?? d?.PDFURL ?? d?.URL ?? d?.Document?.DocumentDownloadURL ?? d?.Document?.URL ?? d?.Document?.PDFURL ?? null;
  } catch (e) {
    console.error('[sumit] getDocumentUrl failed', documentId, e instanceof Error ? e.message : e);
    return null;
  }
}
