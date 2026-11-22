// Checks the F1 replay's running order and onboard caption against a race shaped like OpenF1's 2026 Las Vegas GP.
//   node tools/check_f1.cjs
// It needs no browser and no internet: it loads sports/f1.js and sports/f1cam.js with OpenF1 answered from data built
// below, the way OpenF1 sends a race: lap 1 has a start time but no lap time or sector 1 for anyone, a car out on lap 1
// (ALB, 14th on the grid) has only that lap and a DNF with 0 laps in the results, and the P2 finisher's last lap has
// no lap time yet. It checks that:
//   - a car that stops on lap 1 never leads, runs behind every car still going on that lap, and is OUT after it
//   - the running order during lap 1 is the order the cars start lap 2 in, and the winner leads at the flag
//   - a finisher whose last lap has no time is never shown as out
//   - the retirement shows in the play-by-play at the moment the car is shown out
//   - the onboard caption says LEADER while results are hidden, and WINNER only once results show or the flag falls
//   - a loaded race is kept in sessionStorage, so switching tabs doesn't ask OpenF1 again
// Exit code 1 means one of these failed.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');

/* ---- a Las Vegas-shaped race: 20 cars, 50 laps ---- */
const KEY = 9999, LAPS = 50, START = Date.parse('2026-11-22T04:03:00Z');
// [number, code, first, last, team, colour, grid] in finishing order; ALB is the lap 1 retirement
const FIELD = [
  [3, 'VER', 'Max', 'Verstappen', 'Red Bull Racing', '4781d7', 2], [1, 'NOR', 'Lando', 'Norris', 'McLaren', 'f47600', 1],
  [81, 'PIA', 'Oscar', 'Piastri', 'McLaren', 'f47600', 4], [63, 'RUS', 'George', 'Russell', 'Mercedes', '00d7b6', 3],
  [16, 'LEC', 'Charles', 'Leclerc', 'Ferrari', 'ed1131', 6], [44, 'HAM', 'Lewis', 'Hamilton', 'Ferrari', 'ed1131', 8],
  [12, 'ANT', 'Kimi', 'Antonelli', 'Mercedes', '00d7b6', 5], [14, 'ALO', 'Fernando', 'Alonso', 'Aston Martin', '229971', 9],
  [55, 'SAI', 'Carlos', 'Sainz', 'Williams', '1868db', 7], [6, 'HAD', 'Isack', 'Hadjar', 'Red Bull Racing', '4781d7', 10],
  [87, 'BEA', 'Oliver', 'Bearman', 'Haas F1 Team', '9c9fa2', 11], [31, 'OCO', 'Esteban', 'Ocon', 'Haas F1 Team', '9c9fa2', 12],
  [10, 'GAS', 'Pierre', 'Gasly', 'Alpine', '00a1e8', 13], [27, 'HUL', 'Nico', 'Hulkenberg', 'Audi', 'f50537', 15],
  [5, 'BOR', 'Gabriel', 'Bortoleto', 'Audi', 'f50537', 16], [30, 'LAW', 'Liam', 'Lawson', 'Racing Bulls', '6c98ff', 17],
  [41, 'LIN', 'Arvid', 'Lindblad', 'Racing Bulls', '6c98ff', 18], [18, 'STR', 'Lance', 'Stroll', 'Aston Martin', '229971', 19],
  [43, 'COL', 'Franco', 'Colapinto', 'Alpine', '00a1e8', 20], [23, 'ALB', 'Alexander', 'Albon', 'Williams', '1868db', 14],
];
const iso = ms => new Date(ms).toISOString();
const DATA = {drivers: [], laps: [], position: [], pit: [], race_control: [], session_result: []};
FIELD.forEach(([num, code, first, last, team, colour, grid], i) => {
  DATA.drivers.push({session_key: KEY, driver_number: num, name_acronym: code, first_name: first, last_name: last, team_name: team, team_colour: colour});
  DATA.position.push({session_key: KEY, driver_number: num, position: grid, date: iso(START - 60000)});
  if (code === 'ALB') {
    DATA.laps.push({session_key: KEY, driver_number: num, lap_number: 1, date_start: iso(START), lap_duration: null, duration_sector_1: null, duration_sector_2: null, duration_sector_3: null});
    DATA.session_result.push({session_key: KEY, driver_number: num, position: null, number_of_laps: 0, dnf: true, dns: false, dsq: false, points: 0});
    return;
  }
  // lap 1 from a standing start, then steady laps; a car further down the order is a little slower each lap
  let t = START;
  for (let n = 1; n <= LAPS; n++) {
    const dur = n === 1 ? 104 + grid * 0.35 + i * 0.05 : 94.5 + i * 0.04 + ((n * 7 + i * 3) % 5) * 0.05;
    const lastLapNoTime = code === 'NOR' && n === LAPS;
    DATA.laps.push({session_key: KEY, driver_number: num, lap_number: n, date_start: iso(t),
      lap_duration: n === 1 || lastLapNoTime ? null : +dur.toFixed(3), duration_sector_1: n === 1 ? null : +(dur * 0.31).toFixed(3),
      duration_sector_2: +(dur * 0.37).toFixed(3), duration_sector_3: +(dur * 0.32).toFixed(3), is_pit_out_lap: false});
    t += dur * 1000;
  }
  DATA.session_result.push({session_key: KEY, driver_number: num, position: i + 1, number_of_laps: LAPS, dnf: false, dns: false, dsq: false, points: Math.max(0, [25, 18, 15, 12, 10, 8, 6, 4, 2, 1][i] || 0)});
});

/* ---- load the F1 code with OpenF1 answered from DATA ---- */
const asked = [], store = new Map();
const ctx = {
  console, Date, Math, JSON, Map, Set, Promise, Number, String, Array, Object, RegExp, Infinity, isFinite, setTimeout, clearTimeout,
  S: {sport: 'f1', f1: {}, mode: 'replay'},
  HIDE: true,
  sessionStorage: {getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v))},
  sleep: ms => new Promise(r => setTimeout(r, Math.min(ms, 5))),
  getJSON: async url => { asked.push(url); const ep = new URL(url).pathname.split('/').pop(); if (!DATA[ep]) throw new Error('HTTP 404'); return JSON.parse(JSON.stringify(DATA[ep])); },
  addEventListener() {},
};
ctx.hideRes = () => ctx.HIDE;
vm.createContext(ctx);
for (const f of ['sports/f1.js', 'sports/f1cam.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, {filename: f});
// the scripts' const functions aren't properties of the context, so reach them through an expression
const F = vm.runInContext('({f1LoadRace, f1Order, f1CamCaption, f1Flagged, f1Prog, f1Cache, f1Times})', ctx);
// the rate limiter spaces real requests 380 ms apart; the test doesn't need to wait for it
ctx.Date = class extends Date { static now(){ return Date.now() + (ctx.skew = (ctx.skew || 0) + 400); } };

(async () => {
  const bad = [], ok = (cond, msg) => { if (!cond) bad.push(msg); };
  const R = await F.f1LoadRace({id: String(KEY), f1: {session_key: KEY}});
  ok(R, 'the race did not load');
  if (!R) return finish(bad);
  const codes = t => F.f1Order(R, t).map(o => o.d.code);
  const alb = R.cars.find(d => d.code === 'ALB'), nor = R.cars.find(d => d.code === 'NOR'), ver = R.cars.find(d => d.code === 'VER');

  // lap 1: whoever leads, it isn't the car that stops, and the order is the order the cars start lap 2 in
  const lap2 = R.cars.filter(d => d !== alb).map(d => ({code: d.code, t: d.laps.find(l => l.n === 2).t0})).sort((a, b) => a.t - b.t);
  const firstAcross = lap2[0].t;
  for (const s of [0.5, 5, 20, 40, 60, 80, (firstAcross - R.t0) / 1000 - 0.05]) {
    const o = F.f1Order(R, R.t0 + s * 1000), lead = o[0];
    ok(lead.d.code !== 'ALB', `${s.toFixed(1)}s into lap 1, ALB leads (order ${o.slice(0, 4).map(r => r.d.code).join(' ')})`);
    const ai = o.findIndex(r => r.d.code === 'ALB'), running = o.filter(r => !r.out && r.d.code !== 'ALB').length;
    ok(ai >= running, `${s.toFixed(1)}s into lap 1, ALB is P${ai + 1}, ahead of a car still running`);
  }
  const atLine = codes(firstAcross - 50).filter(c => c !== 'ALB'), want = lap2.map(x => x.code);
  ok(atLine.join(' ') === want.join(' '), `the order at the end of lap 1 is ${atLine.join(' ')}, but the cars start lap 2 as ${want.join(' ')}`);
  const end1 = F.f1Order(R, lap2.at(-1).t + 1000), albRow = end1.find(r => r.d.code === 'ALB');
  ok(albRow.out && albRow.gap === 'OUT' && end1.at(-1) === albRow, 'ALB is not shown OUT, at the back, once lap 1 is done');
  ok(F.f1Prog(R, alb, R.end).p === 0, 'ALB is credited with a lap he never finished');

  // the whole race: the car out on lap 1 never leads, and the winner takes the flag in front
  for (let t = R.t0; t <= R.end; t += 5000) if (F.f1Order(R, t)[0].d.code === 'ALB') { ok(false, `ALB leads at ${((t - R.t0) / 1000).toFixed(0)}s`); break; }
  const fin = F.f1Order(R, ver.finishT + 1);
  ok(fin[0].d.code === 'VER' && fin[0].gap === 'FIN', `at the flag the order starts ${fin[0].d.code} ${fin[0].gap}, not VER FIN`);
  // a finisher whose last lap has no time is still racing on it, not out
  const nl = nor.laps.at(-1);
  for (const dt of [10000, 50000, 90000]) ok(!F.f1Prog(R, nor, nl.t0 + dt).out, `NOR is shown out ${dt / 1000}s into a last lap that has no lap time`);
  ok(F.f1Order(R, nor.finishT + 1).find(r => r.d.code === 'NOR').fin, 'NOR is not shown finished after the line');
  // the retirement comes up in the play-by-play when the tower shows the car out
  const outEv = R.events.find(e => e.kind === 'out' && e.num === alb.num);
  ok(outEv && alb.stop && outEv.t === alb.stop.outT, 'the "ALB is out" play is not at the moment ALB is shown out');
  ok(!R.events.some(e => (e.kind === 'lead') && e.num === alb.num), 'the play-by-play says ALB takes the lead');

  // the onboard caption and the camera picker's first line
  ctx.S.f1.cam = null; ctx.HIDE = true;
  R.clock = R.t0 + 30000; ok(F.f1CamCaption(R) === 'ONBOARD - LEADER', `mid-race with results hidden the caption is "${F.f1CamCaption(R)}"`);
  R.clock = ver.finishT - 1000; ok(F.f1CamCaption(R) === 'ONBOARD - LEADER', 'a second before the flag the caption already names the winner');
  R.clock = ver.finishT + 1; ok(F.f1CamCaption(R) === 'ONBOARD - WINNER', 'past the flag the caption does not say WINNER');
  R.clock = R.t0 + 30000; ctx.HIDE = false; ok(F.f1CamCaption(R) === 'ONBOARD - WINNER', 'with results shown the caption does not say WINNER');
  ctx.S.f1.cam = 14; ok(F.f1CamCaption(R) === 'ONBOARD', 'a picked car is still called the winner or leader');

  // the race is kept for this tab: loading it again asks OpenF1 nothing
  ok(store.size >= 6, `only ${store.size} of the race's endpoints were kept in sessionStorage`);
  F.f1Cache.clear(); const before = asked.length;
  await F.f1LoadRace({id: String(KEY), f1: {session_key: KEY}});
  ok(asked.length === before, `loading the race again asked OpenF1 ${asked.length - before} more times`);
  finish(bad);
})().catch(e => { console.log('F1 replay: PROBLEMS\n  ' + (e.stack || e)); process.exit(1); });

function finish(bad){
  console.log(`F1 replay (lap 1 retirement, onboard caption): ${bad.length ? 'PROBLEMS' : 'ok'}`);
  bad.forEach(l => console.log('  ' + l));
  process.exit(bad.length ? 1 : 0);
}
