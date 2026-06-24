import { requireAdmin } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import LeadsTable from '@/components/admin/LeadsTable';

export const metadata = { title: 'לידים ולומדים — Digitech Learning Hub' };
export const dynamic = 'force-dynamic';

export default async function LeadsAdminPage() {
  await requireAdmin();

  // Pre-compute the distinct utm_source values for the filter dropdown.
  const admin = createServiceClient();
  const { data: utmRows } = await admin
    .from('profiles')
    .select('utm_source')
    .not('utm_source', 'is', null);

  const utmSources = [
    ...new Set(
      ((utmRows ?? []) as { utm_source: string | null }[])
        .map((r) => r.utm_source)
        .filter((v): v is string => !!v && v.trim().length > 0)
    ),
  ].sort();

  return (
    <div className="px-8 py-8 max-w-7xl">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold text-neutral-950">לידים ולומדים</h1>
        <p className="text-sm text-neutral-500 mt-1">
          מעקב אחר לידים, מקורות הגעה, רישומים, רכישות והתקדמות לומדים.
        </p>
      </header>
      <LeadsTable utmSources={utmSources} />
    </div>
  );
}
