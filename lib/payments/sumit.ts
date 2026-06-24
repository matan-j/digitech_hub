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

/**
 * Human/url-safe unique order id, e.g. digi-K7P3QX. One per purchase. Uses an
 * unambiguous alphabet (no 0/O/1/I) so it's safe to read out / type. ~1B values;
 * the orders.public_order_id UNIQUE constraint is the final guard.
 */
export function generatePublicOrderId(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 chars, no look-alikes
  const bytes = crypto.randomBytes(6);
  let code = '';
  for (let i = 0; i < 6; i++) code += alphabet[bytes[i] % alphabet.length];
  return `digi-${code}`;
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

// Shape mirrors OfficeGuy.Apps.Billing.MVC.API.Typed.Payment (Payments/Get).
// NOTE: the Payment object has NO document/invoice fields — the receipt document
// is fetched separately via sumitGetDocumentDownloadUrl using a DocumentID that
// arrives on the redirect/trigger (EntityID), not from here.
export type SumitPaymentStatus = {
  valid: boolean;
  amount: number | null;
  currency: string | null;
  transactionId: string | null;
  status: string | null;
  statusDescription: string | null;
  authNumber: string | null;
  paymentDate: string | null;
  customerId: string | null;
  raw: unknown;
};

/**
 * Server-side verification of a single payment by id. The confirm route + webhook
 * grant access only when `valid` is true. Parsed defensively across field shapes.
 */
export async function sumitGetPayment(paymentId: string): Promise<SumitPaymentStatus> {
  if (!isSumitConfigured()) throw new Error('SUMIT is not configured.');

  const env = await postSumit<{
    Payment?: {
      ID?: number | string;
      CustomerID?: number | string;
      Date?: string;
      ValidPayment?: boolean;
      Status?: string;
      StatusDescription?: string;
      Amount?: number;
      Currency?: string;
      AuthNumber?: string;
    };
    // tolerate flat shapes too
    ValidPayment?: boolean;
    Amount?: number;
    Currency?: string;
  }>('/billing/payments/get/', { PaymentID: paymentId });

  const p = env.Data?.Payment;
  const valid = env.Status === 0 && Boolean(p?.ValidPayment ?? env.Data?.ValidPayment);
  const amount = p?.Amount ?? env.Data?.Amount ?? null;
  const currency = p?.Currency ?? env.Data?.Currency ?? null;
  const transactionId = (p?.ID ?? paymentId) != null ? String(p?.ID ?? paymentId) : null;
  return {
    valid,
    amount: amount != null ? Number(amount) : null,
    currency: currency != null ? String(currency) : null,
    transactionId,
    status: p?.Status ?? null,
    statusDescription: p?.StatusDescription ?? null,
    authNumber: p?.AuthNumber ?? null,
    paymentDate: p?.Date ?? null,
    customerId: p?.CustomerID != null ? String(p.CustomerID) : null,
    raw: env,
  };
}

/**
 * Resolve a PDF download URL for a SUMIT receipt/invoice document. Uses
 * /accounting/documents/getdetails/ which returns DocumentDownloadURL (original
 * on first visit, certified copy afterwards). Returns null (never throws) when
 * unavailable, so callers simply don't offer a download.
 *
 * `documentId` is SUMIT's internal id (the "EntityID" delivered by the trigger,
 * or the "c" number in the document URL).
 */
export async function sumitGetDocumentDownloadUrl(documentId: string): Promise<string | null> {
  if (!isSumitConfigured()) return null;
  try {
    const env = await postSumit<{
      DocumentDownloadURL?: string;
      DocumentID?: number | string;
      DocumentNumber?: number;
    }>('/accounting/documents/getdetails/', { DocumentID: Number(documentId) });
    if (env.Status !== 0) return null;
    return env.Data?.DocumentDownloadURL ?? null;
  } catch (e) {
    console.error('[sumit] getDocumentDownloadUrl failed', documentId, e instanceof Error ? e.message : e);
    return null;
  }
}

// ---- Triggers (programmatic webhook registration) -------------------------
// SUMIT's webhook is NOT a field on beginredirect. Instead you SUBSCRIBE a URL
// to a saved View via /triggers/triggers/subscribe/ ("usually done by
// make.com/zapier, but can also be used directly"). The trigger then POSTs the
// View's row (incl. EntityID + our ExternalIdentifier column) to that URL.

export type SumitTriggerType = 'CreateOrUpdate' | 'Create' | 'Update' | 'Archive' | 'Delete';

/** Subscribe a webhook URL to a SUMIT trigger View. Idempotent on SUMIT's side per URL+View. */
export async function sumitSubscribeTrigger(input: {
  url: string;
  view: number;
  folder?: string | null;
  triggerType?: SumitTriggerType;
}): Promise<void> {
  if (!isSumitConfigured()) throw new Error('SUMIT is not configured.');
  const env = await postSumit('/triggers/triggers/subscribe/', {
    URL: input.url,
    View: input.view,
    Folder: input.folder ?? undefined,
    TriggerType: input.triggerType ?? 'Create',
  });
  if (env.Status !== 0) {
    throw new Error(`SUMIT trigger subscribe failed: ${env.UserErrorMessage ?? `status ${env.Status}`}`);
  }
}

/** Remove a previously-subscribed webhook URL. */
export async function sumitUnsubscribeTrigger(url: string): Promise<void> {
  if (!isSumitConfigured()) throw new Error('SUMIT is not configured.');
  const env = await postSumit('/triggers/triggers/unsubscribe/', { URL: url });
  if (env.Status !== 0) {
    throw new Error(`SUMIT trigger unsubscribe failed: ${env.UserErrorMessage ?? `status ${env.Status}`}`);
  }
}

// ---- Folder / View discovery (so the View ID can be picked, not hunted) ----

export type SumitNamedEntity = { id: number; name: string };

/** List the account's CRM folders (Documents, Customers, …) for the View picker. */
export async function sumitListFolders(nameFilter?: string): Promise<SumitNamedEntity[]> {
  if (!isSumitConfigured()) throw new Error('SUMIT is not configured.');
  const env = await postSumit<{ Folders?: Array<{ ID: number; Name?: string }> }>(
    '/crm/schema/listfolders/',
    { NameFilter: nameFilter ?? undefined },
  );
  if (env.Status !== 0) throw new Error(`SUMIT listfolders failed: ${env.UserErrorMessage ?? `status ${env.Status}`}`);
  return (env.Data?.Folders ?? []).map((f) => ({ id: f.ID, name: f.Name ?? String(f.ID) }));
}

/** List the saved Views inside a folder. The webhook subscribes to one View's id. */
export async function sumitListViews(folderId: number): Promise<SumitNamedEntity[]> {
  if (!isSumitConfigured()) throw new Error('SUMIT is not configured.');
  const env = await postSumit<{ Views?: Array<{ ID: number; Name?: string }> }>(
    '/crm/views/listviews/',
    { FolderID: folderId },
  );
  if (env.Status !== 0) throw new Error(`SUMIT listviews failed: ${env.UserErrorMessage ?? `status ${env.Status}`}`);
  return (env.Data?.Views ?? []).map((v) => ({ id: v.ID, name: v.Name ?? String(v.ID) }));
}
