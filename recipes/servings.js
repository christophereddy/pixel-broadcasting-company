/* PBC recipe pages: the SERVINGS control. A viewer picks how many people they're cooking for and the ingredient list,
   the amounts written into the method and the AT A GLANCE tile follow, rounded to what a kitchen can measure.
   Runs entirely in the visitor's browser and keeps the choice in the address so it can be shared: recipes/beef-chili/?serves=8
   Cook times and temperatures never change; a note says so, and suggests a bigger or smaller pan when the recipe uses one.
   tools/build_recipes.cjs writes the original amounts into the page (data-q and data-u on each amount) and loads this file
   to check that, unscaled, it writes every amount exactly the way the page does. */
(function (root) {
"use strict";

// Written exactly like amount() and UNIT in tools/build_recipes.cjs (the builder checks this): 1.5 -> 1½
const FRAC = [[0.125, "⅛"], [0.25, "¼"], [1 / 3, "⅓"], [0.5, "½"], [2 / 3, "⅔"], [0.75, "¾"]];
function amount(q) {
  const whole = Math.floor(q + 1e-9), rest = q - whole;
  if (rest < 0.01) return String(whole);
  const f = FRAC.find(([v]) => Math.abs(v - rest) < 0.01);
  if (!f) return String(+q.toFixed(2));
  return (whole ? whole : "") + f[1];
}
const UNIT = {tsp: ["tsp", "tsp"], tbsp: ["tbsp", "tbsp"], cup: ["cup", "cups"], ml: ["ml", "ml"], l: ["liter", "liters"], g: ["g", "g"], kg: ["kg", "kg"],
  oz: ["oz", "oz"], lb: ["lb", "lb"], slice: ["slice", "slices"], clove: ["clove", "cloves"], sprig: ["sprig", "sprigs"], leaf: ["leaf", "leaves"],
  pinch: ["pinch", "pinches"], can: ["can", "cans"], sheet: ["sheet", "sheets"], stalk: ["stalk", "stalks"], bunch: ["bunch", "bunches"]};

// q rounded to a whole number plus the nearest of these fractions
function near(q, fracs) {
  const w = Math.floor(q), r = q - w;
  let best = 0;
  for (const f of fracs.concat(1)) if (Math.abs(f - r) < Math.abs(best - r)) best = f;
  return w + best;
}
const VOLUME = {tsp: 1, tbsp: 3, cup: 48};   // in teaspoons
const WEIGHT = {oz: 1, lb: 16};              // in ounces

// One amount times f, in the unit a cook would measure it in: 2 tbsp x 4 = ½ cup, 1 cup / 4 = ¼ cup, ¾ lb x 4 = 3 lb.
// half: this piece can be halved (an onion, a lemon); eggs, tortillas and the like stay whole.
function scale(q, u, f, half) {
  if (f === 1) return {q, u};
  const x = q * f;
  if (VOLUME[u]) {
    const t = x * VOLUME[u];
    const c = near(t / 48, [1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4]);
    // under a cup, stay in tablespoons unless a cup measure is close: 6 tbsp, not ⅓ cup
    if (t >= 12 && (t >= 48 || Math.abs(c * 48 - t) <= t * 0.05)) return {q: c, u: "cup"};
    if (t >= 3) return {q: near(t / 3, [1 / 2]), u: "tbsp"};
    return {q: Math.max(1 / 8, near(t, [1 / 8, 1 / 4, 1 / 2, 3 / 4])), u: "tsp"};
  }
  if (WEIGHT[u]) {
    const oz = x * WEIGHT[u];
    if (oz >= 16 || (u === "lb" && oz >= 4)) return {q: near(oz / 16, [1 / 4, 1 / 2, 3 / 4]), u: "lb"};
    return {q: oz < 2 ? Math.max(1 / 2, near(oz, [1 / 2])) : Math.round(oz), u: "oz"};
  }
  if (u === "g" || u === "ml") return {q: Math.max(1, x < 20 ? Math.round(x) : x < 100 ? Math.round(x / 5) * 5 : x < 1000 ? Math.round(x / 10) * 10 : Math.round(x / 50) * 50), u};
  if (u === "kg" || u === "l") return {q: Math.max(0.1, Math.round(x * 10) / 10), u};
  if (u === "can" || u === "bunch" || (u === "piece" && half)) return {q: Math.max(1 / 2, near(x, [1 / 2])), u};
  return {q: Math.max(1, Math.round(x)), u};   // pieces, slices, cloves, sprigs, leaves, sheets, stalks, pinches
}
// "1½ tsp", "3 cups", or just "2" for pieces
function measure(q, u) { return amount(q) + (u === "piece" ? "" : " " + UNIT[u][q > 1 ? 1 : 0]); }

const api = {amount, UNIT, scale, measure};
if (typeof module === "object" && module.exports) { module.exports = api; return; }

/* ---------- the page ---------- */
const box = document.getElementById("servings");
if (!box) return;
const input = document.getElementById("serves-n");
const reset = document.getElementById("serves-reset");
const note = document.getElementById("serves-note");
const tile = document.getElementById("serves-tile");
const base = +box.dataset.serves, MIN = 1, MAX = +input.max;
const items = [...document.querySelectorAll("#ingredients li[data-q], #method .co-amt")].map(el => ({
  el, q: +el.dataset.q, u: el.dataset.u, half: el.hasAttribute("data-half"), one: el.dataset.one, many: el.dataset.many,
  b: el.tagName === "LI" ? el.querySelector("b") : el
}));

function show(n) {
  const f = n / base;
  for (const it of items) {
    const s = scale(it.q, it.u, f, it.half);
    it.b.textContent = measure(s.q, s.u);
    if (it.one) it.b.nextSibling.nodeValue = " " + (s.q > 1 ? it.many : it.one);
  }
  input.value = n;
  tile.firstChild.textContent = n;
  tile.lastChild.textContent = n === 1 ? "serving" : "servings";
  box.querySelector('[data-d="-1"]').disabled = n <= MIN;
  box.querySelector('[data-d="1"]').disabled = n >= MAX;
  reset.hidden = n === base;
  if (n === base) { note.hidden = true; return; }
  let t = `Scaled from ${base} servings, with amounts rounded to what you can measure. Cook times and temperatures stay as written, so go by the "Done when" cues.`;
  if (f > 1 && box.dataset.oven) t += " For a bigger batch, use a bigger pan or two.";
  else if (f > 1 && box.dataset.stove) t += " Cook in batches if the pan gets crowded.";
  else if (f < 1 && box.dataset.oven) t += " Use a smaller pan and start checking a little early.";
  note.textContent = t;
  note.hidden = false;
}
function set(n, keep) {
  n = Math.min(MAX, Math.max(MIN, Math.round(n) || base));
  show(n);
  if (keep) return;
  const url = new URL(location.href);
  if (n === base) url.searchParams.delete("serves"); else url.searchParams.set("serves", n);
  history.replaceState(null, "", url);
}

box.addEventListener("click", e => {
  const b = e.target.closest("button[data-d]");
  if (b) set(+input.value + +b.dataset.d);
});
reset.addEventListener("click", () => { set(base); input.focus(); });
input.addEventListener("change", () => set(+input.value));
input.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); set(+input.value); } });

box.hidden = false;
const asked = +new URLSearchParams(location.search).get("serves");
set(asked || base, true);
})(this);
