import { parseInline, type RichInline } from '@/lib/learn/rich-content';

/**
 * Inline rich-text renderer for compact, tightly-styled copy (hero subtitle,
 * CTA band, benefit descriptions). Renders **bold**, *italic*, `code`, links
 * and line breaks WITHOUT a block wrapper, so the parent element keeps its own
 * typography (centering, colour, size). For full block content use
 * RichContentRenderer instead.
 *
 * Same safe parser the guides/lessons pipeline uses — no raw HTML injection.
 */
function render(nodes: RichInline[], keyPrefix = 'i'): React.ReactNode {
  return nodes.map((n, idx) => {
    const key = `${keyPrefix}-${idx}`;
    switch (n.t) {
      case 'text': return <span key={key}>{n.v}</span>;
      case 'break': return <br key={key} />;
      case 'code': return <code key={key} dir="auto">{n.v}</code>;
      case 'bold': return <strong key={key}>{render(n.c, key)}</strong>;
      case 'italic': return <em key={key}>{render(n.c, key)}</em>;
      case 'link':
        return (
          <a
            key={key}
            href={n.href}
            className="underline hover:no-underline"
            {...(n.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            {render(n.c, key)}
          </a>
        );
      default: return null;
    }
  });
}

export default function InlineRich({ text }: { text?: string | null }) {
  if (!text) return null;
  return <>{render(parseInline(text))}</>;
}
