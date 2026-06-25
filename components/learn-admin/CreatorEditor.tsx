'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, ExternalLink, LayoutDashboard, Info, User, Image as ImageIcon, FileText, Share2, ShieldCheck, Star, Search } from 'lucide-react';
import FileUpload from './FileUpload';
import SaveIndicator, { type SaveState } from './SaveIndicator';
import SocialLinks from '@/components/learn/SocialLinks';
import type { Creator } from '@/lib/learn/types';

type UserOption = { id: string; email: string | null };

const SOCIAL_FIELDS: { key: keyof Creator; label: string; placeholder: string }[] = [
  { key: 'website', label: 'אתר', placeholder: 'https://example.com' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/…' },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/…' },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@…' },
  { key: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@…' },
  { key: 'email', label: 'אימייל ציבורי', placeholder: 'name@example.com' },
  { key: 'contact_email', label: 'אימייל ליצירת קשר (פנימי)', placeholder: 'support@example.com' },
];

function SectionCard({ icon: Icon, title, hint, children }: { icon: typeof User; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-neutral-200 p-5">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-brand-purple-700" />
        <h2 className="text-sm font-extrabold text-neutral-800">{title}</h2>
      </div>
      {hint && <p className="text-xs text-neutral-500 mb-3">{hint}</p>}
      <div className={hint ? '' : 'mt-3'}>{children}</div>
    </section>
  );
}

export default function CreatorEditor({ initial, users }: { initial: Creator; users: UserOption[] }) {
  const router = useRouter();
  const [form, setForm] = useState<Creator>(initial);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const dirty = useRef(false);
  const timer = useRef<NodeJS.Timeout | null>(null);

  function set<K extends keyof Creator>(key: K, value: Creator[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const persist = useCallback(async (payload: Partial<Creator>) => {
    setSaveState('saving');
    try {
      const res = await fetch(`/api/admin/creators/${initial.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error('[creator:save]', res.status, body);
        setSaveState('error');
        return;
      }
      setSaveState('saved');
      dirty.current = false;
    } catch (err) {
      console.error('[creator:save:network]', err);
      setSaveState('error');
    }
  }, [initial.id]);

  useEffect(() => {
    if (!dirty.current) { dirty.current = true; return; }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaveState('dirty');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const { id, slug, created_at, updated_at, created_by, updated_by, ...rest } = form;
      void id; void slug; void created_at; void updated_at; void created_by; void updated_by;
      persist(rest);
    }, 1000);
  }, [form, persist]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const saveNow = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    const { id, slug, created_at, updated_at, created_by, updated_by, ...rest } = form;
    void id; void slug; void created_at; void updated_at; void created_by; void updated_by;
    void persist(rest);
  }, [persist, form]);

  async function handleDelete() {
    if (!confirm('למחוק את היוצר? פעולה זו אינה מוחקת את התוכן אך מנתקת אותו מהיוצר.')) return;
    const res = await fetch(`/api/admin/creators/${initial.id}`, { method: 'DELETE' });
    if (res.ok) router.push('/admin/creators');
  }

  const assignedEmail = users.find((u) => u.id === form.user_id)?.email ?? null;
  const labelCls = 'block text-xs font-semibold text-neutral-600 mb-1.5';
  const inputCls = 'w-full px-3 py-2 rounded-md border border-neutral-200 focus:border-brand-purple-400 focus:outline-none text-sm';

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="bg-white rounded-2xl border border-neutral-200 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="שם היוצר"
              className="w-full text-2xl font-extrabold text-neutral-950 bg-transparent border-0 focus:outline-none focus:bg-neutral-50 rounded px-2 -mx-2 py-1"
            />
            <p className="text-xs text-neutral-400 mt-1 font-mono" dir="ltr">/learn/creators/{form.slug}</p>
          </div>
          <SaveIndicator state={saveState} onForceSave={saveNow} initialSavedAt={initial.updated_at} />
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-neutral-100">
          <a
            href={`/learn/creators/${form.slug}`}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-xs font-semibold border border-neutral-300 hover:border-brand-purple-400 text-neutral-700 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" /> צפה בעמוד הציבורי
          </a>
          {form.user_id && (
            <a
              href="/learn/creator"
              target="_blank"
              rel="noopener"
              title={`היוצר (${assignedEmail ?? ''}) רואה את הלוח הזה לאחר התחברות`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-xs font-semibold border border-neutral-300 hover:border-brand-purple-400 text-neutral-700 transition-colors"
            >
              <LayoutDashboard className="w-3.5 h-3.5" /> לוח היוצר
            </a>
          )}
        </div>
      </header>

      {/* Access-flow helper */}
      <div className="rounded-2xl border border-brand-purple-200 bg-brand-purple-50 p-5">
        <div className="flex items-center gap-2 mb-2 text-brand-purple-800">
          <Info className="w-4 h-4" />
          <h2 className="text-sm font-extrabold">איך יוצר נכנס ומנהל תוכן?</h2>
        </div>
        <ol className="text-sm text-brand-purple-900/90 space-y-1 list-decimal pe-5 marker:font-bold">
          <li>משייכים את היוצר למשתמש קיים במערכת (בקטע &quot;גישה והרשאות&quot; למטה).</li>
          <li>המשתמש מקבל הרשאת יוצר (אוטומטית בשיוך, או דרך מסך המשתמשים).</li>
          <li>לאחר התחברות הוא רואה אזור &quot;לוח יוצר&quot; בתפריט.</li>
          <li>שם הוא מנהל פרופיל, הדרכות ופלייליסטים — ורק את שלו.</li>
          <li>הוא לא יכול לערוך תוכן של יוצרים אחרים.</li>
        </ol>
      </div>

      {/* 1. Basic identity */}
      <SectionCard icon={User} title="זהות בסיסית">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>תפקיד / כותרת</label>
            <input value={form.role_title ?? ''} onChange={(e) => set('role_title', e.target.value)} className={inputCls} placeholder="לדוגמה: CEO, Digitech" />
          </div>
        </div>
      </SectionCard>

      {/* 2. Images */}
      <SectionCard icon={ImageIcon} title="תמונות" hint="אווטאר/לוגו לכרטיסים, ובאנר רחב לראש עמוד הפרופיל.">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>אווטאר / לוגו</label>
            <FileUpload bucket="covers" preview={form.avatar_url} onUploaded={(r) => set('avatar_url', r.url)} />
          </div>
          <div>
            <label className={labelCls}>תמונת באנר</label>
            <FileUpload bucket="covers" preview={form.banner_url} onUploaded={(r) => set('banner_url', r.url)} />
          </div>
        </div>
      </SectionCard>

      {/* 3. Bio & expertise */}
      <SectionCard icon={FileText} title="ביוגרפיה ותחומי מומחיות">
        <textarea value={form.bio ?? ''} onChange={(e) => set('bio', e.target.value)} rows={4} className={inputCls} placeholder="כמה משפטים על היוצר, התמחות וערך לקהל." />
        <div className="mt-4">
          <label className={labelCls}>סרטון היכרות (YouTube / Vimeo)</label>
          <input
            value={form.intro_video_url ?? ''}
            onChange={(e) => set('intro_video_url', e.target.value)}
            placeholder="https://youtube.com/watch?v=…"
            dir="ltr"
            className={`${inputCls} font-mono`}
          />
          <p className="text-[11px] text-neutral-400 mt-1">יוצג בקטע &quot;הכירו את היוצר&quot; בפרופיל. השאר ריק כדי להסתיר.</p>
        </div>
      </SectionCard>

      {/* 4. Social + contact */}
      <SectionCard icon={Share2} title="רשתות חברתיות ויצירת קשר">
        <div className="grid sm:grid-cols-2 gap-4">
          {SOCIAL_FIELDS.map((s) => (
            <div key={s.key}>
              <label className={labelCls}>{s.label}</label>
              <input
                value={(form[s.key] as string | null) ?? ''}
                onChange={(e) => set(s.key, e.target.value as Creator[typeof s.key])}
                placeholder={s.placeholder}
                dir="ltr"
                className={`${inputCls} font-mono`}
              />
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-neutral-100 flex items-center gap-2">
          <span className="text-xs text-neutral-500">תצוגה מקדימה:</span>
          <SocialLinks socials={form} size="sm" />
        </div>
      </SectionCard>

      {/* 5. Access & permissions */}
      <SectionCard icon={ShieldCheck} title="גישה והרשאות" hint="שייך משתמש פלטפורמה — הוא יוכל לערוך את התוכן של היוצר בלוח היוצר.">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>משתמש פלטפורמה משויך</label>
            <select value={form.user_id ?? ''} onChange={(e) => set('user_id', e.target.value || null)} className={`${inputCls} bg-white`}>
              <option value="">— ללא —</option>
              {users.map((u) => (<option key={u.id} value={u.id}>{u.email ?? u.id}</option>))}
            </select>
          </div>
          <div>
            <label className={labelCls}>סטטוס</label>
            <select value={form.status} onChange={(e) => set('status', e.target.value as Creator['status'])} className={`${inputCls} bg-white`}>
              <option value="active">פעיל</option>
              <option value="disabled">מושבת</option>
            </select>
          </div>
        </div>
        <p className="text-[11px] text-neutral-500 mt-2">
          לאחר השיוך — ודא שלמשתמש יש תפקיד &quot;יוצר&quot; במסך{' '}
          <a href="/admin/users" className="text-brand-purple-700 underline">משתמשים</a>.
        </p>
      </SectionCard>

      {/* 6. Featured */}
      <SectionCard icon={Star} title="הגדרות Featured" hint="קובע אם והיכן היוצר מופיע בקטע 'יוצרים מובילים'.">
        <div className="grid sm:grid-cols-2 gap-4 items-end">
          <div>
            <label className={labelCls}>סדר מיון (נמוך = ראשון)</label>
            <input type="number" value={form.sort_order} onChange={(e) => set('sort_order', Number(e.target.value))} className={inputCls} />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer pb-2">
            <input type="checkbox" checked={form.is_featured} onChange={(e) => set('is_featured', e.target.checked)} className="w-4 h-4 accent-brand-purple-700" />
            <span className="font-medium text-neutral-700">הצג ביוצרים מובילים</span>
          </label>
        </div>
      </SectionCard>

      {/* 7. SEO */}
      <SectionCard icon={Search} title="SEO ושיתוף">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>SEO Title</label>
            <input value={form.seo_title ?? ''} onChange={(e) => set('seo_title', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>SEO Description</label>
            <input value={form.seo_description ?? ''} onChange={(e) => set('seo_description', e.target.value)} className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>תמונת OG (שיתוף ברשתות)</label>
            <input value={form.og_image_url ?? ''} onChange={(e) => set('og_image_url', e.target.value)} dir="ltr" className={`${inputCls} font-mono`} placeholder="https://…" />
          </div>
        </div>
      </SectionCard>

      <button type="button" onClick={handleDelete} className="flex items-center gap-1 text-xs text-neutral-400 hover:text-red-600">
        <Trash2 className="w-3.5 h-3.5" /> מחק יוצר
      </button>
    </div>
  );
}
