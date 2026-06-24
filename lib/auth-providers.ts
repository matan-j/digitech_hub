/**
 * Client helper for the cross-provider signup guard. Asks the server which auth
 * methods (if any) an email is already registered under, so a form can block a
 * duplicate account and steer the user to their original method.
 *
 * Always resolves — a network/lookup failure returns "no existing account" so a
 * transient error never blocks a legitimate signup. See /api/auth/check-email.
 */
export type EmailProviders = {
  exists: boolean;
  providers: string[];
  hasPassword: boolean;
  hasGoogle: boolean;
};

const NONE: EmailProviders = {
  exists: false,
  providers: [],
  hasPassword: false,
  hasGoogle: false,
};

export async function lookupEmailProviders(email: string): Promise<EmailProviders> {
  try {
    const res = await fetch('/api/auth/check-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    });
    if (!res.ok) return NONE;
    return (await res.json()) as EmailProviders;
  } catch {
    return NONE;
  }
}
