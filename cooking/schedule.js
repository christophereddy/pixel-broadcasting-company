/* PBC Cooking: the running order. One file for the channel (cooking/index.html) and the recipe check
   (tools/check_recipes.cjs), so the airtime the check adds up is the airtime the channel really plays.
   - showBeats(show, recipes)  The beats of one show, each with its length: the welcome and the menu, then for each recipe
                               its introduction, what you'll need and one beat per step (plus a fast-forward beat for every
                               step with a timer), then the table and a commercial break.
   - cycleAt(menu, t)          The 3-hour cycle on air at time t: about half Popular, a quarter In season and a quarter Around
                               the world (shows.json "share"), each section picking up where its last cycle left off, so a show
                               only comes back once its whole section has aired. Cycles run back to back from EPOCH, so every
                               viewer sees the same show at the same moment.
   Pacing: 3 minutes a show (welcome, menu, table, break), and per recipe 1 minute of introduction, 1 minute a step and half
   a minute more for every timer (tools/COOKING.md). */
(function(root){
"use strict";
const S = 1000;
const PACE = {open: 30 * S, menu: 30 * S, intro: 30 * S, need: 30 * S, step: 60 * S, ff: 30 * S, table: 60 * S, ad: 20 * S};
const ADS = 3;
const CYCLE = 180 * 60 * S;
const EPOCH = Date.UTC(2026, 9, 8, 4);   // midnight Eastern, 8 October 2026
const ORDER = ["popular", "season", "world"];

function showBeats(show, recipes){
  const B = [{kind: "open", dur: PACE.open}, {kind: "menu", dur: PACE.menu}];
  show.recipes.forEach((slug, ri) => {
    const r = recipes[slug];
    B.push({kind: "intro", recipe: slug, ri, dur: PACE.intro}, {kind: "need", recipe: slug, ri, dur: PACE.need});
    r.steps.forEach((st, si) => {
      B.push({kind: "step", recipe: slug, ri, step: si, dur: PACE.step});
      if (st.timer !== undefined) B.push({kind: "ff", recipe: slug, ri, step: si, dur: PACE.ff});
    });
  });
  B.push({kind: "table", dur: PACE.table});
  for (let i = 0; i < ADS; i++) B.push({kind: "ad", ad: i, dur: PACE.ad});
  let at = 0; B.forEach(b => { b.at = at; at += b.dur; });
  B.len = at;
  return B;
}

const memo = new WeakMap();
function state(menu){
  let m = memo.get(menu);
  if (!m) {
    const ring = {}, len = {};
    ORDER.forEach(k => { ring[k] = menu.shows.filter(s => s.section === k); });
    menu.shows.forEach(s => { len[s.slug] = showBeats(s, menu.recipes).len; });
    m = {ring, len, ptr: {popular: 0, season: 0, world: 0}, cycles: []};
    memo.set(menu, m);
  }
  return m;
}
// The next cycle: each section adds shows while the next one would end nearer its target than not.
function nextCycle(menu, m){
  const prev = m.cycles[m.cycles.length - 1], start = prev ? prev.start + prev.len : EPOCH;
  const shows = []; let at = start;
  ORDER.forEach(k => {
    const ring = m.ring[k], target = CYCLE * menu.sections[k].share; let acc = 0;
    if (!ring.length) return;
    do {
      const s = ring[m.ptr[k] % ring.length], l = m.len[s.slug];
      if (acc && acc + l / 2 > target) break;
      shows.push({show: s, section: k, start: at, len: l}); acc += l; at += l; m.ptr[k]++;
    } while (acc < target);
  });
  const c = {n: m.cycles.length, start, len: at - start, shows};
  m.cycles.push(c);
  return c;
}
function cycleAt(menu, t){
  const m = state(menu);
  t = Math.max(t, EPOCH);
  while (!m.cycles.length || m.cycles[m.cycles.length - 1].start + m.cycles[m.cycles.length - 1].len <= t) nextCycle(menu, m);
  let lo = 0, hi = m.cycles.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (m.cycles[mid].start <= t) lo = mid; else hi = mid - 1; }
  return m.cycles[lo];
}
function nextOf(menu, c){ return cycleAt(menu, c.start + c.len); }

const API = {PACE, ADS, CYCLE, EPOCH, ORDER, showBeats, cycleAt, nextOf};
if (typeof module === "object" && module.exports) module.exports = API; else root.PBC_COOK = API;
})(typeof window !== "undefined" ? window : globalThis);
