// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseRichMarkdown,
  parseInline,
  sanitizeUrl,
  parseVideoUrl,
  toRichBlocks,
  extractToc,
  stripInline,
  type RichBlock,
} from '../rich-content.ts';
import { normalizePastedText, normalizePastedHtml } from '../paste-normalize.ts';

function types(blocks: RichBlock[]): string[] {
  return blocks.map((b) => b.type);
}

// ---------- URL safety ----------
test('sanitizeUrl rejects unsafe schemes', () => {
  assert.equal(sanitizeUrl('javascript:alert(1)'), null);
  assert.equal(sanitizeUrl('data:text/html,x'), null);
  assert.equal(sanitizeUrl('vbscript:x'), null);
  assert.equal(sanitizeUrl('  '), null);
});

test('sanitizeUrl keeps safe links', () => {
  assert.equal(sanitizeUrl('https://chat.openai.com'), 'https://chat.openai.com');
  assert.equal(sanitizeUrl('/learn/guides/x'), '/learn/guides/x');
  assert.equal(sanitizeUrl('#section'), '#section');
  assert.equal(sanitizeUrl('mailto:a@b.com'), 'mailto:a@b.com');
  assert.equal(sanitizeUrl('example.com/path'), 'https://example.com/path');
});

// ---------- video providers ----------
test('parseVideoUrl whitelists youtube + vimeo only', () => {
  assert.deepEqual(parseVideoUrl('https://youtu.be/dQw4w9WgXcQ'), { provider: 'youtube', id: 'dQw4w9WgXcQ' });
  assert.deepEqual(parseVideoUrl('https://vimeo.com/76979871'), { provider: 'vimeo', id: '76979871' });
  assert.equal(parseVideoUrl('https://evil.example/embed/x'), null);
});

// ---------- inline ----------
test('parseInline handles bold, italic, code, links', () => {
  const nodes = parseInline('a **b** _c_ `d` [e](https://x.com)');
  const kinds = nodes.map((n) => n.t);
  assert.ok(kinds.includes('bold'));
  assert.ok(kinds.includes('italic'));
  assert.ok(kinds.includes('code'));
  assert.ok(kinds.includes('link'));
});

test('parseInline drops javascript: links but keeps the label text', () => {
  const nodes = parseInline('[click](javascript:alert(1))');
  assert.ok(nodes.every((n) => n.t !== 'link'));
  assert.ok(stripInline(nodes).includes('click'));
});

// ---------- block parsing ----------
test('headings: # and ## both become H2 (no H1 in body)', () => {
  const blocks = parseRichMarkdown('# One\n## Two\n### Three\n#### Four');
  const hs = blocks.filter((b): b is Extract<RichBlock, { type: 'heading' }> => b.type === 'heading');
  assert.deepEqual(hs.map((h) => h.level), [2, 2, 3, 4]);
});

test('ordered, unordered and checklist lists', () => {
  const blocks = parseRichMarkdown('1. a\n2. b\n\n- x\n- y\n\n- [ ] todo\n- [x] done');
  assert.deepEqual(types(blocks), ['list', 'list', 'checklist']);
  const ol = blocks[0] as Extract<RichBlock, { type: 'list' }>;
  assert.equal(ol.ordered, true);
  const cl = blocks[2] as Extract<RichBlock, { type: 'checklist' }>;
  assert.equal(cl.items[0].checked, false);
  assert.equal(cl.items[1].checked, true);
});

test('prompt fenced block and directive', () => {
  const a = parseRichMarkdown('```prompt\nhello\nworld\n```');
  assert.equal(a[0].type, 'prompt');
  assert.equal((a[0] as Extract<RichBlock, { type: 'prompt' }>).code, 'hello\nworld');
  const b = parseRichMarkdown(':::prompt דוגמה\nשורה\n:::');
  assert.equal(b[0].type, 'prompt');
  assert.equal((b[0] as Extract<RichBlock, { type: 'prompt' }>).label, 'דוגמה');
});

test('callout directives (hebrew + english aliases)', () => {
  const blocks = parseRichMarkdown(':::tip\nא\n:::\n\n:::שימו לב\nב\n:::\n\n:::mistake\nג\n:::');
  const variants = blocks
    .filter((b): b is Extract<RichBlock, { type: 'callout' }> => b.type === 'callout')
    .map((b) => b.variant);
  assert.deepEqual(variants, ['tip', 'attention', 'mistake']);
});

test('cta directive parses label + safe href', () => {
  const ok = parseRichMarkdown(':::cta [פתחו את ChatGPT](https://chat.openai.com)');
  assert.equal(ok[0].type, 'cta');
  const bad = parseRichMarkdown(':::cta [x](javascript:alert(1))');
  assert.notEqual(bad[0]?.type, 'cta');
});

test('divider, quote, standalone image and video', () => {
  const blocks = parseRichMarkdown('---\n\n> quote\n\n![alt](https://x.com/a.png)\n\nhttps://youtu.be/dQw4w9WgXcQ');
  assert.deepEqual(types(blocks), ['divider', 'quote', 'image', 'video']);
});

test('legacy plain text becomes safe paragraphs, no invented structure', () => {
  const blocks = parseRichMarkdown('שורה ראשונה\nשורה שנייה\n\nפסקה שנייה');
  assert.deepEqual(types(blocks), ['paragraph', 'paragraph']);
});

// ---------- GuideBlock[] unification ----------
test('toRichBlocks expands legacy GuideBlock[]', () => {
  const blocks = toRichBlocks([
    { type: 'markdown', content: '## כותרת\n\nטקסט' },
    { type: 'callout', tone: 'warning', content: 'זהירות' },
    { type: 'image', url: 'https://x.com/a.png', alt: 'a' },
    { type: 'video', youtubeId: 'dQw4w9WgXcQ' },
  ]);
  assert.deepEqual(types(blocks), ['heading', 'paragraph', 'callout', 'image', 'video']);
  assert.equal((blocks[2] as Extract<RichBlock, { type: 'callout' }>).variant, 'warning');
});

test('toRichBlocks(string) parses markdown', () => {
  assert.deepEqual(types(toRichBlocks('## a\n\nb')), ['heading', 'paragraph']);
  assert.deepEqual(toRichBlocks(null), []);
});

// ---------- TOC ----------
test('extractToc returns only H2 entries', () => {
  const blocks = parseRichMarkdown('## A\n### sub\n## B\n## C');
  const toc = extractToc(blocks);
  assert.equal(toc.length, 3);
  assert.deepEqual(toc.map((t) => t.text), ['A', 'B', 'C']);
  assert.ok(toc.every((t) => t.id.startsWith('sec-')));
});

test('stripInline flattens to text', () => {
  assert.equal(stripInline(parseInline('**a** `b` [c](https://x.com)')), 'a b c');
});

// ---------- paste normalization (text) ----------
test('normalizePastedText promotes hebrew step labels to H2', () => {
  const md = normalizePastedText('שלב 1: פתחו את ChatGPT\nתוכן\n\nשלב 2: בחרו משימה');
  assert.ok(md.includes('## שלב 1: פתחו את ChatGPT'));
  assert.ok(md.includes('## שלב 2: בחרו משימה'));
});

test('normalizePastedText converts callout labels to directives', () => {
  const md = normalizePastedText('טיפ חשוב: התחילו פשוט');
  assert.ok(md.includes(':::tip'));
  assert.ok(md.includes('התחילו פשוט'));
});

test('normalizePastedText leaves existing markdown alone', () => {
  const md = normalizePastedText('## כבר כותרת\n- פריט');
  assert.ok(md.includes('## כבר כותרת'));
  assert.ok(md.includes('- פריט'));
});

test('normalizePastedHtml returns empty without DOM (server fallback)', () => {
  assert.equal(normalizePastedHtml('<h1>x</h1>'), '');
});
