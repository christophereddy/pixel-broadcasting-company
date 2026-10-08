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

const COOKS = ['two-adults', 'parent-child', 'two-elders', 'grandparent-grandchild'];
const KID_COOKS = ['parent-child', 'grandparent-grandchild'];
// The channel's own running order and pacing, so the airtime added up here is what really airs.
const SCHEDULE = require(path.join(ROOT, 'cooking', 'schedule.js'));
const CYCLE_MIN = SCHEDULE.CYCLE / 60000;

const errors = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
// The rules for one recipe live in cooking/rules.js, so My Kitchen (cooking/my-kitchen/) checks a viewer's own recipe
// with exactly the same rules in the browser.
const RULES = require(path.join(ROOT, 'cooking', 'rules.js'));
const OCCASIONS = RULES.OCCASIONS;

function checkRecipe(file) {
  const where = 'data/cooking/recipes/' + file;
  let r;
  try { r = JSON.parse(fs.readFileSync(path.join(DIR, 'recipes', file), 'utf8')); } catch (e) { err(where, 'not valid JSON: ' + e.message); return null; }
  const slug = file.replace(/\.json$/, '');
  if (r.slug !== slug) err(where, `slug "${r.slug}" must match the file name "${slug}"`);
  for (const p of RULES.check(r, LIB)) err(where + (p.at ? ' ' + p.at : ''), p.msg);
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
