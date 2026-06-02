import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * Admin creates a user with email + password.
 *
 * The `on_auth_user_created` trigger inserts the profile row automatically with
 * role='subscriber' (or 'admin' for bootstrap emails). If the admin wants a
 * different role or subscription_status, we update the profile after creation.
 */

export const runtime = 'nodejs';

type Body = {
  email?: string;
  password?: string;
  full_name?: string;
  role?: 'admin' | 'subscriber';
  subscription_status?: 'active' | 'cancelled' | 'past_due' | 'none';
};

export async function POST(request: Request) {
  await requireAdmin();

  const body: Body = await request.json().catch(() => ({}));
  const email = (body.email ?? '').trim().toLowerCase();
  const password = body.password ?? '';
  const fullName = (body.full_name ?? '').trim() || null;
  const role = body.role ?? 'subscriber';
  const subscriptionStatus = body.subscription_status ?? 'none';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: 'weak_password', message: 'הסיסמה חייבת להיות 8 תווים לפחות' },
      { status: 400 }
    );
  }
  if (role !== 'admin' && role !== 'subscriber') {
    return NextResponse.json({ error: 'invalid_role' }, { status: 400 });
  }
  if (!['active', 'cancelled', 'past_due', 'none'].includes(subscriptionStatus)) {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 });
  }

  const admin = createServiceClient();

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // admin is vouching — skip verification email
    user_metadata: fullName ? { full_name: fullName } : undefined,
  });

  if (createErr || !created?.user) {
    const message = createErr?.message ?? 'create_failed';
    const status = /already|exists|registered/i.test(message) ? 409 : 500;
    return NextResponse.json(
      { error: 'create_failed', message },
      { status }
    );
  }

  const userId = created.user.id;

  // If admin wants different role or subscription status, update the
  // auto-created profile row.
  const profilePatch: Record<string, unknown> = {};
  if (role !== 'subscriber') profilePatch.role = role;
  if (subscriptionStatus !== 'none') profilePatch.subscription_status = subscriptionStatus;
  if (fullName) profilePatch.full_name = fullName;

  if (Object.keys(profilePatch).length > 0) {
    const { error: patchErr } = await admin
      .from('profiles')
      .update(profilePatch)
      .eq('id', userId);
    if (patchErr) {
      // User exists but profile patch failed — surface but don't roll back the auth user.
      return NextResponse.json(
        {
          ok: true,
          user: { id: userId, email },
          warning: `המשתמש נוצר אבל עדכון פרופיל נכשל: ${patchErr.message}`,
        },
        { status: 201 }
      );
    }
  }

  return NextResponse.json(
    { ok: true, user: { id: userId, email } },
    { status: 201 }
  );
}
