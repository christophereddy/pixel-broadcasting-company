/* PBC Cooking: the recipe rules (tools/COOKING.md), in one file for the recipe check (tools/check_recipes.cjs), the recipe
   builder (tools/build_recipes.cjs) and My Kitchen (cooking/my-kitchen/), where viewers write their own recipes in the browser.
   One copy of the rules means a viewer's recipe passes exactly the checks PBC's own recipes pass before the kitchen cooks it.
   - check(r, lib)          every problem with one recipe, as [{at, msg}]: at is "", "ingredient 2" or "step 3"
   - allergensOf(r, lib)    the allergens a recipe's ingredients carry, in the library's order
   - ingredientLine(i, lib) one amount written out: {qty: "2 cups", text: "shredded cheddar"}
   - menuRecipe(r, lib)     the channel's copy of a recipe, the way cooking/menu.json holds it
   lib is data/cooking/ingredients.json. */
(function(root){
"use strict";
const ROLES = ["breakfast", "starter", "main", "side", "dessert", "drink", "snack", "sauce"];
const OCCASIONS = ["breakfast", "brunch", "lunch", "lunchbox", "weeknight", "family-dinner", "comfort", "date-night", "party",
  "game-day", "picnic", "snack", "baking", "holiday", "leftovers"];
const LEVELS = ["easy", "medium", "hard"];
const TAGS = ["kid", "quick", "vegetarian", "make-ahead"];
const UNITS = ["tsp", "tbsp", "cup", "ml", "l", "g", "kg", "oz", "lb", "piece", "slice", "clove", "sprig", "leaf", "pinch",
  "can", "sheet", "stalk", "bunch", "to-taste"];
const TOOLS = ["knife", "stove", "oven", "blender", "none"];
const HEATS = ["low", "medium-low", "medium", "medium-high", "high"];

const near = (a, b) => Math.abs(a - b) < 0.011;
const isNum = x => typeof x === "number" && isFinite(x) && x > 0;

// minutes a step's text gives ("8 minutes", "8 to 10 minutes", "1 hour", "30 seconds"), each number converted
function timesIn(text){
  const out = [];
  const re = /(\d+(?:\.\d+)?)(?:\s*(?:to|-|–)\s*(\d+(?:\.\d+)?))?\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)\b/gi;
  let m;
  while ((m = re.exec(text))) {
    const k = /^s/i.test(m[3]) ? 1 / 60 : /^h/i.test(m[3]) ? 60 : 1;
    out.push(+m[1] * k); if (m[2]) out.push(+m[2] * k);
  }
  return out;
}
const fahrenheitIn = text => [...text.matchAll(/(\d{2,3})\s*°\s*F/g)].map(m => +m[1]);

function allergensOf(r, lib){
  const want = new Set();
  for (const i of r.ingredients || []) for (const a of (lib.ingredients[i.id] || {}).allergens || []) want.add(a);
  return lib.allergens.filter(a => want.has(a));
}

function check(r, LIB){
  const out = [];
  const err = (at, msg) => out.push({at, msg});
  for (const k of ["name", "summary", "cuisine"]) if (typeof r[k] !== "string" || !r[k].trim()) err("", `needs a ${k}`);
  if (!ROLES.includes(r.role)) err("", `role must be one of ${ROLES.join(", ")}`);
  if (!Array.isArray(r.occasions) || !r.occasions.length || r.occasions.some(o => !OCCASIONS.includes(o))) err("", `occasions must come from ${OCCASIONS.join(", ")}`);
  if (!LEVELS.includes(r.difficulty)) err("", `difficulty must be one of ${LEVELS.join(", ")}`);
  const tags = r.tags || [];
  for (const t of tags) if (!TAGS.includes(t)) err("", `unknown tag "${t}"`);
  if (!Number.isInteger(r.serves) || r.serves < 1) err("", "serves must be a whole number");
  const t = r.time || {};
  for (const k of ["prep", "cook", "total"]) if (!Number.isInteger(t[k]) || t[k] < 0) err("", `time.${k} must be whole minutes`);
  if (t.total < t.prep + t.cook) err("", `time.total (${t.total}) is less than prep + cook (${t.prep + t.cook})`);
  if (tags.includes("quick") && t.total > 15) err("", `tagged quick but takes ${t.total} minutes (quick is 15 or less)`);

  // the ingredient list
  const list = new Map();
  for (const [i, ing] of (r.ingredients || []).entries()) {
    const w = `ingredient ${i + 1}`;
    const lib = LIB.ingredients[ing.id];
    if (!lib) { err(w, `"${ing.id}" is not in data/cooking/ingredients.json (add it there, with art, before using it)`); continue; }
    if (list.has(ing.id)) err(w, `"${ing.id}" is listed twice; list it once with the full amount`);
    list.set(ing.id, ing);
    if (!LIB.groups[lib.group].forms.includes(ing.form)) err(w, `"${ing.id}" can't be "${ing.form}"; forms for ${lib.group}: ${LIB.groups[lib.group].forms.join(", ")}`);
    if (!UNITS.includes(ing.unit)) err(w, `unknown unit "${ing.unit}"`);
    if (ing.unit === "to-taste") { if (ing.qty !== undefined) err(w, "a to-taste ingredient has no qty"); }
    else if (!isNum(ing.qty)) err(w, `"${ing.id}" needs a qty above 0`);
  }
  if (!list.size) err("", "has no ingredients");

  // the steps: what they use, their timers, heat and temperatures
  const used = new Map();
  const steps = r.steps || [];
  if (!steps.length) err("", "has no steps");
  steps.forEach((s, i) => {
    const w = `step ${i + 1}`;
    if (typeof s.do !== "string" || !s.do.trim()) err(w, 'needs its instruction in "do"');
    const tool = s.tool || "none";
    if (!TOOLS.includes(tool)) err(w, `tool must be one of ${TOOLS.join(", ")}`);
    for (const u of s.uses || []) {
      const ing = list.get(u.id);
      if (!ing) { err(w, `uses "${u.id}", which is not in the ingredient list`); continue; }
      if (u.unit !== ing.unit) { err(w, `uses ${u.id} in "${u.unit}" but the list gives it in "${ing.unit}"`); continue; }
      if (ing.unit === "to-taste") { used.set(u.id, 0); continue; }
      if (!isNum(u.qty)) { err(w, `uses ${u.id} without an amount`); continue; }
      used.set(u.id, (used.get(u.id) || 0) + u.qty);
    }
    const said = timesIn(s.do || "");
    if (said.length && s.timer === undefined) err(w, `mentions ${said.join(" / ")} min but sets no timer`);
    if (s.timer !== undefined) {
      if (!isNum(s.timer)) err(w, "timer must be minutes above 0");
      else if (said.length && !said.some(x => near(x, s.timer))) err(w, `timer is ${s.timer} min but the step says ${said.join(" / ")} min`);
    }
    if (tool === "stove" && !HEATS.includes(s.heat)) err(w, `a stove step needs heat: ${HEATS.join(", ")}`);
    if (tool !== "stove" && s.heat !== undefined) err(w, "heat is only for stove steps");
    if (tool === "oven" && !(Number.isInteger(s.oven_f) && s.oven_f >= 200 && s.oven_f <= 550)) err(w, "an oven step needs oven_f (200 to 550)");
    if (tool !== "oven" && s.oven_f !== undefined) err(w, "oven_f is only for oven steps");
    for (const f of fahrenheitIn(s.do || "")) if (f !== s.oven_f && f !== s.temp_f) err(w, `says ${f}°F but the step's oven_f/temp_f don't match`);
    if (s.temp_f !== undefined && !Number.isInteger(s.temp_f)) err(w, "temp_f must be whole degrees F");
    if (tags.includes("kid") && ["knife", "stove", "oven"].includes(tool) && s.help !== true) err(w, `kid recipe: a ${tool} step needs "help": true (Grown-up helps)`);
  });
  for (const [id, ing] of list) {
    if (!used.has(id)) { err("", `"${id}" is listed but no step uses it`); continue; }
    if (ing.unit !== "to-taste" && !near(used.get(id), ing.qty)) err("", `steps use ${+used.get(id).toFixed(3)} ${ing.unit} of ${id} but the list says ${ing.qty}`);
  }

  // food safety
  for (const [id] of list) {
    const lib = LIB.ingredients[id];
    if (lib.safe_f && !steps.some(s => s.temp_f >= lib.safe_f)) err("", `${id} must be checked at ${lib.safe_f}°F inside: add temp_f to the step that checks it`);
    if (lib.must_cook) {
      const first = steps.findIndex(s => (s.uses || []).some(u => u.id === id));
      if (first >= 0 && !steps.slice(first).some(s => s.tool === "stove" || s.tool === "oven")) err("", `${id} goes in but is never cooked (stove or oven) afterwards`);
    }
  }

  // allergens and tags that follow from the ingredients
  const want = new Set(allergensOf(r, LIB));
  const have = new Set(r.allergens || []);
  for (const a of have) if (!LIB.allergens.includes(a)) err("", `unknown allergen "${a}"`);
  const missing = [...want].filter(a => !have.has(a)), extra = [...have].filter(a => !want.has(a));
  if (missing.length) err("", `allergens must include ${missing.join(", ")} (from its ingredients)`);
  if (extra.length) err("", `allergens lists ${extra.join(", ")}, which none of its ingredients carry`);
  if (tags.includes("kid") && r.difficulty === "hard") err("", "a kid recipe cannot be hard");
  if (tags.includes("vegetarian")) for (const [id] of list) {
    const lib = LIB.ingredients[id];
    if ((lib.group === "protein" && !["egg", "tofu"].includes(id)) || (lib.allergens || []).some(a => a === "fish" || a === "shellfish")) err("", `tagged vegetarian but uses ${id}`);
  }
  return out;
}

/* ---------- amounts, written out the way the recipe pages write them ---------- */
// 1.5 -> 1½, 0.333 -> ⅓ (recipes/servings.js writes them the same way, and tools/build_recipes.cjs checks both)
const FRAC = [[0.125, "⅛"], [0.25, "¼"], [1 / 3, "⅓"], [0.5, "½"], [2 / 3, "⅔"], [0.75, "¾"]];
function amount(q){
  const whole = Math.floor(q + 1e-9), rest = q - whole;
  if (rest < 0.01) return String(whole);
  const f = FRAC.find(([v]) => Math.abs(v - rest) < 0.01);
  if (!f) return String(+q.toFixed(2));
  return (whole ? whole : "") + f[1];
}
const UNIT = {tsp: ["tsp", "tsp"], tbsp: ["tbsp", "tbsp"], cup: ["cup", "cups"], ml: ["ml", "ml"], l: ["liter", "liters"], g: ["g", "g"], kg: ["kg", "kg"],
  oz: ["oz", "oz"], lb: ["lb", "lb"], slice: ["slice", "slices"], clove: ["clove", "cloves"], sprig: ["sprig", "sprigs"], leaf: ["leaf", "leaves"],
  pinch: ["pinch", "pinches"], can: ["can", "cans"], sheet: ["sheet", "sheets"], stalk: ["stalk", "stalks"], bunch: ["bunch", "bunches"]};
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
// "2 cups shredded cheddar", "3 cloves garlic, minced", "Salt, to taste"
function ingredientLine(i, LIB){
  const lib = LIB.ingredients[i.id];
  let name = lib.name.charAt(0).toLowerCase() + lib.name.slice(1);
  if (/^[A-Z]{2}|^[A-Z][a-z]+ [A-Z]/.test(lib.name)) name = lib.name;   // keep names like "Gruyère" readable either way
  const form = i.form && !["whole", "dry", "ground"].includes(i.form) ? i.form : "";
  if (i.unit === "to-taste") return {qty: "", text: cap(name) + ", to taste"};
  let qty = amount(i.qty);
  if (i.unit === "piece") {
    if (i.qty > 1 && !/s$/.test(name)) name += /(sh|ch|x|o)$/.test(name) ? "es" : "s";
  } else qty += " " + UNIT[i.unit][i.qty > 1 ? 1 : 0];
  return {qty, text: name + (form ? ", " + form : "") + (i.note ? " (" + i.note + ")" : "")};
}

// The channel's copy of one recipe: every ingredient with its group and its line written out, so the screen says
// exactly what the recipe page says.
function menuRecipe(r, LIB){
  const line = i => { const l = ingredientLine(i, LIB); return (l.qty ? l.qty + " " : "") + l.text; };
  const byId = new Map(r.ingredients.map(i => [i.id, i]));
  return {name: r.name, summary: r.summary, role: r.role, cuisine: r.cuisine, serves: r.serves, time: r.time, difficulty: r.difficulty,
    tags: r.tags, allergens: r.allergens, ...(r.plate ? {plate: r.plate} : {}),
    ingredients: r.ingredients.map(i => ({id: i.id, group: LIB.ingredients[i.id].group, qty: i.qty, unit: i.unit, form: i.form, line: line(i)})),
    steps: r.steps.map(st => {
      const o = {do: st.do};
      if (st.uses) o.uses = st.uses.map(u => ({id: u.id, group: LIB.ingredients[u.id].group, qty: u.qty, unit: u.unit, form: byId.get(u.id).form,
        line: line(Object.assign({}, byId.get(u.id), u, {note: undefined}))}));
      for (const k of ["tool", "heat", "oven_f", "timer", "temp_f", "cue", "help"]) if (st[k] !== undefined) o[k] = st[k];
      return o;
    })};
}

const API = {ROLES, OCCASIONS, LEVELS, TAGS, UNITS, TOOLS, HEATS, UNIT, timesIn, fahrenheitIn, allergensOf, check, amount, ingredientLine, menuRecipe};
if (typeof module === "object" && module.exports) module.exports = API; else root.PBC_RULES = API;
})(typeof window !== "undefined" ? window : globalThis);
