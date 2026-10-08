/* PBC Cooking: the finished dishes on the table (tools/LOOK_BOOK.md, section 6). Each dish is built from parts instead of
   drawn one by one: a vessel (plate, bowl, glass, mug, board, platter, baking dish, dessert cup) and a kind of food on it
   (a soup, a mound, a sandwich, a stack, a slice...), colored by the recipe's own main ingredients (PBC_FOOD.color).
   - plating(recipe)          what a recipe looks like served: {kind, vessel, base, cols, garnish}. The kind comes from the
                              recipe's name (KINDS, first match wins), or failing that its role, so a new recipe plates
                              itself; a recipe can set "plate": {"kind": ..., "vessel": ...} to choose instead.
   - draw(g, cx, by, p, t)    draws plating p with its bottom center at cx, by, two screen pixels to an art pixel
   Drawn from the front and a little above, like the table it sits on. */
(function(root){
"use strict";
const F = root.PBC_FOOD;
function mix(a, b, k){ const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), x = p(a), y = p(b);
  return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, "0")).join(""); }
const dk = (c, k) => mix(c, "#000000", k === undefined ? .25 : k), lt = (c, k) => mix(c, "#ffffff", k === undefined ? .35 : k);

/* ---------- what a recipe looks like served ---------- */
// name pattern -> [kind, vessel]
const KINDS = [
  [/smoothie|lassi|shake/i, "drink", "glass"], [/coffee|olla|cider|cocoa|tea\b|latte/i, "hot", "mug"],
  [/soup|chili|stew|chowder|broth/i, "soup", "bowl"], [/masala|curry|dal\b/i, "curry", "bowl"], [/bibimbap|rice bowl|poke/i, "sections", "bowl"],
  [/fruit salad/i, "pieces", "bowl"], [/salad/i, "salad", "bowl"], [/guacamole|tzatziki|salsa|hummus|dip|sauce/i, "dip", "small"],
  [/pizza/i, "pizza", "board"], [/pancake/i, "stack", "plate"], [/cr[eê]pe/i, "crepes", "plate"],
  [/taco/i, "tacos", "plate"], [/pita|gyro|souvlaki|wrap\b/i, "pita", "plate"], [/pinwheel/i, "pinwheels", "plate"], [/onigiri|sushi/i, "onigiri", "plate"],
  [/croutons/i, "pieces", "bowl"], [/garlic bread/i, "toast", "board"], [/chilaquiles|nachos/i, "nachos", "plate"],
  [/scrambled|eggs on toast/i, "eggtoast", "plate"], [/toast/i, "toast", "plate"], [/sandwich|blt|croque|grilled cheese\b|burger|melt/i, "sandwich", "plate"],
  [/cookie|biscuit/i, "cookies", "plate"], [/muffin|cupcake/i, "muffins", "plate"], [/cornbread|brownie|bar(s)?\b/i, "squares", "plate"],
  [/crumble|cobbler|crisp\b/i, "crumble", "dish"], [/pie|tart|cake|cheesecake/i, "slice", "plate"],
  [/mousse|pudding|parfait|yogurt/i, "cup", "cup"], [/caramel apple|candy apple/i, "apples", "plate"], [/ants on a log/i, "logs", "plate"],
  [/hot dog/i, "hotdogs", "plate"], [/roast chicken|whole chicken/i, "roast", "platter"], [/turkey breast|roast beef|roast pork/i, "carved", "platter"],
  [/steak|chop/i, "steak", "plate"], [/spaghetti|pasta|mac and cheese|noodle|linguine|penne/i, "pasta", "bowl"],
  [/mashed|rice|risotto|polenta/i, "mound", "bowl"], [/potato|broccoli|beans|stuffing|vegetable|carrot/i, "pieces", "bowl"]
];
const ROLE_KIND = {drink: ["drink", "glass"], dessert: ["slice", "plate"], sauce: ["dip", "small"], side: ["pieces", "bowl"],
  starter: ["salad", "bowl"], snack: ["pieces", "plate"], breakfast: ["toast", "plate"], main: ["pieces", "plate"]};
// the ingredients that give a dish its look: not spices, oils, leaveners or water
const QUIET = /salt|pepper$|oil|vinegar|water|baking|yeast|vanilla|sugar|flour|cornstarch|soda|bay-leaf|ice$/;
const SOUP_BASE = ["canned-tomatoes", "tomato-paste", "pumpkin-puree", "butternut-squash", "gochujang", "miso", "dashi", "chicken-stock",
  "beef-stock", "vegetable-stock", "cream", "milk", "apple-cider", "ground-coffee"];
function plating(r){
  const name = r.name + " " + (r.slug || ""), hit = KINDS.find(([re]) => re.test(name)) || [null].concat(ROLE_KIND[r.role] || ROLE_KIND.main);
  const ids = (r.ingredients || []).map(i => i.id), key = ids.filter(id => !QUIET.test(id) && F.spec(id).fill !== "powder" || /cocoa|chocolate|cinnamon/.test(id));
  const cols = key.map(id => F.color(id)), herb = ids.find(id => F.spec(id).shape === "sprig" || F.spec(id).shape === "needle" || id === "chives" || id === "green-onion");
  const baseId = SOUP_BASE.find(id => ids.includes(id)) || key[0], p = Object.assign({kind: hit[1], vessel: hit[2]}, r.plate || {});
  p.base = baseId ? F.color(baseId) : "#c9ccd6";
  if (p.kind === "soup" && ids.includes("ground-beef")) p.base = mix(p.base, "#6b3a22", .35);
  // a smoothie is the color of its fruit and greens, paler for the milk or yogurt in it
  if (p.kind === "drink") { const fruit = key.filter(id => !/milk|yogurt|cream|honey|ice/.test(id)).map(id => F.color(id)), cream = key.some(id => /milk|yogurt|cream/.test(id));
    p.base = fruit.length ? fruit.reduce((a, c) => mix(a, c, .5)) : "#f4f5fb"; if (cream) p.base = mix(p.base, "#f8f6f0", .3); }
  const firstOf = (...want) => want.find(id => ids.includes(id));
  if (p.kind === "mound") p.cols = [F.spec(firstOf("rice", "brown-rice", "sushi-rice", "potatoes", "sweet-potato", "cornmeal") || key[0] || "rice").f].concat(cols.slice(1));
  if (p.kind === "squares") p.cols = [firstOf("cornmeal") ? "#f2c860" : firstOf("cocoa", "dark-chocolate") ? "#5a3020" : "#e0b870"];
  if (p.kind === "cup" && (ids.includes("dark-chocolate") || ids.includes("cocoa"))) p.cols = ["#5a3020"].concat(cols);
  p.cols = cols.length ? cols : ["#c9ccd6"]; p.ids = key; p.garnish = herb ? F.color(herb) : null;
  p.has = id => ids.includes(id);
  return p;
}

/* ---------- drawing, in art pixels from the dish's bottom center ---------- */
let g = null, OX = 0, OY = 0;
const S = 2;
function P(c, x, y, w, h){ g.fillStyle = c; g.fillRect(Math.round(OX + x * S), Math.round(OY + y * S), Math.round(w * S), Math.round(h * S)); }
function ell(cx, cy, rx, ry, c){ for (let dy = -ry; dy <= ry; dy++) { const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / (ry + .5)) ** 2))); P(c, cx - hw, cy + dy, hw * 2 + 1, 1); } }
function dots(cx, cy, rx, ry, cols, n, seed, w){ let s = seed; const q = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < n; i++) { const a = q() * 6.283, d = Math.sqrt(q()); P(cols[i % cols.length], Math.round(cx + Math.cos(a) * rx * d), Math.round(cy + Math.sin(a) * ry * d), w || 1, 1); } }
const hash = s => { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) % 233280; return h; };

// vessels: each returns the y of the surface food sits on, and its half width there
const VESSEL = {
  plate(){ ell(0, -2, 19, 4, "#b9bfd0"); ell(0, -3, 19, 4, "#f4f5fb"); ell(0, -3, 14, 3, "#e3e7f0"); return [-4, 14]; },
  platter(){ ell(0, -2, 21, 5, "#b9bfd0"); ell(0, -3, 21, 5, "#f4f5fb"); ell(0, -3, 17, 4, "#e3e7f0"); P("#2b8fb3", -21, -3, 1, 1); P("#2b8fb3", 20, -3, 1, 1); return [-4, 17]; },
  board(){ P("#8b5a2b", -18, -3, 36, 3); ell(0, -4, 18, 4, "#c08a52"); P("#c08a52", 18, -5, 5, 2); ell(23, -4, 1, 1, "#8b5a2b"); return [-5, 15]; },
  bowl(){ ell(0, -1, 8, 1, "#b9bfd0"); for (let y = -9; y <= 0; y++) { const w = Math.round(15 - (y + 9) ** 2 / 9); P(y > -3 ? "#c9cdd8" : "#f4f5fb", -w, y, w * 2 + 1, 1); }
    P("#2b8fb3", -14, -7, 29, 1); ell(0, -10, 15, 3, "#e3e7f0"); ell(0, -10, 13, 2, "#c9cdd8"); return [-10, 13]; },
  small(){ for (let y = -6; y <= 0; y++) { const w = Math.round(10 - (y + 6) ** 2 / 9); P(y > -2 ? "#c9cdd8" : "#f4f5fb", -w, y, w * 2 + 1, 1); } ell(0, -7, 10, 2, "#e3e7f0"); ell(0, -7, 8, 1, "#c9cdd8"); return [-7, 8]; },
  glass(){ P("#9fd6ee", -6, -22, 12, 22); P("#d8ecf0", -5, -22, 10, 21); ell(0, -22, 6, 1, "#e8f6fa"); return [-20, 5]; },
  mug(){ P("#b9bfd0", -7, -14, 14, 14); P("#f4f5fb", -7, -14, 13, 14); P("#b8283e", -7, -9, 14, 3); P("#f4f5fb", 7, -11, 4, 2); P("#f4f5fb", 9, -9, 2, 5); P("#f4f5fb", 7, -5, 4, 2);
    ell(0, -14, 7, 1, "#e3e7f0"); return [-14, 6]; },
  dish(){ P("#9aa8b0", -18, -9, 36, 9); P("#c9ccd6", -18, -9, 36, 2); P("#e3e7f0", -20, -8, 2, 3); P("#e3e7f0", 18, -8, 2, 3); return [-9, 16]; },
  cup(){ P("#9fd6ee", -6, -16, 12, 13); P("#d8ecf0", -5, -16, 10, 12); P("#d8ecf0", -1, -3, 2, 3); ell(0, -1, 5, 1, "#d8ecf0"); ell(0, -16, 6, 1, "#e8f6fa"); return [-15, 5]; }
};
const BREAD = p => F.color(["sourdough", "bread", "baguette", "english-muffin", "bagel", "tortilla", "pita"].find(id => p.has(id)) || "bread");
const FOOD = {
  soup(p, y, w, t){ ell(0, y, w, 2, p.base); dots(0, y, w - 2, 1, p.cols.slice(1, 4).concat(p.cols.slice(1, 4)).filter(Boolean), 14, hash(p.base), 2);
    if (p.garnish) dots(0, y - 1, 4, 1, [p.garnish], 5, 3); if (p.has("sour-cream")) ell(2, y - 1, 2, 1, "#f8f6f0"); if (p.has("cheddar")) dots(-2, y - 1, 3, 1, ["#f2a33a"], 6, 9); },
  curry(p, y, w){ ell(-4, y - 1, 8, 2, "#f8f8f4"); dots(-4, y - 1, 7, 2, ["#e3e7f0"], 10, 4); ell(5, y, 7, 2, p.base === "#c9ccd6" ? "#c8803a" : mix(p.base, "#d8862a", .5)); dots(5, y, 6, 1, [p.cols[0]], 6, 2, 2); if (p.garnish) dots(5, y - 1, 4, 1, [p.garnish], 4, 6); },
  sections(p, y, w){ ell(0, y, w, 2, "#f8f8f4"); const c = p.cols.slice(0, 5); c.forEach((col, i) => { const a = i / c.length * 6.283; ell(Math.round(Math.cos(a) * 7), y + Math.round(Math.sin(a) * 1), 3, 1, col); });
    ell(0, y - 1, 3, 1, "#f8f8f4"); ell(0, y - 1, 1, 0, "#f6c744"); },
  salad(p, y, w){ ell(0, y - 1, w - 1, 3, "#5fbf6f"); dots(0, y - 1, w - 2, 2, ["#8fd36a", "#3f8f3a", "#c8eca0"], 40, 5, 2); dots(0, y - 2, w - 4, 2, p.cols.slice(1, 5), 14, 11, 2); },
  pieces(p, y, w){ for (let i = 0; i < 18; i++) { const a = i * 2.4, d = Math.sqrt(i / 18), x = Math.round(Math.cos(a) * (w - 3) * d), yy = Math.round(y - 2 + Math.sin(a) * 2 * d - (1 - d) * 2);
      const c = p.cols[i % Math.min(3, p.cols.length)]; P(dk(c, .2), x, yy + 1, 3, 1); P(c, x, yy, 3, 2); } if (p.garnish) dots(0, y - 3, 6, 2, [p.garnish], 6, 8); },
  mound(p, y, w){ ell(0, y - 3, w - 3, 4, p.cols[0]); ell(-2, y - 4, w - 6, 2, lt(p.cols[0], .2)); if (p.has("butter")) P("#f6e08a", -1, y - 7, 3, 2); if (p.garnish) dots(0, y - 5, 4, 1, [p.garnish], 5, 2); },
  pasta(p, y, w){ const sauce = p.has("canned-tomatoes") || p.has("tomato-paste") ? "#c8382e" : p.has("cheddar") ? "#f2a33a" : null, noodle = "#f2d27a";
    ell(0, y - 2, w - 2, 3, noodle); for (let i = -w + 3; i < w - 3; i += 3) P(dk(noodle, .15), i, y - 3 + (i % 2), 2, 1);
    if (sauce) ell(0, y - 3, w - 6, 2, sauce); if (p.has("ground-beef")) [[-4, -4], [3, -4], [0, -6]].forEach(([x, yy]) => { ell(x, y + yy, 2, 1, "#7a3a2a"); P("#9a5a3a", x - 1, y + yy - 1, 1, 1); });
    if (p.has("lemon")) P("#f6e27a", 5, y - 5, 2, 1); if (p.has("parmesan")) dots(0, y - 4, 5, 1, ["#f6ecc0"], 8, 7); if (p.garnish) dots(0, y - 4, 4, 1, [p.garnish], 5, 3); },
  sandwich(p, y){ const b = BREAD(p), fill = p.cols.filter(c => c !== b).slice(0, 3);
    [[-7, 0], [6, 1]].forEach(([x, k]) => { const yy = y - 1; P(dk(b, .3), x - 6, yy - 2, 12, 2); P(b, x - 6, yy - 3, 12, 1);
      fill.forEach((c, i) => P(c, x - 6, yy - 4 - i, 12, 1)); P(dk(b, .3), x - 6, yy - 6 - fill.length + 3, 12, 1); P(b, x - 6, yy - 8 - fill.length + 3, 12, 2); P(lt(b, .3), x - 5, yy - 8 - fill.length + 3, 4, 1); }); },
  toast(p, y){ const b = BREAD(p); [[-6, 0], [5, -1]].forEach(([x, dy]) => { P(dk(b, .35), x - 5, y - 3 + dy, 10, 3); P(lt(b, .2), x - 4, y - 3 + dy, 8, 2);
      p.cols.filter(c => c !== b).slice(0, 2).forEach((c, i) => P(c, x - 3 + i * 3, y - 4 + dy, 3, 1)); }); },
  eggtoast(p, y){ FOOD.toast(p, y); [[-6, 0], [5, -1]].forEach(([x, dy]) => { ell(x, y - 4 + dy, 3, 1, "#f6d860"); P("#f8e890", x - 1, y - 5 + dy, 2, 1); }); if (p.garnish) dots(0, y - 5, 6, 1, [p.garnish], 4, 2); },
  tacos(p, y){ const tor = F.color(p.has("corn-tortilla") ? "corn-tortilla" : "tortilla"); [-9, 0, 9].forEach(x => { for (let r = 0; r < 5; r++) P(tor, x - 4 + Math.floor(r / 2), y - 2 - r, 9 - r, 1);
      dots(x, y - 6, 3, 1, p.cols.filter(c => c !== tor).slice(0, 3), 6, x + 20, 1); }); },
  pita(p, y){ const b = BREAD(p); [-6, 6].forEach(x => { for (let r = 0; r < 8; r++) P(b, x - 4 + Math.floor(r / 3), y - 2 - r, 9 - Math.floor(r / 3) * 2, 1); dots(x, y - 9, 3, 1, p.cols.filter(c => c !== b).slice(0, 3), 7, x + 30, 2); }); },
  pinwheels(p, y){ const b = BREAD(p); [-9, -3, 3, 9].forEach(x => { ell(x, y - 3, 3, 2, b); ell(x, y - 3, 2, 1, p.cols[1] || "#f0a0a8"); P(p.cols[2] || "#f6e08a", x, y - 3, 1, 1); }); },
  onigiri(p, y){ [-6, 6].forEach(x => { for (let r = 0; r < 8; r++) P("#f8f8f4", x - r, y - 2 - (7 - r), r * 2 + 1, 1); P("#1e3a2a", x - 3, y - 4, 7, 3); }); },
  nachos(p, y, w){ for (let i = 0; i < 16; i++) { const a = i * 2.4, d = Math.sqrt(i / 16), x = Math.round(Math.cos(a) * (w - 4) * d), yy = Math.round(y - 2 + Math.sin(a) * 2 * d);
      for (let r = 0; r < 3; r++) P(i % 2 ? "#f2d27a" : "#e8c060", x - 1 + Math.floor(r / 2), yy - r, 4 - r, 1); }
    ell(0, y - 3, w - 6, 2, "#c83a2a"); dots(0, y - 4, w - 6, 1, ["#f8f6ee", "#f4efe6"], 10, 3, 2); if (p.has("egg")) { ell(4, y - 5, 2, 1, "#f8f8f4"); P("#f6c744", 4, y - 5, 1, 1); } if (p.garnish) dots(0, y - 4, 6, 1, [p.garnish], 5, 7); },
  pizza(p, y){ ell(0, y, 15, 3, "#d8963a"); ell(0, y - 1, 13, 2, "#c8382e"); ell(0, y - 1, 12, 2, "#f6f2e4"); dots(0, y - 1, 11, 2, p.cols.filter(c => !/f6f2e4|c8382e/.test(c)).slice(0, 3).concat(["#b83a34"]), 14, 5, 2);
    P("#b07a42", -1, y - 3, 1, 5); P("#b07a42", -12, y - 1, 24, 1); },
  stack(p, y){ for (let i = 0; i < 4; i++) { ell(0, y - 1 - i * 2, 10, 2, "#c8843a"); ell(0, y - 2 - i * 2, 10, 2, "#e8b060"); } P("#f6e08a", -2, y - 11, 4, 2); P("#a85a20", -6, y - 9, 12, 1); P("#a85a20", 6, y - 9, 1, 4);
    if (p.has("strawberries") || p.has("blueberries")) dots(9, y - 2, 4, 1, ["#e5383b", "#3a4a9a"], 5, 4, 2); },
  crepes(p, y){ [-6, 5].forEach(x => { for (let r = 0; r < 6; r++) P(r % 2 ? "#f2d27a" : "#f6e09a", x - 6 + r, y - 2 - r, 12 - r * 2, 1); }); dots(0, y - 6, 10, 2, ["#ffffff"], 18, 3); if (p.has("strawberries")) dots(0, y - 3, 8, 1, ["#e5383b"], 4, 6, 2); },
  cookies(p, y){ [[-9, 0], [0, -1], [9, 0], [-4, -4], [5, -4]].forEach(([x, dy], i) => { ell(x, y - 2 + dy, 4, 1, "#c8843a"); ell(x, y - 3 + dy, 4, 1, "#e0a860"); dots(x, y - 3 + dy, 3, 1, ["#4a2a18"], 4, i + 2); }); },
  muffins(p, y){ [-9, 0, 9].forEach(x => { P("#e5607f", x - 3, y - 4, 7, 4); for (let i = 0; i < 7; i += 2) P("#c2417a", x - 3 + i, y - 4, 1, 4); ell(x, y - 6, 4, 2, "#c8843a"); P("#e0a860", x - 2, y - 8, 3, 1); dots(x, y - 6, 3, 1, p.cols.slice(0, 2), 3, x + 9); }); },
  squares(p, y){ [-7, 4].forEach((x, i) => { P(dk(p.cols[0], .2), x - 5, y - 6 - i, 10, 5); P(p.cols[0], x - 5, y - 7 - i, 10, 2); P(lt(p.cols[0], .25), x - 4, y - 7 - i, 4, 1); }); if (p.has("butter")) P("#f6e08a", -4, y - 9, 3, 2); },
  crumble(p, y){ P(p.cols[0], -16, y - 1, 32, 2); dots(0, y - 2, 15, 1, ["#c8843a", "#e0a860", "#b8783a"], 50, 3, 2); },
  slice(p, y){ const crust = p.has("pie-crust") ? "#d8b878" : "#e0b870", fill = p.base, top = p.has("pumpkin-puree") ? dk(fill, .1) : lt(fill, .25);
    for (let r = 0; r < 7; r++) { const w = 4 + r * 2; P(r < 5 ? fill : crust, -8 + (7 - r), y - 2 - (6 - r), w, 1); } P(crust, -8, y - 2, 16, 2); P(top, -1, y - 9, 2, 1);
    if (p.has("cream") || p.has("ricotta")) ell(4, y - 7, 2, 1, "#ffffff"); if (p.has("lemon")) P("#f6e27a", -4, y - 6, 2, 1); if (p.has("powdered-sugar")) dots(0, y - 6, 5, 2, ["#ffffff"], 8, 4); },
  cup(p, y){ const c = p.cols[0]; P(dk(c, .1), -5, y + 2, 10, 10); P(c, -5, y - 1, 10, 3); P(lt(c, .3), -5, y - 2, 10, 1); if (p.has("cream")) ell(0, y - 3, 3, 1, "#ffffff"); if (p.has("honey")) P("#f2a020", -3, y - 2, 6, 1);
    if (p.has("walnuts")) dots(0, y - 3, 3, 1, ["#c8904a"], 4, 2, 2); if (p.has("dark-chocolate")) P("#3a2010", -1, y - 4, 2, 1); },
  drink(p, y){ P(p.base, -5, y, 10, 18); P(lt(p.base, .3), -5, y, 10, 1); P("#e5607f", 2, y - 8, 1, 10); P("#e5607f", 2, y - 8, 4, 1); },
  hot(p, y, w, t){ ell(0, y, w, 1, p.base); P(lt(p.base, .3), -3, y, 3, 1); if (p.has("cinnamon")) P("#a5603a", 6, y - 4, 1, 5);
    const f = Math.floor((t || 0) / 300) % 3; [[-3, 0], [1, 1], [4, 2]].forEach(([x, k]) => P("#e3e7f0", x + ((f + k) % 2), y - 3 - ((f + k) % 3) * 2, 1, 2)); },
  dip(p, y, w){ ell(0, y, w, 1, p.base); P(lt(p.base, .25), -3, y, 4, 1); if (p.garnish) dots(0, y, 4, 1, [p.garnish], 3, 4);
    if (p.has("tortilla-chips")) [[-14, 2], [13, 2], [-12, -1], [11, -1]].forEach(([x, dy]) => { for (let r = 0; r < 4; r++) P("#f2d27a", x - 2 + Math.floor(r / 2), y + 5 + dy - r, 5 - r, 1); }); },
  apples(p, y){ [-7, 7].forEach(x => { ell(x, y - 4, 5, 4, "#d8343c"); ell(x, y - 7, 5, 2, "#c88a3a"); P("#c88a3a", x - 5, y - 6, 10, 2); P("#e8d6a8", x, y - 14, 1, 6); P(lt("#d8343c", .4), x - 3, y - 3, 1, 1); }); },
  logs(p, y){ [-8, 0, 8].forEach(x => { P("#7ab84a", x - 3, y - 3, 6, 2); P("#9ad86a", x - 3, y - 5, 6, 2); P("#c8843a", x - 2, y - 6, 4, 1); [-2, 0, 2].forEach(d => P("#4a2230", x + d, y - 7, 1, 1)); }); },
  hotdogs(p, y){ [-8, 0, 8].forEach(x => { P("#d0604a", x - 2, y - 9, 4, 8); for (let i = 0; i < 4; i++) P("#f4e4b8", x - 3, y - 8 + i * 2, 6, 1); P("#ffffff", x - 1, y - 9, 1, 1); P("#ffffff", x + 1, y - 9, 1, 1); P("#15151c", x - 1, y - 9, 1, 1); }); },
  roast(p, y){ ell(0, y - 5, 11, 5, "#c8803a"); ell(-2, y - 7, 8, 3, "#d8963a"); ell(-12, y - 2, 3, 2, "#c8803a"); ell(12, y - 2, 3, 2, "#c8803a"); P("#f4efe6", -15, y - 3, 2, 1); P("#f4efe6", 14, y - 3, 2, 1);
    P(lt("#d8963a", .3), -4, y - 9, 5, 1); if (p.has("lemon")) [[-15, 0], [14, 0]].forEach(([x]) => ell(x, y - 1, 2, 1, "#f6e27a")); if (p.garnish) dots(0, y - 1, 15, 1, [p.garnish], 8, 3, 2); },
  carved(p, y){ ell(-6, y - 4, 7, 4, "#c8803a"); P(lt("#c8803a", .2), -10, y - 7, 6, 1); [2, 6, 10].forEach((x, i) => { P("#e8c8a8", x, y - 7 + i, 3, 6); P("#c8803a", x, y - 7 + i, 3, 1); }); if (p.garnish) dots(0, y - 1, 14, 1, [p.garnish], 6, 4, 2); },
  steak(p, y){ ell(-1, y - 3, 9, 3, "#7a3a2a"); ell(-1, y - 4, 8, 2, "#9a4a32"); for (let x = -6; x < 6; x += 3) P("#3a1a10", x, y - 5, 1, 3); P("#f6e08a", 2, y - 7, 3, 2); if (p.garnish) dots(9, y - 2, 3, 1, [p.garnish], 4, 2); }
};
function draw(ctx, cx, by, p, t){
  g = ctx; OX = cx; OY = by;
  const [y, w] = (VESSEL[p.vessel] || VESSEL.plate)();
  (FOOD[p.kind] || FOOD.pieces)(p, y, w, t);
  // a glass or cup is drawn again over its contents, so the drink sits inside it
  if (p.vessel === "glass") { g.globalAlpha = .35; P("#d8ecf0", -6, -22, 12, 22); g.globalAlpha = 1; P("#e8f6fa", -5, -21, 1, 18); }
  if (p.vessel === "cup") { g.globalAlpha = .3; P("#d8ecf0", -6, -16, 12, 13); g.globalAlpha = 1; P("#e8f6fa", -5, -15, 1, 10); }
}

const API = {KINDS, FOODS: Object.keys(FOOD), VESSELS: Object.keys(VESSEL), plating, draw};
if (typeof module === "object" && module.exports) module.exports = API; else root.PBC_DISHES = API;
})(typeof window !== "undefined" ? window : globalThis);
