import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, Clock, Lock, Play, Check, Folder, BookOpen } from 'lucide-react';
import { getCourseWithModules, getCompletedLessonIds } from '@/lib/learn/db';
import { getCurrentUser, hasPremiumAccess } from '@/lib/auth';
import { renderMarkdownLite } from '@/lib/learn/markdown';
import { decideAccess, resolveAccessLevel, formatPrice } from '@/lib/learn/access';
import { hasActiveEntitlement } from '@/lib/payments/entitlement-service';
import AccessActionButton from '@/components/learn/AccessActionButton';
import type { DbLesson, ModuleWithChildren } from '@/lib/learn/types';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ course: string }> }) {
  const { course: slug } = await params;
  const c = await getCourseWithModules(slug);
  return { title: c ? `${c.title} — Digitech Learning Hub` : 'קורס לא נמצא' };
}

/** Flatten modules → chapters → direct lessons into a single ordered list. */
function flattenLessons(modules: ModuleWithChildren[]): DbLesson[] {
  const out: DbLesson[] = [];
  for (const m of modules) {
    for (const c of m.chapters) for (const l of c.lessons) out.push(l);
    for (const l of m.lessons) out.push(l);
  }
  return out;
}

export default async function CourseLanding({ params }: { params: Promise<{ course: string }> }) {
  const { course: slug } = await params;
  const course = await getCourseWithModules(slug);
  if (!course || course.status !== 'published') notFound();

  const auth = await getCurrentUser();
  const hasPremium = !!auth && hasPremiumAccess(auth.profile);
  const level = resolveAccessLevel(course);
  const hasEntitlement =
    level === 'purchase_required' && !!auth ? await hasActiveEntitlement('course', course.id) : false;
  const decision = decideAccess(course, { loggedIn: !!auth, hasPremium, hasEntitlement });
  const full = decision.state === 'full';
  const locked = !full;

  const flatLessons = flattenLessons(course.modules);
  const completed = auth ? new Set(await getCompletedLessonIds(auth.userId, course.id)) : new Set<string>();
  const completedCount = flatLessons.reduce((n, l) => (completed.has(l.id) ? n + 1 : n), 0);
  const pct = flatLessons.length > 0 ? Math.round((completedCount / flatLessons.length) * 100) : 0;

  const firstIncomplete = flatLessons.find((l) => !completed.has(l.id));
  const targetLesson = firstIncomplete ?? flatLessons[0];

  // For the "has any structure beyond default" check — hide module headers if
  // a course has just the auto-migrated "module-1" with no chapters
  const hasOnlyDefaultModule =
    course.modules.length === 1 &&
    course.modules[0].slug === 'module-1' &&
    course.modules[0].chapters.length === 0 &&
    (!course.modules[0].vimeo_id && !course.modules[0].body);

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-8 max-w-5xl mx-auto">
      <Link
        href="/learn/courses"
        className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 mb-5"
      >
        <ArrowRight className="w-3.5 h-3.5" />
        חזרה לקורסים
      </Link>

      <header
        className="rounded-2xl text-white px-6 sm:px-8 py-7 sm:py-8 mb-6 relative overflow-hidden"
        style={
          course.cover_url
            ? { backgroundImage: `linear-gradient(rgba(46,26,92,0.7), rgba(46,26,92,0.85)), url(${course.cover_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : { backgroundImage: 'linear-gradient(135deg, #2E1A5C 0%, #4A2E8F 60%, #5B3AAE 100%)' }
        }
      >
        <div className="relative">
          {course.audience && (
            <span className="inline-flex items-center text-[11px] font-semibold uppercase tracking-wider text-brand-purple-100 bg-white/10 backdrop-blur-sm px-2 py-1 rounded-pill mb-3">
              {course.audience}
            </span>
          )}
          <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight">{course.title}</h1>
          {course.tagline && <p className="mt-2 text-base text-brand-purple-200">{course.tagline}</p>}

          <div className="mt-5 flex items-center gap-4 text-sm text-brand-purple-200">
            <span className="inline-flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {flatLessons.length} שיעורים
            </span>
            {auth && flatLessons.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <Check className="w-4 h-4" />
                {completedCount} הושלמו ({pct}%)
              </span>
            )}
            {course.is_premium && (
              <span className="inline-flex items-center gap-1 text-amber-200">
                <Lock className="w-3.5 h-3.5" />
                פרימיום
              </span>
            )}
          </div>

          <div className="mt-6">
            {targetLesson ? (
              (() => {
                const returnTo = `/learn/courses/${slug}`;
                const targetHref = `/learn/courses/${slug}/${targetLesson.slug}`;
                const btnCls =
                  'inline-flex items-center gap-2 px-5 py-2.5 rounded-pill bg-white text-brand-purple-800 text-sm font-bold hover:bg-brand-purple-50 transition-colors disabled:opacity-70';
                const errCls = 'text-xs text-red-200 mt-1.5';
                // Full access (open, enrolled, premium, or entitled) → straight in.
                if (full) {
                  return (
                    <AccessActionButton
                      kind={level === 'open' || level === 'login_required' ? 'enroll' : 'continue'}
                      slug={slug}
                      returnTo={returnTo}
                      targetHref={targetHref}
                      label={completedCount > 0 ? 'המשך לימוד' : 'התחל קורס'}
                      className={btnCls}
                      errorClassName={errCls}
                      icon={<Play className="w-4 h-4" />}
                    />
                  );
                }
                if (level === 'purchase_required') {
                  const price = formatPrice(course.price_amount, course.price_currency);
                  return (
                    <AccessActionButton
                      kind="purchase"
                      slug={slug}
                      contentType="course"
                      returnTo={returnTo}
                      label={price ? `רכישת גישה · ${price}` : 'רכישת גישה לקורס'}
                      className={btnCls}
                      errorClassName={errCls}
                      icon={<Lock className="w-4 h-4" />}
                    />
                  );
                }
                if (level === 'subscription_required') {
                  return (
                    <AccessActionButton
                      kind="subscribe"
                      slug={slug}
                      returnTo={returnTo}
                      label="הצטרפות למועדון"
                      className={btnCls}
                      errorClassName={errCls}
                      icon={<Lock className="w-4 h-4" />}
                    />
                  );
                }
                // login_required without a session → register to unlock.
                return (
                  <AccessActionButton
                    kind="login"
                    slug={slug}
                    returnTo={returnTo}
                    label="פתיחת גישה חינמית"
                    className={btnCls}
                    errorClassName={errCls}
                    icon={<Play className="w-4 h-4" />}
                  />
                );
              })()
            ) : (
              <p className="text-sm text-brand-purple-200">קורס זה עוד ריק.</p>
            )}
          </div>
        </div>
      </header>

      {course.description && (
        <section className="bg-white rounded-2xl border border-neutral-200 p-6 mb-6">
          <h2 className="text-lg font-extrabold text-neutral-950 mb-3">על הקורס</h2>
          <div className="prose-learn" dangerouslySetInnerHTML={{ __html: renderMarkdownLite(course.description) }} />
        </section>
      )}

      <section className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200">
          <h2 className="text-lg font-extrabold text-neutral-950">תוכן הקורס</h2>
        </div>
        {flatLessons.length === 0 ? (
          <div className="p-12 text-center text-neutral-500 text-sm">אין שיעורים בקורס זה.</div>
        ) : hasOnlyDefaultModule ? (
          <LessonList lessons={course.modules[0].lessons} slug={slug} locked={locked} completed={completed} />
        ) : (
          <div className="divide-y divide-neutral-100">
            {course.modules.map((m) => (
              <ModuleSection
                key={m.id}
                module={m}
                slug={slug}
                locked={locked}
                completed={completed}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ModuleSection({
  module: m,
  slug,
  locked,
  completed,
}: {
  module: ModuleWithChildren;
  slug: string;
  locked: boolean;
  completed: Set<string>;
}) {
  return (
    <div className="px-6 py-4">
      <div className="flex items-center gap-2 mb-3">
        <Folder className="w-4 h-4 text-brand-purple-700" />
        <h3 className="text-base font-extrabold text-brand-purple-900">
          מודול {m.num}: {m.title}
        </h3>
      </div>
      {m.body && (
        <div
          className="prose-learn text-sm mb-3"
          dangerouslySetInnerHTML={{ __html: renderMarkdownLite(m.body) }}
        />
      )}

      {m.chapters.length > 0 && (
        <div className="space-y-3">
          {m.chapters.map((c) => (
            <div key={c.id}>
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="w-3.5 h-3.5 text-brand-purple-500" />
                <h4 className="text-sm font-bold text-brand-purple-800">
                  פרק {c.num}: {c.title}
                </h4>
              </div>
              <LessonList lessons={c.lessons} slug={slug} locked={locked} completed={completed} compact />
            </div>
          ))}
        </div>
      )}

      {m.lessons.length > 0 && (
        <div className={m.chapters.length > 0 ? 'mt-3' : ''}>
          <LessonList lessons={m.lessons} slug={slug} locked={locked} completed={completed} compact />
        </div>
      )}
    </div>
  );
}

function LessonList({
  lessons,
  slug,
  locked,
  completed,
  compact = false,
}: {
  lessons: DbLesson[];
  slug: string;
  locked: boolean;
  completed: Set<string>;
  compact?: boolean;
}) {
  return (
    <ul className={compact ? 'rounded-md border border-neutral-100 overflow-hidden' : ''}>
      {lessons.map((l) => {
        const isDone = completed.has(l.id);
        // Locked lessons send the viewer back to the course header, where the
        // access-aware CTA (enroll / purchase / subscribe) lives.
        const url = locked ? `/learn/courses/${slug}` : `/learn/courses/${slug}/${l.slug}`;
        return (
          <li key={l.id} className="border-t border-neutral-100 first:border-t-0">
            <Link
              href={url}
              className={`flex items-center gap-3 hover:bg-neutral-50 transition-colors ${compact ? 'px-4 py-2.5' : 'px-6 py-3.5'}`}
            >
              <span
                className={[
                  'w-8 h-8 rounded-pill flex items-center justify-center text-xs font-extrabold tabular-nums flex-shrink-0',
                  isDone ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-500',
                ].join(' ')}
              >
                {isDone ? <Check className="w-4 h-4" /> : l.num}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-neutral-900 text-sm truncate">{l.title}</p>
                {l.duration && <p className="text-xs text-neutral-500 mt-0.5">{l.duration}</p>}
              </div>
              {locked ? (
                <Lock className="w-4 h-4 text-neutral-400" />
              ) : (
                <ArrowLeft className="w-4 h-4 text-neutral-400" />
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
