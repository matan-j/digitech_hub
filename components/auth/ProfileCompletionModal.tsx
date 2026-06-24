'use client';

import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { useContactForm, NameField, PhoneField } from '@/components/auth/ContactFields';

/**
 * Profile-completion popup. Collects a valid Hebrew full name + Israeli phone
 * and persists them via POST /api/account/profile. Used in two places:
 *
 *   - First login: opened automatically when the signed-in user is missing a
 *     valid name or phone (name is pre-filled if already on file).
 *   - Before a purchase: opened when the buyer's contact details are incomplete
 *     so the purchase request can carry name + phone.
 *
 * Dismissible: both the "המשך" (continue) button and the X close it. On a
 * successful save `onSaved` fires with the cleaned values before it closes.
 */
export default function ProfileCompletionModal({
  open,
  initialName = '',
  initialPhone = '',
  title = 'עוד פרט קטן',
  subtitle = 'נשמח להשלים את הפרטים שלך כדי שנוכל להמשיך.',
  onClose,
  onSaved,
}: {
  open: boolean;
  initialName?: string;
  initialPhone?: string;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  onSaved?: (values: { name: string; phone: string }) => void;
}) {
  const form = useContactForm({ name: initialName, phone: initialPhone });
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Keep a stable reference to the setters so the reset effect is deps-clean.
  const { setName, setPhone } = form;

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) {
      setName(initialName);
      setPhone(initialPhone);
      setServerError(null);
      setSaving(false);
    }
  }, [open, initialName, initialPhone, setName, setPhone]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    const values = form.validateAll();
    if (!values) return; // field errors are now shown

    setSaving(true);
    try {
      const res = await fetch('/api/account/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: values.name, phone: values.phone }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Surface server-side field errors if the client somehow missed them.
        if (d?.fieldErrors?.full_name || d?.fieldErrors?.phone) {
          setServerError(d.fieldErrors.full_name ?? d.fieldErrors.phone);
        } else {
          setServerError('שמירת הפרטים נכשלה. נסו שוב.');
        }
        setSaving(false);
        return;
      }
      onSaved?.(values);
      onClose();
    } catch {
      setServerError('שגיאת רשת. נסו שוב.');
      setSaving(false);
    }
  }

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-[110] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label="סגור"
        onClick={onClose}
        className="absolute inset-0 bg-neutral-950/50"
      />

      <div
        className="relative w-full max-w-md bg-white rounded-2xl border border-neutral-200 p-6 sm:p-8 max-h-[92vh] overflow-y-auto"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="סגור"
          className="absolute top-4 left-4 w-8 h-8 rounded-pill flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <h2 className="text-2xl font-extrabold text-brand-purple-700 mb-1.5">{title}</h2>
        <p className="text-sm text-neutral-700 mb-5 leading-relaxed">{subtitle}</p>

        <form onSubmit={submit} className="space-y-3" noValidate>
          <NameField
            id="pc-name"
            value={form.name}
            error={form.nameError}
            onChange={form.onNameChange}
            onBlur={form.blurName}
            autoFocus
          />
          <PhoneField
            id="pc-phone"
            value={form.phone}
            error={form.phoneError}
            onChange={form.onPhoneChange}
            onBlur={form.blurPhone}
          />

          {serverError && <p className="text-sm text-red-600">{serverError}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-800 disabled:bg-neutral-300 text-white font-semibold transition-colors"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            המשך
          </button>
        </form>
      </div>
    </div>
  );
}
