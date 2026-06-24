'use client';

import { useRef, useState } from 'react';
import {
  Bold, Italic, Link2, List, ListOrdered, ListChecks, Quote, Minus,
  Heading2, Heading3, Lightbulb, AlertTriangle, Sparkles, Zap, XCircle,
  Clipboard, MousePointerClick, Smartphone, Monitor, Clock,
} from 'lucide-react';
import RichContentRenderer from '@/components/learn/RichContentRenderer';
import { normalizePastedHtml, normalizePastedText } from '@/lib/learn/paste-normalize';

type Props = {
  value: string;
  onChange: (next: string) => void;
  rows?: number;
  /** Lesson editor uses the timestamp button; guides don't. */
  showTimestamp?: boolean;
};

/**
 * Markdown editor with a structured-block toolbar, rich-paste
 * normalization (Google Docs / Word / Notion / ChatGPT) and a live
 * preview that uses the exact same renderer as the public pages.
 */
export default function MarkdownEditor({ value, onChange, rows = 10, showTimestamp = false }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [previewMobile, setPreviewMobile] = useState(false);

  /** Insert text at the cursor, optionally wrapping the current selection. */
  function surround(before: string, after = '', placeholder = '') {
    const ta = ref.current;
    const v = value || '';
    if (!ta) { onChange(v + before + placeholder + after); return; }
    const start = ta.selectionStart ?? v.length;
    const end = ta.selectionEnd ?? v.length;
    const sel = v.slice(start, end) || placeholder;
    const next = v.slice(0, start) + before + sel + after + v.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + before.length + sel.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  /** Insert a block on its own lines (blank line before/after). */
  function block(snippet: string) {
    const ta = ref.current;
    const v = value || '';
    const start = ta?.selectionStart ?? v.length;
    const needsNl = start > 0 && v[start - 1] !== '\n';
    const prefix = needsNl ? '\n\n' : (start > 0 ? '\n' : '');
    const next = v.slice(0, start) + prefix + snippet + '\n' + v.slice(start);
    onChange(next);
    requestAnimationFrame(() => ta?.focus());
  }

  function callout(name: string) {
    block(`:::${name}\nכתבו כאן את התוכן\n:::`);
  }

  async function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    let md = '';
    if (html) md = normalizePastedHtml(html);
    if (!md && text) md = normalizePastedText(text);
    if (!md) return; // let the browser paste normally
    e.preventDefault();
    const ta = ref.current;
    const v = value || '';
    const start = ta?.selectionStart ?? v.length;
    const end = ta?.selectionEnd ?? v.length;
    const next = v.slice(0, start) + md + v.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      if (ta) { ta.focus(); const pos = start + md.length; ta.setSelectionRange(pos, pos); }
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1 mb-2">
        <Tool onClick={() => block('## כותרת')} title="כותרת ראשית (H2)"><Heading2 className="w-3.5 h-3.5" /></Tool>
        <Tool onClick={() => block('### כותרת משנה')} title="כותרת משנה (H3)"><Heading3 className="w-3.5 h-3.5" /></Tool>
        <Sep />
        <Tool onClick={() => surround('**', '**', 'מודגש')} title="מודגש"><Bold className="w-3.5 h-3.5" /></Tool>
        <Tool onClick={() => surround('*', '*', 'נטוי')} title="נטוי"><Italic className="w-3.5 h-3.5" /></Tool>
        <Tool onClick={() => surround('[', '](https://)', 'טקסט הקישור')} title="קישור"><Link2 className="w-3.5 h-3.5" /></Tool>
        <Sep />
        <Tool onClick={() => block('- פריט\n- פריט')} title="רשימת תבליטים"><List className="w-3.5 h-3.5" /></Tool>
        <Tool onClick={() => block('1. שלב ראשון\n2. שלב שני')} title="רשימה ממוספרת"><ListOrdered className="w-3.5 h-3.5" /></Tool>
        <Tool onClick={() => block('- [ ] משימה\n- [ ] משימה')} title="צ׳ק-ליסט"><ListChecks className="w-3.5 h-3.5" /></Tool>
        <Tool onClick={() => block('> ציטוט')} title="ציטוט"><Quote className="w-3.5 h-3.5" /></Tool>
        <Tool onClick={() => block('---')} title="קו מפריד"><Minus className="w-3.5 h-3.5" /></Tool>
        <Sep />
        <Tool onClick={() => block('```prompt\nכתבו כאן את הפרומפט להעתקה\n```')} title="בלוק Prompt להעתקה" accent><Clipboard className="w-3.5 h-3.5" /></Tool>
        <Tool onClick={() => block(':::cta [טקסט הכפתור](https://)')} title="כפתור CTA" accent><MousePointerClick className="w-3.5 h-3.5" /></Tool>
        <Sep />
        <Tool onClick={() => callout('tip')} title="טיפ חשוב"><Lightbulb className="w-3.5 h-3.5" /></Tool>
        <Tool onClick={() => callout('attention')} title="שימו לב"><AlertTriangle className="w-3.5 h-3.5" /></Tool>
        <Tool onClick={() => callout('example')} title="דוגמה"><Sparkles className="w-3.5 h-3.5" /></Tool>
        <Tool onClick={() => callout('action')} title="פעולה לביצוע"><Zap className="w-3.5 h-3.5" /></Tool>
        <Tool onClick={() => callout('mistake')} title="טעות נפוצה"><XCircle className="w-3.5 h-3.5" /></Tool>
        {showTimestamp && (
          <>
            <Sep />
            <Tool onClick={() => surround('<span class="timestamp">', '</span> ', '0:00')} title="חותמת זמן"><Clock className="w-3.5 h-3.5" /></Tool>
          </>
        )}
        <label className="ms-auto flex items-center gap-1.5 text-xs text-neutral-600 cursor-pointer select-none">
          <input type="checkbox" checked={showPreview} onChange={(e) => setShowPreview(e.target.checked)} className="accent-brand-purple-700" />
          תצוגה מקדימה
        </label>
      </div>

      <div className={showPreview ? 'grid grid-cols-1 lg:grid-cols-2 gap-3' : ''}>
        <textarea
          ref={ref}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          onPaste={handlePaste}
          rows={rows}
          dir="auto"
          placeholder="כתבו כאן. אפשר להדביק ישירות מ-Google Docs / Word / Notion / ChatGPT — המבנה יישמר. תומך ב-Markdown."
          className="w-full border border-neutral-300 rounded-input px-3 py-2 focus:outline-none focus:border-brand-purple-500 resize-vertical leading-relaxed text-sm"
        />
        {showPreview && (
          <div className="border border-neutral-200 rounded-input bg-white overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-neutral-100 bg-neutral-50">
              <span className="text-[11px] font-semibold text-neutral-500">תצוגה מקדימה</span>
              <div className="flex items-center gap-0.5">
                <button type="button" onClick={() => setPreviewMobile(false)} className={`p-1 rounded ${!previewMobile ? 'text-brand-purple-700 bg-brand-purple-50' : 'text-neutral-400'}`} aria-label="תצוגת דסקטופ"><Monitor className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => setPreviewMobile(true)} className={`p-1 rounded ${previewMobile ? 'text-brand-purple-700 bg-brand-purple-50' : 'text-neutral-400'}`} aria-label="תצוגת מובייל"><Smartphone className="w-3.5 h-3.5" /></button>
              </div>
            </div>
            <div className="overflow-y-auto p-4" style={{ maxHeight: `${rows * 1.8 + 6}rem` }}>
              <div className={previewMobile ? 'mx-auto' : ''} style={previewMobile ? { maxWidth: 390 } : undefined}>
                <RichContentRenderer content={value || ''} emptyLabel="התחילו לכתוב כדי לראות תצוגה מקדימה." />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Tool({ onClick, title, children, accent }: { onClick: () => void; title: string; children: React.ReactNode; accent?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={[
        'p-1.5 rounded-md border text-neutral-600 hover:text-brand-purple-700 hover:border-brand-purple-300 transition-colors',
        accent ? 'border-brand-purple-200 bg-brand-purple-50 text-brand-purple-700' : 'border-neutral-200 bg-white',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span className="w-px h-5 bg-neutral-200 mx-0.5" aria-hidden />;
}
