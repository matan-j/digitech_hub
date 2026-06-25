'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { popupSeenKey, type PublicPopup } from '@/lib/learn/popups';
import { PopupModal } from './PopupView';

/**
 * Global popup host. Mounted once in the root layout. Fetches the popups
 * eligible for the current path, filters out ones already seen (show_once),
 * then waits for each popup's trigger (time or scroll %) before showing the
 * single highest-priority one. Re-evaluates on client navigation.
 */
export default function PopupRenderer() {
  const pathname = usePathname();
  const [active, setActive] = useState<PublicPopup | null>(null);

  useEffect(() => {
    // Don't run inside the admin / CMS areas.
    if (pathname.startsWith('/admin') || pathname.startsWith('/cms')) return;

    let alive = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let scrollHandler: (() => void) | null = null;
    setActive(null);

    (async () => {
      let items: PublicPopup[] = [];
      try {
        const res = await fetch(`/api/popups?path=${encodeURIComponent(pathname)}`, {
          cache: 'no-store',
        });
        const data = await res.json();
        items = Array.isArray(data.items) ? (data.items as PublicPopup[]) : [];
      } catch {
        return;
      }
      if (!alive) return;

      // Drop already-seen popups (show_once) — sorted by priority from the API.
      const candidates = items.filter((p) => {
        if (!p.show_once) return true;
        try {
          return localStorage.getItem(popupSeenKey(p.id)) === null;
        } catch {
          return true;
        }
      });
      if (!candidates.length) return;

      const show = (p: PublicPopup) => {
        if (!alive || active) return;
        setActive(p);
        if (p.show_once) {
          try {
            localStorage.setItem(popupSeenKey(p.id), '1');
          } catch {
            /* ignore */
          }
        }
      };

      // Arm the trigger for the top candidate.
      const top = candidates[0];
      if (top.trigger_type === 'time') {
        timers.push(setTimeout(() => show(top), Math.max(0, top.trigger_value) * 1000));
      } else {
        const onScroll = () => {
          const doc = document.documentElement;
          const scrollable = doc.scrollHeight - doc.clientHeight;
          const pct = scrollable <= 0 ? 100 : (doc.scrollTop / scrollable) * 100;
          if (pct >= top.trigger_value) {
            show(top);
            if (scrollHandler) window.removeEventListener('scroll', scrollHandler);
          }
        };
        scrollHandler = onScroll;
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll(); // in case already past threshold (short pages)
      }
    })();

    return () => {
      alive = false;
      timers.forEach(clearTimeout);
      if (scrollHandler) window.removeEventListener('scroll', scrollHandler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!active) return null;
  return <PopupModal popup={active} onClose={() => setActive(null)} />;
}
