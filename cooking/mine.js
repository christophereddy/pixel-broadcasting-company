/* PBC Cooking: My Kitchen, the recipes a viewer writes for themselves (cooking/my-kitchen/). They live in this browser only:
   nothing is sent to PBC, and nobody else sees them. The channel cooks one as a clip, cooking/?recipe=mine-<slug>, the same way
   it plays a PBC recipe's WATCH IT MADE.
   - list()                  the saved recipes, newest first: [{recipe, menu, ok, saved}]
       recipe: the recipe as written, in the same format as data/cooking/recipes/<slug>.json (so it can be sent in later as is)
       menu:   the channel's copy (PBC_RULES.menuRecipe), kept only when the recipe passes every recipe rule (ok)
   - get(slug), save(entry), remove(slug)
   - KEY_PREFIX, isMine(key), slugOf(key)   the channel's key for a viewer's recipe is "mine-" + its slug
   - inject(menu, key)       adds a saved recipe to the channel's menu, in a show of its own that never joins the schedule,
                             and returns its key, or null when there is no such recipe or it doesn't pass the rules */
(function(root){
"use strict";
const STORE = "pbc.myKitchen.v1";
const KEY_PREFIX = "mine-";

function read(){
  try { const x = JSON.parse(localStorage.getItem(STORE) || "[]"); return Array.isArray(x) ? x.filter(e => e && e.recipe && e.recipe.slug) : []; }
  catch (e) { return []; }
}
function write(list){
  try { localStorage.setItem(STORE, JSON.stringify(list)); return true; } catch (e) { return false; }
}
const list = () => read().sort((a, b) => String(b.saved).localeCompare(String(a.saved)));
const get = slug => read().find(e => e.recipe.slug === slug) || null;
function save(entry){
  const all = read().filter(e => e.recipe.slug !== entry.recipe.slug);
  all.push(Object.assign({}, entry, {saved: new Date().toISOString()}));
  return write(all);
}
const remove = slug => write(read().filter(e => e.recipe.slug !== slug));
const isMine = key => typeof key === "string" && key.startsWith(KEY_PREFIX);
const slugOf = key => isMine(key) ? key.slice(KEY_PREFIX.length) : null;

function inject(menu, key){
  const e = isMine(key) ? get(slugOf(key)) : null;
  if (!e || !e.ok || !e.menu || !Array.isArray(e.menu.steps) || !e.menu.steps.length) return null;
  menu.recipes[key] = e.menu;
  if (!menu.shows.some(s => s.recipes.includes(key))) {
    const kid = (e.menu.tags || []).includes("kid");
    // section "mine" is in no part of the rundown, so the schedule never airs it; only this viewer's clip does
    menu.shows.push({slug: "my-kitchen-" + e.recipe.slug, name: "My Kitchen", section: "mine", occasion: (e.recipe.occasions || [])[0] || "weeknight",
      cooks: kid ? "parent-child" : "two-adults", recipes: [key], mine: true});
  }
  return key;
}

root.PBC_MINE = {STORE, KEY_PREFIX, list, get, save, remove, isMine, slugOf, inject};
})(window);
