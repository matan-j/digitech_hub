'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Download, Receipt, X, Loader2, CreditCard } from 'lucide-react';

// Row shape shared with lib/payments/purchase-history.ts (kept local to avoid a
// server-only import leaking into this client component).
export type PurchaseRow = {
  public_order_id: string;
  created_at: string;
  content_id: string;
  product_title: string;
  status: 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded';
  amount: number;
  currency: string;
  has_invoice: boolean;
  /** GROW payment link while the order is unpaid — for resuming payment. */
  checkout_url?: string | null;
  // Present only in the admin (all-users) view.
  user_email?: string | null;
  user_name?: string | null;
};

const STATUS_LABEL: Record<PurchaseRow['status'], string> = {
  pending: 'ממתין לתשלום',
  paid: 'שולם',
  failed: 'נכשל',
  cancelled: 'בוטל',
  refunded: 'זוכה',
};

const STATUS_CLS: Record<PurchaseRow['status'], string> = {
  pending: 'bg-amber-100 text-amber-800',
  paid: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-neutral-200 text-neutral-700',
  refunded: 'bg-indigo-100 text-indigo-800',
};

function formatDateTime(iso: string) {
  try {
    return new Intl.DateTimeFormat('he-IL', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatAmount(amount: number, currency: string) {
  if (currency === 'ILS') return `₪${amount.toLocaleString('he-IL')}`;
  return `${amount.toLocaleString('he-IL')} ${currency}`;
}

/**
 * Purchases / payment-attempts table. Used on the account page (own purchases),
 * the admin purchases console (showUser), and the admin user popup.
 */
export default function PurchasesTable({
  rows,
  showUser = false,
  emptyText = 'אין רכישות עדיין.',
  compact = false,
}: {
  rows: PurchaseRow[];
  showUser?: boolean;
  emptyText?: string;
  compact?: boolean;
}) {
  const [detailId, setDetailId] = useState<string | null>(null);

  if (rows.length === 0) {
    return <p className="text-sm text-neutral-500 py-4">{emptyText}</p>;
  }

  const cell = compact ? 'px-3 py-2' : 'px-4 py-3';

  return (
    <>
      {detailId && <PurchaseDetailModal key={detailId} publicOrderId={detailId} onClose={() => setDetailId(null)} />}

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase">
            <tr>
              <th className={`text-right ${cell} font-semibold`}>מזהה</th>
              {showUser && <th className={`text-right ${cell} font-semibold`}>לקוח</th>}
              <th className={`text-right ${cell} font-semibold`}>תאריך ושעה</th>
              <th className={`text-right ${cell} font-semibold`}>מוצר</th>
              <th className={`text-right ${cell} font-semibold`}>סטטוס</th>
              <th className={`text-right ${cell} font-semibold`}>סכום</th>
              <th className={`text-right ${cell} font-semibold`}>חשבונית / תשלום</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.public_order_id}
                onClick={() => setDetailId(r.public_order_id)}
                className="border-t border-neutral-100 hover:bg-brand-purple-50/50 cursor-pointer transition-colors"
              >
                <td className={`${cell} font-mono text-[11px] text-neutral-600`} dir="ltr">{r.public_order_id}</td>
                {showUser && (
                  <td className={cell}>
                    <div className="font-medium text-neutral-900">{r.user_name || '—'}</div>
                    <div className="text-[11px] text-neutral-500" dir="ltr">{r.user_email || ''}</div>
                  </td>
                )}
                <td className={`${cell} text-neutral-600 whitespace-nowrap`}>{formatDateTime(r.created_at)}</td>
                <td className={`${cell} text-neutral-900`}>
                  <div>{r.product_title}</div>
                  <div className="font-mono text-[11px] text-neutral-500" dir="ltr">{r.content_id}</div>
                </td>
                <td className={cell}>
                  <span className={`inline-block px-2 py-0.5 rounded-pill text-[11px] font-semibold ${STATUS_CLS[r.status]}`}>
                    {STATUS_LABEL[r.status]}
                  </span>
                </td>
                <td className={`${cell} font-semibold text-neutral-900 whitespace-nowrap`}>{formatAmount(r.amount, r.currency)}</td>
                <td className={cell}>
                  {r.status !== 'paid' && r.checkout_url ? (
                    <a
                      href={r.checkout_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-brand-purple-700 hover:text-brand-purple-600 font-semibold text-xs"
                      aria-label="המשך לתשלום"
                      title="המשך לתשלום"
                    >
                      <CreditCard className="w-4 h-4" />
                    </a>
                  ) : r.has_invoice ? (
                    <a
                      href={`/api/account/orders/${encodeURIComponent(r.public_order_id)}/invoice`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-brand-purple-700 hover:text-brand-purple-600 font-semibold text-xs"
                      aria-label="הורד חשבונית"
                      title="הורד חשבונית"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  ) : (
                    <span className="inline-flex text-neutral-300" title="אין חשבונית">
                      <Receipt className="w-4 h-4" />
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ---- Purchase detail ("purchase card") popup ------------------------------

type OrderDetail = {
  order: {
    public_order_id: string;
    status: PurchaseRow['status'];
    provider: string;
    created_at: string;
    updated_at: string;
    amount: number;
    original_amount: number | null;
    currency: string;
    content_type: string;
    product_title: string;
    provider_transaction_id: string | null;
    document_id: string | null;
    has_invoice: boolean;
    checkout_url: string | null;
  };
  customer: { name: string | null; email: string | null; phone: string | null };
  payment: {
    valid: boolean;
    status: string | null;
    statusDescription: string | null;
    authNumber: string | null;
    paymentDate: string | null;
    amount: number | null;
    currency: string | null;
    customerId: string | null;
    transactionId: string | null;
  } | null;
  paymentData?: {
    provider: string;
    received_at: string;
    status: string;
    fields: Record<string, string>;
  } | null;
};

// Hebrew labels for the GROW/Make success-webhook fields. Unknown keys fall back
// to the raw key, so EVERY field that came back is displayed.
const FIELD_LABELS: Record<string, string> = {
  order_number: 'מספר הזמנה',
  payment_amount: 'סכום',
  payment_status: 'סטטוס תשלום',
  payment_method: 'אמצעי תשלום',
  payment_type: 'סוג תשלום',
  payment_reference: 'אסמכתת תשלום',
  reference_number: 'מספר אסמכתא',
  process_id: 'מזהה תהליך',
  card_last4: '4 ספרות אחרונות',
  card_brand: 'סוג כרטיס',
  payer_name: 'שם המשלם',
  payer_email: 'אימייל',
  num_payments: 'מספר תשלומים',
  payment_date: 'תאריך תשלום',
};

function Row({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-neutral-100 last:border-0">
      <dt className="text-xs text-neutral-500 shrink-0">{label}</dt>
      <dd className={`text-sm text-neutral-900 text-left ${mono ? 'font-mono text-[12px]' : ''}`} dir={mono ? 'ltr' : 'rtl'}>{value}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
      <h3 className="text-xs font-extrabold text-neutral-700 uppercase tracking-wide mb-1.5">{title}</h3>
      <dl>{children}</dl>
    </div>
  );
}

export function PurchaseDetailModal({ publicOrderId, onClose }: { publicOrderId: string; onClose: () => void }) {
  const [data, setData] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/account/orders/${encodeURIComponent(publicOrderId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('load_failed'))))
      .then((d: OrderDetail) => { if (alive) setData(d); })
      .catch(() => { if (alive) setError('שגיאה בטעינת פרטי הרכישה.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [publicOrderId]);

  const o = data?.order;
  const p = data?.payment;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6"
        dir="rtl"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-extrabold text-neutral-950">כרטיס רכישה</h2>
            <span className="font-mono text-[11px] text-neutral-500" dir="ltr">{publicOrderId}</span>
          </div>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-neutral-700" aria-label="סגור">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-neutral-500 text-sm py-6">
            <Loader2 className="w-4 h-4 animate-spin" /> טוען…
          </div>
        ) : error ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">{error}</div>
        ) : o ? (
          <div className="space-y-4">
            <Section title="פרטי הזמנה">
              <Row label="סטטוס" value={<span className={`inline-block px-2 py-0.5 rounded-pill text-[11px] font-semibold ${STATUS_CLS[o.status]}`}>{STATUS_LABEL[o.status]}</span>} />
              <Row label="מוצר" value={o.product_title} />
              <Row label="סוג" value={o.content_type} />
              <Row label="נוצר" value={formatDateTime(o.created_at)} />
              <Row label="עודכן" value={formatDateTime(o.updated_at)} />
              <Row label="ספק תשלום" value={o.provider} mono />
              {o.status !== 'paid' && o.checkout_url && (
                <Row
                  label="לינק תשלום"
                  value={
                    <a href={o.checkout_url} target="_blank" rel="noopener noreferrer" className="text-brand-purple-700 hover:text-brand-purple-600 underline font-semibold">
                      פתח לינק תשלום
                    </a>
                  }
                />
              )}
            </Section>

            <Section title="סכומים">
              {o.original_amount != null && o.original_amount !== o.amount && (
                <Row label="מחיר מקורי" value={formatAmount(o.original_amount, o.currency)} />
              )}
              <Row label="סכום ששולם" value={formatAmount(o.amount, o.currency)} />
              <Row label="מטבע" value={o.currency} mono />
            </Section>

            <Section title="לקוח">
              <Row label="שם" value={data.customer.name} />
              <Row label="מייל" value={data.customer.email} mono />
              <Row label="טלפון" value={data.customer.phone} mono />
            </Section>

            {p && (
              <Section title="נתוני תשלום (SUMIT)">
                <Row label="תקין" value={p.valid ? 'כן' : 'לא'} />
                <Row label="סטטוס" value={p.statusDescription || p.status} />
                <Row label="מספר אישור" value={p.authNumber} mono />
                <Row label="תאריך תשלום" value={p.paymentDate ? formatDateTime(p.paymentDate) : null} />
                {p.amount != null && <Row label="סכום שחויב" value={formatAmount(p.amount, p.currency || o.currency)} />}
                <Row label="מזהה עסקה" value={o.provider_transaction_id} mono />
                {p.customerId && <Row label="מזהה לקוח SUMIT" value={p.customerId} mono />}
                <Row label="מזהה מסמך" value={o.document_id} mono />
              </Section>
            )}

            {data.paymentData && Object.keys(data.paymentData.fields).length > 0 && (
              <Section title="נתוני התשלום שהתקבלו">
                {Object.entries(data.paymentData.fields).map(([k, v]) => (
                  <Row key={k} label={FIELD_LABELS[k] ?? k} value={v} mono={!FIELD_LABELS[k]} />
                ))}
              </Section>
            )}

            {o.status !== 'paid' && o.checkout_url && (
              <a
                href={o.checkout_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-600 text-white text-sm font-semibold transition-colors"
              >
                <CreditCard className="w-4 h-4" />
                המשך לתשלום
              </a>
            )}

            {o.has_invoice && (
              <a
                href={`/api/account/orders/${encodeURIComponent(o.public_order_id)}/invoice`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-600 text-white text-sm font-semibold transition-colors"
              >
                <Download className="w-4 h-4" />
                הורד חשבונית
              </a>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
