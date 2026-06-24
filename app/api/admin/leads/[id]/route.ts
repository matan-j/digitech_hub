import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import {
  LEAD_STATUSES,
  type LeadProfile,
  type LeadStatus,
  type EnrolledCourse,
  type LeadEntitlement,
  type LeadOrder,
  type LeadDetail,
} from '@/lib/learn/leads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function guard(): Promise<NextResponse | null> {
  const auth = await getCurrentUser();
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (auth.profile.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return null;
}

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await guard();
  if (denied) return denied;

  const { id } = await ctx.params;
  const admin = createServiceClient();

  const { data: profile, error } = await admin
    .from('profiles')
    .select(
      'id, full_name, phone, role, subscription_status, created_at, auth_provider, lead_status, marketing_consent, terms_accepted_at, registration_source, referrer, utm_source, utm_medium, utm_campaign, utm_content, first_guide_touchpoint, first_creator_touchpoint, first_course_touchpoint, intended_action, last_activity_at'
    )
    .eq('id', id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'query_failed', message: error.message }, { status: 500 });
  if (!profile) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const [enrollRes, entRes, orderRes, progressRes, userRes] = await Promise.all([
    admin
      .from('enrollments')
      .select('content_item_id, source, status, enrolled_at, last_activity_at')
      .eq('user_id', id),
    admin
      .from('entitlements')
      .select('id, resource_type, resource_id, source, status, granted_at')
      .eq('user_id', id),
    admin
      .from('orders')
      .select('id, public_order_id, content_type, content_id, amount, currency, status, created_at')
      .eq('user_id', id),
    admin.from('progress').select('lesson_id').eq('user_id', id).not('completed_at', 'is', null),
    admin.auth.admin.getUserById(id),
  ]);

  // Resolve content_item titles for enrollments.
  const enrollments = (enrollRes.data ?? []) as Array<{
    content_item_id: string;
    source: string;
    status: string;
    enrolled_at: string;
    last_activity_at: string | null;
  }>;
  const itemIds = [...new Set(enrollments.map((e) => e.content_item_id))];
  const itemById = new Map<string, { title: string | null; slug: string | null; type: string | null }>();
  if (itemIds.length > 0) {
    const { data: items } = await admin
      .from('content_items')
      .select('id, title, slug, type')
      .in('id', itemIds);
    for (const it of (items ?? []) as Array<{ id: string; title: string | null; slug: string | null; type: string | null }>) {
      itemById.set(it.id, { title: it.title, slug: it.slug, type: it.type });
    }
  }

  const enrolled_courses: EnrolledCourse[] = enrollments.map((e) => {
    const item = itemById.get(e.content_item_id);
    return {
      content_item_id: e.content_item_id,
      title: item?.title ?? null,
      slug: item?.slug ?? null,
      type: item?.type ?? null,
      source: e.source,
      status: e.status,
      enrolled_at: e.enrolled_at,
      last_activity_at: e.last_activity_at,
    };
  });

  const detail: LeadDetail = {
    ...(profile as LeadProfile),
    email: userRes.data?.user?.email ?? null,
    enrolled_courses,
    entitlements: (entRes.data ?? []) as LeadEntitlement[],
    orders: (orderRes.data ?? []) as LeadOrder[],
    progress_count: (progressRes.data ?? []).length,
  };

  return NextResponse.json(detail);
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await guard();
  if (denied) return denied;

  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const leadStatus: LeadStatus | undefined = body.lead_status;

  if (!leadStatus || !(LEAD_STATUSES as readonly string[]).includes(leadStatus)) {
    return NextResponse.json({ error: 'invalid_lead_status' }, { status: 400 });
  }

  const admin = createServiceClient();
  const { error } = await admin.from('profiles').update({ lead_status: leadStatus }).eq('id', id);
  if (error) return NextResponse.json({ error: 'update_failed', message: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, lead_status: leadStatus });
}
