import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, ArrowLeft, Lock, Check, Package, Layers } from 'lucide-react';
import { getPublicBundleWithCourses } from '@/lib/learn/db';
import { getCurrentUser, hasPremiumAccess } from '@/lib/auth';
import { renderMarkdownLite } from '@/lib/learn/markdown';
import { decideAccess, resolveAccessLevel, resolveDisplayPrice, formatPrice } from '@/lib/learn/access';
import { resolveFinalPrice } from '@/lib/payments/pricing';
import { hasActiveEntitlement, listOwnedResourceIds } from '@/lib/payments/entitlement-service';
import AccessActionButton from '@/components/learn/AccessActionButton';
import AddToCartButton from '@/components/cart/AddToCartButton';
import ShareButton from '@/components/learn/ShareButton';
import type { BundleCourseRef } from '@/lib/learn/types';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ bundle: string }> }) {
  const { bundle: slug } = await params;
  const b = await getPublicBundleWithCourses(slug);
  return { title: b ? `${b.title} — Digitech Learning Hub` : 'חבילה לא נמצאה' };
}

export default async function BundleLanding({ params }: { params: Promise<{ bundle: string }> }) {
  const { bundle: slug } = await params;
  // Service-client read (RLS-independent) so EVERY visitor — guest, buyer, or
  // admin — sees the same published bundle + its contained-course list.
  const bundle = await getPublicBundleWithCourses(slug);
  if (!bundle) notFound();

  const auth = await getCurrentUser();
  const hasPremium = !!auth && hasPremiumAccess(auth.profile);
  const level = resolveAccessLevel(bundle);
  // A bundle is unlocked by an active 'bundle' entitlement (the buyer) — same
  // model as courses. Owning it means the contained courses were granted too.
  const hasEntitlement =
    (level === 'purchase_required' || level === 'subscription_required') && !!auth
      ? await hasActiveEntitlement('bundle', bundle.id)
      : false;
  const decision = decideAccess(bundle, { loggedIn: !!auth, hasPremium, hasEntitlement });
  const owned = decision.state === 'full' && level !== 'open' && level !== 'login_required';

  // Mark contained courses the viewer already owns (purchased / gifted / via this bundle).
  const ownedCourseIds = auth ? await listOwnedResourceIds('course') : new Set<string>();

  const dp = resolveDisplayPrice(bundle);
  const returnTo = `/learn/bundles/${slug}`;

  // Value framing: sum the contained courses' individual prices to show the saving.
  const coursesValue = bundle.courses.reduce((sum, c) => sum + resolveFinalPrice(c).final, 0);
  const bundleFinal = resolveFinalPrice(bundle).final;
  const valueLabel = formatPrice(coursesValue, bundle.price_currency);
  const showSaving = coursesValue > 0 && bundleFinal > 0 && coursesValue > bundleFinal;

  const btnCls =
    'inline-flex items-center gap-2 px-5 py-2.5 rounded-pill bg-white text-brand-purple-800 text-sm font-bold hover:bg-brand-purple-50 transition-colors disabled:opacity-70';
  const errCls = 'text-xs text-red-200 mt-1.5';

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-8 max-w-5xl mx-auto">
      <Link
        href="/learn/courses"
        className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 mb-5"
      >
        <ArrowRight className="w-3.5 h-3.5" />
        חזרה לקטלוג
      </Link>

      <header
        className="rounded-2xl text-white px-6 sm:px-8 py-7 sm:py-8 mb-6 relative overflow-hidden"
        style={
          bundle.cover_url
            ? { backgroundImage: `linear-gradient(rgba(46,26,92,0.7), rgba(46,26,92,0.85)), url(${bundle.cover_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : { backgroundImage: 'linear-gradient(135deg, #2E1A5C 0%, #4A2E8F 60%, #5B3AAE 100%)' }
        }
      >
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-brand-purple-100 bg-white/10 backdrop-blur-sm px-2.5 py-1 rounded-pill mb-3">
            <Package className="w-3.5 h-3.5" />
            חבילה
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight">{bundle.title}</h1>
          {bundle.tagline && <p className="mt-2 text-base text-brand-purple-200">{bundle.tagline}</p>}

          <div className="mt-5 flex items-center gap-4 text-sm text-brand-purple-200">
            <span className="inline-flex items-center gap-1">
              <Layers className="w-4 h-4" />
              {bundle.courses.length} קורסים כלולים
            </span>
            {owned && (
              <span className="inline-flex items-center gap-1 text-emerald-200">
                <Check className="w-4 h-4" />
                ברשותך
              </span>
            )}
            <span className="ms-auto">
              <ShareButton path={returnTo} title={bundle.title} />
            </span>
          </div>

          <div className="mt-6">
            {owned ? (
              <Link href="/learn/courses" className={btnCls}>
                <ArrowLeft className="w-4 h-4" />
                לקורסים שלך
              </Link>
            ) : level === 'purchase_required' || level === 'subscription_required' ? (
              <div className="flex flex-col items-start gap-2">
                <div className="flex items-baseline gap-2.5">
                  {dp.final && <span className="text-2xl font-extrabold text-white">{dp.final}</span>}
                  {dp.hasDiscount && dp.original && (
                    <span className="text-sm text-brand-purple-200 line-through opacity-70">{dp.original}</span>
                  )}
                  {dp.hasDiscount && (
                    <span className="text-[11px] font-bold uppercase tracking-wide text-emerald-300">מבצע</span>
                  )}
                </div>
                {showSaving && valueLabel && (
                  <span className="text-xs text-brand-purple-200">
                    שווי הקורסים בנפרד: <span className="line-through">{valueLabel}</span> — חוסכים בחבילה
                  </span>
                )}
                <div className="flex flex-wrap items-center gap-2.5 mt-1">
                  <AccessActionButton
                    kind="purchase"
                    slug={slug}
                    contentType="bundle"
                    returnTo={returnTo}
                    label={dp.final ? `רכישה מהירה · ${dp.final}` : 'רכישה מהירה'}
                    className={btnCls}
                    errorClassName={errCls}
                    icon={<Lock className="w-4 h-4" />}
                  />
                  <AddToCartButton
                    slug={slug}
                    contentId={bundle.id}
                    contentType="bundle"
                    returnTo={returnTo}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-pill border border-white/40 text-white text-sm font-bold hover:bg-white/10 transition-colors disabled:opacity-70"
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-brand-purple-200">חבילה זו אינה זמינה לרכישה כרגע.</p>
            )}
          </div>
        </div>
      </header>

      {bundle.description && (
        <section className="bg-white rounded-2xl border border-neutral-200 p-6 mb-6">
          <h2 className="text-lg font-extrabold text-neutral-950 mb-3">על החבילה</h2>
          <div className="prose-learn" dangerouslySetInnerHTML={{ __html: renderMarkdownLite(bundle.description) }} />
        </section>
      )}

      <section className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200">
          <h2 className="text-lg font-extrabold text-neutral-950">
            מה כלול בחבילה <span className="text-neutral-400 font-normal">({bundle.courses.length})</span>
          </h2>
          <p className="text-sm text-neutral-500 mt-1">כל הקורסים האלה נפתחים אוטומטית מיד עם רכישת החבילה.</p>
        </div>
        {bundle.courses.length === 0 ? (
          <div className="p-12 text-center text-neutral-500 text-sm">עוד לא הוגדרו קורסים בחבילה זו.</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
            {bundle.courses.map((c) => (
              <IncludedCourseCard key={c.id} course={c} owned={ownedCourseIds.has(c.id)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/** A course inside the bundle — communicates "what you get" + its standalone value. */
function IncludedCourseCard({ course: c, owned }: { course: BundleCourseRef; owned: boolean }) {
  const dp = resolveDisplayPrice(c);
  return (
    <Link
      href={`/learn/courses/${c.slug}`}
      className="group block overflow-hidden rounded-card border border-neutral-200 bg-white transition-all hover:border-brand-purple-700"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div
        className="relative aspect-[16/9] bg-brand-purple-900"
        style={
          c.cover_url
            ? { backgroundImage: `url(${c.cover_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : { backgroundImage: 'linear-gradient(135deg, #2E1A5C 0%, #4B2E83 60%, #5F3E9C 100%)' }
        }
      >
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
        {owned && (
          <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-pill bg-emerald-500/95 px-2 py-1 text-[10px] font-extrabold text-white">
            <Check className="w-3 h-3" />
            ברשותך
          </span>
        )}
        <div className="absolute inset-0 flex items-end p-4">
          <h3 className="line-clamp-2 text-base font-extrabold leading-tight text-white">{c.title}</h3>
        </div>
      </div>
      <div className="flex items-center justify-between px-4 py-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-purple-700">
          <Check className="w-3.5 h-3.5" />
          כלול בחבילה
        </span>
        {dp.final && (
          <span className="inline-flex items-baseline gap-1.5 text-xs font-bold text-neutral-500">
            בשווי
            {dp.hasDiscount && dp.original && (
              <span className="text-neutral-400 line-through">{dp.original}</span>
            )}
            <span className="text-neutral-900">{dp.final}</span>
          </span>
        )}
      </div>
    </Link>
  );
}
