import { requireAdmin } from '@/lib/auth';
import { getHomepageConfig } from '@/lib/learn/homepage-server';
import HomepageStudio from '@/components/learn-admin/HomepageStudio';

export const dynamic = 'force-dynamic';

export default async function HomepageStudioPage() {
  await requireAdmin();
  const sections = await getHomepageConfig();

  return (
    <div className="px-6 lg:px-10 py-8 lg:py-10 max-w-3xl mx-auto">
      <HomepageStudio initial={sections} />
    </div>
  );
}
