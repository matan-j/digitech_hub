import { chromium } from 'playwright';

const HUB = 'https://hub.digi-tech.co.il';
const EMAIL = 'matan@digi-tech.co.il';
const PASSWORD = 'DigiHub-aa04e5b3-2026!';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

const navLog = [];
page.on('request', (req) => {
  if (req.url().includes('hub.digi-tech.co.il') && req.resourceType() === 'document') {
    const cookies = req.headers().cookie ?? '';
    const sb = cookies.split('; ').filter((c) => c.startsWith('sb-')).map((c) => c.split('=')[0]);
    navLog.push({ url: req.url(), method: req.method(), sbCookies: sb });
  }
});
page.on('response', (resp) => {
  if (resp.url().includes('hub.digi-tech.co.il') && resp.request().resourceType() === 'document') {
    console.log(`  [resp] ${resp.status()} ${resp.url()}`);
  }
});

console.log('=== Open /admin/login ===');
await page.goto(`${HUB}/admin/login`, { waitUntil: 'networkidle' });

console.log('\n=== Submit form ===');
await page.fill('input[type=email]', EMAIL);
await page.fill('input[type=password]', PASSWORD);
await page.click('button[type=submit]');

// Wait long enough for everything to settle
await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
await page.waitForTimeout(3000);

console.log('\n--- Final URL:', page.url());

console.log('\n--- Doc requests (post-login) ---');
for (const r of navLog) {
  console.log(`  ${r.method} ${r.url}  →  sb cookies sent: [${r.sbCookies.join(', ') || 'none'}]`);
}

console.log('\n--- ctx.cookies() ---');
const cookies = await ctx.cookies();
for (const c of cookies.filter((c) => c.name.startsWith('sb-'))) {
  console.log(`  ${c.name} | domain=${c.domain} | path=${c.path} | sameSite=${c.sameSite}`);
}

console.log('\n=== Probe admin routes, log cookie + Set-Cookie at each step ===');
const probes = ['/admin', '/admin/courses', '/admin/users', '/admin'];
for (const p of probes) {
  const setCookies = [];
  const listener = async (resp) => {
    if (!resp.url().includes('hub.digi-tech.co.il')) return;
    try {
      const arr = await resp.headersArray();
      for (const h of arr) {
        if (h.name.toLowerCase() === 'set-cookie') {
          setCookies.push(`${resp.status()} ${resp.url().split('/').slice(-2).join('/')} : ${h.value.slice(0, 120)}...`);
        }
      }
    } catch {}
  };
  page.on('response', listener);

  console.log(`\n→ probing ${p}`);
  const before = await ctx.cookies();
  const allBefore = before.map((c) => `${c.name}(${c.value.length}ch)`);
  console.log(`  before cookies (all): [${allBefore.join(', ')}]`);

  const r = await page.goto(`${HUB}${p}`, { waitUntil: 'load' });
  await page.waitForTimeout(800);

  const after = await ctx.cookies();
  const allAfter = after.map((c) => `${c.name}(${c.value.length}ch)`);
  console.log(`  after cookies (all):  [${allAfter.join(', ')}]`);

  if (setCookies.length > 0) {
    console.log(`  Set-Cookie headers seen:`);
    for (const sc of setCookies) console.log(`    ${sc}`);
  }

  const finalUrl = page.url();
  const flag = finalUrl.endsWith(p) ? '✅ OK' : '❌ BOUNCED';
  console.log(`  ${flag}  status=${r?.status()}  final=${finalUrl}`);

  page.off('response', listener);
}

await browser.close();
