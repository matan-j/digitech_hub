import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { LEAD_STATUSES, type LeadProfile } from '@/lib/learn/leads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function guard(): Promise<NextResponse | null> {
  const auth = await getCurrentUser();
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (auth.profile.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return null;
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (value === true) s = 'כן';
  else if (value === false) s = 'לא';
  if (/[",\n\r]/.test(s)) {
    s = '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

const HEADERS = [
  'שם מלא',
  'מייל',
  'טלפון',
  'תאריך הרשמה',
  'ספק התחברות',
  'סטטוס ליד',
  'הסכמת שיווק',
  'אישור תקנון',
  'מקור הרשמה',
  'מפנה',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'מדריך ראשון',
  'יוצר ראשון',
  'קורס ראשון',
  'פעולה מבוקשת',
  'קורסים רשומים',
  'רכישות',
  'התקדמות (שיעורים)',
  'פעילות אחרונה',
];

export async function GET(request: Request) {
  const denied = await guard();
  if (denied) return denied;

  const url = new URL(request.url);
  const status = url.searchParams.get('status') ?? '';
  const utmSource = url.searchParams.get('utm_source') ?? '';

  const admin = createServiceClient();

  let query = admin
    .from('profiles')
    .select(
      'id, full_name, phone, role, subscription_status, created_at, auth_provider, lead_status, marketing_consent, terms_accepted_at, registration_source, referrer, utm_source, utm_medium, utm_campaign, utm_content, first_guide_touchpoint, first_creator_touchpoint, first_course_touchpoint, intended_action, last_activity_at'
    )
    .order('created_at', { ascending: false });

  if (status && (LEAD_STATUSES as readonly string[]).includes(status)) {
    query = query.eq('lead_status', status);
  }
  if (utmSource) {
    if (utmSource === '__none__') query = query.is('utm_source', null);
    else query = query.eq('utm_source', utmSource);
  }

  const { data: profilesRaw, error } = await query;
  if (error) return NextResponse.json({ error: 'query_failed', message: error.message }, { status: 500 });

  const profiles = (profilesRaw ?? []) as LeadProfile[];
  const ids = profiles.map((p) => p.id);

  const emailById = new Map<string, string | null>();
  try {
    let page = 1;
    for (let i = 0; i < 20; i++) {
      const { data: authData } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      const list = authData?.users ?? [];
      for (const u of list) emailById.set(u.id, u.email ?? null);
      if (list.length < 1000) break;
      page += 1;
    }
  } catch {
    // emails optional
  }

  const enrolledCount = new Map<string, number>();
  const orderCount = new Map<string, number>();
  const progressCount = new Map<string, number>();

  if (ids.length > 0) {
    const [enrollRes, orderRes, progressRes] = await Promise.all([
      admin.from('enrollments').select('user_id').eq('status', 'active').in('user_id', ids),
      admin.from('orders').select('user_id').eq('status', 'paid').in('user_id', ids),
      admin.from('progress').select('user_id').not('completed_at', 'is', null).in('user_id', ids),
    ]);
    for (const r of (enrollRes.data ?? []) as { user_id: string }[])
      enrolledCount.set(r.user_id, (enrolledCount.get(r.user_id) ?? 0) + 1);
    for (const r of (orderRes.data ?? []) as { user_id: string }[])
      orderCount.set(r.user_id, (orderCount.get(r.user_id) ?? 0) + 1);
    for (const r of (progressRes.data ?? []) as { user_id: string }[])
      progressCount.set(r.user_id, (progressCount.get(r.user_id) ?? 0) + 1);
  }

  const lines: string[] = [];
  lines.push(HEADERS.map(csvCell).join(','));

  for (const p of profiles) {
    lines.push(
      [
        p.full_name,
        emailById.get(p.id) ?? null,
        p.phone,
        p.created_at,
        p.auth_provider,
        p.lead_status,
        p.marketing_consent,
        p.terms_accepted_at,
        p.registration_source,
        p.referrer,
        p.utm_source,
        p.utm_medium,
        p.utm_campaign,
        p.utm_content,
        p.first_guide_touchpoint,
        p.first_creator_touchpoint,
        p.first_course_touchpoint,
        p.intended_action,
        enrolledCount.get(p.id) ?? 0,
        orderCount.get(p.id) ?? 0,
        progressCount.get(p.id) ?? 0,
        p.last_activity_at,
      ]
        .map(csvCell)
        .join(',')
    );
  }

  // UTF-8 BOM so Hebrew renders correctly in Excel.
  const csv = '﻿' + lines.join('\r\n');
  const filename = `leads-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
