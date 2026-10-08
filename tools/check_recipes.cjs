// Checks the cooking channel's recipes and shows (see tools/COOKING.md).
//   node tools/check_recipes.cjs
// Plain Node, no packages, a second to run. GitHub runs it on every pull request.
// The recipes are written by AI, so this is what stands between a recipe and the screen. It fails when:
//   - a recipe uses an ingredient that is not in data/cooking/ingredients.json, or a form or unit that isn't allowed
//   - the amounts a recipe's steps use don't add up to the amount in its ingredient list, or an ingredient is never used
//   - a step mentions a time without a timer set to that time, or a temperature that isn't the step's own
//   - a stove step has no heat level, or an oven step has no oven temperature
//   - raw meat, poultry or fish is never checked at its safe inside temperature, or eggs or bacon are never cooked
//   - the allergens listed differ from the ones its ingredients carry
//   - a kid recipe is Hard or has a knife, stove or oven step without "Grown-up helps"; a quick recipe takes over 15 minutes;
//     a vegetarian recipe has meat or fish in it
//   - an ingredient in the library has no pixel art in cooking/food.js, or its art names a shape that isn't drawn
//   - a show lists a recipe that doesn't exist, a recipe is in no show, an Around the world show has no country,
//     or a section holds less than two cycles of airtime, or the channel's schedule (cooking/schedule.js) would air
//     a show or a recipe twice within 6 hours at any point in the next 60 days
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'data', 'cooking');
const LIB = JSON.parse(fs.readFileSync(path.join(DIR, 'ingredients.json'), 'utf8'));
const SHOWS = JSON.parse(fs.readFileSync(path.join(DIR, 'shows.json'), 'utf8'));

const ROLES = ['breakfast', 'starter', 'main', 'side', 'dessert', 'drink', 'snack', 'sauce'];
const OCCASIONS = ['breakfast', 'brunch', 'lunch', 'lunchbox', 'weeknight', 'family-dinner', 'comfort', 'date-night', 'party',
  'game-day', 'picnic', 'snack', 'baking', 'holiday', 'leftovers'];
const LEVELS = ['easy', 'medium', 'hard'];
const TAGS = ['kid', 'quick', 'vegetarian', 'make-ahead'];
const UNITS = ['tsp', 'tbsp', 'cup', 'ml', 'l', 'g', 'kg', 'oz', 'lb', 'piece', 'slice', 'clove', 'sprig', 'leaf', 'pinch',
  'can', 'sheet', 'stalk', 'bunch', 'to-taste'];
const TOOLS = ['knife', 'stove', 'oven', 'blender', 'none'];
const HEATS = ['low', 'medium-low', 'medium', 'medium-high', 'high'];
const COOKS = ['two-adults', 'parent-child', 'two-elders', 'grandparent-grandchild'];
const KID_COOKS = ['parent-child', 'grandparent-grandchild'];
// The channel's own running order and pacing, so the airtime added up here is what really airs.
const SCHEDULE = require(path.join(ROOT, 'cooking', 'schedule.js'));
const CYCLE_MIN = SCHEDULE.CYCLE / 60000;

const errors = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const near = (a, b) => Math.abs(a - b) < 0.011;
const isNum = x => typeof x === 'number' && isFinite(x) && x > 0;

// minutes a step's text gives ("8 minutes", "8 to 10 minutes", "1 hour", "30 seconds"), each number converted
function timesIn(text) {
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

function checkRecipe(file) {
  const where = 'data/cooking/recipes/' + file;
  let r;
  try { r = JSON.parse(fs.readFileSync(path.join(DIR, 'recipes', file), 'utf8')); } catch (e) { err(where, 'not valid JSON: ' + e.message); return null; }
  const slug = file.replace(/\.json$/, '');
  if (r.slug !== slug) err(where, `slug "${r.slug}" must match the file name "${slug}"`);
  for (const k of ['name', 'summary', 'cuisine']) if (typeof r[k] !== 'string' || !r[k].trim()) err(where, `needs a ${k}`);
  if (!ROLES.includes(r.role)) err(where, `role must be one of ${ROLES.join(', ')}`);
  if (!Array.isArray(r.occasions) || !r.occasions.length || r.occasions.some(o => !OCCASIONS.includes(o))) err(where, `occasions must come from ${OCCASIONS.join(', ')}`);
  if (!LEVELS.includes(r.difficulty)) err(where, `difficulty must be one of ${LEVELS.join(', ')}`);
  const tags = r.tags || [];
  for (const t of tags) if (!TAGS.includes(t)) err(where, `unknown tag "${t}"`);
  if (!Number.isInteger(r.serves) || r.serves < 1) err(where, 'serves must be a whole number');
  const t = r.time || {};
  for (const k of ['prep', 'cook', 'total']) if (!Number.isInteger(t[k]) || t[k] < 0) err(where, `time.${k} must be whole minutes`);
  if (t.total < t.prep + t.cook) err(where, `time.total (${t.total}) is less than prep + cook (${t.prep + t.cook})`);
  if (tags.includes('quick') && t.total > 15) err(where, `tagged quick but takes ${t.total} minutes (quick is 15 or less)`);

  // the ingredient list
  const list = new Map();
  for (const [i, ing] of (r.ingredients || []).entries()) {
    const w = `${where} ingredient ${i + 1}`;
    const lib = LIB.ingredients[ing.id];
    if (!lib) { err(w, `"${ing.id}" is not in data/cooking/ingredients.json (add it there, with art, before using it)`); continue; }
    if (list.has(ing.id)) err(w, `"${ing.id}" is listed twice; list it once with the full amount`);
    list.set(ing.id, ing);
    if (!LIB.groups[lib.group].forms.includes(ing.form)) err(w, `"${ing.id}" can't be "${ing.form}"; forms for ${lib.group}: ${LIB.groups[lib.group].forms.join(', ')}`);
    if (!UNITS.includes(ing.unit)) err(w, `unknown unit "${ing.unit}"`);
    if (ing.unit === 'to-taste') { if (ing.qty !== undefined) err(w, 'a to-taste ingredient has no qty'); }
    else if (!isNum(ing.qty)) err(w, `"${ing.id}" needs a qty above 0`);
  }
  if (!list.size) err(where, 'has no ingredients');

  // the steps: what they use, their timers, heat and temperatures
  const used = new Map();
  const steps = r.steps || [];
  if (!steps.length) err(where, 'has no steps');
  let timers = 0;
  steps.forEach((s, i) => {
    const w = `${where} step ${i + 1}`;
    if (typeof s.do !== 'string' || !s.do.trim()) err(w, 'needs its instruction in "do"');
    const tool = s.tool || 'none';
    if (!TOOLS.includes(tool)) err(w, `tool must be one of ${TOOLS.join(', ')}`);
    for (const u of s.uses || []) {
      const ing = list.get(u.id);
      if (!ing) { err(w, `uses "${u.id}", which is not in the ingredient list`); continue; }
      if (u.unit !== ing.unit) { err(w, `uses ${u.id} in "${u.unit}" but the list gives it in "${ing.unit}"`); continue; }
      if (ing.unit === 'to-taste') { used.set(u.id, 0); continue; }
      if (!isNum(u.qty)) { err(w, `uses ${u.id} without an amount`); continue; }
      used.set(u.id, (used.get(u.id) || 0) + u.qty);
    }
    const said = timesIn(s.do || '');
    if (said.length && s.timer === undefined) err(w, `mentions ${said.join(' / ')} min but sets no timer`);
    if (s.timer !== undefined) {
      if (!isNum(s.timer)) err(w, 'timer must be minutes above 0');
      else if (said.length && !said.some(x => near(x, s.timer))) err(w, `timer is ${s.timer} min but the step says ${said.join(' / ')} min`);
      timers++;
    }
    if (tool === 'stove' && !HEATS.includes(s.heat)) err(w, `a stove step needs heat: ${HEATS.join(', ')}`);
    if (tool !== 'stove' && s.heat !== undefined) err(w, 'heat is only for stove steps');
    if (tool === 'oven' && !(Number.isInteger(s.oven_f) && s.oven_f >= 200 && s.oven_f <= 550)) err(w, 'an oven step needs oven_f (200 to 550)');
    if (tool !== 'oven' && s.oven_f !== undefined) err(w, 'oven_f is only for oven steps');
    for (const f of fahrenheitIn(s.do || '')) if (f !== s.oven_f && f !== s.temp_f) err(w, `says ${f}°F but the step's oven_f/temp_f don't match`);
    if (s.temp_f !== undefined && !Number.isInteger(s.temp_f)) err(w, 'temp_f must be whole degrees F');
    if (tags.includes('kid') && ['knife', 'stove', 'oven'].includes(tool) && s.help !== true) err(w, `kid recipe: a ${tool} step needs "help": true (Grown-up helps)`);
  });
  for (const [id, ing] of list) {
    if (!used.has(id)) { err(where, `"${id}" is listed but no step uses it`); continue; }
    if (ing.unit !== 'to-taste' && !near(used.get(id), ing.qty)) err(where, `steps use ${+used.get(id).toFixed(3)} ${ing.unit} of ${id} but the list says ${ing.qty}`);
  }

  // food safety
  for (const [id] of list) {
    const lib = LIB.ingredients[id];
    if (lib.safe_f && !steps.some(s => s.temp_f >= lib.safe_f)) err(where, `${id} must be checked at ${lib.safe_f}°F inside: add temp_f to the step that checks it`);
    if (lib.must_cook) {
      const first = steps.findIndex(s => (s.uses || []).some(u => u.id === id));
      if (first >= 0 && !steps.slice(first).some(s => s.tool === 'stove' || s.tool === 'oven')) err(where, `${id} goes in but is never cooked (stove or oven) afterwards`);
    }
  }

  // allergens and tags that follow from the ingredients
  const want = new Set();
  for (const [id] of list) for (const a of LIB.ingredients[id].allergens || []) want.add(a);
  const have = new Set(r.allergens || []);
  for (const a of have) if (!LIB.allergens.includes(a)) err(where, `unknown allergen "${a}"`);
  const missing = [...want].filter(a => !have.has(a)), extra = [...have].filter(a => !want.has(a));
  if (missing.length) err(where, `allergens must include ${missing.join(', ')} (from its ingredients)`);
  if (extra.length) err(where, `allergens lists ${extra.join(', ')}, which none of its ingredients carry`);
  if (tags.includes('kid') && r.difficulty === 'hard') err(where, 'a kid recipe cannot be hard');
  if (tags.includes('vegetarian')) for (const [id] of list) {
    const lib = LIB.ingredients[id];
    if ((lib.group === 'protein' && !['egg', 'tofu'].includes(id)) || (lib.allergens || []).some(a => a === 'fish' || a === 'shellfish')) err(where, `tagged vegetarian but uses ${id}`);
  }
  return {slug, r};
}

const files = fs.readdirSync(path.join(DIR, 'recipes')).filter(f => f.endsWith('.json')).sort();
const recipes = new Map();
for (const f of files) { const x = checkRecipe(f); if (x) recipes.set(x.slug, x); }

// every library ingredient has art, so the counter and stove can draw anything a recipe uses
const FOOD = require(path.join(ROOT, 'cooking', 'food.js'));
for (const id of Object.keys(LIB.ingredients)) {
  if (!FOOD.ART[id]) err('cooking/food.js', `"${id}" is in the ingredient library but has no art in ART`);
  else if (!FOOD.SHAPES[FOOD.ART[id][0]]) err('cooking/food.js', `"${id}" is drawn as "${FOOD.ART[id][0]}", which isn't one of the SHAPES`);
}
for (const id of Object.keys(FOOD.ART)) if (!LIB.ingredients[id]) err('cooking/food.js', `"${id}" has art but isn't in the ingredient library`);

// the shows and the rundown's sections
const inShow = new Set();
const sectionMin = {};
const seen = new Set();
for (const [i, s] of (SHOWS.shows || []).entries()) {
  const w = `data/cooking/shows.json show ${i + 1} (${s.slug || '?'})`;
  if (!s.slug || seen.has(s.slug)) err(w, 'needs a unique slug'); seen.add(s.slug);
  if (!s.name) err(w, 'needs a name');
  if (!SHOWS.sections[s.section]) err(w, `section must be one of ${Object.keys(SHOWS.sections).join(', ')}`);
  if (!OCCASIONS.includes(s.occasion)) err(w, `occasion must come from ${OCCASIONS.join(', ')}`);
  if (!COOKS.includes(s.cooks)) err(w, `cooks must be one of ${COOKS.join(', ')}`);
  if (s.section === 'world' && !s.country) err(w, 'an Around the world show needs a country');
  if (!Array.isArray(s.recipes) || !s.recipes.length) { err(w, 'has no recipes'); continue; }
  let ok = true;
  for (const slug of s.recipes) {
    const x = recipes.get(slug);
    if (!x) { err(w, `recipe "${slug}" doesn't exist in data/cooking/recipes/`); ok = false; continue; }
    inShow.add(slug);
  }
  if (!ok) continue;
  const min = SCHEDULE.showBeats(s, Object.fromEntries([...recipes].map(([k, x]) => [k, x.r]))).len / 60000;
  const kid = s.recipes.every(slug => recipes.get(slug)?.r.tags?.includes('kid'));
  if (kid && !KID_COOKS.includes(s.cooks)) err(w, `a kid show is cooked by ${KID_COOKS.join(' or ')}`);
  sectionMin[s.section] = (sectionMin[s.section] || 0) + min;
}
for (const slug of recipes.keys()) if (!inShow.has(slug)) err(`data/cooking/recipes/${slug}.json`, 'is in no show, so it never airs');
for (const [k, sec] of Object.entries(SHOWS.sections)) {
  const need = 2 * CYCLE_MIN * sec.share, have = Math.round(sectionMin[k] || 0);
  if (have < need) err('data/cooking/shows.json', `${sec.name} has about ${have} min of shows; it needs ${need} (two cycles) so nothing repeats within 6 hours`);
}

// play the schedule forward 60 days and look for anything that comes back within 6 hours
if (!errors.length) {
  const menu = {sections: SHOWS.sections, shows: SHOWS.shows, recipes: Object.fromEntries([...recipes].map(([k, x]) => [k, x.r]))};
  const last = new Map(), SIX = 6 * 3600000;
  let t = SCHEDULE.EPOCH, worst = null;
  while (t < SCHEDULE.EPOCH + 60 * 86400000) {
    const c = SCHEDULE.cycleAt(menu, t);
    for (const x of c.shows) for (const key of [x.show.slug + ' (show)', ...x.show.recipes.map(r => r + ' (recipe)')]) {
      const gap = last.has(key) ? x.start - last.get(key) : Infinity;
      if (gap < SIX && (!worst || gap < worst.gap)) worst = {key, gap, at: x.start};
      last.set(key, x.start);
    }
    t = c.start + c.len;
  }
  if (worst) err('data/cooking/shows.json', `${worst.key} airs again after only ${(worst.gap / 3600000).toFixed(1)} hours (on ${new Date(worst.at).toISOString()}); add shows to its section`);
}

if (errors.length) {
  console.error(errors.map(e => '✗ ' + e).join('\n'));
  console.error(`\n${errors.length} problem${errors.length === 1 ? '' : 's'} in the cooking data (tools/COOKING.md says how recipes are written).`);
  process.exit(1);
}
const total = Object.values(sectionMin).reduce((a, b) => a + b, 0);
console.log(`✓ ${recipes.size} recipes and ${SHOWS.shows.length} shows check out, from ${Object.keys(LIB.ingredients).length} library ingredients.`);
console.log('  Airtime: ' + Object.entries(SHOWS.sections).map(([k, s]) => `${s.name} ${Math.round(sectionMin[k] || 0)} min`).join(', ') +
  `; ${Math.round(total)} min in all. Nothing repeats within 6 hours over the next 60 days.`);
