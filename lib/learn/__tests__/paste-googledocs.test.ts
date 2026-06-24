// Run with: npm test
// Exercises the REAL Google-Docs HTML → markdown converter using a linkedom
// DOM, against a fixture shaped like an actual Google Docs clipboard payload.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from 'linkedom';

before(() => {
  // normalizePastedHtml guards on `window`/`DOMParser`; provide both.
  (globalThis as unknown as { window: unknown }).window = {};
  (globalThis as unknown as { DOMParser: unknown }).DOMParser = DOMParser;
});

// Google Docs wraps the whole selection in <b style="font-weight:normal">,
// renders heading paragraphs as <p> with large/bold spans (not <h2>), carries
// bold on span font-weight, and routes links through google.com/url?q=…
const GOOGLE_DOCS_HTML = `<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-abc">
  <p dir="rtl" style="line-height:1.38;"><span style="font-size:20pt;font-weight:700;">איך להתחיל לעבוד עם Scheduled Tasks</span></p>
  <p dir="rtl" style="line-height:1.38;"><span style="font-size:11pt;">Scheduled Tasks מאפשר לכם להגדיר ל-ChatGPT משימות חוזרות.</span></p>
  <p dir="rtl"><span style="font-size:14pt;font-weight:700;">שלב 1: פתחו את ChatGPT</span></p>
  <p dir="rtl"><span style="font-size:11pt;"><a href="https://www.google.com/url?q=https://chatgpt.com&amp;sa=D">לחצו כאן כדי לפתוח את ChatGPT</a></span></p>
  <p dir="rtl"><span style="font-size:11pt;">חפשו בתפריט הצד את אזור </span><span style="font-size:11pt;font-weight:700;">Scheduled</span><span style="font-size:11pt;"> או כתבו את המשימה.</span></p>
  <p dir="rtl"><span style="font-size:14pt;font-weight:700;">שלב 2: בחרו משימה</span></p>
  <ul style="margin:0;padding:0;">
    <li dir="rtl"><span style="font-size:11pt;">עדכון יומי על חדשות AI</span></li>
    <li dir="rtl"><span style="font-size:11pt;">תזכורת שבועית לעסק</span></li>
    <li dir="rtl"><span style="font-size:11pt;">מעקב אחרי טיסות</span></li>
  </ul>
  <p dir="rtl"><span style="font-size:11pt;">פסקת סיום אחרי הרשימה.</span></p>
</b>`;

test('Google Docs paste preserves headings, paragraphs, lists, links, bold', async () => {
  const { normalizePastedHtml } = await import('../paste-normalize.ts');
  const md = normalizePastedHtml(GOOGLE_DOCS_HTML);

  // title + step labels became headings
  assert.match(md, /^## איך להתחיל לעבוד עם Scheduled Tasks/m, 'title heading');
  assert.match(md, /^## שלב 1: פתחו את ChatGPT/m, 'step 1 heading');
  assert.match(md, /^## שלב 2: בחרו משימה/m, 'step 2 heading');

  // intro paragraph is its OWN block, not merged into the title
  assert.match(md, /^Scheduled Tasks מאפשר/m, 'intro paragraph separate');
  assert.doesNotMatch(md, /ChatGPTScheduled/, 'title and intro not glued together');

  // link preserved and google redirect unwrapped
  assert.match(md, /\[לחצו כאן כדי לפתוח את ChatGPT\]\(https:\/\/chatgpt\.com\)/, 'clean link');

  // inline bold preserved (not the whole-doc wrapper)
  assert.match(md, /\*\*Scheduled\*\*/, 'inline bold word');
  assert.doesNotMatch(md, /^\*\*איך להתחיל/, 'no whole-doc bold wrapper');

  // bullet list, three items, each on its own line
  assert.match(md, /^- עדכון יומי על חדשות AI$/m);
  assert.match(md, /^- תזכורת שבועית לעסק$/m);
  assert.match(md, /^- מעקב אחרי טיסות$/m);

  // closing paragraph kept separate from the list
  assert.match(md, /^פסקת סיום אחרי הרשימה\.$/m);

  // blank lines preserved between blocks (no giant single block)
  assert.ok(md.split('\n\n').length >= 6, 'multiple separated blocks');
});

test('Google Docs markdown renders to correct structured blocks', async () => {
  const { normalizePastedHtml } = await import('../paste-normalize.ts');
  const { toRichBlocks } = await import('../rich-content.ts');
  const blocks = toRichBlocks(normalizePastedHtml(GOOGLE_DOCS_HTML));
  const types = blocks.map((b) => b.type);

  const headings = blocks.filter((b) => b.type === 'heading');
  assert.equal(headings.length, 3, 'three headings');
  assert.ok(types.includes('list'), 'a bullet list block');
  assert.ok(types.filter((t) => t === 'paragraph').length >= 3, 'multiple paragraphs');
  // no single merged mega-paragraph
  assert.ok(blocks.length >= 7, `expected 7+ blocks, got ${blocks.length}`);
});
