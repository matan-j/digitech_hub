import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { ContentItem } from '@/lib/learn/types';
import { resolveAccessLevel, resolveDisplayPrice } from '@/lib/learn/access';
import ShareButton from '@/components/learn/ShareButton';
import CourseLockOverlay from '@/components/learn/CourseLockOverlay';

/**
 * Canonical course card for the catalog and the learn hub. Reads the access
 * model to decide whether to show the locked overlay; an active entitlement
 * (`owned`) or a subscription/admin (`canSeePremium`) renders it unlocked.
 */
export default function CourseCard({
  course: c,
  owned = false,
  canSeePremium = false,
  progressPct = 0,
}: {
  course: ContentItem;
  owned?: boolean;
  canSeePremium?: boolean;
  progressPct?: number;
}) {
  const level = resolveAccessLevel(c);
  const isPaid = level === 'purchase_required';
  const dp = isPaid ? resolveDisplayPrice(c) : null;
  const hasAccess = owned || canSeePremium;
  const locked = !hasAccess && (isPaid || c.is_premium || level === 'subscription_required');
  const pct = progressPct > 0 ? progressPct : 0;

  return (
    <div className="relative">
      {/* Share button sits opposite the lock tag; it's a sibling of the card
          <Link> so we never nest a <button> inside an <a>. */}
      <div className="absolute top-3 left-3 z-10">
        <ShareButton path={`/learn/courses/${c.slug}`} title={c.title} />
      </div>
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
          <div className="absolute inset-0 flex flex-col justify-end p-5">
            {c.audience && (
              <span className="inline-flex items-center self-start rounded-pill bg-white/12 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/85 backdrop-blur-sm">
                {c.audience}
              </span>
            )}
            <h3 className="mt-2.5 line-clamp-2 text-lg font-extrabold leading-tight text-white">{c.title}</h3>
          </div>

          <CourseLockOverlay
            locked={locked}
            priceFinal={dp?.final}
            priceOriginal={dp?.original}
            hasDiscount={dp?.hasDiscount}
          />
        </div>

        <div className="p-5">
          {c.tagline && (
            <p className="mb-4 line-clamp-2 min-h-[2.6em] text-sm text-neutral-500">{c.tagline}</p>
          )}
          {pct > 0 && (
            <div className="mb-4">
              <div className="mb-1.5 flex items-center justify-between text-[11px] text-neutral-500">
                <span className="tabular-nums">{pct}% הושלם</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-pill" style={{ backgroundColor: 'var(--color-brand-purple-50)' }}>
                <div
                  className="h-full rounded-pill transition-all"
                  style={{ width: `${pct}%`, backgroundImage: 'var(--grad-progress)' }}
                />
              </div>
            </div>
          )}
          <div className="flex items-center justify-end">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-purple-700 transition-colors group-hover:text-brand-purple-500">
              {locked
                ? isPaid
                  ? dp?.final ? `רכישה · ${dp.final}` : 'רכישה'
                  : 'הצטרף'
                : pct > 0 ? 'המשך' : 'התחל'}
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}
