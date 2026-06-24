'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Share2, Link2, Check, Loader2, Mail } from 'lucide-react';
import { WhatsappIcon, FacebookIcon, XIcon, LinkedinIcon } from '@/components/icons/social';

type Variant = 'overlay' | 'inline';

// `overlay` (default): white/blur pill for placing over dark cover images.
// `inline`: purple-tinted pill that stays visible on light/white backgrounds.
const VARIANT_CLASSES: Record<Variant, string> = {
  overlay: 'bg-white/90 backdrop-blur-sm text-brand-purple-700 shadow-sm hover:bg-white hover:text-brand-purple-500',
  inline: 'bg-brand-purple-50 text-brand-purple-700 hover:bg-brand-purple-100',
};

const MENU_WIDTH = 224; // w-56

type LinkStatus = 'idle' | 'loading' | 'error';

/**
 * Share control: opens a small in-app dropdown menu with platform targets
 * (WhatsApp / Facebook / X / LinkedIn / email) plus copy-to-clipboard. The link
 * handed out is always the shortened /s/<code> URL, generated on demand the first
 * time the menu opens. The menu is portalled to <body> so it isn't clipped by
 * `overflow-hidden` ancestors (cover images, course header).
 */
export default function ShareButton({
  path,
  title,
  variant = 'overlay',
}: {
  path: string;
  title?: string;
  variant?: Variant;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; up: boolean }>({
    top: 0,
    left: 0,
    up: false,
  });
  const [url, setUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<LinkStatus>('idle');
  const [copied, setCopied] = useState(false);

  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  async function ensureShortUrl(): Promise<void> {
    if (url || status === 'loading') return;
    setStatus('loading');
    try {
      const res = await fetch('/api/short-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.code) throw new Error(data.error ?? 'short_link_failed');
      setUrl(`${window.location.origin}/s/${data.code}`);
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  }

  function toggle(e: React.MouseEvent) {
    // The card may be wrapped by a <Link>; don't navigate when sharing.
    e.preventDefault();
    e.stopPropagation();
    if (open) {
      setOpen(false);
      return;
    }
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      // Prefer aligning the menu's right edge to the button (RTL), but clamp
      // into the viewport so it never spills off-screen — on mobile the button
      // sits near the left edge, so the menu opens rightward instead.
      const openUp = rect.bottom + 280 > window.innerHeight && rect.top > 280;
      const maxLeft = Math.max(8, window.innerWidth - MENU_WIDTH - 8);
      const left = Math.min(Math.max(8, rect.right - MENU_WIDTH), maxLeft);
      setCoords({
        top: openUp ? rect.top - 8 : rect.bottom + 8,
        left,
        up: openUp,
      });
    }
    setCopied(false);
    setOpen(true);
    void ensureShortUrl();
  }

  // Close on outside click / Escape / scroll / resize.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(ev: MouseEvent) {
      const t = ev.target as Node;
      if (menuRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(ev: KeyboardEvent) {
      if (ev.key === 'Escape') setOpen(false);
    }
    function onReflow() {
      setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onReflow, true);
    window.addEventListener('resize', onReflow);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onReflow, true);
      window.removeEventListener('resize', onReflow);
    };
  }, [open]);

  async function copyLink() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setOpen(false);
      }, 1200);
    } catch {
      setStatus('error');
    }
  }

  const shareText = title ?? 'תוכן מ-DigiTech HUB';
  const targets = url
    ? [
        {
          key: 'whatsapp',
          label: 'WhatsApp',
          Icon: WhatsappIcon,
          href: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${url}`)}`,
        },
        {
          key: 'facebook',
          label: 'Facebook',
          Icon: FacebookIcon,
          href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
        },
        {
          key: 'x',
          label: 'X',
          Icon: XIcon,
          href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareText)}`,
        },
        {
          key: 'linkedin',
          label: 'LinkedIn',
          Icon: LinkedinIcon,
          href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
        },
        {
          key: 'email',
          label: 'אימייל',
          Icon: Mail,
          href: `mailto:?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent(url)}`,
        },
      ]
    : [];

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="שתף"
        title="שתף"
        className={`inline-flex items-center justify-center w-8 h-8 rounded-pill transition-colors ${VARIANT_CLASSES[variant]}`}
      >
        <Share2 className="w-4 h-4" />
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            dir="rtl"
            className="fixed z-[60] rounded-card border border-neutral-200 bg-white py-1.5 text-right"
            style={{
              top: coords.top,
              left: coords.left,
              width: MENU_WIDTH,
              transform: coords.up ? 'translateY(-100%)' : undefined,
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <p className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-400">שיתוף</p>

            {status === 'loading' && (
              <div className="flex items-center gap-2 px-3 py-2.5 text-sm text-neutral-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                מכין קישור…
              </div>
            )}

            {status === 'error' && (
              <button
                type="button"
                onClick={() => void ensureShortUrl()}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-red-600 hover:bg-neutral-50"
              >
                שגיאה ביצירת קישור — נסו שוב
              </button>
            )}

            {url && (
              <>
                {targets.map((t) => (
                  <a
                    key={t.key}
                    href={t.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    role="menuitem"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-neutral-700 hover:bg-brand-purple-50 hover:text-brand-purple-700"
                  >
                    <t.Icon className="w-4 h-4 shrink-0" />
                    {t.label}
                  </a>
                ))}

                <div className="my-1 border-t border-neutral-100" />

                <button
                  type="button"
                  onClick={copyLink}
                  role="menuitem"
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-neutral-700 hover:bg-brand-purple-50 hover:text-brand-purple-700"
                >
                  {copied ? (
                    <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                  ) : (
                    <Link2 className="w-4 h-4 shrink-0" />
                  )}
                  {copied ? 'הקישור הועתק' : 'העתק קישור'}
                </button>
              </>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
