import Link from 'next/link';
import { ArrowLeft, Layers, Clock } from 'lucide-react';
import type { Course } from '@/lib/learn/types';
import ShareButton from '@/components/learn/ShareButton';

export default function CourseCard({ course }: { course: Course }) {
  const totalLessons = course.lessons.length;

  return (
    <div className="relative">
      {/* Share button is a sibling of the card <Link> so we never nest a
          <button> inside an <a>. */}
      <div className="absolute top-3 left-3 z-10">
        <ShareButton path={`/learn/courses/${course.slug}`} title={course.title} />
      </div>
      <Link
        href={`/learn/courses/${course.slug}`}
        className="
          group block bg-white rounded-card border border-neutral-200
          hover:border-brand-purple-700 transition-all overflow-hidden
        "
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
      {/* Cover */}
      <div
        className="aspect-[16/9] relative bg-brand-purple-900"
        style={{
          backgroundImage:
            course.cover === 'header'
              ? 'linear-gradient(180deg, #1A0F3D 0%, #2E1A5C 100%)'
              : 'linear-gradient(135deg, #2E1A5C 0%, #4B2E83 60%, #5F3E9C 100%)',
        }}
      >
        <div
          aria-hidden
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'radial-gradient(circle at 80% 25%, rgba(196,184,230,0.32), transparent 55%), radial-gradient(circle at 18% 88%, rgba(26,15,61,0.55), transparent 55%)',
          }}
        />
        <div className="absolute inset-0 p-5 flex flex-col justify-end">
          {course.audience && (
            <span className="self-start inline-flex items-center text-[11px] font-semibold uppercase tracking-wider text-white/85 bg-white/12 backdrop-blur-sm px-2.5 py-1 rounded-pill">
              {course.audience}
            </span>
          )}
          <h3 className="mt-2.5 text-white font-extrabold text-lg leading-tight line-clamp-2">
            {course.title}
          </h3>
        </div>
      </div>

      {/* Body */}
      <div className="p-5">
        <p className="text-sm text-neutral-500 line-clamp-2 mb-4 min-h-[2.6em]">
          {course.tagline}
        </p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-xs text-neutral-500">
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <Layers className="w-3.5 h-3.5" />
              {totalLessons} שיעורים
            </span>
            {course.lastUpdated && (
              <>
                <span className="text-neutral-300" aria-hidden>·</span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {course.lastUpdated}
                </span>
              </>
            )}
          </div>
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-purple-700 group-hover:text-brand-purple-500 transition-colors">
            התחל
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          </span>
        </div>
      </div>
      </Link>
    </div>
  );
}
