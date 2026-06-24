import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { LEAD_STATUSES, type LeadProfile, type LeadListRow } from '@/lib/learn/leads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SORTABLE = new Set([
  'created_at',
  'last_activity_at',
  'lead_status',
  'full_name',
  'utm_source',
  'registration_source',
]);

/** Verify the caller is an admin. Returns a NextResponse to short-circuit on failure, else null. */
async function guard(): Promise<NextResponse | null> {
  const auth = await getCurrentUser();
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (auth.profile.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return null;
}

export async function GET(request: Request) {
  const denied = await guard();
  if (denied) return denied;

  const url = new URL(request.url);
  const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
  const status = url.searchParams.get('status') ?? '';
  const utmSource = url.searchParams.get('utm_source') ?? '';
  const sortParam = url.searchParams.get('sort') ?? 'created_at';
  const sort = SORTABLE.has(sortParam) ? sortParam : 'created_at';
  const order = url.searchParams.get('order') === 'asc' ? 'asc' : 'desc';
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 200, 1), 1000);
  const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);

  const admin = createServiceClient();

  // Base profile query (service client bypasses RLS — admin already verified above).
  let query = admin
    .from('profiles')
    .select(
      'id, full_name, phone, role, subscription_status, created_at, auth_provider, lead_status, marketing_consent, terms_accepted_at, registration_source, referrer, utm_source, utm_medium, utm_campaign, utm_content, first_guide_touchpoint, first_creator_touchpoint, first_course_touchpoint, intended_action, last_activity_at'
    );

  if (status && (LEAD_STATUSES as readonly string[]).includes(status)) {
    query = query.eq('lead_status', status);
  }
  if (utmSource) {
    if (utmSource === '__none__') query = query.is('utm_source', null);
    else query = query.eq('utm_source', utmSource);
  }

  query = query.order(sort, { ascending: order === 'asc', nullsFirst: false });

  const { data: profilesRaw, error } = await query;
  if (error) {
    return NextResponse.json({ error: 'query_failed', message: error.message }, { status: 500 });
  }

  const profiles = (profilesRaw ?? []) as LeadProfile[];

  // Resolve emails from auth.users (email lives there, not on profiles).
  const emailById = new Map<string, string | null>();
  try {
    let page = 1;
    // listUsers is paginated; pull enough pages to cover the dataset.
    for (let i = 0; i < 20; i++) {
      const { data: authData } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      const list = authData?.users ?? [];
      for (const u of list) emailById.set(u.id, u.email ?? null);
      if (list.length < 1000) break;
      page += 1;
    }
  } catch {
    // Non-fatal — emails just render as '—'.
  }

  // Aggregate counts across all leads in one query each (admin cross-user).
  const ids = profiles.map((p) => p.id);
  const enrolledCount = new Map<string, number>();
  const orderCount = new Map<string, number>();
  const progressCount = new Map<string, number>();

  if (ids.length > 0) {
    const [enrollRes, orderRes, progressRes] = await Promise.all([
      admin.from('enrollments').select('user_id').eq('status', 'active').in('user_id', ids),
      admin.from('orders').select('user_id').eq('status', 'paid').in('user_id', ids),
      admin.from('progress').select('user_id').not('completed_at', 'is', null).in('user_id', ids),
    ]);
    for (const r of (enrollRes.data ?? []) as { user_id: string }[]) {
      enrolledCount.set(r.user_id, (enrolledCount.get(r.user_id) ?? 0) + 1);
    }
    for (const r of (orderRes.data ?? []) as { user_id: string }[]) {
      orderCount.set(r.user_id, (orderCount.get(r.user_id) ?? 0) + 1);
    }
    for (const r of (progressRes.data ?? []) as { user_id: string }[]) {
      progressCount.set(r.user_id, (progressCount.get(r.user_id) ?? 0) + 1);
    }
  }

  let rows: LeadListRow[] = profiles.map((p) => ({
    ...p,
    email: emailById.get(p.id) ?? null,
    enrolled_count: enrolledCount.get(p.id) ?? 0,
    purchased_count: orderCount.get(p.id) ?? 0,
    progress_count: progressCount.get(p.id) ?? 0,
  }));

  // Text search across name/email/phone (post-fetch — email isn't on the profiles table).
  if (q) {
    rows = rows.filter((r) => {
      return (
        (r.full_name ?? '').toLowerCase().includes(q) ||
        (r.email ?? '').toLowerCase().includes(q) ||
        (r.phone ?? '').toLowerCase().includes(q)
      );
    });
  }

  const total = rows.length;
  const paged = rows.slice(offset, offset + limit);

  return NextResponse.json({ rows: paged, total, limit, offset });
}
