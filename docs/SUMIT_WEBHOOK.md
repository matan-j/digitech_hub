# SUMIT — Post-Purchase Webhook & Invoice

This documents the SUMIT (OfficeGuy) payment flow, the **backup webhook** that
settles orders when a buyer pays but never returns to the app, and where the
**receipt/invoice** is captured and shown.

## Flow overview

```
1. POST /api/purchase
   → creates a PENDING order with a unique public_order_id (DGH-XXXX)
   → opens a SUMIT hosted Redirect checkout, passing public_order_id as
     SUMIT ExternalIdentifier, and stores the returned payment id on the order.

2a. PRIMARY — buyer returns:
    SUMIT redirects to /api/payments/sumit/confirm?order=DGH-XXXX&OG-PaymentID=...
    → verifies the payment with SUMIT, grants access, captures the invoice.

2b. BACKUP — buyer paid but didn't return:
    SUMIT trigger fires → POST /api/webhooks/sumit/payment-success
    → resolves the order, verifies with SUMIT, grants access, captures invoice.
```

Both paths call the same routine — `lib/payments/sumit-settle.ts` →
`settleSumitOrder()` — so they cannot diverge. **Access is never granted from a
redirect or webhook payload alone**: we always re-fetch the payment from SUMIT
(`sumitGetPayment`) and grant only when `ValidPayment` is true and the
amount/currency match the order. Everything is idempotent — whichever path runs
first wins; the second is a safe no-op.

## How SUMIT webhooks actually work (verified against the OpenAPI spec)

Important: the payment-link API (`/billing/payments/beginredirect/`) does **not**
accept a webhook/IPN URL — its only URL fields are `RedirectURL` (buyer success
return) and `CancelRedirectURL`. A per-payment webhook URL cannot be attached
there.

Instead SUMIT exposes a **Triggers API** to register a webhook programmatically:
`/triggers/triggers/subscribe/` — _"Creates a trigger. This is usually done by
make.com/zapier, but can also be used directly."_ You subscribe a **URL** to a
saved **View** (the payments data view, "נתונים לטריגר") with a **TriggerType**.
SUMIT then POSTs that View's row — including the document **EntityID** and our
**ExternalIdentifier** column — to the URL on each matching event.

### Register the webhook from the app (no manual dashboard work)

Admin → **רכישות** → "רישום וובהוק SUMIT" → pick the **Folder** then the **View**
("נתונים לטריגר") from the dropdowns → **רשום וובהוק**. The dropdowns are populated
live from SUMIT (`/crm/schema/listfolders/` + `/crm/views/listviews/`), so you
don't have to hunt for the View ID. This calls `POST /api/admin/sumit/webhook`,
which subscribes `https://<app>/api/webhooks/sumit/payment-success` (with
`?secret=` when set) to the chosen View. "הסר רישום" unsubscribes.

> For the payload to match an order, the chosen View must include the
> **ExternalIdentifier** column (and ideally the payment id / EntityID).
> `SUMIT_TRIGGER_VIEW_ID` is an optional default — when set, the View is
> preselected; otherwise just pick it in the UI.

The webhook endpoint is defensive about field names/casing and nested objects.
It matches the order by `ExternalIdentifier` (our `public_order_id`) first, then
falls back to the SUMIT payment id. Email/amount/currency in the payload are
logged but **not** trusted — access is granted only after re-verifying via
`Payments/Get`.

## Environment variables

| Var | Required | Purpose |
|-----|----------|---------|
| `SUMIT_COMPANY_ID` | yes | SUMIT API credential (already used) |
| `SUMIT_API_KEY` | yes | SUMIT API credential (already used) |
| `SUMIT_API_BASE_URL` | no | Defaults to `https://api.sumit.co.il` |
| `SUMIT_WEBHOOK_SECRET` | recommended | Shared secret. When set, the webhook **requires** it (header `x-webhook-secret` / `?secret=` / body `secret`) or returns 401, and it's appended to the registered URL. Still re-verified via SUMIT regardless — set it in production. |
| `SUMIT_TRIGGER_VIEW_ID` | no | Optional default for the View picker — when set it's preselected. Otherwise pick the View in the admin UI. |
| `SUMIT_TRIGGER_FOLDER_ID` | no | Optional Folder id passed to the trigger subscribe call. |
| `SUMIT_TRIGGER_TYPE` | no | `Create` (default) / `CreateOrUpdate` / `Update` / `Archive` / `Delete`. |
| `NEXT_PUBLIC_APP_URL` | yes (prod) | Absolute base for the redirect/return + registered webhook URLs |

## HTTP responses (webhook)

- `200 { received, outcome }` — handled (granted / already_paid / not_valid / mismatch / no_payment_id). Terminal: SUMIT should not retry.
- `200 { received, matched:false }` — no matching order; logged to `payment_events` for debugging.
- `401` — bad/missing `SUMIT_WEBHOOK_SECRET`.
- `500` — transient verify error (SUMIT unreachable). SUMIT may retry.

## Invoice / receipt

SUMIT issues the receipt/invoice document for the payment. The `Payment` object
itself carries **no** document reference, so the document id reaches us via:
- the **trigger** payload as `EntityID` (the document's SUMIT id), or
- the **redirect** return as `OG-DocumentID` (when present).

At settle time we resolve the PDF link with
`/accounting/documents/getdetails/` → `DocumentDownloadURL` and store the id +
URL on the order (`orders.document_id` / `orders.document_url`, migration `030`).

- Buyers see it under **My Account → הרכישות שלי**; admins under **Admin → רכישות**
  and inside each user's popup on **Admin → משתמשים**.
- Every row opens a **purchase card** popup (`GET /api/account/orders/{id}`) with
  the full order + live SUMIT payment data (status, auth number, payment date,
  amounts, ids) and an invoice download button. Owner-or-admin authorized.
- Direct download route: `GET /api/account/orders/{public_order_id}/invoice`
  (owner or admin; redirects to the SUMIT PDF, resolving a fresh URL on demand if
  one wasn't captured at settle time).
