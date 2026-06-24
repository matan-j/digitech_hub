/**
 * Shared profile-contact validation for full name + phone.
 *
 * Pure functions — safe to import on both the client (live form feedback) and
 * the server (API write guards). The rules are intentionally strict and the
 * error copy is the single source of truth, surfaced verbatim under the field.
 *
 * RULES
 *   Full name — Hebrew letters only, two words minimum, the first word (given
 *               name) and the last word (family name) each ≥ 2 letters.
 *               Valid:   "אור אלדבח"
 *               Invalid: "א אלדבח" (given name too short)
 *                        "אור א"   (family name too short)
 *                        anything with Latin letters / digits / symbols.
 *
 *   Phone — canonical form is `05XXXXXXXX` (10 digits, leading 05). Several
 *           near-miss inputs are auto-correctable to that form:
 *               +972542175870 / 972542175870  → 0542175870 (country code)
 *               542175870                      → 0542175870 (missing leading 0)
 *               054-217-5870 / spaces          → 0542175870 (separators)
 *           Anything else (e.g. 5552175870) is invalid and cannot be saved.
 */

const HEBREW_WORD = /^[א-ת]+$/; // Hebrew letters only (incl. final forms)
const CANONICAL_PHONE = /^05\d{8}$/;

export type ValidationResult = {
  valid: boolean;
  /** Hebrew message to show under the field when invalid. */
  error?: string;
};

/**
 * Validate a Hebrew full name. Returns the first failing rule's message so the
 * field can show exactly what is wrong — and nothing while the field is empty
 * or still valid.
 */
export function validateHebrewFullName(raw: string): ValidationResult {
  const name = (raw ?? '').trim().replace(/\s+/g, ' ');
  if (!name) return { valid: false, error: 'יש להזין שם מלא' };

  const parts = name.split(' ');
  if (parts.length < 2) {
    return { valid: false, error: 'יש להזין שם פרטי ושם משפחה' };
  }

  for (const part of parts) {
    if (!HEBREW_WORD.test(part)) {
      return { valid: false, error: 'השם יכול להכיל אותיות בעברית בלבד' };
    }
  }

  const first = parts[0];
  const last = parts.slice(1).join('');
  if (first.length < 2) {
    return { valid: false, error: 'השם הפרטי חייב להכיל לפחות 2 אותיות' };
  }
  if (last.length < 2) {
    return { valid: false, error: 'שם המשפחה חייב להכיל לפחות 2 אותיות' };
  }

  return { valid: true };
}

/** Collapse a full name to canonical single-spaced form. */
export function normalizeFullName(raw: string): string {
  return (raw ?? '').trim().replace(/\s+/g, ' ');
}

/**
 * Best-effort normalisation of an Israeli mobile number toward `05XXXXXXXX`.
 * Strips separators and rewrites a country code / missing-leading-zero, but
 * never invents digits — an input that cannot be made canonical is returned
 * stripped (so the caller's validation rejects it).
 */
export function normalizeIsraeliPhone(raw: string): string {
  let s = (raw ?? '').replace(/[\s\-().]/g, '');
  if (s.startsWith('+972')) s = '0' + s.slice(4);
  else if (s.startsWith('972')) s = '0' + s.slice(3);
  else if (/^5\d{8}$/.test(s)) s = '0' + s; // local 9-digit, missing leading 0
  return s;
}

export function isValidIsraeliPhone(value: string): boolean {
  return CANONICAL_PHONE.test(value);
}

/**
 * Normalise then validate a phone. Returns the canonicalised value plus whether
 * it is valid — callers use `value` to auto-correct the field on blur and
 * `error` to show the failure.
 */
export function validateIsraeliPhone(raw: string): ValidationResult & { value: string } {
  const value = normalizeIsraeliPhone(raw);
  if (!value) return { valid: false, value, error: 'יש להזין מספר טלפון' };
  if (!isValidIsraeliPhone(value)) {
    return { valid: false, value, error: 'מספר טלפון לא תקין. הזינו מספר בפורמט 05XXXXXXXX' };
  }
  return { valid: true, value };
}
