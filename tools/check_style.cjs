// Checks that every page takes its fonts, colors and shared parts from shared/pbc.css (see tools/NEW_PAGE.md).
//   node tools/check_style.cjs
// Plain Node, no packages and no browser, so it runs anywhere in a second. GitHub runs it on every pull request.
// It reads the repo's HTML, CSS and JS and fails when:
//   - a font name or a color (#hex, rgb(), hsl(), a color word) is written anywhere in CSS except the :root block
//     of shared/pbc.css. That covers .css files, <style> blocks, style="" attributes and CSS written inside JS.
//     Use the shared names instead: var(--f-display), var(--f-label), var(--f-body), var(--gold), var(--panel)...
//   - a page gives a shared font or color a second name (like --ink:var(--text)); one name per thing, everywhere
//   - a page's CSS restyles a shared part (a .pbc-* class, the rundown, the LIVE NOW chip's insides)
//   - a page is missing the shared head (the one Google Fonts link, shared/pbc.css, shared/pbc.js) or the shared
//     masthead and control row (.pbc-page, .pbc-mast, .pbc-mark, .pbc-chan, .pbc-onair, .pbc-ctl, .pbc-btns)
//   - a rundown isn't the shared one (<div class="pbc-card"><h2>RUNDOWN</h2>... <ol class="pbc-rundown">)
// Pictures are exempt: canvas drawing (fillStyle, team colors) and SVG fill="" attributes are pixel art, not page style.
// Exit code 1 lists every problem with its file and line.
const fs = require('node:fs'), path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = 'shared/pbc.css';
// The one Google Fonts link every page loads. Press Start 2P is only for small numbers drawn on sports canvases.
const FONTS_LINK = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@500;700&family=Press+Start+2P&family=Silkscreen&family=VT323&display=swap">';
const SKELETON = ['pbc-page', 'pbc-top', 'pbc-mast', 'pbc-brand', 'pbc-mark', 'pbc-side', 'pbc-chan', 'pbc-onair', 'pbc-ctl', 'pbc-btns'];
const SKIP_DIRS = new Set(['.git', 'node_modules', 'data', 'tools', '.github']);
// Shared parts whose insides only pbc.css styles. A page may still place them (.livenow{top:...}).
const SHARED_INSIDES = /\.pbc-[\w-]+[^\s,>+~{]*$|^\.livenow\s|^\.livenow\[|#(rundown|deskrd|rdpanel)\b|\.rdhint\b/;

const COLOR_WORDS = 'white|black|red|green|blue|yellow|orange|purple|pink|gray|grey|silver|gold|navy|maroon|teal|aqua|cyan|magenta|lime|olive|brown|tan|beige|ivory|crimson|coral|salmon|khaki|indigo|violet';
const COLOR_LITERAL = new RegExp(String.raw`#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(|(?<![\w-])(?:${COLOR_WORDS})(?![\w-])`, 'i');
// Properties whose values can hold a color
const COLOR_PROPS = /^(color|background(-color|-image)?|border(-(top|right|bottom|left|block|inline))?(-color)?|outline(-color)?|box-shadow|text-shadow|text-decoration(-color)?|caret-color|accent-color|fill|stroke|column-rule(-color)?|scrollbar-color|filter|drop-shadow)$/i;
const FONT_OK = /^(var\(--f-(display|label|body)\)|inherit|unset|initial)$/;

const problems = [];
const say = (file, line, msg) => problems.push(`${file}:${line}  ${msg}`);
const lineAt = (text, i) => text.slice(0, i).split('\n').length;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') && e.name !== '.') { if (SKIP_DIRS.has(e.name)) continue; }
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (/\.(html|css|js)$/.test(e.name)) out.push(p);
  }
  return out;
}

// One CSS declaration list (or a whole stylesheet). base = where it starts in the file, for line numbers.
function checkCss(file, text, css, base, { isSource = false, selectors = true } = {}) {
  // the :root block of the source file is where fonts and colors live
  let skip = [0, 0];
  if (isSource) { const s = css.indexOf(':root{'); skip = [s, css.indexOf('\n}', s) + 2]; }
  const decl = /([\w-]+)\s*:\s*([^;{}]*)/g;
  // walk rule by rule so selectors can be checked too
  const rule = /([^{}]*)\{([^{}]*)\}/g;
  const blocks = selectors && /\{/.test(css) ? [...css.matchAll(rule)].map(m => ({ sel: m[1], body: m[2], at: m.index + m[0].indexOf('{') + 1 })) : [{ sel: '', body: css, at: 0 }];
  for (const b of blocks) {
    if (b.at >= skip[0] && b.at < skip[1]) continue;
    const sel = b.sel.replace(/\/\*[\s\S]*?\*\//g, '').trim();
    const ln = lineAt(text, base + b.at);
    if (sel && !isSource && !file.startsWith('shared/')) {
      for (const one of sel.split(',').map(s => s.trim()).filter(Boolean)) {
        if (/^@/.test(one)) continue;
        if (SHARED_INSIDES.test(one)) say(file, ln, `restyles a shared part: "${one}". Change it in ${SOURCE} so every page follows.`);
      }
    }
    const body = b.body.replace(/\/\*[\s\S]*?\*\//g, m => ' '.repeat(m.length));
    for (const m of body.matchAll(decl)) {
      const prop = m[1].toLowerCase(), val = m[2].trim();
      const where = lineAt(text, base + b.at + m.index);
      if (prop.startsWith('--')) {
        if (/^var\(--[\w-]+\)$/.test(val)) say(file, where, `${prop} is a second name for ${val}. Use ${val} itself.`);
        else if (COLOR_LITERAL.test(val) || /["']/.test(val)) say(file, where, `${prop} defines its own color or font. Add it to the :root block in ${SOURCE} instead.`);
        continue;
      }
      if (prop === "font-family" && !FONT_OK.test(val.replace(/\s*!important$/, ""))) say(file, where, `font-family: ${val}. Use var(--f-display), var(--f-label) or var(--f-body).`);
      if (prop === 'font' && !/^(inherit|unset|initial)$/.test(val) && !/var\(--f-(display|label|body)\)/.test(val)) say(file, where, `font: ${val}. Name the font with var(--f-display), var(--f-label) or var(--f-body).`);
      if (COLOR_PROPS.test(prop) && COLOR_LITERAL.test(val.replace(/var\([^)]*\)/g, ''))) say(file, where, `${prop}: ${val}. Use a color from ${SOURCE} (var(--gold), var(--panel)...), or add one there.`);
    }
  }
}

function checkHtml(file, text) {
  for (const m of text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) checkCss(file, text, m[1], m.index + m[0].indexOf('>') + 1);
  for (const m of text.matchAll(/\sstyle="([^"]*)"/g)) checkCss(file, text, m[1], m.index, { selectors: false });
  if (/http-equiv="refresh"/i.test(text)) return; // a redirect, never seen
  const head = text.slice(0, text.indexOf('</head>'));
  const links = head.match(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/g) || [];
  if (links.length !== 1 || links[0] !== FONTS_LINK) say(file, 1, `needs exactly the shared fonts link:\n    ${FONTS_LINK}`);
  if (!/<link rel="stylesheet" href="(\.\.\/)*shared\/pbc\.css">/.test(head)) say(file, 1, `doesn't load shared/pbc.css`);
  if (!/<script src="(\.\.\/)*shared\/pbc\.js"/.test(text)) say(file, 1, `doesn't load shared/pbc.js`);
  for (const c of SKELETON) if (!new RegExp(`class="(?:[^"]*\\s)?${c}(?:\\s[^"]*)?"`).test(text)) say(file, 1, `is missing the shared .${c} (copy the masthead and control row from tools/NEW_PAGE.md)`);
  for (const m of text.matchAll(/<h2>RUNDOWN<\/h2>/g)) {
    const before = text.slice(0, m.index), open = before.lastIndexOf('<');
    const parent = before.slice(before.lastIndexOf('<', open - 1 >= 0 ? open : 0)).match(/<\w+[^>]*>\s*$/);
    const after = text.slice(m.index, m.index + 600);
    if (!parent || !/class="(?:[^"]*\s)?pbc-card[\s"]/.test(parent[0])) say(file, lineAt(text, m.index), 'RUNDOWN must sit in a <div class="pbc-card">');
    if (!/<ol[^>]*class="(?:[^"]*\s)?pbc-rundown[\s"]/.test(after)) say(file, lineAt(text, m.index), 'the rundown list must be <ol class="pbc-rundown">');
  }
}

// CSS written inside JS strings ("color:#fff;..."), and inline styles set from JS (el.style.color = "#fff")
function checkJs(file, text) {
  const code = text.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:\\])\/\/[^\n]*/g, (m, a) => a + ' '.repeat(m.length - a.length));
  for (const m of code.matchAll(/(["'`])((?:\\.|(?!\1)[^\\\n])*)\1/g)) {
    const s = m[2];
    if (!/[\w-]+\s*:[^:]/.test(s) || !/;|\{/.test(s)) continue; // not CSS
    if (!/(^|[;{\s"])(color|background|border|font|outline|box-shadow|text-shadow|fill|stroke)[\w-]*\s*:/.test(s)) continue;
    checkCss(file, text, s, m.index + 1, { selectors: /\{/.test(s) });
  }
  for (const m of code.matchAll(/\.style\.(color|background(?:Color)?|border(?:Top|Right|Bottom|Left)?(?:Color)?|outline(?:Color)?|boxShadow|textShadow|fontFamily)\s*=\s*(["'`])([^"'`]*)\2/g)) {
    const prop = m[1].replace(/[A-Z]/g, c => '-' + c.toLowerCase());
    if (prop === 'font-family' ? !FONT_OK.test(m[3]) : COLOR_LITERAL.test(m[3].replace(/var\([^)]*\)/g, ''))) say(file, lineAt(text, m.index), `.style.${m[1]} = "${m[3]}". Use a shared name, e.g. "var(--white)".`);
  }
  for (const m of code.matchAll(/setProperty\(\s*["'](--[\w-]+)["']/g)) say(file, lineAt(text, m.index), `sets ${m[1]} from JS. Fonts and colors are defined only in ${SOURCE}.`);
}

for (const abs of walk(ROOT)) {
  const file = path.relative(ROOT, abs).split(path.sep).join('/');
  const text = fs.readFileSync(abs, 'utf8');
  if (file.endsWith('.css')) checkCss(file, text, text, 0, { isSource: file === SOURCE });
  else if (file.endsWith('.html')) checkHtml(file, text);
  else checkJs(file, text);
}

if (problems.length) {
  console.log(`Style check: ${problems.length} problem${problems.length > 1 ? 's' : ''}. Fonts, colors and shared parts come from ${SOURCE} (see tools/NEW_PAGE.md).\n`);
  problems.forEach(p => console.log('  ' + p));
  process.exit(1);
}
console.log('Style check: ok. Every page takes its fonts, colors and shared parts from ' + SOURCE + '.');
