'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Check, BookOpen, Bot, Lock } from 'lucide-react';
import type { Course } from '@/lib/learn/types';

type Props = {
  course: Course;
  activeLessonSlug: string;
  /** Slugs marked complete by the server. Initial value; updated on `digitech:progress` events. */
  completedLessonSlugs?: string[];
};

export default function CourseSidebar({ course, activeLessonSlug, completedLessonSlugs }: Props) {
  const [completed, setCompleted] = useState<Set<string>>(new Set(completedLessonSlugs ?? []));

  // Listen for toggles from MarkCompleteButton — re-fetch the per-course slug list
  // from the server so we stay accurate even if multiple lessons toggle in flight.
  useEffect(() => {
    async function refresh() {
      try {
        const res = await fetch(`/api/progress/course/${course.slug}/lessons`);
        if (!res.ok) return;
        const data = await res.json();
        setCompleted(new Set<string>(data.slugs ?? []));
      } catch {
        // ignore
      }
    }
    const onProgress = () => { refresh(); };
    window.addEventListener('digitech:progress', onProgress);
    return () => window.removeEventListener('digitech:progress', onProgress);
  }, [course.slug]);

  const total = course.lessons.length;
  const done = completed.size;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:w-80 lg:shrink-0 pb-6 lg:pb-0">
      <div className="bg-white rounded-xl border border-neutral-200 p-5">
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="font-bold text-neutral-950">התקדמות בקורס</h3>
          <span className="text-sm font-semibold text-brand-purple-700 tabular-nums">{pct}%</span>
        </div>
        <div className="h-2 rounded-pill bg-neutral-200 overflow-hidden">
          <div className="h-full rounded-pill bg-brand-purple-700 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-neutral-500 mt-2">
          הושלמו {done} מתוך {total} שיעורים
        </p>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200">
        <div className="px-5 pt-5 pb-3 border-b border-neutral-200">
          <h3 className="font-bold text-neutral-950">תוכן הקורס</h3>
        </div>

        <ul className="p-2">
          <li>
            <Link
              href={`/learn/courses/${course.slug}`}
              className="flex items-center gap-3 px-3 py-3 rounded-md bg-brand-purple-50 hover:bg-brand-purple-100/60 transition-colors"
            >
              <span className="w-9 h-9 rounded-md bg-white border border-brand-purple-200 flex items-center justify-center shrink-0">
                <BookOpen className="w-4 h-4 text-brand-purple-700" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-neutral-950 leading-tight">סילבוס</span>
                <span className="block text-xs text-neutral-500 mt-0.5">מה ייצא לי מהקורס</span>
              </span>
            </Link>
          </li>

          {course.lessons.map((lesson) => {
            const isActive = lesson.slug === activeLessonSlug;
            const isDone = completed.has(lesson.slug);
            const isLocked = !!lesson.locked;

            // Locked chapters are blocked for everyone — send clicks to the
            // course landing rather than the (redirecting) lesson page.
            const href = isLocked
              ? `/learn/courses/${course.slug}`
              : `/learn/courses/${course.slug}/${lesson.slug}`;

            return (
              <li key={lesson.slug}>
                <Link
                  href={href}
                  className={[
                    'flex items-center gap-3 px-3 py-3 rounded-md transition-colors mt-1',
                    isActive
                      ? 'bg-brand-purple-700 text-white'
                      : isLocked
                        ? 'text-neutral-400 hover:bg-neutral-50'
                        : 'hover:bg-neutral-100 text-neutral-700',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'w-7 h-7 rounded-pill flex items-center justify-center shrink-0 text-[12px] font-bold tabular-nums',
                      isActive
                        ? 'bg-white text-brand-purple-700'
                        : isLocked
                          ? 'bg-neutral-100 text-neutral-400'
                          : isDone
                            ? 'bg-brand-purple-100 text-brand-purple-700'
                            : 'bg-neutral-100 text-neutral-500',
                    ].join(' ')}
                  >
                    {isLocked ? <Lock className="w-3.5 h-3.5" /> : isDone ? <Check className="w-3.5 h-3.5" /> : lesson.num}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span
                      className={[
                        'block text-sm font-semibold leading-tight line-clamp-2',
                        isActive ? 'text-white' : isLocked ? 'text-neutral-400' : 'text-neutral-950',
                      ].join(' ')}
                    >
                      {lesson.title}
                    </span>
                    {lesson.duration && !isLocked && (
                      <span
                        className={[
                          'block text-xs mt-0.5 tabular-nums',
                          isActive ? 'text-brand-purple-200' : 'text-neutral-500',
                        ].join(' ')}
                      >
                        {lesson.duration}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        {course.lastUpdated && (
          <div className="px-5 py-3 border-t border-neutral-200">
            <p className="text-xs text-neutral-500">עודכן לאחרונה: {course.lastUpdated}</p>
          </div>
        )}
      </div>

      {course.linkedAgents && course.linkedAgents.length > 0 && (
        <div className="bg-white rounded-xl border border-neutral-200 p-5">
          <h3 className="font-bold text-neutral-950 mb-3">סוכנים מקושרים</h3>
          <div className="space-y-2">
            {course.linkedAgents.map((agent) => (
              <a
                key={agent.id}
                href={agent.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-md border border-neutral-200 hover:border-brand-purple-300 hover:bg-brand-purple-50 transition-colors"
              >
                <span className="w-9 h-9 rounded-md bg-brand-purple-100 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-brand-purple-700" />
                </span>
                <span className="text-sm font-medium text-neutral-950">{agent.title}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
