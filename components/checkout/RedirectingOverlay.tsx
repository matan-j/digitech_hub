'use client';

import { useEffect, useState } from 'react';
import { Loader2, Lock } from 'lucide-react';

/** Seconds counter — mounts only while the overlay is shown, so it starts at 0. */
function ElapsedSeconds() {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span
      dir="ltr"
      className="rounded-pill bg-white/15 px-4 py-1.5 font-mono text-sm font-bold tabular-nums text-white"
    >
      {secs}s
    </span>
  );
}

/**
 * Full-screen "we're opening your payment link" overlay. The GROW link is created
 * synchronously through the Make.com webhook, so the buyer waits a few seconds
 * between click and redirect — this keeps them informed (spinner + reassurance)
 * and shows a rising seconds counter so the wait feels accounted for rather than
 * frozen. Sits above the mini-cart panel (z-[55]) at z-[80].
 *
 * Render it unconditionally and toggle `show`; the counter mounts fresh each time
 * and the page navigation (window.location.assign) tears it down with the old
 * document.
 */
export default function RedirectingOverlay({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <div
      dir="rtl"
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-5 bg-brand-purple-950/75 px-6 text-center backdrop-blur-sm"
    >
      <Loader2 className="h-12 w-12 animate-spin text-white" />
      <div className="flex flex-col items-center gap-1.5">
        <p className="text-lg font-extrabold text-white">מעבירים אותך לדף התשלום…</p>
        <p className="inline-flex items-center gap-1.5 text-sm text-white/80">
          <Lock className="h-3.5 w-3.5" />
          פותחים עבורך קישור תשלום מאובטח
        </p>
      </div>
      <ElapsedSeconds />
    </div>
  );
}
