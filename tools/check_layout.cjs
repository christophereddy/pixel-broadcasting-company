// Checks that News, Sports and Cooking keep the shared controls in the same place, at phone, laptop and wide widths.
//   node tools/check_layout.cjs
// Needs Node with the playwright package and a Chromium (in a Claude cloud session: NODE_PATH=$(npm root -g) node tools/check_layout.cjs).
// It serves the repo on a local port, opens /, /sports/ and /cooking/, and compares where each shared element sits on
// Sports and Cooking with where it sits on News.
// Exit code 1 means something moved, a page scrolls sideways, or News or Cooking threw a script error.
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const WIDTHS = [390, 1280, 1700];
const TYPES = { '.html': 'text/html', '.json': 'application/json', '.js': 'text/javascript', '.css': 'text/css', '.mjs': 'text/javascript' };
// The channels, News first: the others are measured against it.
const PAGES = [['News', '/'], ['Sports', '/sports/'], ['Cooking', '/cooking/']];
// The same element on each page (News, Sports, Cooking selector).
const SHARED = {
  'PBC mark': ['.pbc-mark', '.pbc-mark', '.pbc-mark'],
  'channel switch': ['.pbc-chan', '.pbc-chan', '.pbc-chan'],
  'ON AIR': ['.pbc-onair', '.pbc-onair', '.pbc-onair'],
  'FULL SCREEN': ['#fs', '#fs', '#fs'],
  'SOUND': ['#snd', '#snd', '#snd'],
  'broadcast': ['.pbc-screen', '.pbc-screen', '.pbc-screen'],
  'right column': ['.side', '.side', '.side'],
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
(async () => {
await new Promise(r => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
let bad = 0;
async function measure(url, width, which) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route(/espn|espncdn/, r => r.abort());  // Sports' live data isn't needed for layout
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(800);
  const boxes = {};
  for (const [name, sels] of Object.entries(SHARED)) {
    const b = await page.locator(sels[which]).first().boundingBox().catch(() => null);
    boxes[name] = b && Object.fromEntries(Object.entries(b).map(([k, v]) => [k, Math.round(v)]));
  }
  const sideways = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  await page.close();
  return { boxes, errors, sideways };
}

for (const w of WIDTHS) {
  const got = [];
  for (const [i, [, url]] of PAGES.entries()) got.push(await measure(`${base}${url}`, w, i));
  const lines = [], news = got[0];
  for (const [i, [name]] of PAGES.entries()) {
    const m = got[i];
    if (i) for (const part of Object.keys(SHARED)) {
      const a = news.boxes[part], b = m.boxes[part];
      if (!a || !b) { lines.push(`  ${part}: missing on ${!a ? 'News' : name}`); continue; }
      // Heights of the broadcast area and right column follow their content. On a phone the column
      // sits below everything else, so only its left edge and width have to match there.
      const keys = part === 'broadcast' ? ['x', 'y', 'width'] : part === 'right column' ? (w > 900 ? ['x', 'y', 'width'] : ['x', 'width']) : ['x', 'y', 'width', 'height'];
      const off = keys.filter(k => Math.abs(a[k] - b[k]) > 1);
      if (off.length) lines.push(`  ${part}: News ${JSON.stringify(a)} vs ${name} ${JSON.stringify(b)}`);
    }
    if (m.sideways) lines.push(`  ${name} scrolls sideways`);
    if (name !== 'Sports') m.errors.forEach(e => lines.push(`  ${name} script error: ${e}`));
  }
  console.log(`${w}px: ${lines.length ? 'PROBLEMS' : 'ok'}`);
  lines.forEach(l => console.log(l));
  bad += lines.length;
}
await browser.close();
server.close();
process.exit(bad ? 1 : 0);
})();
