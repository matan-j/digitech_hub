'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Course, Lesson } from '@/lib/learn/types';
import LessonRow from './LessonRow';
import SaveIndicator, { type SaveState } from './SaveIndicator';

export default function CourseEditor({ initialCourse }: { initialCourse: Course }) {
  const router = useRouter();
  const [course, setCourse] = useState<Course>(initialCourse);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const dirtyRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveNow = useCallback(async (snapshot: Course) => {
    setSaveState('saving');
    try {
      const res = await fetch(`/api/learn-admin/courses/${snapshot.slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course: snapshot }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      if (data.course) {
        // Server may renumber lessons; sync back
        setCourse((cur) => mergeServerCourse(cur, data.course));
      }
      dirtyRef.current = false;
      setSaveState('saved');
      // fall back to "idle" after a moment so the pill doesn't sit "saved" forever
      setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 1500);
    } catch (e) {
      console.error('save failed', e);
      setSaveState('error');
    }
  }, []);

  /** Mark dirty + schedule autosave (debounced 1s). */
  const onChange = useCallback((next: Course) => {
    setCourse(next);
    dirtyRef.current = true;
    setSaveState('dirty');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveNow(next);
    }, 1000);
  }, [saveNow]);

  /** Warn before navigating away if there are unsaved changes. */
  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    }
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const updateMeta = (patch: Partial<Course>) => onChange({ ...course, ...patch });

  const addLesson = () => {
    const nextNum = course.lessons.length + 1;
    const newLesson: Lesson = {
      num: nextNum,
      slug: String(nextNum),
      title: `שיעור ${nextNum}`,
      vimeoId: '',
      duration: '',
      body: '',
      resources: [],
    };
    onChange({ ...course, lessons: [...course.lessons, newLesson] });
  };

  const updateLesson = (idx: number, patch: Partial<Lesson>) => {
    const lessons = course.lessons.map((l, i) => (i === idx ? { ...l, ...patch } : l));
    onChange({ ...course, lessons });
  };

  const deleteLesson = (idx: number) => {
    if (!confirm('למחוק את השיעור הזה? פעולה לא הפיכה.')) return;
    const lessons = course.lessons.filter((_, i) => i !== idx);
    onChange({ ...course, lessons: renumber(lessons) });
  };

  const moveLesson = (from: number, to: number) => {
    if (from === to) return;
    const lessons = course.lessons.slice();
    const [removed] = lessons.splice(from, 1);
    lessons.splice(to, 0, removed);
    onChange({ ...course, lessons: renumber(lessons) });
  };

  const deleteCourse = async () => {
    if (!confirm(`למחוק את הקורס "${course.title}"? כל השיעורים יימחקו.`)) return;
    const res = await fetch(`/api/learn-admin/courses/${course.slug}`, { method: 'DELETE' });
    if (res.ok) router.push('/learn-admin');
    else alert('המחיקה נכשלה');
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Sticky top bar */}
      <div className="sticky top-14 z-30 bg-gray-50 -mx-4 px-4 py-3 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Link href="/learn-admin" className="text-sm text-gray-500 hover:text-gray-900 shrink-0">
            ←
          </Link>
          <span className="font-bold text-gray-900 truncate text-sm sm:text-base">
            {course.title || course.slug}
          </span>
          <code className="text-xs font-mono text-gray-400 hidden sm:inline">{course.slug}</code>
        </div>
        <div className="flex items-center gap-2">
          <SaveIndicator state={saveState} onForceSave={() => void saveNow(course)} initialSavedAt={course.lastUpdated} />
          <Link
            href={`/learn/courses/${course.slug}`}
            target="_blank"
            className="bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 text-xs font-medium px-3 py-1.5 rounded-md"
          >
            צפה ב-/learn ↗
          </Link>
          <button
            type="button"
            onClick={deleteCourse}
            className="text-red-600 hover:text-red-700 text-xs font-medium px-2 py-1.5"
          >
            מחק קורס
          </button>
        </div>
      </div>

      {/* Meta section */}
      <section className="mt-6 bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-900">פרטי הקורס</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="כותרת">
            <input
              type="text"
              value={course.title}
              onChange={(e) => updateMeta({ title: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </Field>
          <Field label="קהל יעד">
            <input
              type="text"
              value={course.audience || ''}
              onChange={(e) => updateMeta({ audience: e.target.value })}
              placeholder='לדוגמה: "כיתה ט׳" / "מקצועי"'
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </Field>
        </div>

        <Field label="תקציר (Tagline)">
          <input
            type="text"
            value={course.tagline}
            onChange={(e) => updateMeta({ tagline: e.target.value })}
            placeholder="משפט אחד שמופיע על כרטיס הקורס"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </Field>

        <Field label="תיאור מלא">
          <textarea
            value={course.description}
            onChange={(e) => updateMeta({ description: e.target.value })}
            rows={3}
            placeholder="מופיע בעמוד הקורס. 2-4 משפטים."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical"
          />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="סגנון כיסוי (Cover)">
            <select
              value={course.cover || 'hero'}
              onChange={(e) => updateMeta({ cover: e.target.value as 'hero' | 'header' })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="hero">Hero — סגול עם דעיכה</option>
              <option value="header">Header — סגול עמוק</option>
            </select>
          </Field>
          <Field label="עדכון אחרון (תווית)">
            <input
              type="text"
              value={course.lastUpdated || ''}
              onChange={(e) => updateMeta({ lastUpdated: e.target.value })}
              placeholder="19.2.2026"
              dir="ltr"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </Field>
        </div>
      </section>

      {/* Lessons section */}
      <section className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">
            שיעורים <span className="text-gray-400 font-normal">({course.lessons.length})</span>
          </h2>
        </div>

        <div className="space-y-2">
          {course.lessons.map((lesson, idx) => (
            <LessonRow
              key={`${lesson.num}-${idx}`}
              lesson={lesson}
              index={idx}
              total={course.lessons.length}
              onChange={(patch) => updateLesson(idx, patch)}
              onDelete={() => deleteLesson(idx)}
              onMove={moveLesson}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={addLesson}
          className="mt-3 w-full py-3 border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50/30 rounded-xl text-sm font-semibold text-gray-600 hover:text-blue-700 transition-colors"
        >
          + הוסף שיעור
        </button>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-gray-700 mb-1">{label}</span>
      {children}
    </label>
  );
}

function renumber(lessons: Lesson[]): Lesson[] {
  return lessons.map((l, i) => ({
    ...l,
    num: i + 1,
    // keep custom slugs when present; if slug looks like a stale number, refresh it
    slug: l.slug && !/^\d+$/.test(l.slug) ? l.slug : String(i + 1),
  }));
}

/**
 * When the server responds with a sanitized course, prefer its lesson numbering
 * but keep the user's in-flight edits to the body/title/etc that may already
 * have changed since the request was sent.
 */
function mergeServerCourse(local: Course, server: Course): Course {
  return {
    ...server,
    title: local.title,
    tagline: local.tagline,
    description: local.description,
    audience: local.audience,
    cover: local.cover,
    lessons: local.lessons.map((ll, i) => {
      const sl = server.lessons[i];
      return sl ? { ...sl, ...ll, num: sl.num, slug: sl.slug } : ll;
    }),
    linkedAgents: local.linkedAgents,
  };
}
