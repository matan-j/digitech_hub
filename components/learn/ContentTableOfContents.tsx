'use client';

import { useEffect, useState } from 'react';
import { List, ChevronDown } from 'lucide-react';
import type { TocEntry } from '@/lib/learn/rich-content';

type Props = {
  entries: TocEntry[];
  /** 'sidebar' = sticky aside (desktop); 'inline' = collapsible card (mobile/top). */
  variant?: 'sidebar' | 'inline';
  title?: string;
};

/**
 * "בהדרכה הזו" table of contents. Renders only when given entries
 * (pages gate on >=3 H2). Sidebar variant scroll-spies the active
 * section; inline variant collapses on small screens.
 */
export default function ContentTableOfContents({ entries, variant = 'sidebar', title = 'בהדרכה הזו' }: Props) {
  const [active, setActive] = useState<string | null>(entries[0]?.id ?? null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (variant !== 'sidebar') return;
    const els = entries.map((e) => document.getElementById(e.id)).filter((el): el is HTMLElement => !!el);
    if (!els.length) return;
    const obs = new IntersectionObserver(
      (items) => {
        const visible = items.filter((i) => i.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-80px 0px -65% 0px', threshold: 0 },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [entries, variant]);

  function go(e: React.MouseEvent, id: string) {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActive(id);
      setOpen(false);
    }
  }

  if (!entries.length) return null;

  const links = (
    <ol className="toc__list">
      {entries.map((e) => (
        <li key={e.id}>
          <a
            href={`#${e.id}`}
            onClick={(ev) => go(ev, e.id)}
            className={['toc__link', active === e.id ? 'is-active' : ''].join(' ')}
            dir="auto"
          >
            {e.text}
          </a>
        </li>
      ))}
    </ol>
  );

  if (variant === 'inline') {
    return (
      <nav className="toc toc--inline" aria-label={title} dir="rtl">
        <button type="button" className="toc__toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          <span className="flex items-center gap-2">
            <List className="w-4 h-4" aria-hidden />
            {title}
          </span>
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
        </button>
        {open && links}
      </nav>
    );
  }

  return (
    <nav className="toc toc--sidebar" aria-label={title} dir="rtl">
      <p className="toc__title">
        <List className="w-3.5 h-3.5" aria-hidden />
        {title}
      </p>
      {links}
    </nav>
  );
}
