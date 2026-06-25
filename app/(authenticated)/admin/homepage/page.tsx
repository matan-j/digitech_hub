import { requireAdmin } from '@/lib/auth';
import { getHomepageConfig } from '@/lib/learn/homepage-server';
import { listCreators } from '@/lib/learn/db';
import HomepageStudio from '@/components/learn-admin/HomepageStudio';

export const dynamic = 'force-dynamic';

export default async function HomepageStudioPage() {
  await requireAdmin();
  const [sections, creators] = await Promise.all([
    getHomepageConfig(),
    listCreators({ activeOnly: true }),
  ]);

  // Match the homepage "Top Creators" preview exactly — every active creator,
  // ordered by sort_order — trimmed to the fields the pill needs.
  const pillCreators = creators.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    avatar_url: c.avatar_url,
    role_title: c.role_title,
  }));

  return (
    <div className="px-6 lg:px-10 py-8 lg:py-10 max-w-3xl mx-auto">
      <HomepageStudio initial={sections} creators={pillCreators} />
    </div>
  );
}
