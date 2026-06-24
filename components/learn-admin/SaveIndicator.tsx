'use client';

export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

const COPY: Record<SaveState, { text: string; cls: string }> = {
  idle: { text: 'מסונכרן', cls: 'text-gray-500 bg-gray-100' },
  dirty: { text: 'שינויים לא נשמרו', cls: 'text-amber-700 bg-amber-50' },
  saving: { text: 'שומר…', cls: 'text-blue-700 bg-blue-50' },
  saved: { text: '✓ נשמר', cls: 'text-green-700 bg-green-50' },
  error: { text: '⚠ שגיאת שמירה', cls: 'text-red-700 bg-red-50' },
};

export default function SaveIndicator({
  state,
  onForceSave,
}: {
  state: SaveState;
  onForceSave?: () => void;
}) {
  const c = COPY[state];
  const canSave = onForceSave && (state === 'dirty' || state === 'error');

  if (!onForceSave) {
    return (
      <span className={`text-xs font-medium px-2.5 py-1.5 rounded-full ${c.cls}`}>
        {c.text}
      </span>
    );
  }

  return (
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
  );
}
