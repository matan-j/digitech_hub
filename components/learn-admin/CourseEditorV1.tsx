'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Trash2, ExternalLink, Plus, FileSpreadsheet, FolderPlus, BookPlus } from 'lucide-react';
import FileUpload from './FileUpload';
import SaveIndicator, { type SaveState } from './SaveIndicator';
import GeneratePlaybookButton from './GeneratePlaybookButton';
import NodeEditor from './NodeEditor';
import type {
  ChapterWithLessons,
  CourseWithModules,
  DbChapter,
  DbLesson,
  DbModule,
  ModuleWithChildren,
} from '@/lib/learn/types';

type Props = { initial: CourseWithModules };

type DragScope =
  | { kind: 'modules' }
  | { kind: 'chapters'; moduleId: string }
  | { kind: 'lessons'; moduleId: string; chapterId: string | null };

type DragState = { scope: DragScope; idx: number } | null;

function sameScope(a: DragScope, b: DragScope): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'chapters' && b.kind === 'chapters') return a.moduleId === b.moduleId;
  if (a.kind === 'lessons' && b.kind === 'lessons') return a.moduleId === b.moduleId && a.chapterId === b.chapterId;
  return true;
}

export default function CourseEditorV1({ initial }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [tagline, setTagline] = useState(initial.tagline ?? '');
  const [description, setDescription] = useState(initial.description ?? '');
  const [audience, setAudience] = useState(initial.audience ?? '');
  const [coverUrl, setCoverUrl] = useState(initial.cover_url ?? '');
  const [isPremium, setIsPremium] = useState(initial.is_premium);
  const [status, setStatus] = useState(initial.status);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [modules, setModules] = useState<ModuleWithChildren[]>(initial.modules);
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [addingModule, setAddingModule] = useState(false);
  const dragState = useRef<DragState>(null);
  const dirty = useRef(false);
  const saveTimer = useRef<NodeJS.Timeout | null>(null);

  const persist = useCallback(async (payload: Record<string, unknown>) => {
    setSaveState('saving');
    try {
      const res = await fetch(`/api/content/course/${initial.slug}`, {
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
    saveTimer.current = setTimeout(() => {
      persist({
        title,
        tagline: tagline || null,
        description: description || null,
        audience: audience || null,
        cover_url: coverUrl || null,
        is_premium: isPremium,
      });
    }, 1200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, tagline, description, audience, coverUrl, isPremium]);

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  async function togglePublish() {
    const next = status === 'published' ? 'draft' : 'published';
    const ok = await persist({
      title,
      tagline: tagline || null,
      description: description || null,
      audience: audience || null,
      cover_url: coverUrl || null,
      is_premium: isPremium,
      status: next,
    });
    if (ok) setStatus(next);
  }

  async function handleDelete() {
    if (!confirm('למחוק את הקורס לצמיתות? כל המודולים, הפרקים והשיעורים יימחקו גם הם.')) return;
    const res = await fetch(`/api/content/course/${initial.slug}`, { method: 'DELETE' });
    if (res.ok) router.push('/admin/courses');
  }

  // ============================================================
  // Module ops
  // ============================================================
  async function addModule() {
    const trimmed = newModuleTitle.trim();
    if (!trimmed) return;
    setAddingModule(true);
    const res = await fetch(`/api/courses/${initial.slug}/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: trimmed }),
    });
    const data = await res.json();
    setAddingModule(false);
    if (!res.ok) {
      alert('שגיאה: ' + (data.error ?? data.message));
      return;
    }
    const created = data.module as DbModule;
    setModules((prev) => [...prev, { ...created, resources: [], chapters: [], lessons: [] }]);
    setNewModuleTitle('');
  }

  async function deleteModule(id: string) {
    const res = await fetch(`/api/modules/${id}`, { method: 'DELETE' });
    if (res.ok) setModules((prev) => prev.filter((m) => m.id !== id));
  }

  function updateModule(next: DbModule) {
    setModules((prev) => prev.map((m) => (m.id === next.id ? { ...m, ...next } : m)));
  }

  async function reorderModules(orderedIds: string[]) {
    const byId = new Map(modules.map((m) => [m.id, m]));
    const next = orderedIds.map((id, i) => {
      const m = byId.get(id);
      return m ? { ...m, num: i + 1, position: i } : m;
    }).filter(Boolean) as ModuleWithChildren[];
    setModules(next);
    await fetch('/api/modules/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ordered_ids: orderedIds }),
    });
  }

  // ============================================================
  // Chapter ops
  // ============================================================
  async function addChapter(moduleId: string) {
    const t = prompt('כותרת הפרק');
    if (!t || !t.trim()) return;
    const res = await fetch(`/api/modules/${moduleId}/chapters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: t.trim() }),
    });
    const data = await res.json();
    if (!res.ok) { alert('שגיאה: ' + (data.error ?? data.message)); return; }
    const created = data.chapter as DbChapter;
    setModules((prev) => prev.map((m) =>
      m.id === moduleId
        ? { ...m, chapters: [...m.chapters, { ...created, resources: [], lessons: [] }] }
        : m,
    ));
  }

  async function deleteChapter(moduleId: string, chapterId: string) {
    const res = await fetch(`/api/chapters/${chapterId}`, { method: 'DELETE' });
    if (res.ok) {
      setModules((prev) => prev.map((m) =>
        m.id === moduleId ? { ...m, chapters: m.chapters.filter((c) => c.id !== chapterId) } : m,
      ));
    }
  }

  function updateChapter(moduleId: string, next: DbChapter) {
    setModules((prev) => prev.map((m) =>
      m.id === moduleId
        ? { ...m, chapters: m.chapters.map((c) => (c.id === next.id ? { ...c, ...next } : c)) }
        : m,
    ));
  }

  async function reorderChapters(moduleId: string, orderedIds: string[]) {
    setModules((prev) => prev.map((m) => {
      if (m.id !== moduleId) return m;
      const byId = new Map(m.chapters.map((c) => [c.id, c]));
      const next = orderedIds.map((id, i) => {
        const c = byId.get(id);
        return c ? { ...c, num: i + 1, position: i } : c;
      }).filter(Boolean) as ChapterWithLessons[];
      return { ...m, chapters: next };
    }));
    await fetch('/api/chapters/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ordered_ids: orderedIds }),
    });
  }

  // ============================================================
  // Lesson ops
  // ============================================================
  async function addLesson(moduleId: string, chapterId: string | null) {
    const t = prompt('כותרת השיעור');
    if (!t || !t.trim()) return;
    const res = await fetch(`/api/courses/${initial.slug}/lessons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: t.trim(), module_id: moduleId, chapter_id: chapterId }),
    });
    const data = await res.json();
    if (!res.ok) { alert('שגיאה: ' + (data.error ?? data.message)); return; }
    const created = { ...data.lesson, resources: [] } as DbLesson;
    setModules((prev) => prev.map((m) => {
      if (m.id !== moduleId) return m;
      if (chapterId) {
        return {
          ...m,
          chapters: m.chapters.map((c) => c.id === chapterId ? { ...c, lessons: [...c.lessons, created] } : c),
        };
      }
      return { ...m, lessons: [...m.lessons, created] };
    }));
  }

  async function deleteLesson(moduleId: string, chapterId: string | null, lessonId: string) {
    const res = await fetch(`/api/lessons/${lessonId}`, { method: 'DELETE' });
    if (!res.ok) return;
    setModules((prev) => prev.map((m) => {
      if (m.id !== moduleId) return m;
      if (chapterId) {
        return {
          ...m,
          chapters: m.chapters.map((c) => c.id === chapterId ? { ...c, lessons: c.lessons.filter((l) => l.id !== lessonId) } : c),
        };
      }
      return { ...m, lessons: m.lessons.filter((l) => l.id !== lessonId) };
    }));
  }

  function updateLesson(moduleId: string, chapterId: string | null, next: DbLesson) {
    setModules((prev) => prev.map((m) => {
      if (m.id !== moduleId) return m;
      if (chapterId) {
        return {
          ...m,
          chapters: m.chapters.map((c) => c.id === chapterId ? { ...c, lessons: c.lessons.map((l) => l.id === next.id ? { ...l, ...next } : l) } : c),
        };
      }
      return { ...m, lessons: m.lessons.map((l) => l.id === next.id ? { ...l, ...next } : l) };
    }));
  }

  async function reorderLessons(moduleId: string, chapterId: string | null, orderedIds: string[]) {
    setModules((prev) => prev.map((m) => {
      if (m.id !== moduleId) return m;
      if (chapterId) {
        return {
          ...m,
          chapters: m.chapters.map((c) => {
            if (c.id !== chapterId) return c;
            const byId = new Map(c.lessons.map((l) => [l.id, l]));
            const next = orderedIds.map((id, i) => {
              const l = byId.get(id);
              return l ? { ...l, num: i + 1, position: i } : l;
            }).filter(Boolean) as DbLesson[];
            return { ...c, lessons: next };
          }),
        };
      }
      const byId = new Map(m.lessons.map((l) => [l.id, l]));
      const next = orderedIds.map((id, i) => {
        const l = byId.get(id);
        return l ? { ...l, num: i + 1, position: i } : l;
      }).filter(Boolean) as DbLesson[];
      return { ...m, lessons: next };
    }));
    await fetch('/api/lessons/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ordered_ids: orderedIds,
        scope: { module_id: moduleId, chapter_id: chapterId },
      }),
    });
  }

  // ============================================================
  // Drag/drop helpers — scoped per container
  // ============================================================
  function onDragStart(scope: DragScope, idx: number) {
    dragState.current = { scope, idx };
  }
  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
  }
  function onDrop(scope: DragScope, toIdx: number) {
    const from = dragState.current;
    dragState.current = null;
    if (!from || !sameScope(from.scope, scope) || from.idx === toIdx) return;
    if (scope.kind === 'modules') {
      const ids = modules.map((m) => m.id);
      const [moved] = ids.splice(from.idx, 1);
      ids.splice(toIdx, 0, moved);
      void reorderModules(ids);
    } else if (scope.kind === 'chapters') {
      const m = modules.find((x) => x.id === scope.moduleId);
      if (!m) return;
      const ids = m.chapters.map((c) => c.id);
      const [moved] = ids.splice(from.idx, 1);
      ids.splice(toIdx, 0, moved);
      void reorderChapters(scope.moduleId, ids);
    } else {
      const m = modules.find((x) => x.id === scope.moduleId);
      if (!m) return;
      const list = scope.chapterId
        ? m.chapters.find((c) => c.id === scope.chapterId)?.lessons ?? []
        : m.lessons;
      const ids = list.map((l) => l.id);
      const [moved] = ids.splice(from.idx, 1);
      ids.splice(toIdx, 0, moved);
      void reorderLessons(scope.moduleId, scope.chapterId, ids);
    }
  }

  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="space-y-6">
      <header className="bg-white rounded-2xl border border-neutral-200 p-5">
        <div className="flex items-start gap-4 justify-between mb-4">
          <div className="flex-1">
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
            <SaveIndicator state={saveState} />
            <a
              href={`/learn/courses/${initial.slug}`}
              target="_blank"
              rel="noopener"
              className="flex items-center gap-1 text-xs text-neutral-500 hover:text-brand-purple-700"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              צפה כלומד
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

          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={isPremium}
              onChange={(e) => setIsPremium(e.target.checked)}
              className="w-3.5 h-3.5 accent-brand-purple-700"
            />
            <span className="font-medium text-neutral-700">פרימיום</span>
          </label>

          <GeneratePlaybookButton mode="course" courseId={initial.id} courseSlug={initial.slug} />

          <Link
            href={`/admin/courses/${initial.slug}/bulk-import`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-pill border border-neutral-300 text-xs font-semibold text-neutral-700 hover:border-brand-purple-400 hover:text-brand-purple-700 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            ייבוא מקובץ
          </Link>

          <button
            type="button"
            onClick={handleDelete}
            className="ms-auto flex items-center gap-1 text-xs text-neutral-400 hover:text-red-600"
          >
            <Trash2 className="w-3.5 h-3.5" />
            מחק קורס
          </button>
        </div>
      </header>

      <section className="bg-white rounded-2xl border border-neutral-200 p-5">
        <h2 className="text-sm font-extrabold text-neutral-700 uppercase tracking-wide mb-3">מטא-דאטה</h2>
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
            <label className="block text-xs font-semibold text-neutral-600 mb-1">קהל יעד</label>
            <input
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-neutral-200 focus:border-brand-purple-400 focus:outline-none text-sm"
            />
            <label className="block text-xs font-semibold text-neutral-600 mb-1 mt-4">תמונת קאבר</label>
            <FileUpload bucket="covers" preview={coverUrl} onUploaded={(r) => setCoverUrl(r.url)} />
          </div>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-neutral-200 p-5">
        <h2 className="text-sm font-extrabold text-neutral-700 uppercase tracking-wide mb-4">
          מודולים <span className="text-neutral-400 font-normal">({modules.length})</span>
        </h2>

        {modules.length === 0 ? (
          <p className="text-sm text-neutral-500 py-4 text-center">עדיין אין מודולים בקורס זה. הוסף את הראשון 👇</p>
        ) : (
          <div className="space-y-5 mb-4">
            {modules.map((mod, mIdx) => (
              <ModuleBlock
                key={mod.id}
                module={mod}
                mIdx={mIdx}
                onModuleChange={(next) => updateModule(next)}
                onModuleDelete={() => deleteModule(mod.id)}
                onChapterChange={(next) => updateChapter(mod.id, next)}
                onChapterDelete={(cid) => deleteChapter(mod.id, cid)}
                onLessonChange={(cid, next) => updateLesson(mod.id, cid, next)}
                onLessonDelete={(cid, lid) => deleteLesson(mod.id, cid, lid)}
                onAddChapter={() => addChapter(mod.id)}
                onAddLesson={(cid) => addLesson(mod.id, cid)}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDrop={onDrop}
              />
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 pt-3 border-t border-neutral-100">
          <input
            value={newModuleTitle}
            onChange={(e) => setNewModuleTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addModule(); } }}
            placeholder="כותרת מודול חדש"
            className="flex-1 px-3 py-2 rounded-md border border-neutral-200 focus:border-brand-purple-400 focus:outline-none text-sm"
          />
          <button
            type="button"
            onClick={addModule}
            disabled={!newModuleTitle.trim() || addingModule}
            className="flex items-center gap-1.5 px-4 py-2 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-600 disabled:bg-neutral-300 text-white text-sm font-semibold transition-colors"
          >
            <FolderPlus className="w-4 h-4" />
            {addingModule ? 'מוסיף...' : 'הוסף מודול'}
          </button>
        </div>
      </section>
    </div>
  );
}

// ============================================================
// ModuleBlock — single module with its chapters + direct lessons
// ============================================================
function ModuleBlock({
  module: mod,
  mIdx,
  onModuleChange,
  onModuleDelete,
  onChapterChange,
  onChapterDelete,
  onLessonChange,
  onLessonDelete,
  onAddChapter,
  onAddLesson,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  module: ModuleWithChildren;
  mIdx: number;
  onModuleChange: (next: DbModule) => void;
  onModuleDelete: () => void;
  onChapterChange: (next: DbChapter) => void;
  onChapterDelete: (chapterId: string) => void;
  onLessonChange: (chapterId: string | null, next: DbLesson) => void;
  onLessonDelete: (chapterId: string | null, lessonId: string) => void;
  onAddChapter: () => void;
  onAddLesson: (chapterId: string | null) => void;
  onDragStart: (scope: DragScope, idx: number) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (scope: DragScope, toIdx: number) => void;
}) {
  return (
    <div className="border border-brand-purple-200 rounded-xl overflow-hidden">
      <NodeEditor
        kind="module"
        node={mod}
        onChange={onModuleChange}
        onDelete={onModuleDelete}
        onDragStart={() => onDragStart({ kind: 'modules' }, mIdx)}
        onDragOver={onDragOver}
        onDrop={() => onDrop({ kind: 'modules' }, mIdx)}
      />

      <div className="bg-brand-purple-50/30 p-3 space-y-3">
        {mod.chapters.length > 0 && (
          <div className="space-y-3">
            {mod.chapters.map((chap, cIdx) => (
              <ChapterBlock
                key={chap.id}
                chapter={chap}
                cIdx={cIdx}
                moduleId={mod.id}
                onChapterChange={onChapterChange}
                onChapterDelete={() => onChapterDelete(chap.id)}
                onLessonChange={(next) => onLessonChange(chap.id, next)}
                onLessonDelete={(lid) => onLessonDelete(chap.id, lid)}
                onAddLesson={() => onAddLesson(chap.id)}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDrop={onDrop}
              />
            ))}
          </div>
        )}

        {mod.lessons.length > 0 && (
          <div className="space-y-2">
            {mod.lessons.map((l, lIdx) => (
              <NodeEditor
                key={l.id}
                kind="lesson"
                node={l}
                onChange={(next) => onLessonChange(null, next)}
                onDelete={() => onLessonDelete(null, l.id)}
                onDragStart={() => onDragStart({ kind: 'lessons', moduleId: mod.id, chapterId: null }, lIdx)}
                onDragOver={onDragOver}
                onDrop={() => onDrop({ kind: 'lessons', moduleId: mod.id, chapterId: null }, lIdx)}
              />
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 pt-2 border-t border-brand-purple-100">
          <button
            type="button"
            onClick={() => onAddLesson(null)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-white border border-neutral-300 text-xs font-semibold text-neutral-700 hover:border-brand-purple-400 hover:text-brand-purple-700"
          >
            <Plus className="w-3.5 h-3.5" />
            הוסף שיעור
          </button>
          <button
            type="button"
            onClick={onAddChapter}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-white border border-neutral-300 text-xs font-semibold text-neutral-700 hover:border-brand-purple-400 hover:text-brand-purple-700"
          >
            <BookPlus className="w-3.5 h-3.5" />
            הוסף פרק
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ChapterBlock — single chapter with its lessons
// ============================================================
function ChapterBlock({
  chapter,
  cIdx,
  moduleId,
  onChapterChange,
  onChapterDelete,
  onLessonChange,
  onLessonDelete,
  onAddLesson,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  chapter: ChapterWithLessons;
  cIdx: number;
  moduleId: string;
  onChapterChange: (next: DbChapter) => void;
  onChapterDelete: () => void;
  onLessonChange: (next: DbLesson) => void;
  onLessonDelete: (lessonId: string) => void;
  onAddLesson: () => void;
  onDragStart: (scope: DragScope, idx: number) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (scope: DragScope, toIdx: number) => void;
}) {
  return (
    <div className="border border-brand-purple-100 rounded-lg overflow-hidden">
      <NodeEditor
        kind="chapter"
        node={chapter}
        onChange={onChapterChange}
        onDelete={onChapterDelete}
        onDragStart={() => onDragStart({ kind: 'chapters', moduleId }, cIdx)}
        onDragOver={onDragOver}
        onDrop={() => onDrop({ kind: 'chapters', moduleId }, cIdx)}
      />
      <div className="bg-brand-purple-50/20 p-3 space-y-2">
        {chapter.lessons.length > 0 && (
          <div className="space-y-2">
            {chapter.lessons.map((l, lIdx) => (
              <NodeEditor
                key={l.id}
                kind="lesson"
                node={l}
                onChange={onLessonChange}
                onDelete={() => onLessonDelete(l.id)}
                onDragStart={() => onDragStart({ kind: 'lessons', moduleId, chapterId: chapter.id }, lIdx)}
                onDragOver={onDragOver}
                onDrop={() => onDrop({ kind: 'lessons', moduleId, chapterId: chapter.id }, lIdx)}
              />
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={onAddLesson}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-white border border-neutral-300 text-xs font-semibold text-neutral-700 hover:border-brand-purple-400 hover:text-brand-purple-700"
        >
          <Plus className="w-3.5 h-3.5" />
          הוסף שיעור בפרק זה
        </button>
      </div>
    </div>
  );
}
