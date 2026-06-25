'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, Loader2, Trash2, GraduationCap, User as UserIcon, Ticket } from 'lucide-react';

export type CouponRow = {
  id: string;
  code: string;
  internal_name: string | null;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  applies_to: 'all' | 'specific';
  customer_scope: 'all' | 'specific';
  one_time_scope: 'none' | 'global' | 'per_customer';
  valid_from: string | null;
  valid_until: string | null;
  is_redeemed: boolean;
  is_active: boolean;
  usage_count: number;
};

export type CourseOption = { id: string; title: string };
export type UserOption = { id: string; email: string; name: string | null };

const ONE_TIME_LABEL: Record<CouponRow['one_time_scope'], string> = {
  none: 'רב-פעמי',
  global: 'חד-פעמי (גלובלי)',
  per_customer: 'חד-פעמי לכל לקוח',
};

function discountLabel(c: Pick<CouponRow, 'discount_type' | 'discount_value'>) {
  return c.discount_type === 'percentage' ? `${c.discount_value}%` : `₪${Number(c.discount_value).toLocaleString('he-IL')}`;
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  try { return new Intl.DateTimeFormat('he-IL', { dateStyle: 'short' }).format(new Date(iso)); }
  catch { return iso; }
}

/** Effective status for the badge. */
function statusOf(c: CouponRow): { label: string; cls: string } {
  if (c.is_redeemed) return { label: 'מומש', cls: 'bg-neutral-200 text-neutral-700' };
  if (!c.is_active) return { label: 'לא פעיל', cls: 'bg-neutral-100 text-neutral-600' };
  if (c.valid_until && new Date(c.valid_until).getTime() < Date.now()) return { label: 'פג תוקף', cls: 'bg-amber-100 text-amber-800' };
  return { label: 'פעיל', cls: 'bg-emerald-100 text-emerald-800' };
}

export default function CouponsTable({
  coupons,
  courses,
  users,
}: {
  coupons: CouponRow[];
  courses: CourseOption[];
  users: UserOption[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<CouponRow | null>(null);

  const q = search.trim().toLowerCase();
  const filtered = coupons.filter(
    (c) => !q || c.code.toLowerCase().includes(q) || (c.internal_name ?? '').toLowerCase().includes(q),
  );

  return (
    <div>
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חיפוש לפי קוד או שם פנימי..."
          className="w-full max-w-sm px-3 py-2 rounded-md border border-neutral-300 focus:border-brand-purple-400 focus:outline-none text-sm"
        />
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="ms-auto flex items-center gap-1.5 px-4 py-2 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-600 text-white text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          קופון חדש
        </button>
      </div>

      {showCreate && (
        <CouponForm
          coupon={null}
          courses={courses}
          users={users}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); router.refresh(); }}
        />
      )}
      {editing && (
        <CouponForm
          coupon={editing}
          courses={courses}
          users={users}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); router.refresh(); }}
        />
      )}

      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase">
            <tr>
              <th className="text-right px-4 py-3 font-semibold">קוד</th>
              <th className="text-right px-4 py-3 font-semibold">שם פנימי</th>
              <th className="text-right px-4 py-3 font-semibold">הנחה</th>
              <th className="text-right px-4 py-3 font-semibold">חל על</th>
              <th className="text-right px-4 py-3 font-semibold">שימוש</th>
              <th className="text-right px-4 py-3 font-semibold">תוקף</th>
              <th className="text-right px-4 py-3 font-semibold">סטטוס</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const st = statusOf(c);
              return (
                <tr
                  key={c.id}
                  onClick={() => setEditing(c)}
                  className="border-t border-neutral-100 hover:bg-brand-purple-50/50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-mono font-semibold text-brand-purple-700" dir="ltr">{c.code}</td>
                  <td className="px-4 py-3 text-neutral-700">{c.internal_name || '—'}</td>
                  <td className="px-4 py-3 font-semibold text-neutral-900">{discountLabel(c)}</td>
                  <td className="px-4 py-3 text-neutral-600 text-xs">
                    {c.applies_to === 'all' ? 'כל המוצרים' : 'מוצרים נבחרים'}
                    {c.customer_scope === 'specific' && <span className="block text-neutral-400">לקוחות נבחרים</span>}
                  </td>
                  <td className="px-4 py-3 text-neutral-600 text-xs">
                    {c.usage_count}
                    <span className="text-neutral-400"> · {ONE_TIME_LABEL[c.one_time_scope]}</span>
                  </td>
                  <td className="px-4 py-3 text-neutral-500 text-xs">{c.valid_until ? `עד ${formatDate(c.valid_until)}` : 'ללא הגבלה'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-pill text-[11px] font-semibold ${st.cls}`}>{st.label}</span>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-neutral-500">לא נמצאו קופונים.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- dropdown + tags picker (mirrors the user→course assignment UI) ----------

function TagPicker({
  options,
  selectedIds,
  onChange,
  placeholder,
  emptyText,
  Icon,
}: {
  options: { id: string; label: string }[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder: string;
  emptyText: string;
  Icon: typeof GraduationCap;
}) {
  const selected = new Set(selectedIds);
  const available = options.filter((o) => !selected.has(o.id));
  const chosen = selectedIds
    .map((id) => options.find((o) => o.id === id))
    .filter((o): o is { id: string; label: string } => Boolean(o));

  return (
    <>
      <select
        value=""
        onChange={(e) => { const v = e.target.value; if (v) onChange([...selectedIds, v]); }}
        disabled={available.length === 0}
        className="w-full px-3 py-2 rounded-md border border-neutral-300 focus:border-brand-purple-400 focus:outline-none text-sm bg-white disabled:bg-neutral-50 disabled:text-neutral-400"
      >
        <option value="">{available.length === 0 ? 'הכל נבחרו' : placeholder}</option>
        {available.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
      <div className="mt-3 flex flex-wrap gap-2">
        {chosen.length === 0 ? (
          <p className="text-sm text-neutral-500">{emptyText}</p>
        ) : (
          chosen.map((o) => (
            <span
              key={o.id}
              className="inline-flex items-center gap-1.5 ps-3 pe-1.5 py-1 rounded-pill bg-brand-purple-100 text-brand-purple-800 text-xs font-semibold"
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="max-w-[200px] truncate">{o.label}</span>
              <button
                type="button"
                onClick={() => onChange(selectedIds.filter((id) => id !== o.id))}
                className="ms-0.5 grid place-items-center w-5 h-5 rounded-full hover:bg-brand-purple-200"
                aria-label={`הסר ${o.label}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))
        )}
      </div>
    </>
  );
}

// ---- create / edit form ------------------------------------------------------

const inputCls = 'w-full px-3 py-2 rounded-md border border-neutral-300 focus:border-brand-purple-400 focus:outline-none text-sm';
const labelCls = 'block text-xs font-semibold text-neutral-600 mb-1';

// timestamptz → value for <input type="datetime-local"> (local, no seconds).
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return ''; }
}

function CouponForm({
  coupon,
  courses,
  users,
  onClose,
  onSaved,
}: {
  coupon: CouponRow | null;
  courses: CourseOption[];
  users: UserOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(coupon);
  const [code, setCode] = useState(coupon?.code ?? '');
  const [internalName, setInternalName] = useState(coupon?.internal_name ?? '');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed_amount'>(coupon?.discount_type ?? 'percentage');
  const [discountValue, setDiscountValue] = useState<string>(coupon ? String(coupon.discount_value) : '');
  const [appliesTo, setAppliesTo] = useState<'all' | 'specific'>(coupon?.applies_to ?? 'all');
  const [productIds, setProductIds] = useState<string[]>([]);
  const [customerScope, setCustomerScope] = useState<'all' | 'specific'>(coupon?.customer_scope ?? 'all');
  const [customerIds, setCustomerIds] = useState<string[]>([]);
  const [oneTimeScope, setOneTimeScope] = useState<CouponRow['one_time_scope']>(coupon?.one_time_scope ?? 'none');
  const [validFrom, setValidFrom] = useState(toLocalInput(coupon?.valid_from ?? null));
  const [validUntil, setValidUntil] = useState(toLocalInput(coupon?.valid_until ?? null));
  const [isActive, setIsActive] = useState(coupon?.is_active ?? true);

  const [loadingLinks, setLoadingLinks] = useState(isEdit);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the existing product / customer links when editing.
  useEffect(() => {
    if (!coupon) return;
    let alive = true;
    (async () => {
      const res = await fetch(`/api/admin/coupons/${coupon.id}`);
      if (!alive) return;
      if (res.ok) {
        const d = await res.json();
        setProductIds(d.product_ids ?? []);
        setCustomerIds(d.customer_ids ?? []);
      }
      setLoadingLinks(false);
    })();
    return () => { alive = false; };
  }, [coupon]);

  async function submit() {
    setError(null);
    const value = Number(discountValue);
    if (!/^[A-Z0-9._-]{2,40}$/.test(code.trim().toUpperCase())) { setError('קוד לא תקין — אותיות גדולות/ספרות בלבד (2–40 תווים).'); return; }
    if (!Number.isFinite(value) || value <= 0) { setError('ערך ההנחה חייב להיות גדול מ-0.'); return; }
    if (discountType === 'percentage' && value > 100) { setError('אחוז הנחה לא יכול לעלות על 100.'); return; }

    setBusy(true);
    const payload = {
      code: code.trim().toUpperCase(),
      internal_name: internalName.trim() || null,
      discount_type: discountType,
      discount_value: value,
      applies_to: appliesTo,
      customer_scope: customerScope,
      one_time_scope: oneTimeScope,
      valid_from: validFrom || null,
      valid_until: validUntil || null,
      is_active: isActive,
      product_ids: appliesTo === 'specific' ? productIds : [],
      customer_ids: customerScope === 'specific' ? customerIds : [],
    };
    const res = await fetch(isEdit ? `/api/admin/coupons/${coupon!.id}` : '/api/admin/coupons', {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (res.ok) { onSaved(); return; }
    const d = await res.json().catch(() => ({}));
    setError(d.error === 'code_taken' ? 'הקוד כבר קיים. בחר קוד אחר.' : (d.message ?? 'שמירה נכשלה.'));
  }

  async function remove() {
    setBusy(true);
    const res = await fetch(`/api/admin/coupons/${coupon!.id}`, { method: 'DELETE' });
    setBusy(false);
    if (res.ok) onSaved();
    else setError('מחיקה נכשלה.');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6"
        dir="rtl"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-neutral-950">
            <Ticket className="w-5 h-5 text-brand-purple-700" />
            {isEdit ? 'עריכת קופון' : 'קופון חדש'}
          </h2>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-neutral-700" aria-label="סגור">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>קוד קופון (אותיות גדולות)</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="WELCOME20"
                dir="ltr"
                className={`${inputCls} font-mono uppercase text-left`}
              />
            </div>
            <div>
              <label className={labelCls}>שם פנימי (למנהלים בלבד)</label>
              <input
                type="text"
                value={internalName}
                onChange={(e) => setInternalName(e.target.value)}
                placeholder="קמפיין השקה"
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>סוג הנחה</label>
              <select value={discountType} onChange={(e) => setDiscountType(e.target.value as 'percentage' | 'fixed_amount')} className={`${inputCls} bg-white`}>
                <option value="percentage">אחוזים (%)</option>
                <option value="fixed_amount">סכום (₪)</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>{discountType === 'percentage' ? 'אחוז הנחה' : 'סכום הנחה (₪)'}</label>
              <input
                type="number"
                min={0}
                max={discountType === 'percentage' ? 100 : undefined}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={discountType === 'percentage' ? '20' : '50'}
                className={inputCls}
              />
            </div>
          </div>

          {/* Applies-to */}
          <div>
            <label className={labelCls}>חל על</label>
            <div className="flex gap-2 mb-2">
              {(['all', 'specific'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAppliesTo(v)}
                  className={[
                    'px-3 py-1.5 rounded-pill text-xs font-semibold border transition-colors',
                    appliesTo === v ? 'bg-brand-purple-700 text-white border-brand-purple-700' : 'border-neutral-300 text-neutral-700 hover:bg-neutral-50',
                  ].join(' ')}
                >
                  {v === 'all' ? 'כל המוצרים' : 'מוצרים נבחרים'}
                </button>
              ))}
            </div>
            {appliesTo === 'specific' && (
              loadingLinks ? (
                <div className="flex items-center gap-2 text-neutral-500 text-sm py-2"><Loader2 className="w-4 h-4 animate-spin" /> טוען…</div>
              ) : (
                <TagPicker
                  options={courses.map((c) => ({ id: c.id, label: c.title }))}
                  selectedIds={productIds}
                  onChange={setProductIds}
                  placeholder="בחר קורס לשיוך…"
                  emptyText="לא נבחרו מוצרים — בחר לפחות אחד."
                  Icon={GraduationCap}
                />
              )
            )}
          </div>

          {/* Customer scope */}
          <div>
            <label className={labelCls}>זמינות ללקוחות</label>
            <div className="flex gap-2 mb-2">
              {(['all', 'specific'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setCustomerScope(v)}
                  className={[
                    'px-3 py-1.5 rounded-pill text-xs font-semibold border transition-colors',
                    customerScope === v ? 'bg-brand-purple-700 text-white border-brand-purple-700' : 'border-neutral-300 text-neutral-700 hover:bg-neutral-50',
                  ].join(' ')}
                >
                  {v === 'all' ? 'כל הלקוחות' : 'לקוחות נבחרים'}
                </button>
              ))}
            </div>
            {customerScope === 'specific' && (
              loadingLinks ? (
                <div className="flex items-center gap-2 text-neutral-500 text-sm py-2"><Loader2 className="w-4 h-4 animate-spin" /> טוען…</div>
              ) : (
                <TagPicker
                  options={users.map((u) => ({ id: u.id, label: u.name ? `${u.name} · ${u.email}` : u.email }))}
                  selectedIds={customerIds}
                  onChange={setCustomerIds}
                  placeholder="בחר לקוח לשיוך…"
                  emptyText="לא נבחרו לקוחות — בחר לפחות אחד."
                  Icon={UserIcon}
                />
              )
            )}
          </div>

          {/* Usage limit + validity */}
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className={labelCls}>הגבלת שימוש</label>
              <select value={oneTimeScope} onChange={(e) => setOneTimeScope(e.target.value as CouponRow['one_time_scope'])} className={`${inputCls} bg-white`}>
                <option value="none">רב-פעמי (ללא הגבלה)</option>
                <option value="global">חד-פעמי — פעם אחת בסך הכל</option>
                <option value="per_customer">חד-פעמי — פעם אחת לכל לקוח</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>תקף מ-</label>
                <input type="datetime-local" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>תקף עד</label>
                <input type="datetime-local" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className={inputCls} />
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4 accent-brand-purple-700" />
            קופון פעיל
          </label>

          {isEdit && coupon!.is_redeemed && (
            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-2 text-xs text-neutral-600">
              קופון זה כבר מומש (חד-פעמי גלובלי) ולכן אינו פעיל.
            </div>
          )}

          {error && <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">{error}</div>}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className="flex-1 px-4 py-2 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-600 disabled:bg-neutral-300 text-white text-sm font-semibold transition-colors"
            >
              {busy ? 'שומר…' : isEdit ? 'שמור שינויים' : 'צור קופון'}
            </button>
            {isEdit && (
              confirmDelete ? (
                <button
                  type="button"
                  onClick={remove}
                  disabled={busy}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-pill bg-red-600 hover:bg-red-700 text-white text-sm font-semibold"
                >
                  <Trash2 className="w-4 h-4" /> לאשר מחיקה
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-pill border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" /> מחק
                </button>
              )
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-pill border border-neutral-300 text-neutral-700 text-sm font-semibold hover:bg-neutral-50"
            >
              בטל
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
