import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { getLesson } from '@/lib/learn/courses';
import RichContentRenderer from '@/components/learn/RichContentRenderer';
import ContentTableOfContents from '@/components/learn/ContentTableOfContents';
import { toRichBlocks, extractToc } from '@/lib/learn/rich-content';
import { getCurrentUser, hasPremiumAccess } from '@/lib/auth';
import { hasActiveEntitlement } from '@/lib/payments/entitlement-service';
import { getCompletedLessonIds, getCourseWithLessons } from '@/lib/learn/db';
import VimeoPlayer from '@/components/learn/VimeoPlayer';
import CourseSidebar from '@/components/learn/CourseSidebar';
import ResourcesCard from '@/components/learn/ResourcesCard';
import PrevNextNav from '@/components/learn/PrevNextNav';
import MarkCompleteButton from '@/components/learn/MarkCompleteButton';

export const dynamic = 'force-dynamic';

export default async function LessonPage({
  params,
}: {
  params: Promise<{ course: string; lesson: string }>;
}) {
  const { course: courseSlug, lesson: lessonSlug } = await params;
  const data = await getLesson(courseSlug, lessonSlug);
  if (!data) notFound();
  const { course, lesson, prev, next, lessonId, isPremium, accessLevel, courseId, isPreviewLesson } = data;
  // Table of contents only for long written lessons (3+ H2 sections).
  const lessonToc = lesson.body ? extractToc(toRichBlocks(lesson.body)) : [];

  const returnTo = `/learn/courses/${courseSlug}/${lessonSlug}`;
  const auth = await getCurrentUser();

  // Legacy subscription gate (is_premium / subscription_required).
  if (isPremium) {
    if (!auth) redirect(`/login?return=${encodeURIComponent(returnTo)}`);
    if (!hasPremiumAccess(auth.profile)) {
      redirect(`/upgrade?return=${encodeURIComponent(returnTo)}`);
    }
  }

  // login_required courses: body needs a session.
  if (accessLevel === 'login_required' && !auth) {
    redirect(`/login?return=${encodeURIComponent(returnTo)}`);
  }

  // purchase_required: free preview lessons stay open; everything else needs an
  // active entitlement (admins/subscribers exempt). Non-entitled viewers are
  // sent to the course landing where the lock + purchase CTA lives.
  if (accessLevel === 'purchase_required' && !isPreviewLesson) {
    if (!auth) redirect(`/login?return=${encodeURIComponent(returnTo)}`);
    const entitled = hasPremiumAccess(auth.profile) || (await hasActiveEntitlement('course', courseId));
    if (!entitled) redirect(`/learn/courses/${courseSlug}`);
  }
  // Resolve completed lesson slugs (CourseSidebar expects slugs, not UUIDs)
  let completedSlugs: string[] = [];
  if (auth) {
    const courseFull = await getCourseWithLessons(courseSlug);
    if (courseFull) {
      const completedIds = await getCompletedLessonIds(auth.userId, courseFull.id);
      const idToSlug = new Map(courseFull.lessons.map((l) => [l.id, l.slug] as const));
      completedSlugs = completedIds.map((id) => idToSlug.get(id)).filter((s): s is string => !!s);
    }
  }

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-5">
        <Link
          href="/learn/courses"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-neutral-700 hover:text-brand-purple-700 transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          חזרה לקורסים
        </Link>
      </div>

      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-purple-700">{course.title}</p>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-950 mt-1 leading-tight">
          שיעור {lesson.num} · {lesson.title}
        </h1>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-start gap-6">
        <div className="flex-1 min-w-0 space-y-4">
          {lesson.vimeoId && (
            <div className="bg-white rounded-xl border border-neutral-200 p-3 sm:p-4">
              <VimeoPlayer vimeoId={lesson.vimeoId} title={lesson.title} />
            </div>
          )}

          <article className="bg-white rounded-xl border border-neutral-200 p-5 sm:p-6">
            <header className="flex items-start justify-between gap-3 mb-4 flex-wrap">
              <h2 className="text-xl font-extrabold text-neutral-950 flex-1 min-w-0">{lesson.title}</h2>
              {lessonId && (
                <MarkCompleteButton
                  courseSlug={course.slug}
                  lessonSlug={lesson.slug}
                  lessonId={lessonId}
                  initialCompleted={completedSlugs.includes(lesson.slug)}
                />
              )}
            </header>

            {lesson.body ? (
              <>
                {lessonToc.length >= 3 && (
                  <div className="mb-5">
                    <ContentTableOfContents entries={lessonToc} variant="inline" title="בשיעור הזה" />
                  </div>
                )}
                <RichContentRenderer content={lesson.body} />
              </>
            ) : (
              <p className="text-neutral-400 italic">אין תוכן טקסטואלי לשיעור זה.</p>
            )}
          </article>

          {lesson.resources && lesson.resources.length > 0 && (
            <ResourcesCard resources={lesson.resources} />
          )}

          <PrevNextNav courseSlug={course.slug} prev={prev} next={next} />
        </div>

        <CourseSidebar
          course={course}
          activeLessonSlug={lesson.slug}
          completedLessonSlugs={completedSlugs}
        />
      </div>
    </div>
  );
}
