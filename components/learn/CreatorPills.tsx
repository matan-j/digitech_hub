import Link from 'next/link';
import type { Creator } from '@/lib/learn/types';

/** Minimal creator shape the homepage pill needs. */
export type PillCreator = Pick<Creator, 'id' | 'slug' | 'name' | 'avatar_url' | 'role_title'>;

/**
 * "Top Creators" pills row. Pure presentational component shared by the public
 * homepage (app/page.tsx) and the admin Studio preview, so the admin sees the
 * exact same cards — and all of them, not a single one.
 */
export default function CreatorPills({ creators }: { creators: PillCreator[] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {creators.map((cr) => (
        <Link
          key={cr.id}
          href={`/learn/creators/${cr.slug}`}
          className="group flex items-center gap-3 bg-white rounded-pill border border-neutral-200 pe-5 ps-2 py-2 hover:border-brand-purple-400 transition-colors"
          style={{ boxShadow: 'var(--shadow-card)' }}
        >
          <span className="w-10 h-10 rounded-pill bg-brand-purple-100 text-brand-purple-700 flex items-center justify-center font-extrabold overflow-hidden shrink-0">
            {cr.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cr.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              cr.name.charAt(0)
            )}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-neutral-900 group-hover:text-brand-purple-700 transition-colors truncate">
              {cr.name}
            </span>
            {cr.role_title && <span className="block text-xs text-neutral-500 truncate">{cr.role_title}</span>}
          </span>
        </Link>
      ))}
    </div>
  );
}
