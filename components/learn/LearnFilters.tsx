'use client';

import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { DOMAINS, type DomainId, domainBadgeClasses, domainDotClasses } from '@/lib/learn/domains';
import LearnCard from './LearnCard';

export type FilterableItem = {
  id: string;
  href: string;
  title: string;
  tagline: string | null;
  cover_url: string | null;
  video_url: string | null;
  domain: DomainId | null;
  locked: boolean;
};

type Props = {
  items: FilterableItem[];
  variant: 'guide' | 'playbook';
  emptyText?: string;
};

export default function LearnFilters({ items, variant, emptyText = 'אין פריטים זמינים.' }: Props) {
  const [activeDomain, setActiveDomain] = useState<DomainId | null>(null);
  const [search, setSearch] = useState('');

  const counts = useMemo(() => {
    const map = new Map<DomainId, number>();
    for (const item of items) {
      if (item.domain) map.set(item.domain, (map.get(item.domain) ?? 0) + 1);
    }
    return map;
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (activeDomain && it.domain !== activeDomain) return false;
      if (!q) return true;
      const hay = `${it.title} ${it.tagline ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, activeDomain, search]);

  return (
    <>
      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveDomain(null)}
            className={[
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-xs font-semibold border transition-colors',
              activeDomain === null
                ? 'bg-brand-purple-700 text-white border-brand-purple-700'
                : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400',
            ].join(' ')}
          >
            הכל
            <span className="text-[10px] opacity-80">({items.length})</span>
          </button>
          {DOMAINS.map((d) => {
            const count = counts.get(d.id) ?? 0;
            if (count === 0) return null;
            const active = activeDomain === d.id;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setActiveDomain(active ? null : d.id)}
                className={[
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-xs font-semibold border transition-colors',
                  active ? domainBadgeClasses(d.id) : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400',
                ].join(' ')}
              >
                <span className={['w-1.5 h-1.5 rounded-pill', domainDotClasses(d.id)].join(' ')} aria-hidden />
                {d.label}
                <span className="text-[10px] opacity-80">({count})</span>
              </button>
            );
          })}
        </div>

        <div className="relative max-w-md">
          <Search className="absolute top-1/2 -translate-y-1/2 right-3 w-4 h-4 text-neutral-400 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש לפי כותרת או תיאור…"
            className="w-full pe-9 ps-3 py-2 rounded-pill border border-neutral-200 bg-white focus:border-brand-purple-500 focus:outline-none text-sm"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute top-1/2 -translate-y-1/2 left-2 p-1 rounded-pill text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"
              aria-label="נקה חיפוש"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div
          className="bg-white rounded-card border border-neutral-200 p-12 text-center"
          style={{ boxShadow: 'var(--shadow-card)' }}
        >
          <p className="text-neutral-500">{search || activeDomain ? 'לא נמצאו פריטים לסינון.' : emptyText}</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((it) => (
            <LearnCard
              key={it.id}
              variant={variant}
              href={it.href}
              title={it.title}
              tagline={it.tagline}
              coverUrl={it.cover_url}
              videoUrl={it.video_url}
              domain={it.domain}
              locked={it.locked}
            />
          ))}
        </div>
      )}
    </>
  );
}
