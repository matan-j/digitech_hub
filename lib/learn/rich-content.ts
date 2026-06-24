// ============================================================
// rich-content.ts — shared, safe, structured content model
// ------------------------------------------------------------
// One source of truth for turning admin-authored content
// (markdown strings OR the legacy GuideBlock[] JSON) into a
// typed block tree the renderer can map to semantic HTML.
//
// PURE module: no React, no Next, no DOM. Safe to unit-test and
// to import from both server and client components.
//
// Design rules:
//   * Additive & backward compatible — legacy plain-text and the
//     existing GuideBlock[] both flow through here unchanged.
//   * Safety first — links/images/videos are sanitised; only
//     whitelisted video providers (YouTube, Vimeo) embed.
//   * H1 is reserved for the page title — `#` and `##` both map to
//     H2 so body content never emits a second H1.
// ============================================================

import { parseYouTubeInput } from './youtube';
import { parseVimeoInput } from './vimeo';
import type { GuideBlock } from './types';

// ----- Inline model -----
export type RichInline =
  | { t: 'text'; v: string }
  | { t: 'break' }
  | { t: 'bold'; c: RichInline[] }
  | { t: 'italic'; c: RichInline[] }
  | { t: 'code'; v: string }
  | { t: 'link'; href: string; external: boolean; c: RichInline[] };

// ----- Callout variants -----
export type CalloutVariant =
  | 'tip'
  | 'attention'
  | 'example'
  | 'action'
  | 'mistake'
  | 'info'
  | 'success'
  | 'warning';

const CALLOUT_VARIANTS: CalloutVariant[] = [
  'tip', 'attention', 'example', 'action', 'mistake', 'info', 'success', 'warning',
];

// Hebrew/English directive keywords → canonical variant.
const CALLOUT_ALIASES: Record<string, CalloutVariant> = {
  tip: 'tip', טיפ: 'tip', 'טיפ חשוב': 'tip',
  attention: 'attention', warn: 'attention', warning: 'attention', 'שימו לב': 'attention', שימו_לב: 'attention',
  example: 'example', דוגמה: 'example',
  action: 'action', 'פעולה לביצוע': 'action', פעולה: 'action',
  mistake: 'mistake', 'טעות נפוצה': 'mistake', טעות: 'mistake',
  info: 'info', מידע: 'info',
  success: 'success', הצלחה: 'success',
};

// ----- Block model -----
export type RichBlock =
  | { type: 'heading'; level: 2 | 3 | 4; id: string; text: string; inline: RichInline[] }
  | { type: 'paragraph'; inline: RichInline[] }
  | { type: 'list'; ordered: boolean; items: RichInline[][] }
  | { type: 'checklist'; items: { checked: boolean; inline: RichInline[] }[] }
  | { type: 'quote'; inline: RichInline[] }
  | { type: 'divider' }
  | { type: 'code'; code: string; lang?: string }
  | { type: 'prompt'; label?: string; code: string }
  | { type: 'callout'; variant: CalloutVariant; inline: RichInline[] }
  | { type: 'image'; url: string; alt?: string; caption?: string }
  | { type: 'video'; provider: 'youtube' | 'vimeo'; id: string; caption?: string }
  | { type: 'cta'; href: string; external: boolean; label: string };

// ============================================================
// URL safety
// ============================================================

/** Allow only http(s), mailto, internal (/...) and anchor (#...) links. */
export function sanitizeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const url = raw.trim();
  if (!url) return null;
  if (url.startsWith('/') || url.startsWith('#')) return url;
  if (/^mailto:/i.test(url)) return url;
  if (/^https?:\/\//i.test(url)) return url;
  // bare domain like "example.com/x" → assume https
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(url)) return `https://${url}`;
  // javascript:, data:, vbscript:, file: … → rejected
  return null;
}

export function isExternalUrl(url: string): boolean {
  return /^https?:\/\//i.test(url) || /^mailto:/i.test(url);
}

/** Whitelisted video providers only. Returns null for anything else. */
export function parseVideoUrl(raw: string): { provider: 'youtube' | 'vimeo'; id: string } | null {
  const yt = parseYouTubeInput(raw);
  if (yt) return { provider: 'youtube', id: yt.id };
  const vi = parseVimeoInput(raw);
  if (vi) return { provider: 'vimeo', id: vi.id };
  return null;
}

// ============================================================
// Inline parser
// ============================================================

/**
 * Parse a single line of inline markdown into safe inline nodes.
 * Supports: **bold**, *italic* / _italic_, `code`, [label](url), and
 * bare http(s) autolinks. Unknown markup is kept as literal text.
 */
export function parseInline(src: string): RichInline[] {
  const out: RichInline[] = [];
  let i = 0;
  let text = '';
  const flush = () => {
    if (text) { out.push({ t: 'text', v: text }); text = ''; }
  };

  while (i < src.length) {
    const rest = src.slice(i);

    // inline code `...`
    if (src[i] === '`') {
      const end = src.indexOf('`', i + 1);
      if (end > i) {
        flush();
        out.push({ t: 'code', v: src.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }

    // bold **...**
    if (rest.startsWith('**')) {
      const end = src.indexOf('**', i + 2);
      if (end > i + 1) {
        flush();
        out.push({ t: 'bold', c: parseInline(src.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }

    // italic *...* or _..._  (single marker, not part of **)
    if ((src[i] === '*' || src[i] === '_') && src[i + 1] !== src[i]) {
      const marker = src[i];
      const end = src.indexOf(marker, i + 1);
      if (end > i + 1 && src[end - 1] !== ' ') {
        flush();
        out.push({ t: 'italic', c: parseInline(src.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }

    // link [label](url)
    if (src[i] === '[') {
      const close = src.indexOf(']', i + 1);
      if (close > i && src[close + 1] === '(') {
        const paren = src.indexOf(')', close + 2);
        if (paren > close) {
          const label = src.slice(i + 1, close);
          const href = sanitizeUrl(src.slice(close + 2, paren));
          flush();
          if (href) {
            out.push({ t: 'link', href, external: isExternalUrl(href), c: parseInline(label) });
          } else {
            out.push({ t: 'text', v: label });
          }
          i = paren + 1;
          continue;
        }
      }
    }

    // bare autolink
    const auto = rest.match(/^https?:\/\/[^\s<>()]+[^\s<>().,;:!?]/i);
    if (auto) {
      flush();
      const href = auto[0];
      out.push({ t: 'link', href, external: true, c: [{ t: 'text', v: href }] });
      i += auto[0].length;
      continue;
    }

    text += src[i];
    i += 1;
  }
  flush();
  return out;
}

// ============================================================
// Block parser
// ============================================================

const HEADING_RX = /^(#{1,6})\s+(.*)$/;
const ULIST_RX = /^[-*+]\s+(.*)$/;
const OLIST_RX = /^\d+[.)]\s+(.*)$/;
const CHECK_RX = /^[-*+]\s+\[([ xX])\]\s+(.*)$/;
const DIVIDER_RX = /^([-*_])\1{2,}$/;
const IMAGE_RX = /^!\[([^\]]*)\]\(([^)]+)\)\s*$/;
const QUOTE_RX = /^>\s?(.*)$/;

function slugId(n: number): string {
  return `sec-${n}`;
}

/**
 * Parse a markdown string into structured rich blocks.
 * Conservative: anything it doesn't recognise becomes a paragraph,
 * so legacy plain text always renders safely.
 */
export function parseRichMarkdown(src: string): RichBlock[] {
  if (!src || !src.trim()) return [];
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const blocks: RichBlock[] = [];
  let headingCount = 0;

  let paraLines: string[] = [];
  const flushPara = () => {
    if (!paraLines.length) return;
    const inline: RichInline[] = [];
    paraLines.forEach((ln, idx) => {
      if (idx > 0) inline.push({ t: 'break' });
      inline.push(...parseInline(ln));
    });
    blocks.push({ type: 'paragraph', inline });
    paraLines = [];
  };

  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();

    // blank line → paragraph boundary
    if (!line) { flushPara(); i += 1; continue; }

    // ----- fenced block ```lang ... ``` -----
    const fence = line.match(/^```\s*([a-zA-Z0-9_-]*)\s*$/);
    if (fence) {
      flushPara();
      const lang = fence[1]?.toLowerCase() || '';
      const buf: string[] = [];
      i += 1;
      while (i < lines.length && !/^```\s*$/.test(lines[i].trim())) {
        buf.push(lines[i]);
        i += 1;
      }
      i += 1; // skip closing fence
      const code = buf.join('\n');
      if (lang === 'prompt' || lang === 'copy') {
        blocks.push({ type: 'prompt', code });
      } else {
        blocks.push({ type: 'code', code, lang: lang || undefined });
      }
      continue;
    }

    // ----- directive container :::name [args] ... ::: -----
    const directive = line.match(/^:::\s*(.+)$/);
    if (directive) {
      flushPara();
      const { name, args } = splitDirective(directive[1].trim());
      const buf: string[] = [];
      i += 1;
      while (i < lines.length && lines[i].trim() !== ':::') {
        buf.push(lines[i]);
        i += 1;
      }
      i += 1; // skip closing :::
      const inner = buf.join('\n').trim();
      const handled = consumeDirective(name, args, inner, blocks);
      if (!handled) {
        // unknown directive → treat inner as a paragraph so nothing is lost
        if (inner) blocks.push({ type: 'paragraph', inline: parseInline(inner) });
      }
      continue;
    }

    // ----- divider -----
    if (DIVIDER_RX.test(line)) { flushPara(); blocks.push({ type: 'divider' }); i += 1; continue; }

    // ----- heading (# … ###### ; # and ## both → H2; H1 reserved) -----
    const h = line.match(HEADING_RX);
    if (h) {
      flushPara();
      const hashes = h[1].length;
      const level: 2 | 3 | 4 = hashes <= 2 ? 2 : hashes === 3 ? 3 : 4;
      const inline = parseInline(h[2].trim());
      headingCount += 1;
      blocks.push({ type: 'heading', level, id: slugId(headingCount), text: stripInline(inline), inline });
      i += 1;
      continue;
    }

    // ----- standalone image -----
    const img = line.match(IMAGE_RX);
    if (img) {
      const url = sanitizeUrl(img[2]);
      if (url) { flushPara(); blocks.push({ type: 'image', url, alt: img[1] || undefined }); i += 1; continue; }
    }

    // ----- standalone video URL -----
    const vid = parseVideoUrl(line);
    if (vid && /^https?:\/\/\S+$/.test(line)) {
      flushPara();
      blocks.push({ type: 'video', provider: vid.provider, id: vid.id });
      i += 1;
      continue;
    }

    // ----- blockquote (consecutive) -----
    if (QUOTE_RX.test(line)) {
      flushPara();
      const qbuf: string[] = [];
      while (i < lines.length && QUOTE_RX.test(lines[i].trim())) {
        qbuf.push(lines[i].trim().replace(QUOTE_RX, '$1'));
        i += 1;
      }
      const inline: RichInline[] = [];
      qbuf.forEach((ln, idx) => {
        if (idx > 0) inline.push({ t: 'break' });
        inline.push(...parseInline(ln));
      });
      blocks.push({ type: 'quote', inline });
      continue;
    }

    // ----- checklist (consecutive) -----
    if (CHECK_RX.test(line)) {
      flushPara();
      const items: { checked: boolean; inline: RichInline[] }[] = [];
      while (i < lines.length && CHECK_RX.test(lines[i].trim())) {
        const m = lines[i].trim().match(CHECK_RX)!;
        items.push({ checked: m[1].toLowerCase() === 'x', inline: parseInline(m[2]) });
        i += 1;
      }
      blocks.push({ type: 'checklist', items });
      continue;
    }

    // ----- unordered list (consecutive) -----
    if (ULIST_RX.test(line)) {
      flushPara();
      const items: RichInline[][] = [];
      while (i < lines.length) {
        const t = lines[i].trim();
        if (CHECK_RX.test(t) || !ULIST_RX.test(t)) break;
        items.push(parseInline(t.replace(ULIST_RX, '$1')));
        i += 1;
      }
      blocks.push({ type: 'list', ordered: false, items });
      continue;
    }

    // ----- ordered list (consecutive) -----
    if (OLIST_RX.test(line)) {
      flushPara();
      const items: RichInline[][] = [];
      while (i < lines.length && OLIST_RX.test(lines[i].trim())) {
        items.push(parseInline(lines[i].trim().replace(OLIST_RX, '$1')));
        i += 1;
      }
      blocks.push({ type: 'list', ordered: true, items });
      continue;
    }

    // ----- default: paragraph line -----
    paraLines.push(line);
    i += 1;
  }
  flushPara();
  return blocks;
}

/**
 * Split a directive head into name + args, honouring multi-word Hebrew
 * callout aliases ("שימו לב", "פעולה לביצוע", …) before falling back to
 * first-token splitting.
 */
function splitDirective(head: string): { name: string; args: string } {
  const lower = head.toLowerCase();
  const aliasKey = Object.keys(CALLOUT_ALIASES)
    .sort((a, b) => b.length - a.length)
    .find((k) => lower === k.toLowerCase() || lower.startsWith(k.toLowerCase() + ' '));
  if (aliasKey) return { name: aliasKey, args: head.slice(aliasKey.length).trim() };
  const sp = head.indexOf(' ');
  if (sp === -1) return { name: head, args: '' };
  return { name: head.slice(0, sp), args: head.slice(sp + 1).trim() };
}

/** Handle a parsed `:::name args … :::` directive. Returns false if unknown. */
function consumeDirective(rawName: string, args: string, inner: string, blocks: RichBlock[]): boolean {
  const name = rawName.toLowerCase();
  // callouts
  const variant = CALLOUT_ALIASES[rawName] ?? CALLOUT_ALIASES[name] ?? (CALLOUT_VARIANTS.includes(name as CalloutVariant) ? (name as CalloutVariant) : null);
  if (variant) {
    blocks.push({ type: 'callout', variant, inline: inlineFromMultiline(inner) });
    return true;
  }
  if (name === 'prompt' || name === 'copy') {
    blocks.push({ type: 'prompt', label: args || undefined, code: inner });
    return true;
  }
  if (name === 'cta') {
    // :::cta [label](href)  OR  :::cta href "label"
    const link = inner.match(/^\[([^\]]+)\]\(([^)]+)\)\s*$/) || args.match(/^\[([^\]]+)\]\(([^)]+)\)\s*$/);
    if (link) {
      const href = sanitizeUrl(link[2]);
      if (href) { blocks.push({ type: 'cta', href, external: isExternalUrl(href), label: link[1] }); return true; }
    }
    return false;
  }
  if (name === 'video') {
    const vid = parseVideoUrl(args || inner.trim());
    if (vid) { blocks.push({ type: 'video', provider: vid.provider, id: vid.id }); return true; }
    return false;
  }
  return false;
}

function inlineFromMultiline(src: string): RichInline[] {
  const inline: RichInline[] = [];
  src.split('\n').forEach((ln, idx) => {
    if (idx > 0) inline.push({ t: 'break' });
    inline.push(...parseInline(ln));
  });
  return inline;
}

/** Flatten inline nodes to plain text (used for heading TOC labels). */
export function stripInline(nodes: RichInline[]): string {
  return nodes
    .map((n) => {
      if (n.t === 'text' || n.t === 'code') return n.v;
      if (n.t === 'break') return ' ';
      if ('c' in n) return stripInline(n.c);
      return '';
    })
    .join('')
    .trim();
}

// ============================================================
// Unify GuideBlock[] | string → RichBlock[]
// ============================================================

/** Map a legacy guide callout tone to a rich callout variant. */
function toneToVariant(tone?: 'info' | 'success' | 'warning'): CalloutVariant {
  if (tone === 'success') return 'success';
  if (tone === 'warning') return 'warning';
  return 'info';
}

/**
 * Convert any stored content shape into rich blocks.
 *   - string                → parsed as markdown (lesson bodies, legacy text)
 *   - GuideBlock[]          → each block expanded; markdown/callout content
 *                             is itself parsed as rich markdown.
 */
export function toRichBlocks(content: GuideBlock[] | string | null | undefined): RichBlock[] {
  if (content == null) return [];
  if (typeof content === 'string') return parseRichMarkdown(content);

  const out: RichBlock[] = [];
  let headingOffset = 0;
  for (const b of content) {
    if (b.type === 'markdown') {
      const parsed = parseRichMarkdown(b.content);
      // re-id headings so anchors stay unique across blocks
      for (const blk of parsed) {
        if (blk.type === 'heading') { headingOffset += 1; blk.id = slugId(1000 + headingOffset); }
        out.push(blk);
      }
    } else if (b.type === 'image') {
      const url = sanitizeUrl(b.url);
      if (url) out.push({ type: 'image', url, alt: b.alt, caption: b.caption });
    } else if (b.type === 'video') {
      const id = b.youtubeId
        ? parseYouTubeInput(b.youtubeId)?.id
        : b.vimeoId
          ? parseVimeoInput(b.vimeoId)?.id
          : undefined;
      if (id) out.push({ type: 'video', provider: b.youtubeId ? 'youtube' : 'vimeo', id, caption: b.caption });
    } else if (b.type === 'callout') {
      out.push({ type: 'callout', variant: toneToVariant(b.tone), inline: inlineFromMultiline(b.content) });
    }
  }
  return out;
}

// ============================================================
// Table of contents
// ============================================================

export type TocEntry = { id: string; text: string };

/** Top-level (H2) entries for the "במדריך הזה" table of contents. */
export function extractToc(blocks: RichBlock[]): TocEntry[] {
  return blocks
    .filter((b): b is Extract<RichBlock, { type: 'heading' }> => b.type === 'heading' && b.level === 2)
    .map((h) => ({ id: h.id, text: h.text }));
}
