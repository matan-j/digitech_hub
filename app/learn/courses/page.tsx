import { listPublishedContent, progressByCourse } from '@/lib/learn/db';
import { getCurrentUser, hasPremiumAccess } from '@/lib/auth';
import { BookOpen } from 'lucide-react';
import { isPubliclyListed } from '@/lib/learn/access';
import { listOwnedResourceIds } from '@/lib/payments/entitlement-service';
import CourseCard from '@/components/learn/CourseCard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'קורסים · DigiTech HUB' };

export default async function CoursesIndexPage() {
  // Public catalog: read metadata from the public view so guests also see
  // premium/paid published courses (shown locked). Unlisted items stay hidden.
  const [items, auth] = await Promise.all([listPublishedContent('course'), getCurrentUser()]);
  const canSeePremium = auth ? hasPremiumAccess(auth.profile) : false;
  const [progress, ownedIds] = await Promise.all([
    auth ? progressByCourse(auth.userId) : Promise.resolve({} as Awaited<ReturnType<typeof progressByCourse>>),
    auth ? listOwnedResourceIds('course') : Promise.resolve(new Set<string>()),
  ]);
  // Owned (purchased/assigned) courses come first, keeping their relative order;
  // the rest follow. Array.sort is stable, so each group's order is preserved.
  const visible = items
    .filter(isPubliclyListed)
    .sort((a, b) => Number(ownedIds.has(b.id)) - Number(ownedIds.has(a.id)));

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-10 max-w-6xl mx-auto">
      <header className="mb-8">
        <div className="flex items-center gap-2 mb-2.5">
          <BookOpen className="w-4 h-4 text-brand-purple-700" />
          <span className="text-[11px] font-extrabold text-brand-purple-700 uppercase tracking-[0.18em]">קורסים</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-950">עולם של קורסים מחכה לך</h1>
        <p className="text-sm text-neutral-700 mt-1.5">
          {visible.length === 0 ? 'אין עדיין קורסים מפורסמים' : `${visible.length} קורסים זמינים`}
        </p>
      </header>

      {visible.length === 0 ? (
        <div
          className="bg-white rounded-card border border-neutral-200 p-12 text-center"
          style={{ boxShadow: 'var(--shadow-card)' }}
        >
          <p className="text-neutral-500">בדוק שוב בקרוב — קורסים חדשים בדרך.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((c) => {
            const cp = progress[c.id];
            const pct = cp && cp.total > 0 ? Math.round((cp.done / cp.total) * 100) : 0;
            return (
              <CourseCard
                key={c.id}
                course={c}
                owned={ownedIds.has(c.id)}
                canSeePremium={canSeePremium}
                progressPct={pct}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
