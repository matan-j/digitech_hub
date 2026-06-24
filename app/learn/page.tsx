import Link from 'next/link';
import { BookOpen, Compass, BookText, CheckCircle2, Library, ArrowLeft } from 'lucide-react';
import { listCourses } from '@/lib/learn/courses';
import CourseCard from '@/components/learn/CourseCard';
import GuideCard from '@/components/learn/GuideCard';
import { getCurrentUser } from '@/lib/auth';
import { getCompletedLessonIds, listContent, listPlaybooks } from '@/lib/learn/db';
import { getBrandCoverUrl } from '@/lib/brand';

export const dynamic = 'force-dynamic';

function firstNameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? '';
  if (!local) return '';
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export default async function LearnDashboard() {
  const auth = await getCurrentUser();
  const [courses, completed, guides, playbooks, coverUrl] = await Promise.all([
    listCourses(),
    auth ? getCompletedLessonIds(auth.userId) : Promise.resolve([] as string[]),
    listContent('guide'),
    listPlaybooks(),
    getBrandCoverUrl(),
  ]);
  const publishedGuides = guides.filter((g) => g.status === 'published');
  const displayName = auth?.profile.full_name ?? (auth?.email ? firstNameFromEmail(auth.email) : '');
  const isAdmin = auth?.profile.role === 'admin';
  const hasAccess = isAdmin || auth?.profile.subscription_status === 'active';

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-10 max-w-6xl mx-auto">
      {/* ===== Hero / Welcome Panel ===== */}
      <section
        className="relative overflow-hidden rounded-panel text-white px-7 sm:px-10 py-10 sm:py-12 mb-8 sm:mb-10"
        style={{
          backgroundImage: coverUrl
            ? `linear-gradient(140deg, rgba(54,36,101,0.86) 0%, rgba(63,42,120,0.80) 48%, rgba(95,62,156,0.74) 100%), url(${coverUrl})`
            : 'var(--grad-hero)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          boxShadow: 'var(--shadow-elevated)',
        }}
      >
        {/* subtle radial pattern for depth */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 88% 12%, rgba(196,184,230,0.18), transparent 50%), radial-gradient(circle at 6% 95%, rgba(31,181,138,0.12), transparent 55%)',
          }}
        />
        <div className="relative">
          {/* Signal-pill eyebrow */}
          <span
            className="inline-flex items-center gap-2 px-3 py-1 rounded-pill text-[11px] font-bold tracking-wide text-white"
            style={{ backgroundColor: 'rgba(31,181,138,0.22)' }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: 'var(--color-signal)' }}
            />
            DigiTech HUB · השכלה פרקטית
          </span>

          <h1 className="mt-4 text-3xl sm:text-4xl lg:text-[44px] font-extrabold tracking-tight leading-[1.05]">
            {displayName ? `היי ${displayName}, ברוך הבא חזרה` : 'ברוך הבא ל־DigiTech HUB'}
          </h1>
          <p className="mt-3 text-base sm:text-lg text-white/85 max-w-2xl">
            מרכז הלמידה שלך לקורסים, הדרכות ופלייבוקים פרקטיים.
          </p>

          {/* Quick actions */}
          <div className="mt-7 flex flex-wrap gap-2.5">
            <Link
              href="/learn/courses"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-pill bg-white text-brand-purple-700 text-sm font-bold hover:scale-[1.02] active:scale-[0.97] transition-transform"
              style={{ boxShadow: '0 12px 26px -10px rgba(0,0,0,.35)' }}
            >
              המשך ללמוד
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <Link
              href="/learn/guides"
              className="inline-flex items-center px-5 py-2.5 rounded-pill border border-white/25 text-white text-sm font-semibold hover:bg-white/10 transition-colors"
            >
              גלה הדרכות
            </Link>
            <Link
              href="/learn/playbooks"
              className="inline-flex items-center px-5 py-2.5 rounded-pill border border-white/25 text-white text-sm font-semibold hover:bg-white/10 transition-colors"
            >
              צפה בפלייבוקים
            </Link>
          </div>

          {!auth && (
            <p className="mt-6 text-sm text-white/70">
              <Link href="/login" className="underline font-semibold hover:text-white">התחבר</Link>
              {' '}כדי לעקוב אחרי ההתקדמות שלך.
            </p>
          )}
          {auth && !hasAccess && (
            <p className="mt-6 text-sm text-white/70">
              <Link href="/upgrade" className="underline font-semibold hover:text-white">הצטרף למועדון</Link>
              {' '}כדי לקבל גישה לכל התוכן.
            </p>
          )}
        </div>
      </section>

      {/* ===== Stats — only when logged in ===== */}
      {auth && (
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-10">
          <KpiCard
            icon={CheckCircle2}
            label="שיעורים שהושלמו"
            value={completed.length}
            hint="התקדמות אישית"
            accent
          />
          <KpiCard
            icon={Library}
            label="קורסים זמינים"
            value={courses.length}
            hint="מפורסמים במערכת"
          />
          <KpiCard
            icon={Compass}
            label="הדרכות זמינות"
            value={publishedGuides.length}
            hint="לקריאה עצמאית"
          />
          <KpiCard
            icon={BookText}
            label="פלייבוקים זמינים"
            value={playbooks.length}
            hint="מדריכי פעולה"
          />
        </section>
      )}

      {/* ===== Courses ===== */}
      <section>
        <div className="flex items-end justify-between mb-5">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-neutral-950">קורסים</h2>
            <p className="text-sm text-neutral-500 mt-1">כל הקורסים המפורסמים שלך.</p>
          </div>
          {courses.length > 0 && (
            <Link
              href="/learn/courses"
              className="text-sm font-semibold text-brand-purple-700 hover:text-brand-purple-500"
            >
              לכל הקורסים →
            </Link>
          )}
        </div>
        {courses.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="עדיין אין קורסים זמינים"
            text="ברגע שקורס יפורסם, הוא יופיע כאן."
            cta={
              isAdmin
                ? { label: 'צור קורס ראשון', href: '/admin/courses/new' }
                : { label: 'עבור להדרכות', href: '/learn/guides' }
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.slice(0, 6).map((c) => (
              <CourseCard key={c.slug} course={c} />
            ))}
          </div>
        )}
      </section>

      {/* ===== Guides ===== */}
      {publishedGuides.length > 0 && (
        <section className="mt-12">
          <div className="flex items-end justify-between mb-5">
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-neutral-950">הדרכות</h2>
              <p className="text-sm text-neutral-500 mt-1">קריאה עצמאית קצרה וממוקדת.</p>
            </div>
            <Link
              href="/learn/guides"
              className="text-sm font-semibold text-brand-purple-700 hover:text-brand-purple-500"
            >
              לכל ההדרכות →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {publishedGuides.slice(0, 3).map((g) => (
              <GuideCard key={g.id} guide={g} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ============================================================================
// Components — KPI + Empty State
// ============================================================================

type Icon = React.ComponentType<{ className?: string; style?: React.CSSProperties }>;

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  accent = false,
}: {
  icon: Icon;
  label: string;
  value: number;
  hint: string;
  accent?: boolean;
}) {
  return (
    <div
      className="relative bg-white rounded-card border border-neutral-200 p-5 sm:p-6 overflow-hidden"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      {accent && (
        <span
          aria-hidden
          className="absolute top-0 inset-x-0 h-0.5 rounded-t-card"
          style={{ backgroundColor: 'var(--color-signal)' }}
        />
      )}
      <div className="flex items-center justify-between">
        <Icon
          className={`w-4 h-4 ${accent ? '' : 'text-brand-purple-700'}`}
          style={accent ? { color: 'var(--color-signal)' } : undefined}
        />
      </div>
      <p className="mt-3 text-3xl sm:text-4xl font-extrabold text-neutral-950 tabular-nums leading-none">
        {value}
      </p>
      <p className="mt-2 text-sm font-semibold text-neutral-950">{label}</p>
      <p className="text-xs text-neutral-500 mt-0.5">{hint}</p>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  text,
  cta,
}: {
  icon: Icon;
  title: string;
  text: string;
  cta?: { label: string; href: string };
}) {
  return (
    <div
      className="bg-white rounded-card border border-neutral-200 px-6 py-14 text-center"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className="mx-auto w-12 h-12 rounded-pill bg-brand-purple-50 flex items-center justify-center text-brand-purple-700">
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="mt-4 text-lg font-extrabold text-neutral-950">{title}</h3>
      <p className="mt-1.5 text-sm text-neutral-500 max-w-md mx-auto">{text}</p>
      {cta && (
        <Link
          href={cta.href}
          className="inline-flex items-center gap-1.5 mt-5 px-5 py-2.5 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-600 text-white text-sm font-semibold transition-colors"
          style={{ boxShadow: 'var(--shadow-btn)' }}
        >
          {cta.label}
          {cta.href.startsWith('/admin') ? null : <ArrowLeft className="w-3.5 h-3.5" />}
        </Link>
      )}
    </div>
  );
}
