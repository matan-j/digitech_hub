import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { getUserPurchases } from '@/lib/payments/purchase-history';

export const runtime = 'nodejs';

type ContentLite = { id: string; slug: string; title: string; type: string };

/**
 * Per-user access data for the user detail popup.
 *   courses → assignable courses for the dropdown.
 *   grants  → the user's active access (entitlements + free enrollments),
 *             shown as removable tags.
 */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id: userId } = await ctx.params;
  const supabase = createServiceClient();

  const [{ data: content }, { data: ents }, { data: enrolls }, purchases] = await Promise.all([
    supabase.from('content_items').select('id, slug, title, type').in('type', ['course', 'guide']),
    supabase
      .from('entitlements')
      .select('resource_type, resource_id, source, status, granted_at')
      .eq('user_id', userId)
      .eq('status', 'active'),
    supabase
      .from('enrollments')
      .select('content_item_id, source, status, enrolled_at')
      .eq('user_id', userId)
      .eq('status', 'active'),
    getUserPurchases(userId),
  ]);

  const byId = new Map<string, ContentLite>((content ?? []).map((c) => [c.id, c as ContentLite]));

  const grants = [
    ...(ents ?? []).map((e) => ({
      kind: 'entitlement' as const,
      resource_type: e.resource_type,
      resource_id: e.resource_id,
      title: byId.get(e.resource_id)?.title ?? '(תוכן נמחק)',
      source: e.source,
      granted_at: e.granted_at,
    })),
    ...(enrolls ?? []).map((en) => ({
      kind: 'enrollment' as const,
      resource_type: 'course',
      resource_id: en.content_item_id,
      title: byId.get(en.content_item_id)?.title ?? '(תוכן נמחק)',
      source: en.source,
      granted_at: en.enrolled_at,
    })),
  ];

  const courses = (content ?? [])
    .filter((c) => c.type === 'course')
    .sort((a, b) => (a.title ?? '').localeCompare(b.title ?? '', 'he'));

  return NextResponse.json({ courses, grants, purchases });
}
