'use client';

import { useState } from 'react';
import { Share2, Check, Loader2 } from 'lucide-react';

type State = 'idle' | 'loading' | 'success' | 'error';

/**
 * Small share control for content cards. Mints (or reuses) a shortened link for
 * the given same-origin `path`, then shares it via the native Web Share API when
 * available, falling back to copy-to-clipboard. Mirrors the share/copy pattern in
 * CreatorProfileView, but the URL handed out is always the shortened one.
 */
type Variant = 'overlay' | 'inline';

// `overlay` (default): white/blur pill for placing over dark cover images.
// `inline`: purple-tinted pill that stays visible on light/white backgrounds
// (e.g. a guide's meta row).
const VARIANT_CLASSES: Record<Variant, string> = {
  overlay: 'bg-white/90 backdrop-blur-sm text-brand-purple-700 shadow-sm hover:bg-white hover:text-brand-purple-500',
  inline: 'bg-brand-purple-50 text-brand-purple-700 hover:bg-brand-purple-100',
};

export default function ShareButton({
  path,
  title,
  variant = 'overlay',
}: {
  path: string;
  title?: string;
  variant?: Variant;
}) {
  const [state, setState] = useState<State>('idle');

  async function getShortUrl(): Promise<string> {
    const res = await fetch('/api/short-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.code) throw new Error(data.error ?? 'short_link_failed');
    return `${window.location.origin}/s/${data.code}`;
  }

  async function onShare(e: React.MouseEvent) {
    // The card is wrapped by a <Link>; don't navigate when sharing.
    e.preventDefault();
    e.stopPropagation();
    if (state === 'loading') return;

    setState('loading');
    try {
      const url = await getShortUrl();

      // Captured as a boolean so TS doesn't narrow `navigator` to `never` on the
      // clipboard fallback path (`'share' in navigator` would do exactly that,
      // since the DOM lib types always declare Navigator.share).
      const canShare =
        typeof navigator !== 'undefined' && typeof navigator.share === 'function';

      if (canShare) {
        await navigator.share({ title: title ?? document.title, url });
        setState('idle');
        return;
      }

      await navigator.clipboard.writeText(url);
      setState('success');
      setTimeout(() => setState('idle'), 1800);
    } catch (err) {
      // User dismissed the native share sheet — not an error.
      if (err instanceof DOMException && err.name === 'AbortError') {
        setState('idle');
        return;
      }
      setState('error');
      setTimeout(() => setState('idle'), 2200);
    }
  }

  const Icon = state === 'loading' ? Loader2 : state === 'success' ? Check : Share2;
  const label =
    state === 'success' ? 'הקישור הועתק' : state === 'error' ? 'שגיאה — נסו שוב' : 'שתף';

  return (
    <button
      type="button"
      onClick={onShare}
      disabled={state === 'loading'}
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center w-8 h-8 rounded-pill disabled:opacity-60 transition-colors ${VARIANT_CLASSES[variant]}`}
    >
      <Icon
        className={`w-4 h-4 ${state === 'loading' ? 'animate-spin' : ''} ${
          state === 'success' ? 'text-emerald-600' : state === 'error' ? 'text-red-600' : ''
        }`}
      />
    </button>
  );
}
