'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUp, ArrowDown, RotateCcw, Eye, GripVertical } from 'lucide-react';
import SaveIndicator, { type SaveState } from './SaveIndicator';
import {
  DEFAULT_SECTIONS,
  SECTION_META,
  type HomepageSection,
} from '@/lib/learn/homepage';

const inputCls =
  'w-full px-3 py-2 rounded-md border border-neutral-200 focus:border-brand-purple-400 focus:outline-none text-sm';

export default function HomepageStudio({ initial }: { initial: HomepageSection[] }) {
  const [sections, setSections] = useState<HomepageSection[]>(initial);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const dirty = useRef(false);
  const timer = useRef<NodeJS.Timeout | null>(null);

  const persist = useCallback(async (next: HomepageSection[]) => {
    setSaveState('saving');
    try {
      const res = await fetch('/api/admin/homepage', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sections: next }),
      });
      if (!res.ok) { setSaveState('error'); return; }
      setSaveState('saved');
      dirty.current = false;
    } catch {
      setSaveState('error');
    }
  }, []);

  const saveNow = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    void persist(sections);
  }, [persist, sections]);

  useEffect(() => {
    if (!dirty.current) { dirty.current = true; return; }
    setSaveState('dirty');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { persist(sections); }, 1000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function patch(idx: number, change: Partial<HomepageSection>) {
    setSections((prev) => prev.map((s, i) => (i === idx ? { ...s, ...change } : s)));
  }
  function move(idx: number, dir: -1 | 1) {
    setSections((prev) => {
      const j = idx + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }
  function resetDefaults() {
    if (!confirm('לאפס את עמוד הבית לברירת המחדל? כל ההתאמות יוחלפו.')) return;
    setSections(DEFAULT_SECTIONS.map((s) => ({ ...s })));
  }

  return (
    <div className="space-y-6">
      <header className="bg-white rounded-2xl border border-neutral-200 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-neutral-950">סטודיו עמוד הבית</h1>
            <p className="mt-1 text-sm text-neutral-500">
              שלוט בסקשנים של עמוד הבית — סדר, הפעלה/כיבוי, כותרות, קישורים וכמות פריטים. נשמר אוטומטית.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <SaveIndicator state={saveState} onForceSave={saveNow} />
            <a
              href="/"
              target="_blank"
              rel="noopener"
              className="flex items-center gap-1 text-xs text-neutral-500 hover:text-brand-purple-700"
            >
              <Eye className="w-3.5 h-3.5" />
              צפה בעמוד הבית
            </a>
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-neutral-100">
          <button
            type="button"
            onClick={resetDefaults}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill border border-neutral-300 text-xs font-semibold text-neutral-600 hover:border-brand-purple-400 hover:text-brand-purple-700 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            אפס לברירת מחדל
          </button>
        </div>
      </header>

      <ol className="space-y-3">
        {sections.map((s, idx) => {
          const meta = SECTION_META[s.type];
          return (
            <li
              key={s.key}
              className={[
                'bg-white rounded-2xl border p-5 transition-colors',
                s.enabled ? 'border-neutral-200' : 'border-dashed border-neutral-300 opacity-70',
              ].join(' ')}
            >
              <div className="flex items-center gap-3 mb-3">
                <GripVertical className="w-4 h-4 text-neutral-300 shrink-0" aria-hidden />
                <span className="flex-1 min-w-0">
                  <span className="text-xs font-bold text-neutral-400">{idx + 1}.</span>{' '}
                  <span className="font-extrabold text-neutral-900">{meta.label}</span>
                </span>

                <button
                  type="button"
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  className="p-1 text-neutral-400 hover:text-brand-purple-700 disabled:opacity-30 disabled:hover:text-neutral-400"
                  aria-label="הזז למעלה"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => move(idx, 1)}
                  disabled={idx === sections.length - 1}
                  className="p-1 text-neutral-400 hover:text-brand-purple-700 disabled:opacity-30 disabled:hover:text-neutral-400"
                  aria-label="הזז למטה"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>

                <label className="flex items-center gap-2 text-xs cursor-pointer ms-2">
                  <input
                    type="checkbox"
                    checked={s.enabled}
                    onChange={(e) => patch(idx, { enabled: e.target.checked })}
                    className="w-3.5 h-3.5 accent-brand-purple-700"
                  />
                  <span className="font-medium text-neutral-700">{s.enabled ? 'פעיל' : 'מוסתר'}</span>
                </label>
              </div>

              {(meta.hasCopy || meta.hasCta || meta.hasLimit) && (
                <div className="grid sm:grid-cols-2 gap-3 ps-7">
                  {(meta.hasCopy || s.title !== undefined) && (
                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-500 mb-1">כותרת</label>
                      <input
                        value={s.title ?? ''}
                        onChange={(e) => patch(idx, { title: e.target.value })}
                        placeholder="ברירת מחדל"
                        className={inputCls}
                      />
                    </div>
                  )}
                  {meta.hasLimit && (
                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-500 mb-1">מספר פריטים</label>
                      <input
                        type="number"
                        min={1}
                        max={24}
                        value={s.limit ?? ''}
                        onChange={(e) => patch(idx, { limit: e.target.value ? Number(e.target.value) : null })}
                        placeholder="ברירת מחדל"
                        className={inputCls}
                      />
                    </div>
                  )}
                  {meta.hasCopy && (
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-neutral-500 mb-1">טקסט משנה</label>
                      <textarea
                        value={s.subtitle ?? ''}
                        onChange={(e) => patch(idx, { subtitle: e.target.value })}
                        rows={2}
                        placeholder="ברירת מחדל"
                        className={inputCls}
                      />
                    </div>
                  )}
                  {meta.hasCta && (
                    <>
                      <div>
                        <label className="block text-[11px] font-semibold text-neutral-500 mb-1">טקסט כפתור</label>
                        <input
                          value={s.cta_label ?? ''}
                          onChange={(e) => patch(idx, { cta_label: e.target.value })}
                          placeholder="ברירת מחדל"
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-neutral-500 mb-1">קישור כפתור</label>
                        <input
                          value={s.cta_href ?? ''}
                          onChange={(e) => patch(idx, { cta_href: e.target.value })}
                          placeholder="/learn/courses"
                          dir="ltr"
                          className={`${inputCls} font-mono`}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
