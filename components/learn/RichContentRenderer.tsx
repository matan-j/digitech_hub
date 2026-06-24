import { ExternalLink, ArrowLeft } from 'lucide-react';
import type { GuideBlock } from '@/lib/learn/types';
import {
  toRichBlocks,
  type RichBlock,
  type RichInline,
} from '@/lib/learn/rich-content';
import PromptBlock from './PromptBlock';
import CalloutBlock from './CalloutBlock';

// ----- inline rendering (React, no dangerouslySetInnerHTML) -----
function renderInline(nodes: RichInline[], keyPrefix = 'i'): React.ReactNode {
  return nodes.map((n, idx) => {
    const key = `${keyPrefix}-${idx}`;
    switch (n.t) {
      case 'text': return <span key={key}>{n.v}</span>;
      case 'break': return <br key={key} />;
      case 'code': return <code key={key} dir="auto">{n.v}</code>;
      case 'bold': return <strong key={key}>{renderInline(n.c, key)}</strong>;
      case 'italic': return <em key={key}>{renderInline(n.c, key)}</em>;
      case 'link':
        return (
          <a
            key={key}
            href={n.href}
            {...(n.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            {renderInline(n.c, key)}
          </a>
        );
      default: return null;
    }
  });
}

function VideoEmbed({ provider, id, caption }: { provider: 'youtube' | 'vimeo'; id: string; caption?: string }) {
  const src =
    provider === 'youtube'
      ? `https://www.youtube-nocookie.com/embed/${id}`
      : `https://player.vimeo.com/video/${id}?dnt=1&title=0&byline=0`;
  return (
    <figure className="rc-figure">
      <div className="rc-video">
        <iframe
          src={src}
          title={caption || 'video'}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

function Block({ block, idx }: { block: RichBlock; idx: number }) {
  switch (block.type) {
    case 'heading': {
      // No dir="auto" — Hebrew-first RTL right-alignment even when a heading
      // starts with an English product name (ChatGPT, Notion…).
      const props = { id: block.id, className: 'rc-heading' };
      if (block.level === 2) return <h2 {...props}>{renderInline(block.inline, block.id)}</h2>;
      if (block.level === 3) return <h3 {...props}>{renderInline(block.inline, block.id)}</h3>;
      return <h4 {...props}>{renderInline(block.inline, block.id)}</h4>;
    }
    case 'paragraph':
      return <p>{renderInline(block.inline, `p${idx}`)}</p>;
    case 'list':
      return block.ordered ? (
        <ol>{block.items.map((it, i) => <li key={i}>{renderInline(it, `o${idx}-${i}`)}</li>)}</ol>
      ) : (
        <ul>{block.items.map((it, i) => <li key={i}>{renderInline(it, `u${idx}-${i}`)}</li>)}</ul>
      );
    case 'checklist':
      return (
        <ul className="rc-checklist">
          {block.items.map((it, i) => (
            <li key={i} className={it.checked ? 'is-checked' : ''}>
              <span className="rc-check" aria-hidden>{it.checked ? '✓' : ''}</span>
              <span>{renderInline(it.inline, `c${idx}-${i}`)}</span>
            </li>
          ))}
        </ul>
      );
    case 'quote':
      return <blockquote>{renderInline(block.inline, `q${idx}`)}</blockquote>;
    case 'divider':
      return <hr className="rc-divider" />;
    case 'code':
      return <pre className="rc-code" dir="auto"><code>{block.code}</code></pre>;
    case 'prompt':
      return <PromptBlock code={block.code} label={block.label} />;
    case 'callout':
      return <CalloutBlock variant={block.variant}>{renderInline(block.inline, `cl${idx}`)}</CalloutBlock>;
    case 'image':
      return (
        <figure className="rc-figure">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={block.url} alt={block.alt ?? ''} loading="lazy" />
          {block.caption && <figcaption>{block.caption}</figcaption>}
        </figure>
      );
    case 'video':
      return <VideoEmbed provider={block.provider} id={block.id} caption={block.caption} />;
    case 'cta':
      return (
        <div className="rc-cta-wrap">
          <a
            href={block.href}
            className="rc-cta"
            {...(block.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            <span>{block.label}</span>
            {block.external ? <ExternalLink className="w-4 h-4" aria-hidden /> : <ArrowLeft className="w-4 h-4" aria-hidden />}
          </a>
        </div>
      );
    default:
      return null;
  }
}

type Props = {
  /** Stored content: a markdown string (lessons/legacy) or GuideBlock[] (guides). */
  content: GuideBlock[] | string | null | undefined;
  /** Optional extra classes on the article wrapper. */
  className?: string;
  /** Shown when there is no content. */
  emptyLabel?: string;
};

/**
 * Shared renderer for all structured editorial content (guides + course
 * lessons + admin preview). Produces semantic HTML — no raw HTML injection.
 */
export default function RichContentRenderer({ content, className = '', emptyLabel }: Props) {
  const blocks = toRichBlocks(content);
  if (!blocks.length) {
    return emptyLabel ? <p className="text-neutral-400 italic">{emptyLabel}</p> : null;
  }
  return (
    <div className={`rich-content ${className}`} dir="rtl">
      {blocks.map((b, i) => <Block key={i} block={b} idx={i} />)}
    </div>
  );
}
