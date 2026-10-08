/* PBC recipe box: search and filters, run entirely in the visitor's browser over recipes/index.json.
   Nothing typed here is sent anywhere. The page already lists every recipe (tools/build_recipes.cjs writes them in),
   so this script only hides, shows and reorders those cards, and keeps the search in the address so it can be shared:
   recipes/?q=lemon&role=dessert&kid=1&no=milk */
(function(){
"use strict";
const $ = id => document.getElementById(id);
const fold = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const words = s => fold(s).split(/[^a-z0-9]+/).filter(Boolean);

// one typo allowed in words of 4 letters or more ("chiken" finds chicken, "lemn" finds lemon)
function close(a, b){
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}
function hits(token, list){
  return list.some(w => w.startsWith(token) || (token.length >= 4 && (close(token, w) || close(token, w.slice(0, token.length)))));
}

let rows = [], cards = new Map();
const form = document.querySelector(".co-searchform");

function state(){
  return {
    q: $("q").value.trim(), role: $("role").value, occ: $("occ").value, level: $("level").value, time: $("time").value,
    kid: $("kid").checked, quick: $("quick").checked, veg: $("veg").checked,
    no: [...form.querySelectorAll('input[name="no"]:checked')].map(x => x.value)
  };
}
function fromUrl(){
  const p = new URLSearchParams(location.search);
  $("q").value = p.get("q") || "";
  for (const k of ["role", "occ", "level", "time"]) { const v = p.get(k) || ""; if ([...$(k).options].some(o => o.value === v)) $(k).value = v; }
  for (const k of ["kid", "quick", "veg"]) $(k).checked = p.get(k) === "1";
  const no = p.getAll("no");
  form.querySelectorAll('input[name="no"]').forEach(x => { x.checked = no.includes(x.value); });
}
function toUrl(s){
  const p = new URLSearchParams();
  if (s.q) p.set("q", s.q);
  for (const k of ["role", "occ", "level", "time"]) if (s[k]) p.set(k, s[k]);
  for (const k of ["kid", "quick", "veg"]) if (s[k]) p.set(k, "1");
  s.no.forEach(a => p.append("no", a));
  const qs = p.toString();
  history.replaceState(null, "", qs ? "?" + qs : location.pathname);
}

function score(r, tokens){
  let total = 0;
  for (const t of tokens) {
    let best = 0;
    if (hits(t, r._name)) best = 3;
    else if (hits(t, r._ing)) best = 2;
    else if (hits(t, r._other)) best = 1;
    if (!best) return 0;               // every word has to match something
    total += best;
  }
  return total || 1;
}
const LEVELS = {easy: ["easy"], medium: ["easy", "medium"], hard: ["easy", "medium", "hard"]};

function run(){
  const s = state(), tokens = words(s.q);
  const found = [];
  for (const r of rows) {
    if (s.role && r.r !== s.role) continue;
    if (s.occ && !r.o.includes(s.occ)) continue;
    if (s.level && !LEVELS[s.level].includes(r.l)) continue;
    if (s.time && r.m > +s.time) continue;
    if (s.kid && !r.t.includes("kid")) continue;
    if (s.quick && !r.t.includes("quick")) continue;
    if (s.veg && !r.t.includes("vegetarian")) continue;
    if (s.no.some(a => r.a.includes(a))) continue;
    const sc = tokens.length ? score(r, tokens) : 1;
    if (sc) found.push([sc, r]);
  }
  found.sort((a, b) => b[0] - a[0] || a[1].n.localeCompare(b[1].n));
  const list = $("results"), shown = new Set(found.map(([, r]) => r.s));
  found.forEach(([, r]) => { const li = cards.get(r.s); if (li) { li.hidden = false; list.appendChild(li); } });
  cards.forEach((li, slug) => { if (!shown.has(slug)) li.hidden = true; });
  $("count").textContent = found.length ? found.length + (found.length === 1 ? " recipe" : " recipes")
    : "No recipes match. Try fewer words or filters.";
  toUrl(s);
}

document.querySelectorAll("#results .co-result").forEach(li => cards.set(li.dataset.slug, li));
fromUrl();
fetch("index.json").then(r => r.json()).then(data => {
  rows = data.map(r => Object.assign(r, {_name: words(r.n), _ing: words(r.i.join(" ")), _other: words([r.d, r.c, r.w, r.r, r.o.join(" ")].join(" "))}));
  run();
  form.addEventListener("input", run);
  form.addEventListener("change", run);
}).catch(() => { $("count").textContent = "Search couldn't load, but every recipe is listed below."; });
})();
