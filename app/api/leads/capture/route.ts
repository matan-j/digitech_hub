import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/leads/capture
 *
 * Authenticated. Writes the lead-attribution + profile-completion data captured
 * by the AccessModal into the current user's `profiles` row.
 *
 * RLS-safe: a user may update their own profile row, but the policy forbids
 * changing privileged columns (role / subscription). We only touch the lead
 * columns added in migration 021, so this passes RLS without the service key.
 *
 * First-touch wins: first_* touchpoints and registration_source are only set
 * if currently null. lead_status is promoted 'new' -> 'registered'.
 */

type Body = {
  full_name?: string;
  phone?: string;
  auth_provider?: string;
  marketing_consent?: boolean;
  terms_accepted?: boolean;
  intended_action?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  first_guide_touchpoint?: string;
  first_creator_touchpoint?: string;
  first_course_touchpoint?: string;
  registration_source?: string;
};

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;

export async function POST(request: Request) {
  const auth = await getCurrentUser();
  if (!auth) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Body;
  const supabase = await createClient();

  // Read current row so we can honour first-touch + lead_status promotion.
  const { data: current } = await supabase
    .from('profiles')
    .select(
      'lead_status, registration_source, first_guide_touchpoint, first_creator_touchpoint, first_course_touchpoint, full_name, phone',
    )
    .eq('id', auth.userId)
    .single();

  const patch: Record<string, unknown> = {};

  // Always-overwritable profile fields (latest entered value wins).
  const fullName = str(body.full_name);
  if (fullName) patch.full_name = fullName;
  const phone = str(body.phone);
  if (phone) patch.phone = phone;
  const provider = str(body.auth_provider);
  if (provider) patch.auth_provider = provider;
  if (typeof body.marketing_consent === 'boolean') {
    patch.marketing_consent = body.marketing_consent;
  }
  if (body.terms_accepted === true) {
    patch.terms_accepted_at = new Date().toISOString();
  }
  const intendedAction = str(body.intended_action);
  if (intendedAction) patch.intended_action = intendedAction;

  patch.last_activity_at = new Date().toISOString();

  // Attribution — overwrite only when not already captured (first-touch wins).
  type C = {
    registration_source?: string | null;
    first_guide_touchpoint?: string | null;
    first_creator_touchpoint?: string | null;
    first_course_touchpoint?: string | null;
    lead_status?: string | null;
  } | null;
  const cur = current as C;

  const firstTouch = (
    column: keyof NonNullable<C>,
    value: string | undefined,
  ) => {
    if (value && (!cur || cur[column] == null)) patch[column] = value;
  };
  firstTouch('registration_source', str(body.registration_source));
  firstTouch('first_guide_touchpoint', str(body.first_guide_touchpoint));
  firstTouch('first_creator_touchpoint', str(body.first_creator_touchpoint));
  firstTouch('first_course_touchpoint', str(body.first_course_touchpoint));

  // UTM + referrer: set whenever provided (campaign attribution of this session).
  for (const key of [
    'referrer',
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
  ] as const) {
    const v = str(body[key]);
    if (v) patch[key] = v;
  }

  // Promote lead_status: 'new' (or null) -> 'registered'.
  if (!cur || cur.lead_status == null || cur.lead_status === 'new') {
    patch.lead_status = 'registered';
  }

  const { error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', auth.userId);

  if (error) {
    console.error('[leads/capture]', error);
    return NextResponse.json(
      { error: 'save_failed', message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
