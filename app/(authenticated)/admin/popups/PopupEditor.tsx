'use client';

import { useRef, useState } from 'react';
import { Upload, Eye, Loader2 } from 'lucide-react';
import {
  POPUP_CONTENT_TYPES,
  POPUP_TRIGGER_TYPES,
  POPUP_SCOPES,
  NEW_POPUP_DEFAULTS,
  type Popup,
  type PopupContentType,
  type PopupTriggerType,
  type PopupScope,
} from '@/lib/learn/popups';
import RichTextEditor from '@/components/popups/RichTextEditor';
import { PopupModal } from '@/components/popups/PopupView';

type Draft = Omit<Popup, 'id' | 'created_at' | 'updated_at'>;

function toDraft(p: Popup | null): Draft {
  if (!p) return { ...NEW_POPUP_DEFAULTS };
  const rest = { ...p } as Partial<Popup>;
  delete rest.id;
  delete rest.created_at;
  delete rest.updated_at;
  return rest as Draft;
}

/** timestamptz <-> <input type="datetime-local"> (local time, no seconds). */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const labelCls = 'block text-sm font-semibold text-neutral-800 mb-1.5';
const inputCls =
  'w-full px-3 py-2.5 rounded-md border border-neutral-300 focus:border-brand-purple-500 focus:outline-none text-sm';
const card = 'bg-white rounded-card border border-brand-purple-200 p-5 sm:p-6';

export default function PopupEditor({
  initial,
  onSaved,
  onCancel,
}: {
  initial: Popup | null;
  onSaved: (p: Popup) => void;
  onCancel: () => void;
}) {
  const [d, setD] = useState<Draft>(() => toDraft(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));

  async function uploadImage(file: File) {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/admin/popups/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? 'upload failed');
      set('image_url', data.url as string);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאת העלאה');
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setError(null);
    if (!d.name.trim()) {
      setError('יש להזין שם לפופאפ');
      return;
    }
    if (d.scope === 'page' && !d.target_path?.trim()) {
      setError('יש להזין נתיב עמוד כשהבחירה היא "עמוד ספציפי"');
      return;
    }
    setSaving(true);
    try {
      const url = initial ? `/api/admin/popups/${initial.id}` : '/api/admin/popups';
      const res = await fetch(url, {
        method: initial ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? 'save failed');
      onSaved(data.item as Popup);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שמירה נכשלה');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-sm px-4 py-2.5">
          {error}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-5">
        {/* ---------- left column ---------- */}
        <div className="space-y-5">
          <div className={card}>
            <h3 className="font-extrabold text-neutral-950 mb-4">תוכן</h3>
            <div className="mb-4">
              <label className={labelCls}>שם פנימי</label>
              <input
                className={inputCls}
                value={d.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="לדוגמה: מבצע קיץ — דף הבית"
              />
            </div>

            <div className="mb-4">
              <label className={labelCls}>סוג תוכן</label>
              <div className="flex flex-wrap gap-2">
                {POPUP_CONTENT_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => set('content_type', t.value as PopupContentType)}
                    className={[
                      'px-3.5 py-1.5 rounded-pill text-sm font-medium border transition-colors',
                      d.content_type === t.value
                        ? 'bg-brand-purple-700 text-white border-brand-purple-700'
                        : 'bg-white text-neutral-600 border-neutral-300 hover:border-brand-purple-400',
                    ].join(' ')}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* content-type specific fields */}
            {d.content_type === 'image' && (
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>תמונה</label>
                  {d.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.image_url} alt="" className="w-full max-h-48 object-contain rounded-md border border-neutral-200 mb-2 bg-neutral-50" />
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadImage(f);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-pill border border-neutral-300 hover:border-brand-purple-400 text-sm font-medium disabled:opacity-50"
                  >
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {d.image_url ? 'החלף תמונה' : 'העלה תמונה'}
                  </button>
                </div>
                <div>
                  <label className={labelCls}>פעולה בלחיצה על התמונה</label>

                  <label className="flex items-start gap-2.5 text-sm text-neutral-700 mb-2.5">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={d.image_link_auth}
                      onChange={(e) => {
                        const v = e.target.checked;
                        set('image_link_auth', v);
                        if (v) set('image_signup_form', false);
                      }}
                    />
                    <span>
                      פתח חלון הרשמה / התחברות בלחיצה
                      <span className="block text-xs text-neutral-400">
                        מוצג רק למשתמשים שאינם מחוברים. מחליף את הקישור למטה.
                      </span>
                    </span>
                  </label>

                  <label className="flex items-start gap-2.5 text-sm text-neutral-700 mb-3">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={d.image_signup_form}
                      onChange={(e) => {
                        const v = e.target.checked;
                        set('image_signup_form', v);
                        if (v) set('image_link_auth', false);
                      }}
                    />
                    <span>
                      הצג טופס הרשמה צמוד לתמונה
                      <span className="block text-xs text-neutral-400">
                        במחשב: תמונה מימין וטופס משמאל. במובייל: תמונה למעלה וטופס מתחת. בלי ללחוץ — מוצג רק למשתמשים שאינם מחוברים. לתצוגת צד-לצד במחשב מומלץ רוחב מקסימלי 720px ומעלה.
                      </span>
                    </span>
                  </label>

                  <input
                    className={`${inputCls} ${d.image_link_auth || d.image_signup_form ? 'opacity-50' : ''}`}
                    value={d.image_link ?? ''}
                    onChange={(e) => set('image_link', e.target.value || null)}
                    placeholder="קישור בלחיצה (אופציונלי) — https://..."
                    dir="ltr"
                    disabled={d.image_link_auth || d.image_signup_form}
                  />
                  {d.image_link && !d.image_link_auth && !d.image_signup_form && (
                    <label className="flex items-center gap-2 mt-2 text-sm text-neutral-600">
                      <input
                        type="checkbox"
                        checked={d.image_link_new_tab}
                        onChange={(e) => set('image_link_new_tab', e.target.checked)}
                      />
                      פתח בלשונית חדשה
                    </label>
                  )}
                </div>
              </div>
            )}

            {d.content_type === 'rich_text' && (
              <div>
                <label className={labelCls}>תוכן עשיר</label>
                <RichTextEditor value={d.html ?? ''} onChange={(html) => set('html', html)} />
              </div>
            )}

            {d.content_type === 'html' && (
              <div>
                <label className={labelCls}>קוד HTML</label>
                <textarea
                  className={`${inputCls} font-mono min-h-[160px]`}
                  dir="ltr"
                  value={d.html ?? ''}
                  onChange={(e) => set('html', e.target.value || null)}
                  placeholder="<div>...</div>"
                />
              </div>
            )}

            {d.content_type === 'iframe' && (
              <div>
                <label className={labelCls}>כתובת IFRAME</label>
                <input
                  className={inputCls}
                  dir="ltr"
                  value={d.iframe_url ?? ''}
                  onChange={(e) => set('iframe_url', e.target.value || null)}
                  placeholder="https://..."
                />
              </div>
            )}

            {d.content_type === 'video' && (
              <div>
                <label className={labelCls}>כתובת וידאו (YouTube / Vimeo / קובץ)</label>
                <input
                  className={inputCls}
                  dir="ltr"
                  value={d.video_url ?? ''}
                  onChange={(e) => set('video_url', e.target.value || null)}
                  placeholder="https://youtube.com/watch?v=..."
                />
              </div>
            )}
          </div>

          {/* appearance */}
          <div className={card}>
            <h3 className="font-extrabold text-neutral-950 mb-4">עיצוב</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>עיגול פינות: {d.corner_radius}px</label>
                <input
                  type="range"
                  min={0}
                  max={64}
                  value={d.corner_radius}
                  onChange={(e) => set('corner_radius', Number(e.target.value))}
                  className="w-full accent-brand-purple-700"
                />
              </div>
              <div>
                <label className={labelCls}>רוחב מקסימלי (px)</label>
                <input
                  type="number"
                  min={240}
                  max={1280}
                  className={inputCls}
                  value={d.max_width}
                  onChange={(e) => set('max_width', Number(e.target.value))}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ---------- right column ---------- */}
        <div className="space-y-5">
          {/* display conditions */}
          <div className={card}>
            <h3 className="font-extrabold text-neutral-950 mb-4">תנאי תצוגה</h3>

            <div className="mb-4">
              <label className={labelCls}>טריגר</label>
              <div className="grid grid-cols-[1fr_120px] gap-2">
                <select
                  className={inputCls}
                  value={d.trigger_type}
                  onChange={(e) => set('trigger_type', e.target.value as PopupTriggerType)}
                >
                  {POPUP_TRIGGER_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  className={inputCls}
                  value={d.trigger_value}
                  onChange={(e) => set('trigger_value', Number(e.target.value))}
                />
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                {d.trigger_type === 'time' ? 'הצג לאחר X שניות' : 'הצג לאחר X אחוז גלילה'}
              </p>
            </div>

            <div className="mb-4">
              <label className={labelCls}>היכן להציג</label>
              <select
                className={inputCls}
                value={d.scope}
                onChange={(e) => set('scope', e.target.value as PopupScope)}
              >
                {POPUP_SCOPES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              {d.scope === 'page' && (
                <input
                  className={`${inputCls} mt-2`}
                  dir="ltr"
                  value={d.target_path ?? ''}
                  onChange={(e) => set('target_path', e.target.value || null)}
                  placeholder="/learn/bundles"
                />
              )}
            </div>

            <div className="space-y-2.5 pt-1">
              <label className="flex items-center gap-2.5 text-sm text-neutral-700">
                <input type="checkbox" checked={d.logged_in_only} onChange={(e) => set('logged_in_only', e.target.checked)} />
                למשתמשים מחוברים בלבד
              </label>
              <label className="flex items-center gap-2.5 text-sm text-neutral-700">
                <input type="checkbox" checked={d.show_once} onChange={(e) => set('show_once', e.target.checked)} />
                הצג פעם אחת בלבד למשתמש
              </label>
              <label className="flex items-center gap-2.5 text-sm text-neutral-700">
                <input type="checkbox" checked={d.enabled} onChange={(e) => set('enabled', e.target.checked)} />
                פעיל
              </label>
            </div>
          </div>

          {/* scheduling */}
          <div className={card}>
            <h3 className="font-extrabold text-neutral-950 mb-4">תזמון</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>התחלה</label>
                <input
                  type="datetime-local"
                  className={inputCls}
                  value={toLocalInput(d.starts_at)}
                  onChange={(e) => set('starts_at', fromLocalInput(e.target.value))}
                />
              </div>
              <div>
                <label className={labelCls}>סיום</label>
                <input
                  type="datetime-local"
                  className={inputCls}
                  value={toLocalInput(d.ends_at)}
                  onChange={(e) => set('ends_at', fromLocalInput(e.target.value))}
                />
              </div>
            </div>
            <div className="mt-4">
              <label className={labelCls}>עדיפות (מספר גבוה מוצג קודם)</label>
              <input
                type="number"
                className={inputCls}
                value={d.priority}
                onChange={(e) => set('priority', Number(e.target.value))}
              />
            </div>
          </div>
        </div>
      </div>

      {/* actions */}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-600 text-white font-semibold disabled:opacity-50"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {initial ? 'שמור שינויים' : 'צור פופאפ'}
        </button>
        <button
          type="button"
          onClick={() => setPreview(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-pill border border-neutral-300 hover:border-brand-purple-400 font-medium"
        >
          <Eye className="w-4 h-4" /> תצוגה מקדימה
        </button>
        <button type="button" onClick={onCancel} className="px-5 py-2.5 rounded-pill text-neutral-600 hover:text-neutral-950 font-medium">
          ביטול
        </button>
      </div>

      {preview && (
        <PopupModal
          popup={d}
          onClose={() => setPreview(false)}
          signupRequest={{ action: 'popup_form_preview', returnTo: '/' }}
        />
      )}
    </div>
  );
}
