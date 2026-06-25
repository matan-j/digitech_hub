'use client';

import { useRef } from 'react';
import { Bold, Italic, Link2 } from 'lucide-react';
import InlineRich from '@/components/learn/InlineRich';

const inputCls =
  'w-full px-3 py-2 rounded-md border border-neutral-200 focus:border-brand-purple-400 focus:outline-none text-sm resize-vertical';

/**
 * Lightweight rich-text field for compact homepage copy (hero subtitle, CTA
 * band, benefit descriptions). Writes Markdown and shows a live inline preview
 * using the exact same renderer as the public page. Intentionally limited to
 * bold / italic / link so it never produces block markup that would break the
 * tightly-styled homepage layouts.
 */
export default function InlineRichField({
  value,
  onChange,
  rows = 2,
  placeholder = 'ברירת מחדל',
}: {
  value: string;
  onChange: (next: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function surround(before: string, after: string, ph: string) {
    const ta = ref.current;
    const v = value || '';
    if (!ta) { onChange(v + before + ph + after); return; }
    const start = ta.selectionStart ?? v.length;
    const end = ta.selectionEnd ?? v.length;
    const sel = v.slice(start, end) || ph;
    onChange(v.slice(0, start) + before + sel + after + v.slice(end));
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + before.length + sel.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  return (
    <div>
      <div className="flex items-center gap-1 mb-1.5">
        <Btn onClick={() => surround('**', '**', 'מודגש')} title="מודגש"><Bold className="w-3.5 h-3.5" /></Btn>
        <Btn onClick={() => surround('*', '*', 'נטוי')} title="נטוי"><Italic className="w-3.5 h-3.5" /></Btn>
        <Btn onClick={() => surround('[', '](https://)', 'טקסט הקישור')} title="קישור"><Link2 className="w-3.5 h-3.5" /></Btn>
        <span className="ms-auto text-[10px] text-neutral-400">תומך הדגשה, נטוי וקישור</span>
      </div>
      <textarea
        ref={ref}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        dir="auto"
        placeholder={placeholder}
        className={inputCls}
      />
      {value?.trim() && (
        <div className="mt-1.5 border-t border-neutral-100 pt-1.5">
          <span className="block text-[10px] text-neutral-400 mb-0.5">תצוגה מקדימה</span>
          <p className="text-sm text-neutral-600 leading-relaxed" dir="auto">
            <InlineRich text={value} />
          </p>
        </div>
      )}
    </div>
  );
}

function Btn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="p-1.5 rounded-md border border-neutral-200 bg-white text-neutral-600 hover:text-brand-purple-700 hover:border-brand-purple-300 transition-colors"
    >
      {children}
    </button>
  );
}
