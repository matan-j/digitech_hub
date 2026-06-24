'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

type Props = {
  /** Full prompt / template text. Line breaks preserved. */
  code: string;
  /** Optional header label, e.g. "Prompt מוכן להעתקה". */
  label?: string;
};

const DEFAULT_LABEL = 'Prompt מוכן להעתקה';

/** Treat empty / "none" / "null" placeholders as no label. */
function cleanLabel(label?: string): string {
  const t = (label ?? '').trim();
  if (!t || /^(none|null|undefined)$/i.test(t)) return DEFAULT_LABEL;
  return t;
}

/**
 * Reusable copy-able prompt / template block. Used across guides,
 * lessons, playbooks and AI templates. Mobile-safe, RTL-aware,
 * accessible copy control (≥44px touch target).
 */
export default function PromptBlock({ code, label }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (insecure context) — select fallback.
      const ta = document.createElement('textarea');
      ta.value = code;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* noop */ }
      document.body.removeChild(ta);
    }
  }

  return (
    <div className="prompt-block" dir="rtl">
      <div className="prompt-block__bar">
        <span className="prompt-block__label">{cleanLabel(label)}</span>
        <button
          type="button"
          onClick={copy}
          className="prompt-block__copy"
          aria-label={copied ? 'הועתק ללוח' : 'העתק את הטקסט ללוח'}
          aria-live="polite"
        >
          {copied ? <Check className="w-4 h-4" aria-hidden /> : <Copy className="w-4 h-4" aria-hidden />}
          <span>{copied ? 'הועתק' : 'העתקה'}</span>
        </button>
      </div>
      <pre className="prompt-block__content" dir="auto">{code}</pre>
    </div>
  );
}
