'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUp, ArrowDown, RotateCcw, Eye, GripVertical, Plus, Trash2 } from 'lucide-react';
import SaveIndicator, { type SaveState } from './SaveIndicator';
import InlineRichField from './InlineRichField';
import ValueProps from '@/components/learn/ValueProps';
import CreatorPills, { type PillCreator } from '@/components/learn/CreatorPills';
import { BENEFIT_ICONS } from '@/components/learn/benefit-icons';
import {
  DEFAULT_SECTIONS,
  DEFAULT_BENEFITS,
  SECTION_META,
  BENEFIT_ICON_KEYS,
  type HomepageSection,
  type BenefitItem,
  type BenefitIconKey,
} from '@/lib/learn/homepage';

const inputCls =
  'w-full px-3 py-2 rounded-md border border-neutral-200 focus:border-brand-purple-400 focus:outline-none text-sm';

function newBenefit(): BenefitItem {
  const key = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `b${Date.now()}`;
  return { key, icon: 'sparkles', title: '', body: '' };
}

export default function HomepageStudio({
  initial,
  creators,
}: {
  initial: HomepageSection[];
  creators: PillCreator[];
}) {
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
  /** Current benefit cards of a value_props section (materializing defaults). */
  function itemsOf(s: HomepageSection): BenefitItem[] {
    return s.items && s.items.length > 0 ? s.items : DEFAULT_BENEFITS;
  }
  function setItems(sIdx: number, next: BenefitItem[]) {
    patch(sIdx, { items: next });
  }
  function patchItem(sIdx: number, iIdx: number, change: Partial<BenefitItem>) {
    setSections((prev) =>
      prev.map((s, i) => {
        if (i !== sIdx) return s;
        const items = (s.items && s.items.length > 0 ? s.items : DEFAULT_BENEFITS).map((it, j) =>
          j === iIdx ? { ...it, ...change } : it,
        );
        return { ...s, items };
      }),
    );
  }
  function moveItem(sIdx: number, iIdx: number, dir: -1 | 1) {
    const items = [...itemsOf(sections[sIdx])];
    const j = iIdx + dir;
    if (j < 0 || j >= items.length) return;
    [items[iIdx], items[j]] = [items[j], items[iIdx]];
    setItems(sIdx, items);
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
                      <InlineRichField
                        value={s.subtitle ?? ''}
                        onChange={(v) => patch(idx, { subtitle: v })}
                        rows={2}
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

              {meta.hasItems && (
                <BenefitsEditor
                  items={itemsOf(s)}
                  onPatch={(iIdx, change) => patchItem(idx, iIdx, change)}
                  onMove={(iIdx, dir) => moveItem(idx, iIdx, dir)}
                  onRemove={(iIdx) => setItems(idx, itemsOf(s).filter((_, j) => j !== iIdx))}
                  onAdd={() => setItems(idx, [...itemsOf(s), newBenefit()])}
                />
              )}

              {s.type === 'featured_creators' && (
                <CreatorsPreview creators={creators} limit={s.limit ?? 8} />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Per-card editor for the value_props benefits, with a live homepage preview. */
function BenefitsEditor({
  items,
  onPatch,
  onMove,
  onRemove,
  onAdd,
}: {
  items: BenefitItem[];
  onPatch: (iIdx: number, change: Partial<BenefitItem>) => void;
  onMove: (iIdx: number, dir: -1 | 1) => void;
  onRemove: (iIdx: number) => void;
  onAdd: () => void;
}) {
  const MAX = 6;
  return (
    <div className="ps-7 mt-1 space-y-3">
      <p className="text-[11px] font-semibold text-neutral-500">כרטיסי יתרונות</p>

      {items.map((it, i) => (
        <div key={it.key} className="rounded-xl border border-neutral-200 p-3">
          <div className="flex items-start gap-3">
            <IconPicker value={it.icon} onChange={(icon) => onPatch(i, { icon })} />
            <div className="flex-1 min-w-0 space-y-2">
              <input
                value={it.title}
                onChange={(e) => onPatch(i, { title: e.target.value })}
                placeholder="כותרת הכרטיס"
                className={`${inputCls} font-semibold`}
              />
              <InlineRichField
                value={it.body}
                onChange={(v) => onPatch(i, { body: v })}
                rows={2}
                placeholder="תיאור קצר…"
              />
            </div>
            <div className="flex flex-col items-center gap-1 shrink-0">
              <button type="button" onClick={() => onMove(i, -1)} disabled={i === 0} aria-label="העבר למעלה" className="p-1 text-neutral-400 hover:text-brand-purple-700 disabled:opacity-30">
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => onMove(i, 1)} disabled={i === items.length - 1} aria-label="העבר למטה" className="p-1 text-neutral-400 hover:text-brand-purple-700 disabled:opacity-30">
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => onRemove(i)} disabled={items.length <= 1} aria-label="מחק כרטיס" className="p-1 text-neutral-400 hover:text-red-600 disabled:opacity-30">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={onAdd}
        disabled={items.length >= MAX}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill border border-neutral-300 text-xs font-semibold text-neutral-600 hover:border-brand-purple-400 hover:text-brand-purple-700 transition-colors disabled:opacity-40"
      >
        <Plus className="w-3.5 h-3.5" />
        הוסף יתרון
      </button>

      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
        <span className="block text-[11px] font-semibold text-neutral-500 mb-3">תצוגה מקדימה (כפי שמופיע בעמוד הבית)</span>
        <ValueProps items={items} />
      </div>
    </div>
  );
}

/** Grid of allowed lucide icons for a benefit card. */
function IconPicker({ value, onChange }: { value: BenefitIconKey; onChange: (icon: BenefitIconKey) => void }) {
  return (
    <div className="grid grid-cols-4 gap-1 shrink-0" style={{ width: '8.5rem' }}>
      {BENEFIT_ICON_KEYS.map((key) => {
        const Icon = BENEFIT_ICONS[key];
        const selected = key === value;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            title={key}
            aria-label={key}
            aria-pressed={selected}
            className={[
              'inline-flex items-center justify-center w-7 h-7 rounded-md border transition-colors',
              selected
                ? 'border-brand-purple-400 bg-brand-purple-50 text-brand-purple-700'
                : 'border-neutral-200 bg-white text-neutral-500 hover:border-brand-purple-300',
            ].join(' ')}
          >
            <Icon className="w-3.5 h-3.5" />
          </button>
        );
      })}
    </div>
  );
}

/** Faithful preview of the "Top Creators" pills — shows every active creator. */
function CreatorsPreview({ creators, limit }: { creators: PillCreator[]; limit: number }) {
  const shown = creators.slice(0, limit);
  return (
    <div className="ps-7 mt-1">
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
        <span className="block text-[11px] font-semibold text-neutral-500 mb-3">
          תצוגה מקדימה (כפי שמופיע בעמוד הבית)
        </span>
        {creators.length === 0 ? (
          <p className="text-sm text-neutral-500">
            אין יוצרים פעילים להצגה. צרו יוצרים והגדירו סטטוס &quot;פעיל&quot; בעמוד ניהול היוצרים.
          </p>
        ) : (
          <>
            <CreatorPills creators={shown} />
            <p className="mt-3 text-[11px] text-neutral-400">
              מוצגים {shown.length} מתוך {creators.length} יוצרים פעילים{' '}
              {creators.length > limit ? '(הגדילו את "מספר פריטים" כדי להציג עוד)' : ''}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
