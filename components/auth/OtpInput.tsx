'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  /** Number of digits in the code. */
  length?: number;
  /** Called on every change with the joined value (may be shorter than length). */
  onChange?: (value: string) => void;
  /** Called once all boxes are filled, with the full code. */
  onComplete?: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
};

/**
 * Segmented one-time-code input: N single-character boxes that auto-advance,
 * support backspace-to-previous, arrow navigation, and paste-to-spread (paste
 * the whole code into any box and it fills all of them). Digits only.
 *
 * The boxes render LTR even inside the RTL app so the code reads naturally
 * left→right, matching how the user sees it in the email.
 */
export default function OtpInput({
  length = 6,
  onChange,
  onComplete,
  disabled,
  autoFocus,
}: Props) {
  const [chars, setChars] = useState<string[]>(() => Array(length).fill(''));
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (autoFocus) inputs.current[0]?.focus();
  }, [autoFocus]);

  const commit = (next: string[]) => {
    setChars(next);
    const joined = next.join('');
    onChange?.(joined);
    if (next.every((c) => c !== '')) onComplete?.(joined);
  };

  const focusBox = (i: number) => {
    const clamped = Math.max(0, Math.min(length - 1, i));
    inputs.current[clamped]?.focus();
    inputs.current[clamped]?.select();
  };

  /** Write `digits` starting at `start`, advancing focus to the next empty box. */
  const spread = (digits: string, start: number) => {
    const next = [...chars];
    let idx = start;
    for (const d of digits) {
      if (idx >= length) break;
      next[idx] = d;
      idx += 1;
    }
    commit(next);
    focusBox(idx);
  };

  const handleInput = (i: number, raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 0) return; // deletions handled in keydown
    if (digits.length === 1) {
      const next = [...chars];
      next[i] = digits;
      commit(next);
      if (i < length - 1) focusBox(i + 1);
    } else {
      // More than one char landed in a single box (e.g. mobile paste) → spread.
      spread(digits, i);
    }
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const next = [...chars];
      if (next[i]) {
        next[i] = '';
        commit(next);
      } else if (i > 0) {
        next[i - 1] = '';
        commit(next);
        focusBox(i - 1);
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusBox(i - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusBox(i + 1);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (text) spread(text, 0);
  };

  return (
    <div dir="ltr" className="flex items-center justify-center gap-2">
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            inputs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          disabled={disabled}
          value={chars[i]}
          aria-label={`ספרה ${i + 1}`}
          onChange={(e) => handleInput(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className="w-11 h-14 sm:w-12 text-center text-xl font-bold text-neutral-900 rounded-md border border-neutral-300 focus:border-brand-purple-500 focus:outline-none focus:ring-2 focus:ring-brand-purple-200 disabled:opacity-50 transition-colors"
        />
      ))}
    </div>
  );
}
