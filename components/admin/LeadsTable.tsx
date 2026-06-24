'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { X, Download, Search, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import type { LeadListRow, LeadStatus, LeadDetail } from '@/lib/learn/leads';

const LEAD_STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: 'new', label: 'חדש' },
  { value: 'registered', label: 'נרשם' },
  { value: 'active_learner', label: 'לומד פעיל' },
  { value: 'purchased', label: 'רכש' },
  { value: 'inactive', label: 'לא פעיל' },
];

const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: 'חדש',
  registered: 'נרשם',
  active_learner: 'לומד פעיל',
  purchased: 'רכש',
  inactive: 'לא פעיל',
};

const LEAD_STATUS_CLS: Record<LeadStatus, string> = {
  new: 'bg-brand-blue-100 text-brand-blue-700',
  registered: 'bg-brand-purple-100 text-brand-purple-800',
  active_learner: 'bg-indigo-100 text-indigo-800',
  purchased: 'bg-emerald-100 text-emerald-800',
  inactive: 'bg-neutral-100 text-neutral-600',
};

type SortKey = 'created_at' | 'last_activity_at' | 'lead_status' | 'full_name' | 'utm_source';

function formatDate(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('he-IL', { dateStyle: 'short' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatDateTime(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('he-IL', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function statusBadge(status: LeadStatus) {
  const cls = LEAD_STATUS_CLS[status] ?? 'bg-neutral-100 text-neutral-600';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-pill text-[11px] font-semibold ${cls}`}>
      {LEAD_STATUS_LABEL[status] ?? status}
    </span>
  );
}

export default function LeadsTable({ utmSources }: { utmSources: string[] }) {
  const [rows, setRows] = useState<LeadListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [utmFilter, setUtmFilter] = useState<string>('');
  const [sort, setSort] = useState<SortKey>('created_at');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');

  const [openId, setOpenId] = useState<string | null>(null);

  // Debounce search input.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('q', debouncedSearch);
    if (statusFilter) params.set('status', statusFilter);
    if (utmFilter) params.set('utm_source', utmFilter);
    params.set('sort', sort);
    params.set('order', order);
    params.set('limit', '500');

    try {
      const res = await fetch(`/api/admin/leads?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) {
        setError(res.status === 403 ? 'אין הרשאת אדמין' : 'שגיאה בטעינת הנתונים');
        setRows([]);
        setLoading(false);
        return;
      }
      const data = (await res.json()) as { rows: LeadListRow[]; total: number };
      setRows(data.rows ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setError('שגיאת רשת');
      setRows([]);
    }
    setLoading(false);
  }, [debouncedSearch, statusFilter, utmFilter, sort, order]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleSort(key: SortKey) {
    if (sort === key) {
      setOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSort(key);
      setOrder('desc');
    }
  }

  const exportHref = useMemo(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (utmFilter) params.set('utm_source', utmFilter);
    const qs = params.toString();
    return `/api/admin/leads/export${qs ? `?${qs}` : ''}`;
  }, [statusFilter, utmFilter]);

  function updateRowStatus(id: string, leadStatus: LeadStatus) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, lead_status: leadStatus } : r)));
  }

  const SortHeader = ({ label, sortKey }: { label: string; sortKey: SortKey }) => {
    const active = sort === sortKey;
    const Icon = !active ? ArrowUpDown : order === 'asc' ? ArrowUp : ArrowDown;
    return (
      <th className="text-right px-4 py-3 font-semibold">
        <button
          type="button"
          onClick={() => toggleSort(sortKey)}
          className={`inline-flex items-center gap-1 ${active ? 'text-brand-purple-700' : 'hover:text-neutral-800'}`}
        >
          {label}
          <Icon className="w-3 h-3" />
        </button>
      </th>
    );
  };

  return (
    <div dir="rtl">
      {/* Filters */}
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <div className="relative w-full max-w-xs">
          <Search className="w-4 h-4 text-neutral-400 absolute top-1/2 -translate-y-1/2 right-3" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש לפי שם, מייל או טלפון..."
            className="w-full ps-3 pe-9 py-2 rounded-md border border-neutral-300 focus:border-brand-purple-400 focus:outline-none text-sm"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-md border border-neutral-300 focus:border-brand-purple-400 focus:outline-none text-sm bg-white"
        >
          <option value="">כל הסטטוסים</option>
          {LEAD_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          value={utmFilter}
          onChange={(e) => setUtmFilter(e.target.value)}
          className="px-3 py-2 rounded-md border border-neutral-300 focus:border-brand-purple-400 focus:outline-none text-sm bg-white"
        >
          <option value="">כל המקורות (utm_source)</option>
          <option value="__none__">ללא מקור</option>
          {utmSources.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => void load()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-pill border border-neutral-300 text-neutral-700 text-sm font-medium hover:bg-neutral-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          רענן
        </button>

        <a
          href={exportHref}
          className="ms-auto flex items-center gap-1.5 px-4 py-2 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-600 text-white text-sm font-semibold transition-colors"
        >
          <Download className="w-4 h-4" />
          ייצוא CSV
        </a>
      </div>

      <div className="mb-3 text-xs text-neutral-500">
        {loading ? 'טוען…' : `${total} לידים`}
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-neutral-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase">
            <tr>
              <SortHeader label="שם מלא" sortKey="full_name" />
              <th className="text-right px-4 py-3 font-semibold">מייל</th>
              <th className="text-right px-4 py-3 font-semibold">טלפון</th>
              <SortHeader label="נרשם" sortKey="created_at" />
              <th className="text-right px-4 py-3 font-semibold">ספק</th>
              <SortHeader label="סטטוס ליד" sortKey="lead_status" />
              <th className="text-right px-4 py-3 font-semibold">שיווק</th>
              <th className="text-right px-4 py-3 font-semibold">מקור</th>
              <SortHeader label="utm_source" sortKey="utm_source" />
              <th className="text-right px-4 py-3 font-semibold">רשום</th>
              <th className="text-right px-4 py-3 font-semibold">רכישות</th>
              <SortHeader label="פעילות אחרונה" sortKey="last_activity_at" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                onClick={() => setOpenId(r.id)}
                className="border-t border-neutral-100 hover:bg-brand-purple-50/50 cursor-pointer"
              >
                <td className="px-4 py-3 font-medium text-neutral-900">{r.full_name || '—'}</td>
                <td className="px-4 py-3 text-neutral-600 text-xs" dir="ltr">
                  {r.email || '—'}
                </td>
                <td className="px-4 py-3 text-neutral-600 text-xs" dir="ltr">
                  {r.phone || '—'}
                </td>
                <td className="px-4 py-3 text-neutral-500 text-xs">{formatDate(r.created_at)}</td>
                <td className="px-4 py-3 text-neutral-500 text-xs">{r.auth_provider || '—'}</td>
                <td className="px-4 py-3">{statusBadge(r.lead_status)}</td>
                <td className="px-4 py-3 text-xs">
                  {r.marketing_consent ? (
                    <span className="text-emerald-700 font-semibold">כן</span>
                  ) : (
                    <span className="text-neutral-400">לא</span>
                  )}
                </td>
                <td className="px-4 py-3 text-neutral-500 text-xs">{r.registration_source || '—'}</td>
                <td className="px-4 py-3 text-neutral-500 text-xs">{r.utm_source || '—'}</td>
                <td className="px-4 py-3 text-neutral-700 text-xs">{r.enrolled_count}</td>
                <td className="px-4 py-3 text-neutral-700 text-xs">{r.purchased_count}</td>
                <td className="px-4 py-3 text-neutral-500 text-xs">{formatDate(r.last_activity_at)}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={12} className="px-4 py-12 text-center text-neutral-500">
                  לא נמצאו לידים.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {openId && (
        <LeadDetailPanel
          id={openId}
          onClose={() => setOpenId(null)}
          onStatusChange={updateRowStatus}
        />
      )}
    </div>
  );
}

function Field({ label, value, ltr }: { label: string; value: React.ReactNode; ltr?: boolean }) {
  return (
    <div>
      <div className="text-[11px] text-neutral-500">{label}</div>
      <div className="text-sm text-neutral-900 break-words" dir={ltr ? 'ltr' : undefined}>
        {value ?? '—'}
      </div>
    </div>
  );
}

function LeadDetailPanel({
  id,
  onClose,
  onStatusChange,
}: {
  id: string;
  onClose: () => void;
  onStatusChange: (id: string, status: LeadStatus) => void;
}) {
  const [detail, setDetail] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);

  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    fetch(`/api/admin/leads/${id}`, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(res.status === 403 ? 'אין הרשאה' : 'שגיאה');
        return (await res.json()) as LeadDetail;
      })
      .then((d) => {
        if (active) setDetail(d);
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  async function changeStatus(next: LeadStatus) {
    if (!detail) return;
    setSavingStatus(true);
    const res = await fetch(`/api/admin/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_status: next }),
    });
    setSavingStatus(false);
    if (res.ok) {
      setDetail((d) => (d ? { ...d, lead_status: next } : d));
      onStatusChange(id, next);
    } else {
      alert('עדכון הסטטוס נכשל');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-start" dir="rtl">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative h-full w-full max-w-lg bg-white shadow-xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-extrabold text-neutral-950">
            {detail?.full_name || 'פרטי ליד'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700"
            aria-label="סגור"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {loading && <div className="text-sm text-neutral-500">טוען…</div>}
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
          )}

          {detail && (
            <>
              {/* Status control */}
              <div className="rounded-2xl border border-neutral-200 p-4">
                <div className="text-xs font-semibold text-neutral-600 mb-2">סטטוס ליד</div>
                <div className="flex items-center gap-3">
                  <select
                    value={detail.lead_status}
                    disabled={savingStatus}
                    onChange={(e) => void changeStatus(e.target.value as LeadStatus)}
                    className="px-3 py-2 rounded-md border border-neutral-300 focus:border-brand-purple-400 focus:outline-none text-sm bg-white disabled:opacity-50"
                  >
                    {LEAD_STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {statusBadge(detail.lead_status)}
                  {savingStatus && <span className="text-xs text-neutral-400">שומר…</span>}
                </div>
              </div>

              {/* Contact + counts */}
              <section>
                <h3 className="text-sm font-bold text-neutral-800 mb-3">פרטי קשר ופעילות</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <Field label="מייל" value={detail.email} ltr />
                  <Field label="טלפון" value={detail.phone} ltr />
                  <Field label="ספק התחברות" value={detail.auth_provider} />
                  <Field label="תאריך הרשמה" value={formatDateTime(detail.created_at)} />
                  <Field label="פעילות אחרונה" value={formatDateTime(detail.last_activity_at)} />
                  <Field label="התקדמות (שיעורים)" value={detail.progress_count} />
                  <Field label="הסכמת שיווק" value={detail.marketing_consent ? 'כן' : 'לא'} />
                  <Field label="אישור תקנון" value={formatDateTime(detail.terms_accepted_at)} />
                </div>
              </section>

              {/* Attribution */}
              <section>
                <h3 className="text-sm font-bold text-neutral-800 mb-3">ייחוס ומקורות</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <Field label="מקור הרשמה" value={detail.registration_source} />
                  <Field label="מפנה (referrer)" value={detail.referrer} ltr />
                  <Field label="פעולה מבוקשת" value={detail.intended_action} />
                  <Field label="utm_source" value={detail.utm_source} ltr />
                  <Field label="utm_medium" value={detail.utm_medium} ltr />
                  <Field label="utm_campaign" value={detail.utm_campaign} ltr />
                  <Field label="utm_content" value={detail.utm_content} ltr />
                </div>
              </section>

              {/* Touchpoints */}
              <section>
                <h3 className="text-sm font-bold text-neutral-800 mb-3">נקודות מגע ראשונות</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <Field label="הדרכה ראשונה" value={detail.first_guide_touchpoint} />
                  <Field label="יוצר ראשון" value={detail.first_creator_touchpoint} />
                  <Field label="קורס ראשון" value={detail.first_course_touchpoint} />
                </div>
              </section>

              {/* Enrolled courses */}
              <section>
                <h3 className="text-sm font-bold text-neutral-800 mb-3">
                  קורסים רשומים ({detail.enrolled_courses.length})
                </h3>
                {detail.enrolled_courses.length === 0 ? (
                  <p className="text-xs text-neutral-400">אין רישומים.</p>
                ) : (
                  <ul className="space-y-2">
                    {detail.enrolled_courses.map((c) => (
                      <li
                        key={c.content_item_id}
                        className="rounded-card border border-neutral-200 px-3 py-2 text-sm"
                      >
                        <div className="font-medium text-neutral-900">{c.title || c.slug || c.content_item_id}</div>
                        <div className="text-[11px] text-neutral-500 mt-0.5">
                          {c.type || 'תוכן'} · מקור: {c.source} · {formatDate(c.enrolled_at)}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Orders / purchases */}
              <section>
                <h3 className="text-sm font-bold text-neutral-800 mb-3">
                  רכישות ({detail.orders.length})
                </h3>
                {detail.orders.length === 0 ? (
                  <p className="text-xs text-neutral-400">אין רכישות.</p>
                ) : (
                  <ul className="space-y-2">
                    {detail.orders.map((o) => (
                      <li key={o.id} className="rounded-card border border-neutral-200 px-3 py-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-neutral-900" dir="ltr">
                            {o.public_order_id}
                          </span>
                          <span className="text-xs text-neutral-600">
                            {o.amount} {o.currency}
                          </span>
                        </div>
                        <div className="text-[11px] text-neutral-500 mt-0.5">
                          {o.content_type} · {o.status} · {formatDate(o.created_at)}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Entitlements */}
              <section>
                <h3 className="text-sm font-bold text-neutral-800 mb-3">
                  הרשאות גישה ({detail.entitlements.length})
                </h3>
                {detail.entitlements.length === 0 ? (
                  <p className="text-xs text-neutral-400">אין הרשאות.</p>
                ) : (
                  <ul className="space-y-2">
                    {detail.entitlements.map((ent) => (
                      <li key={ent.id} className="rounded-card border border-neutral-200 px-3 py-2 text-sm">
                        <div className="font-medium text-neutral-900">{ent.resource_type}</div>
                        <div className="text-[11px] text-neutral-500 mt-0.5">
                          מקור: {ent.source} · {ent.status} · {formatDate(ent.granted_at)}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
