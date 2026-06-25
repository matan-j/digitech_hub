'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, GripVertical, Trash2, Plus, ExternalLink, FileText, FolderInput } from 'lucide-react';
import VimeoField from './VimeoField';
import MarkdownEditor from './MarkdownEditor';
import FileUpload from './FileUpload';
import GeneratePlaybookButton from './GeneratePlaybookButton';
import type { DbChapter, DbLesson, DbModule, DbResource } from '@/lib/learn/types';

export type NodeKind = 'module' | 'chapter' | 'lesson';

type NodeBase = {
  id: string;
  num: number;
  title: string;
  vimeo_id: string | null;
  duration: string | null;
  body: string | null;
  resources?: DbResource[];
};

export type MoveTarget = {
  moduleId: string;
  moduleNum: number;
  moduleTitle: string;
  chapters: { chapterId: string; chapterNum: number; chapterTitle: string }[];
};

type CommonProps = {
  onDelete: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  /** Optional control rendered in the header row (e.g. the chapter lock toggle). */
  headerAction?: React.ReactNode;
};

type Props =
  | ({ kind: 'module'; node: DbModule; onChange: (next: DbModule) => void } & CommonProps)
  | ({ kind: 'chapter'; node: DbChapter; onChange: (next: DbChapter) => void } & CommonProps)
  | ({
      kind: 'lesson';
      node: DbLesson;
      onChange: (next: DbLesson) => void;
      /** When provided, shows a "Move to" dropdown letting admin re-parent this lesson. */
      availableTargets?: MoveTarget[];
      onMove?: (target: { moduleId: string; chapterId: string | null }) => void;
    } & CommonProps);

const KIND_LABEL: Record<string, string> = {
  pdf: 'PDF', xlsx: 'Excel', docx: 'Word', link: 'קישור',
};

const CONFIG: Record<NodeKind, {
  editEndpoint: (id: string) => string;
  resourcesEndpoint: (id: string) => string;
  responseField: 'module' | 'chapter' | 'lesson';
  numChip: string;             // tailwind classes for the number circle
  rowAccent: string;           // tailwind classes for the header bar
  inputText: string;           // tailwind for the title input
  deleteLabel: string;         // confirm dialog text
  deleteAria: string;
  emptyTitle: string;          // placeholder for the title input
}> = {
  module: {
    editEndpoint: (id) => `/api/modules/${id}`,
    resourcesEndpoint: (id) => `/api/modules/${id}/resources`,
    responseField: 'module',
    numChip: 'bg-brand-purple-700 text-white',
    rowAccent: 'bg-brand-purple-50 border-b border-brand-purple-200',
    inputText: 'text-base font-extrabold text-brand-purple-900',
    deleteLabel: 'למחוק את המודול? כל הפרקים והשיעורים בתוכו יימחקו גם.',
    deleteAria: 'מחק מודול',
    emptyTitle: 'כותרת המודול',
  },
  chapter: {
    editEndpoint: (id) => `/api/chapters/${id}`,
    resourcesEndpoint: (id) => `/api/chapters/${id}/resources`,
    responseField: 'chapter',
    numChip: 'bg-brand-purple-200 text-brand-purple-800',
    rowAccent: 'bg-brand-purple-50/60 border-b border-brand-purple-100',
    inputText: 'text-sm font-bold text-brand-purple-800',
    deleteLabel: 'למחוק את הפרק? כל השיעורים בתוכו יימחקו גם.',
    deleteAria: 'מחק פרק',
    emptyTitle: 'כותרת הפרק',
  },
  lesson: {
    editEndpoint: (id) => `/api/lessons/${id}`,
    resourcesEndpoint: (id) => `/api/lessons/${id}/resources`,
    responseField: 'lesson',
    numChip: 'bg-brand-purple-100 text-brand-purple-700',
    rowAccent: 'bg-neutral-50 border-b border-neutral-100',
    inputText: 'text-sm font-semibold text-neutral-900',
    deleteLabel: 'למחוק את השיעור?',
    deleteAria: 'מחק שיעור',
    emptyTitle: 'כותרת השיעור',
  },
};

export default function NodeEditor(props: Props) {
  const { kind, node, onChange, onDelete, onDragStart, onDragOver, onDrop, headerAction } = props;
  const cfg = CONFIG[kind];

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(node.title);
  const [vimeoId, setVimeoId] = useState(node.vimeo_id ?? '');
  const [duration, setDuration] = useState(node.duration ?? '');
  const [body, setBody] = useState(node.body ?? '');
  const [isPreview, setIsPreview] = useState(kind === 'lesson' ? ((node as DbLesson).is_preview ?? false) : false);
  const [resources, setResources] = useState<DbResource[]>(node.resources ?? []);
  const [saveBadge, setSaveBadge] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [moveOpen, setMoveOpen] = useState(false);
  const initialMount = useRef(true);
  const saveTimer = useRef<NodeJS.Timeout | null>(null);

  const persist = useCallback(async (patch: Record<string, unknown>) => {
    setSaveBadge('saving');
    const res = await fetch(cfg.editEndpoint(node.id), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) { setSaveBadge('error'); return; }
    const data = await res.json();
    const updated = data[cfg.responseField];
    if (updated) {
      // Preserve resources locally; server doesn't return them on PUT.
      // The onChange callback is typed per kind via the discriminated union.
      switch (kind) {
        case 'module':
          (onChange as (n: DbModule) => void)({ ...(node as DbModule), ...(updated as DbModule), resources });
          break;
        case 'chapter':
          (onChange as (n: DbChapter) => void)({ ...(node as DbChapter), ...(updated as DbChapter), resources });
          break;
        case 'lesson':
          (onChange as (n: DbLesson) => void)({ ...(node as DbLesson), ...(updated as DbLesson), resources });
          break;
      }
    }
    setSaveBadge('saved');
    setTimeout(() => setSaveBadge('idle'), 1500);
  }, [cfg, node, kind, onChange, resources]);

  useEffect(() => {
    if (initialMount.current) { initialMount.current = false; return; }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      persist({
        title,
        vimeo_id: vimeoId || null,
        duration: duration || null,
        body: body || null,
        ...(kind === 'lesson' ? { is_preview: isPreview } : {}),
      });
    }, 1200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, vimeoId, duration, body, isPreview]);

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  async function addLinkResource() {
    const url = prompt('הדבק כתובת URL');
    if (!url) return;
    const linkTitle = prompt('כותרת הקישור') ?? url;
    const res = await fetch(cfg.resourcesEndpoint(node.id), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: linkTitle, url, kind: 'link' }),
    });
    if (res.ok) {
      const data = await res.json();
      setResources((prev) => [...prev, data.resource]);
    }
  }

  async function handleFileUploaded(r: { url: string; sizeMB: number; kind?: 'pdf' | 'xlsx' | 'docx' | 'link'; filename: string }) {
    const res = await fetch(cfg.resourcesEndpoint(node.id), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: r.filename || 'קובץ', url: r.url, size_mb: r.sizeMB, kind: r.kind ?? null }),
    });
    if (res.ok) {
      const data = await res.json();
      setResources((prev) => [...prev, data.resource]);
    }
  }

  async function deleteResource(id: string) {
    if (!confirm('למחוק את הקובץ?')) return;
    const res = await fetch(`/api/resources/${id}`, { method: 'DELETE' });
    if (res.ok) setResources((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className="bg-white border border-neutral-200 rounded-lg overflow-hidden"
    >
      <div className={`flex items-center gap-3 px-3 py-2.5 ${cfg.rowAccent}`}>
        <GripVertical className="w-4 h-4 text-neutral-400 cursor-grab flex-shrink-0" />
        <span className={`w-7 h-7 rounded-pill text-xs font-extrabold flex items-center justify-center flex-shrink-0 ${cfg.numChip}`}>
          {node.num}
        </span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={cfg.emptyTitle}
          className={`flex-1 bg-transparent border-0 focus:outline-none px-2 -mx-2 py-1 rounded focus:bg-white ${cfg.inputText}`}
        />
        {saveBadge === 'saving' && <span className="text-[10px] text-blue-600">שומר…</span>}
        {saveBadge === 'saved' && <span className="text-[10px] text-emerald-600">✓ נשמר</span>}
        {saveBadge === 'error' && <span className="text-[10px] text-red-600">⚠ שגיאה</span>}
        {headerAction}
        {kind === 'lesson' && (
          <GeneratePlaybookButton mode="video" lessonId={node.id} lessonTitle={node.title} />
        )}
        {props.kind === 'lesson' && props.availableTargets && props.availableTargets.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMoveOpen((v) => !v)}
              className="p-1 text-neutral-500 hover:text-brand-purple-700"
              aria-label="העבר ל..."
              title="העבר למודול / פרק אחר"
            >
              <FolderInput className="w-4 h-4" />
            </button>
            {moveOpen && (
              <MoveDropdown
                targets={props.availableTargets}
                currentModuleId={(props.node as DbLesson).module_id}
                currentChapterId={(props.node as DbLesson).chapter_id}
                onSelect={(target) => {
                  setMoveOpen(false);
                  props.onMove?.(target);
                }}
                onClose={() => setMoveOpen(false)}
              />
            )}
          </div>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="p-1 text-neutral-500 hover:text-neutral-800"
          aria-label={open ? 'סגור' : 'פתח'}
        >
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        <button
          type="button"
          onClick={() => { if (confirm(cfg.deleteLabel)) onDelete(); }}
          className="p-1 text-neutral-400 hover:text-red-600"
          aria-label={cfg.deleteAria}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {open && (
        <div className="p-4 space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-1">סרטון Vimeo (אופציונלי)</label>
              <VimeoField
                value={vimeoId}
                onChange={(id) => setVimeoId(id)}
                onMetaResolved={(meta) => {
                  if (!duration && meta.durationLabel) setDuration(meta.durationLabel);
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-1">משך (אופציונלי)</label>
              <input
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="לדוגמה: 12m 30s"
                dir="ltr"
                className="w-full px-3 py-2 rounded-md border border-neutral-200 focus:border-brand-purple-400 focus:outline-none text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1">תוכן (טקסט עשיר, אופציונלי)</label>
            <MarkdownEditor value={body} onChange={setBody} rows={8} showTimestamp />
          </div>

          {kind === 'lesson' && (
            <label className="flex items-start gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={isPreview}
                onChange={(e) => setIsPreview(e.target.checked)}
                className="w-3.5 h-3.5 mt-0.5 accent-brand-purple-700"
              />
              <span className="text-neutral-700">
                <span className="font-medium">פתח שיעור זה ללא רכישה (תצוגה מקדימה)</span>
                <span className="block text-[11px] text-neutral-500 mt-0.5">
                  שיעורים נעולים כברירת מחדל. סמן כדי לפתוח שיעור בודד גם למי שלא רכש את הקורס.
                  רוכשי הקורס רואים את כל השיעורים פתוחים בכל מקרה.
                </span>
              </span>
            </label>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-neutral-600">חומרים מצורפים</label>
              <button
                type="button"
                onClick={addLinkResource}
                className="flex items-center gap-1 text-xs text-brand-purple-700 hover:text-brand-purple-800 font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                הוסף קישור חיצוני
              </button>
            </div>
            {resources.length > 0 && (
              <ul className="space-y-1.5 mb-3">
                {resources.map((r) => (
                  <li key={r.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded border border-neutral-100 bg-neutral-50 text-sm">
                    <FileText className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                    <span className="flex-1 truncate">{r.title}</span>
                    {r.kind && <span className="text-[10px] font-mono uppercase text-neutral-500 bg-white px-1.5 py-0.5 rounded">{KIND_LABEL[r.kind] ?? r.kind}</span>}
                    {r.size_mb != null && <span className="text-[10px] text-neutral-400">{Number(r.size_mb).toFixed(1)} MB</span>}
                    <a href={r.url} target="_blank" rel="noopener" className="p-1 text-neutral-400 hover:text-brand-purple-700">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={() => deleteResource(r.id)}
                      className="p-1 text-neutral-400 hover:text-red-600"
                      aria-label="מחק"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <FileUpload
              bucket="resources"
              compact
              label="העלה קובץ (PDF/Excel/Word — עד 50MB)"
              onUploaded={handleFileUploaded}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export type { NodeBase };

function MoveDropdown({
  targets,
  currentModuleId,
  currentChapterId,
  onSelect,
  onClose,
}: {
  targets: MoveTarget[];
  currentModuleId: string;
  currentChapterId: string | null;
  onSelect: (target: { moduleId: string; chapterId: string | null }) => void;
  onClose: () => void;
}) {
  // Close on outside click
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute end-0 top-full mt-1 z-30 w-72 max-h-96 overflow-y-auto bg-white border border-neutral-200 rounded-lg shadow-lg p-2 text-sm"
    >
      <div className="px-2 py-1 text-[11px] text-neutral-500 uppercase font-semibold">העבר ל...</div>
      {targets.map((t) => {
        const isCurrentDirect = t.moduleId === currentModuleId && currentChapterId === null;
        return (
          <div key={t.moduleId} className="mb-1">
            <button
              type="button"
              disabled={isCurrentDirect}
              onClick={() => onSelect({ moduleId: t.moduleId, chapterId: null })}
              className={`w-full text-start px-2 py-1.5 rounded text-sm font-semibold ${
                isCurrentDirect
                  ? 'text-neutral-400 cursor-default'
                  : 'text-brand-purple-800 hover:bg-brand-purple-50'
              }`}
            >
              מודול {t.moduleNum}: {t.moduleTitle}
              {isCurrentDirect && <span className="ms-2 text-[10px] text-neutral-400">(כאן)</span>}
            </button>
            {t.chapters.map((c) => {
              const isCurrentChapter = c.chapterId === currentChapterId;
              return (
                <button
                  key={c.chapterId}
                  type="button"
                  disabled={isCurrentChapter}
                  onClick={() => onSelect({ moduleId: t.moduleId, chapterId: c.chapterId })}
                  className={`w-full text-start ps-6 pe-2 py-1 rounded text-xs ${
                    isCurrentChapter
                      ? 'text-neutral-400 cursor-default'
                      : 'text-neutral-700 hover:bg-brand-purple-50'
                  }`}
                >
                  ↳ פרק {c.chapterNum}: {c.chapterTitle}
                  {isCurrentChapter && <span className="ms-2 text-[10px] text-neutral-400">(כאן)</span>}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
