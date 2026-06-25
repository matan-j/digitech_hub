'use client';

import { useEffect, useState } from 'react';
import { Lock, ShieldCheck, X, Trash2, ShoppingBag, Loader2, Tag } from 'lucide-react';
import { useCart } from './CartProvider';

function shekel(n: number): string {
  return `₪${n % 1 === 0 ? n.toLocaleString('he-IL') : n.toFixed(2)}`;
}

/**
 * Global mini cart: a wide rounded bar docked to the bottom of every page that
 * expands to a full-screen panel on click. Renders nothing until the cart has
 * items (so it's invisible for guests / empty carts).
 *
 * z-index: the collapsed bar sits at z-40 — BELOW the mobile side menu (z-50) so
 * the menu always covers it. The expanded panel is z-[55] (a deliberate action).
 */
export default function MiniCart() {
  const { cart, ready, open, setOpen, busy, remove, applyCoupon, removeCoupon, checkout } = useCart();
  const [shown, setShown] = useState(false); // drives the slide-up transition
  const [coupon, setCoupon] = useState('');
  const [couponErr, setCouponErr] = useState<string | null>(null);
  const [needPhone, setNeedPhone] = useState(false);
  const [phone, setPhone] = useState('');
  const [err, setErr] = useState<string | null>(null);

  // Flip `shown` a frame after the panel mounts so it slides in. Closing is the
  // reverse, driven by close() (which sets shown=false before unmounting) — so we
  // never setState synchronously in this effect.
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => setShown(true), 10);
    return () => clearTimeout(id);
  }, [open]);

  function close() {
    setShown(false);
    setErr(null);
    setNeedPhone(false);
    setTimeout(() => setOpen(false), 250);
  }

  async function runCheckout(withPhone?: string) {
    setErr(null);
    const r = await checkout(withPhone);
    if (r.status === 'phone_required') {
      setOpen(true);
      setNeedPhone(true);
      return;
    }
    if (r.status === 'error') setErr(r.message ?? 'שגיאה. נסו שוב.');
    // redirect / pending → navigation happens inside checkout()
  }

  async function onApplyCoupon() {
    setCouponErr(null);
    const r = await applyCoupon(coupon.trim());
    if (r.ok) setCoupon('');
    else setCouponErr(r.message ?? 'הקופון לא תקף.');
  }

  if (!ready || cart.count === 0) return null;

  const saleDiscount = cart.total_before - cart.total_after;
  const couponDiscount = cart.coupon?.discount ?? 0;
  const payable = cart.total_after_coupon;
  const securePillCls =
    'inline-flex items-center gap-1.5 rounded-pill bg-white px-3.5 py-2 text-sm font-extrabold text-brand-purple-800 shadow-sm transition-colors hover:bg-brand-purple-50 disabled:opacity-70';

  return (
    <>
      {/* ---- Collapsed docked bar ---- */}
      <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3 pointer-events-none">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setOpen(true)}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setOpen(true)}
          className="pointer-events-auto mx-auto flex max-w-3xl cursor-pointer items-center justify-between gap-3 rounded-3xl bg-brand-purple-700 px-4 py-3 text-white shadow-2xl transition-colors hover:bg-brand-purple-600"
          dir="rtl"
        >
          {/* start (right in RTL): cart summary */}
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-white/15">
              <ShoppingBag className="h-4.5 w-4.5" />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-sm font-extrabold">סל הקניות · {cart.count}</span>
              <span className="text-xs text-white/80">{shekel(payable)}</span>
            </span>
          </div>
          {/* end (left in RTL): secure-purchase button with lock — visible while closed */}
          <button
            type="button"
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation();
              void runCheckout();
            }}
            className={securePillCls}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            רכישה מאובטחת
          </button>
        </div>
      </div>

      {/* ---- Expanded full-screen panel ---- */}
      {open && (
        <div className="fixed inset-0 z-[55]">
          <button
            type="button"
            aria-label="סגור"
            onClick={close}
            className={`absolute inset-0 bg-brand-purple-950/60 backdrop-blur-sm transition-opacity duration-300 ${
              shown ? 'opacity-100' : 'opacity-0'
            }`}
          />
          {/* Match the collapsed bar's footprint: centered, capped at max-w-3xl.
              On phones (< 768px) this is effectively full width. */}
          <div
            dir="rtl"
            className={`absolute inset-x-0 bottom-0 mx-auto flex max-h-[92vh] w-full max-w-3xl flex-col rounded-t-3xl bg-white shadow-2xl transition-transform duration-300 ease-out ${
              shown ? 'translate-y-0' : 'translate-y-full'
            }`}
          >
            {/* header */}
            <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
              <h2 className="flex items-center gap-2 text-lg font-extrabold text-neutral-950">
                <ShoppingBag className="h-5 w-5 text-brand-purple-700" />
                סל הקניות
                <span className="text-sm font-semibold text-neutral-400">({cart.count})</span>
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="סגור"
                className="rounded-pill p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* items */}
            <ul className="flex-1 divide-y divide-neutral-100 overflow-y-auto px-5">
              {cart.items.map((it) => (
                <li key={it.content_id} className="flex items-center gap-3 py-3">
                  <div
                    className="h-14 w-20 shrink-0 rounded-xl bg-brand-purple-900 bg-cover bg-center"
                    style={
                      it.cover_url
                        ? { backgroundImage: `url(${it.cover_url})` }
                        : { backgroundImage: 'linear-gradient(135deg, #2E1A5C 0%, #5F3E9C 100%)' }
                    }
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-bold text-neutral-900">{it.title}</p>
                    {(() => {
                      const lineCoupon = it.coupon_discount ?? 0;
                      const lineFinal = Math.max(0, it.price_after - lineCoupon);
                      return (
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="text-sm font-extrabold text-brand-purple-700">
                            {shekel(lineFinal)}
                          </span>
                          {lineCoupon > 0 ? (
                            <>
                              <span className="text-xs text-neutral-400 line-through">
                                {shekel(it.price_after)}
                              </span>
                              <span className="inline-flex items-center gap-1 rounded-pill bg-brand-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-purple-700">
                                <Tag className="h-2.5 w-2.5" />
                                קופון −{shekel(lineCoupon)}
                              </span>
                            </>
                          ) : it.hasDiscount ? (
                            <>
                              <span className="text-xs text-neutral-400 line-through">
                                {shekel(it.price_before)}
                              </span>
                              <span className="rounded-pill bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                                חיסכון {shekel(it.price_before - it.price_after)}
                              </span>
                            </>
                          ) : null}
                        </div>
                      );
                    })()}
                  </div>
                  <button
                    type="button"
                    onClick={() => void remove(it.content_id)}
                    disabled={busy}
                    aria-label="הסר מהסל"
                    title="הסר מהסל"
                    className="rounded-pill p-2 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>

            {/* footer: coupon + summary + checkout */}
            <div className="space-y-3 border-t border-neutral-100 px-5 py-4">
              {/* coupon — one per cart (no stacking). Applied → chip with an X. */}
              <div>
                {cart.coupon ? (
                  <div className="flex items-center justify-between gap-2 rounded-pill border border-emerald-200 bg-emerald-50 py-2 pr-3 pl-1.5">
                    <span className="inline-flex min-w-0 items-center gap-1.5 text-sm font-bold text-emerald-700">
                      <Tag className="h-4 w-4 shrink-0" />
                      <span className="truncate font-mono" dir="ltr">{cart.coupon.code}</span>
                      <span className="font-semibold">· −{shekel(couponDiscount)}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => void removeCoupon()}
                      disabled={busy}
                      aria-label="הסר קופון"
                      title="הסר קופון"
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-emerald-600 transition-colors hover:bg-emerald-100 disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Tag className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                        <input
                          type="text"
                          value={coupon}
                          onChange={(e) => { setCoupon(e.target.value.toUpperCase()); setCouponErr(null); }}
                          onKeyDown={(e) => { if (e.key === 'Enter' && coupon.trim()) void onApplyCoupon(); }}
                          placeholder="קוד קופון"
                          dir="ltr"
                          className="w-full rounded-pill border border-neutral-200 bg-neutral-50 py-2.5 pr-9 pl-3 text-left text-sm font-mono uppercase text-neutral-900 outline-none focus:border-brand-purple-400"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => void onApplyCoupon()}
                        disabled={busy || coupon.trim().length === 0}
                        className="rounded-pill border border-brand-purple-200 px-4 py-2.5 text-sm font-bold text-brand-purple-700 transition-colors hover:bg-brand-purple-50 disabled:opacity-50"
                      >
                        החל
                      </button>
                    </div>
                    {couponErr && <p className="mt-1.5 pr-1 text-xs text-red-600">{couponErr}</p>}
                  </>
                )}
              </div>

              {/* summary */}
              <dl className="space-y-1 text-sm">
                <div className="flex items-center justify-between text-neutral-500">
                  <dt>סכום ביניים</dt>
                  <dd>{shekel(cart.total_before)}</dd>
                </div>
                {saleDiscount > 0 && (
                  <div className="flex items-center justify-between text-emerald-600">
                    <dt>הנחה</dt>
                    <dd>−{shekel(saleDiscount)}</dd>
                  </div>
                )}
                {couponDiscount > 0 && (
                  <div className="flex items-center justify-between text-emerald-600">
                    <dt>קופון {cart.coupon?.code}</dt>
                    <dd>−{shekel(couponDiscount)}</dd>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-neutral-100 pt-1.5 text-base font-extrabold text-neutral-950">
                  <dt>סה״כ לתשלום</dt>
                  <dd>{shekel(payable)}</dd>
                </div>
              </dl>

              {/* phone (only if the server asked for it) */}
              {needPhone && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-neutral-600">
                    מספר טלפון להשלמת הרכישה
                  </label>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="05X-XXXXXXX"
                    dir="ltr"
                    className="w-full rounded-pill border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-neutral-900 outline-none focus:border-brand-purple-400"
                  />
                </div>
              )}

              {err && <p className="text-xs text-red-600">{err}</p>}

              <button
                type="button"
                disabled={busy || (needPhone && phone.trim().length < 9)}
                onClick={() => void runCheckout(needPhone ? phone.trim() : undefined)}
                className="flex w-full items-center justify-center gap-2 rounded-pill bg-brand-purple-700 px-4 py-3 text-sm font-extrabold text-white transition-colors hover:bg-brand-purple-600 disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                רכישה מאובטחת · {shekel(payable)}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
