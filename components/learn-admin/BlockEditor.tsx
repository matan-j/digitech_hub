'use client';

import { useState } from 'react';
import { GripVertical, Trash2, Plus, Image as ImageIcon, Type, Video, Info } from 'lucide-react';
import FileUpload from './FileUpload';
import MarkdownEditor from './MarkdownEditor';
import type { GuideBlock } from '@/lib/learn/types';

type Props = {
  value: GuideBlock[];
  onChange: (next: GuideBlock[]) => void;
};

const TONES = [
  { value: 'info', label: 'מידע', cls: 'bg-brand-purple-50 border-brand-purple-200 text-brand-purple-800' },
  { value: 'success', label: 'הצלחה', cls: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
  { value: 'warning', label: 'אזהרה', cls: 'bg-amber-50 border-amber-200 text-amber-800' },
] as const;

export default function BlockEditor({ value, onChange }: Props) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  function updateAt(idx: number, next: GuideBlock) {
    const out = [...value];
    out[idx] = next;
    onChange(out);
  }
  function removeAt(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }
  function appendBlock(b: GuideBlock) {
    onChange([...value, b]);
  }
  function moveBlock(from: number, to: number) {
    if (from === to) return;
    const out = [...value];
    const [item] = out.splice(from, 1);
    out.splice(to, 0, item);
    onChange(out);
  }

  return (
    <div className="space-y-3">
      {value.length === 0 && (
        <div className="text-center py-8 border-2 border-dashed border-neutral-200 rounded-lg text-sm text-neutral-500">
          אין עדיין בלוקים. הוסף את הראשון 👇
        </div>
      )}

      {value.map((block, idx) => (
        <div
          key={idx}
          draggable
          onDragStart={() => setDragIndex(idx)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (dragIndex !== null) moveBlock(dragIndex, idx);
            setDragIndex(null);
          }}
          className="bg-white rounded-lg border border-neutral-200 overflow-hidden"
        >
          <div className="flex items-center justify-between bg-neutral-50 px-3 py-1.5 border-b border-neutral-200">
            <div className="flex items-center gap-2 text-xs font-semibold text-neutral-700">
              <GripVertical className="w-3.5 h-3.5 text-neutral-400 cursor-grab" />
              <span>בלוק {idx + 1}</span>
              <span className="text-neutral-400">·</span>
              <span className="capitalize">{labelForType(block.type)}</span>
            </div>
            <button
              type="button"
              onClick={() => removeAt(idx)}
              className="p-1 text-neutral-400 hover:text-red-600"
              aria-label="מחק בלוק"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-3">
            {block.type === 'markdown' && (
              <MarkdownEditor
                value={block.content}
                onChange={(next) => updateAt(idx, { type: 'markdown', content: next })}
                rows={8}
              />
            )}

            {block.type === 'image' && (
              <div className="space-y-2">
                {block.url ? (
                  <img src={block.url} alt={block.alt ?? ''} className="max-h-48 rounded-md border border-neutral-200" />
                ) : (
                  <FileUpload
                    bucket="covers"
                    label="העלה תמונה"
                    onUploaded={(r) => updateAt(idx, { type: 'image', url: r.url, alt: block.alt, caption: block.caption })}
                  />
                )}
                <input
                  type="text"
                  value={block.alt ?? ''}
                  onChange={(e) => updateAt(idx, { ...block, alt: e.target.value })}
                  placeholder="טקסט חלופי (alt)"
                  className="w-full px-3 py-1.5 rounded-md border border-neutral-200 text-xs"
                />
                <input
                  type="text"
                  value={block.caption ?? ''}
                  onChange={(e) => updateAt(idx, { ...block, caption: e.target.value })}
                  placeholder="כיתוב מתחת לתמונה (אופציונלי)"
                  className="w-full px-3 py-1.5 rounded-md border border-neutral-200 text-sm"
                />
                {block.url && (
                  <button
                    type="button"
                    onClick={() => updateAt(idx, { type: 'image', url: '', alt: block.alt, caption: block.caption })}
                    className="text-xs text-neutral-500 hover:text-neutral-700"
                  >
                    החלף תמונה
                  </button>
                )}
              </div>
            )}

            {block.type === 'video' && (
              <div className="space-y-2">
                <input
                  type="text"
                  value={block.vimeoId ?? ''}
                  onChange={(e) => updateAt(idx, { type: 'video', vimeoId: e.target.value, caption: block.caption })}
                  placeholder="Vimeo ID או URL"
                  className="w-full px-3 py-2 rounded-md border border-neutral-200 text-sm"
                  dir="ltr"
                />
                <input
                  type="text"
                  value={block.caption ?? ''}
                  onChange={(e) => updateAt(idx, { ...block, caption: e.target.value })}
                  placeholder="כיתוב (אופציונלי)"
                  className="w-full px-3 py-1.5 rounded-md border border-neutral-200 text-sm"
                />
              </div>
            )}

            {block.type === 'callout' && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  {TONES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => updateAt(idx, { ...block, tone: t.value })}
                      className={[
                        'px-2.5 py-1 rounded-pill text-xs font-semibold border',
                        block.tone === t.value ? t.cls : 'border-neutral-200 bg-white text-neutral-500',
                      ].join(' ')}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <textarea
                  value={block.content}
                  onChange={(e) => updateAt(idx, { type: 'callout', tone: block.tone, content: e.target.value })}
                  placeholder="טקסט ה-callout..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-md border border-neutral-200 text-sm"
                />
              </div>
            )}
          </div>
        </div>
      ))}

      <AddBlockBar onAdd={appendBlock} />
    </div>
  );
}

function labelForType(t: GuideBlock['type']): string {
  return { markdown: 'טקסט', image: 'תמונה', video: 'וידאו', callout: 'תיבת הבלטה' }[t];
}

function AddBlockBar({ onAdd }: { onAdd: (b: GuideBlock) => void }) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <span className="text-xs font-semibold text-neutral-500 flex items-center gap-1">
        <Plus className="w-3.5 h-3.5" />
        הוסף בלוק:
      </span>
      <button
        type="button"
        onClick={() => onAdd({ type: 'markdown', content: '' })}
        className="flex items-center gap-1 px-2.5 py-1 rounded-pill bg-neutral-100 hover:bg-brand-purple-50 hover:text-brand-purple-700 text-xs font-medium transition-colors"
      >
        <Type className="w-3.5 h-3.5" /> טקסט
      </button>
      <button
        type="button"
        onClick={() => onAdd({ type: 'image', url: '' })}
        className="flex items-center gap-1 px-2.5 py-1 rounded-pill bg-neutral-100 hover:bg-brand-purple-50 hover:text-brand-purple-700 text-xs font-medium transition-colors"
      >
        <ImageIcon className="w-3.5 h-3.5" /> תמונה
      </button>
      <button
        type="button"
        onClick={() => onAdd({ type: 'video' })}
        className="flex items-center gap-1 px-2.5 py-1 rounded-pill bg-neutral-100 hover:bg-brand-purple-50 hover:text-brand-purple-700 text-xs font-medium transition-colors"
      >
        <Video className="w-3.5 h-3.5" /> וידאו
      </button>
      <button
        type="button"
        onClick={() => onAdd({ type: 'callout', tone: 'info', content: '' })}
        className="flex items-center gap-1 px-2.5 py-1 rounded-pill bg-neutral-100 hover:bg-brand-purple-50 hover:text-brand-purple-700 text-xs font-medium transition-colors"
      >
        <Info className="w-3.5 h-3.5" /> תיבה
      </button>
    </div>
  );
}
