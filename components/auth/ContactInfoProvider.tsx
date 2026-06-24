'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import ProfileCompletionModal from '@/components/auth/ProfileCompletionModal';
import {
  validateHebrewFullName,
  validateIsraeliPhone,
} from '@/lib/validation/profile';

type ContactValues = { name: string; phone: string };

type ContactInfoContext = {
  /**
   * Ensure the signed-in user has a valid name + phone on file. Resolves
   * immediately with them when already complete; otherwise opens the popup and
   * resolves with the saved values, or null if the user dismisses it.
   */
  requireContactInfo: () => Promise<ContactValues | null>;
};

const Ctx = createContext<ContactInfoContext | null>(null);

export function useContactInfo(): ContactInfoContext {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error('useContactInfo must be used within <ContactInfoProvider>');
  }
  return ctx;
}

function isComplete(name: string, phone: string): boolean {
  return validateHebrewFullName(name).valid && validateIsraeliPhone(phone).valid;
}

export default function ContactInfoProvider({
  initialName,
  initialPhone,
  /** Whether to auto-open the popup on first login when details are missing. */
  autoPrompt = true,
  children,
}: {
  initialName?: string | null;
  initialPhone?: string | null;
  autoPrompt?: boolean;
  children: React.ReactNode;
}) {
  const [name, setName] = useState(initialName ?? '');
  const [phone, setPhone] = useState(initialPhone ?? '');
  const [open, setOpen] = useState(false);
  const resolverRef = useRef<((v: ContactValues | null) => void) | null>(null);
  const autoPrompted = useRef(false);

  const requireContactInfo = useCallback((): Promise<ContactValues | null> => {
    if (isComplete(name, phone)) return Promise.resolve({ name, phone });
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setOpen(true);
    });
  }, [name, phone]);

  // First-login prompt: open once when the user lands authenticated but is
  // missing a valid name or phone. Name is pre-filled if already on file.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (autoPrompt && !autoPrompted.current && !isComplete(name, phone)) {
      autoPrompted.current = true;
      setOpen(true);
    }
  }, [autoPrompt, name, phone]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSaved = useCallback((vals: ContactValues) => {
    setName(vals.name);
    setPhone(vals.phone);
    resolverRef.current?.(vals);
    resolverRef.current = null;
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    resolverRef.current?.(null);
    resolverRef.current = null;
  }, []);

  return (
    <Ctx.Provider value={{ requireContactInfo }}>
      {children}
      <ProfileCompletionModal
        open={open}
        initialName={name}
        initialPhone={phone}
        onClose={handleClose}
        onSaved={handleSaved}
      />
    </Ctx.Provider>
  );
}
