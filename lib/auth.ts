import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';

export type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: 'admin' | 'subscriber' | 'creator';
  subscription_status: 'active' | 'cancelled' | 'past_due' | 'none';
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
};

export type AuthState = {
  userId: string;
  email: string;
  profile: Profile;
};

/**
 * Returns the current user + profile, or null if unauthenticated.
 * Use in pages/components that render conditionally for guests.
 */
export async function getCurrentUser(): Promise<AuthState | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) return null;

  return {
    userId: user.id,
    email: user.email ?? '',
    profile: profile as Profile,
  };
}

/** Redirect to /login if not authenticated. */
export async function requireUser(returnTo?: string): Promise<AuthState> {
  const auth = await getCurrentUser();
  if (!auth) {
    const search = returnTo ? `?return=${encodeURIComponent(returnTo)}` : '';
    redirect(`/login${search}`);
  }
  return auth;
}

/** Redirect to /login (or 404) if not admin. */
export async function requireAdmin(): Promise<AuthState> {
  const auth = await requireUser();
  if (auth.profile.role !== 'admin') {
    redirect('/');
  }
  return auth;
}

/** True if user has active premium access (subscriber w/ active sub OR admin). */
export function hasPremiumAccess(profile: Profile): boolean {
  return profile.role === 'admin' || profile.subscription_status === 'active';
}

export type CreatorRow = {
  id: string;
  slug: string;
  name: string;
  status: 'active' | 'disabled';
};

/**
 * Returns the creator row linked to the current user, or null if the user
 * is not a creator. Admins are not auto-linked — they manage via /admin.
 */
export async function getMyCreator(): Promise<CreatorRow | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('creators')
    .select('id, slug, name, status')
    .eq('user_id', user.id)
    .maybeSingle();
  return (data as CreatorRow) ?? null;
}

/**
 * Gate for the creator dashboard. Requires an authenticated user who is either
 * an admin or a linked creator. Returns the auth state plus the creator row
 * (null for admins, who may not have a creator profile of their own).
 */
export async function requireCreator(returnTo?: string): Promise<{ auth: AuthState; creator: CreatorRow | null }> {
  const auth = await requireUser(returnTo);
  if (auth.profile.role === 'admin') {
    return { auth, creator: await getMyCreator() };
  }
  const creator = await getMyCreator();
  if (auth.profile.role !== 'creator' || !creator || creator.status !== 'active') {
    redirect('/learn');
  }
  return { auth, creator };
}

/** Redirect to /upgrade if no premium access. */
export async function requirePremium(returnTo?: string): Promise<AuthState> {
  const auth = await requireUser(returnTo);
  if (!hasPremiumAccess(auth.profile)) {
    const search = returnTo ? `?return=${encodeURIComponent(returnTo)}` : '';
    redirect(`/upgrade${search}`);
  }
  return auth;
}
