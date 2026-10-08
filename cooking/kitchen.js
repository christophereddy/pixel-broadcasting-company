/* PBC Cooking: the kitchen set and everything drawn in it (tools/LOOK_BOOK.md, section 6).
   The kitchen is one room two screens wide (768 x 216 at the channel's 384 x 216 picture). Left to right: the window over
   the back counter with the prep island in front of it, Baldur's bed, the fridge, the PBC COOKING sign, the range, and the
   wall ovens by the sink. The camera shows one screen at a time and follows the cook to the stove and the ovens.
   - kitchen(g, t, k)   draws the room for one moment and returns the camera's left edge (whole pixels)
   - table(g, t, k)     the finished meal on the table, the cooks sitting behind it
   - adBreak(g, t, k)   the commercial break: Dot Delgado beside the big screen, as on News
   - CAST, pairFor()    the cooks and which pair cooks a show
   The window shows the Amalfi Coast, or the country of an Around the world show, with the sky for that place's own hour.
   On the wide shot the food on the island is small blocks in each ingredient's color; the close-ups (scenes.js) show the
   ingredient art and the exact amounts. Baldur sleeps in his bed, and in about one show in four something
   drops off the island and he gets up to lick it. Which show, which step and when are fixed by the show itself, never a
   dice roll on the viewer's screen, so every viewer and every clip sees the same thing. */
(function(){
"use strict";
const W = 384, H = 216, RW = 768;
const {person, anim, mix} = PBC_PEOPLE;
let g = null;
function R(c, x, y, w, h){ g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
function disc(cx, cy, r, c, top){ g.fillStyle = c; for (let y = -r; y <= (top ? 0 : r); y++) { const w = Math.floor(Math.sqrt(r * r - y * y)); g.fillRect(Math.round(cx) - w, Math.round(cy) + y, w * 2 + 1, 1); } }
function rng(seed){ return function(){ seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash(s){ let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
const txt = (s, x, y, c, sc) => PBC_ADS.pixText(g, String(s).toUpperCase(), Math.round(x), Math.round(y), false, c, sc || 1);
const tw = (s, sc) => (String(s).length * 4 - 1) * (sc || 1);
const big = (s, x, y, c, sc) => PBC_ADS.pixText(g, String(s).toUpperCase(), Math.round(x), Math.round(y), true, c, sc || 1);

/* ---------- the cooks ----------
   Families, so a parent cooks with their own child and a grandparent with their own grandchild. Aprons over their clothes. */
const CAST = {
  gia:  {name: "Gia Romano", kind: "adult", apron: "#f4efe6", look: {skin: "#e0ac80", hair: "#2a1810", style: "long", coat: "#2b8fb3", shirt: "#f4efe6", pants: "#2a2230"}},
  sam:  {name: "Sam Okoro", kind: "adult", apron: "#f2b632", look: {skin: "#7a4a2c", hair: "#16110f", style: "short", coat: "#c4582b", shirt: "#f2f0e8", pants: "#2b2f3a"}},
  lena: {name: "Lena Park", kind: "adult", apron: "#f4efe6", look: {skin: "#ecc39a", hair: "#1c1418", style: "bob", coat: "#5e2d78", shirt: "#f6eef2", pants: "#2a2230", glasses: true}},
  marco:{name: "Marco Diaz", kind: "adult", apron: "#e3e7f0", look: {skin: "#b07a50", hair: "#241a14", style: "beard", coat: "#1f7a52", shirt: "#f2f0e8", pants: "#2b2f3a"}},
  bea:  {name: "Bea Romano", kind: "elder", apron: "#f6e27a", look: {skin: "#f1cfb0", hair: "#e3e3e8", style: "bob", coat: "#b8283e", shirt: "#f4efe6", pants: "#2a2230", glasses: true, earring: "#f2b632"}},
  walt: {name: "Walt Okoro", kind: "elder", apron: "#e3e7f0", look: {skin: "#6a4128", hair: "#d8d8d8", style: "bald", stache: true, coat: "#253282", shirt: "#eef1f8", pants: "#1c2040", glasses: true}},
  june: {name: "June Park", kind: "elder", apron: "#f4efe6", look: {skin: "#e8c09a", hair: "#c3c6d0", style: "curly", coat: "#1e8c7e", shirt: "#f4efe6", pants: "#2a2230"}},
  eli:  {name: "Eli Diaz", kind: "elder", apron: "#f2b632", look: {skin: "#c08a5e", hair: "#e0e0e0", style: "beard", coat: "#a5835a", shirt: "#e9e4d8", pants: "#3a3530"}},
  mia:  {name: "Mia Romano", kind: "kid", apron: "#e5607f", look: {skin: "#e0ac80", hair: "#2a1810", style: "pony", coat: "#f2b632", shirt: "#f4efe6", pants: "#2a5fb0", kid: true}},
  theo: {name: "Theo Okoro", kind: "kid", apron: "#5fbf6f", look: {skin: "#7a4a2c", hair: "#16110f", style: "short", coat: "#2b8fb3", shirt: "#f2f0e8", pants: "#2b2f3a", kid: true}},
  ava:  {name: "Ava Park", kind: "kid", apron: "#f2b632", look: {skin: "#ecc39a", hair: "#1c1418", style: "bob", coat: "#e5607f", shirt: "#f6eef2", pants: "#2a2230", kid: true}}
};
// Dot Delgado reads the commercial break, in her look from the newsroom (CAST.D in index.html)
const DOT = {name: "Dot Delgado", role: "Head of Sales", look: {skin: "#b97a52", hair: "#1c1418", style: "bob", coat: "#c2417a", shirt: "#f6eef2", pants: "#2a2230", glasses: true, earring: "#f2b632"}};
// The grown-up always comes first in a pair, so "Grown-up helps" steps go to them.
const PAIRS = {
  "parent-child": [["gia", "mia"], ["sam", "theo"], ["lena", "ava"]],
  "grandparent-grandchild": [["bea", "mia"], ["walt", "theo"], ["june", "ava"]],
  "two-elders": [["bea", "walt"], ["june", "eli"], ["eli", "bea"], ["walt", "june"]],
  "two-adults": [["gia", "sam"], ["lena", "marco"], ["marco", "gia"], ["sam", "lena"]]
};
const ROLE = {"parent-child": ["Parent", "Kid cook"], "grandparent-grandchild": ["Grandparent", "Grandkid cook"], "two-elders": ["Cook", "Cook"], "two-adults": ["Cook", "Cook"]};
function pairFor(show){
  const list = PAIRS[show.cooks] || PAIRS["two-adults"], p = list[hash(show.slug) % list.length], roles = ROLE[show.cooks] || ROLE["two-adults"];
  return p.map((k, i) => Object.assign({key: k, role: roles[i]}, CAST[k]));
}

/* ---------- the window: the sky for that place's hour, then its scene ---------- */
const SKY = [[0,"#070a1f","#141a3d"],[5,"#0b1030","#2a2350"],[6.5,"#3b4a8a","#f39a6b"],[8,"#5aa7e0","#bfe3f5"],[16.5,"#4f9ad8","#c8e6f5"],[18.6,"#4a4f9a","#f08a5d"],[20,"#1a1d4a","#5a3a6a"],[21.5,"#0a0d26","#1b2045"],[24,"#070a1f","#141a3d"]];
const TZ = {Italy: "Europe/Rome", Japan: "Asia/Tokyo", Mexico: "America/Mexico_City", India: "Asia/Kolkata", France: "Europe/Paris", "South Korea": "Asia/Seoul", Greece: "Europe/Athens"};
function hourIn(tz){
  try { const p = new Intl.DateTimeFormat("en-US", {hour: "numeric", minute: "numeric", hourCycle: "h23", timeZone: tz}).formatToParts(new Date());
    return (+p.find(x => x.type === "hour").value % 24) + (+p.find(x => x.type === "minute").value) / 60; } catch (e) { return 12; }
}
function skyCols(hr){ for (let i = 0; i < SKY.length - 1; i++) { const a = SKY[i], b = SKY[i + 1]; if (hr >= a[0] && hr <= b[0]) { const k = (hr - a[0]) / (b[0] - a[0]); return [mix(a[1], b[1], k), mix(a[2], b[2], k)]; } } return [SKY[0][1], SKY[0][2]]; }
const isNight = hr => hr < 6 || hr >= 19.5;
function sky(x, y, w, h, hr, t){
  const [a, b] = skyCols(hr), n = 8;
  for (let i = 0; i < n; i++) R(mix(a, b, i / (n - 1)), x, y + Math.floor(h * i / n), w, Math.ceil(h / n) + 1);
  if (isNight(hr)) { const q = rng(7); for (let i = 0; i < w * h / 160; i++) { const sx = x + Math.floor(q() * w), sy = y + Math.floor(q() * h * .5); if (((t / 400 + i) | 0) % 9) R("#ffffff", sx, sy, 1, 1); }
    disc(x + w - 16, y + 10, 4, "#f4f1d8"); disc(x + w - 14, y + 9, 3, a); }
  else if (hr >= 6 && hr < 19.5) { const k = (hr - 6) / 13.5; disc(x + Math.round(w * (.1 + .8 * k)), y + Math.round(h * .5 - Math.sin(k * Math.PI) * h * .4), 5, "#ffe27a"); }
}
function windowView(x, y, w, h, country, t){
  const tz = TZ[country] || TZ.Italy, hr = hourIn(tz), night = isNight(hr), dusk = !night && (hr < 7.5 || hr > 18);
  const dim = night ? .55 : dusk ? .2 : 0, S = c => dim ? mix(c, "#0a0d26", dim) : c, lit = q => night && q < .6 ? "#ffd77a" : S("#2b3550");
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  sky(x, y, w, h, hr, t);
  const q = rng(hash(country || "Italy")), base = y + h;
  const sea = (top, col) => { R(S(col), x, top, w, base - top); for (let i = 0; i < 9; i++) { const sx = x + ((i * 37 + t / 60) % w), sy = top + 3 + (i * 7) % Math.max(1, base - top - 4); R(S("#8fc4f0"), sx, sy, 5, 1); } };
  const house = (hx, hy, hw, hh, col, roof) => { R(S(col), hx, hy, hw, hh); if (roof) R(S(roof), hx - 1, hy - 2, hw + 2, 2); for (let wy = hy + 2; wy < hy + hh - 2; wy += 4) for (let wx = hx + 2; wx < hx + hw - 1; wx += 4) R(lit(q()), wx, wy, 1, 2); };
  if (country === "Greece") {
    sea(y + h * .5, "#1e5aa0");
    for (let i = 0; i < w * .6; i += 2) R(S("#d8cfb8"), x + w - i, base - (h * .55 - i * .5), 2, h);
    for (let i = 0; i < 9; i++) { const hx = x + w - 10 - q() * w * .55, hy = base - 8 - q() * h * .35; house(hx, hy, 8, 6, "#f4f5fb", null); R(S("#2a5fb0"), hx + 3, hy + 3, 2, 3); }
    disc(x + w - 30, base - h * .42, 5, S("#2a5fb0"), true); R(S("#f4f5fb"), x + w - 36, base - h * .42, 13, 8);
    R(S("#e5607f"), x + 4, base - 10, 10, 6); R(S("#3f8f3a"), x + 6, base - 4, 6, 4);
  } else if (country === "Japan") {
    R(S("#5a8fc0"), x, y + h * .62, w, h);
    for (let i = 0; i < 40; i++) R(S("#6c7f9e"), x + w / 2 - i, y + h * .25 + i * .9, i * 2, h);
    for (let i = 0; i < 10; i++) R(S("#f4f5fb"), x + w / 2 - i, y + h * .25 + i * .9, i * 2, 2);
    R(S("#3f6b3a"), x, base - 14, w, 14);
    const px = x + 18; for (let k = 0; k < 4; k++) { R(S("#8a2a2a"), px + k * 2, base - 14 - k * 9, 22 - k * 4, 6); R(S("#2a1f1f"), px - 2 + k * 2, base - 16 - k * 9, 26 - k * 4, 2); }
    R(S("#2a1f1f"), px + 10, base - 52, 2, 8);
    disc(x + w - 18, base - 18, 9, S("#c8402a")); R(S("#5a3a22"), x + w - 19, base - 12, 3, 12);
  } else if (country === "Mexico") {
    for (let i = 0; i < w; i += 2) R(S("#c8955a"), x + i, base - 22 - Math.round(Math.sin(i / 17) * 6 + 6), 2, 40);
    R(S("#d9a86a"), x, base - 12, w, 12);
    const cols = ["#e5607f", "#2b8fb3", "#f2b632", "#5fbf6f", "#f4efe6"];
    let hx = x + 4; while (hx < x + w - 20) { const hw = 12 + Math.floor(q() * 8), hh = 10 + Math.floor(q() * 8); house(hx, base - hh - 4, hw, hh, cols[Math.floor(q() * cols.length)], null); hx += hw + 2; }
    R(S("#e8d6a8"), x + w / 2 - 4, base - 40, 8, 36); disc(x + w / 2, base - 40, 4, S("#e8d6a8"), true); R(S("#2b3550"), x + w / 2 - 1, base - 34, 2, 4);
    R(S("#3f8f3a"), x + 8, base - 24, 3, 20); R(S("#3f8f3a"), x + 5, base - 18, 3, 2); R(S("#3f8f3a"), x + 5, base - 21, 1, 3); R(S("#3f8f3a"), x + 11, base - 16, 3, 2); R(S("#3f8f3a"), x + 13, base - 19, 1, 3);
  } else if (country === "India") {
    R(S("#a8b56a"), x, base - 14, w, 14);
    R(S("#5a8fc0"), x + 20, base - 12, w - 40, 6);
    const cx = x + w / 2; R(S("#f4f1e8"), cx - 24, base - 30, 48, 18); disc(cx, base - 34, 12, S("#f4f1e8"), true); R(S("#f4f1e8"), cx, base - 50, 1, 4);
    disc(cx - 16, base - 30, 4, S("#f4f1e8"), true); disc(cx + 16, base - 30, 4, S("#f4f1e8"), true);
    R(S("#2b3550"), cx - 4, base - 26, 8, 14); for (const mx of [cx - 32, cx + 30]) { R(S("#f4f1e8"), mx, base - 44, 3, 32); R(S("#f4f1e8"), mx - 1, base - 46, 5, 2); }
    R(S("#6b4a2e"), x + 8, base - 30, 2, 26); for (let i = 0; i < 4; i++) R(S("#3f8f3a"), x + 2 + (i % 2) * 6, base - 33 + (i >> 1) * 2, 8, 2);
  } else if (country === "France") {
    let hx = x; while (hx < x + w) { const hw = 14 + Math.floor(q() * 10), hh = 14 + Math.floor(q() * 12); house(hx, base - hh, hw, hh, "#e2d6c0", "#6c7f9e"); R(S("#6c7f9e"), hx + 2, base - hh - 5, hw - 4, 3); R(S("#b5523a"), hx + hw - 5, base - hh - 8, 2, 4); hx += hw; }
    const ex = x + w * .68; for (let i = 0; i < 50; i++) { const half = Math.round(1 + Math.pow(i / 50, 2.2) * 14); if (i % 3 === 0 || i > 40) R(S("#6b5a4a"), ex - half, y + 8 + i, half * 2 + 1, 1); else { R(S("#6b5a4a"), ex - half, y + 8 + i, 1, 1); R(S("#6b5a4a"), ex + half, y + 8 + i, 1, 1); R(S("#6b5a4a"), ex, y + 8 + i, 1, 1); } }
    R(S("#6b5a4a"), ex, y + 2, 1, 6);
  } else if (country === "South Korea") {
    for (let i = 0; i < w; i += 2) { R(S("#5a7f6a"), x + i, base - 34 - Math.round(Math.sin(i / 21) * 8 + 8), 2, 60); }
    for (let i = 0; i < w; i += 2) { R(S("#3f6b3a"), x + i, base - 22 - Math.round(Math.sin(i / 13 + 2) * 5 + 5), 2, 40); }
    let hx = x + w * .45; while (hx < x + w) { const hw = 8 + Math.floor(q() * 6), hh = 20 + Math.floor(q() * 22); house(hx, base - hh, hw, hh, "#9aa8b8", null); hx += hw + 2; }
    const px = x + 10; R(S("#e8d6a8"), px + 4, base - 12, 30, 12); R(S("#2a2f3a"), px, base - 16, 38, 4); R(S("#2a2f3a"), px - 2, base - 17, 3, 2); R(S("#2a2f3a"), px + 37, base - 17, 3, 2); R(S("#b8283e"), px + 8, base - 12, 2, 12); R(S("#b8283e"), px + 28, base - 12, 2, 12);
  } else {
    // the Amalfi Coast: the sea, a cliff of stacked pastel houses, and a lemon tree right outside
    sea(y + h * .52, "#2a74d6");
    for (let i = 0; i < w * .62; i += 2) R(S("#8a7458"), x + i, y + h * .22 + i * .55, 2, h);
    const cols = ["#f0b0a0", "#f2d080", "#f4efe6", "#f0c090", "#e8a8b8"];
    for (let i = 0; i < 16; i++) { const hx = x + 2 + q() * w * .5, top = y + h * .22 + (hx - x) * .55; house(hx, top + 2 + q() * 18, 7 + Math.floor(q() * 4), 6 + Math.floor(q() * 4), cols[i % cols.length], "#b5523a"); }
    const bx = x + w * .62 + ((t / 90) % (w * .3)); R(S("#f4efe6"), bx, y + h * .66, 8, 2); R(S("#f4efe6"), bx + 3, y + h * .66 - 4, 1, 4);
    disc(x + w - 14, base - 16, 12, S("#3f8f3a")); R(S("#5a3a22"), x + w - 15, base - 8, 3, 8);
    [[-6, -20], [3, -24], [-2, -12], [7, -15], [-9, -14]].forEach(([dx, dy]) => R(S("#f6e27a"), x + w - 14 + dx, base + dy, 2, 2));
  }
  g.restore();
  R("#05071a", x - 3, y - 3, w + 6, 3); R("#05071a", x - 3, y + h, w + 6, 3); R("#05071a", x - 3, y, 3, h); R("#05071a", x + w, y, 3, h);
  R("#05071a", x + Math.round(w / 2) - 1, y, 2, h); R("#05071a", x, y + Math.round(h / 2) - 1, w, 2);
}

/* ---------- Baldur, from Chris's photos (cooking-channel/baldur-sketch.png in the project) ---------- */
const DOG = {K: "#2a221e", D: "#3e332c", T: "#b4824c", E: "#1b1b25", G: "#b9b2a6", N: "#121218", B: "#8c6034", P: "#d8707e", W: "#ece6da", L: "#4a3a30", m: "#9a95a2", n: "#7d7884", q: "#5f5a68"};
const STAND = [
  "....................KKKKKKKK....",
  "....................DDDKKKTK....",
  "KK..................DDDKKEKK....",
  "KK..................DDDKKKGGGGNN",
  ".KK................TDDDKGGGGGGNN",
  ".KK................TDDDKGGGGGGG.",
  "..BBKKDDDDDDDDDDDDKTDDDKKKKK....",
  "..BTKKKKKKKKKKKKKKKTTTT.........",
  "...TKKKKKKKKKKKKKKKTTTT.........",
  "...TTTTTTTTTTTTTTTTTTTT.........",
  "...TTTTTTTTTTTTTTTTTTWWW........",
  "...TTTTTTTTTTTTTTTTTTWWW........",
  "...TTTTTTTTTTTTTTTTTTWWW........",
  "...TTTTTTTTTTTTTTTTTTWWW........",
  "...BBBBBBBBBBBBBBBBBBWWW........"];
const BED = [
  "..............KKKDDDDDDDDDDDDDDKKKKK...................",
  ".............TKKKKKKKKKKKKKKKKKKKKKKT..................",
  ".............TKKKKKKKKKKKKKKKKKKKKKKT..KKKTKKKTK.......",
  "...........TTTTTTTTTTTTTTTTTTTTTTTTTTTTDDDKKKKKK.......",
  "...........TTTTTTTTTTTTTTTTTTTTTTTTTTTTDDDKKLLKK.......",
  "...........TTTTTTTTTTTTTTTTTTTTTTTTTTTTDDDKKKGGGGGNN...",
  "...........TTTTTTTTTTTTTTTTTTTTTTTTTTTTDDDKKKGGGGGNN...",
  "...mmmmmmmmTTTTTTTTTTTTTTTTTTTTTTTTTTTTDDDKKKGGGGGGmm..",
  "...mmmmmmmmTTTTTTTTTTTTTTTTTTTTTTTTTTTTDDDKKKKKKmmmmm..",
  ".mmmmmmmmBBBBBBBBBBTTTTTTTTTTTTTTTTTTTTTTmmmmmmmmmmmmmm",
  ".mmnnnnKKKKBBBBBBBBTTWWWWTWWWWTTTTTTTTTTTnnnnnnnnnnnnmm",
  ".mmnnnnKKKKBBBBBBBBTTWWWWTWWWWTTTTTTTTTTTnnnnnnnnnnnnmm",
  ".mmnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnmm",
  ".mmnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnmm",
  ".mmnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnmm",
  ".nnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn",
  ".nnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn",
  ".nnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn",
  ".nnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn",
  "...qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq.."];
function sprite(rows, x, y, flip, from, to){
  const w = rows[0].length;
  for (let r = from || 0; r < (to || rows.length); r++) for (let c = 0; c < w; c++) { const ch = rows[r][c]; if (ch !== ".") R(DOG[ch], x + (flip ? w - 1 - c : c), y + r, 1, 1); }
}
const BED_X = 262, BED_Y = 127;   // bed's top left; its bottom row sits on the floor at y 146
function emptyBed(){
  R(DOG.m, BED_X + 3, BED_Y + 7, 50, 3);
  for (let r = 9; r < BED.length; r++) for (let c = 0; c < BED[r].length; c++) { const ch = BED[r][c]; if (ch === ".") continue; R(DOG[/[mnq]/.test(ch) ? ch : "n"], BED_X + c, BED_Y + r, 1, 1); }
}
function sleeping(t){
  const br = Math.floor(t / 1400) % 2;   // breathing: the back rises a pixel
  sprite(BED, BED_X, BED_Y, false, 9, BED.length);
  sprite(BED, BED_X, BED_Y - br, false, 0, 9);
  if (br) sprite(BED, BED_X, BED_Y, false, 8, 9);   // when his back rises, the row above the bed stretches to fill the gap
  if (Math.floor(t / 1800) % 3 === 0) txt("Z", BED_X + 50, BED_Y - 8 - (Math.floor(t / 600) % 3), "#9fb2ff");
}
// standing, walking (legs swap) or licking (head down, tongue out); x is his left edge, feet on the floor at y 146
function dog(x, flip, mode, t){
  const y = 146 - 20, leg = mode === "walk" ? Math.floor(t / 160) % 2 : 0;
  if (mode === "lick") { sprite(STAND, x, y + 5, flip, 6, 15); const hx = flip ? x : x; sprite(STAND.map(r => r.slice(18)), hx + (flip ? 0 : 18), y + 9, flip, 0, 6);
    if (Math.floor(t / 250) % 2) R(DOG.P, flip ? x + 1 : x + 30, y + 15, 2, 2); }
  else sprite(STAND, x, y + 5, flip);
  // legs: back pair and front pair, the darker leg of each behind
  const L = (lx, c, dx) => R(c, flip ? x + 31 - lx - 1 - dx : x + lx + dx, y + 20, 2, 5);
  L(4, DOG.T, leg); L(7, DOG.B, -leg); L(17, DOG.T, -leg); L(20, DOG.B, leg);
  R(DOG.W, flip ? x + 31 - 6 : x + 4 + leg, y + 24, 2, 1); R(DOG.W, flip ? x + 31 - 19 : x + 17 - leg, y + 24, 2, 1);
}
// the spill: a few drops land in front of the island at drop; he wakes, trots over, licks it up and goes back to bed
const SPILL = {drop: 9000, wake: 11500, go: 13000, there: 19000, done: 24000, home: 30000};
function baldur(t, el, spill){
  if (!spill || el < SPILL.wake || el >= SPILL.home) { sleeping(t); if (spill && el >= SPILL.drop && el < SPILL.done) drops(spill, el); return; }
  emptyBed();
  const sx = spill.x - 30, home = BED_X + 10;
  if (el < SPILL.go) { dog(home, true, "stand", t); }
  else if (el < SPILL.there) { const k = (el - SPILL.go) / (SPILL.there - SPILL.go); dog(Math.round(home + (sx - home) * k), true, "walk", t); }
  else if (el < SPILL.done) { dog(sx, true, "lick", t); }
  else { const k = (el - SPILL.done) / (SPILL.home - SPILL.done); dog(Math.round(sx + (home - sx) * k), false, "walk", t); }
  if (el < SPILL.done) drops(spill, el);
}
function drops(spill, el){
  const fall = Math.min(1, (el - SPILL.drop) / 600), y = Math.round(100 + 46 * fall * fall), left = el < SPILL.there ? 1 : Math.max(0, 1 - (el - SPILL.there) / (SPILL.done - SPILL.there));
  if (fall < 1) { R(spill.color, spill.x, y - 2, 3, 3); return; }
  const n = Math.ceil(4 * left); [[0, -1, 6, 2], [6, 0, 3, 1], [-3, 0, 3, 1], [2, -2, 2, 1]].slice(0, n).forEach(([dx, dy, w, h]) => R(spill.color, spill.x + dx, 145 + dy, w, h));
}

/* ---------- ingredient colors on the wide shot (the close-ups draw the ingredient art, food.js) ---------- */
const GROUP = {vegetable: "#5fbf6f", fruit: "#f6c744", herb: "#3f8f3a", protein: "#e8a090", dairy: "#f4efe6", bread: "#d9a05b", grain: "#e8d6a8",
  baking: "#f4f1e8", spice: "#b5523a", pantry: "#c98a3a", drink: "#8fd3ff", nut: "#a0703a"};
const tint = grp => GROUP[grp] || "#c9ccd6";
// an ingredient's own color from the ingredient art, or its group's when the art isn't loaded
const foodCol = u => u && u.id && window.PBC_FOOD ? PBC_FOOD.color(u.id) : tint((u || {}).group);

/* ---------- the room ---------- */
const ISLAND = [40, 252], TOP = 98;          // the prep island: left, right, and its worktop line
const SPOT = {home: [84, 166], stove: 528, oven: 656};
const RANGE = 440, OVENS = 594;
function room(t, k){
  // back wall, ceiling lights, floor
  R("#151b3d", 0, 0, RW, 118); for (let x = 0; x < RW; x += 24) R("#1b2250", x, 12, 1, 106);
  R("#07091a", 0, 0, RW, 12); for (let x = 0; x < RW; x += 6) R("#1c2146", x, 4, 3, 3);
  R("#0c1029", 0, 118, RW, H - 118); for (let y = 122; y < H; y += 8) R("#10153a", 0, y, RW, 1);
  R("#07091a", 0, 117, RW, 2);
  // backsplash tiles behind the counters
  for (let y = 64; y < 92; y += 6) for (let x = 0; x < RW; x += 8) R((x / 8 + y / 6) % 2 ? "#1b2250" : "#1d2660", x + ((y / 6) % 2 ? 4 : 0), y, 7, 5);
  // the window over the back counter
  windowView(30, 18, 128, 66, k.country, t);
  R("#e3e7f0", 26, 84, 136, 3);
  // back counters: prep side, by the range, and the sink run
  const counter = (x0, x1) => { R("#e3e7f0", x0, 92, x1 - x0, 3); R("#b9bfd0", x0, 95, x1 - x0, 1); R("#1d2766", x0, 96, x1 - x0, 20); R("#253282", x0, 96, x1 - x0, 1);
    for (let x = x0 + 2; x < x1 - 4; x += 22) { R("#05071a", x + 20, 97, 1, 19); R("#f2b632", x + 9, 99, 4, 1); } };
  counter(0, 300); counter(524, 594); counter(652, RW);
  // upper cabinets and a shelf of jars
  R("#1d2766", 178, 16, 116, 40); R("#253282", 178, 16, 116, 2); for (let x = 178; x < 294; x += 29) { R("#05071a", x, 16, 1, 40); R("#f2b632", x + 25, 48, 1, 4); }
  R("#e3e7f0", 660, 44, 100, 2); [["#f2b632", 664], ["#b5523a", 678], ["#5fbf6f", 692], ["#e8d6a8", 706], ["#c98a3a", 720], ["#e5607f", 734], ["#8fd3ff", 748]].forEach(([c, x], i) => { R("#d8ecf0", x, 34 - (i % 2) * 2, 9, 10 + (i % 2) * 2); R(c, x + 1, 37, 7, 7); R("#9aa8b0", x + 2, 32 - (i % 2) * 2, 5, 2); });
  // utensil crock and a bowl of lemons on the back counter
  R("#b5523a", 8, 82, 10, 10); R("#c9ccd6", 9, 72, 1, 10); R("#c9ccd6", 12, 70, 1, 12); R("#8b5a2b", 15, 74, 2, 8);
  R("#e3e7f0", 240, 86, 22, 6); R("#c9cdd8", 241, 91, 20, 1); [[243, 83], [249, 82], [255, 83], [246, 80], [252, 80]].forEach(([x, y]) => R("#f6e27a", x, y, 4, 3));
  // the sink, with a plant
  R("#9aa8b0", 680, 90, 44, 3); R("#c9ccd6", 700, 74, 2, 16); R("#c9ccd6", 700, 74, 10, 2); R("#c9ccd6", 708, 76, 2, 3);
  R("#b5523a", 742, 82, 10, 10); disc(747, 76, 6, "#3f8f3a"); R("#5fbf6f", 744, 70, 2, 4);
  // the fridge
  R("#c9ccd6", 318, 24, 44, 94); R("#aeb3c2", 318, 24, 2, 94); R("#9aa8b0", 318, 56, 44, 1); R("#7a8090", 354, 34, 2, 16); R("#7a8090", 354, 62, 2, 30);
  R("#f2b632", 326, 66, 6, 5); R("#e5607f", 336, 72, 5, 6); R("#f4f5fb", 324, 80, 8, 9);   // drawings on the door
  // the PBC COOKING sign
  R("#05071a", 368, 26, 66, 26); R("#1d2766", 370, 28, 62, 22); R("#f2b632", 370, 28, 62, 1);
  big("PBC", 383, 31, "#f2b632", 1); txt("COOKING", 373, 41, "#ffffff");
  // the range: hood, cooktop, knobs and oven door
  R("#aeb3c2", RANGE + 4, 14, 76, 18); R("#9aa8b0", RANGE + 12, 32, 60, 4); R("#c9ccd6", RANGE + 4, 14, 76, 2); R("#fff2c0", RANGE + 20, 36, 8, 1); R("#fff2c0", RANGE + 56, 36, 8, 1);
  R("#2a2f3a", RANGE, 88, 84, 8); R("#3a404e", RANGE, 88, 84, 1);
  [RANGE + 8, RANGE + 50].forEach(bx => R("#15151c", bx, 89, 26, 2));
  R("#c9ccd6", RANGE, 96, 84, 22); R("#aeb3c2", RANGE, 96, 84, 4);
  for (let i = 0; i < 4; i++) R("#2a2f3a", RANGE + 10 + i * 18, 97, 4, 2);
  R("#2a2f3a", RANGE + 8, 102, 68, 12); R("#1b1f2e", RANGE + 10, 104, 64, 8); R("#7a8090", RANGE + 8, 101, 68, 1);
  // the wall ovens, with a display each
  R("#aeb3c2", OVENS, 22, 58, 96); R("#c9ccd6", OVENS, 22, 58, 2);
  [26, 72].forEach(oy => { R("#15151c", OVENS + 6, oy, 46, 6); R("#2a2f3a", OVENS + 6, oy + 8, 46, 34); R("#7a8090", OVENS + 6, oy + 8, 46, 1); R("#1b1f2e", OVENS + 10, oy + 14, 38, 22); });
}
function apron(c, x, y){
  if (!c.apron) return;
  const rows = c.look.kid ? 6 : 8, s = 2;
  R(c.apron, x + 3 * s, y + 13 * s, 8 * s, rows * s); R(c.apron, x + 4 * s, y + 12 * s, 1 * s, 1 * s); R(c.apron, x + 9 * s, y + 12 * s, 1 * s, 1 * s);
  R(mix(c.apron, "#000000", .15), x + 5 * s, y + 17 * s, 4 * s, 2 * s);
}
function cook(c, x, t, speaking, phase, walking){
  const kid = !!c.look.kid, y = kid ? 60 : 56;
  if (kid) { R("#8b5a2b", x + 6, 116, 16, 4); R("#6b4a2e", x + 6, 119, 16, 1); }   // a step stool
  const a = anim(c.key, t, speaking, phase);
  if (walking) a.bob = Math.floor(t / 180) % 2 === 0;
  person(c.look, g, x, y - (kid ? 4 : 0), 2, a);
  apron(c, x, y - (kid ? 4 : 0) + (a.bob ? 0 : 0));
}
// what a cook is doing with their hands at the island
function work(x, tool, t, uses){
  const chop = Math.floor(t / 150) % 2;
  if (tool === "knife") {
    R("#c08a52", x - 2, TOP - 4, 32, 3); R("#8b5a2b", x - 2, TOP - 1, 32, 1);
    (uses || []).slice(0, 4).forEach((u, i) => R(foodCol(u), x + 2 + i * 5, TOP - 6, 4, 2));
    R("#c9ccd6", x + 18, TOP - 9 + chop * 2, 10, 2); R("#2a2f3a", x + 26, TOP - 9 + chop * 2, 4, 2);
  } else if (tool === "blender") {
    R("#2a2f3a", x + 4, TOP - 6, 14, 6); R("#bfe8ff", x + 5, TOP - 26, 12, 20); R("#2a2f3a", x + 4, TOP - 28, 14, 3);
    const col = foodCol((uses || [])[0]); R(col, x + 6, TOP - 18 + (Math.floor(t / 90) % 3), 10, 10);
  } else {
    R("#e3e7f0", x + 2, TOP - 8, 24, 8); R("#c9cdd8", x + 3, TOP - 1, 22, 1);
    (uses || []).slice(0, 3).forEach((u, i) => R(foodCol(u), x + 6 + i * 5, TOP - 10 + (Math.floor(t / 300 + i) % 2), 5, 3));
    R("#c9ccd6", x + 14 + Math.round(Math.sin(t / 160) * 3), TOP - 16, 2, 9);
  }
}
function stoveTop(k, t){
  const on = k.station === "stove" && k.heat, lvl = {low: 1, "medium-low": 1, medium: 2, "medium-high": 3, high: 3}[k.heat] || 0;
  const px = RANGE + 48, col = foodCol((k.uses || [])[0]);
  R("#7a8090", px, 74, 30, 14); R("#9aa8b0", px, 74, 30, 2); R("#5a6070", px - 4, 77, 4, 2); R("#5a6070", px + 30, 77, 4, 2);
  if (k.station === "stove") R(col, px + 2, 74, 26, 2);
  if (on) {
    for (let i = 0; i < 6; i++) { const f = (Math.floor(t / 120) + i) % 2; R(i % 2 ? "#ff9a3a" : "#5fb4ff", px + 3 + i * 4, 88 - lvl + f, 2, lvl); }
    for (let i = 0; i < 3; i++) { const sy = 70 - ((t / 40 + i * 14) % 30); R("#e3e7f0", px + 6 + i * 8 + Math.round(Math.sin(t / 300 + i) * 2), sy, 3, 2); }
    // knob turned to the heat
    R("#f2b632", RANGE + 46 + lvl, 97, 2, 2);
  }
}
function ovens(k, t){
  const on = k.station === "oven" && k.oven_f;
  if (!on) { txt("OFF", OVENS + 8, 27, "#5a6070"); return; }
  txt(k.oven_f + "°F", OVENS + 8, 27, "#f2b632");
  g.globalAlpha = .55 + (Math.floor(t / 600) % 2) * .1; R("#ff9a3a", OVENS + 10, 40, 38, 22); g.globalAlpha = 1;
  R("#5a6070", OVENS + 12, 54, 34, 2); R(foodCol((k.uses || [])[0]), OVENS + 16, 50, 26, 4);
}
function island(k){
  R("#e3e7f0", ISLAND[0], TOP, ISLAND[1] - ISLAND[0], 3); R("#b9bfd0", ISLAND[0], TOP + 3, ISLAND[1] - ISLAND[0], 1);
  R("#1d2766", ISLAND[0] + 4, TOP + 4, ISLAND[1] - ISLAND[0] - 8, 40); R("#253282", ISLAND[0] + 4, TOP + 4, ISLAND[1] - ISLAND[0] - 8, 2);
  R("#f2b632", ISLAND[0] + 4, TOP + 18, ISLAND[1] - ISLAND[0] - 8, 2);
  const cx = (ISLAND[0] + ISLAND[1]) / 2; big("PBC", cx - 17, TOP + 25, "#ffffff", 2);
  R("#07091a", ISLAND[0] + 6, TOP + 44, ISLAND[1] - ISLAND[0] - 12, 2);
}
// everything laid out on the island while the cooks read what you'll need
function needBowls(list){
  const n = Math.min(list.length, 12), step = Math.floor((ISLAND[1] - ISLAND[0] - 16) / Math.max(1, n));
  list.slice(0, n).forEach((it, i) => { const x = ISLAND[0] + 8 + i * step; R("#e3e7f0", x, TOP - 5, 12, 5); R("#c9cdd8", x + 1, TOP - 1, 10, 1); R(foodCol(it), x + 2, TOP - 7, 8, 3); });
}

function kitchen(ctx, t, k){
  g = ctx;
  room(t, k);
  stoveTop(k, t); ovens(k, t);
  // where each cook stands: both at the island, or the worker at the stove or the ovens; they walk over at the start of a beat
  const at = (who, st) => st === "stove" && who === k.worker ? SPOT.stove : st === "oven" && who === k.worker ? SPOT.oven : SPOT.home[who];
  const walkMs = 2500, kw = Math.min(1, k.el / walkMs);
  const xs = [0, 1].map(who => { const a = at(who, k.prevStation), b = at(who, k.station); return {x: Math.round(a + (b - a) * kw), walking: a !== b && kw < 1}; });
  // the cooks behind the island, then the island and the work on it, then anyone out at the stove or ovens
  const behind = who => xs[who].x < ISLAND[1] - 10;
  [0, 1].forEach(who => { if (behind(who)) cook(k.pair[who], xs[who].x, t, k.speak === who, k.phase, xs[who].walking); });
  island(k);
  if (k.kind === "need") needBowls(k.need || []);
  else if (k.station === "prep" && (k.kind === "step" || k.kind === "ff")) work(xs[k.worker].x, k.tool, t, k.uses);
  else { R("#c08a52", 118, TOP - 3, 32, 3); R("#8b5a2b", 118, TOP, 32, 1); }
  [0, 1].forEach(who => { if (!behind(who)) cook(k.pair[who], xs[who].x, t, k.speak === who, k.phase, xs[who].walking); });
  // oven mitts or a spoon for whoever is out at the stove or ovens
  const wx = xs[k.worker].x;
  if (!xs[k.worker].walking && k.station === "stove") { R("#c9ccd6", wx - 8 + Math.round(Math.sin(t / 200) * 2), 80, 2, 18); R("#c9ccd6", wx - 12, 80, 6, 2); }
  if (!xs[k.worker].walking && k.station === "oven") { R("#e5383b", wx - 4, 94, 6, 6); R("#e5383b", wx + 26, 94, 6, 6); }
  baldur(t, k.el, k.spill);
  // the camera: the island, or following the worker out to the stove and ovens
  const me = xs[k.worker].x + 14, cx = xs[k.worker].walking ? me : k.station === "stove" ? (RANGE + 42 + me) / 2 : k.station === "oven" ? (OVENS + 29 + me) / 2 : W / 2;
  return Math.max(0, Math.min(RW - W, Math.round(cx - W / 2)));
}

/* ---------- the table ---------- */
const TABLE = 114;   // the tabletop line
// one dish, drawn at 2x from the recipe's role and the colors of its first ingredients; x is its center
function dish(cx, role, cols){
  const c0 = cols[0] || "#c9ccd6", c1 = cols[1] || c0, c2 = cols[2] || c1, y = TABLE;
  const P = (c, dx, dy, w, h) => R(c, cx + dx * 2, y + dy * 2, w * 2, h * 2);
  if (role === "drink") { P("#d8ecf0", -4, -12, 8, 12); P(c0, -3, -9, 6, 8); P("#ffffff", -2, -11, 1, 9); return; }
  if (role === "dessert") { P("#f4f5fb", -8, -2, 16, 2); P(c0, -5, -7, 10, 5); P(c1, -5, -7, 10, 1); P("#e5383b", -1, -9, 2, 2); return; }
  if (role === "sauce" || role === "side" || role === "starter" || role === "snack") { P("#e3e7f0", -7, -5, 14, 5); P("#c9cdd8", -6, -1, 12, 1); P(c0, -6, -6, 12, 2); P(c1, -2, -7, 4, 1); return; }
  P("#f4f5fb", -10, -2, 20, 2); P("#c9cdd8", -9, 0, 18, 1);
  P(c0, -7, -5, 14, 3); P(c1, -5, -7, 5, 2); P(c2, 1, -7, 5, 2);
}
function table(ctx, t, k){
  g = ctx;
  R("#151b3d", 0, 0, W, TABLE); for (let x = 0; x < W; x += 24) R("#1b2250", x, 12, 1, TABLE - 12);
  R("#07091a", 0, 0, W, 12); for (let x = 0; x < W; x += 6) R("#1c2146", x, 4, 3, 3);
  windowView(128, 18, 128, 60, k.country, t);
  // a lamp over the table, its light falling on the cloth
  R("#2a2f55", 190, 12, 4, 6); R("#f2b632", 180, 18, 24, 5); R("#fff2c0", 184, 23, 16, 1);
  // the cooks sit behind the table
  k.pair.forEach((c, i) => { const x = i ? 238 : 104, kid = !!c.look.kid; person(c.look, g, x, kid ? 57 : 54, 3, Object.assign({seated: true}, anim(c.key, t, k.speak === i, k.phase))); });
  // the cloth and the meal, and Baldur peeking over the edge for a crumb
  R("#e3e7f0", 0, TABLE, W, 3); R("#b8283e", 0, TABLE + 3, W, H - TABLE - 3); for (let x = 0; x < W; x += 16) R("#a52436", x, TABLE + 3, 8, H - TABLE - 3);
  g.globalAlpha = .08; g.fillStyle = "#fff2c0"; g.fillRect(96, TABLE, 192, H - TABLE); g.globalAlpha = 1;
  const n = k.dishes.length, gap = Math.min(64, Math.floor((W - 96) / Math.max(1, n)));
  k.dishes.forEach((d, i) => dish(Math.round(W / 2 - (n - 1) * gap / 2 + i * gap), d.role, d.cols));
  sprite(STAND.map(r => r.slice(18)), 340, TABLE - 7, true, 0, 7);
}

/* ---------- the commercial break ---------- */
const QRS = new Map();
function adBreak(ctx, t, k){
  g = ctx;
  const {pixText, pixWidth, qrMatrix} = PBC_ADS, ad = k.ad;
  R("#151b3d", 0, 0, W, H); for (let x = 0; x < W; x += 24) R("#1b2250", x, 0, 1, 150);
  R("#07091a", 0, 0, W, 12); for (let x = 0; x < W; x += 6) R("#1c2146", x, 4, 3, 3);
  R("#0c1029", 0, 150, W, 66); for (let y = 154; y < H; y += 8) R("#10153a", 0, y, W, 1);
  const sx = 92, sy = 20, sw = 280, sh = 112;
  R("#05060d", sx + sw / 2 - 14, sy + sh, 28, 20); R("#1d2238", sx + sw / 2 - 40, sy + sh + 18, 80, 4);
  R("#05060d", sx - 4, sy - 4, sw + 8, sh + 8); R("#23263c", sx - 2, sy - 2, sw + 4, sh + 4); R(ad.bg, sx, sy, sw, sh);
  R(mix(ad.bg, "#000000", .35), sx, sy, sw, 11);
  pixText(g, "PBC COMMERCIAL BREAK", sx + 5, sy + 3, false, ad.fg);
  pixText(g, "COOKING IN 0:" + String(Math.max(0, k.left)).padStart(2, "0"), sx + 5 + pixWidth("PBC COMMERCIAL BREAK", false) + 10, sy + 3, false, "#ffffff");
  let tx = sx, tw2 = sw;
  if (ad.url) {
    if (!QRS.has(ad.url)) QRS.set(ad.url, qrMatrix(ad.url));
    const q = QRS.get(ad.url);
    if (q) { const n = q.length, m = 2, qs = (n + 4) * m, qx = sx + 14, qy = sy + 14 + Math.max(0, (sh - 14 - qs) >> 1);
      R("#ffffff", qx, qy, qs, qs); g.fillStyle = "#05060d"; q.forEach((row, y) => row.forEach((d, x) => { if (d) g.fillRect(qx + (x + 2) * m, qy + (y + 2) * m, m, m); }));
      tx = qx + qs + 6; tw2 = sx + sw - tx - 4; }
  }
  const cx = tx + tw2 / 2, small = (s, y, c) => pixText(g, s, Math.round(cx - pixWidth(s, false) / 2), y, false, c);
  small(ad.house ? "PIXEL BROADCASTING CO" : "BROUGHT TO YOU BY", sy + 22, ad.house ? "#e7e1cc" : ad.fg);
  const words = ad.name.split(" "); let lines = [ad.name], sc = 2;
  if (pixWidth(ad.name, true) * 2 > tw2 - 6) { if (words.length > 1 && words.every(w => pixWidth(w, true) * 2 <= tw2 - 6)) { const h = Math.ceil(words.length / 2); lines = [words.slice(0, h).join(" "), words.slice(h).join(" ")]; } else sc = 1; }
  let y = sy + (lines.length > 1 ? 36 : 44);
  lines.forEach(l => { const x = Math.round(cx - pixWidth(l, true) * sc / 2); pixText(g, l, x + 1, y + 1, true, "rgba(0,0,0,.45)", sc); pixText(g, l, x, y, true, ad.fg, sc); y += 7 * sc + 4; });
  if (ad.line) small(ad.line, y + 4, ad.house ? "#e7e1cc" : ad.fg);
  small(ad.house ? "PBC HOUSE AD" : "SPONSOR", sy + sh - 9, ad.fg);
  g.globalAlpha = .12; g.fillStyle = "#000000"; for (let r = sy + 1; r < sy + sh; r += 2) g.fillRect(sx, r, sw, 1); g.globalAlpha = 1;
  person(DOT.look, g, 20, 50, 4, Object.assign({point: true}, anim("D", t, true, k.phase)));
}

// a cook's head for the IN THE KITCHEN card (and Baldur's)
function portrait(c, cv){
  const x = cv.getContext("2d"); x.fillStyle = "#1d2350"; x.fillRect(0, 0, cv.width, cv.height);
  if (c === "baldur") { g = x; sprite(STAND.map(r => r.slice(18)), 0, 2, false, 0, 9); return; }
  person(c.look, x, 0, 0, 1, {headOnly: true});
}

window.PBC_KITCHEN = {W, H, RW, CAST, DOT, pairFor, kitchen, table, adBreak, portrait, hash, tint, BED_X};
})();
