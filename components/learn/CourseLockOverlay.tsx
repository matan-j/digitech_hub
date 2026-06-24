import { Lock, ShieldCheck } from 'lucide-react';

/**
 * Locked-state overlay for a course cover. Drop it as the LAST child of a
 * `relative` cover container whose card root has the `group` class:
 *   - a dim scrim that signals "locked" (deepens slightly on hover)
 *   - a price/premium tag (top-right) that shows the sale price when discounted
 *   - a centered low-opacity black disc with a white lock icon
 *   - a "רכישה מאובטחת" pill revealed on hover (no price — price lives in the tag)
 * Renders nothing when not locked.
 */
export default function CourseLockOverlay({
  locked,
  priceFinal,
  priceOriginal,
  hasDiscount = false,
  premiumLabel = 'פרימיום',
}: {
  locked: boolean;
  priceFinal?: string | null;
  priceOriginal?: string | null;
  hasDiscount?: boolean;
  premiumLabel?: string;
}) {
  if (!locked) return null;
  return (
    <>
      <div
        aria-hidden
        className="absolute inset-0 bg-neutral-950/45 transition-colors duration-200 group-hover:bg-neutral-950/55"
      />

      <div className="absolute top-3 right-3 z-10 inline-flex items-center gap-1 rounded-pill bg-white/95 px-2 py-1 text-[10px] font-extrabold text-brand-purple-700 shadow-sm">
        <Lock className="h-3 w-3" />
        {priceFinal ? (
          hasDiscount && priceOriginal ? (
            <span className="inline-flex items-center gap-1">
              <span className="font-semibold text-neutral-400 line-through">{priceOriginal}</span>
              <span>{priceFinal}</span>
            </span>
          ) : (
            priceFinal
          )
        ) : (
          premiumLabel
        )}
      </div>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/35 shadow-lg">
          <Lock className="h-6 w-6 text-white" />
        </span>
        <span className="inline-flex translate-y-1 items-center gap-1.5 rounded-pill bg-white px-4 py-2 text-sm font-extrabold text-brand-purple-800 opacity-0 shadow-lg transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
          <ShieldCheck className="h-4 w-4" />
          רכישה מאובטחת
        </span>
      </div>
    </>
  );
}
