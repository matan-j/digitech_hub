'use client';

import { useEffect, useRef } from 'react';
import { Bold, Italic, Underline, List, ListOrdered, Heading2, Link2, Eraser } from 'lucide-react';

/**
 * Minimal contentEditable rich-text editor. Emits HTML via onChange. Used for
 * the popup `rich_text` content type — intentionally tiny (no external deps).
 */
export default function RichTextEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Sync incoming value only when it diverges (avoids caret jumps while typing).
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || '';
    }
  }, [value]);

  function exec(command: string, arg?: string) {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    onChange(ref.current?.innerHTML ?? '');
  }

  function addLink() {
    const url = window.prompt('כתובת הקישור (כולל https://)');
    if (url) exec('createLink', url);
  }

  const btn =
    'flex items-center justify-center w-8 h-8 rounded-md text-neutral-600 hover:bg-brand-purple-50 hover:text-brand-purple-700 transition-colors';

  return (
    <div className="rounded-md border border-neutral-300 overflow-hidden">
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-neutral-200 bg-neutral-50">
        <button type="button" className={btn} onClick={() => exec('bold')} title="מודגש"><Bold className="w-4 h-4" /></button>
        <button type="button" className={btn} onClick={() => exec('italic')} title="נטוי"><Italic className="w-4 h-4" /></button>
        <button type="button" className={btn} onClick={() => exec('underline')} title="קו תחתון"><Underline className="w-4 h-4" /></button>
        <span className="w-px h-5 bg-neutral-200 mx-1" />
        <button type="button" className={btn} onClick={() => exec('formatBlock', 'h2')} title="כותרת"><Heading2 className="w-4 h-4" /></button>
        <button type="button" className={btn} onClick={() => exec('insertUnorderedList')} title="רשימה"><List className="w-4 h-4" /></button>
        <button type="button" className={btn} onClick={() => exec('insertOrderedList')} title="רשימה ממוספרת"><ListOrdered className="w-4 h-4" /></button>
        <button type="button" className={btn} onClick={addLink} title="קישור"><Link2 className="w-4 h-4" /></button>
        <span className="w-px h-5 bg-neutral-200 mx-1" />
        <button type="button" className={btn} onClick={() => exec('removeFormat')} title="נקה עיצוב"><Eraser className="w-4 h-4" /></button>
      </div>
      <div
        ref={ref}
        contentEditable
        dir="rtl"
        onInput={() => onChange(ref.current?.innerHTML ?? '')}
        className="min-h-[140px] px-3 py-2.5 text-sm text-neutral-800 leading-relaxed focus:outline-none [&_h2]:text-lg [&_h2]:font-bold [&_ul]:list-disc [&_ul]:pr-5 [&_ol]:list-decimal [&_ol]:pr-5 [&_a]:text-brand-purple-700 [&_a]:underline"
        suppressContentEditableWarning
      />
    </div>
  );
}
