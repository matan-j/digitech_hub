import type { ReactNode } from 'react';

/**
 * Renders a real form that POSTs to /logout. Must be a form (not a Link),
 * because /logout intentionally has no GET handler — see app/logout/route.ts.
 */
export default function LogoutButton({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <form action="/logout" method="post" className="contents">
      <button type="submit" className={className}>
        {children}
      </button>
    </form>
  );
}
