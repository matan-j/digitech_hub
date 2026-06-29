'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { popupSeenKey, type PublicPopup } from '@/lib/learn/popups';
import { PopupModal } from './PopupView';
import AccessModal, { type AccessRequest } from '@/components/auth/AccessModal';

/**
 * Global popup host. Mounted once in the root layout. Fetches the popups
 * eligible for the current path, filters out ones already seen (show_once),
 * then waits for each popup's trigger (time or scroll %) before showing the
 * single highest-priority one. Re-evaluates on client navigation.
 */
export default function PopupRenderer() {
  const pathname = usePathname();
  const [active, setActive] = useState<PublicPopup | null>(null);
  // Auth state (for `image_link_auth` popups) + the registration/login modal.
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [authRequest, setAuthRequest] = useState<AccessRequest | null>(null);

  // Track login state so we only wire the auth-image click for logged-out users.
  useEffect(() => {
    const supabase = createClient();
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setAuthed(Boolean(data.session));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthed(Boolean(session));
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

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

  // Only wire the auth-image click for logged-out visitors; a logged-in user
  // sees a plain image (the action is "register / log in").
  const onAuthAction =
    active?.image_link_auth && authed === false
      ? () => {
          setActive(null); // close the popup; AccessModal takes over
          setAuthRequest({ action: 'popup_cta', returnTo: pathname });
        }
      : undefined;

  return (
    <>
      {active && (
        <PopupModal
          popup={active}
          onClose={() => setActive(null)}
          onAuthAction={onAuthAction}
        />
      )}
      <AccessModal
        open={authRequest !== null}
        request={authRequest}
        onClose={() => setAuthRequest(null)}
      />
    </>
  );
}
