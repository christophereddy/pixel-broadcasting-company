/* Pixel Broadcasting Company: the ads both channels run (sports breaks, news commercial break).
   One list for both pages, so a sold ad shows everywhere it was bought for.
   - DEFAULT_ADS: twelve invented brands, the fill when nothing is sold. No real company appears.
   - Sold ads: ads/sold.json (rules in ads/README.md), a fixed file Chris edits; never written by the news refresh or Claude.
   - HOUSE_AD: PBC's own ad with a QR code to the Advertise page. It is never replaced by a sold ad.
   - qrMatrix(): a small QR code encoder, so codes are drawn in the pages' own pixels with no outside library. */
(function(){
"use strict";
const ADVERTISE_URL = 'https://christophereddy.github.io/pixel-broadcasting-company/advertise/';
const HOUSE_AD = {house: true, name: 'ADVERTISE ON PBC', line: 'SCAN TO PUT YOUR BRAND HERE', bg: '#0c0e1c', fg: '#f2b632', url: ADVERTISE_URL};
const DEFAULT_ADS = [
  {name: 'PIXL COLA', line: 'CRISP IN EVERY BIT', bg: '#a8321f', fg: '#f7d038'},
  {name: 'BYTE BURGER', line: 'STACKED EIGHT BITS HIGH', bg: '#f2b632', fg: '#2a1a0c'},
  {name: 'NOVA MOTORS', line: 'DRIVE THE NEXT LEVEL', bg: '#1f5fa8', fg: '#e7e1cc'},
  {name: 'HEXA BANK', line: 'BANKING WITHOUT THE LAG', bg: '#14532d', fg: '#f2f0e8'},
  {name: 'ATLAS WIRELESS', line: 'FULL BARS COAST TO COAST', bg: '#5b2a86', fg: '#f2f0e8'},
  {name: 'GRID COFFEE', line: 'FRESH ROAST EVERY ROUND', bg: '#4a3526', fg: '#f7d9a8'},
  {name: 'VOLT ENERGY', line: 'POWER UP FOR OVERTIME', bg: '#1d2238', fg: '#9be15d'},
  {name: 'MESA INSURANCE', line: 'COVERED FROM KICKOFF ON', bg: '#7a2533', fg: '#e7e1cc'},
  {name: 'SOLARIS POWER', line: 'CLEAN ENERGY ALL GAME LONG', bg: '#e8772e', fg: '#2a1a0c'},
  {name: 'TOPO OUTFITTERS', line: 'GEAR FOR EVERY TRAIL', bg: '#1d6b5a', fg: '#f2e6d8'},
  {name: 'QUARRY HARDWARE', line: 'BUILT ONE BLOCK AT A TIME', bg: '#3a3f4f', fg: '#f7d038'},
  {name: 'RETRO RENTALS', line: 'PRESS START ON YOUR TRIP', bg: '#0e2240', fg: '#8fd3ff'}
];

// Only the characters the sign fonts can draw are accepted, and an entry that doesn't fit the rules is left out rather
// than shown wrong. Resolves to the sold list, or null when there is none (the default fill stays).
async function loadSold(base){
  if (location.protocol === 'file:') return null; // opened from disk: browsers block the read
  try {
    const r = await fetch(base + 'ads/sold.json', {cache: 'no-cache'}); if (!r.ok) return null;
    const j = await r.json(), hex = /^#[0-9a-f]{6}$/i;
    const list = (Array.isArray(j.ads) ? j.ads : []).filter(a => a && /^[A-Z0-9 &.-]{1,16}$/.test(a.name || '')
      && (a.line == null || /^[A-Z0-9 ]{0,26}$/.test(a.line)) && hex.test(a.bg || '') && hex.test(a.fg || '')
      // a website is optional; when given it must be a plain https address short enough for the QR code
      && (a.website == null || /^https:\/\/[A-Za-z0-9.-]+\.[A-Za-z]{2,}(\/[A-Za-z0-9\-._~\/?#=&%+]*)?$/.test(a.website) && a.website.length <= 100))
      .slice(0, 24).map(a => ({name: a.name, line: a.line || '', bg: a.bg, fg: a.fg, url: a.website || null}));
    return list.length ? list : null;
  } catch (e) { return null; }
}

// QR code: byte mode, error correction level M, versions 1-6 (up to 106 bytes). Follows ISO/IEC 18004 step by step.
// Returns a square array of rows, true for a dark module, or null if the text is too long.
function qrMatrix(text){
  const bytes = [...new TextEncoder().encode(text)];
  // level M, versions 1-9 (up to 180 bytes, enough for a long article address): [error words per block, data words per block]
  const T = {1: [10, [16]], 2: [16, [28]], 3: [26, [44]], 4: [18, [32, 32]], 5: [24, [43, 43]], 6: [16, [27, 27, 27, 27]],
    7: [18, [31, 31, 31, 31]], 8: [22, [38, 38, 39, 39]], 9: [22, [36, 36, 36, 37, 37]]};
  let v = 1; while (v <= 9 && 4 + 8 + bytes.length * 8 > T[v][1].reduce((a, b) => a + b) * 8) v++;
  if (v > 9) return null;
  const [ecLen, blocks] = T[v], cap = blocks.reduce((a, b) => a + b) * 8, size = 17 + 4 * v;
  // data bits: mode, length, bytes, terminator, then pad bytes
  const bits = []; const put = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push(val >>> i & 1); };
  put(4, 4); put(bytes.length, 8); bytes.forEach(b => put(b, 8)); put(0, Math.min(4, cap - bits.length));
  while (bits.length % 8) bits.push(0);
  for (let p = 0xEC; bits.length < cap; p ^= 0xEC ^ 0x11) put(p, 8);
  const data = []; for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => a << 1 | b, 0));
  // Reed-Solomon error correction over GF(256)
  const mul = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = z << 1 ^ (z >>> 7) * 0x11D; z ^= (y >>> i & 1) * x; } return z; };
  const div = [...Array(ecLen - 1).fill(0), 1]; let root = 1;
  for (let i = 0; i < ecLen; i++) { for (let j = 0; j < ecLen; j++) { div[j] = mul(div[j], root); if (j + 1 < ecLen) div[j] ^= div[j + 1]; } root = mul(root, 2); }
  const ecc = d => { const r = div.map(() => 0); d.forEach(b => { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => r[i] ^= mul(c, f)); }); return r; };
  const dBlocks = []; let k = 0; blocks.forEach(n => { dBlocks.push(data.slice(k, k + n)); k += n; });
  const eBlocks = dBlocks.map(ecc), words = [];
  for (let i = 0; i < Math.max(...blocks); i++) dBlocks.forEach(b => { if (i < b.length) words.push(b[i]); });
  for (let i = 0; i < ecLen; i++) eBlocks.forEach(b => words.push(b[i]));
  // the fixed patterns
  const M = [...Array(size)].map(() => Array(size).fill(false)), F = [...Array(size)].map(() => Array(size).fill(false));
  const set = (x, y, d) => { if (x >= 0 && y >= 0 && x < size && y < size) { M[y][x] = d; F[y][x] = true; } };
  const finder = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)); set(cx + dx, cy + dy, d !== 2 && d !== 4); } };
  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  const al = v < 2 ? [] : v < 7 ? [6, size - 7] : [6, (6 + size - 7) / 2, size - 7];   // alignment pattern centres
  al.forEach(cy => al.forEach(cx => {
    if ((cx === 6 && cy === 6) || (cx === 6 && cy === size - 7) || (cx === size - 7 && cy === 6)) return;   // under a finder
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }));
  if (v >= 7) {   // version information, next to the two upper finders
    let r = v; for (let i = 0; i < 12; i++) r = r << 1 ^ (r >>> 11) * 0x1F25;
    const vb = v << 12 | r;
    for (let i = 0; i < 18; i++) { const d = (vb >>> i & 1) === 1, a = size - 11 + i % 3, b = Math.floor(i / 3); set(a, b, d); set(b, a, d); }
  }
  const format = mask => {
    const d = mask; let r = d; for (let i = 0; i < 10; i++) r = r << 1 ^ (r >>> 9) * 0x537;   // level M is 00
    const b = (d << 10 | r) ^ 0x5412, bit = i => (b >>> i & 1) === 1;
    for (let i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
    set(8, size - 8, true);
  };
  format(0);
  // the codewords, in the standard zigzag
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j, y = (right + 1 & 2) === 0 ? size - 1 - vert : vert;
      if (!F[y][x] && i < words.length * 8) { M[y][x] = (words[i >>> 3] >>> 7 - (i & 7) & 1) === 1; i++; }
    }
  }
  // try all eight masks and keep the one a scanner reads most easily
  const masks = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, x => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => x * y % 2 + x * y % 3 === 0,
    (x, y) => (x * y % 2 + x * y % 3) % 2 === 0, (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0];
  const apply = m => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!F[y][x] && masks[m](x, y)) M[y][x] = !M[y][x]; };
  const penalty = () => {
    let p = 0, dark = 0;
    const lines = []; for (let a = 0; a < size; a++) { lines.push(M[a].map(Number).join('')); lines.push(M.map(r => +r[a]).join('')); }
    lines.forEach(l => { (l.match(/0{5,}|1{5,}/g) || []).forEach(r => p += r.length - 2); p += 40 * ((l.match(/(?=10111010000|00001011101)/g) || []).length); });
    for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) { const c = M[y][x]; if (c === M[y][x + 1] && c === M[y + 1][x] && c === M[y + 1][x + 1]) p += 3; }
    M.forEach(r => r.forEach(c => dark += c)); p += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
    return p;
  };
  let best = 0, bestP = Infinity;
  for (let m = 0; m < 8; m++) { apply(m); format(m); const p = penalty(); if (p < bestP) { bestP = p; best = m; } apply(m); }
  apply(best); format(best);
  return M;
}

// Sign lettering is drawn pixel by pixel from these small fonts rather than with canvas text: canvas text at sign size
// comes out blurred, and these stay sharp at every zoom. FONT5: 5x7 capitals for brand names; FONT3: 3x5 for small tags.
// This is PBC's only pixel lettering: News, Sports, the Sports Desk and the Marketing Division all draw with pixText().
const FONT5 = {A:'01110100011000111111100011000110001', B:'11110100011000111110100011000111110', C:'01110100011000010000100001000101110',
  D:'11110100011000110001100011000111110', E:'11111100001000011110100001000011111', F:'11111100001000011110100001000010000',
  G:'01110100011000010111100011000101111', H:'10001100011000111111100011000110001', I:'01110001000010000100001000010001110',
  J:'00111000100001000010000101001001100', K:'10001100101010011000101001001010001', L:'10000100001000010000100001000011111',
  M:'10001110111010110101100011000110001', N:'10001100011100110101100111000110001', O:'01110100011000110001100011000101110',
  P:'11110100011000111110100001000010000', Q:'01110100011000110001101011001001101', R:'11110100011000111110101001001010001',
  S:'01111100001000001110000010000111110', T:'11111001000010000100001000010000100', U:'10001100011000110001100011000101110',
  V:'10001100011000110001100010101000100', W:'10001100011000110101101011010101010', X:'10001100010101000100010101000110001',
  Y:'10001100010101000100001000010000100', Z:'11111000010001000100010001000011111', ' ':'00000000000000000000000000000000000',
  '0':'01110100011001110101110011000101110', '1':'00100011000010000100001000010001110', '2':'01110100010000100010001000100011111', '3':'11110000010000101110000010000111110', '4':'00010001100101010010111110001000010', '5':'11111100001111000001000011000101110', '6':'00110010001000011110100011000101110', '7':'11111000010001000100010000100001000', '8':'01110100011000101110100011000101110', '9':'01110100011000101111000010001001100', '&':'01100100101010001000101011001001101', '-':'00000000000000011111000000000000000', '.':'00000000000000000000000000110001100'};
const FONT3 = {A:'010101111101101', B:'110101110101110', C:'011100100100011', D:'110101101101110', E:'111100110100111', F:'111100110100100',
  G:'011100101101011', H:'101101111101101', I:'111010010010111', J:'001001001101010', K:'101101110101101', L:'100100100100111',
  M:'101111111101101', N:'110101101101101', O:'010101101101010', P:'110101110100100', Q:'010101101110011', R:'110101110101101',
  S:'011100010001110', T:'111010010010010', U:'101101101101111', V:'101101101101010', W:'101101111111101', X:'101101010101101',
  Y:'101101010010010', Z:'111001010100111', ' ':'000000000000000',
  '0':'111101101101111', '1':'010110010010111', '2':'111001111100111', '3':'111001111001111', '4':'101101111001001',
  '5':'111100111001111', '6':'111100111101111', '7':'111001001001001', '8':'111101111101111', '9':'111101111001111', ':':'000010000010000', '-':'000000111000000', '.':'000000000000010',
  '°':'010101010000000', '/':'001001010100100', '%':'101001010100101'};
const pixWidth = (txt, big) => txt.length * (big ? 6 : 4) - 1;
function pixText(g, txt, x, y, big, col, sc = 1){
  const F = big ? FONT5 : FONT3, cw = big ? 5 : 3, chh = big ? 7 : 5;
  g.fillStyle = col;
  [...txt].forEach((ch, k) => { const m = F[ch] || F[' ']; for (let i = 0; i < cw * chh; i++) if (m[i] === '1') g.fillRect(x + (k * (cw + 1) + i % cw) * sc, y + (i / cw | 0) * sc, sc, sc); });
}

window.PBC_ADS = {ADVERTISE_URL, HOUSE_AD, DEFAULT_ADS, loadSold, qrMatrix, FONT5, FONT3, pixWidth, pixText};
})();
