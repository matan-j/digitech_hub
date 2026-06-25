'use client';

import { useEffect, useRef, useState } from 'react';

// Debounced live slug suggestion for the admin create forms. As the admin types
// a Hebrew title, this calls /api/slug/suggest to get the AI-translated,
// collision-free slug so it can be shown (and auto-filled) before submit.
// Aborts in-flight requests so out-of-order responses can't overwrite a newer
// suggestion. Disable it (e.g. once the admin edits the slug by hand) via
// `opts.enabled = false`.
export function useSlugSuggestion(
  text: string,
  type: string,
  opts?: { creatorId?: string | null; enabled?: boolean },
): { suggestion: string; loading: boolean } {
  const [suggestion, setSuggestion] = useState('');
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const enabled = opts?.enabled ?? true;
  const creatorId = opts?.creatorId ?? null;

  useEffect(() => {
    const trimmed = text.trim();
    if (!enabled || trimmed.length < 2) {
      setSuggestion('');
      setLoading(false);
      return;
    }

    setLoading(true);
    const handle = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch('/api/slug/suggest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: trimmed, type, creatorId }),
          signal: ctrl.signal,
        });
        if (!res.ok) return;
        const data = await res.json();
        setSuggestion(typeof data.slug === 'string' ? data.slug : '');
      } catch {
        // aborted or network error — keep the previous suggestion
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 500);

    return () => clearTimeout(handle);
  }, [text, type, creatorId, enabled]);

  return { suggestion, loading };
}
