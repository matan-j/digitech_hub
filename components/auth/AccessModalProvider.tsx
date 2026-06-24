'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createClient } from '@/lib/supabase/client';
import AccessModal, { type AccessRequest } from '@/components/auth/AccessModal';
import {
  readPendingLead,
  clearPendingLead,
  stashPendingLead,
  type PendingLead,
} from '@/lib/learn/attribution';

type RequireAccessArgs = AccessRequest & {
  /** Runs immediately if the user is already authenticated. */
  run?: () => void;
};

type AccessGate = {
  /** Whether the current viewer is authenticated (best-effort, client-side). */
  isAuthed: boolean;
  /**
   * Gate a high-intent action. If the viewer is anonymous, opens the AccessModal
   * and remembers the intent; if authed, runs `run` immediately.
   */
  requireAccess: (args: RequireAccessArgs) => void;
};

const Ctx = createContext<AccessGate | null>(null);

export function useAccessGate(): AccessGate {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error('useAccessGate must be used within <AccessModalProvider>');
  }
  return ctx;
}

export default function AccessModalProvider({
  initialAuthed = false,
  children,
}: {
  /** Server-known auth state, to avoid a flash before the client check. */
  initialAuthed?: boolean;
  children: React.ReactNode;
}) {
  const [isAuthed, setIsAuthed] = useState(initialAuthed);
  const [open, setOpen] = useState(false);
  const [request, setRequest] = useState<AccessRequest | null>(null);
  const capturedOnce = useRef(false);

  const requireAccess = useCallback(
    (args: RequireAccessArgs) => {
      const { run, ...req } = args;
      if (isAuthed) {
        run?.();
        return;
      }
      // Stash intent immediately so it survives even if the user reloads.
      stashPendingLead({
        intended_action: req.action,
        return_to: req.returnTo,
      });
      setRequest(req);
      setOpen(true);
    },
    [isAuthed],
  );

  /**
   * Write any pending lead data once a session appears. Fires on mount and on
   * auth-state changes. Best-effort: a failure here must not block the UI.
   */
  const flushPending = useCallback(async (pending: PendingLead | null) => {
    if (!pending || capturedOnce.current) return;
    capturedOnce.current = true;

    const supabase = createClient();
    const provider =
      (await supabase.auth.getSession()).data.session?.user.app_metadata
        ?.provider ?? undefined;

    try {
      await fetch('/api/leads/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: pending.full_name,
          phone: pending.phone,
          auth_provider: provider,
          marketing_consent: pending.marketing_consent,
          // Reaching flush means the user completed auth through the gate, where
          // accepting terms is a precondition of the magic-link path; record it.
          terms_accepted: true,
          intended_action: pending.intended_action,
          referrer: pending.referrer,
          utm_source: pending.utm_source,
          utm_medium: pending.utm_medium,
          utm_campaign: pending.utm_campaign,
          utm_content: pending.utm_content,
          first_guide_touchpoint: pending.first_guide_touchpoint,
          first_creator_touchpoint: pending.first_creator_touchpoint,
          first_course_touchpoint: pending.first_course_touchpoint,
          registration_source: pending.registration_source,
        }),
      });
    } catch {
      capturedOnce.current = false; // allow a retry on next auth event
      return;
    }
    clearPendingLead();
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    // Initial check: if already authed and pending data exists, flush it.
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const authed = Boolean(data.session);
      setIsAuthed(authed);
      if (authed) void flushPending(readPendingLead());
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const authed = Boolean(session);
      setIsAuthed(authed);
      if (authed) void flushPending(readPendingLead());
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [flushPending]);

  return (
    <Ctx.Provider value={{ isAuthed, requireAccess }}>
      {children}
      <AccessModal open={open} request={request} onClose={() => setOpen(false)} />
    </Ctx.Provider>
  );
}
