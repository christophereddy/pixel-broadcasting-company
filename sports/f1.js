'use strict';
/* ================= Formula 1 =================
   One source: OpenF1 (api.openf1.org), CC BY-NC-SA 4.0, non-commercial. Its free tier serves every session once it has
   finished (live timing is a paid add-on whose key can't sit in a public page), so F1 shows full replays of finished
   races and the coming weekend's schedule.
   How the sports checklist maps onto racing (tools/ADDING_A_SPORT.md):
     games list   -> sessions of the race weekends (practice, qualifying, sprint, race); races and sprints replay
     team boxes   -> the constructors, in championship order (points added up from OpenF1's session results)
     team page    -> the constructor's drivers, points, results, next race and race replays
     player card  -> a driver: number, team, grid, finish, best lap, pit stops, season points
     play-by-play -> race control (flags, safety car, penalties), pit stops, position changes, retirements, the finish
     animation    -> pixel cars in team colors on the circuit's real shape, from OpenF1's car positions on one lap.
                     Each car's place on track comes from its real lap and sector times.
     booth        -> Colin Pryce (play-by-play) and Sofia Marquez (color, raced for nine seasons)
   This file only defines functions; sports/index.html calls them when the F1 tab is on (isF1()). */
const F1_API = 'https://api.openf1.org/v1';
const isF1 = () => S.sport === 'f1';
const F1_TEAM_ABBR = {'McLaren': 'MCL', 'Red Bull Racing': 'RBR', 'Ferrari': 'FER', 'Mercedes': 'MER', 'Aston Martin': 'AMR', 'Alpine': 'ALP',
  'Williams': 'WIL', 'Racing Bulls': 'RB', 'RB': 'RB', 'Haas F1 Team': 'HAA', 'Kick Sauber': 'SAU', 'Sauber': 'SAU', 'Audi': 'AUD', 'Cadillac': 'CAD'};
const F1_BASE = 1, F1_TALK = 1;   // replay speed: real time, like the broadcast; the timeline skips ahead

/* ---- fetching: the free tier allows 3 requests a second and 30 a minute, so requests wait their turn ---- */
let f1Chain = Promise.resolve(); const f1Times = [];
function f1Slot(){
  const p = f1Chain.then(async () => {
    for (;;) {
      const now = Date.now(); while (f1Times.length && now - f1Times[0] > 60000) f1Times.shift();
      const wait = Math.max(f1Times.length ? f1Times[f1Times.length - 1] + 380 - now : 0, f1Times.length >= 28 ? f1Times[0] + 60500 - now : 0);
      if (wait <= 0) break; await sleep(wait);
    }
    f1Times.push(Date.now());
  });
  f1Chain = p.catch(() => {}); return p;
}
const f1Cache = new Map();
function f1Get(path, keep = true){
  if (keep && f1Cache.has(path)) return f1Cache.get(path);
  const p = (async () => {
    for (let k = 0; ; k++) {
      await f1Slot();
      try { return await getJSON(F1_API + path); }
      catch (e) { if (k || !/429|abort/i.test(String(e.message || e.name))) throw e; await sleep(2500); }
    }
  })();
  if (keep) { f1Cache.set(path, p); p.catch(() => f1Cache.delete(path)); }
  return p;
}
const f1Arr = p => p.then(v => Array.isArray(v) ? v : [], () => null);

/* ---- the games list: every session of the season ---- */
const F1_GRACE = 30 * 60000; // OpenF1's free data for a session opens about half an hour after it ends
const f1IsRace = s => s?.session_type === 'Race';
function f1SessName(s){ return s.session_name === 'Race' ? 'Grand Prix' : s.session_name || s.session_type || 'Session'; }
// short names for the games list and the running order, so a line fits on a phone
function f1SessShort(s){ const n = f1SessName(s); return n === 'Grand Prix' ? 'GP' : n.replace(/^Practice (\d)$/, 'FP$1').replace('Sprint Qualifying', 'Sprint Quali').replace(/^Qualifying$/, 'Quali'); }
function f1TeamShort(t){ return String(t || '').replace(/ (F1 Team|Racing|Formula One Team)$/i, '').replace(/^Kick /, '') || t; }
const f1Hex = c => '#' + (/^[0-9a-f]{6}$/i.test(c || '') ? c : '888888');
function f1Place(s){ return s.circuit_short_name || s.location || s.country_name || 'F1'; }
function f1Event(s){
  const now = Date.now(), a = Date.parse(s.date_start), b = Date.parse(s.date_end) || a + 2 * 3600e3;
  const st = now < a ? 'pre' : now < b + F1_GRACE ? 'in' : 'post';
  return {id: String(s.session_key), date: s.date_start, f1: s, replay: f1IsRace(s),
    status: {type: {state: st, shortDetail: st === 'in' ? 'On track' : st === 'post' ? 'Final' : ''}},
    competitions: [{competitors: [], venue: {fullName: s.circuit_short_name || s.location || ''}}]};
}
async function f1LoadRaces(){
  const sport = S.sport, yr = new Date().getUTCFullYear();
  let list = await f1Arr(f1Get(`/sessions?year=${yr}`, false));
  // early in the year, before the first race, last season's races are the replays
  if (list && !list.some(s => f1IsRace(s) && Date.parse(s.date_end) + F1_GRACE < Date.now())) {
    const old = await f1Arr(f1Get(`/sessions?year=${yr - 1}`)); if (old) list = old.concat(list);
  }
  if (sport !== S.sport) return false;
  if (!list) { showErr("Can't reach OpenF1 right now. Retrying every 30 seconds."); return false; }
  showErr('');
  S.f1.sessions = list.filter(s => !s.is_cancelled && s.session_key);
  for (const s of S.f1.sessions) S.events.set(String(s.session_key), f1Event(s));
  renderList(); f1Panel();
  return true;
}
function f1GameLine(ev){
  const s = ev.f1, st = stateOf(ev), d = new Date(ev.date);
  const m = `${f1Place(s)} · ${f1SessShort(s)}`;
  if (st === 'in') return {m, s: 'On track now', st};
  if (st === 'post') return {m, s: (ev.replay ? 'Replay · ' : 'Done · ') + d.toLocaleDateString([], {month: 'numeric', day: 'numeric'}), st};
  // the coming week reads as a weekday and time; further out, just the date
  const soon = d - Date.now() < 6 * 864e5;
  return {m, s: d.toLocaleString([], soon ? {weekday: 'short', hour: 'numeric', minute: '2-digit'} : {month: 'numeric', day: 'numeric'}), st};
}

/* ---- the season: constructors' and drivers' points, added up from OpenF1's session results ---- */
const f1Slug = n => String(n || 'team').toLowerCase().replace(/[^a-z0-9]+/g, '-');
function f1Season(){
  if (S.f1.season) return S.f1.season;
  return S.f1.season = (async () => {
    if (!S.f1.sessions) await f1LoadRaces();
    const ss = (S.f1.sessions || []).filter(s => s.year === new Date(S.f1.sessions.at(-1)?.date_start || Date.now()).getUTCFullYear());
    const done = ss.filter(s => f1IsRace(s) && Date.parse(s.date_end) + F1_GRACE < Date.now());
    const minKey = Math.min(...ss.map(s => s.session_key));
    if (!Number.isFinite(minKey)) return {teams: [], drivers: new Map(), races: []};
    const [drv, res] = await Promise.all([f1Arr(f1Get(`/drivers?session_key>=${minKey}`)), f1Arr(f1Get(`/session_result?session_key>=${minKey}`))]);
    const raceKeys = new Set(done.map(s => s.session_key));
    const teamOf = new Map(), drivers = new Map();
    // a driver's team in each session, and the newest line-ups for the team boxes
    const latest = new Map();
    for (const d of drv || []) {
      teamOf.set(d.session_key + ':' + d.driver_number, d.team_name);
      const was = latest.get(d.driver_number); if (!was || d.session_key >= was.session_key) latest.set(d.driver_number, d);
    }
    const newest = Math.max(0, ...[...latest.values()].map(d => d.session_key));
    for (const d of latest.values()) {
      drivers.set(d.driver_number, {num: d.driver_number, code: d.name_acronym || String(d.driver_number), name: f1Name(d), team: d.team_name || '',
        color: f1Hex(d.team_colour), pts: 0, wins: 0, podiums: 0, best: null, starts: 0, dnf: 0, current: d.session_key === newest});
    }
    const teams = new Map();
    for (const d of drivers.values()) if (d.current && d.team) {
      const id = f1Slug(d.team);
      if (!teams.has(id)) teams.set(id, {id, abbr: F1_TEAM_ABBR[d.team] || d.team.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase(), nick: d.team, loc: d.team,
        color: d.color, alt: lum(d.color) > 0.6 ? '#14141c' : '#ffffff', logo: '', pts: 0, wins: 0, podiums: 0, best: null, drivers: [], results: new Map()});
      teams.get(id).drivers.push(d.num);
    }
    for (const r of res || []) {
      if (!raceKeys.has(r.session_key)) continue;
      const d = drivers.get(r.driver_number); const tn = teamOf.get(r.session_key + ':' + r.driver_number) || d?.team;
      const t = teams.get(f1Slug(tn)), pts = +r.points || 0, pos = r.position;
      if (d) { d.pts += pts; d.starts += r.dns ? 0 : 1; if (r.dnf) d.dnf++; if (pos === 1) d.wins++; if (pos && pos <= 3) d.podiums++; if (pos && (!d.best || pos < d.best)) d.best = pos; }
      if (t) { t.pts += pts; if (pos === 1) t.wins++; if (pos && pos <= 3) t.podiums++; if (pos && (!t.best || pos < t.best)) t.best = pos;
        const k = t.results.get(r.session_key) || []; k.push(r); t.results.set(r.session_key, k); }
    }
    const list = [...teams.values()].sort((a, b) => b.pts - a.pts || a.nick.localeCompare(b.nick));
    list.forEach((t, i) => { t.rank = i + 1; t.rec = `${t.pts % 1 ? t.pts.toFixed(1) : t.pts} PTS`; });
    const dl = [...drivers.values()].sort((a, b) => b.pts - a.pts); dl.forEach((d, i) => d.rank = i + 1);
    return S.f1.seasonVal = {teams: list, drivers, races: done, res: res || [], ok: !!(drv && res)};
  })().catch(e => { S.f1.season = null; throw e; });
}
function f1Name(d){
  const f = d.first_name, l = d.last_name;
  return f && l ? `${f} ${l}` : String(d.full_name || d.broadcast_name || d.name_acronym || 'Driver').toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase());
}
async function f1LoadTeams(){
  const sport = S.sport; let se = null;
  try { se = await f1Season(); } catch (e) { se = null; }
  if (sport !== S.sport) return;
  S.teams = se?.teams || []; S.teamsFailed = !S.teams.length; renderTeams();
}
async function f1Roster(t){
  const se = await f1Season().catch(() => null), all = [], byId = {};
  for (const n of t.drivers || []) {
    const d = se?.drivers.get(n); if (!d) continue;
    const p = {id: String(n), num: n, name: d.name, pos: d.code, side: 'DRIVERS'}; all.push(p); byId[p.id] = p;
  }
  S.roster[t.id] = {pools: {}, all, byId}; S.over[t.id] = {};
}

/* ---- a race replay: the cars, their laps, and what happened ---- */
async function f1LoadRace(ev){
  const k = ev.id, q = p => f1Arr(f1Get(`/${p}?session_key=${k}`));
  const [drivers, laps, pos, pits, rc, res] = await Promise.all([q('drivers'), q('laps'), q('position'), q('pit'), q('race_control'), q('session_result')]);
  if (!laps?.length || !drivers?.length) return null;
  const D = new Map();
  for (const d of drivers) D.set(d.driver_number, {num: d.driver_number, code: d.name_acronym || String(d.driver_number), name: f1Name(d), team: d.team_name || '',
    color: f1Hex(d.team_colour), laps: [], pits: [], grid: null, res: null});
  for (const l of laps) {
    const d = D.get(l.driver_number); if (!d || !l.lap_number) continue;
    d.laps.push({n: l.lap_number, t0: l.date_start ? Date.parse(l.date_start) : null, dur: l.lap_duration, s1: l.duration_sector_1, s2: l.duration_sector_2, s3: l.duration_sector_3, pitOut: !!l.is_pit_out_lap});
  }
  for (const d of D.values()) {
    const L = d.laps.sort((a, b) => a.n - b.n);
    // a lap without its start time takes it from the laps either side
    for (let i = L.length - 2; i >= 0; i--) if (L[i].t0 == null && L[i + 1].t0 != null && L[i].dur) L[i].t0 = L[i + 1].t0 - L[i].dur * 1000;
    for (let i = 1; i < L.length; i++) if (L[i].t0 == null && L[i - 1].t0 != null && L[i - 1].dur) L[i].t0 = L[i - 1].t0 + L[i - 1].dur * 1000;
    d.laps = L.filter(l => l.t0 != null);
  }
  for (const r of res || []) { const d = D.get(r.driver_number); if (d) d.res = r; }
  const cars = [...D.values()].filter(d => d.laps.length);
  if (!cars.length) return null;
  const t0 = Math.min(...cars.map(d => d.laps[0].n === 1 ? d.laps[0].t0 : Infinity).filter(Number.isFinite).concat(cars.map(d => d.laps[0].t0)));
  const win = (res || []).find(r => r.position === 1);
  const total = win?.number_of_laps || Math.max(...cars.map(d => d.laps.at(-1).n));
  for (const d of cars) {
    const last = d.laps.at(-1);
    d.end = last.dur ? last.t0 + last.dur * 1000 : null;
    d.done = d.res && d.res.position && !d.res.dnf && !d.res.dsq ? (d.laps.find(l => l.n === d.res.number_of_laps) || last) : null;
    // a finisher whose last lap has no time yet crosses the line one typical lap after starting it
    const typ = d.laps.filter(l => l.dur).map(l => l.dur).sort((a, b) => a - b)[d.laps.length >> 2] || 100;
    d.finishT = d.done ? d.done.t0 + (d.done.dur || typ) * 1000 : null;
  }
  for (const p of pits || []) { const d = D.get(p.driver_number); if (d && p.date) d.pits.push({t: Date.parse(p.date), lap: p.lap_number, lane: +p.lane_duration || +p.pit_duration || 25, stop: p.stop_duration}); }
  const end = Math.max(...cars.map(d => d.finishT || d.end || d.laps.at(-1).t0)) + 15000;
  const R = {ev, k, D, cars, t0, end, total, win, res: res || [], clock: t0 - 6000, fired: 0, events: [], track: null, sess: ev.f1};
  // the grid: OpenF1's positions just before the start
  const P = (pos || []).map(r => ({t: Date.parse(r.date), num: r.driver_number, p: r.position})).filter(r => r.t && r.p).sort((a, b) => a.t - b.t);
  const cur = new Map(); let i = 0;
  for (; i < P.length && P[i].t <= t0; i++) cur.set(P[i].num, P[i].p);
  for (const [n, p] of cur) { const d = D.get(n); if (d) d.grid = p; }
  R.events = f1Events(R, P.slice(i), cur, rc || []);
  return R;
}
const f1Lap = s => { if (!s) return '--'; const m = Math.floor(s / 60), x = (s - m * 60).toFixed(3).padStart(6, '0'); return `${m}:${x}`; };
const f1Pitting = (d, t) => d?.pits.some(p => t >= p.t - 3000 && t <= p.t + p.lane * 1000 + 3000);
function f1Sentence(msg, R){
  let s = String(msg || '').toLowerCase().replace(/(^|[.!?]\s+)([a-z])/g, (m, a, b) => a + b.toUpperCase());
  for (const d of R.D.values()) s = s.replace(new RegExp('\\b' + d.code.toLowerCase() + '\\b', 'g'), d.code);
  return s.replace(/\bfia\b/g, 'FIA').replace(/\bdrs\b/g, 'DRS').replace(/\bvsc\b/g, 'VSC').replace(/\bsc\b/g, 'SC').replace(/\bcar (\d+)/g, 'car $1');
}
// what happened, in race order, from OpenF1's own records; nothing here is made up
function f1Events(R, P, cur, rc){
  const E = [], push = (t, kind, text, x = {}) => { if (Number.isFinite(t)) E.push({t, kind, text, ...x}); };
  const name = n => R.D.get(n)?.code || '#' + n;
  push(R.t0, 'start', 'Lights out, and the race is under way!');
  // race control: the safety car, red and chequered flags, penalties
  for (const m of rc) {
    const t = Date.parse(m.date), msg = String(m.message || ''); if (!t || t < R.t0 - 1000 || t > R.end) continue;
    const c = m.category, f = m.flag;
    if (c === 'SafetyCar') push(t, /DEPLOYED/.test(msg) ? (/VIRTUAL/.test(msg) ? 'vsc' : 'sc') : 'scend', f1Sentence(msg, R), {lap: m.lap_number});
    else if (c === 'Flag' && f === 'RED') push(t, 'red', 'Red flag. The session is stopped.', {lap: m.lap_number});
    else if (c === 'Flag' && f === 'CHEQUERED') push(t, 'cheq', 'The chequered flag is out.', {lap: m.lap_number, quiet: true});
    else if (c === 'Flag' && f === 'GREEN' && m.scope === 'Track' && t > R.t0 + 30000) push(t, 'green', f1Sentence(msg, R), {lap: m.lap_number, quiet: true});
    else if (/PENALTY|STEWARDS/.test(msg) && !/NO FURTHER|UNDER INVESTIGATION|NOTED/.test(msg)) push(t, 'pen', f1Sentence(msg, R), {lap: m.lap_number});
  }
  // pit stops
  for (const d of R.cars) for (const p of d.pits) if (p.t >= R.t0 && p.t <= R.end)
    push(p.t, 'pit', `${d.code} pits${p.lap ? ' on lap ' + p.lap : ''}${p.stop ? `, a ${(+p.stop).toFixed(1)} second stop` : ''}.`, {num: d.num});
  // position changes: a driver who gains a place took it from a driver who lost one at the same moment
  const winT = R.D.get(R.win?.driver_number)?.finishT;
  const batches = []; for (const r of P) { const b = batches.at(-1); if (b && r.t - b.t0 < 1500) b.rows.push(r); else batches.push({t0: r.t, rows: [r]}); }
  for (const b of batches) {
    const before = new Map(cur); for (const r of b.rows) cur.set(r.num, r.p);
    for (const r of b.rows) {
      const was = before.get(r.num); if (!was || r.p >= was) continue;
      const vic = [...before].find(([n, p]) => p === r.p && n !== r.num && (cur.get(n) || 99) > p)?.[0];
      if (vic == null || f1Pitting(R.D.get(vic), r.t) || f1Pitting(R.D.get(r.num), r.t)) continue;
      // after a car takes the flag the order only settles, and nobody is racing for it
      // nor does a car on the lap it retires on
      if ([r.num, vic].some(n => { const d = R.D.get(n); return d?.res?.dnf && r.t >= d.laps.at(-1).t0; })) continue;
      if ([r.num, vic].some(n => { const f = R.D.get(n)?.finishT; return f && r.t >= f - 500; }) || (winT && r.t >= winT)) continue;
      push(r.t, r.p === 1 ? 'lead' : 'pass', r.p === 1 ? `${name(r.num)} takes the lead from ${name(vic)}!` : `${name(r.num)} passes ${name(vic)} for P${r.p}.`, {num: r.num, vic, p: r.p});
    }
  }
  // the fastest lap of the race, when it was set
  let fl = null; for (const d of R.cars) for (const l of d.laps) if (l.dur && l.n > 1 && !l.pitOut && (!fl || l.dur < fl.l.dur)) fl = {d, l};
  if (fl) push(fl.l.t0 + fl.l.dur * 1000, 'fl', `${fl.d.code} sets what stands as the fastest lap of the race, ${f1Lap(fl.l.dur)}.`, {num: fl.d.num});
  // retirements
  for (const d of R.cars) if (d.res?.dnf) { const l = d.laps.at(-1); push(l.t0 + (l.dur ? l.dur * 1000 : 30000), 'out', `${d.code} is out of the race.`, {num: d.num}); }
  // the last lap and the finish
  const lead = R.D.get(R.win?.driver_number);
  if (lead) {
    const ll = lead.laps.find(l => l.n === R.total); if (ll && R.total > 1) push(ll.t0, 'last', 'Final lap!');
    if (lead.finishT) push(lead.finishT, 'win', `${lead.code} wins it! ${lead.name} takes the chequered flag for ${lead.team}.`, {num: lead.num});
    for (const r of R.res) if (r.position === 2 || r.position === 3) { const d = R.D.get(r.driver_number); if (d?.finishT) push(d.finishT + 1, 'fin', `${d.code} finishes P${r.position}.`, {num: d.num}); }
  }
  E.sort((a, b) => a.t - b.t);
  E.forEach((e, i) => { e.id = 'e' + i; e.lap = e.lap || f1LeadLap(R, e.t); });
  return E;
}

/* ---- where every car is: from its lap start times and sector times ---- */
function f1LapAt(d, t){ const L = d.laps; let lo = 0, hi = L.length - 1; if (t < L[0].t0) return -1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (L[m].t0 <= t) lo = m; else hi = m - 1; } return lo; }
function f1Frac(R, lap, dt){
  const tr = R.track, ms = lap.dur ? lap.dur * 1000 : null;
  if (lap.s1 && lap.s2 && lap.s3 && tr) {
    const a = lap.s1 * 1000, b = a + lap.s2 * 1000, c = b + lap.s3 * 1000;
    if (dt <= a) return dt / a * tr.f1; if (dt <= b) return tr.f1 + (dt - a) / (b - a) * (tr.f2 - tr.f1); return tr.f2 + Math.min(1, (dt - b) / (c - b)) * (1 - tr.f2);
  }
  return ms ? Math.min(1, dt / ms) : Math.min(0.97, dt / 100000);
}
// progress in laps (3.5 = halfway round lap 4), or a flag that the car isn't running
function f1Prog(R, d, t){
  if (!d.laps.length || t < d.laps[0].t0) return {p: 0, grid: true};
  if (d.finishT && t >= d.finishT) return {p: d.done.n, fin: true, at: d.finishT};
  const i = f1LapAt(d, t), l = d.laps[i], nx = d.laps[i + 1];
  if (!nx && !l.dur) return t - l.t0 > 45000 ? {p: l.n - 1, out: true} : {p: l.n - 1 + Math.min(0.6, (t - l.t0) / 100000)};
  if (!nx && t > l.t0 + l.dur * 1000) return {p: l.n, out: !d.done};
  const dur = l.dur ? l.dur * 1000 : nx.t0 - l.t0;
  return {p: l.n - 1 + f1Frac(R, l.dur ? l : {...l, dur: dur / 1000}, Math.min(dur, t - l.t0))};
}
// the time a car reached a given progress (for gaps): the inverse of f1Prog
function f1TimeAt(R, d, p){
  const n = Math.floor(p) + 1, l = d.laps.find(x => x.n === n); if (!l) return null;
  const f = p - (n - 1), dur = l.dur ? l.dur * 1000 : null; if (!dur) return null;
  let lo = 0, hi = dur; for (let k = 0; k < 18; k++) { const m = (lo + hi) / 2; if (f1Frac(R, l, m) < f) lo = m; else hi = m; }
  return l.t0 + lo;
}
function f1Order(R, t){
  const rows = R.cars.map(d => ({d, ...f1Prog(R, d, t)}));
  for (const r of rows) r.grid && (r.p = -(r.d.grid || 30) / 100);
  rows.sort((a, b) => (!!a.out - !!b.out) || (a.fin && b.fin ? a.at - b.at : 0) || b.p - a.p);
  const lead = rows[0];
  for (const r of rows) {
    if (r === lead || r.out || r.grid) { r.gap = r === lead ? (r.fin ? 'FIN' : 'LEAD') : r.out ? 'OUT' : ''; continue; }
    if (r.fin && lead.fin) { r.gap = '+' + ((r.at - lead.at) / 1000).toFixed(1); continue; }
    const down = Math.floor(lead.p - r.p);
    if (down >= 1) { r.gap = `+${down} LAP`; continue; }
    const tl = f1TimeAt(R, lead.d, r.p); r.gap = tl ? '+' + Math.max(0, (t - tl) / 1000).toFixed(1) : '';
  }
  return rows;
}
const f1LeadLap = (R, t) => { const o = f1Order(R, t)[0]; return o ? Math.max(1, Math.min(R.total, Math.floor(o.p) + 1)) : 1; };

/* ---- the circuit: one real lap of car positions, fitted to the screen ---- */
async function f1LoadTrack(R){
  const w = R.D.get(R.win?.driver_number) || R.cars[0];
  const ok = w.laps.filter(l => l.dur && l.s1 && l.s2 && l.s3 && l.n > 1 && !l.pitOut && !w.pits.some(p => Math.abs(p.t - l.t0) < 200000));
  const ref = ok.sort((a, b) => a.dur - b.dur)[0] || w.laps.find(l => l.dur && l.n > 1); if (!ref) return null;
  const iso = ms => new Date(ms).toISOString();
  const pts = await f1Arr(f1Get(`/location?session_key=${R.k}&driver_number=${w.num}&date>=${iso(ref.t0)}&date<=${iso(ref.t0 + ref.dur * 1000)}`));
  const P = (pts || []).filter(p => (p.x || p.y) && p.date).map(p => ({t: Date.parse(p.date), x: +p.x, y: +p.y})).sort((a, b) => a.t - b.t);
  if (P.length < 40) return null;
  const at = ms => P.reduce((b, p, i) => Math.abs(p.t - ms) < Math.abs(P[b].t - ms) ? i : b, 0);
  const tr = f1Shape(P.map(p => [p.x, p.y]));
  const fi = i => tr.cum[Math.min(i, tr.cum.length - 1)] / tr.len;
  tr.f1 = fi(at(ref.t0 + ref.s1 * 1000)); tr.f2 = fi(at(ref.t0 + (ref.s1 + ref.s2) * 1000));
  if (!(tr.f1 > 0.05 && tr.f2 > tr.f1 + 0.05 && tr.f2 < 0.95)) { tr.f1 = 1 / 3; tr.f2 = 2 / 3; }
  tr.real = true; return tr;
}
function f1Shape(raw){
  // a closed loop; the y axis points up in OpenF1, down on screen
  const pts = raw.map(([x, y]) => [x, -y]); const c = pts[0]; pts.push([c[0], c[1]]);
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return {raw: pts, cum, len: cum.at(-1), f1: 1 / 3, f2: 2 / 3};
}
// a stand-in loop while a circuit loads, or for a weekend that hasn't run yet
function f1Generic(){
  const pts = []; for (let i = 0; i < 160; i++) { const a = i / 160 * Math.PI * 2; pts.push([Math.cos(a) * (1 + 0.18 * Math.cos(3 * a)) * 1000, Math.sin(a) * 520 + Math.sin(2 * a) * 120]); }
  return f1Shape(pts);
}
// the parts of the screen the booth and scoreboard cover, in canvas pixels
function f1Covers(){
  const st = $('stage').getBoundingClientRect(), k = W / (st.width || W), out = [];
  for (const sel of ['.booth', '.board']) { const r = document.querySelector(sel)?.getBoundingClientRect(); if (r?.width) out.push({x0: (r.left - st.left) * k, y0: (r.top - st.top) * k, x1: (r.right - st.left) * k, y1: (r.bottom - st.top) * k}); }
  return out;
}
function f1Fit(tr){
  const cov = f1Covers(), booth = cov[0] || {x1: 160, y1: 138}, board = cov[1] || {x0: 340, y1: 64};
  const box = {x0: Math.round(booth.x1) + 10, x1: W - 70, y0: Math.round(board.y1) + 8, y1: H - 22};
  if (box.x1 - box.x0 < 140) box.x0 = box.x1 - 140;
  let best = null;
  for (let deg = 0; deg < 180; deg += 6) {
    const a = deg * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    const rp = tr.raw.map(([x, y]) => [x * ca - y * sa, x * sa + y * ca]);
    const xs = rp.map(p => p[0]), ys = rp.map(p => p[1]), w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
    const s = Math.min((box.x1 - box.x0) / w, (box.y1 - box.y0) / h);
    if (!best || s > best.s * 1.04) best = {s, rp, mx: Math.min(...xs), my: Math.min(...ys), w, h};
  }
  const ox = box.x0 + ((box.x1 - box.x0) - best.w * best.s) / 2, oy = box.y0 + ((box.y1 - box.y0) - best.h * best.s) / 2;
  tr.pts = best.rp.map(([x, y]) => [ox + (x - best.mx) * best.s, oy + (y - best.my) * best.s]);
  tr.cx = tr.pts.reduce((s, p) => s + p[0], 0) / tr.pts.length; tr.cy = tr.pts.reduce((s, p) => s + p[1], 0) / tr.pts.length;
  tr.box = box;
}
function f1At(tr, f){
  f = ((f % 1) + 1) % 1; const want = f * tr.len, c = tr.cum;
  let lo = 0, hi = c.length - 1; while (lo < hi - 1) { const m = (lo + hi) >> 1; if (c[m] <= want) lo = m; else hi = m; }
  const u = (want - c[lo]) / ((c[hi] - c[lo]) || 1), a = tr.pts[lo], b = tr.pts[hi];
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, b[0] - a[0], b[1] - a[1]];
}
// the pit lane runs inside the main straight: a car in the pits is drawn there
function f1Inside(tr, f, by){
  const [x, y, dx, dy] = f1At(tr, f), l = Math.hypot(dx, dy) || 1; let nx = -dy / l, ny = dx / l;
  if ((tr.cx - x) * nx + (tr.cy - y) * ny < 0) { nx = -nx; ny = -ny; }
  return [x + nx * by, y + ny * by];
}

/* ---- drawing ---- */
function f1BuildTrack(){
  S.f1.props = null;   // the trackside boards pick up the new rotation
  const tr = S.f1.track || (S.f1.track = f1Generic()); f1Fit(tr);
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  const rnd = mulberry(7);
  g.fillStyle = '#2b6a35'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) { g.fillStyle = rnd() < 0.5 ? '#2f7139' : '#286231'; g.fillRect(Math.floor(rnd() * W), Math.floor(rnd() * H), 2, 1); }
  const line = (w, col, dash) => { g.strokeStyle = col; g.lineWidth = w; g.lineJoin = 'round'; g.lineCap = 'round'; g.setLineDash(dash || []); g.beginPath(); tr.pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.stroke(); g.setLineDash([]); };
  // run-off, kerbs (red and white where the track bends), asphalt
  line(13, '#c9b98f');
  g.lineWidth = 9; for (let i = 2; i < tr.pts.length - 2; i++) {
    const [a, b, d] = [tr.pts[i - 2], tr.pts[i], tr.pts[i + 2]], t1 = Math.atan2(b[1] - a[1], b[0] - a[0]), t2 = Math.atan2(d[1] - b[1], d[0] - b[0]);
    let turn = Math.abs(t2 - t1); if (turn > Math.PI) turn = 2 * Math.PI - turn;
    if (turn > 0.35) { g.strokeStyle = i % 2 ? '#d8282f' : '#f2f0e8'; g.beginPath(); g.moveTo(...tr.pts[i - 1]); g.lineTo(...tr.pts[i + 1]); g.stroke(); }
  }
  line(7, '#4a4d57'); line(1, '#5c606c', [2, 5]);
  // the pit lane and the start and finish line
  g.strokeStyle = '#8a8d97'; g.lineWidth = 1; g.beginPath();
  for (let k = -24; k <= 24; k++) { const [x, y] = f1Inside(tr, k / 1000, 7); k === -24 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke();
  const [sx, sy, dx, dy] = f1At(tr, 0), l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
  for (let k = -4; k <= 4; k++) { g.fillStyle = (k & 1) ? '#111' : '#fff'; g.fillRect(Math.round(sx + nx * k) , Math.round(sy + ny * k), 2, 2); }
  // the grandstand facing the main straight
  const [gx, gy] = f1Inside(tr, 0.01, -16);
  g.fillStyle = '#39405e'; g.fillRect(Math.round(gx) - 22, Math.round(gy) - 5, 44, 9);
  for (let i = 0; i < 40; i++) { g.fillStyle = ['#e9e4cf', '#c0392b', '#f2b632', '#5aa9e6'][i % 4]; g.fillRect(Math.round(gx) - 21 + (i % 20) * 2 + (i > 19), Math.round(gy) - 4 + (i > 19 ? 4 : 0), 1, 1); }
  // trackside sponsor boards along the bottom, like the other sports' arena boards
  const bw = Math.floor((tr.box.x1 - tr.box.x0 - 8) / 3);
  for (let k = 0; k < 3; k++) adBoard(g, tr.box.x0 + k * (bw + 4), H - 14, bw, 11, adFitting(2 + k * 3, bw));
  S.field = c;
}
function f1Car(g, x, y, col, lead){
  x = Math.round(x); y = Math.round(y);
  g.fillStyle = '#05060d'; g.fillRect(x - 2, y - 2, 5, 5);
  g.fillStyle = col; g.fillRect(x - 1, y - 1, 3, 3);
  if (lead) { g.fillStyle = '#f2b632'; g.fillRect(x - 1, y - 4, 3, 1); }
}
// the latest track status race control has called
function f1Flag(R){ for (let i = R.fired - 1; i >= 0; i--) if (['sc', 'vsc', 'red', 'scend', 'green', 'cheq'].includes(R.events[i].kind)) return R.events[i]; return null; }
function f1Render(now){
  ctx.fillStyle = '#0c0e1c'; ctx.fillRect(0, 0, W, H);
  if (S.field) ctx.drawImage(S.field, 0, 0);
  const R = S.f1r, tr = S.f1.track;
  if (R && tr && S.mode === 'replay' && R.track === tr) { f1Chase(now); drawBooth(now); return; }
  if (R && tr && S.mode === 'replay') {
    const order = R.order || [];
    // the field, back to front so the leader sits on top
    for (let i = order.length - 1; i >= 0; i--) {
      const o = order[i]; if (o.out || (o.fin && R.clock - o.at > 20000)) continue;
      const pit = f1Pitting(o.d, R.clock) && !o.grid;
      let x, y;
      if (o.grid) { const g0 = (o.d.grid || i + 1) - 1; [x, y] = f1Inside(tr, -0.004 - g0 * 0.0035, g0 % 2 ? 2 : -2); }
      else if (pit) [x, y] = f1Inside(tr, o.p % 1, 7);
      else [x, y] = f1At(tr, o.p % 1);
      f1Car(ctx, x, y, o.d.color, i === 0);
      if (i < 3 || o.d.num === S.f1.focus) pixText(ctx, o.d.code, Math.round(x) + 4, Math.round(y) - 7, false, '#ffffff');
    }
    // while the safety car is out it leads the field, lights flashing
    const lead = order[0];
    if (f1Flag(R)?.kind === 'sc' && lead && !lead.grid && !lead.out) {
      const [x, y] = f1At(tr, (lead.p + 0.03) % 1);
      f1Car(ctx, x, y, '#e9e4cf', false);
      ctx.fillStyle = Math.floor(now / 250) % 2 ? '#f2b632' : '#c0392b'; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 4, 3, 1);
      pixText(ctx, 'SC', Math.round(x) + 4, Math.round(y) - 7, false, '#f2b632');
    }
    f1Tower(ctx, order);
  }
  drawBooth(now);
}
// the timing tower down the right-hand side
function f1Tower(g, order){
  const x = W - 62, y0 = Math.max(70, Math.round((f1Covers()[1]?.y1 || 64) + 4)), rows = Math.min(order.length, 22), rh = Math.min(8, Math.floor((H - 18 - y0) / Math.max(1, rows)));
  g.fillStyle = 'rgba(8,10,26,.88)'; g.fillRect(x - 2, y0 - 2, 62, rows * rh + 3);
  for (let i = 0; i < rows; i++) {
    const o = order[i], y = y0 + i * rh;
    pixText(g, String(i + 1).padStart(2, ' '), x, y, false, '#9ba3cc');
    g.fillStyle = o.d.color; g.fillRect(x + 9, y, 2, 5);
    pixText(g, o.d.code, x + 13, y, false, o.out ? '#6b7090' : '#f2f0e8');
    const gp = o.gap || ''; pixText(g, gp, x + 58 - pixWidth(gp, false), y, false, o.out ? '#6b7090' : i ? '#c9c6b4' : '#f2b632');
  }
}

/* ---- the replay clock ---- */
function f1Tick(now){
  const R = S.f1r, last = S.f1.lastNow || now; S.f1.lastNow = now;
  if (!R || S.mode !== 'replay' || R.done) return;
  const dt = Math.min(0.1, (now - last) / 1000);
  if (!S.paused) {
    const sp = R.talking ? F1_TALK : F1_BASE;
    R.clock = Math.min(R.end, R.clock + dt * 1000 * sp);
  }
  while (R.fired < R.events.length && R.events[R.fired].t <= R.clock) f1Fire(R, R.events[R.fired++]);
  if (now - (R.lastOrder || 0) > 90) { R.order = f1Order(R, R.clock); R.lastOrder = now; }
  if (now - (R.lastUi || 0) > 400) { R.lastUi = now; f1Board(); f1UpdateTimeline(); }
  if (now - (R.lastPanel || 0) > 1500) { R.lastPanel = now; f1Panel(true); }
  if (R.clock >= R.end && !R.talking && !R.talk.length) { R.done = true; f1Board(); f1Panel(true); $('caption').textContent = tag('B') + 'What a race. Thanks for watching!'; }
}
const F1_SAY = new Set(['start', 'lead', 'sc', 'vsc', 'red', 'pen', 'out', 'last', 'win', 'fin', 'fl']);
function f1Fire(R, e){
  f1Log(e);
  const big = F1_SAY.has(e.kind) || (e.kind === 'pass' && e.p <= 3) || (e.kind === 'pit' && f1PosOf(R, e.num) <= 5);
  if (!big || e.quiet) return;
  if (['sc', 'vsc', 'red'].includes(e.kind)) { showBreak(e.kind === 'red' ? 'RED FLAG' : e.kind === 'vsc' ? 'VIRTUAL SAFETY CAR' : 'SAFETY CAR', `LAP ${e.lap}`); e.ad = true; }
  if (e.kind === 'scend' || e.kind === 'green') hideBanner();
  // keep the booth close to the action: a backlog drops all but the big moments
  R.talk = R.talk.filter(x => ['lead', 'sc', 'vsc', 'red', 'win', 'last', 'start'].includes(x.kind)).slice(-2); R.talk.push(e);
  f1Speak(R);
}
async function f1Speak(R){
  if (R.talking) return; R.talking = true; const tok = S.token;
  while (R.talk.length && tok === S.token && S.f1r === R) {
    const e = R.talk.shift();
    await say('A', f1Pbp(R, e), tok);
    const col = f1Color(R, e); if (col && tok === S.token) await say('B', col, tok);
    if (e.ad && tok === S.token) {
      await sponsorRead(tok); await sleep(cutHold()); if (tok === S.token) hideBanner();
      // back from the break: say where things stand, so the ad isn't the last line on screen
      const f = f1Flag(R)?.kind;
      if (tok === S.token && ['sc', 'vsc', 'red'].includes(f)) await say('B', f === 'red' ? 'Back with you. The race is still stopped.' : f === 'vsc' ? 'Back with you. Still under the virtual safety car.' : 'Back with you. Still behind the safety car.', tok);
    }
    await sleep(250);
  }
  if (S.f1r === R) R.talking = false;
}
const f1PosOf = (R, num) => { const i = (R.order || []).findIndex(o => o.d.num === num); return i < 0 ? 99 : i + 1; };
function f1Pbp(R, e){
  const d = R.D.get(e.num), v = R.D.get(e.vic);
  if (e.kind === 'pass') return `${d.name} goes past ${v.name}. Up to P${e.p}.`;
  if (e.kind === 'lead') return `${d.name} takes the lead from ${v.name}!`;
  if (e.kind === 'pit') return `${d.name} pits from P${f1PosOf(R, e.num)}.${e.text.includes('second stop') ? ' ' + e.text.split(', ')[1] : ''}`.replace(/\.\./g, '.');
  if (e.kind === 'out') return `${d.name} is out of the race.`;
  if (e.kind === 'fl') return e.text.replace(d.code, d.name);
  if (e.kind === 'fin') return `${d.name} takes P${e.text.match(/P(\d+)/)[1]} for ${d.team}.`;
  if (e.kind === 'start') return `Lights out, and away we go at ${f1Place(R.sess)}!`;
  return e.text;
}
const F1_COLOR = {
  start: ['Clean getaway at the front. Now the tyres have to come up to temperature.', 'Turn one is always a lottery. Everyone through, it seems.'],
  lead: ['That is the move! {team} will be delighted.', 'A new leader! The pit wall will be busy now.'],
  pass: ['Lovely move, done cleanly.', 'Went for the gap and it was there.', 'Plenty of pace in that {team}.'],
  pit: ['Strategy time for {team}.', 'Let us see where that drops {name} in the order.'],
  sc: ['That bunches the field right up. Free pit stops for some.', 'Everybody slows down. Strategists, start your engines.'],
  vsc: ['A virtual safety car keeps the gaps, roughly.'],
  red: ['Everybody into the pit lane. A long wait, maybe.'],
  out: ['Heartbreaking for {team}.', 'A tough day for {name}.'],
  pen: ['The stewards have spoken.'],
  last: ['One more lap. Bring it home.'],
  win: ['What a drive! I raced for nine seasons and never got used to that feeling.', 'Champagne time for {team}!'],
  fin: ['A podium. Lovely result.'], fl: ['Purple sectors all round on that one.']
};
function f1Color(R, e){
  const list = F1_COLOR[e.kind]; if (!list || (e.kind === 'pass' && hash(e.id) % 3)) return '';
  const d = R.D.get(e.num); return pick(list, e.id).replace('{team}', d?.team || 'the team').replace('{name}', d?.name || 'him');
}
function f1Log(e){
  const log = $('log'); log.querySelector('.empty')?.remove();
  const R = S.f1r, li = document.createElement('li');
  if (['lead', 'win', 'sc', 'vsc', 'red', 'fin'].includes(e.kind)) li.className = 'score';
  else if (['green', 'scend', 'cheq'].includes(e.kind)) li.className = 'pitch';
  li.innerHTML = '<span class="t"></span><span class="tm"></span><span class="x"></span>';
  li.children[0].textContent = `LAP ${e.lap}`; li.children[1].textContent = R?.D.get(e.num)?.code || ''; li.children[2].textContent = e.text;
  log.prepend(li); while (log.children.length > 300) log.lastChild.remove(); log.scrollTop = 0;
}
// the scoreboard: leader and second place, the lap, and the track state
function f1Board(){
  const R = S.f1r;
  if (!R || S.mode !== 'replay') return;
  const o = R.order || [], a = o[0], b = o[1];
  const row = (k, r, label) => { if (!r) return; $('ab' + k).textContent = r.d.code; $('chip' + k).style.background = r.d.color; $('chip' + k).style.borderColor = '#ffffff'; $('sc' + k).textContent = label; };
  row('A', a, 'P1'); row('H', b, b?.gap && b.gap !== 'OUT' ? b.gap : 'P2');
  $('possA').classList.remove('on'); $('possH').classList.remove('on');
  const lap = f1LeadLap(R, R.clock);
  $('clock').textContent = R.clock < R.t0 ? 'GRID' : `LAP ${lap}/${R.total}`;
  const sc = f1Flag(R);
  $('dd').textContent = R.done || sc?.kind === 'cheq' ? 'CHEQUERED FLAG' : sc?.kind === 'sc' ? 'SAFETY CAR' : sc?.kind === 'vsc' ? 'VIRTUAL SAFETY CAR' : sc?.kind === 'red' ? 'RED FLAG' : R.clock < R.t0 ? 'FORMING UP' : 'GREEN FLAG';
}

/* ---- picking a session ---- */
async function f1Select(id, mode){
  const ev = evOf(id); if (!ev) return;
  S.token++; const tok = S.token;
  if (window.speechSynthesis) speechSynthesis.cancel();
  hideNotice(); hideBanner();
  Object.assign(S, {speaking: null, queue: [], game: id, mode: ev.replay || mode !== 'replay' ? mode : 'pre', replayDone: false, view: null, summary: null, rp: null, ri: 0, paused: false});
  $('tline').hidden = true; $('tl-pause').textContent = 'PAUSE';
  S.f1r = null; S.f1.focus = null; S.f1.cam = null; S.f1.lat = null; S.f1.camst = {}; S.home = null; S.away = null;
  renderList(); setBadge();
  $('abA').textContent = '--'; $('abH').textContent = '--'; $('scA').textContent = ''; $('scH').textContent = ''; $('clock').textContent = '--'; $('dd').textContent = '';
  const s = ev.f1, when = new Date(ev.date).toLocaleString([], {weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'});
  if (S.mode !== 'replay') {
    S.f1.track = f1Generic(); buildField(); f1Panel();
    $('clock').textContent = when.toUpperCase(); $('dd').textContent = f1SessName(s).toUpperCase();
    if (S.mode === 'live') {
      clearLog('OpenF1 opens a session\'s timing to everyone about half an hour after it ends. The replay will be here then.');
      $('caption').textContent = `${tag('A')}${f1Place(s)} ${f1SessName(s)} is on track right now. We will have the full replay shortly after it finishes.`;
    } else {
      clearLog(ev.replay ? `The timing starts with the ${f1SessName(s).toLowerCase()}.` : 'Practice and qualifying sessions are listed for the schedule; races and sprints replay here.');
      $('caption').textContent = `${tag('A')}${f1Place(s)} ${f1SessName(s)}: ${when}. ${ev.replay && stateOf(ev) === 'pre' ? 'The replay will be here after the chequered flag.' : ''}`;
    }
    return;
  }
  clearLog('Loading the timing from OpenF1...');
  $('caption').textContent = `${tag('A')}Welcome to ${f1Place(s)} for the ${f1SessName(s)}.`;
  let R = null; try { R = await f1LoadRace(ev); } catch (e) { R = null; }
  if (tok !== S.token) return;
  if (!R) { clearLog("Couldn't load this race's timing from OpenF1. Try again in a minute."); return; }
  $('clock').textContent = 'GRID'; $('dd').textContent = 'LOADING THE CIRCUIT';
  const tr = await f1LoadTrack(R).catch(() => null);
  if (tok !== S.token) return;
  S.f1.track = tr || f1Generic(); R.track = S.f1.track; buildField();
  if (!tr) clearLog('OpenF1 has no car positions for this race, so the circuit is a stand-in. The order and timing are real.');
  else $('log').innerHTML = '';
  R.talk = []; R.order = f1Order(R, R.clock); S.f1r = R;
  S.rp = {f1: true, plays: R.events}; f1RenderTimeline(); f1Board(); f1Panel();
  $('caption').textContent = `${tag('A')}Let us relive the ${f1Place(s)} ${f1SessName(s)}, ${R.total} laps.`;
  if (S.started && S.voices) say('A', $('caption').textContent.slice(tag('A').length), tok);
}

/* ---- the replay timeline: laps along the bar, lead changes and safety cars marked ---- */
function f1RenderTimeline(){
  const R = S.f1r, box = $('tline'); box.hidden = !R; if (!R) return;
  const qs = $('tl-qs'); qs.innerHTML = '';
  const step = R.total > 40 ? 10 : 5;
  for (let n = 1; n <= R.total; n += step) { const d = document.createElement('div'); d.className = 'tl-q'; d.style.flex = String(Math.min(step, R.total - n + 1)); d.textContent = 'L' + n; qs.append(d); }
  $('tl-prev').innerHTML = '&lt;&lt; LAP'; $('tl-next').innerHTML = 'LAP &gt;&gt;';
  $('tl-prev').title = 'Back one lap'; $('tl-next').title = 'Forward one lap';
  const marks = $('tl-marks'), list = $('tl-scores'); marks.innerHTML = ''; list.innerHTML = '';
  for (const e of R.events) {
    if (!['lead', 'sc', 'vsc', 'red', 'win'].includes(e.kind)) continue;
    const col = R.D.get(e.num)?.color || '#f2b632';
    const m = document.createElement('div'); m.className = 'tl-mark'; m.style.left = (f1FracOf(R, e.t) * 100) + '%'; m.style.background = col; marks.append(m);
    const b = document.createElement('button'); b.className = 'tl-sc'; b.innerHTML = '<i></i><span></span>'; b.firstChild.style.background = col;
    b.lastChild.textContent = `L${e.lap} ${e.kind === 'lead' ? R.D.get(e.num).code + ' LEADS' : e.kind === 'win' ? R.D.get(e.num).code + ' WINS' : e.kind === 'red' ? 'RED FLAG' : e.kind === 'vsc' ? 'VSC' : 'SAFETY CAR'}`;
    b.title = 'Watch from just before this'; b.onclick = () => f1SeekTime(e.t - 12000, 'lap ' + e.lap);
    list.append(b);
  }
  f1UpdateTimeline();
}
const f1FracOf = (R, t) => clamp((t - R.t0) / (R.end - R.t0), 0, 1);
function f1UpdateTimeline(){
  const R = S.f1r; if (!R) return;
  const f = f1FracOf(R, R.clock);
  $('tl-fill').style.width = (f * 100) + '%'; $('tl-head').style.left = (f * 100) + '%';
  $('tl-now').textContent = R.done ? 'FINAL' : R.clock < R.t0 ? 'GRID' : `LAP ${f1LeadLap(R, R.clock)}`;
  $('tline').querySelector('.tl-bar').setAttribute('aria-valuetext', $('tl-now').textContent);
  if (!S.tlHover) $('tl-hover').textContent = 'Click the bar to jump. Squares mark lead changes and safety cars.';
}
function f1SeekTime(t, why){
  const R = S.f1r; if (!R) return;
  S.token++; if (window.speechSynthesis) speechSynthesis.cancel();
  S.speaking = null; hideBanner();
  R.clock = clamp(t, R.t0 - 6000, R.end); R.done = false; R.talk = []; R.talking = false; S.f1.lat = null;
  R.fired = R.events.findIndex(e => e.t > R.clock); if (R.fired < 0) R.fired = R.events.length;
  $('log').innerHTML = ''; for (const e of R.events.slice(Math.max(0, R.fired - 12), R.fired)) f1Log(e);
  R.order = f1Order(R, R.clock); f1Board(); f1UpdateTimeline(); f1Panel(true);
  $('caption').textContent = `${tag('A')}Taking you to ${why || 'lap ' + f1LeadLap(R, R.clock)}.`;
}
function f1StepLap(dir){
  const R = S.f1r; if (!R) return;
  const lead = R.order?.[0]?.d || R.cars[0], n = clamp(f1LeadLap(R, R.clock) + dir, 1, R.total), l = lead.laps.find(x => x.n === n);
  f1SeekTime(l ? l.t0 : R.t0, 'lap ' + n);
}
function f1Hover(f){ const R = S.f1r; if (!R) return; const t = R.t0 + f * (R.end - R.t0); $('tl-hover').textContent = `LAP ${f1LeadLap(R, t)}`; }

/* ---- the side panel: this race's running order, drivers, constructors ---- */
function f1Panel(soft){
  if (!isF1()) return;
  const ev = S.game && evOf(S.game), R = S.f1r;
  $('gp-teams').hidden = true; $('gp-hint').hidden = true;
  $('gp-empty').hidden = !!ev; $('gp-date').hidden = !ev;
  $('gp-state').textContent = S.mode === 'live' ? 'ON TRACK' : S.mode === 'replay' ? 'REPLAY' : S.mode === 'pre' ? 'UPCOMING' : '';
  if (!ev) { $('detail').hidden = true; return; }
  $('gp-date').textContent = `${f1Place(ev.f1)} ${f1SessName(ev.f1)} · ${new Date(ev.date).toLocaleDateString([], {weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'})}`.toUpperCase();
  f1CamPicker();
  if (soft && S.view) return;  // a driver card stays put while the race runs
  f1Detail();
}
function f1Detail(){
  const d = $('detail'), R = S.f1r, ev = S.game && evOf(S.game), v = S.view; if (!ev) { d.hidden = true; return; }
  const keep = d.scrollTop; d.hidden = false;
  if (v?.kind === 'driver') { d.innerHTML = f1DriverHTML(v.num, true); f1Helmet(d.querySelector('canvas'), v.num); d.querySelector('.back').onclick = () => { S.view = null; S.f1.focus = null; f1Detail(); }; return; }
  let h = '';
  if (R && S.mode === 'replay') {
    h += `<div class="dhead"><b>${R.done ? 'CLASSIFICATION' : 'RUNNING ORDER'}</b></div><div class="plist">`;
    (R.order || []).forEach((o, i) => { h += `<button class="pl f1r" data-num="${o.d.num}"><span class="n">P${i + 1}</span><span class="dn"><i style="background:${esc(o.d.color)}"></i>${esc(o.d.code)} ${esc(f1TeamShort(o.d.team))}</span><span class="ps">${esc(o.gap || '')}</span></button>`; });
    h += '</div><div class="muted">Click a driver for the card.</div>';
  } else {
    // the weekend's schedule
    const same = (S.f1.sessions || []).filter(s => s.meeting_key === ev.f1.meeting_key).sort((a, b) => Date.parse(a.date_start) - Date.parse(b.date_start));
    h += `<div class="dhead"><b>THE WEEKEND</b></div><div class="kv">` + same.map(s => `<span>${esc(f1SessName(s))}</span><span>${esc(new Date(s.date_start).toLocaleString([], {weekday: 'short', hour: 'numeric', minute: '2-digit'}))}</span>`).join('') + '</div>';
  }
  d.innerHTML = h; d.scrollTop = keep;
  d.querySelectorAll('[data-num]').forEach(b => b.onclick = () => { S.view = {kind: 'driver', num: +b.dataset.num}; S.f1.focus = +b.dataset.num; S.f1.cam = +b.dataset.num; f1CamPicker(); f1Detail(); f1Season().then(() => { if (S.view?.num === +b.dataset.num) f1Detail(); }).catch(() => {}); });
}
// a driver: this race from its timing, the season from the session results
function f1DriverHTML(num, inRace){
  const R = S.f1r, d = R?.D.get(num), sd = S.f1.seasonVal?.drivers.get(num), who = d || sd;
  if (!who) return `<div class="dhead"><b>DRIVER</b><button class="back">BACK</button></div><div class="muted">No details for this driver.</div>`;
  let h = `<div class="dhead"><b>${esc(who.team.toUpperCase())}</b><button class="back">BACK</button></div>`;
  h += `<div class="pcard"><canvas width="32" height="32"></canvas><div><div class="pn">#${num} ${esc(who.name.toUpperCase())}</div><div class="pm">${esc(who.code)} · ${esc(who.team)}</div></div></div>`;
  if (inRace && d) {
    const best = d.laps.filter(l => l.dur && l.n > 1).reduce((m, l) => !m || l.dur < m ? l.dur : m, null);
    const i = (R.order || []).findIndex(o => o.d === d), r = d.res;
    const fin = R.done || R.clock >= R.end ? (r?.position ? 'P' + r.position : r?.dnf ? 'DNF' : r?.dsq ? 'DSQ' : '--') : (i >= 0 ? 'P' + (i + 1) + ' now' : '--');
    h += `<h5>THIS RACE</h5><div class="kv"><span>Grid</span><span>${d.grid ? 'P' + d.grid : '--'}</span><span>${R.done ? 'Finish' : 'Position'}</span><span>${esc(fin)}</span>` +
      `<span>Laps</span><span>${r?.number_of_laps ?? d.laps.length}</span><span>Best lap</span><span>${f1Lap(best)}</span><span>Pit stops</span><span>${d.pits.length}</span>` +
      (R.done && r?.points ? `<span>Points</span><span>${r.points}</span>` : '') + '</div>';
  }
  h += `<h5>SEASON</h5>`;
  if (sd) h += `<div class="kv"><span>Championship</span><span>P${sd.rank}</span><span>Points</span><span>${sd.pts}</span><span>Wins</span><span>${sd.wins}</span><span>Podiums</span><span>${sd.podiums}</span>` +
    `<span>Best finish</span><span>${sd.best ? 'P' + sd.best : '--'}</span><span>Starts</span><span>${sd.starts}</span><span>Retirements</span><span>${sd.dnf}</span></div><div class="muted">Grands prix and sprints, from OpenF1's results.</div>`;
  else h += `<div class="muted">${S.f1.seasonVal ? 'No season results for this driver.' : 'Loading season results...'}</div>`;
  return h;
}
// the driver's helmet in team colors, with the car number
function f1Helmet(cv, num){
  if (!cv) return;
  const d = S.f1r?.D.get(num) || S.f1.seasonVal?.drivers.get(num) || {color: '#888888'};
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; g.clearRect(0, 0, 32, 32);
  const r = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  r(6, 27, 20, 2, 'rgba(0,0,0,.35)');
  r(9, 5, 14, 2, d.color); r(7, 7, 18, 12, d.color); r(6, 10, 20, 12, d.color); r(8, 22, 16, 4, d.color);
  r(9, 12, 15, 5, '#14141c'); r(10, 13, 6, 1, '#5aa9e6');
  r(7, 19, 18, 1, lum(d.color) > 0.6 ? '#14141c' : '#f2f0e8');
  const s = String(num); s.split('').forEach((ch, i) => digit(g, +ch, 15 - s.length * 2 + i * 4, 21, lum(d.color) > 0.6 ? '#14141c' : '#ffffff'));
}
// a constructor's box: the car's nose in team colors
function f1Badge(cv, team){
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; g.clearRect(0, 0, cv.width, cv.height);
  const r = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); }, alt = team.alt || '#ffffff';
  r(4, 7, 24, 3, team.color); r(4, 6, 24, 1, alt);                       // front wing
  r(13, 9, 6, 14, team.color); r(14, 9, 4, 1, alt);                       // nose and body
  r(10, 14, 12, 9, team.color); r(14, 15, 4, 3, '#14141c');               // cockpit
  r(7, 11, 4, 6, '#14141c'); r(21, 11, 4, 6, '#14141c');                  // front tyres
  r(5, 20, 5, 7, '#14141c'); r(22, 20, 5, 7, '#14141c');                  // rear tyres
  r(8, 26, 16, 3, team.color); r(8, 25, 16, 1, alt);                      // rear wing
}
async function f1TeamData(t){
  if (S.tdata[t.id]) return;
  const D = S.tdata[t.id] = {loading: true, games: [], news: [], stats: null};
  try { S.f1.seasonVal = await f1Season(); } catch (e) {}
  D.loading = false;
  if (S.tview?.team === t) renderTeamPage();
}
function f1TeamPage(){
  const pg = $('teampage'), v = S.tview; if (!v) return;
  const t = v.team, se = S.f1.seasonVal, D = S.tdata[t.id] || {loading: true};
  if (v.num != null) {
    pg.innerHTML = f1DriverHTML(v.num, !!S.f1r?.D.get(v.num) && S.mode === 'replay'); f1Helmet(pg.querySelector('canvas'), v.num);
    pg.querySelector('.back').onclick = () => { S.tview = {team: t}; renderTeamPage(); };
    return;
  }
  const evs = [...S.events.values()].filter(e => e.replay);
  const next = evs.filter(e => stateOf(e) === 'pre').sort((a, b) => new Date(a.date) - new Date(b.date))[0];
  const fin = evs.filter(e => stateOf(e) === 'post').sort((a, b) => new Date(b.date) - new Date(a.date));
  let h = `<div class="dhead"><button class="back">&lt; ALL TEAMS</button></div>`;
  h += `<div class="thead"><canvas width="32" height="32"></canvas><div><div class="pn">${esc(t.nick.toUpperCase())}</div><div class="pm">${t.rank ? `Constructors' championship P${t.rank} · ${esc(t.rec)}` : ''}</div></div></div>`;
  h += `<h5>DRIVERS</h5><div class="plist">` + (t.drivers || []).map(n => { const d = se?.drivers.get(n); return d ? `<button class="pl" data-num="${n}"><span class="n">#${n}</span><span>${esc(d.name)}</span><span class="ps">${d.pts}</span></button>` : ''; }).join('') + '</div>';
  h += `<h5>NEXT RACE</h5>` + (next ? `<button class="game" data-gid="${esc(next.id)}" data-mode="pre"><span class="m">${esc(f1GameLine(next).m)}</span><span class="s">${esc(f1GameLine(next).s)}</span></button>` : `<div class="muted">No race on the schedule.</div>`);
  h += `<h5>NEWS</h5><div class="muted">OpenF1 carries timing, not news, so there are no stories here.</div>`;
  h += `<h5>REPLAY A RACE</h5>`;
  if (fin.length) h += fin.slice(0, v.all ? fin.length : 8).map(e => {
    const rs = (t.results?.get(+e.id) || []).map(r => r.position ? 'P' + r.position : r.dnf ? 'DNF' : '').filter(Boolean).join(', ');
    return `<button class="game" data-gid="${esc(e.id)}" data-mode="replay"><span class="m">${esc(f1GameLine(e).m)}</span><span class="s">${esc(rs || f1GameLine(e).s)}</span></button>`;
  }).join('') + (fin.length > 8 && !v.all ? `<button class="back more">ALL ${fin.length} RACES</button>` : '');
  else h += `<div class="muted">${D.loading ? 'Loading races...' : 'No finished races this season yet.'}</div>`;
  h += `<h5>SEASON STATS</h5>` + (t.rank ? `<div class="kv"><span>Points</span><span>${t.pts}</span><span>Wins</span><span>${t.wins}</span><span>Podiums</span><span>${t.podiums}</span><span>Best finish</span><span>${t.best ? 'P' + t.best : '--'}</span></div><div class="muted">Grands prix and sprints, from OpenF1's results.</div>` : `<div class="muted">${D.loading ? 'Loading stats...' : 'No season stats yet.'}</div>`);
  pg.innerHTML = h;
  f1Badge(pg.querySelector('.thead canvas'), t);
  pg.querySelector('.back').onclick = () => { S.tview = null; renderTeams(); $('teamgrid').querySelector(`[data-tid="${t.id}"]`)?.focus(); };
  const more = pg.querySelector('.more'); if (more) more.onclick = () => { v.all = true; renderTeamPage(); };
  pg.querySelectorAll('[data-gid]').forEach(b => b.onclick = () => { selectGame(b.dataset.gid, b.dataset.mode); $('stage').scrollIntoView({behavior: 'smooth', block: 'start'}); });
  pg.querySelectorAll('[data-num]').forEach(b => b.onclick = () => { S.tview = {team: t, num: +b.dataset.num}; renderTeamPage(); });
}
// before anything loads: a stand-in circuit
async function f1Neutral(){
  S.home = null; S.away = null; S.f1r = null;
  S.f1.track = f1Generic(); buildField();
  $('abA').textContent = '--'; $('abH').textContent = '--'; $('scA').textContent = ''; $('scH').textContent = '';
  $('chipA').style.background = '#334477'; $('chipH').style.background = '#334477';
}
// the circuit refits when the window changes size (the booth and scoreboard cover different parts of it)
let f1Resize = 0;
addEventListener('resize', () => { clearTimeout(f1Resize); f1Resize = setTimeout(() => { if (isF1() && S.f1?.track) buildField(); }, 250); });
