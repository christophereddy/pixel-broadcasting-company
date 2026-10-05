// Checks that every sport on Pixel Sports Live is built the same way (see tools/ADDING_A_SPORT.md).
//   node tools/check_sports.cjs
// Needs Node with the playwright package and a Chromium (in a Claude cloud session: NODE_PATH=$(npm root -g) node tools/check_sports.cjs).
// It serves the repo on a local port, opens /sports/ with the internet blocked, switches to each sport in SPORTS and checks:
//   - the SPORTS entry has every field, and the sport has a tab and a two-person booth in CAST
//   - the page shows the same parts in the same place for every sport (broadcast, booth, scoreboard, live feed,
//     This Game, Live Now, Up Next, team boxes, data-sources footer)
//   - the footer names the sport's data source and the live feed says where plays come from
//   - every request the sport makes goes to one of its own hosts (one data source per sport)
// Exit code 1 means a sport is missing a part, something moved, or the page threw a script error.
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const WIDTHS = [390, 1280];
const TYPES = { '.html': 'text/html', '.json': 'application/json', '.js': 'text/javascript', '.css': 'text/css' };
// Parts every sport shows, and which edges must match between sports. Lists grow with their content,
// so for those only the left edge and width have to match.
const PARTS = {
  'broadcast': ['#stage', ['x', 'y', 'width', 'height']],
  'booth': ['.booth', ['x', 'y', 'width']],
  'scoreboard': ['.board', ['x', 'y', 'width']],
  'live feed': ['.feed', ['x', 'width']],
  'This Game panel': ['#gamepanel', ['x', 'y', 'width']],
  'Live Now list': ['#list-live', ['x', 'width']],
  'Up Next list': ['#list-next', ['x', 'width']],
  'team boxes': ['#teamgrid', ['x', 'width']],
  'data sources footer': ['#foot', ['x', 'width']],
};
const ALWAYS_OK = ['fonts.googleapis.com', 'fonts.gstatic.com', '127.0.0.1'];

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

for (const width of WIDTHS) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  const errors = [], hostsSeen = [];
  page.on('pageerror', e => errors.push(e.message));
  // no live data: every outside request is recorded, then refused
  await page.route('**/*', r => {
    const u = new URL(r.request().url());
    if (u.hostname === '127.0.0.1') return r.continue();
    hostsSeen.push(u.hostname); return r.abort();
  });
  await page.goto(`${base}/sports/`, { waitUntil: 'load' });
  await page.waitForTimeout(800);
  const sports = await page.evaluate(() => Object.keys(SPORTS));
  const lines = [];
  let first = null;
  for (const sp of sports) {
    // the config entry, tab and booth
    const cfg = await page.evaluate(sp => {
      const c = SPORTS[sp], out = [];
      for (const k of ['name', 'api', 'src']) if (!c[k]) out.push(`SPORTS.${sp}.${k} is missing`);
      if (!Array.isArray(c.hosts) || !c.hosts.length) out.push(`SPORTS.${sp}.hosts is missing`);
      if (!Array.isArray(c.credits) || !c.credits.length || c.credits.some(x => !Array.isArray(x) || x.length !== 3 || x.some(v => !v))) out.push(`SPORTS.${sp}.credits needs [what, source name, link] rows`);
      const tab = document.getElementById('sport-' + sp);
      if (!tab) out.push(`no #sport-${sp} tab`); else if (tab.disabled) out.push(`#sport-${sp} tab is disabled`);
      for (const who of ['A', 'B']) if (!CAST[sp]?.[who]?.name || !CAST[sp][who].tag || !CAST[sp][who].look) out.push(`CAST.${sp}.${who} is missing`);
      return out;
    }, sp);
    cfg.forEach(l => lines.push(`  ${sp}: ${l}`));
    if (cfg.some(l => /tab/.test(l))) continue;
    // the page opens on the first sport; for the others, count only what they fetch after the switch
    if (await page.evaluate(sp => S.sport !== sp, sp)) { await page.waitForTimeout(300); hostsSeen.length = 0; await page.click('#sport-' + sp); }
    await page.waitForTimeout(1200);
    // the same parts, in the same place
    const boxes = {};
    for (const [name, [sel]] of Object.entries(PARTS)) {
      const b = await page.locator(sel).first().boundingBox().catch(() => null);
      boxes[name] = b && Object.fromEntries(Object.entries(b).map(([k, v]) => [k, Math.round(v)]));
      if (!b) lines.push(`  ${sp}: ${name} is missing or hidden`);
    }
    if (first) for (const [name, [, keys]] of Object.entries(PARTS)) {
      const a = first.boxes[name], b = boxes[name]; if (!a || !b) continue;
      const off = keys.filter(k => Math.abs(a[k] - b[k]) > 1);
      if (off.length) lines.push(`  ${sp}: ${name} sits differently from ${first.sp} (${off.map(k => `${k} ${b[k]} vs ${a[k]}`).join(', ')})`);
    }
    first ||= { sp, boxes };
    // what the page says on screen
    const shown = await page.evaluate(sp => ({
      foot: document.getElementById('foot').textContent, feedsrc: document.getElementById('feedsrc').textContent,
      names: [document.getElementById('nameA').textContent, document.getElementById('nameB').textContent],
      want: { src: SPORTS[sp].src, source: SPORTS[sp].credits?.[0]?.[1], names: [CAST[sp]?.A?.name, CAST[sp]?.B?.name], hosts: SPORTS[sp].hosts || [] },
      sideways: document.documentElement.scrollWidth > window.innerWidth
    }), sp);
    if (!shown.want.source || !shown.foot.includes(shown.want.source)) lines.push(`  ${sp}: footer doesn't name its data source`);
    if (shown.feedsrc !== shown.want.src) lines.push(`  ${sp}: live feed label is "${shown.feedsrc}", expected "${shown.want.src}"`);
    if (shown.names.join('|') !== shown.want.names.join('|')) lines.push(`  ${sp}: booth shows ${shown.names.join(' and ')}, not its own cast`);
    if (shown.sideways) lines.push(`  ${sp}: page scrolls sideways`);
    // one data source per sport
    const strays = [...new Set(hostsSeen)].filter(h => !ALWAYS_OK.includes(h) && !shown.want.hosts.includes(h));
    if (strays.length) lines.push(`  ${sp}: fetched from ${strays.join(', ')}, which isn't in SPORTS.${sp}.hosts`);
  }
  errors.forEach(e => lines.push(`  script error: ${e}`));
  console.log(`${width}px (${sports.join(', ')}): ${lines.length ? 'PROBLEMS' : 'ok'}`);
  lines.forEach(l => console.log(l));
  bad += lines.length;
  await page.close();
}
await browser.close();
server.close();
process.exit(bad ? 1 : 0);
})();
