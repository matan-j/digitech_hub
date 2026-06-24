'use client';

import { useState } from 'react';
import {
  validateHebrewFullName,
  validateIsraeliPhone,
  normalizeFullName,
} from '@/lib/validation/profile';

/**
 * Shared full-name + phone form logic and presentation, reused by the access
 * modal, the profile-completion popup and the account settings card so the
 * validation behaviour is identical everywhere:
 *
 *   - The rules are NEVER shown up-front (no "Hebrew only" / "2 letters" hint).
 *   - A red message appears under a field only once an error is detected
 *     (on blur or on submit). It clears as soon as the user edits the field.
 *   - The phone field auto-corrects fixable inputs to `05XXXXXXXX` on blur.
 */
export function useContactForm(initial?: { name?: string; phone?: string }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [nameError, setNameError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  function onNameChange(v: string) {
    setName(v);
    if (nameError) setNameError(null); // don't nag while the user is fixing it
  }

  function onPhoneChange(v: string) {
    setPhone(v);
    if (phoneError) setPhoneError(null);
  }

  /** Validate the name on blur. */
  function blurName(): boolean {
    const r = validateHebrewFullName(name);
    setNameError(r.valid ? null : r.error ?? null);
    return r.valid;
  }

  /** Auto-correct + validate the phone on blur. */
  function blurPhone(): boolean {
    const r = validateIsraeliPhone(phone);
    setPhone(r.value); // auto-fix to canonical form (or stripped if unfixable)
    setPhoneError(r.valid ? null : r.error ?? null);
    return r.valid;
  }

  /**
   * Validate both fields for submit. Returns the cleaned values when valid, or
   * null (with errors set) when not.
   */
  function validateAll(): { name: string; phone: string } | null {
    const nr = validateHebrewFullName(name);
    const pr = validateIsraeliPhone(phone);
    const cleanName = normalizeFullName(name);
    setName(cleanName);
    setPhone(pr.value);
    setNameError(nr.valid ? null : nr.error ?? null);
    setPhoneError(pr.valid ? null : pr.error ?? null);
    return nr.valid && pr.valid ? { name: cleanName, phone: pr.value } : null;
  }

  return {
    name,
    phone,
    nameError,
    phoneError,
    setName,
    setPhone,
    onNameChange,
    onPhoneChange,
    blurName,
    blurPhone,
    validateAll,
  };
}

const inputCls =
  'w-full px-3 py-2.5 rounded-md border focus:outline-none focus:ring-2 text-neutral-900 text-base transition-colors';
const okCls = 'border-neutral-300 focus:border-brand-purple-500 focus:ring-brand-purple-200';
const errCls = 'border-red-400 focus:border-red-500 focus:ring-red-200';

export function NameField({
  id = 'contact-name',
  label = 'שם מלא',
  value,
  error,
  onChange,
  onBlur,
  placeholder = 'ישראל ישראלי',
  autoFocus,
}: {
  id?: string;
  label?: string;
  value: string;
  error: string | null;
  onChange: (v: string) => void;
  onBlur: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-semibold text-neutral-800">
        {label}
      </label>
      <input
        id={id}
        type="text"
        autoComplete="name"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        className={`${inputCls} ${error ? errCls : okCls}`}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

export function PhoneField({
  id = 'contact-phone',
  label = 'מספר טלפון',
  value,
  error,
  onChange,
  onBlur,
  placeholder = '0500000000',
}: {
  id?: string;
  label?: string;
  value: string;
  error: string | null;
  onChange: (v: string) => void;
  onBlur: () => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-semibold text-neutral-800">
        {label}
      </label>
      <input
        id={id}
        type="tel"
        inputMode="tel"
        dir="ltr"
        autoComplete="tel"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        className={`${inputCls} ${error ? errCls : okCls}`}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
