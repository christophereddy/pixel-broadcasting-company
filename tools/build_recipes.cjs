// Builds the recipe site from the cooking data (data/cooking/, see tools/COOKING.md).
//   node tools/build_recipes.cjs           write the pages
//   node tools/build_recipes.cjs --check   fail if a page is out of date with the data (GitHub runs this)
// Plain Node, no packages. It writes:
//   recipes/index.html          the searchable recipe box (search runs in the visitor's browser, recipes/search.js)
//   recipes/index.json          the small index that search reads: names, tags and ingredient names, no steps
//   recipes/<slug>/index.html   one page per recipe, with Google's recipe markup (schema.org Recipe)
//   sitemap.xml, robots.txt     so search engines find every page
// Every amount, time and temperature on a page comes straight from the recipe data, never retyped.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://christophereddy.github.io/pixel-broadcasting-company/';
const DIR = path.join(ROOT, 'data', 'cooking');
const LIB = JSON.parse(fs.readFileSync(path.join(DIR, 'ingredients.json'), 'utf8'));
const SHOWS = JSON.parse(fs.readFileSync(path.join(DIR, 'shows.json'), 'utf8'));
const RECIPES = fs.readdirSync(path.join(DIR, 'recipes')).filter(f => f.endsWith('.json')).sort()
  .map(f => JSON.parse(fs.readFileSync(path.join(DIR, 'recipes', f), 'utf8')));
const BY = new Map(RECIPES.map(r => [r.slug, r]));
const SHOW_OF = new Map();
for (const s of SHOWS.shows) for (const slug of s.recipes) if (!SHOW_OF.has(slug)) SHOW_OF.set(slug, s);

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const ROLE = {breakfast: 'Breakfast', starter: 'Starter', main: 'Main', side: 'Side', dessert: 'Dessert', drink: 'Drink', snack: 'Snack', sauce: 'Sauce'};
const OCC = {breakfast: 'Breakfast', brunch: 'Brunch', lunch: 'Lunch', lunchbox: 'Lunchbox', weeknight: 'Weeknight dinner', 'family-dinner': 'Family dinner',
  comfort: 'Comfort food', 'date-night': 'Date night', party: 'Party', 'game-day': 'Game day', picnic: 'Picnic', snack: 'Snack', baking: 'Baking',
  holiday: 'Holiday', leftovers: 'Leftovers'};
const ALLERGEN = {milk: 'Milk', egg: 'Egg', wheat: 'Wheat', soy: 'Soy', peanut: 'Peanuts', 'tree-nut': 'Tree nuts', fish: 'Fish', shellfish: 'Shellfish', sesame: 'Sesame'};
const HEAT = {low: 'LOW HEAT', 'medium-low': 'MEDIUM-LOW HEAT', medium: 'MEDIUM HEAT', 'medium-high': 'MEDIUM-HIGH HEAT', high: 'HIGH HEAT'};
const celsius = f => Math.round((f - 32) * 5 / 9);

// 1.5 -> 1½, 0.333 -> ⅓
const FRAC = [[0.125, '⅛'], [0.25, '¼'], [1 / 3, '⅓'], [0.5, '½'], [2 / 3, '⅔'], [0.75, '¾']];
function amount(q) {
  const whole = Math.floor(q + 1e-9), rest = q - whole;
  if (rest < 0.01) return String(whole);
  const f = FRAC.find(([v]) => Math.abs(v - rest) < 0.01);
  if (!f) return String(+q.toFixed(2));
  return (whole ? whole : '') + f[1];
}
const UNIT = {tsp: ['tsp', 'tsp'], tbsp: ['tbsp', 'tbsp'], cup: ['cup', 'cups'], ml: ['ml', 'ml'], l: ['liter', 'liters'], g: ['g', 'g'], kg: ['kg', 'kg'],
  oz: ['oz', 'oz'], lb: ['lb', 'lb'], slice: ['slice', 'slices'], clove: ['clove', 'cloves'], sprig: ['sprig', 'sprigs'], leaf: ['leaf', 'leaves'],
  pinch: ['pinch', 'pinches'], can: ['can', 'cans'], sheet: ['sheet', 'sheets'], stalk: ['stalk', 'stalks'], bunch: ['bunch', 'bunches']};
// "2 cups shredded cheddar", "3 cloves garlic, minced", "Salt, to taste"
function ingredientLine(i) {
  const lib = LIB.ingredients[i.id];
  let name = lib.name.charAt(0).toLowerCase() + lib.name.slice(1);
  if (/^[A-Z]{2}|^[A-Z][a-z]+ [A-Z]/.test(lib.name)) name = lib.name;   // keep names like "Gruyère" readable either way
  const form = i.form && !['whole', 'dry', 'ground'].includes(i.form) ? i.form : '';
  if (i.unit === 'to-taste') return {qty: '', text: cap(name) + ', to taste'};
  let qty = amount(i.qty);
  if (i.unit === 'piece') {
    if (i.qty > 1 && !/s$/.test(name)) name += /(sh|ch|x|o)$/.test(name) ? 'es' : 's';
  } else qty += ' ' + UNIT[i.unit][i.qty > 1 ? 1 : 0];
  return {qty, text: name + (form ? ', ' + form : '') + (i.note ? ' (' + i.note + ')' : '')};
}
const minutes = m => m < 60 ? m + ' min' : Math.floor(m / 60) + ' hr' + (m % 60 ? ' ' + (m % 60) + ' min' : '');
const iso = m => 'PT' + (m >= 60 ? Math.floor(m / 60) + 'H' : '') + (m % 60 || m === 0 ? (m % 60) + 'M' : '');
const timerLabel = t => t < 1 ? Math.round(t * 60) + ' SEC' : t >= 60 && t % 60 === 0 ? t / 60 + ' HR' : t + ' MIN';

/* ---------- the shared page frame (tools/NEW_PAGE.md skeleton, company-page style) ---------- */
function page({up, title, description, canonical, dept, main, side, head = ''}) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · Pixel Broadcasting Company</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@500;700&family=Press+Start+2P&family=Silkscreen&family=VT323&display=swap">
<link rel="stylesheet" href="${up}shared/pbc.css">
<link rel="stylesheet" href="${up}shared/company.css">
<script src="${up}shared/business.js"></script>
<script src="${up}shared/pbc.js"></script>
${head}</head>
<body>
<!-- Built by tools/build_recipes.cjs from data/cooking/. Edit the data or the builder, not this file. -->
<div class="pbc-page">
  <div class="pbc-top">
  <header class="pbc-mast">
    <div class="pbc-brand">
      <span class="pbc-mark" aria-hidden="true">PBC</span>
      <div><h1>Pixel Broadcasting Company</h1><p>PBC Cooking recipes</p></div>
    </div>
    <div class="pbc-side">
      <nav class="pbc-chan" aria-label="Channel"><a href="${up}">NEWS</a><a href="${up}sports/">SPORTS</a></nav>
      <div class="pbc-onair"><span class="pbc-dot"></span>ON AIR 24 HOURS</div>
    </div>
  </header>
  <div class="pbc-ctl">
    <div class="co-dept">PBC COOKING <span>· ${esc(dept)}</span></div>
    <div class="pbc-btns"><a class="pbc-btn" href="${up}">BACK TO THE BROADCAST</a></div>
  </div>
  </div>

  <main class="pbc-main">
${main}
  </main>

  <aside class="side co-side">
${side}
    <div class="co-card"><h2>THE COMPANY</h2><ul class="co-dir">
      <li><a href="${up}about/">About</a></li>
      <li><a href="${up}advertise/">Marketing Division</a></li>
      <li><a href="${up}contact/">Contact</a></li>
      <li><a href="${up}corrections/">Corrections</a></li>
      <li><a href="${up}privacy/">Privacy Policy</a></li>
      <li><a href="${up}terms/">Terms of Use</a></li>
    </ul></div>
  </aside>
</div>
</body>
</html>
`;
}

const AI_NOTE = 'Every PBC recipe is written by AI (Claude, made by Anthropic) and checked against our recipe rules: amounts that add up, timers and temperatures as written, and safe cooking temperatures for meat, poultry and fish. They are not tested in a kitchen, so use your judgment, check allergens, and use a thermometer for meat.';

function tagsHtml(r) {
  const t = [`<span class="co-tag level">${r.difficulty.toUpperCase()}</span>`];
  if (r.tags.includes('kid')) t.push('<span class="co-tag kid">KID-FRIENDLY</span>');
  if (r.tags.includes('quick')) t.push('<span class="co-tag quick">QUICK</span>');
  if (r.tags.includes('vegetarian')) t.push('<span class="co-tag veg">VEGETARIAN</span>');
  return `<div class="co-tags">${t.join('')}</div>`;
}

/* ---------- one recipe ---------- */
function recipePage(r) {
  const url = SITE + 'recipes/' + r.slug + '/';
  const show = SHOW_OF.get(r.slug);
  const lines = r.ingredients.map(ingredientLine);
  const ld = {
    '@context': 'https://schema.org', '@type': 'Recipe', name: r.name, description: r.summary, url,
    author: {'@type': 'Organization', name: 'Pixel Broadcasting Company', url: SITE},
    recipeCuisine: r.cuisine, recipeCategory: ROLE[r.role], keywords: [...r.occasions.map(o => OCC[o]), ...r.tags].join(', '),
    recipeYield: `${r.serves} serving${r.serves === 1 ? '' : 's'}`,
    prepTime: iso(r.time.prep), cookTime: iso(r.time.cook), totalTime: iso(r.time.total),
    recipeIngredient: lines.map(l => (l.qty ? l.qty + ' ' : '') + l.text),
    recipeInstructions: r.steps.map((s, i) => ({'@type': 'HowToStep', position: i + 1, text: s.do}))
  };
  if (r.tags.includes('vegetarian')) ld.suitableForDiet = 'https://schema.org/VegetarianDiet';
  const head = `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>\n`;
  const steps = r.steps.map(s => {
    const b = [];
    if (s.timer !== undefined) b.push(`<span class="co-badge">TIMER ${timerLabel(s.timer)}</span>`);
    if (s.heat) b.push(`<span class="co-badge">${HEAT[s.heat]}</span>`);
    if (s.oven_f) b.push(`<span class="co-badge">OVEN ${s.oven_f}°F / ${celsius(s.oven_f)}°C</span>`);
    if (s.temp_f) b.push(`<span class="co-badge temp">CHECK ${s.temp_f}°F / ${celsius(s.temp_f)}°C INSIDE</span>`);
    if (s.help) b.push('<span class="co-badge help">GROWN-UP HELPS</span>');
    return `        <li>${esc(s.do)}${s.cue ? `<span class="co-done">Done when: ${esc(s.cue)}.</span>` : ''}${b.length ? `<div class="co-badges">${b.join('')}</div>` : ''}</li>`;
  }).join('\n');
  const allergens = r.allergens.length ? r.allergens.map(a => ALLERGEN[a]).join(', ') : 'none of the major allergens';
  const sameShow = show ? show.recipes.filter(s => s !== r.slug).map(s => BY.get(s)).filter(Boolean) : [];
  const main = `    <section class="co-card co-hero">
      <h2>${esc(r.name)}</h2>
      <p class="co-lead">${esc(r.summary)}</p>
      <p class="co-muted">${esc(ROLE[r.role])} · ${esc(r.cuisine)}</p>
      ${tagsHtml(r)}
    </section>

    <section class="co-card">
      <h2>AT A GLANCE</h2>
      <div class="co-stats">
        <div><b>${minutes(r.time.total)}</b>total time</div>
        <div><b>${minutes(r.time.prep)}</b>prep</div>
        <div><b>${minutes(r.time.cook)}</b>cooking</div>
        <div><b>${r.serves}</b>${r.serves === 1 ? 'serving' : 'servings'}</div>
      </div>
      <p class="co-hint">Good for: ${r.occasions.map(o => OCC[o].toLowerCase()).join(', ')}.</p>
      <p><b>Contains:</b> ${esc(allergens)}.</p>
    </section>

    <section class="co-card" id="ingredients">
      <h2>INGREDIENTS</h2>
      <ul class="co-ingredients">
${lines.map(l => `        <li>${l.qty ? `<b>${esc(l.qty)}</b> ` : ''}${esc(l.text)}</li>`).join('\n')}
      </ul>
    </section>

    <section class="co-card" id="method">
      <h2>METHOD</h2>
      <ol class="co-method">
${steps}
      </ol>
    </section>

    <section class="co-card">
      <h2>ABOUT THIS RECIPE</h2>
      <p class="co-note">${esc(AI_NOTE)}</p>
      ${r.tags.includes('kid') ? '<p>Kids can make this one. Steps marked <b>Grown-up helps</b> use a knife, the stove, the oven or something hot, so an adult does those or stays right beside them.</p>' : ''}
    </section>`;
  const side = `    <div class="co-card"><h2>ON PBC COOKING</h2>
      ${show ? `<p>Cooked in <b>${esc(show.name)}</b>, in the ${esc(SHOWS.sections[show.section].name)} part of the show${show.country ? ', from ' + esc(show.country) : ''}.</p>` : ''}
      <p><span class="co-tag soon">WATCH IT MADE: COMING SOON</span></p>
      ${sameShow.length ? `<p>Also in this show:</p><ul class="co-dir">${sameShow.map(o => `<li><a href="../${o.slug}/">${esc(o.name)}</a></li>`).join('')}</ul>` : ''}
    </div>
    <div class="co-card"><h2>MORE RECIPES</h2><ul class="co-dir">
      <li><a href="../">Search all recipes</a></li>
      <li><a href="../?kid=1">Kid-friendly</a></li>
      <li><a href="../?quick=1">Quick (15 min or less)</a></li>
      <li><a href="../?veg=1">Vegetarian</a></li>
    </ul></div>`;
  return page({up: '../../', title: r.name + ' recipe', description: r.summary + ' ' + minutes(r.time.total) + ', serves ' + r.serves + '. An AI-written recipe from PBC Cooking.',
    canonical: url, dept: r.name.toUpperCase(), main, side, head});
}

/* ---------- the recipe box (search page) ---------- */
function indexPage() {
  const opts = (o, all) => `<option value="">${all}</option>` + Object.entries(o).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('');
  const roles = Object.fromEntries(Object.entries(ROLE).filter(([k]) => RECIPES.some(r => r.role === k)));
  const occs = Object.fromEntries(Object.entries(OCC).filter(([k]) => RECIPES.some(r => r.occasions.includes(k))));
  // the full list is in the page itself, so it reads without scripts and search engines see every recipe
  const cards = RECIPES.map(r => `        <li class="co-result" data-slug="${r.slug}"><h3><a href="${r.slug}/">${esc(r.name)}</a></h3><p>${esc(r.summary)}</p>${tagsHtml(r)}<p class="co-meta">${minutes(r.time.total)} · serves ${r.serves} · ${esc(r.cuisine)}</p></li>`).join('\n');
  const main = `    <section class="co-card co-hero">
      <h2>THE PBC RECIPE BOX</h2>
      <p class="co-lead">Every recipe cooked on PBC Cooking, from a two-minute smoothie to Thanksgiving dinner.</p>
      <p>Search by name or ingredient, or narrow it down by course, occasion, difficulty and time. Kids can make anything tagged <b>kid-friendly</b>, with a grown-up on the hot and sharp steps.</p>
    </section>

    <section class="co-card" id="find">
      <h2>FIND A RECIPE</h2>
      <form class="co-searchform" role="search" action="./" onsubmit="return false">
        <div class="co-search">
          <label class="co-hp" for="q">Search recipes</label>
          <input type="search" id="q" name="q" placeholder="Try lemon, pancakes or chicken" autocomplete="off" spellcheck="false">
        </div>
        <div class="co-filters">
          <div><label for="role">COURSE</label><select id="role" name="role">${opts(roles, 'Any course')}</select></div>
          <div><label for="occ">OCCASION</label><select id="occ" name="occ">${opts(occs, 'Any occasion')}</select></div>
          <div><label for="level">DIFFICULTY</label><select id="level" name="level"><option value="">Any level</option><option value="easy">Easy</option><option value="medium">Medium and easier</option><option value="hard">Any, including hard</option></select></div>
          <div><label for="time">TIME</label><select id="time" name="time"><option value="">Any time</option><option value="15">15 min or less</option><option value="30">30 min or less</option><option value="60">1 hour or less</option></select></div>
          <fieldset><legend>SHOW ONLY</legend><div class="co-checks">
            <label><input type="checkbox" id="kid" name="kid" value="1"> Kid-friendly</label>
            <label><input type="checkbox" id="quick" name="quick" value="1"> Quick</label>
            <label><input type="checkbox" id="veg" name="veg" value="1"> Vegetarian</label>
          </div></fieldset>
          <fieldset><legend>LEAVE OUT</legend><div class="co-checks">
${Object.entries(ALLERGEN).map(([k, v]) => `            <label><input type="checkbox" name="no" value="${k}"> ${esc(v)}</label>`).join('\n')}
          </div></fieldset>
        </div>
      </form>
      <p class="co-count" id="count" aria-live="polite">${RECIPES.length} recipes</p>
    </section>

    <section class="co-card" aria-label="Recipes">
      <ul class="co-results" id="results">
${cards}
      </ul>
    </section>

    <section class="co-card">
      <h2>ABOUT THESE RECIPES</h2>
      <p class="co-note">${esc(AI_NOTE)}</p>
    </section>`;
  const side = `    <div class="co-card"><h2>QUICK PICKS</h2><ul class="co-dir">
      <li><a href="./?kid=1">Kid-friendly</a></li>
      <li><a href="./?quick=1">Quick (15 min or less)</a></li>
      <li><a href="./?veg=1">Vegetarian</a></li>
      <li><a href="./?occ=breakfast">Breakfast</a></li>
      <li><a href="./?role=dessert">Desserts</a></li>
      <li><a href="./?occ=holiday">Holidays</a></li>
    </ul></div>`;
  return page({up: '../', title: 'Recipes', description: `Search ${RECIPES.length} AI-written recipes from PBC Cooking by name, ingredient, course, occasion, difficulty and time, with kid-friendly, quick and vegetarian picks.`,
    canonical: SITE + 'recipes/', dept: 'THE RECIPE BOX', main, side, head: '<script src="search.js" defer></script>\n'});
}

function indexJson() {
  const rows = RECIPES.map(r => {
    const show = SHOW_OF.get(r.slug);
    return {s: r.slug, n: r.name, d: r.summary, r: r.role, c: r.cuisine, o: r.occasions, l: r.difficulty, t: r.tags, m: r.time.total, v: r.serves, a: r.allergens,
      i: r.ingredients.map(i => LIB.ingredients[i.id].name), w: show ? show.name : ''};
  });
  return '[\n' + rows.map(x => JSON.stringify(x)).join(',\n') + '\n]\n';
}

function sitemap() {
  const pages = ['', 'sports/', 'recipes/', 'about/', 'advertise/', 'contact/', 'sources/', 'corrections/', 'accessibility/', 'ad-policy/', 'privacy/', 'terms/']
    .concat(RECIPES.map(r => 'recipes/' + r.slug + '/'));
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    pages.map(p => `  <url><loc>${SITE}${p}</loc></url>`).join('\n') + '\n</urlset>\n';
}

/* ---------- write, or check ---------- */
const out = new Map();
out.set('recipes/index.html', indexPage());
out.set('recipes/index.json', indexJson());
for (const r of RECIPES) out.set(`recipes/${r.slug}/index.html`, recipePage(r));
out.set('sitemap.xml', sitemap());
out.set('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE}sitemap.xml\n`);

// recipe pages for recipes that no longer exist
const stale = fs.existsSync(path.join(ROOT, 'recipes')) ? fs.readdirSync(path.join(ROOT, 'recipes'), {withFileTypes: true})
  .filter(d => d.isDirectory() && !BY.has(d.name)).map(d => 'recipes/' + d.name) : [];

if (process.argv.includes('--check')) {
  const bad = [...out].filter(([f, text]) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8') !== text; } catch (e) { return true; } }).map(([f]) => f);
  bad.push(...stale);
  if (bad.length) {
    console.error('✗ The recipe site is out of date with data/cooking/. Run node tools/build_recipes.cjs and commit the result:\n  ' + bad.join('\n  '));
    process.exit(1);
  }
  console.log(`✓ The recipe site matches the data (${RECIPES.length} recipe pages).`);
} else {
  for (const [f, text] of out) { fs.mkdirSync(path.dirname(path.join(ROOT, f)), {recursive: true}); fs.writeFileSync(path.join(ROOT, f), text); }
  for (const d of stale) fs.rmSync(path.join(ROOT, d), {recursive: true});
  console.log(`Wrote the recipe box, ${RECIPES.length} recipe pages, the search index and the sitemap.`);
}
