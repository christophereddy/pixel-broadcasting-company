/* PBC Cooking: My Kitchen, where a viewer writes a recipe of their own and the channel cooks it (cooking/?recipe=mine-<slug>).
   The recipe is checked in the browser with the same rules every PBC recipe passes (cooking/rules.js), so the kitchen can
   show every amount, timer and temperature, and it's saved in this browser only (cooking/mine.js). Nothing is sent anywhere.
   The saved recipe is in the same format as data/cooking/recipes/<slug>.json, so sending one in to PBC later is one button. */
(async function(){
"use strict";
const $ = id => document.getElementById(id);
const RULES = PBC_RULES, MINE = PBC_MINE;
const DRAFT = "pbc.myKitchen.draft";

let LIB = null, MENU = null;
try { const r = await fetch("../../data/cooking/ingredients.json", {cache: "no-cache"}); if (r.ok) LIB = await r.json(); } catch (e) {}
try { const r = await fetch("../menu.json", {cache: "no-cache"}); if (r.ok) MENU = await r.json(); } catch (e) {}
if (!LIB || !LIB.ingredients) { $("loadErr").hidden = false; return; }

/* ---------- words ---------- */
const ROLE = {breakfast: "Breakfast", starter: "Starter", main: "Main", side: "Side", dessert: "Dessert", drink: "Drink", snack: "Snack", sauce: "Sauce"};
const OCC = {breakfast: "Breakfast", brunch: "Brunch", lunch: "Lunch", lunchbox: "Lunchbox", weeknight: "Weeknight dinner", "family-dinner": "Family dinner",
  comfort: "Comfort food", "date-night": "Date night", party: "Party", "game-day": "Game day", picnic: "Picnic", snack: "Snack", baking: "Baking",
  holiday: "Holiday", leftovers: "Leftovers"};
const ALLERGEN = {milk: "milk", egg: "egg", wheat: "wheat", soy: "soy", peanut: "peanuts", "tree-nut": "tree nuts", fish: "fish", shellfish: "shellfish", sesame: "sesame"};
const UNIT_WORD = {tsp: "tsp", tbsp: "tbsp", cup: "cup", ml: "ml", l: "liter", g: "g", kg: "kg", oz: "oz", lb: "lb", piece: "whole", slice: "slice", clove: "clove",
  sprig: "sprig", leaf: "leaf", pinch: "pinch", can: "can", sheet: "sheet", stalk: "stalk", bunch: "bunch", "to-taste": "to taste"};
const TOOL = {none: "No tool", knife: "Knife", stove: "Stove", oven: "Oven", blender: "Blender"};
const HEAT = {low: "Low", "medium-low": "Medium-low", medium: "Medium", "medium-high": "Medium-high", high: "High"};
const nameOf = id => (LIB.ingredients[id] || {}).name || id;
const and = a => a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
const el = (tag, props, kids) => { const e = document.createElement(tag); if (props) Object.assign(e, props); for (const k of kids || []) e.append(k); return e; };
const option = (value, text, sel) => el("option", {value, textContent: text, selected: !!sel});

// amounts as a cook types them: "2", "1.5", "1 1/2", "½", "1½"
const VULGAR = {"⅛": 0.125, "¼": 0.25, "⅓": 1 / 3, "½": 0.5, "⅔": 2 / 3, "¾": 0.75};
function parseQty(s){
  s = String(s || "").trim().replace(/([⅛¼⅓½⅔¾])/g, " $1").trim();
  if (!s) return undefined;
  let q = 0;
  for (const part of s.split(/\s+/)) {
    if (VULGAR[part] !== undefined) q += VULGAR[part];
    else if (/^\d+\/\d+$/.test(part)) { const [a, b] = part.split("/").map(Number); if (!b) return NaN; q += a / b; }
    else if (/^\d*\.?\d+$/.test(part)) q += +part;
    else return NaN;
  }
  return Math.round(q * 1000) / 1000;
}
const showQty = q => q === undefined || q === null || isNaN(q) ? "" : RULES.amount(q);
const int = s => { s = String(s === undefined ? "" : s).trim(); return s === "" ? undefined : (/^\d+$/.test(s) ? +s : NaN); };
const num = s => { s = String(s === undefined ? "" : s).trim(); return s === "" ? undefined : (/^\d*\.?\d+$/.test(s) ? +s : NaN); };
const slugify = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48).replace(/-+$/, "") || "my-recipe";

/* ---------- the usual unit and form for each ingredient, from PBC's own recipes ---------- */
const USUAL = {};
if (MENU && MENU.recipes) {
  const count = {};
  for (const r of Object.values(MENU.recipes)) for (const i of r.ingredients) {
    const c = count[i.id] = count[i.id] || {unit: {}, form: {}};
    c.unit[i.unit] = (c.unit[i.unit] || 0) + 1; c.form[i.form] = (c.form[i.form] || 0) + 1;
  }
  const top = o => Object.entries(o).sort((a, b) => b[1] - a[1])[0][0];
  for (const [id, c] of Object.entries(count)) USUAL[id] = {unit: top(c.unit), form: top(c.form)};
}
const GROUP_UNIT = {vegetable: "piece", fruit: "piece", herb: "sprig", protein: "lb", dairy: "cup", bread: "slice", grain: "cup", baking: "cup", spice: "tsp",
  pantry: "tbsp", drink: "cup", nut: "cup"};
function usual(id){
  const g = LIB.ingredients[id].group, forms = LIB.groups[g].forms, u = USUAL[id] || {};
  return {unit: u.unit || GROUP_UNIT[g] || "cup", form: forms.includes(u.form) ? u.form : forms[0]};
}

/* ---------- the recipe being written ----------
   D holds what the viewer typed (amounts as text), toRecipe() turns it into a recipe in the data/cooking/recipes format. */
let D = null, dirty = false;
function blank(){
  return {slug: null, name: "", summary: "", role: "main", cuisine: "", difficulty: "easy", serves: "4", prep: "", cook: "", total: "",
    occasions: [], tags: [], ings: [], steps: [blankStep()]};
}
function blankStep(){ return {do: "", tool: "none", heat: "", oven_f: "", timer: "", temp_f: "", cue: "", help: false, uses: {}}; }
function fromRecipe(r, slug){
  const d = blank();
  Object.assign(d, {slug: slug === undefined ? r.slug || null : slug, name: r.name || "", summary: r.summary || "", role: r.role || "main", cuisine: r.cuisine || "",
    difficulty: r.difficulty || "easy", serves: r.serves ? String(r.serves) : "", occasions: (r.occasions || []).slice(), tags: (r.tags || []).slice()});
  const t = r.time || {};
  d.prep = t.prep === undefined ? "" : String(t.prep); d.cook = t.cook === undefined ? "" : String(t.cook); d.total = t.total === undefined ? "" : String(t.total);
  d.ings = (r.ingredients || []).filter(i => LIB.ingredients[i.id]).map(i => ({id: i.id, qty: showQty(i.qty), unit: i.unit, form: i.form}));
  d.steps = (r.steps || []).map(s => {
    const st = blankStep();
    for (const k of ["do", "heat", "cue"]) if (s[k] !== undefined) st[k] = String(s[k]);
    for (const k of ["oven_f", "timer", "temp_f"]) if (s[k] !== undefined) st[k] = String(s[k]);
    st.tool = s.tool || "none"; st.help = s.help === true;
    for (const u of s.uses || []) st.uses[u.id] = u.unit === "to-taste" ? "" : showQty((parseQty(st.uses[u.id]) || 0) + (u.qty || 0));
    return st;
  });
  if (!d.steps.length) d.steps.push(blankStep());
  return d;
}
function toRecipe(d){
  const ings = d.ings.map(i => { const o = {id: i.id}; if (i.unit !== "to-taste") o.qty = parseQty(i.qty); o.unit = i.unit; o.form = i.form; return o; });
  const unitOf = new Map(ings.map(i => [i.id, i.unit]));
  const prep = int(d.prep), cook = int(d.cook);
  const r = {slug: d.slug || slugify(d.name), name: d.name.trim(), summary: d.summary.trim(), role: d.role, cuisine: d.cuisine.trim() || "Home cooking",
    occasions: d.occasions.slice(), difficulty: d.difficulty, tags: RULES.TAGS.filter(t => d.tags.includes(t)), serves: int(d.serves),
    time: {prep, cook, total: d.total.trim() === "" && prep !== undefined && cook !== undefined && !isNaN(prep + cook) ? prep + cook : int(d.total)}};
  r.ingredients = ings;
  r.allergens = RULES.allergensOf(r, LIB);
  r.steps = d.steps.map(s => {
    const o = {do: s.do.trim()};
    const uses = d.ings.filter(i => s.uses[i.id] !== undefined).map(i => {
      const u = {id: i.id}; if (i.unit !== "to-taste") u.qty = parseQty(s.uses[i.id]); u.unit = unitOf.get(i.id); return u; });
    if (uses.length) o.uses = uses;
    if (s.tool && s.tool !== "none") o.tool = s.tool;
    if (s.tool === "stove" && s.heat) o.heat = s.heat;
    if (s.tool === "oven" && s.oven_f.trim()) o.oven_f = int(s.oven_f);
    if (s.timer.trim()) o.timer = num(s.timer);
    if (s.temp_f.trim()) o.temp_f = int(s.temp_f);
    if (s.cue.trim()) o.cue = s.cue.trim();
    if (s.help) o.help = true;
    return o;
  });
  return r;
}

/* ---------- the check, in the viewer's words ---------- */
function unitText(q, unit){ return RULES.ingredientLine({id: "salt", qty: q, unit}, {ingredients: {salt: {name: "x"}}}).qty || showQty(q); }
function friendly(p){
  const m = p.msg, step = /^step (\d+)$/.exec(p.at), S = step ? "Step " + step[1] + " " : "";
  const say = (s, both) => (step ? S + s : both || s).replace(/^./, c => c.toUpperCase());
  let x;
  if ((x = /^"([\w-]+)" is listed but no step uses it$/.exec(m))) return `${nameOf(x[1])} isn't in any step yet. Tick it under GOES IN on the step where it's added.`;
  if ((x = /^steps use ([\d.]+) (\S+) of ([\w-]+) but the list says ([\d.]+)$/.exec(m))) return `The steps add ${unitText(+x[1], x[2])} of ${nameOf(x[3]).toLowerCase()}, but the ingredient list says ${unitText(+x[4], x[2])}.`;
  if ((x = /^mentions (.+) min but sets no timer$/.exec(m))) return say(`says ${x[1].split(" / ").map(n => showQty(+n)).join(" or ")} minutes, so set its timer.`);
  if ((x = /^timer is ([\d.]+) min but the step says (.+) min$/.exec(m))) return say(`has a ${showQty(+x[1])}-minute timer, but it says ${x[2].split(" / ").map(n => showQty(+n)).join(" or ")} minutes.`);
  if (/^a stove step needs heat/.test(m)) return say("is on the stove: pick the heat.");
  if (/^an oven step needs oven_f/.test(m)) return say("is in the oven: give the oven temperature, from 200 to 550°F.");
  if ((x = /^says (\d+)°F but/.exec(m))) return say(`says ${x[1]}°F: put it in OVEN °F, or in CHECK INSIDE °F if that's the temperature to check.`);
  if ((x = /^([\w-]+) must be checked at (\d+)°F inside/.exec(m))) return `${nameOf(x[1])} has to reach ${x[2]}°F inside to be safe to eat. Put ${x[2]} in CHECK INSIDE °F on the step where you check it.`;
  if ((x = /^([\w-]+) goes in but is never cooked/.exec(m))) return `${nameOf(x[1])} has to be cooked: add a stove or oven step after it goes in.`;
  if ((x = /^kid recipe: a (\w+) step needs/.exec(m))) return say(`uses the ${x[1]}, so tick GROWN-UP HELPS. It's a kid-friendly recipe.`);
  if (/^a kid recipe cannot be hard/.test(m)) return "A kid-friendly recipe can't be hard: make it easy or medium.";
  if ((x = /^tagged quick but takes (\d+)/.exec(m))) return `Quick means 15 minutes or less in all, and this takes ${x[1]}.`;
  if ((x = /^tagged vegetarian but uses ([\w-]+)/.exec(m))) return `It's tagged vegetarian, but it has ${nameOf(x[1]).toLowerCase()} in it.`;
  if (/^time\.total .* is less than/.test(m)) return "The total time is less than prep and cooking added together.";
  if ((x = /^time\.(\w+) must be whole minutes/.exec(m))) return `Give the ${{prep: "prep", cook: "cooking", total: "total"}[x[1]]} time in whole minutes.`;
  if (m === "needs a name") return "Give your recipe a name.";
  if (m === "needs a summary") return "Say what it is in one line.";
  if (m === "needs a cuisine") return "Say what cuisine it is.";
  if (/^occasions must/.test(m)) return "Tick at least one thing it's good for.";
  if (/^serves must/.test(m)) return "Say how many people it serves.";
  if (m === "has no ingredients") return "Add the ingredients.";
  if (m === "has no steps") return "Add a step.";
  if (/needs its instruction/.test(m)) return say("is empty: write what to do.");
  if ((x = /^"([\w-]+)" needs a qty above 0/.exec(m))) return `${nameOf(x[1])} needs an amount.`;
  if ((x = /^uses ([\w-]+) without an amount/.exec(m))) return say(`adds ${nameOf(x[1]).toLowerCase()} without an amount.`);
  if (/^timer must be minutes above 0/.test(m)) return say("needs its timer in minutes, or no timer at all.");
  if (/^temp_f must be whole/.test(m)) return say("needs CHECK INSIDE °F in whole degrees.");
  if (/^an oven step|oven_f/.test(m)) return say("needs the oven temperature in whole degrees, from 200 to 550°F.");
  return say(m.replace(/"?([a-z]+(?:-[a-z]+)+)"?/g, (all, id) => LIB.ingredients[id] ? nameOf(id).toLowerCase() : all));
}

/* ---------- the form ---------- */
const form = $("kit");
function fillSelects(){
  $("k-role").replaceChildren(...RULES.ROLES.map(k => option(k, ROLE[k])));
  $("k-occ").replaceChildren(...RULES.OCCASIONS.map(k => el("label", null, [el("input", {type: "checkbox", name: "occ", value: k}), " " + OCC[k]])));
  const names = Object.entries(LIB.ingredients).sort((a, b) => a[1].name.localeCompare(b[1].name));
  $("k-lib").replaceChildren(...names.map(([, i]) => option(i.name, LIB.groups[i.group].name)));
  $("libCount").textContent = names.length;
  if (MENU && MENU.recipes) {
    const all = Object.entries(MENU.recipes).sort((a, b) => a[1].name.localeCompare(b[1].name));
    $("k-from").append(...all.map(([slug, r]) => option(slug, r.name)));
  } else $("k-from").closest(".co-card").hidden = true;
}
function renderAbout(){
  $("k-name").value = D.name; $("k-sum").value = D.summary; $("k-role").value = D.role; $("k-cuisine").value = D.cuisine;
  $("k-level").value = D.difficulty; $("k-serves").value = D.serves; $("k-prep").value = D.prep; $("k-cook").value = D.cook; $("k-total").value = D.total;
  form.querySelectorAll("input[name=occ]").forEach(c => c.checked = D.occasions.includes(c.value));
  form.querySelectorAll("input[name=tag]").forEach(c => c.checked = D.tags.includes(c.value));
}
function renderIngs(){
  const ul = $("k-ings");
  ul.replaceChildren(...D.ings.map((ing, i) => {
    const lib = LIB.ingredients[ing.id], forms = LIB.groups[lib.group].forms;
    const qty = el("input", {type: "text", inputMode: "decimal", value: ing.qty, placeholder: "1", hidden: ing.unit === "to-taste", ariaLabel: lib.name + " amount"});
    qty.dataset.f = "qty"; qty.dataset.i = i;
    const unit = el("select", {ariaLabel: lib.name + " unit"}, RULES.UNITS.map(u => option(u, UNIT_WORD[u], u === ing.unit)));
    unit.dataset.f = "unit"; unit.dataset.i = i;
    const fm = el("select", {ariaLabel: lib.name + " form"}, forms.map(f => option(f, f, f === ing.form)));
    fm.dataset.f = "form"; fm.dataset.i = i;
    const rm = el("button", {type: "button", className: "co-kit-x", textContent: "✕", ariaLabel: "Remove " + lib.name});
    rm.dataset.act = "rm-ing"; rm.dataset.i = i;
    const tally = el("span", {className: "co-hint co-kit-tally"}); tally.dataset.tally = ing.id;
    return el("li", null, [el("b", {textContent: lib.name}), el("div", {className: "co-kit-amt"}, [qty, unit, fm, rm]), tally]);
  }));
  if (!D.ings.length) ul.append(el("li", {className: "co-hint", textContent: "No ingredients yet."}));
}
function renderSteps(){
  const ol = $("k-steps");
  ol.replaceChildren(...D.steps.map((s, si) => {
    const f = (tag, field, props, kids) => { const e = el(tag, props, kids); e.dataset.s = si; e.dataset.f = field; return e; };
    const lab = (text, input) => el("div", {className: "co-kit-field"}, [el("label", {textContent: text, htmlFor: input.id}), input]);
    const id = k => "s" + si + "-" + k;
    const doBox = f("textarea", "do", {id: id("do"), value: s.do, maxLength: 300, placeholder: si ? "Cook in a pan for 4 minutes, until golden underneath." : "Melt the butter in a pan."});
    const tool = f("select", "tool", {id: id("tool")}, Object.keys(TOOL).map(k => option(k, TOOL[k], k === s.tool)));
    const heat = f("select", "heat", {id: id("heat")}, [option("", "Pick the heat", !s.heat)].concat(RULES.HEATS.map(k => option(k, HEAT[k], k === s.heat))));
    const oven = f("input", "oven_f", {id: id("oven"), type: "text", inputMode: "numeric", value: s.oven_f, placeholder: "350"});
    const timer = f("input", "timer", {id: id("timer"), type: "text", inputMode: "decimal", value: s.timer, placeholder: "none"});
    const temp = f("input", "temp_f", {id: id("temp"), type: "text", inputMode: "numeric", value: s.temp_f, placeholder: "none"});
    const cue = f("input", "cue", {id: id("cue"), type: "text", maxLength: 60, value: s.cue, placeholder: "golden brown"});
    const help = f("input", "help", {type: "checkbox", checked: s.help});
    const heatF = lab("HEAT", heat), ovenF = lab("OVEN °F", oven);
    heatF.hidden = s.tool !== "stove"; ovenF.hidden = s.tool !== "oven";
    heatF.dataset.only = "stove"; ovenF.dataset.only = "oven";
    // what goes in at this step: every ingredient, ticked with its amount
    const goes = D.ings.map(ing => {
      const on = s.uses[ing.id] !== undefined, lib = LIB.ingredients[ing.id];
      const cb = f("input", "use", {type: "checkbox", checked: on}); cb.dataset.id = ing.id;
      const kids = [el("label", null, [cb, " " + lib.name])];
      if (ing.unit !== "to-taste") {
        const q = f("input", "useqty", {type: "text", inputMode: "decimal", value: on ? s.uses[ing.id] : "", hidden: !on, ariaLabel: lib.name + " at step " + (si + 1)});
        q.dataset.id = ing.id;
        kids.push(el("span", {className: "co-kit-useq", hidden: !on}, [q, " " + UNIT_WORD[ing.unit]]));
      }
      return el("li", null, kids);
    });
    const btn = (text, act, label, off) => { const b = el("button", {type: "button", className: "co-kit-x", textContent: text, ariaLabel: label, disabled: !!off}); b.dataset.act = act; b.dataset.s = si; return b; };
    return el("li", null, [
      el("div", {className: "co-kit-stephead"}, [el("span", {className: "co-kit-n", textContent: "STEP " + (si + 1)}),
        el("span", {className: "co-kit-move"}, [btn("▲", "up", "Move step " + (si + 1) + " up", si === 0), btn("▼", "down", "Move step " + (si + 1) + " down", si === D.steps.length - 1),
          btn("✕", "rm-step", "Remove step " + (si + 1), D.steps.length === 1)])]),
      lab("WHAT TO DO", doBox),
      el("div", {className: "co-kit-grid"}, [lab("TOOL", tool), heatF, ovenF, lab("TIMER (MIN)", timer), lab("CHECK INSIDE °F", temp), lab("DONE WHEN", cue)]),
      el("label", {className: "co-agree"}, [help, " GROWN-UP HELPS (a knife, the stove, the oven or something hot)"]),
      el("p", {className: "co-kit-goes", textContent: D.ings.length ? "GOES IN" : "GOES IN: add ingredients first"}),
      el("ul", {className: "co-kit-uses"}, goes)
    ]);
  }));
}
function renderAll(){ renderAbout(); renderIngs(); renderSteps(); check(); }

/* ---------- the check ---------- */
let current = null;   // {recipe, problems}
function check(){
  const r = toRecipe(D), problems = RULES.check(r, LIB);
  current = {recipe: r, problems};
  $("k-allergens").textContent = r.allergens.length ? "Contains " + and(r.allergens.map(a => ALLERGEN[a])) + ", from its ingredients." : "Contains none of the major allergens.";
  // how much of each ingredient the steps add so far
  const used = {};
  for (const s of r.steps) for (const u of s.uses || []) used[u.id] = (used[u.id] || 0) + (u.qty || 0);
  form.querySelectorAll("[data-tally]").forEach(t => {
    const ing = r.ingredients.find(i => i.id === t.dataset.tally); if (!ing) return;
    const inSteps = r.steps.some(s => (s.uses || []).some(u => u.id === ing.id));
    if (ing.unit === "to-taste") { t.textContent = inSteps ? "In a step." : "Not in a step yet."; t.classList.toggle("co-kit-off", !inSteps); return; }
    const u = used[ing.id] || 0, ok = ing.qty && Math.abs(u - ing.qty) < 0.011;
    t.textContent = !inSteps ? "Not in a step yet." : ok ? "All of it goes in." : "The steps add " + unitText(u, ing.unit) + ".";
    t.classList.toggle("co-kit-off", !ok);
  });
  const ul = $("k-probs");
  ul.replaceChildren(...problems.map(p => el("li", {textContent: friendly(p)})));
  const ok = !problems.length;
  $("k-verdict").textContent = ok ? "Everything checks out. Save it, then watch the kitchen make it." :
    problems.length + (problems.length === 1 ? " thing to fix" : " things to fix") + " before the kitchen can cook it:";
  $("k-verdict").className = ok ? "co-kit-ok" : "";
  $("k-watch").setAttribute("aria-disabled", ok ? "false" : "true");
  return current;
}

/* ---------- saving ---------- */
function status(text, cls){ const s = $("formStatus"); s.textContent = text; s.className = cls || ""; }
function keepDraft(){ try { localStorage.setItem(DRAFT, JSON.stringify(D)); } catch (e) {} }
function uniqueSlug(base){
  let s = base, n = 2;
  while (MINE.get(s) && s !== D.slug) s = base + "-" + n++;
  return s;
}
function save(){
  if (!D.name.trim()) { status("Give your recipe a name first.", "err"); $("k-name").focus(); return false; }
  if (!D.slug) D.slug = uniqueSlug(slugify(D.name));
  const {recipe, problems} = check(), ok = !problems.length;
  const done = MINE.save({recipe, ok, menu: ok ? RULES.menuRecipe(recipe, LIB) : null});
  if (!done) { status("This browser won't let PBC save here (private browsing can do that). Use DOWNLOAD to keep a copy.", "err"); return false; }
  dirty = false; keepDraft(); renderMine(); setUrl();
  status(ok ? "Saved, and ready to watch." : "Saved. Fix the list above and the kitchen can cook it.", ok ? "ok" : "warn");
  return true;
}
function setUrl(){ try { history.replaceState(null, "", location.pathname + (D.slug && MINE.get(D.slug) ? "?edit=" + encodeURIComponent(D.slug) : "")); } catch (e) {} }
const watchUrl = slug => "../?recipe=" + encodeURIComponent(MINE.KEY_PREFIX + slug);
function renderMine(){
  const list = MINE.list();
  $("k-none").hidden = !!list.length;
  $("k-mine").replaceChildren(...list.map(e => {
    const r = e.recipe, mine = r.slug === D.slug;
    const edit = el("button", {type: "button", className: "co-kit-link", textContent: r.name || "Untitled"}); edit.dataset.act = "edit"; edit.dataset.slug = r.slug;
    const kids = [edit, el("span", {className: "co-tag " + (e.ok ? "veg" : "soon"), textContent: e.ok ? "READY" : "NEEDS FIXES"})];
    const row = el("div", {className: "co-kit-row"});
    if (e.ok) row.append(el("a", {href: watchUrl(r.slug), textContent: "▶ WATCH"}));
    const del = el("button", {type: "button", className: "co-kit-link", textContent: "DELETE"}); del.dataset.act = "delete"; del.dataset.slug = r.slug;
    row.append(del);
    const li = el("li", {className: mine ? "on" : ""}, kids.concat(row));
    return li;
  }));
}
function open(d){ D = d; dirty = false; renderAll(); renderMine(); setUrl(); keepDraft(); status(""); }

/* ---------- typing ---------- */
const ABOUT = {"k-name": "name", "k-sum": "summary", "k-role": "role", "k-cuisine": "cuisine", "k-level": "difficulty", "k-serves": "serves", "k-prep": "prep", "k-cook": "cook", "k-total": "total"};
function changed(){ dirty = true; check(); keepDraft(); status(""); }
form.addEventListener("input", e => {
  const t = e.target, f = t.dataset.f;
  if (ABOUT[t.id]) D[ABOUT[t.id]] = t.value;
  else if (t.name === "occ" || t.name === "tag") { const k = t.name === "occ" ? "occasions" : "tags"; D[k] = [...form.querySelectorAll(`input[name=${t.name}]:checked`)].map(c => c.value); }
  else if (f === "qty") D.ings[+t.dataset.i].qty = t.value;
  else if (f === "unit" || f === "form") {
    const ing = D.ings[+t.dataset.i]; ing[f] = t.value;
    if (f === "unit") { if (t.value === "to-taste") ing.qty = ""; D.steps.forEach(s => { if (s.uses[ing.id] !== undefined) s.uses[ing.id] = t.value === "to-taste" ? "" : s.uses[ing.id]; }); renderIngs(); renderSteps(); }
  }
  else if (t.dataset.s !== undefined) {
    const s = D.steps[+t.dataset.s];
    if (f === "use") {
      const ing = D.ings.find(i => i.id === t.dataset.id);
      if (t.checked) {
        // start with what's left of the amount once the other steps have theirs
        const other = D.steps.reduce((a, x) => a + (x !== s && x.uses[ing.id] !== undefined ? parseQty(x.uses[ing.id]) || 0 : 0), 0);
        const left = (parseQty(ing.qty) || 0) - other;
        s.uses[ing.id] = ing.unit === "to-taste" ? "" : left > 0 ? showQty(left) : "";
      } else delete s.uses[ing.id];
      renderSteps();
      const again = form.querySelector(`input[data-f=use][data-s="${t.dataset.s}"][data-id="${ing.id}"]`); if (again) again.focus();
    }
    else if (f === "useqty") s.uses[t.dataset.id] = t.value;
    else if (f === "help") s.help = t.checked;
    else if (f === "tool") {
      s.tool = t.value;
      t.closest("li").querySelectorAll("[data-only]").forEach(x => x.hidden = x.dataset.only !== s.tool);
      if (["knife", "stove", "oven"].includes(s.tool) && D.tags.includes("kid")) { s.help = true; const h = t.closest("li").querySelector("input[data-f=help]"); if (h) h.checked = true; }
    }
    else if (f in s) s[f] = t.value;
  }
  else return;
  changed();
});
form.addEventListener("submit", e => e.preventDefault());

function addIngredient(){
  const v = $("k-find").value.trim().toLowerCase(), msg = $("k-findmsg");
  if (!v) return;
  // "eggs" finds Egg and "tomato" finds Tomatoes: try the word as typed and without a plural ending, both ways
  const forms = w => [...new Set([w, w.replace(/s$/, ""), w.replace(/es$/, "")])], want = forms(v), all = Object.entries(LIB.ingredients);
  const hit = all.find(([id, i]) => id === v || forms(i.name.toLowerCase()).some(n => want.includes(n))) ||
    all.filter(([, i]) => want.some(w => i.name.toLowerCase().includes(w))).sort((a, b) => a[1].name.length - b[1].name.length)[0];
  if (!hit) { msg.textContent = `The kitchen can't draw "${$("k-find").value.trim()}" yet. Try another word for it, or the nearest thing it has.`; return; }
  const [id, lib] = hit;
  if (D.ings.some(i => i.id === id)) { msg.textContent = lib.name + " is already on the list."; $("k-find").value = ""; return; }
  const u = usual(id);
  D.ings.push({id, qty: u.unit === "to-taste" ? "" : "1", unit: u.unit, form: u.form});
  msg.textContent = "Added " + lib.name + ". Check its amount.";
  $("k-find").value = "";
  renderIngs(); renderSteps(); changed();
  const q = $("k-ings").querySelector(`li:nth-child(${D.ings.length}) input`); if (q && !q.hidden) q.select();
}
$("k-add").addEventListener("click", addIngredient);
$("k-find").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); addIngredient(); } });
$("k-find").addEventListener("change", () => { const v = $("k-find").value.trim().toLowerCase(); if (Object.values(LIB.ingredients).some(i => i.name.toLowerCase() === v)) addIngredient(); });
$("k-addstep").addEventListener("click", () => {
  D.steps.push(blankStep()); renderSteps(); changed();
  const box = $("s" + (D.steps.length - 1) + "-do"); if (box) box.focus();
});

document.addEventListener("click", e => {
  const b = e.target.closest("[data-act]"); if (!b) return;
  const act = b.dataset.act, si = +b.dataset.s;
  if (act === "rm-ing") {
    const ing = D.ings.splice(+b.dataset.i, 1)[0];
    D.steps.forEach(s => delete s.uses[ing.id]);
    renderIngs(); renderSteps(); changed();
  } else if (act === "up" || act === "down") {
    const j = act === "up" ? si - 1 : si + 1; if (j < 0 || j >= D.steps.length) return;
    [D.steps[si], D.steps[j]] = [D.steps[j], D.steps[si]]; renderSteps(); changed();
    const again = form.querySelector(`[data-act=${act}][data-s="${j}"]`); if (again && !again.disabled) again.focus();
  } else if (act === "rm-step") {
    if (D.steps.length > 1 && (!D.steps[si].do.trim() || confirm("Remove step " + (si + 1) + "?"))) { D.steps.splice(si, 1); renderSteps(); changed(); }
  } else if (act === "edit") {
    if (dirty && !confirm("Leave the recipe you're writing? Changes you haven't saved will be lost.")) return;
    const s = MINE.get(b.dataset.slug); if (s) open(fromRecipe(s.recipe, s.recipe.slug));
  } else if (act === "delete") {
    const s = MINE.get(b.dataset.slug); if (!s || !confirm(`Delete "${s.recipe.name}" from this browser? This can't be undone.`)) return;
    MINE.remove(b.dataset.slug);
    if (D.slug === b.dataset.slug) { D.slug = null; dirty = true; keepDraft(); setUrl(); }
    renderMine();
  }
});

$("k-save").addEventListener("click", save);
$("k-watch").addEventListener("click", e => {
  e.preventDefault();
  if (check().problems.length) { status("Fix the list above first, then the kitchen can cook it.", "err"); $("k-probs").scrollIntoView({block: "nearest"}); return; }
  if ((dirty || !D.slug || !MINE.get(D.slug)) && !save()) return;
  location.href = watchUrl(D.slug);
});
$("k-new").addEventListener("click", () => {
  if (dirty && !confirm("Start a new recipe? Changes you haven't saved will be lost.")) return;
  open(blank());
  $("k-name").focus();
});
$("k-from").addEventListener("change", () => {
  const slug = $("k-from").value; $("k-from").value = ""; if (!slug || !MENU) return;
  if (dirty && !confirm("Start from this PBC recipe? Changes you haven't saved will be lost.")) return;
  const r = MENU.recipes[slug], show = MENU.shows.find(s => s.recipes.includes(slug));
  open(fromRecipe(Object.assign({}, r, {name: "My " + r.name, occasions: show ? [show.occasion] : []}), null));
  dirty = true;
  status("Copied " + r.name + ". Change whatever you like, then SAVE.", "ok");
  $("about").scrollIntoView({block: "start"});
});

/* ---------- keep a copy ---------- */
$("k-down").addEventListener("click", () => {
  const r = toRecipe(D), blob = new Blob([JSON.stringify(r, null, 1) + "\n"], {type: "application/json"});
  const a = el("a", {href: URL.createObjectURL(blob), download: (D.slug || slugify(D.name)) + ".json"});
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
$("k-file").addEventListener("change", async () => {
  const file = $("k-file").files[0]; $("k-file").value = ""; if (!file) return;
  let r = null;
  try { r = JSON.parse(await file.text()); } catch (e) {}
  if (!r || typeof r !== "object" || !Array.isArray(r.ingredients) || !Array.isArray(r.steps)) { status("That file isn't a My Kitchen recipe.", "err"); return; }
  if (dirty && !confirm("Open this recipe? Changes you haven't saved will be lost.")) return;
  const d = fromRecipe(r, null);
  d.slug = uniqueSlug(slugify(r.slug || r.name || "my-recipe"));
  const lost = r.ingredients.filter(i => !LIB.ingredients[i.id]).length;
  open(d); dirty = true;
  status("Opened " + (r.name || "the recipe") + "." + (lost ? ` ${lost} ingredient${lost === 1 ? "" : "s"} the kitchen can't draw ${lost === 1 ? "was" : "were"} left out.` : "") + " SAVE keeps it here.", lost ? "warn" : "ok");
});

/* ---------- start ---------- */
fillSelects();
form.hidden = false;
const want = new URLSearchParams(location.search).get("edit"), saved = want && MINE.get(want);
let draft = null;
try { draft = JSON.parse(localStorage.getItem(DRAFT) || "null"); } catch (e) {}
if (saved) open(fromRecipe(saved.recipe, saved.recipe.slug));
else if (draft && Array.isArray(draft.ings) && Array.isArray(draft.steps)) {
  open(Object.assign(blank(), draft, {ings: draft.ings.filter(i => LIB.ingredients[i.id])}));
  dirty = !!(draft.slug ? !MINE.get(draft.slug) : draft.name || draft.ings.length);
}
else open(blank());
})();
