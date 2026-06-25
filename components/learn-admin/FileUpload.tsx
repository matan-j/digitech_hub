'use client';

import { useRef, useState } from 'react';
import { Upload, X, Loader2, CheckCircle2 } from 'lucide-react';

export type UploadResult = {
  url: string;
  /** Pre-cropped 1:1 cover URL (covers bucket, raster only). Null for SVG/non-covers. */
  squareUrl?: string | null;
  path: string;
  sizeMB: number;
  mime: string;
  kind?: 'pdf' | 'xlsx' | 'docx' | 'link';
  filename: string;
};

type Props = {
  bucket: 'covers' | 'resources';
  /** Called once upload finishes. */
  onUploaded: (result: UploadResult) => void;
  /** Optional label override */
  label?: string;
  /** Accept attribute hint (browser file picker filter) */
  accept?: string;
  /** Current value preview (image url for covers) */
  preview?: string | null;
  /** Compact mode for inline use */
  compact?: boolean;
};

export default function FileUpload({
  bucket,
  onUploaded,
  label,
  accept,
  preview,
  compact = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);

  const defaultAccept = bucket === 'covers'
    ? 'image/png,image/jpeg,image/webp,image/svg+xml'
    : '.pdf,.xlsx,.xls,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  async function handleFile(file: File) {
    setState('uploading');
    setError(null);
    setFilename(file.name);

    const form = new FormData();
    form.append('file', file);
    form.append('bucket', bucket);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) {
        setState('error');
        setError(data.error ?? 'upload_failed');
        return;
      }
      setState('done');
      onUploaded({ ...data, filename: file.name });
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'network_error');
    }
  }

  function reset() {
    setState('idle');
    setError(null);
    setFilename(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={accept ?? defaultAccept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />

      {bucket === 'covers' && preview && state === 'idle' && (
        <div className="mb-2">
          <img src={preview} alt="" className="w-full max-h-40 object-cover rounded-md border border-neutral-200" />
        </div>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={state === 'uploading'}
        className={[
          'flex items-center justify-center gap-2 w-full rounded-md border-2 border-dashed transition-colors',
          compact ? 'px-3 py-2 text-xs' : 'px-4 py-6 text-sm',
          state === 'error'
            ? 'border-red-300 text-red-700 bg-red-50'
            : state === 'done'
              ? 'border-emerald-300 text-emerald-700 bg-emerald-50'
              : state === 'uploading'
                ? 'border-brand-purple-300 text-brand-purple-700 bg-brand-purple-50'
                : 'border-neutral-300 text-neutral-600 hover:border-brand-purple-400 hover:text-brand-purple-700 hover:bg-brand-purple-50',
        ].join(' ')}
      >
        {state === 'uploading' && <><Loader2 className="w-4 h-4 animate-spin" /> מעלה...</>}
        {state === 'done' && <><CheckCircle2 className="w-4 h-4" /> הועלה: {filename}</>}
        {state === 'idle' && <><Upload className="w-4 h-4" /> {label ?? (bucket === 'covers' ? 'העלה תמונת קאבר' : 'העלה קובץ')}</>}
        {state === 'error' && <><X className="w-4 h-4" /> שגיאה — נסה שוב</>}
      </button>

      {state === 'error' && error && (
        <p className="text-xs text-red-600 mt-1.5">{error}</p>
      )}
      {(state === 'done' || state === 'error') && (
        <button
          type="button"
          onClick={reset}
          className="text-xs text-neutral-500 hover:text-neutral-700 mt-1.5"
        >
          העלה אחר
        </button>
      )}
    </div>
  );
}
