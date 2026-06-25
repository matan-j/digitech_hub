'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';

// Client mirror of lib/cart/cart-service#CartLine / CartSummary (kept local to
// avoid pulling a server-only module into the bundle).
export type CartLine = {
  content_type: string;
  content_id: string;
  slug: string;
  title: string;
  cover_url: string | null;
  price_before: number;
  price_after: number;
  hasDiscount: boolean;
  coupon_discount: number;
  currency: string;
  added_at: string;
};

export type AppliedCoupon = {
  code: string;
  discount: number;
  applies_to: 'all' | 'specific';
};

export type CartSummary = {
  items: CartLine[];
  total_before: number;
  total_after: number;
  coupon: AppliedCoupon | null;
  total_after_coupon: number;
  currency: string;
  count: number;
};

export type CheckoutResult =
  | { status: 'redirect'; url: string }
  | { status: 'pending' }
  | { status: 'phone_required' }
  | { status: 'error'; message?: string };

type CartContextValue = {
  cart: CartSummary;
  /** True once the first /api/cart load resolved (auth state known). */
  ready: boolean;
  open: boolean;
  busy: boolean;
  setOpen: (v: boolean) => void;
  has: (contentId: string) => boolean;
  refresh: () => Promise<void>;
  /** Add one unit; opens the cart on success. Returns whether it succeeded. */
  add: (slug: string, contentType?: string) => Promise<boolean>;
  remove: (contentId: string) => Promise<void>;
  /** Apply a coupon code. Returns whether it stuck + a message on failure. */
  applyCoupon: (code: string) => Promise<{ ok: boolean; message?: string }>;
  removeCoupon: () => Promise<void>;
  checkout: (phone?: string) => Promise<CheckoutResult>;
};

const EMPTY: CartSummary = {
  items: [],
  total_before: 0,
  total_after: 0,
  coupon: null,
  total_after_coupon: 0,
  currency: 'ILS',
  count: 0,
};

const CartContext = createContext<CartContextValue | null>(null);

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within <CartProvider>');
  return ctx;
}

// Optimistic recompute (used while a remove syncs). Carries the applied coupon
// forward; the server response reconciles the exact discount right after.
function recompute(items: CartLine[], coupon: AppliedCoupon | null): CartSummary {
  const total_before = items.reduce((s, i) => s + i.price_before, 0);
  const total_after = items.reduce((s, i) => s + i.price_after, 0);
  const keepCoupon = items.length > 0 ? coupon : null;
  const total_after_coupon = Math.max(0, total_after - (keepCoupon?.discount ?? 0));
  return {
    items,
    total_before,
    total_after,
    coupon: keepCoupon,
    total_after_coupon,
    currency: items[0]?.currency ?? 'ILS',
    count: items.length,
  };
}

export default function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartSummary>(EMPTY);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/cart', { cache: 'no-store' });
      setCart(res.ok ? ((await res.json()) as CartSummary) : EMPTY);
    } catch {
      setCart(EMPTY);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const add = useCallback(async (slug: string, contentType = 'course') => {
    setBusy(true);
    try {
      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, contentType }),
      });
      if (!res.ok) return false;
      setCart((await res.json()) as CartSummary);
      setOpen(true);
      return true;
    } catch {
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const remove = useCallback(async (contentId: string) => {
    setBusy(true);
    // Optimistic: drop it locally, then reconcile with the server response.
    setCart((prev) => recompute(prev.items.filter((i) => i.content_id !== contentId), prev.coupon));
    try {
      const res = await fetch('/api/cart', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentId }),
      });
      if (res.ok) setCart((await res.json()) as CartSummary);
    } finally {
      setBusy(false);
    }
  }, []);

  const applyCoupon = useCallback(async (code: string): Promise<{ ok: boolean; message?: string }> => {
    setBusy(true);
    try {
      const res = await fetch('/api/cart/coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setCart(d as CartSummary);
        return { ok: true };
      }
      return { ok: false, message: (d?.message as string) ?? 'הקופון לא תקף.' };
    } catch {
      return { ok: false, message: 'שגיאת רשת.' };
    } finally {
      setBusy(false);
    }
  }, []);

  const removeCoupon = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/cart/coupon', { method: 'DELETE' });
      if (res.ok) setCart((await res.json()) as CartSummary);
    } finally {
      setBusy(false);
    }
  }, []);

  const checkout = useCallback(async (phone?: string): Promise<CheckoutResult> => {
    setBusy(true);
    try {
      const res = await fetch('/api/cart/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(phone ? { phone } : {}),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d?.status === 'redirect' && typeof d?.url === 'string') {
        window.location.assign(d.url as string);
        return { status: 'redirect', url: d.url as string };
      }
      if (res.ok && typeof d?.redirect === 'string') {
        window.location.assign(d.redirect as string);
        return { status: 'pending' };
      }
      if (res.status === 400 && d?.error === 'phone_required') {
        return { status: 'phone_required' };
      }
      return {
        status: 'error',
        message:
          res.status === 502
            ? 'פתיחת התשלום נכשלה. נסו שוב עוד רגע.'
            : 'שגיאה בביצוע הרכישה. נסו שוב.',
      };
    } catch {
      return { status: 'error', message: 'שגיאת רשת.' };
    } finally {
      setBusy(false);
    }
  }, []);

  const has = useCallback(
    (contentId: string) => cart.items.some((i) => i.content_id === contentId),
    [cart],
  );

  return (
    <CartContext.Provider
      value={{ cart, ready, open, busy, setOpen, has, refresh, add, remove, applyCoupon, removeCoupon, checkout }}
    >
      {children}
    </CartContext.Provider>
  );
}
