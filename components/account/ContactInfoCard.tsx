'use client';

import { useState } from 'react';
import { Loader2, Check } from 'lucide-react';
import { useContactForm, NameField, PhoneField } from '@/components/auth/ContactFields';

/**
 * Account settings card for editing the user's full name + phone. Same
 * validation rules as the signup / completion popup (Hebrew name, canonical
 * Israeli phone with auto-fix on blur), persisted via POST /api/account/profile.
 */
export default function ContactInfoCard({
  initialName,
  initialPhone,
}: {
  initialName: string | null;
  initialPhone: string | null;
}) {
  const [name, setName] = useState(initialName ?? '');
  const [phone, setPhone] = useState(initialPhone ?? '');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useContactForm({ name, phone });

  function startEdit() {
    form.setName(name);
    form.setPhone(phone);
    setServerError(null);
    setSaved(false);
    setEditing(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    const values = form.validateAll();
    if (!values) return;

    setSaving(true);
    try {
      const res = await fetch('/api/account/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: values.name, phone: values.phone }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setServerError(
          d?.fieldErrors?.full_name ?? d?.fieldErrors?.phone ?? 'שמירת הפרטים נכשלה. נסו שוב.',
        );
        setSaving(false);
        return;
      }
      setName(values.name);
      setPhone(values.phone);
      setEditing(false);
      setSaving(false);
      setSaved(true);
    } catch {
      setServerError('שגיאת רשת. נסו שוב.');
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-extrabold text-neutral-950">פרטים אישיים</h2>
        {!editing && (
          <button
            type="button"
            onClick={startEdit}
            className="text-sm text-brand-purple-700 hover:text-brand-purple-800 font-semibold"
          >
            ערוך
          </button>
        )}
      </div>

      {!editing ? (
        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-neutral-500">שם מלא</dt>
            <dd className="font-medium text-neutral-900">{name || 'לא הוגדר'}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-neutral-500">טלפון</dt>
            <dd className="font-medium text-neutral-900" dir="ltr">{phone || 'לא הוגדר'}</dd>
          </div>
          {saved && (
            <p className="flex items-center gap-1.5 text-sm text-green-700 pt-1">
              <Check className="w-4 h-4" /> הפרטים נשמרו
            </p>
          )}
        </dl>
      ) : (
        <form onSubmit={submit} className="space-y-3" noValidate>
          <NameField
            id="acc-name"
            value={form.name}
            error={form.nameError}
            onChange={form.onNameChange}
            onBlur={form.blurName}
          />
          <PhoneField
            id="acc-phone"
            value={form.phone}
            error={form.phoneError}
            onChange={form.onPhoneChange}
            onBlur={form.blurPhone}
          />

          {serverError && <p className="text-sm text-red-600">{serverError}</p>}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center justify-center gap-2 px-5 py-2 rounded-pill bg-brand-purple-700 hover:bg-brand-purple-800 disabled:bg-neutral-300 text-white text-sm font-semibold transition-colors"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              שמור
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={saving}
              className="px-5 py-2 rounded-pill border border-neutral-300 text-neutral-700 text-sm font-semibold hover:bg-neutral-50 transition-colors"
            >
              ביטול
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
