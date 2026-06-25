import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import CouponsTable, { type CouponRow, type CourseOption, type UserOption } from './CouponsTable';

export const metadata = { title: 'קופונים — Digitech Learning Hub' };
export const dynamic = 'force-dynamic';

export default async function CouponsAdminPage() {
  await requireAdmin();
  const supabase = createServiceClient();

  const [{ data: coupons }, { data: redemptions }, { data: courses }, usersRes, { data: profiles }] =
    await Promise.all([
      supabase.from('coupons').select('*').order('created_at', { ascending: false }),
      supabase.from('coupon_redemptions').select('coupon_id'),
      supabase.from('content_items').select('id, title').eq('type', 'course').order('title'),
      supabase.auth.admin.listUsers({ perPage: 1000 }),
      supabase.from('profiles').select('id, full_name'),
    ]);

  const usage = new Map<string, number>();
  for (const r of redemptions ?? []) {
    const cid = (r as { coupon_id: string }).coupon_id;
    usage.set(cid, (usage.get(cid) ?? 0) + 1);
  }

  const rows: CouponRow[] = (coupons ?? []).map((c) => ({
    ...(c as Omit<CouponRow, 'usage_count'>),
    usage_count: usage.get(c.id as string) ?? 0,
  }));

  const courseOptions: CourseOption[] = (courses ?? []).map((c) => ({
    id: c.id as string,
    title: (c.title as string) ?? '(ללא כותרת)',
  }));

  const nameById = new Map<string, string | null>((profiles ?? []).map((p) => [p.id, p.full_name as string | null]));
  const userOptions: UserOption[] = (usersRes.data?.users ?? [])
    .map((u) => ({ id: u.id, email: u.email ?? '', name: nameById.get(u.id) ?? null }))
    .sort((a, b) => a.email.localeCompare(b.email));

  return (
    <div className="px-8 py-8 max-w-5xl">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold text-neutral-950">קופונים</h1>
        <p className="text-sm text-neutral-500 mt-1">{rows.length} קופונים. צור, ערוך ונהל קודי הנחה.</p>
      </header>
      <CouponsTable coupons={rows} courses={courseOptions} users={userOptions} />
    </div>
  );
}
