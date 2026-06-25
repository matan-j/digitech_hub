import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { grantPurchaseAccess, revokeEntitlement, type ResourceType } from '@/lib/payments/entitlement-service';

export const runtime = 'nodejs';

const RESOURCE_TYPES: ResourceType[] = ['course', 'guide', 'playbook', 'resource', 'bundle'];

type ContentLite = { id: string; slug: string; title: string; type: string; access_level: string };

/**
 * Admin access console data. Returns purchasable content, users (for the grant
 * picker), every access grant (paid/admin entitlements + free enrollments) and
 * the order log (pending requests + their webhook status).
 */
export async function GET() {
  await requireAdmin();
  const supabase = createServiceClient();

  const [{ data: content }, { data: ents }, { data: enrolls }, { data: orders }, usersRes] =
    await Promise.all([
      supabase.from('content_items').select('id, slug, title, type, access_level').in('type', ['course', 'guide']),
      supabase.from('entitlements').select('id, user_id, resource_type, resource_id, source, status, granted_at, order_id').order('granted_at', { ascending: false }),
      supabase.from('enrollments').select('id, user_id, content_item_id, source, status, enrolled_at').eq('status', 'active'),
      supabase.from('orders').select('id, public_order_id, user_id, content_type, content_id, amount, original_amount, currency, status, request_webhook_status, request_webhook_sent_at, created_at').order('created_at', { ascending: false }).limit(500),
      supabase.auth.admin.listUsers({ perPage: 1000 }),
    ]);

  const titleById = new Map<string, ContentLite>((content ?? []).map((c) => [c.id, c as ContentLite]));
  const emailById = new Map<string, string>((usersRes.data?.users ?? []).map((u) => [u.id, u.email ?? '']));

  // Names from profiles for the user picker / display.
  const { data: profiles } = await supabase.from('profiles').select('id, full_name');
  const nameById = new Map<string, string | null>((profiles ?? []).map((p) => [p.id, p.full_name as string | null]));

  const grants = (ents ?? []).map((e) => ({
    id: e.id,
    kind: 'entitlement' as const,
    user_id: e.user_id,
    user_email: emailById.get(e.user_id) ?? null,
    resource_type: e.resource_type,
    resource_id: e.resource_id,
    title: titleById.get(e.resource_id)?.title ?? '(תוכן נמחק)',
    source: e.source,
    status: e.status,
    granted_at: e.granted_at,
  }));

  const enrollments = (enrolls ?? []).map((en) => ({
    id: en.id,
    kind: 'enrollment' as const,
    user_id: en.user_id,
    user_email: emailById.get(en.user_id) ?? null,
    resource_type: 'course',
    resource_id: en.content_item_id,
    title: titleById.get(en.content_item_id)?.title ?? '(תוכן נמחק)',
    source: en.source, // 'free' | 'admin' | 'migration'
    status: en.status,
    granted_at: en.enrolled_at,
  }));

  const orderRows = (orders ?? []).map((o) => ({
    ...o,
    user_email: emailById.get(o.user_id) ?? null,
    title: titleById.get(o.content_id)?.title ?? '(תוכן נמחק)',
  }));

  const users = (usersRes.data?.users ?? [])
    .map((u) => ({ id: u.id, email: u.email ?? '', full_name: nameById.get(u.id) ?? null }))
    .sort((a, b) => a.email.localeCompare(b.email));

  return NextResponse.json({
    courses: (content ?? []).filter((c) => c.type === 'course'),
    users,
    grants: [...grants, ...enrollments],
    orders: orderRows,
  });
}

/** Manual admin grant — gives a user access regardless of payment. */
export async function POST(request: Request) {
  await requireAdmin();
  const body = await request.json().catch(() => ({}));
  const userId = body.userId as string | undefined;
  const resourceType = (body.resourceType as ResourceType | undefined) ?? 'course';
  const resourceId = body.resourceId as string | undefined;
  if (!userId || !resourceId || !RESOURCE_TYPES.includes(resourceType)) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  // grantPurchaseAccess (not grantEntitlement): assigning a 'bundle' must expand
  // into a 'course' entitlement per included course, or the assignee holds only
  // the bundle row and every course access check (has_entitlement('course', …))
  // still denies them → they get bounced off the lesson page. For a plain
  // course/guide this behaves exactly like grantEntitlement.
  await grantPurchaseAccess({ userId, resourceType, resourceId, source: 'admin' });
  return NextResponse.json({ ok: true });
}

/**
 * Revoke access WITHOUT deleting learning progress.
 *   entitlement → status 'revoked' (paid/admin grants).
 *   enrollment  → status 'cancelled' (free access). Progress rows are untouched.
 */
export async function PATCH(request: Request) {
  await requireAdmin();
  const body = await request.json().catch(() => ({}));
  const kind = body.kind as 'entitlement' | 'enrollment' | undefined;
  const userId = body.userId as string | undefined;
  const resourceId = body.resourceId as string | undefined;
  if (!userId || !resourceId) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  if (kind === 'enrollment') {
    const supabase = createServiceClient();
    const { error } = await supabase
      .from('enrollments')
      .update({ status: 'cancelled' })
      .eq('user_id', userId)
      .eq('content_item_id', resourceId);
    if (error) return NextResponse.json({ error: 'revoke_failed', message: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const resourceType = (body.resourceType as ResourceType | undefined) ?? 'course';
  await revokeEntitlement({ userId, resourceType, resourceId });
  return NextResponse.json({ ok: true });
}
