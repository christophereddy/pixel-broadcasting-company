/* PBC Cooking: the two close-up scenes (tools/LOOK_BOOK.md, section 6). The kitchen (kitchen.js) is the wide shot; these
   are the cuts in, both seen from above, with the cook's hands coming in from the bottom of the picture.
   - counter(g, t, k)   the worktop: everything laid out for "You'll need", or the step being made, with each amount in its
                        measuring cups, spoons, jugs or on the scale, poured in one after another. A knife step cuts on the board,
                        whole pieces going over to the cut pile one by one; a blender step fills the blender; anything else is
                        mixed in a bowl. A fast-forward or time jump at the counter covers the bowl with a towel while it rests.
   - stove(g, t, k)     the cooktop: the pan or pot on its burner with everything that has gone in so far, the flame and the knob
                        set to the step's heat, bubbles, sizzle and steam to match, and the step's amounts poured in.
   Both only draw what the recipe says: the parts shown always add up to the amounts in the captions (PBC_FOOD.measure). */
(function(){
"use strict";
const W = 384, H = 216;
const F = PBC_FOOD, {mix} = PBC_PEOPLE;
let g = null;
function R(c, x, y, w, h){ g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
function ell(cx, cy, rx, ry, c){ for (let dy = -ry; dy <= ry; dy++) { const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / (ry + .5)) ** 2))); R(c, cx - hw, cy + dy, hw * 2 + 1, 1); } }
function ring(cx, cy, rx, ry, c){ for (let a = 0; a < 64; a++) { const t = a / 64 * Math.PI * 2; R(c, Math.round(cx + Math.cos(t) * rx), Math.round(cy + Math.sin(t) * ry), 1, 1); } }
const hash = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
// The picture the captions leave clear: below the show tag, above the lower third, left of the recipe card.
// The measures go in a column at its right.
const COL = [166, 240], TOPY = 40, BOT = 136;

/* ---------- the cook's hands, reaching in from the bottom ---------- */
function hand(c, x, y, grip){
  const kid = !!(c && c.look && c.look.kid), skin = c ? c.look.skin : "#e0ac80", coat = c ? c.look.coat : "#2b8fb3", w = kid ? 8 : 10;
  R(mix(coat, "#000000", .25), x - 1, y + w, w + 2, H - y - w); R(coat, x, y + w, w, H - y - w);
  R(c && c.apron ? c.apron : "#f4efe6", x, y + w, w, 2);
  R(mix(skin, "#000000", .2), x, y + 1, w, w); R(skin, x, y, w, w - 1);
  for (let i = 1; i < (kid ? 3 : 4); i++) R(mix(skin, "#000000", .18), x + i * (w / (kid ? 3 : 4)) | 0, y, 1, grip ? 3 : 2);
}
// a wooden handle from x, y running dx, dy, drawn as a solid line
function handle(x, y, dx, dy){ const n = Math.max(Math.abs(dx), Math.abs(dy)); for (let i = 0; i <= n; i++) { R("#8b5a2b", x + dx * i / n + 1, y + dy * i / n, 2, 2); R("#c08a52", x + dx * i / n, y + dy * i / n, 2, 2); } }
/* ---------- the measuring column ---------- */
// lays out each use's parts in the column; returns [{use, part, x, y}]
function layout(uses){
  const out = []; let x = COL[0], y = TOPY, rowH = 0;
  uses.forEach(u => F.measure(u).forEach(part => {
    if (x + part.w > COL[1] && x > COL[0]) { x = COL[0]; y += rowH + 4; rowH = 0; }
    out.push({use: u, part, x, y}); x += part.w + 4; rowH = Math.max(rowH, part.h);
  }));
  return out;
}
// when each use goes in: spread across the middle of the beat, in the recipe's order
const addAt = (i, n) => .12 + .62 * (i + 1) / (n + 1);
function pour(from, to, color, k){   // a short stream from a measure to the bowl
  const steps = 10; for (let i = 0; i < steps; i++) { const f = (i / steps + k) % 1; R(color, from[0] + (to[0] - from[0]) * f, from[1] + (to[1] - from[1]) * f, 2, 2); }
}
function measures(L, k, to){
  L.forEach(({use, part, x, y}) => {
    const i = k.uses.indexOf(use), at = addAt(i, k.uses.length), done = k.ff || k.phase >= at;
    F.drawMeasure(g, part, x, y, done ? 0 : 1, k.t);
    if (!k.ff && k.phase >= at && k.phase < at + .04 && to) pour([x + part.w / 2, y + 8], to, F.color(use.id), (k.t / 300) % 1);
  });
}

/* ---------- the counter ---------- */
function worktop(){
  R("#e3e7f0", 0, 0, W, H);
  for (let i = 0; i < 9; i++) { const y0 = 20 + i * 23; for (let x = 0; x < W; x += 3) R("#d5dae6", x, y0 + Math.round(Math.sin(x / 37 + i) * 5), 3, 1); }
  for (let x = 0; x < W; x += 8) R((x / 8) % 2 ? "#1b2250" : "#1d2660", x, 0, 7, 10);
  R("#b9bfd0", 0, 10, W, 2); R("#c9cdd8", 0, 12, W, 1);
}
function board(x, y, w, h){ R("#8b5a2b", x + 2, y + 2, w, h); R("#c08a52", x, y, w, h); for (let i = 6; i < h; i += 7) R("#b07a42", x + 4, y + i, w - 8, 1); R("#d8a468", x, y, w, 1); ell(x + w - 10, y + 8, 3, 2, "#8b5a2b"); }
function bowl(cx, cy, rx, ry){ ell(cx + 2, cy + 3, rx, ry, "#b9bfd0"); ell(cx, cy, rx, ry, "#f4f5fb"); ell(cx, cy + 1, rx - 4, ry - 4, "#c9cdd8"); ell(cx, cy, rx - 4, ry - 4, "#e3e7f0"); }
// food in a bowl or pan: each use gets its own patch, liquids spread over the whole bottom
// Food in a bowl or pan. Big pours (cups, cans) cover the bottom; a spoonful of oil, spice or sauce is a sheen or a dusting;
// pieces get a patch each in a bowl, and are stirred together over the whole pan.
const BIG = ["cup", "can", "lb", "oz"];
function contents(list, cx, cy, rx, ry, salt, mixed){
  // counted things that go in as they are (bacon slices, eggs, tortillas) are drawn one by one, exactly as many as the recipe says
  const units = list.filter(u => F.COUNT.includes(u.unit) && /^(whole|raw|toasted|cold|softened|sliced|sprig)$/.test(u.form) && u.qty <= 12);
  const flat = list.filter(u => !units.includes(u) && /liquid|paste|powder/.test(F.lookOf(u.id, u.form))), rest = list.filter(u => !flat.includes(u) && !units.includes(u));
  const base = flat.filter(u => BIG.includes(u.unit) || u.qty >= 4), dust = flat.filter(u => !base.includes(u));
  base.forEach((u, i) => { const k = 1 - i * .15; F.loose(g, u.id, u.form, Math.round(cx / 2), Math.round(cy / 2), Math.max(2, Math.round(rx / 2 * k)), Math.max(2, Math.round(ry / 2 * k)), 2, 1); });
  rest.forEach((u, i) => {
    if (mixed) { F.loose(g, u.id, u.form, Math.round(cx / 2), Math.round(cy / 2), Math.max(2, Math.round(rx / 2)), Math.max(2, Math.round(ry / 2)), 2, Math.min(1, 1.3 / rest.length)); return; }
    const h = hash(u.id + salt), a = (h % 360) / 57.3, d = rest.length > 1 ? .45 : 0;
    const px = cx + Math.cos(a) * rx * d, py = cy + Math.sin(a) * ry * d, s = rest.length > 1 ? .6 : 1;
    F.loose(g, u.id, u.form, Math.round(px / 2), Math.round(py / 2), Math.max(2, Math.round(rx / 2 * s)), Math.max(2, Math.round(ry / 2 * s)), 2, 1); });
  let ui = 0; const nU = units.reduce((a, u) => a + Math.ceil(u.qty), 0), s = nU <= 6 ? 2 : 1;
  const cols = s === 2 ? (nU <= 2 ? nU : nU <= 4 ? 2 : 3) : Math.min(4, Math.ceil(Math.sqrt(nU))), rows = Math.ceil(nU / cols), cell = s === 2 ? 28 : 15;
  const ox = cx - cols * cell / 2 - (s === 2 ? 2 : 0), oy = cy - rows * cell / 2 - (s === 2 ? 2 : 0);
  units.forEach(u => { for (let j = 0; j < Math.ceil(u.qty); j++, ui++) F.unit(g, u.id, u.unit, Math.round(ox + (ui % cols) * cell), Math.round(oy + Math.floor(ui / cols) * cell), s); });
  dust.forEach(u => { const c = F.color(u.id), liquid = F.lookOf(u.id, u.form) === "liquid", h = hash(u.id + salt);
    for (let i = 0; i < (liquid ? 10 : 40); i++) { const r1 = ((h >>> (i % 24)) % 97) / 97, a = i * 2.39996 + (h % 7), d = Math.sqrt((i + .5) / (liquid ? 10 : 40)) * .9;
      const x = cx + Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d;
      if (liquid) { g.globalAlpha = .45; R(c, x - 4, y - 1, 8 + r1 * 4, 2); g.globalAlpha = 1; } else R(c, x, y, 2, 2); } });
}
function towel(cx, cy, rx, ry){ for (let y = -ry; y <= ry; y += 4) for (let x = -rx; x <= rx; x += 4) if ((x / rx) ** 2 + (y / ry) ** 2 <= 1.05) R(((x + y) / 4) % 2 ? "#b8283e" : "#f4efe6", cx + x, cy + y, 4, 4); R("#8e1f30", cx - rx, cy + ry, rx * 2, 2); }

function needView(k){
  const list = k.need.slice(0, 15), n = list.length, cols = n <= 4 ? n : n <= 8 ? 4 : 5, rows = Math.ceil(n / cols);
  const cw = Math.floor((COL[1] - 8) / cols), ch = Math.min(48, Math.floor((BOT - TOPY) / rows)), br = Math.min(20, Math.floor(ch / 2) + 3);
  list.forEach((u, i) => {
    if (k.phase < .02 + .38 * i / n) return;   // set out one at a time
    const x = 8 + (i % cols) * cw, y = TOPY + Math.floor(i / cols) * ch, cx = x + cw / 2, cy = y + ch / 2 - 2;
    if (F.COUNT.includes(u.unit)) {
      const part = F.measure(u)[0];
      if (part.w <= cw - 2 && part.h <= ch + 4) { F.drawMeasure(g, part, Math.round(cx - part.w / 2), Math.round(cy - part.h / 2), 1, k.t); return; }
      F.unit(g, u.id, u.unit, Math.round(cx - 16), Math.round(cy - 16), 2);
      const s = "X" + Math.ceil(u.qty), w = s.length * 4 + 3; R("#1d2766", cx + 8, cy + 10, w, 7); PBC_ADS.pixText(g, s, Math.round(cx + 10), Math.round(cy + 11), false, "#ffffff", 1); return;
    }
    if (u.unit === "to-taste" || u.unit === "pinch") { F.item(g, u.id, Math.round(cx - 16), Math.round(cy - 16), 2); return; }
    if (u.unit === "lb" || u.unit === "oz") { ell(cx, cy + 4, 18, 12, "#c9cdd8"); ell(cx, cy + 3, 18, 12, "#f4f5fb"); F.item(g, u.id, Math.round(cx - 16), Math.round(cy - 14), 2); return; }
    bowl(cx, cy, br, Math.round(br * .72)); F.loose(g, u.id, u.form, Math.round(cx / 2), Math.round(cy / 2), Math.max(2, (br >> 1) - 3), Math.max(2, Math.round(br * .36) - 3), 2, 1);
  });
}
// a knife step: everything counted is cut on the board one piece at a time; the pile it goes into grows as it's cut
function knifeView(k){
  const bx = 8, by = 42, bw = 150, bh = 90; board(bx, by, bw, bh);
  const cut = k.uses.length ? k.uses : [], prog = k.ff ? 1 : Math.max(0, Math.min(1, (k.phase - .08) / .74)), seg = cut.length ? 1 / cut.length : 1;
  cut.forEach((u, i) => {
    const p = Math.max(0, Math.min(1, (prog - i * seg) / seg)), py = by + 12 + (i % 3) * 28, pile = [bx + 112 - (i % 2) * 8, py + 8];
    // the cut pile, on the right of the board
    if (p > 0) F.loose(g, u.id, u.form, Math.round(pile[0] / 2), Math.round(pile[1] / 2), 10, Math.max(3, 9 - cut.length * 2), 2, p);
    // the whole ones still waiting, on the left: exactly the count in the recipe until each is cut
    if (i === Math.min(cut.length - 1, Math.floor(prog / seg)) || p < 1) {
      if (F.COUNT.includes(u.unit)) { const n = Math.ceil(u.qty), left = p >= 1 ? 0 : n - Math.floor(p * n), s = n <= 4 && cut.length === 1 ? 2 : 1, cell = 16 * s;
        for (let j = 0; j < left; j++) F.unit(g, u.id, u.unit, bx + 6 + (j % 4) * (cell - 2), by + 6 + Math.floor(j / 4) * cell + (i * 30) * (s === 1 ? 1 : 0), s); }
      else if (p < .6) F.item(g, u.id, bx + 8, py - 6, 2);
    }
  });
  // the knife comes down on the pile being cut, held in the right hand; the left hand steadies the food
  const cur = Math.min(cut.length - 1, Math.floor(prog / seg)), ky = by + 16 + (Math.max(0, cur) % 3) * 28, up = !k.ff && prog < 1 && Math.floor(k.t / 140) % 2;
  R("#7a8090", bx + 70, ky + 1 - up * 3, 32, 3); R("#e3e7f0", bx + 70, ky - up * 3, 32, 3); R("#2a2f3a", bx + 102, ky - 1 - up * 3, 16, 5);
  hand(k.cook, bx + 108, ky + 2 - up * 3, true); hand(k.cook, bx + 40, ky + 6, false);
}
function blenderView(k){
  const cx = 82, cy = 88, r = 38;
  ell(cx + 3, cy + 4, r + 4, r + 4, "#9aa8b0"); ell(cx, cy, r + 4, r + 4, "#2a2f3a"); ell(cx, cy, r, r, "#d8ecf0"); ell(cx, cy, r - 3, r - 3, "#bfe8ff");
  // what goes in this step, or, for "blend until smooth", what the steps before put in
  const inn = k.uses.length ? k.uses.filter((u, i) => k.ff || k.phase >= addAt(i, k.uses.length)) : (k.carry || []), blend = k.ff || (k.phase > .8 && /blend/i.test(k.text || "")) || !k.uses.length && k.phase > .2;
  if (blend && inn.length) {
    const cols = inn.map(u => F.color(u.id)), avg = cols.reduce((a, c) => mix(a, c, .5), cols[0]), sp = k.t / 120;
    ell(cx, cy, r - 5, r - 5, avg); for (let i = 0; i < 24; i++) { const a = sp + i * .26, d = (i % 5 + 1) / 6 * (r - 8); R(mix(avg, "#ffffff", .25), cx + Math.cos(a) * d, cy + Math.sin(a) * d, 3, 2); }
  } else contents(inn, cx, cy, r - 6, r - 6, "blend");
  R("#7a8090", cx - 2, cy - 12, 4, 24); R("#7a8090", cx - 12, cy - 2, 24, 4); ell(cx, cy, 4, 4, "#2a2f3a");
  hand(k.cook, cx + r - 4, cy + 8, true);
  measures(layout(k.uses), k, [cx, cy]);
}
function plate(cx, cy, rx, ry){ ell(cx + 2, cy + 3, rx, ry, "#b9bfd0"); ell(cx, cy, rx, ry, "#f4f5fb"); ring(cx, cy, rx - 5, ry - 4, "#e3e7f0"); }
function bowlView(k){
  const cx = 82, cy = 90, rx = 62, ry = 44, flat = k.how === "assemble";
  (flat ? plate : bowl)(cx, cy, rx, ry);
  const inn = k.uses.filter((u, i) => k.ff || k.phase >= addAt(i, k.uses.length));
  contents(inn.length ? inn : (k.carry || []), cx, cy, rx - 10, ry - 10, "bowl");
  if (k.ff) { towel(cx, cy, rx - 2, ry - 2); return; }
  measures(layout(k.uses), k, [cx, cy]);
  // a whisk or spoon going round once things are in
  const a = k.t / 380, sx = cx + Math.cos(a) * (rx - 26), sy = cy + Math.sin(a) * (ry - 22);
  if (inn.length && k.how === "mix") { R("#8b5a2b", sx - 3, sy - 3, 6, 6); R("#c08a52", sx - 2, sy - 2, 4, 4); handle(sx + 2, sy + 2, 26, 36); hand(k.cook, sx + 24, sy + 34, true); }
}
const CUT = /\b(cut|slice|dice|chop|mince|halve|quarter|shred|grate|peel|trim|crush|zest|core|seed|break)/i;
const MIX = /\b(whisk|stir|mix|combine|beat|fold|toss|mash|knead|cream|blend|season|squeeze)/i;
const PUT = /\b(layer|spread|top|fill|wrap|roll|line|place|arrange|assemble|stack|sprinkle|serve|spoon|brush|lay|dip|thread|press|shape|form)/i;
function counter(ctx, t, k){
  g = ctx; k.t = t; worktop();
  if (k.kind === "need") { needView(k); return; }
  // what kind of work it is comes from the step's tool and its verb: cutting, blending, mixing, or putting things together
  const txt = k.text || "";
  if (k.tool === "blender" || /\bblend/i.test(txt) || /\bin(to)? the blender/i.test(txt)) { blenderView(k); return; }
  // the step's first verb decides: "Layer the lettuce... and cut in half" is putting a sandwich together, not cutting
  const first = re => { const m = re.exec(txt); return m ? m.index : 1e9; }, c = first(CUT), m = first(MIX), p = first(PUT);
  if (k.tool === "knife" && c < m && c < p) { knifeView(k); measures(layout(k.uses.filter(u => !F.COUNT.includes(u.unit))), k, null); return; }
  k.how = m < p ? "mix" : p < 1e9 || F.COUNT.includes((k.uses[0] || {}).unit) ? "assemble" : "mix";
  bowlView(k);
}

/* ---------- the stove ---------- */
const LEVEL = {low: 1, "medium-low": 2, medium: 3, "medium-high": 4, high: 5};
function cooktop(lvl, t){
  R("#c9ccd6", 0, 0, W, H); R("#2a2f3a", 6, 16, W - 12, H - 22); R("#3a404e", 6, 16, W - 12, 1);
  // the control strip along the back, the front-left knob set to the heat
  R("#aeb3c2", 0, 0, W, 14); R("#9aa8b0", 0, 13, W, 1);
  [40, 70, 300, 330].forEach((x, i) => { ell(x, 7, 5, 5, "#2a2f3a"); ell(x, 6, 4, 4, "#5a6070"); const a = -Math.PI / 2 + (i === 0 ? lvl * .55 : 0); R(i === 0 && lvl ? "#f2b632" : "#c9ccd6", x + Math.round(Math.cos(a) * 3), 6 + Math.round(Math.sin(a) * 3), 2, 2); });
  // the other burners' grates, cold
  [[230, 54], [40, 46], [230, 140]].forEach(([x, y]) => { ring(x, y, 24, 20, "#15151c"); ring(x, y, 12, 10, "#15151c"); R("#15151c", x - 26, y, 52, 2); R("#15151c", x, y - 22, 2, 44); });
}
function flames(cx, cy, rx, ry, lvl, t){
  if (!lvl) return;
  const n = 14 + lvl * 4;
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, f = (Math.floor(t / 110) + i) % 3, L = lvl + f;
    for (let j = 0; j < L; j++) R(j < L / 2 ? "#5fb4ff" : "#ff9a3a", Math.round(cx + Math.cos(a) * (rx + 2 + j)), Math.round(cy + Math.sin(a) * (ry + 2 + j)), 2, 2); }
}
function stove(ctx, t, k){
  g = ctx; k.t = t;
  const lvl = LEVEL[k.heat] || 0, cx = 88, cy = 92;
  cooktop(lvl, t);
  const list = k.pan || [], wet = k.pot;
  const rx = wet ? 50 : 56, ry = wet ? 44 : 46;
  flames(cx, cy, rx, ry, lvl, t);
  if (wet) {
    // a pot: steel rim, handles each side, and the liquid inside
    R("#7a8090", cx - rx - 12, cy - 4, 14, 8); R("#7a8090", cx + rx - 2, cy - 4, 14, 8);
    ell(cx + 2, cy + 3, rx, ry, "#5a6070"); ell(cx, cy, rx, ry, "#c9ccd6"); ell(cx, cy, rx - 4, ry - 4, "#7a8090"); ell(cx, cy + 2, rx - 6, ry - 6, "#9aa8b0");
    if (!list.some(u => F.lookOf(u.id, u.form) === "liquid")) ell(cx, cy + 2, rx - 7, ry - 7, "#8fd3ff");
  } else {
    // a skillet: dark pan, long handle off to the left
    R("#15151c", 0, cy - 6, cx - rx + 4, 12); R("#2a2f3a", 0, cy - 5, cx - rx + 4, 4);
    ell(cx + 2, cy + 3, rx, ry, "#15151c"); ell(cx, cy, rx, ry, "#3a404e"); ell(cx, cy, rx - 4, ry - 4, "#22262f"); ell(cx - 10, cy - 10, 18, 12, "#2a2f3a");
  }
  // what's in it: what earlier steps put in, plus this step's amounts as they go in
  const added = (k.uses || []).filter((u, i) => k.ff || k.phase >= addAt(i, k.uses.length));
  contents(list.concat(added), cx, cy + (wet ? 2 : 0), rx - (wet ? 10 : 8), ry - (wet ? 10 : 8), "pan", true);
  // food in a hot pan browns as the step goes on
  if (!wet && lvl && list.concat(added).length) { g.globalAlpha = Math.min(.3, .08 + (k.ff ? 1 : k.phase) * .2); ell(cx, cy, rx - 6, ry - 6, "#6b3a1c"); g.globalAlpha = 1; }
  // bubbles in a pot, sizzle in a pan, steam off both: more the higher the heat
  const q = n => { let s = n * 9301 + 49297; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); };
  if (lvl) {
    const life = 900, n = lvl * (wet ? 5 : 7);
    for (let i = 0; i < n; i++) { const ph = ((t + i * 377) % life) / life, r = q(i + Math.floor((t + i * 377) / life) * 31), a = r() * 6.28, d = Math.sqrt(r()) * .8;
      const x = cx + Math.cos(a) * (rx - 12) * d, y = cy + Math.sin(a) * (ry - 12) * d;
      if (wet) { const s = 1 + Math.round(ph * 2); ring(x, y, s, s, "#e8f6fa"); }
      else if (ph < .4) { R("#ffffff", x, y, 1, 1); R("#fff2c0", x + 2, y - 1, 1, 1); } }
    g.globalAlpha = .35;
    for (let i = 0; i < lvl + 1; i++) { const ph = ((t / 2200) + i / (lvl + 1)) % 1, x = cx - 30 + i * 18 + Math.sin(t / 500 + i) * 4, y = cy - ph * 70;
      ell(Math.round(x), Math.round(y), 5 + Math.round(ph * 4), 3 + Math.round(ph * 2), "#f4f5fb"); }
    g.globalAlpha = 1;
  }
  measures(layout(k.uses || []), k, [cx, cy]);
  // the spoon or spatula going round, held from the front
  const a = Math.PI / 2 + Math.sin(t / 700) * .9, sx = cx + Math.cos(a) * (rx - 26) * .6, sy = cy + Math.sin(a) * (ry - 20) * .6;
  R("#8b5a2b", sx - 4, sy - 3, 8, 6); R("#c08a52", sx - 3, sy - 3, 6, 5);
  handle(sx + 1, sy + 2, 20, 38);
  hand(k.cook, sx + 16, sy + 36, true);
}

window.PBC_SCENES = {counter, stove};
})();
