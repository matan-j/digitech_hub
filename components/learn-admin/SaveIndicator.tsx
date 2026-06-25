'use client';

import { useEffect, useState } from 'react';

export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

const COPY: Record<SaveState, { text: string; cls: string }> = {
  idle: { text: 'מסונכרן', cls: 'text-gray-500 bg-gray-100' },
  dirty: { text: 'שינויים לא נשמרו', cls: 'text-amber-700 bg-amber-50' },
  saving: { text: 'שומר…', cls: 'text-blue-700 bg-blue-50' },
  saved: { text: '✓ נשמר', cls: 'text-green-700 bg-green-50' },
  error: { text: '⚠ שגיאת שמירה', cls: 'text-red-700 bg-red-50' },
};

function formatSavedAt(d: Date): string {
  // Hebrew (he-IL) date + time, e.g. "25.6.2026, 14:32"
  return d.toLocaleString('he-IL', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SaveIndicator({
  state,
  onForceSave,
  initialSavedAt,
}: {
  state: SaveState;
  onForceSave?: () => void;
  /** Timestamp of the last persisted save on load (e.g. row.updated_at). */
  initialSavedAt?: string | number | Date | null;
}) {
  const c = COPY[state];

  // Track the last successful save time. Seed from initialSavedAt (the row's
  // updated_at on load), then refresh every time the state reaches 'saved'.
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(() => {
    if (!initialSavedAt) return null;
    const d = new Date(initialSavedAt);
    return Number.isNaN(d.getTime()) ? null : d;
  });

  useEffect(() => {
    if (state === 'saved') setLastSavedAt(new Date());
  }, [state]);

  // The manual save button is always available (per product spec) so the user
  // can force a save at any moment — only the in-flight 'saving' tick disables it.
  const canSave = !!onForceSave && state !== 'saving';

  const savedLine = lastSavedAt ? (
    <span className="text-[11px] text-neutral-400">
      שמירה אחרונה: {formatSavedAt(lastSavedAt)}
    </span>
  ) : null;

  if (!onForceSave) {
    return (
      <div className="flex flex-col items-end gap-1">
        <span className={`text-xs font-medium px-2.5 py-1.5 rounded-full ${c.cls}`}>
          {c.text}
        </span>
        {savedLine}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <span className={`text-xs font-medium px-2.5 py-1.5 rounded-full ${c.cls}`}>
          {c.text}
        </span>
        <button
          type="button"
          onClick={canSave ? onForceSave : undefined}
          disabled={!canSave}
          className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
            canSave
              ? 'bg-brand-purple-700 text-white hover:bg-brand-purple-600 cursor-pointer'
              : 'bg-neutral-100 text-neutral-400 cursor-default'
          }`}
        >
          {state === 'saving' ? 'שומר…' : 'שמור'}
        </button>
      </div>
      {savedLine}
    </div>
  );
}
