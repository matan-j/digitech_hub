// ============================================================
// paste-normalize.ts — clipboard → safe markdown
// ------------------------------------------------------------
// Turns pasted content from Google Docs / Word / Notion / ChatGPT /
// web pages into the markdown the rich-content parser understands.
//
//   normalizePastedHtml(html) → markdown   (browser only — uses DOMParser)
//   normalizePastedText(text) → markdown   (pure — detects clear structure)
//
// Safety: HTML is walked node-by-node; only semantic structure is
// kept. Scripts, styles, font/size markup and tracking junk are
// dropped — we never feed raw pasted HTML to the renderer.
// ============================================================

// ----- Plain-text structure detection (pure, testable) -----

// Hebrew/English step + section labels we promote to H2.
const STEP_RX = /^(שלב|צעד|step)\s*\d+\s*[:.)]?\s*/i;
const SECTION_LABELS = [
  'מה זה', 'מה זה?',
  'למה זה חשוב', 'למה זה חשוב?',
  'איך מתחילים', 'איך מתחילים?',
  'איך עושים את זה', 'איך עושים את זה?',
  'סיכום', 'לסיכום',
];
const PROMPT_LABELS = ['prompt', 'פרומפט', 'להעתקה', 'דוגמה מוכנה לשימוש', 'תבנית מוכנה', 'prompt מוכן להעתקה'];
const CALLOUT_LABELS: { rx: RegExp; name: string }[] = [
  { rx: /^טיפ\s*חשוב\s*[:.]?\s*/, name: 'tip' },
  { rx: /^שימו\s*לב\s*[:.]?\s*/, name: 'attention' },
  { rx: /^דוגמה\s*[:.]?\s*/, name: 'example' },
  { rx: /^פעולה\s*לביצוע\s*[:.]?\s*/, name: 'action' },
  { rx: /^טעות\s*נפוצה\s*[:.]?\s*/, name: 'mistake' },
];

/**
 * Normalise pasted PLAIN text into markdown. Conservative: only
 * unambiguous structure is converted; nothing is invented.
 */
export function normalizePastedText(text: string): string {
  const src = text.replace(/\r\n/g, '\n').replace(/ /g, ' ');
  const lines = src.split('\n');
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) { out.push(''); continue; }

    // existing markdown heading → keep, but steps are always primary (H2)
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const txt = headingMatch[2].trim();
      out.push(STEP_RX.test(txt) ? `## ${txt}` : raw);
      continue;
    }

    // other already-structured lines → leave as-is
    if (/^(>\s|[-*+]\s|\d+[.)]\s|```|:::)/.test(line)) { out.push(raw); continue; }

    // "שלב 1: …" → H2 (keep the full label text)
    if (STEP_RX.test(line)) { out.push(`## ${line}`); continue; }

    // known section labels → H2
    const lc = line.replace(/[:.]\s*$/, '');
    if (SECTION_LABELS.some((s) => s === line || s === lc)) { out.push(`## ${line}`); continue; }

    // callout labels at line start with following content → directive
    const callout = CALLOUT_LABELS.find((c) => c.rx.test(line));
    if (callout) {
      const body = line.replace(callout.rx, '').trim();
      out.push(`:::${callout.name}`);
      if (body) out.push(body);
      out.push(':::');
      continue;
    }

    out.push(raw);
  }

  // Collapse 3+ blank lines to a single boundary.
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ----- HTML structure conversion (browser only) -----

/** True when a label looks like a "copy this prompt" heading. */
function looksLikePromptLabel(s: string): boolean {
  const t = s.trim().toLowerCase().replace(/[:.]\s*$/, '');
  return PROMPT_LABELS.some((p) => t === p.toLowerCase());
}

/**
 * Convert pasted rich HTML into markdown. Walks the DOM keeping only
 * semantic structure. Returns '' when no DOM is available (caller
 * should fall back to normalizePastedText).
 *
 * Handles Google Docs / Word quirks: the outer `<b style="font-weight:normal">`
 * wrapper, heading paragraphs styled with font-size/weight (not <h2>), bold/
 * italic carried on inline styles, and google.com/url redirect links.
 */
export function normalizePastedHtml(html: string): string {
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  // drop dangerous / noise nodes outright
  doc.querySelectorAll('script,style,noscript,meta,link,head,svg,iframe,object,embed').forEach((n) => n.remove());
  // Real browsers populate <body>; some parsers keep fragment nodes at the
  // document root — fall back to the document node so nothing is missed.
  const root: Node = doc.body && doc.body.childNodes.length ? doc.body : doc;
  const md = blockToMarkdown(root).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  // run the text-pattern pass too, so Hebrew step/section labels lift to H2
  return normalizePastedText(md);
}

const BLOCK_TAGS = new Set([
  'p', 'div', 'section', 'article', 'main', 'header', 'footer', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'thead', 'tbody', 'tr', 'pre',
  'blockquote', 'hr', 'figure', 'br',
]);

/** True when an element contains block-level descendants (so it's a container, not inline). */
function hasBlockChildren(el: Element): boolean {
  for (const c of Array.from(el.children)) {
    if (BLOCK_TAGS.has(c.tagName.toLowerCase())) return true;
    if (hasBlockChildren(c)) return true;
  }
  return false;
}

function styleOf(el: Element): string {
  return (el.getAttribute('style') || '').toLowerCase();
}
/** Numeric font-weight from inline style (bold→700, normal→400, else 0=unknown). */
function fontWeight(el: Element): number {
  const m = styleOf(el).match(/font-weight:\s*(\d{3}|bold|bolder|normal|lighter)/);
  if (!m) return 0;
  if (m[1] === 'bold' || m[1] === 'bolder') return 700;
  if (m[1] === 'normal' || m[1] === 'lighter') return 400;
  return Number(m[1]) || 0;
}
function isItalic(el: Element): boolean {
  return /font-style:\s*italic/.test(styleOf(el));
}
/** Font-size in px-equivalent (pt*1.333), 0 if unknown. */
function fontSizePx(el: Element): number {
  const m = styleOf(el).match(/font-size:\s*([\d.]+)(pt|px|em|rem)/);
  if (!m) return 0;
  const n = Number(m[1]);
  if (m[2] === 'pt') return n * 1.333;
  if (m[2] === 'em' || m[2] === 'rem') return n * 16;
  return n;
}

/** Unwrap google.com/url?q=… redirect links Google Docs injects. */
function cleanHref(raw: string): string {
  const href = raw.trim();
  const m = href.match(/^https?:\/\/(?:www\.)?google\.com\/url\?(?:[^&]*&)*q=([^&]+)/i);
  if (m) { try { return decodeURIComponent(m[1]); } catch { return m[1]; } }
  return href;
}

function inlineToMarkdown(node: Node): string {
  if (node.nodeType === 3 /* text */) {
    return (node.textContent || '').replace(/\s+/g, ' ');
  }
  if (node.nodeType !== 1) return '';
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  const inner = Array.from(el.childNodes).map(inlineToMarkdown).join('');
  const trimmed = inner.trim();

  switch (tag) {
    case 'br': return '\n';
    case 'strong': case 'b': {
      // Google Docs wraps whole docs in <b style="font-weight:normal"> — not bold.
      const w = fontWeight(el);
      return trimmed && w !== 400 ? `**${trimmed}**` : inner;
    }
    case 'em': case 'i': return trimmed ? `*${trimmed}*` : '';
    case 'u': case 'ins': return inner;
    case 'code': case 'tt': return trimmed ? `\`${trimmed}\`` : '';
    case 'a': {
      const href = cleanHref(el.getAttribute('href') || '');
      const text = trimmed || href;
      return href && /^(https?:|mailto:|\/|#)/i.test(href) ? `[${text}](${href})` : text;
    }
    case 'span': {
      // Carry bold/italic from inline styles (Google Docs/Word formatting).
      let out = inner;
      if (out.trim()) {
        if (fontWeight(el) >= 600) out = `**${out.trim()}**`;
        if (isItalic(el)) out = `*${out.trim()}*`;
      }
      return out;
    }
    default: return inner;
  }
}

/** All non-whitespace text in this paragraph is bold-weighted. */
function isAllBold(el: Element): boolean {
  let sawText = false;
  let allBold = true;
  const walk = (n: Node, inheritedBold: boolean) => {
    if (n.nodeType === 3) {
      if ((n.textContent || '').trim()) { sawText = true; if (!inheritedBold) allBold = false; }
      return;
    }
    if (n.nodeType !== 1) return;
    const e = n as Element;
    const w = fontWeight(e);
    const bold = w >= 600 ? true : w === 400 ? false : inheritedBold;
    for (const c of Array.from(e.childNodes)) walk(c, bold);
  };
  walk(el, false);
  return sawText && allBold;
}

/** Detect a Google-Docs heading paragraph (styled, not an <h_> tag). */
function paragraphHeadingLevel(el: Element): number | null {
  const text = (el.textContent || '').trim();
  if (!text || text.length > 120) return null;
  // largest inline font-size inside the paragraph
  let maxSize = fontSizePx(el);
  el.querySelectorAll('*').forEach((c) => { maxSize = Math.max(maxSize, fontSizePx(c)); });
  const bold = isAllBold(el);
  if (maxSize >= 24) return 2;
  if (maxSize >= 18) return 3;
  if (bold && maxSize >= 15) return 3;
  if (bold && !/[.!?…]$/.test(text)) return 3; // short bold line, not a sentence
  return null;
}

function blockToMarkdown(root: Node): string {
  const parts: string[] = [];

  for (const child of Array.from(root.childNodes)) {
    if (child.nodeType === 3) {
      const t = (child.textContent || '').trim();
      if (t) parts.push(t);
      continue;
    }
    if (child.nodeType !== 1) continue;
    const el = child as HTMLElement;
    const tag = el.tagName.toLowerCase();

    switch (tag) {
      case 'h1': case 'h2': parts.push(`## ${inlineToMarkdown(el).trim()}`); break;
      case 'h3': parts.push(`### ${inlineToMarkdown(el).trim()}`); break;
      case 'h4': case 'h5': case 'h6': parts.push(`#### ${inlineToMarkdown(el).trim()}`); break;
      case 'p': {
        const text = inlineToMarkdown(el).trim();
        if (!text) break;
        const hl = paragraphHeadingLevel(el);
        if (hl === 2) parts.push(`## ${text.replace(/^\*+|\*+$/g, '').trim()}`);
        else if (hl === 3) parts.push(`### ${text.replace(/^\*+|\*+$/g, '').trim()}`);
        else parts.push(text);
        break;
      }
      case 'ul': {
        const items = Array.from(el.querySelectorAll(':scope > li'))
          .map((li) => `- ${inlineToMarkdown(li).trim()}`)
          .filter((s) => s.trim().length > 2);
        if (items.length) parts.push(items.join('\n'));
        break;
      }
      case 'ol': {
        const items = Array.from(el.querySelectorAll(':scope > li'))
          .map((li, idx) => `${idx + 1}. ${inlineToMarkdown(li).trim()}`)
          .filter((s) => s.trim().length > 3);
        if (items.length) parts.push(items.join('\n'));
        break;
      }
      case 'blockquote': {
        const text = inlineToMarkdown(el).trim();
        if (text) parts.push(text.split('\n').map((l) => `> ${l}`).join('\n'));
        break;
      }
      case 'pre': {
        const code = (el.textContent || '').replace(/\n+$/, '');
        if (code.trim()) {
          const prev = (el.previousElementSibling?.textContent || '').trim();
          parts.push(looksLikePromptLabel(prev) ? '```prompt\n' + code + '\n```' : '```\n' + code + '\n```');
        }
        break;
      }
      case 'hr': parts.push('---'); break;
      case 'img': {
        const srcUrl = (el.getAttribute('src') || '').trim();
        if (/^https?:\/\//i.test(srcUrl)) parts.push(`![${el.getAttribute('alt') || ''}](${srcUrl})`);
        break;
      }
      case 'table': {
        const rows = Array.from(el.querySelectorAll('tr'))
          .map((tr) => Array.from(tr.querySelectorAll('th,td')).map((c) => (c.textContent || '').trim()).join(' · '))
          .filter(Boolean);
        if (rows.length) parts.push(rows.join('\n'));
        break;
      }
      // Transparent wrappers: recurse as blocks when they contain block-level
      // children (this is what neutralises Google Docs' outer <b> wrapper),
      // otherwise treat as inline text.
      case 'div': case 'section': case 'article': case 'main': case 'header': case 'footer':
      case 'span': case 'b': case 'strong': case 'font': case 'a': {
        if (hasBlockChildren(el)) {
          const nested = blockToMarkdown(el).trim();
          if (nested) parts.push(nested);
        } else {
          const text = inlineToMarkdown(el).trim();
          if (text) parts.push(text);
        }
        break;
      }
      default: {
        if (hasBlockChildren(el)) {
          const nested = blockToMarkdown(el).trim();
          if (nested) parts.push(nested);
        } else {
          const text = inlineToMarkdown(el).trim();
          if (text) parts.push(text);
        }
      }
    }
  }

  return parts.join('\n\n');
}
