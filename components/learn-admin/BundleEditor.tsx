'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, ExternalLink, Search, Check } from 'lucide-react';
import FileUpload from './FileUpload';
import SaveIndicator, { type SaveState } from './SaveIndicator';
import AccessControlFields from './AccessControlFields';
import type {
  AccessLevel,
  BundleWithCourses,
  CatalogVisibility,
  ContentStatus,
} from '@/lib/learn/types';

export type CourseOption = { id: string; title: string; slug: string; status: ContentStatus };

type Props = { initial: BundleWithCourses; courseOptions: CourseOption[] };

export default function BundleEditor({ initial, courseOptions }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [tagline, setTagline] = useState(initial.tagline ?? '');
  const [description, setDescription] = useState(initial.description ?? '');
  const [coverUrl, setCoverUrl] = useState(initial.cover_url ?? '');
  const [coverSquareUrl, setCoverSquareUrl] = useState(initial.cover_square_url ?? '');
  const [status, setStatus] = useState(initial.status);
  // Access model (migration 018)
  const [accessLevel, setAccessLevel] = useState<AccessLevel>(initial.access_level ?? 'open');
  const [catalogVisibility, setCatalogVisibility] = useState<CatalogVisibility>(initial.catalog_visibility ?? 'public');
  const [previewEnabled, setPreviewEnabled] = useState(initial.preview_enabled ?? false);
  const [priceAmount, setPriceAmount] = useState<string>(initial.price_amount != null ? String(initial.price_amount) : '');
  const [saleAmount, setSaleAmount] = useState<string>(initial.sale_amount != null ? String(initial.sale_amount) : '');
  const [priceCurrency, setPriceCurrency] = useState(initial.price_currency ?? 'ILS');
  // Bundle composition (migration 036) — ordered course ids.
  const [courseIds, setCourseIds] = useState<string[]>(initial.courses.map((c) => c.id));
  const [courseFilter, setCourseFilter] = useState('');

  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [slug, setSlug] = useState(initial.slug);
  const [slugSaving, setSlugSaving] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);
  const dirty = useRef(false);
  const saveTimer = useRef<NodeJS.Timeout | null>(null);

  const buildMeta = useCallback((extra?: Record<string, unknown>) => ({
    title,
    tagline: tagline || null,
    description: description || null,
    cover_url: coverUrl || null,
    cover_square_url: coverSquareUrl || null,
    access_level: accessLevel,
    catalog_visibility: catalogVisibility,
    preview_enabled: previewEnabled,
    price_amount: accessLevel === 'purchase_required' && priceAmount ? Number(priceAmount) : null,
    sale_amount: accessLevel === 'purchase_required' && saleAmount ? Number(saleAmount) : null,
    price_currency: priceCurrency,
    course_ids: courseIds,
    ...extra,
  }), [title, tagline, description, coverUrl, coverSquareUrl, accessLevel, catalogVisibility, previewEnabled, priceAmount, saleAmount, priceCurrency, courseIds]);

  const persist = useCallback(async (payload: Record<string, unknown>) => {
    setSaveState('saving');
    try {
      const res = await fetch(`/api/content/bundle/${initial.slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { setSaveState('error'); return false; }
      setSaveState('saved');
      dirty.current = false;
      return true;
    } catch {
      setSaveState('error');
      return false;
    }
  }, [initial.slug]);

  useEffect(() => {
    if (!dirty.current) { dirty.current = true; return; }
    setSaveState('dirty');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { persist(buildMeta()); }, 1200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, tagline, description, coverUrl, coverSquareUrl, accessLevel, catalogVisibility, previewEnabled, priceAmount, saleAmount, priceCurrency, courseIds]);

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  const saveNow = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    void persist(buildMeta());
  }, [persist, buildMeta]);

  async function togglePublish() {
    const next = status === 'published' ? 'draft' : 'published';
    const ok = await persist(buildMeta({ status: next }));
    if (ok) setStatus(next);
  }

  async function updateSlug() {
    const desired = slug.trim();
    if (!desired || desired === initial.slug) return;
    setSlugSaving(true);
    setSlugError(null);
    try {
      const res = await fetch(`/api/content/bundle/${initial.slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: desired }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSlugError(data?.message ?? 'שגיאה בעדכון הקישור');
        setSlugSaving(false);
        return;
      }
      const newSlug = data.item?.slug ?? desired;
      router.replace(window.location.pathname.replace(`/${initial.slug}`, `/${newSlug}`));
    } catch {
      setSlugError('שגיאת רשת');
      setSlugSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('למחוק את המוצר לצמיתות? הקורסים עצמם לא יימחקו — רק החבילה.')) return;
    const res = await fetch(`/api/content/bundle/${initial.slug}`, { method: 'DELETE' });
    if (res.ok) router.push('/admin/products');
  }

  function toggleCourse(id: string) {
    setCourseIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const filteredCourses = useMemo(() => {
    const q = courseFilter.trim().toLowerCase();
    if (!q) return courseOptions;
    return courseOptions.filter((c) => c.title.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q));
  }, [courseOptions, courseFilter]);

  return (
    <div className="space-y-6">
      <header className="bg-white rounded-2xl border border-neutral-200 p-5">
        <div className="flex items-start gap-4 justify-between mb-4">
          <div className="flex-1">
            <span className="inline-block mb-2 px-2 py-0.5 rounded-pill text-[11px] font-semibold bg-brand-purple-100 text-brand-purple-800">
              באנדל
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-2xl font-extrabold text-neutral-950 bg-transparent border-0 focus:outline-none focus:bg-neutral-50 rounded px-2 -mx-2 py-1"
            />
            <input
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="תיאור קצר"
              className="mt-2 w-full text-sm text-neutral-600 bg-transparent border-0 focus:outline-none focus:bg-neutral-50 rounded px-2 -mx-2 py-1"
            />
          </div>
          <div className="flex flex-col items-end gap-2">
            <SaveIndicator state={saveState} onForceSave={saveNow} />
            <a
              href={`/learn/bundles/${initial.slug}`}
              target="_blank"
              rel="noopener"
              className="flex items-center gap-1 text-xs text-neutral-500 hover:text-brand-purple-700"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              צפה כלקוח
            </a>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-neutral-100">
          <button
            type="button"
            onClick={togglePublish}
            className={[
              'px-4 py-1.5 rounded-pill text-xs font-semibold transition-colors',
              status === 'published' ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-brand-purple-700 text-white hover:bg-brand-purple-600',
            ].join(' ')}
          >
            {status === 'published' ? '✓ פורסם — לחץ לביטול' : 'פרסם'}
          </button>

          <button
            type="button"
            onClick={handleDelete}
            className="ms-auto flex items-center gap-1 text-xs text-neutral-400 hover:text-red-600"
          >
            <Trash2 className="w-3.5 h-3.5" />
            מחק מוצר
          </button>
        </div>
      </header>

      <section className="bg-white rounded-2xl border border-neutral-200 p-5">
        <h2 className="text-sm font-extrabold text-neutral-700 uppercase tracking-wide mb-3">מטא-דאטה</h2>

        {/* Slug (URL) */}
        <div className="mb-4 pb-4 border-b border-neutral-100">
          <label className="block text-xs font-semibold text-neutral-600 mb-1">כתובת המוצר (Slug)</label>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-neutral-400 font-mono" dir="ltr">/learn/bundles/</span>
            <input
              value={slug}
              onChange={(e) => { setSlug(e.target.value); setSlugError(null); }}
              dir="ltr"
              placeholder="bundle-slug"
              className="flex-1 min-w-[180px] px-3 py-2 rounded-md border border-neutral-200 focus:border-brand-purple-400 focus:outline-none text-sm font-mono"
            />
            <button
              type="button"
              onClick={updateSlug}
              disabled={slugSaving || !slug.trim() || slug.trim() === initial.slug}
              className="px-3 py-2 rounded-pill text-xs font-semibold bg-brand-purple-700 text-white hover:bg-brand-purple-600 disabled:bg-neutral-300 transition-colors"
            >
              {slugSaving ? 'מעדכן…' : 'עדכן קישור'}
            </button>
          </div>
          {slugError ? (
            <p className="mt-1.5 text-[11px] text-red-600">{slugError}</p>
          ) : (
            <p className="mt-1.5 text-[11px] text-amber-600">שינוי הקישור ישבור קישורים קיימים למוצר זה.</p>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1">תיאור ארוך</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-md border border-neutral-200 focus:border-brand-purple-400 focus:outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1">תמונת קאבר</label>
            <FileUpload
              bucket="covers"
              preview={coverUrl}
              onUploaded={(r) => {
                setCoverUrl(r.url);
                setCoverSquareUrl(r.squareUrl ?? '');
              }}
            />
          </div>
        </div>
      </section>

      <AccessControlFields
        accessLevel={accessLevel}
        onAccessLevel={setAccessLevel}
        catalogVisibility={catalogVisibility}
        onCatalogVisibility={setCatalogVisibility}
        previewEnabled={previewEnabled}
        onPreviewEnabled={setPreviewEnabled}
        priceAmount={priceAmount}
        onPriceAmount={setPriceAmount}
        saleAmount={saleAmount}
        onSaleAmount={setSaleAmount}
        priceCurrency={priceCurrency}
        onPriceCurrency={setPriceCurrency}
      />

      <section className="bg-white rounded-2xl border border-neutral-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-extrabold text-neutral-700 uppercase tracking-wide">
            קורסים בחבילה <span className="text-neutral-400 font-normal">({courseIds.length})</span>
          </h2>
        </div>
        <p className="text-xs text-neutral-500 mb-3">
          בחר את הקורסים שהלקוח יקבל אליהם גישה אוטומטית עם רכישת החבילה.
        </p>

        <div className="relative mb-3">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            placeholder="חיפוש קורס…"
            className="w-full pr-9 pl-3 py-2 rounded-md border border-neutral-200 focus:border-brand-purple-400 focus:outline-none text-sm"
          />
        </div>

        {courseOptions.length === 0 ? (
          <p className="text-sm text-neutral-500 py-4 text-center">אין קורסים זמינים. צור קורס תחילה.</p>
        ) : (
          <div className="max-h-80 overflow-y-auto rounded-lg border border-neutral-200 divide-y divide-neutral-100">
            {filteredCourses.map((c) => {
              const selected = courseIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCourse(c.id)}
                  className={[
                    'w-full flex items-center gap-3 px-3 py-2.5 text-right transition-colors',
                    selected ? 'bg-brand-purple-50/70 hover:bg-brand-purple-50' : 'hover:bg-neutral-50',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'flex items-center justify-center w-5 h-5 rounded-md border shrink-0',
                      selected ? 'bg-brand-purple-700 border-brand-purple-700 text-white' : 'border-neutral-300 text-transparent',
                    ].join(' ')}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-neutral-900 truncate">{c.title}</span>
                    <span className="block text-[11px] text-neutral-400 font-mono truncate" dir="ltr">{c.slug}</span>
                  </span>
                  {c.status !== 'published' && (
                    <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 rounded-pill px-1.5 py-0.5 shrink-0">טיוטה</span>
                  )}
                </button>
              );
            })}
            {filteredCourses.length === 0 && (
              <p className="text-sm text-neutral-500 py-4 text-center">לא נמצאו קורסים תואמים.</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
