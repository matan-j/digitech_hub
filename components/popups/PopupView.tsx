'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { popupVideoEmbed, type PopupContentType } from '@/lib/learn/popups';

/** The content fields PopupContent / PopupModal need to render. */
export type PopupViewData = {
  content_type: PopupContentType;
  image_url: string | null;
  image_link: string | null;
  image_link_new_tab: boolean;
  image_link_auth: boolean;
  html: string | null;
  iframe_url: string | null;
  video_url: string | null;
  corner_radius: number;
  max_width: number;
};

/**
 * Renders just the inner media of a popup (no chrome).
 *
 * `onAuthAction` — when provided AND the popup is configured with
 * `image_link_auth`, clicking the image fires this instead of navigating to a
 * URL (the host opens the registration/login modal). The host passes it only
 * for logged-out visitors, so a logged-in user gets a plain, non-clickable
 * image. It is undefined in the admin preview.
 */
export function PopupContent({
  popup,
  onAuthAction,
}: {
  popup: PopupViewData;
  onAuthAction?: () => void;
}) {
  switch (popup.content_type) {
    case 'image': {
      if (!popup.image_url) {
        return <div className="p-10 text-center text-neutral-400 text-sm">לא הועלתה תמונה</div>;
      }
      // eslint-disable-next-line @next/next/no-img-element
      const img = <img src={popup.image_url} alt="" className="block w-full h-auto" />;
      // Auth action takes precedence over a plain URL link.
      if (popup.image_link_auth && onAuthAction) {
        return (
          <button type="button" onClick={onAuthAction} className="block w-full cursor-pointer">
            {img}
          </button>
        );
      }
      if (popup.image_link && !popup.image_link_auth) {
        return (
          <a
            href={popup.image_link}
            {...(popup.image_link_new_tab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className="block"
          >
            {img}
          </a>
        );
      }
      return img;
    }
    case 'rich_text':
    case 'html':
      return (
        <div
          className="p-6 text-neutral-800 leading-relaxed [&_a]:text-brand-purple-700 [&_a]:underline [&_h2]:text-xl [&_h2]:font-extrabold [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pr-5 [&_img]:max-w-full"
          dir="rtl"
          dangerouslySetInnerHTML={{ __html: popup.html ?? '' }}
        />
      );
    case 'iframe':
      return popup.iframe_url ? (
        <iframe
          src={popup.iframe_url}
          className="block w-full"
          style={{ height: 'min(70vh, 560px)', border: 'none' }}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        />
      ) : (
        <div className="p-10 text-center text-neutral-400 text-sm">לא הוגדרה כתובת IFRAME</div>
      );
    case 'video': {
      if (!popup.video_url) {
        return <div className="p-10 text-center text-neutral-400 text-sm">לא הוגדר וידאו</div>;
      }
      const v = popupVideoEmbed(popup.video_url);
      if (v.kind === 'iframe') {
        return (
          <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%' }}>
            <iframe
              src={v.src}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
              title="video"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
            />
          </div>
        );
      }
      return <video src={v.src} controls className="block w-full" style={{ maxHeight: '70vh' }} />;
    }
    default:
      return null;
  }
}

/**
 * Full modal chrome: dimmed overlay, centered card, fade in/out, X button
 * (top-left), click-outside to close, corner radius + max width. Reused by the
 * public renderer and the admin live preview.
 */
export function PopupModal({
  popup,
  onClose,
  onAuthAction,
  embedded = false,
}: {
  popup: PopupViewData;
  onClose: () => void;
  /** Fired when a logged-out visitor clicks an `image_link_auth` image. */
  onAuthAction?: () => void;
  /** When true, renders absolutely within its parent (admin preview) instead of fixed full-screen. */
  embedded?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const closingRef = useRef(false);

  useEffect(() => {
    // next tick → triggers the fade-in transition
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  function handleClose() {
    if (closingRef.current) return;
    closingRef.current = true;
    setVisible(false);
    setTimeout(onClose, 220); // wait for fade-out
  }

  useEffect(() => {
    if (embedded) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedded]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={handleClose}
      className={[
        embedded ? 'absolute' : 'fixed',
        'inset-0 z-[9999] flex items-center justify-center p-4 transition-opacity duration-200',
        visible ? 'opacity-100' : 'opacity-0',
      ].join(' ')}
      style={{ backgroundColor: 'rgba(15, 12, 30, 0.55)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={[
          'relative bg-white overflow-hidden shadow-2xl w-full transition-all duration-200',
          visible ? 'scale-100' : 'scale-95',
        ].join(' ')}
        style={{
          maxWidth: `${popup.max_width}px`,
          borderRadius: `${popup.corner_radius}px`,
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <button
          type="button"
          onClick={handleClose}
          aria-label="סגירה"
          className="absolute top-3 left-3 z-10 flex items-center justify-center w-9 h-9 rounded-full bg-white/85 hover:bg-white text-neutral-700 hover:text-neutral-950 shadow-md transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        <PopupContent popup={popup} onAuthAction={onAuthAction} />
      </div>
    </div>
  );
}
