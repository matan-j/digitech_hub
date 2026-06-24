// ============================================================
// lib/learn/enrollment.ts
// Free-course enrollment ("my learning"). Uses the caller's RLS context.
// Free = access_level in ('open','login_required'). Paid courses go through
// the entitlement/payment flow, not this module.
// ============================================================

import { createClient } from '@/lib/supabase/server';
import { resolveAccessLevel } from '@/lib/learn/access';

export type EnrollResult =
  | { ok: true; alreadyEnrolled: boolean }
  | { ok: false; reason: 'unauthenticated' | 'not_found' | 'requires_purchase' | 'error'; message?: string };

/** Enrol the current user in a free (open/login_required) course by slug. */
export async function enrollInCourse(slug: string): Promise<EnrollResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: 'unauthenticated' };

  const { data: course } = await supabase
    .from('content_items')
    .select('id, type, access_level, is_premium, status')
    .eq('slug', slug)
    .eq('type', 'course')
    .maybeSingle();
  if (!course) return { ok: false, reason: 'not_found' };

  const level = resolveAccessLevel(course);
  if (level === 'purchase_required' || level === 'subscription_required') {
    return { ok: false, reason: 'requires_purchase' };
  }

  const { data: existing } = await supabase
    .from('enrollments')
    .select('id')
    .eq('user_id', user.id)
    .eq('content_item_id', course.id)
    .maybeSingle();
  if (existing) return { ok: true, alreadyEnrolled: true };

  const { error } = await supabase.from('enrollments').insert({
    user_id: user.id,
    content_item_id: course.id,
    source: 'free',
    status: 'active',
    last_activity_at: new Date().toISOString(),
  });
  if (error) return { ok: false, reason: 'error', message: error.message };

  // Best-effort: promote lead status to active learner.
  await supabase.from('profiles').update({ lead_status: 'active_learner', last_activity_at: new Date().toISOString() }).eq('id', user.id);

  return { ok: true, alreadyEnrolled: false };
}

export type EnrolledCourse = {
  content_item_id: string;
  enrolled_at: string;
  last_activity_at: string | null;
};

export async function listMyEnrollments(): Promise<EnrolledCourse[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from('enrollments')
    .select('content_item_id, enrolled_at, last_activity_at')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('enrolled_at', { ascending: false });
  return (data as EnrolledCourse[]) ?? [];
}
