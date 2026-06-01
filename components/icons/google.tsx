import type { SVGProps } from 'react';

/** Official Google "G" mark — used on Sign in with Google buttons.
 *  Multi-color paths; pass `className` to size, do not rely on currentColor. */
export function GoogleGIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8a12 12 0 1 1 7.9-21.1l5.7-5.7A20 20 0 1 0 44 24c0-1.2-.1-2.4-.4-3.5Z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8A12 12 0 0 1 24 12c3 0 5.8 1.2 7.9 3.1l5.7-5.7A20 20 0 0 0 6.3 14.7Z" />
      <path fill="#4CAF50" d="M24 44c5.1 0 9.8-2 13.3-5.2l-6.1-5.2c-2 1.4-4.6 2.4-7.2 2.4-5.2 0-9.7-3.3-11.3-8l-6.5 5A20 20 0 0 0 24 44Z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.1 5.2A20 20 0 0 0 44 24c0-1.2-.1-2.4-.4-3.5Z" />
    </svg>
  );
}
