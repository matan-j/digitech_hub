import Link from 'next/link';
import { listPublishedContent, progressByCourse } from '@/lib/learn/db';
import { getCurrentUser, hasPremiumAccess } from '@/lib/auth';
import { ArrowLeft, Lock, BookOpen } from 'lucide-react';
import ShareButton from '@/components/learn/ShareButton';
import { resolveAccessLevel, resolveDisplayPrice, isPubliclyListed } from '@/lib/learn/access';
import { listOwnedResourceIds } from '@/lib/payments/entitlement-service';

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
            const level = resolveAccessLevel(c);
            const isPaid = level === 'purchase_required';
            const dp = isPaid ? resolveDisplayPrice(c) : null;
            // Owned = active entitlement (purchased/assigned). Such cards — plus
            // those covered by a subscription/admin — render unlocked. Everything
            // paid or premium otherwise shows its gate; access is re-verified on
            // the landing page.
            const owned = ownedIds.has(c.id);
            const hasAccess = owned || canSeePremium;
            const locked = !hasAccess && (isPaid || c.is_premium || level === 'subscription_required');
            const cp = progress[c.id];
            const pct = cp && cp.total > 0 ? Math.round((cp.done / cp.total) * 100) : 0;
            return (
              <div key={c.id} className="relative">
                {/* Share button sits opposite the premium badge; it's a sibling of
                    the card <Link> so we never nest a <button> inside an <a>. */}
                <div className="absolute top-3 left-3 z-10">
                  <ShareButton path={`/learn/courses/${c.slug}`} title={c.title} />
                </div>
              <Link
                href={`/learn/courses/${c.slug}`}
                className="group block bg-white rounded-card border border-neutral-200 hover:border-brand-purple-700 transition-all overflow-hidden"
                style={{ boxShadow: 'var(--shadow-card)' }}
              >
                <div
                  className="aspect-[16/9] relative bg-brand-purple-900"
                  style={
                    c.cover_url
                      ? { backgroundImage: `url(${c.cover_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                      : c.cover_style === 'header'
                        ? { backgroundImage: 'linear-gradient(180deg, #1A0F3D 0%, #3F2A78 100%)' }
                        : { backgroundImage: 'linear-gradient(135deg, #2E1A5C 0%, #4B2E83 60%, #5F3E9C 100%)' }
                  }
                >
                  <div
                    aria-hidden
                    className="absolute inset-0 opacity-35"
                    style={{
                      backgroundImage:
                        'radial-gradient(circle at 80% 25%, rgba(196,184,230,0.30), transparent 55%), radial-gradient(circle at 18% 88%, rgba(26,15,61,0.55), transparent 55%)',
                    }}
                  />
                  {locked && (
                    <div
                      aria-hidden
                      className="absolute inset-0 bg-neutral-950/45 transition-colors group-hover:bg-neutral-950/55"
                    />
                  )}
                  <div className="absolute inset-0 p-5 flex flex-col justify-end">
                    {c.audience && (
                      <span className="self-start inline-flex items-center text-[11px] font-semibold uppercase tracking-wider text-white/85 bg-white/12 backdrop-blur-sm px-2.5 py-1 rounded-pill">
                        {c.audience}
                      </span>
                    )}
                    <h3 className="mt-2.5 text-white font-extrabold text-lg leading-tight line-clamp-2">{c.title}</h3>
                  </div>
                  {locked && (
                    <>
                      <div className="absolute top-3 right-3 bg-white rounded-pill px-2 py-1 flex items-center gap-1 text-[10px] font-bold text-brand-purple-700 shadow-sm">
                        <Lock className="w-3 h-3" />
                        {isPaid && dp?.final ? dp.final : 'פרימיום'}
                      </div>
                      {/* Centered lock badge + purchase CTA revealed on hover.
                          pointer-events-none so the whole card stays one click target. */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
                        <span className="w-14 h-14 rounded-full bg-black/40 backdrop-blur-sm ring-1 ring-white/20 flex items-center justify-center">
                          <Lock className="w-6 h-6 text-white" />
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-pill bg-white text-brand-purple-800 text-sm font-extrabold shadow-lg opacity-0 translate-y-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-0">
                          {isPaid ? (dp?.final ? `רכישה · ${dp.final}` : 'רכישה') : c.is_premium ? 'הצטרפות למועדון' : 'פתיחת גישה'}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                <div className="p-5">
                  {c.tagline && (
                    <p className="text-sm text-neutral-500 line-clamp-2 mb-4 min-h-[2.6em]">{c.tagline}</p>
                  )}
                  {cp && cp.total > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-[11px] text-neutral-500 mb-1.5">
                        <span className="tabular-nums">{cp.done} / {cp.total} שיעורים</span>
                        <span className="font-bold tabular-nums" style={{ color: 'var(--color-signal)' }}>{pct}%</span>
                      </div>
                      <div
                        className="h-1.5 rounded-pill overflow-hidden"
                        style={{ backgroundColor: 'var(--color-brand-purple-50)' }}
                      >
                        <div
                          className="h-full rounded-pill transition-all"
                          style={{ width: `${pct}%`, backgroundImage: 'var(--grad-progress)' }}
                        />
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-end">
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-purple-700 group-hover:text-brand-purple-500 transition-colors">
                      {locked
                        ? isPaid
                          ? dp?.final ? `רכישה · ${dp.final}` : 'רכישה'
                          : 'הצטרף'
                        : pct > 0 ? 'המשך' : 'התחל'}
                      <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
                    </span>
                  </div>
                </div>
              </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
