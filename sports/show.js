/* Pixel Broadcasting Company: the Sports Desk.
   The channel's entry point. Bo Kowalski hosts a loop that works its way through every sport: every team's latest
   final, the best two or three as features (set up at the desk, highlights cut from the real play-by-play, then the
   result, the records and the team stats) and the rest as quick hits (the play that decided it, and the final), then
   the next sport, and a commercial break at the end of the loop. Baldur, the kitchen dog, naps in the studio. A live game always wins: when one is on, the desk hands the broadcast straight over to it.

   Everything the desk says comes from the data already on the page: scores and stats from the game feeds, highlight
   clips from the replay the sport's own code builds. Bo's and the guests' linking lines are written here, in this
   file, and never generated while the page runs. The guest in the second booth seat is one of that sport's own two
   commentators, and the commercial break is read by Dot Delgado from the same fixed ad copy the newsroom uses
   (../shared/ads.js). A viewer who picks a game, a team or a sport takes over and the show stands down (deskStop).

   This file only declares things; it runs against the page's own state (S, SHOW, CAST, SPORTS) once sports/index.html
   has loaded. Hooks live in index.html: crew/say route the booth, step draws these screens, selectGame and
   switchSport stop the show, pump brings it back when a replay ends. */
'use strict';

const DESK_AD_MS = 10000;                       // a break ad holds the screen for ten seconds, same as the newsroom's
const DESK_ORDER = ['nfl', 'cfb', 'nba', 'wnba', 'mlb', 'f1'];
const SHOW = {
  on: false,        // the show is running (the booth is Bo and a guest, and the desk drives the page)
  tok: 0,           // bumped whenever the show stops, so an old run stops talking
  driving: false,   // the desk is the one calling selectGame/switchSport, so those don't stop it
  scene: null,      // 'panel' or 'ad' while a desk screen is up; null during a highlight clip
  guestRole: 'B',   // which of the sport's two commentators is the guest this time round
  loop: 0, brk: false, everOn: false, resume: false, timer: null, ad: null, adEnd: 0,
  head: '', note: '', title: '', rows: [],
  line: null,       // the line being read: {who: booth seat 'A' or 'B', text, at}, for the lower third
  seg: null,        // the rundown segment on air: a sport key, or 'break'
  pick: null,       // a segment the viewer picked in the rundown, played next
  cut: false,       // cut the segment on air short (a rundown pick, or a game that just went live)
  t0: 0             // when the segment on air started (Date.now), for the rundown's clock times
};

// Bo and Dot in the booth's own style, drawn by drawAnnouncer. Their colours follow the newsroom's cast
// (Bo's green jacket, Dot's pink) so the same people read the same on both channels.
const DESK_BO = {name: 'BO KOWALSKI', tag: 'BO', look: {jacket: '#1f7a52', shirt: '#ffffff', skin: '#f1c6a0', hair: '#c4582b', brow: '#a0461f'}};
const DESK_DOT = {name: 'DOT DELGADO', tag: 'DOT', look: {jacket: '#c2417a', shirt: '#f6eef2', skin: '#b97a52', hair: '#1c1418', brow: '#1c1418', longHair: true, glasses: true}};

/* ---- the booth while the show is on: Bo hosts, the sport's commentator guests, Dot reads the break ---- */
function deskCrew(){
  const guest = (CAST[S.sport] || CAST.nfl)[SHOW.guestRole] || CAST.nfl.B;
  return {A: DESK_BO, B: SHOW.brk ? DESK_DOT : guest};
}
// which booth seat a line comes from: Bo ('H') hosts from the left, the guest ('G') or Dot ('D') answers from the right.
// A play-by-play line ('A') is the guest reading the play; the colour line ('B') is left out, so clips stay tight.
const deskSlot = who => who === 'H' ? 'A' : who === 'D' || who === 'G' || who === 'A' ? 'B' : null;
function deskVoice(who){
  if (who === 'H') return {v: VOICES.desk?.H || null, st: [0.95, 1.06]};
  if (who === 'D') return {v: VOICES.desk?.D || null, st: [1.12, 1.04]};
  const r = SHOW.guestRole || 'B';
  return {v: (VOICES[S.sport] || VOICES.nfl)[r] || null, st: (VOICE_STYLE[S.sport] || VOICE_STYLE.nfl)[r]};
}
// Bo and Dot get voices of their own where the device has enough of them (called from pickVoices)
function deskVoices(vs, p){
  if (!vs || !vs.length) return {H: null, D: null};
  const H = vs.find(v => /Google US English|Daniel|Alex|Guy|David|Aaron/i.test(v.name)) || (p.male || [])[0] || p.A || vs[0];
  const D = (p.fem || []).find(v => v !== p.nina) || p.nina || vs.find(v => /Female|Samantha|Zira|Jenny|Aria/i.test(v.name)) || p.B || vs[0];
  return {H, D};
}

/* ---- starting and stopping ---- */
const deskAlive = tok => SHOW.on && SHOW.tok === tok;
// the segment on air carries on: false once the show stops, or once a rundown pick or a live game asks to cut away
// (SHOW.cut), so the switch happens within a line or two instead of at the end of the segment
const deskGo = tok => deskAlive(tok) && !SHOW.cut;
const deskSay = (who, text, tok) => deskGo(tok) ? say(who, text, S.token) : Promise.resolve();
async function deskHold(ms, tok){ const t0 = Date.now(); while (deskGo(tok) && Date.now() - t0 < ms) await sleep(120); }
function deskTabs(){
  $('tab-desk').setAttribute('aria-pressed', String(SHOW.on));
  for (const k of Object.keys(SPORTS)) $('sport-' + k)?.setAttribute('aria-pressed', String(!SHOW.on && k === S.sport));
  setFeedTitle();
  deskRundown();
}
function deskStop(){
  SHOW.tok++; SHOW.on = false; SHOW.scene = null; SHOW.resume = false; SHOW.brk = false; SHOW.ad = null;
  if (SHOW.timer) { clearInterval(SHOW.timer); clearTimeout(SHOW.timer); SHOW.timer = null; }
  deskAdLink(null);
  deskTabs();
}
async function deskStart(tuneIn = true){
  deskStop();
  if (tuneIn) pressStart();                      // a viewer tap unlocks audio; automatic entry stays silent
  S.deskEntry = true;
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  SHOW.on = true; SHOW.everOn = true; SHOW.loop = 0; SHOW.tok++; SHOW.seg = null; SHOW.pick = null;
  const tok = SHOW.tok;
  hideNotice(); hideBanner(); deskTabs();
  deskPanel('PBC SPORTS DESK', [], 'Bo Kowalski has the scores, the highlights and the stats.');
  try { await deskRun(tok); } catch (e) { console.warn('sports desk stopped', e); }
}
// the loop: every sport in turn, then the commercial break, then round again. A segment the viewer picks in the
// rundown goes next, the way the newsroom's rundown works.
const DESK_SEGS = [...DESK_ORDER, 'break'];
// a game live right now (shared/live.js) goes next, unless the viewer picked something in the rundown
const deskLive = () => { const lg = window.PBC_LIVE && PBC_LIVE.current; return lg && DESK_ORDER.includes(lg.sport) ? lg.sport : null; };
const deskNext = () => SHOW.pick || (deskLive() !== SHOW.seg && deskLive()) || DESK_SEGS[(DESK_SEGS.indexOf(SHOW.seg) + 1) % DESK_SEGS.length];
async function deskRun(tok){
  let sg = deskLive() || DESK_SEGS[0];
  while (deskAlive(tok)) {
    SHOW.seg = sg; SHOW.t0 = Date.now(); SHOW.cut = false; if (SHOW.pick === sg) SHOW.pick = null;
    if (sg === 'break') { await deskBreak(tok); SHOW.loop++; }
    else if (await deskSport(sg, tok) === 'live') return;  // a live game has the broadcast now
    if (!deskAlive(tok)) return;
    const cut = SHOW.cut; SHOW.cut = false;
    if (!cut) deskLenSave(sg, Date.now() - SHOW.t0);       // a segment cut short says nothing about its length
    sg = deskNext(); SHOW.pick = null;
    if (cut) { SHOW.brk = false; SHOW.ad = null; deskAdLink(null); await deskSay('H', sg === 'break' ? 'Let us take a quick break.' : `Over to ${deskLg(sg)}.`, tok); }
  }
}
// Bo's hand-off names whatever really comes next, the viewer's pick included
function deskOutro(sp){
  const nx = deskNext();
  if (nx === deskLive() && !SHOW.pick) return `That is ${deskLg(sp)}. We have ${deskLg(nx)} live right now, so that is where we go next.`;
  return `That is ${deskLg(sp)}. ${nx === 'break' ? 'A quick break, and we go round again.' : deskLgCap(nx) + ' is next.'}`;
}

/* ---- the rundown in the side column: every segment of the loop, the one on air first ----
   Like the newsroom's, each segment shows the clock time it starts. A desk segment's length
   depends on the games and the voices, so it is the length that segment last ran on this device (until it has run
   once, a typical length), and the times move along if the segment on air runs long. */
const DESK_EST = {break: 36000, f1: 150000};            // typical lengths before a segment has run here
const DESK_EST_SPORT = 600000;                         // a sport works through every team's latest game
let DESK_LENS = {};
try { DESK_LENS = JSON.parse(localStorage.getItem('pbc-desk-lens') || '{}') || {}; } catch (e) {}
function deskLenSave(sg, ms){
  if (!(ms > 5000 && ms < 30 * 60000)) return;
  DESK_LENS[sg] = Math.round(ms);
  try { localStorage.setItem('pbc-desk-lens', JSON.stringify(DESK_LENS)); } catch (e) {}
}
const deskLen = sg => Number(DESK_LENS[sg]) || DESK_EST[sg] || DESK_EST_SPORT;
const deskClock = t => new Date(t).toLocaleTimeString([], {hour: 'numeric', minute: '2-digit', second: '2-digit'});
const deskTm = t => deskClock(t.st);                 // start times only, matching the newsroom's rundown (Chris)
// start time and length of every row, in rundown order (the segment on air first, then the picked one, then the rest)
function deskTimes(order){
  const now = Date.now(), out = [];
  let at = SHOW.t0 || now;
  for (const sg of order) {
    let len = deskLen(sg);
    if (sg === SHOW.seg) len = Math.max(len, now - at + 5000);   // running long: everything after it moves back
    out.push({st: at, len}); at += len;
  }
  return out;
}
function deskOrder(){
  const cur = Math.max(0, DESK_SEGS.indexOf(SHOW.seg)), n = DESK_SEGS.length;
  const rest = []; for (let k = 1; k < n; k++) rest.push(DESK_SEGS[(cur + k) % n]);
  const nx = SHOW.pick || deskLive(), p = nx && rest.includes(nx) ? [nx] : [];
  return [DESK_SEGS[cur], ...p, ...rest.filter(x => !p.includes(x))];
}
// once a second: only the times change, so the buttons stay put under the viewer's pointer
function deskTick(){
  if (!SHOW.on) return;
  const rows = $('deskrd')?.children; if (!rows) return;
  const ts = deskTimes(deskOrder());
  for (let k = 0; k < rows.length && k < ts.length; k++) {
    const tm = rows[k].querySelector('.tm');
    if (tm) tm.textContent = deskTm(ts[k]);
  }
}
setInterval(deskTick, 1000);
function deskRundown(){
  const pan = $('rdpanel'); if (!pan) return;
  pan.hidden = !SHOW.on;
  if (!SHOW.on) return;
  const ol = $('deskrd'); ol.replaceChildren();
  const order = deskOrder(), ts = deskTimes(order);
  for (const [k, sg] of order.entries()) {
    const on = SHOW.seg === sg;
    const li = document.createElement('li');
    if (on) li.className = 'now'; else if (SHOW.pick === sg) li.className = 'picked';
    const tm = document.createElement('span'); tm.className = 'tm'; tm.textContent = deskTm(ts[k]);
    const label = sg === 'break' ? 'Commercial break' : SPORTS[sg].name + ' recap';
    let nm;
    if (on) { nm = document.createElement('span'); nm.textContent = label; }
    else {
      nm = document.createElement('button'); nm.type = 'button'; nm.className = 'pk'; nm.textContent = label;
      nm.setAttribute('aria-label', 'Go to the ' + label.toLowerCase() + ' next');
      nm.onclick = () => { SHOW.pick = SHOW.pick === sg ? null : sg; SHOW.cut = !!SHOW.pick; deskRundown(); };
    }
    li.append(tm, nm);
    ol.appendChild(li);
  }
}

/* ---- one sport's slot ----
   Every team's latest final gets on air, the way a real desk works through a slate. The best two or three games are
   features: Bo and the guest set the game up at the desk (who, when, where, what was on the line), the highlights run,
   and they come back for the result, the records and the team stats. Every other game is a quick hit: where and when,
   the play that won it, and the final. Anything past that is read off the board at the end. */
const DESK_QUICK_MAX = 6;                          // quick hits with a highlight; the rest are read off the board
async function deskSport(sp, tok){
  const name = SPORTS[sp].name;
  SHOW.guestRole = SHOW.loop % 2 ? 'A' : 'B';
  deskPanel(name + ' DESK', [], 'Getting the latest from ' + SPORTS[sp].src + '.');
  SHOW.driving = true;
  try { if (S.sport !== sp) await switchSport(sp); else await loadScoreboard(); }
  catch (e) { /* the sport's own code has already said so on screen */ }
  finally { SHOW.driving = false; }
  if (!deskGo(tok) || S.sport !== sp) return;
  deskTabs();
  const {live, next, fin} = sortedGames(true);

  // a live game wins: the desk sends the broadcast there and stands down until it is over
  if (live.length) {
    const ev = live[0];
    deskPanel(name + ' LIVE NOW', [deskRow(ev, 'live')], 'Taking you there now.');
    await deskSay('H', `We have ${deskLg(sp)} live right now. Let us get you straight there.`, tok);
    if (!deskGo(tok)) return;
    SHOW.on = false; SHOW.scene = null; SHOW.resume = true;
    SHOW.driving = true;
    try { await selectGame(String(ev.id), 'live'); } finally { SHOW.driving = false; }
    deskTabs();
    return 'live';
  }
  if (!fin.length) {
    deskPanel(name + ' DESK', next.slice(0, 5).map(ev => deskRow(ev, 'next')), next.length ? 'Nothing has finished in the last few days.' : 'No games to show.');
    await deskSay('H', `Nothing to recap in ${deskLg(sp)} just yet.` + (next[0] ? ` Next up, ${deskWho(next[0])}.` : ''), tok);
    await deskHold(3500, tok);
    return;
  }
  const guest = (CAST[sp] || CAST.nfl)[SHOW.guestRole];
  const hello = `${SHOW.loop ? 'Still with you at' : 'Welcome to'} the PBC sports desk. I am Bo Kowalski, and ${deskName(guest.name)} is alongside me for ${deskLg(sp)}.`;
  if (sp === 'f1') {
    deskPanel(name + ' SCOREBOARD', fin.slice(0, 5).map(ev => deskRow(ev, 'fin')), 'Scores from ' + SPORTS[sp].src + '.');
    await deskSay('H', hello, tok);
    if (!deskGo(tok)) return;
    return deskF1(sp, fin, tok);
  }

  const slate = deskSlate(); if (!slate.length) slate.push(fin[0]);
  const feats = deskFeatures(slate);
  const others = slate.filter(ev => !feats.includes(ev)), quick = others.slice(0, DESK_QUICK_MAX), board = others.slice(DESK_QUICK_MAX);
  // the open: what is coming up, with no scores on the screen yet
  deskPanel(name + ' ON THE DESK', [...feats.map(ev => deskMatchRow(ev, 'FEATURE')), ...quick.slice(0, 6 - feats.length).map(ev => deskMatchRow(ev))],
    `${slate.length} ${slate.length === 1 ? 'game' : 'games'} · ${SPORTS[sp].src}`, `${slate.length} ${name} ${slate.length === 1 ? 'game' : 'games'} to get through`);
  await deskSay('H', hello + (slate.length > 1 ? ` We have ${deskCount(slate.length)} games to get through, starting with ${feats.length > 1 ? 'our featured games' : 'our featured game'}.` : ''), tok);
  for (const [k, ev] of feats.entries()) {
    if (!deskGo(tok)) return;
    await deskFeature(sp, ev, k, tok);
  }
  if (!deskGo(tok)) return;
  if (quick.length) {
    deskPanel('AROUND THE ' + name, quick.map(ev => deskMatchRow(ev)), SPORTS[sp].src, `Around ${deskLg(sp)}`);
    await deskSay('H', `Around ${deskLg(sp)} now, with the play that decided each one.`, tok);
    for (const [k, ev] of quick.entries()) {
      if (!deskGo(tok)) return;
      await deskQuick(sp, ev, k, quick, tok);
    }
  }
  if (!deskGo(tok)) return;
  if (board.length) {
    deskPanel('MORE ' + name + ' FINALS', board.slice(0, 8).map(ev => deskRow(ev, 'fin')), 'Scores from ' + SPORTS[sp].src + '.', `More ${name} finals`);
    await deskSay('G', 'And the rest of the scores. ' + board.slice(0, 6).map(deskScoreLine).join('. ') + '.', tok);
    if (!deskGo(tok)) return;
  }
  await deskSay('H', deskOutro(sp), tok);
  await deskHold(1200, tok);
}
// a feature: set up at the desk, the highlights, then back to the desk for the result, the records and the stats
async function deskFeature(sp, ev, k, tok){
  const name = SPORTS[sp].name, t = teamsOf(ev);
  deskPanel(name + ' FEATURE', deskIntroRows(ev), SPORTS[sp].src, `${fullName(t.away)} at ${fullName(t.home)}`);
  await deskSay('H', deskIntro(ev, k), tok);
  if (!deskGo(tok)) return;
  await deskSay('G', deskStory(ev, sp), tok);
  if (!deskGo(tok)) return;
  await deskSay('H', 'Let us look at how it happened.', tok);
  if (!deskGo(tok)) return;
  SHOW.driving = true;
  try { await selectGame(String(ev.id), 'replay'); } finally { SHOW.driving = false; }
  if (!deskGo(tok)) return;
  deskTabs();
  const clips = deskClips(ev);
  if (!clips.length) await deskSay('H', 'The play-by-play has no highlight to cut to, so here is the top of the game.', tok);
  for (const c of clips) {
    if (!deskGo(tok)) break;
    SHOW.scene = null;                                   // back to the field for the clip itself
    await deskSay('H', c.intro, tok);
    await deskClip(c, tok);
  }
  if (!deskGo(tok)) return;
  deskPanel(name + ' FINAL', [deskRow(ev, 'fin')], deskWhere(ev) || SPORTS[sp].src, deskResult(ev));
  await deskSay('G', (deskResult(ev) + ' ' + deskRecords(ev)).trim(), tok);
  if (!deskGo(tok)) return;
  const rows = deskStatRows();
  deskPanel(name + ' TEAM STATS', rows, S.away && S.home ? `${S.away.abbr} at ${S.home.abbr} · ${SPORTS[sp].src}` : SPORTS[sp].src,
    S.away && S.home ? `${fullName(S.away)} at ${fullName(S.home)}, by the numbers` : '');
  await deskSay('G', deskStatLine(rows), tok);
  await deskHold(800, tok);
}
// a quick hit: where and when, the play that won it, and the final. Bo and the guest take turns.
async function deskQuick(sp, ev, k, list, tok){
  const name = SPORTS[sp].name, t = teamsOf(ev), a = k % 2 ? 'G' : 'H', b = k % 2 ? 'H' : 'G';
  deskPanel('AROUND THE ' + name, list.map((x, i) => deskMatchRow(x, i === k ? 'NOW' : '')), deskWhere(ev) || SPORTS[sp].src, `${fullName(t.away)} at ${fullName(t.home)}`);
  await deskSay(a, deskQuickIntro(ev), tok);
  if (!deskGo(tok)) return;
  SHOW.driving = true;
  try { await selectGame(String(ev.id), 'replay'); } finally { SHOW.driving = false; }
  if (!deskGo(tok)) return;
  deskTabs();
  const [c] = deskClips(ev, true);
  if (c) { SHOW.scene = null; await deskSay(a, c.intro, tok); await deskClip(c, tok); }
  if (!deskGo(tok)) return;
  deskPanel('AROUND THE ' + name, list.map((x, i) => i <= k ? deskRow(x, 'fin') : deskMatchRow(x)), deskWhere(ev) || SPORTS[sp].src, deskResult(ev));
  await deskSay(b, deskResult(ev), tok);
  await deskHold(500, tok);
}

/* ---- which games: every team's latest final, and the ones worth a feature ---- */
const deskIds = ev => ev.competitions[0].competitors.map(c => String(c.team?.id ?? c.id));
const deskRank = ev => Math.min(...ev.competitions[0].competitors.map(c => c.curatedRank?.current || 99));
// finals from the last eight days, newest first, keeping a game while it is the latest for either of its teams.
// College football is every FBS game, so there it is the games with a ranked team in them.
function deskSlate(){
  let fin = [...S.events.values()].filter(e => stateOf(e) === 'post' && Date.now() - new Date(e.date) < 8 * 864e5)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  if (S.sport === 'cfb') { const top = fin.filter(e => deskRank(e) <= 25); fin = top.length ? top : fin.slice(0, 8); }
  const seen = new Set(), out = [];
  for (const ev of fin) {
    const ids = deskIds(ev);
    if (ids.some(id => !seen.has(id))) out.push(ev);
    ids.forEach(id => seen.add(id));
  }
  return out;
}
// the final's margin and whether it needed extra time, from the score and the status line
function deskShape(ev){
  const t = teamsOf(ev), m = Math.abs(Number(t.away.score) - Number(t.home.score));
  const det = (ev.status || ev.competitions[0].status || {}).type?.shortDetail || '';
  const fam = SPORTS[S.sport].family, ot = /OT|\/(1\d|[2-9]\d)\b/.test(det);
  const close = fam === 'football' ? m <= 7 : isMLB() ? m <= 1 : m <= 5;
  const rout = fam === 'football' ? m >= 21 : isMLB() ? m >= 6 : m >= 20;
  return {m, ot, close: Number.isFinite(m) && close, rout: Number.isFinite(m) && rout};
}
const deskNote = ev => { const n = ev.competitions[0].notes?.[0]?.headline || ''; return /regular season/i.test(n) ? '' : n; };
// two features, three on a big slate: overtime, close games, ranked teams and playoff games first
function deskFeatures(slate){
  const score = (ev, i) => { const s = deskShape(ev), r = deskRank(ev);
    return (s.ot ? 3 : 0) + (s.close ? 2 : 0) - (s.rout ? 1 : 0) + (r <= 25 ? (26 - r) / 5 : 0) + (deskNote(ev) ? 3 : 0) + (i === 0 ? 1 : 0); };
  const n = slate.length >= 10 ? 3 : 2;
  return slate.map((ev, i) => ({ev, s: score(ev, i)})).sort((a, b) => b.s - a.s).slice(0, n).map(x => x.ev);
}

/* ---- the words around each game ---- */
const DESK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
// when it was played, the way a host says it: "earlier today", "last night", "on Sunday", "on October 2"
function deskDay(date){
  const d = new Date(date), now = new Date(), day = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const ago = Math.round((day(now) - day(d)) / 864e5);
  if (ago <= 0) return 'earlier today';
  if (ago === 1) return d.getHours() >= 17 ? 'last night' : 'yesterday';
  if (ago < 7) return 'on ' + DESK_DAYS[d.getDay()];
  return 'on ' + d.toLocaleDateString('en-US', {month: 'long', day: 'numeric'});
}
const deskDayShort = date => new Date(date).toLocaleDateString('en-US', {weekday: 'short', month: 'numeric', day: 'numeric'});
// the ground and its town, as the feed gives them
function deskWhere(ev){
  const v = ev.competitions[0].venue || {}, city = v.address?.city;
  return v.fullName ? v.fullName + (city && !v.fullName.includes(city) ? ' in ' + city : '') : city || '';
}
const deskCount = n => ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'][n] || String(n);
const DESK_LEADS = ['Our first feature', 'Our next feature', 'And one more feature'];
function deskIntro(ev, k){
  const t = teamsOf(ev), where = deskWhere(ev), neutral = ev.competitions[0].neutralSite;
  const who = neutral ? `the ${fullName(t.away)} and the ${fullName(t.home)} met` : `the ${fullName(t.away)} visited the ${fullName(t.home)}`;
  return `${DESK_LEADS[k] || DESK_LEADS[1]}: ${who} ${deskDay(ev.date)}${where ? ', at ' + where : ''}.`;
}
// what was on the line and how it went, told without the score: a playoff note or the rankings, then the shape of it
function deskStory(ev, sp){
  const t = teamsOf(ev), s = deskShape(ev), note = deskNote(ev), cs = ev.competitions[0].competitors;
  const rk = side => cs.find(c => c.homeAway === side)?.curatedRank?.current || 99, ra = rk('away'), rh = rk('home');
  let set = '';
  if (note) set = `${note.replace(/\.$/, '')}, so there was plenty on the line. `;
  else if (ra <= 25 && rh <= 25) set = `A top 25 meeting: number ${ra} ${t.away.loc} against number ${rh} ${t.home.loc}. `;
  else if (ra <= 25 || rh <= 25) { const r = Math.min(ra, rh), x = ra < rh ? t.away : t.home; set = `Number ${r} ${x.loc} ${x === t.away ? 'on the road' : 'at home'} here. `; }
  const fam = SPORTS[sp].family;
  const tease = s.ot ? (isMLB() ? 'Nine innings was not enough to settle this one.' : 'Regulation was not enough to settle this one.')
    : s.close ? (isMLB() ? 'It came down to the late innings.' : fam === 'football' ? 'This one came down to the last few drives.' : 'This one came down to the final minutes.')
    : s.rout ? 'One side took control of this one early.' : 'There were a few big moments in this one, so let us get right to them.';
  return set + tease;
}
// the screen while a feature is set up: the two teams, when and where, and no score
function deskIntroRows(ev){
  const t = teamsOf(ev), rows = [{c: t.away.color, l: fullName(t.away), r: 'AWAY'}, {c: t.home.color, l: fullName(t.home), r: 'HOME'},
    {l: 'PLAYED', r: deskDayShort(ev.date)}];
  const v = ev.competitions[0].venue?.fullName; if (v) rows.push({l: 'AT', r: v});
  const note = deskNote(ev); if (note) rows.push({l: note});
  return rows;
}
// a game on the list without its score: the matchup and the day, or a tag such as FEATURE or NOW
function deskMatchRow(ev, tag){
  const t = teamsOf(ev);
  return {c: tag === 'NOW' ? '#f2b632' : null, l: `${t.away.abbr} @ ${t.home.abbr}`, r: tag || deskDayShort(ev.date)};
}
function deskQuickIntro(ev){
  const t = teamsOf(ev), v = ev.competitions[0].venue || {}, place = v.address?.city || v.fullName || '';
  if (ev.competitions[0].neutralSite) return `The ${fullName(t.away)} and the ${fullName(t.home)} met ${deskDay(ev.date)}${place ? ' in ' + place : ''}.`;
  const pre = v.address?.city ? 'In ' + v.address.city + ' ' : v.fullName ? 'At ' + v.fullName + ' ' : '';
  const when = pre ? deskDay(ev.date) : deskDay(ev.date).replace(/^./, x => x.toUpperCase());
  return `${pre}${when}, the ${t.home.nick} hosted the ${t.away.nick}.`;
}
// the season records after the game, from the scoreboard: "That puts the Chiefs at 5 and 1 and the Bills at 4 and 2."
function deskRecords(ev){
  const t = teamsOf(ev), cs = ev.competitions[0].competitors;
  const rec = side => { const c = cs.find(x => x.homeAway === side), s = c?.records?.[0]?.summary || c?.record?.[0]?.summary || '';
    const p = s.split('-').filter(x => /^\d+$/.test(x)); return p.length >= 2 ? (p.length > 2 ? p.slice(0, -1).join(', ') + ' and ' + p[p.length - 1] : p.join(' and ')) : ''; };
  const ra = rec('away'), rh = rec('home');
  if (!ra || !rh) return '';
  const a = Number(t.away.score), h = Number(t.home.score), [w, rw, l, rl] = a >= h ? [t.away, ra, t.home, rh] : [t.home, rh, t.away, ra];
  return `That puts the ${w.nick} at ${rw} and the ${l.nick} at ${rl}.`;
}
// "Detroit 24, Green Bay 17": a final as it is read off the board, the winner first
function deskScoreLine(ev){
  const t = teamsOf(ev), a = Number(t.away.score), h = Number(t.home.score);
  const [w, l] = a >= h ? [t.away, t.home] : [t.home, t.away];
  return `${w.loc} ${w.score}, ${l.loc} ${l.score}`;
}

// Formula 1: the race has to load before anyone can say who won it, so the result line comes after the replay opens
async function deskF1(sp, fin, tok){
  const ev = fin[0];
  await deskSay('H', `We go racing. ${deskWho(ev)}.`, tok);
  if (!deskGo(tok)) return;
  SHOW.driving = true;
  try { await selectGame(String(ev.id), 'replay'); } finally { SHOW.driving = false; }
  if (!deskGo(tok)) return;
  deskTabs();
  const R = S.f1r;
  if (!R) { await deskSay('H', 'The timing for that race will not load, so we move on.', tok); return; }
  const win = R.D.get(R.win?.driver_number);
  const clips = deskClips();
  if (win) await deskSay('G', `${win.name} won it for ${win.team}.`, tok);
  for (const c of clips) {
    if (!deskGo(tok)) break;
    SHOW.scene = null;
    await deskSay('H', c.intro, tok);
    await deskClip(c, tok);
  }
  if (!deskGo(tok)) return;
  const rows = (R.order || []).slice(0, 5).map((o, i) => ({c: o.d.color, l: 'P' + (i + 1) + ' ' + o.d.code, r: o.d.team}));
  deskPanel('F1 CLASSIFICATION', rows, 'OpenF1 timing.', win ? `${win.name} wins for ${win.team}` : '');
  await deskSay('H', deskOutro(sp), tok);
  await deskHold(1500, tok);
}

/* ---- highlight clips, cut from the replay the sport's own code built ---- */
// the clips for the game on screen: a feature's two or three moments, or with quick set, the one play that decided it
function deskClips(ev, quick){
  const out = [];
  if (isF1()) {
    const R = S.f1r; if (!R) return out;
    const ev = R.events || [];
    const start = ev.find(e => e.kind === 'start');
    const lead = ev.filter(e => e.kind === 'lead')[0];
    const end = ev.find(e => e.kind === 'win') || ev.filter(e => e.kind === 'fin').pop();
    if (start) out.push({t: start.t - 4000, secs: 24, why: 'the start', intro: 'We start at the lights.'});
    if (lead) out.push({t: lead.t - 10000, secs: 24, why: 'lap ' + lead.lap, intro: `The lead changed hands on lap ${lead.lap}.`});
    if (end) out.push({t: end.t - 16000, secs: 26, why: 'the finish', intro: 'And the run to the flag.'});
    return out;
  }
  const R = S.rp; if (!R || !R.plays?.length) return out;
  const n = R.plays.length, sc = R.scores || [];
  const at = i => deskWhen(playLabel(R.plays[i]));          // "in the first quarter"
  const where = i => at(i).replace(/^in /, '');              // "the first quarter", for the seek caption
  if (quick) {
    const s = deskDecider(sc, ev); if (!s) return out;
    const i0 = R.bb ? Math.max(0, s.i - 2) : Math.max(R.driveOf(s.i), s.i - (R.mlb ? 4 : 2));
    out.push({i0, i1: s.end ?? s.i, why: where(s.i), intro: `The play that decided it: ${s.team.loc}, ${deskKind(s.kind)} ${at(s.i)}.`});
    return out.filter(c => c.i1 >= c.i0);
  }
  if (R.mlb) {
    const hr = sc.filter(s => s.kind === 'HR');
    const picks = (hr.length ? hr : sc).slice(0, 2);
    for (const s of picks) out.push({i0: Math.max(R.driveOf(s.i), s.i - 4), i1: s.i, why: where(s.i),
      intro: `${s.team.loc}, ${deskKind(s.kind)} ${at(s.i)}.`});
  } else if (R.bb) {
    const hits = [];
    R.plays.forEach((p, i) => { const t = (p.text || '').toLowerCase(); if (/(three point|dunk)/.test(t) && /(makes|made)/.test(t)) hits.push(i); });
    const picks = hits.length > 2 ? [hits[Math.floor(hits.length * 0.3)], hits[Math.floor(hits.length * 0.75)]] : hits.slice(0, 2);
    for (const i of picks) out.push({i0: Math.max(0, i - 1), i1: i, why: where(i), intro: `A basket ${at(i)}.`});
    // the finish is the last three real plays, not the end-of-game, timeout and substitution lines after them
    const idle = i => /substitution|enters the game|timeout|end (of )?(the )?(period|quarter|half|game|\d)/.test(((R.plays[i].type?.text || '') + ' ' + (R.plays[i].text || '')).toLowerCase());
    let i1 = n - 1; while (i1 > 0 && idle(i1)) i1--;
    let i0 = i1; for (let k = 0; k < 2 && i0 > 0; ) { i0--; if (!idle(i0)) k++; }
    out.push({i0, i1, why: 'the finish', intro: 'And the finish.'});
  } else {
    const picks = sc.length <= 3 ? sc.slice() : [sc[0], sc[Math.floor(sc.length / 2)], sc[sc.length - 1]];
    // a touchdown's clip runs through the try after it (s.end)
    for (const s of picks) out.push({i0: Math.max(R.driveOf(s.i), s.i - 2), i1: s.end ?? s.i, why: where(s.i),
      intro: `${s.team.loc}, ${deskKind(s.kind)} ${at(s.i)}.`});
  }
  return out.filter(c => c.i1 >= c.i0);
}
// the score that put the winner ahead for good (the last one, in a tie)
function deskDecider(sc, ev){
  const t = teamsOf(ev), homeWon = Number(t.home.score) > Number(t.away.score), tie = Number(t.home.score) === Number(t.away.score);
  let pick = null, ahead = false;
  if (!tie) for (const s of sc) { const up = homeWon ? s.h > s.a : s.a > s.h; if (up && !ahead) pick = s; ahead = up; }
  return pick || sc[sc.length - 1] || null;
}
// plays one clip: the replay seeks to its start, the queue is cut to the clip, and the show waits for it to finish
async function deskClip(c, tok){
  if (!deskGo(tok)) return;
  if (c.t != null) { f1SeekTime(c.t, c.why); await deskHold((c.secs || 22) * 1000, tok); return; }
  if (!S.rp) return;
  seekTo(c.i0, c.why);
  S.queue = S.rp.plays.slice(c.i0, c.i1 + 1);            // seekTo queues the rest of the game; the clip stops at i1
  await deskHold(1000, tok);
  const t0 = Date.now();
  while (deskGo(tok) && Date.now() - t0 < 120000 && (S.queue.length || S.pumping != null || S.anim)) await sleep(200);
  if (deskAlive(tok)) S.queue = [];
  await deskHold(600, tok);
}

/* ---- the commercial break at the end of the loop ----
   Three ads of ten seconds, the same rotation and the same fixed copy as the newsroom's break: two from the ad list
   and the PBC house ad, read by Dot Delgado. Nothing here is written while the page runs. */
const deskTcase = s => String(s).toLowerCase().replace(/\b[a-z]/g, x => x.toUpperCase());
function deskAdWords(ad){
  if (ad.house) return ['Want your business on PBC?', 'Scan the code on the screen to reach me at the sales desk.'];
  const line = ad.line ? ad.line.charAt(0) + ad.line.slice(1).toLowerCase() + '.' : '';
  return ['Brought to you by ' + deskTcase(ad.name) + '.', line + (ad.url ? ' Scan the code on the screen to learn more.' : '')];
}
// an ad with a website (the house ad, or a sold ad that lists one) makes the screen clickable, as in the newsroom's break
function deskAdLink(ad){
  const a = $('deskad'); if (!a) return;
  a.hidden = !(ad && ad.url);
  if (ad && ad.url) { a.href = ad.url; a.rel = ad.house ? 'noopener' : 'noopener sponsored'; a.setAttribute('aria-label', ad.house ? 'Advertise on Pixel Broadcasting' : 'Visit ' + deskTcase(ad.name)); }
}
async function deskBreak(tok){
  const n = ADS.length, c = SHOW.loop;
  const ads = [ADS[(c * 2) % n], ADS[(c * 2 + 1) % n], HOUSE_AD];
  SHOW.brk = true;
  await deskSay('H', 'We will be right back with more from the sports desk.', tok);
  for (let k = 0; k < ads.length && deskGo(tok); k++) {
    SHOW.ad = ads[k]; SHOW.adEnd = Date.now() + DESK_AD_MS * (ads.length - k); SHOW.scene = 'ad';
    deskAdLink(ads[k]);
    const [head, body] = deskAdWords(ads[k]);
    const t0 = Date.now();
    await deskSay('D', (head + ' ' + body).trim(), tok);
    await deskHold(Math.max(0, DESK_AD_MS - (Date.now() - t0)), tok);
  }
  SHOW.brk = false; SHOW.ad = null; deskAdLink(null);
  if (!deskGo(tok)) return;
  deskPanel('PBC SPORTS DESK', [], 'Back to the desk.');
  await deskSay('H', 'Welcome back to the sports desk.', tok);
}

/* ---- coming back: after a live game the desk cut to, or after a replay the viewer picked ---- */
function deskWatch(){
  if (!SHOW.resume || SHOW.on || SHOW.timer) return;
  if (!S.game) { SHOW.resume = false; return; }
  const ev = evOf(S.game);
  if (!ev || stateOf(ev) !== 'post') return;
  SHOW.resume = false;
  SHOW.timer = setTimeout(() => { SHOW.timer = null; deskStart(); }, 60000);
}
// a replay has played out: the desk offers to pick the show back up, once the viewer has seen it run at least once
function deskResume(){
  if (SHOW.on || SHOW.driving || !SHOW.everOn || SHOW.timer || S.mode !== 'replay') return;
  let left = 20;
  const n = $('notice');
  const draw = () => {
    n.replaceChildren();
    const h = document.createElement('h2'); h.textContent = 'BACK TO THE SPORTS DESK';
    const p = document.createElement('p'); p.textContent = `Bo picks the show back up in ${left} second${left === 1 ? '' : 's'}.`;
    const btns = document.createElement('div'); btns.className = 'btns';
    const go = document.createElement('button'); go.className = 'big'; go.textContent = 'GO NOW';
    go.onclick = () => { stop(); hideNotice(); deskStart(); };
    const stay = document.createElement('button'); stay.className = 'big alt'; stay.textContent = 'STAY HERE';
    stay.onclick = () => { stop(); hideNotice(); };
    btns.append(go, stay); n.append(h, p, btns); n.hidden = false;
  };
  const stop = () => { if (SHOW.timer) { clearInterval(SHOW.timer); SHOW.timer = null; } };
  draw();
  SHOW.timer = setInterval(() => {
    left--;
    if (left <= 0) { stop(); hideNotice(); deskStart(); } else draw();
  }, 1000);
}

/* ================= the desk's own screens ================= */
const {pixText: dPix, pixWidth: dWide, qrMatrix: dQR} = PBC_ADS;
// the sign fonts draw capitals, digits, space, & - . and nothing else, so every line is squared up first
const deskTxt = s => String(s == null ? '' : s).toUpperCase().replace(/@/g, 'AT ').replace(/[:/]/g, '.').replace(/[^A-Z0-9 &.-]/g, '');
// head: the screen's heading (and the lower third's red category); title: the lower third's headline, the note when left out
function deskPanel(head, rows, note, title){
  SHOW.head = head; SHOW.rows = rows || []; SHOW.note = note || ''; SHOW.title = title || ''; SHOW.scene = 'panel';
  SHOW.at = performance.now();
}
// a score, an upcoming game or a stat line, as one row of the screen
function deskRow(ev, kind){
  if (isF1()) { const g = f1GameLine(ev); return {l: g.m, r: g.s}; }
  const t = teamsOf(ev), g = gameLine(ev);
  if (kind === 'fin') return {c: (Number(t.away.score) > Number(t.home.score) ? t.away : t.home).color,
    l: `${t.away.abbr} ${t.away.score}  ${t.home.abbr} ${t.home.score}`, r: 'FINAL'};
  if (kind === 'live') return {c: '#e04a4a', l: g.m, r: g.s};
  return {l: g.m, r: g.s};
}
// the teams' stat lines for the game on screen, straight from its box score
function deskStatRows(){
  // the first row names the two teams, so the two columns of numbers are never a guess
  const rows = S.away && S.home ? [{l: '', m: S.away.abbr, r: S.home.abbr, hd: true}] : [];
  if (isMLB()) {
    const bx = S.summary?.liveData?.boxscore?.teams;
    for (const [label, key] of [['HITS', 'hits'], ['RUNS', 'runs'], ['HOME RUNS', 'homeRuns'], ['WALKS', 'baseOnBalls'], ['STRIKEOUTS', 'strikeOuts']]) {
      const a = bx?.away?.teamStats?.batting?.[key], h = bx?.home?.teamStats?.batting?.[key];
      if (a != null && h != null) rows.push({l: label, m: String(a), r: String(h)});
    }
    return rows;
  }
  const keys = isBB() ? [['FIELD GOALS', 'fieldGoalsMade-fieldGoalsAttempted'], ['FIELD GOAL PCT', 'fieldGoalPct'], ['THREES', 'threePointFieldGoalsMade-threePointFieldGoalsAttempted'], ['REBOUNDS', 'totalRebounds'], ['ASSISTS', 'assists'], ['TURNOVERS', 'turnovers']]
    : [['TOTAL YARDS', 'totalYards'], ['PASSING', 'netPassingYards'], ['RUSHING', 'rushingYards'], ['FIRST DOWNS', 'firstDowns'], ['TURNOVERS', 'turnovers']];
  const box = t => (S.summary?.boxscore?.teams || []).find(x => String(x.team?.id) === t?.id);
  const av = box(S.away), hm = box(S.home);
  for (const [label, k] of keys) {
    const a = av?.statistics?.find(x => x.name === k)?.displayValue, h = hm?.statistics?.find(x => x.name === k)?.displayValue;
    if (a != null && h != null) rows.push({l: label, m: String(a), r: String(h)});
  }
  return rows;
}
function deskStatLine(rows){
  const body = rows.filter(r => !r.hd);
  if (!body.length) return 'The box score is in the panel on the right whenever you want it.';
  const r = body[0];
  return `Look at the ${r.l.toLowerCase()}: ${S.away.abbr} ${r.m}, ${S.home.abbr} ${r.r}.`;
}

/* ---- words for the lines Bo and the guests read ---- */
const deskName = n => deskTcase(n);
// how a sport is named in a sentence: "the NFL", but "MLB" and "Formula One"
const deskLg = sp => sp === 'f1' ? 'Formula One' : sp === 'mlb' ? 'MLB' : 'the ' + SPORTS[sp].name;
const deskLgCap = sp => deskLg(sp).charAt(0).toUpperCase() + deskLg(sp).slice(1);
const DESK_ORD = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'];
// "Q1 11:08" -> "in the first quarter"; "T3" -> "in the top of the third"
function deskWhen(label){
  const q = /^Q(\d)/.exec(label || ''); if (q) return `in the ${DESK_ORD[+q[1]] || q[1]} quarter`;
  if (/^OT/.test(label || '')) return 'in overtime';
  const m = /^([TB])(\d+)/.exec(label || '');
  if (m) return `in the ${m[1] === 'T' ? 'top' : 'bottom'} of the ${DESK_ORD[+m[2]] || m[2]}`;
  return 'in this one';
}
const deskKind = k => k === 'TD' ? 'a touchdown' : k === 'FG' ? 'a field goal' : k === 'SAFETY' ? 'a safety'
  : k === 'HR' ? 'a home run' : k === 'LEAD' ? 'taking the lead' : /RUN/.test(k || '') ? k.toLowerCase() : 'a score';
function deskWho(ev){
  if (isF1()) { const g = f1GameLine(ev); return `${g.m}, ${g.s}`; }
  const t = teamsOf(ev);
  return `${fullName(t.away)} at ${fullName(t.home)}`;
}
function deskResult(ev){
  const t = teamsOf(ev), a = Number(t.away.score), h = Number(t.home.score);
  if (!Number.isFinite(a) || !Number.isFinite(h)) return `${deskWho(ev)} is in the books.`;
  if (a === h) return `The ${fullName(t.away)} and the ${fullName(t.home)} finished level, ${a} apiece.`;
  const w = a > h ? t.away : t.home, l = a > h ? t.home : t.away;
  return `The ${fullName(w)} beat the ${fullName(l)}, ${Math.max(a, h)} to ${Math.min(a, h)}.`;
}

/* ---- drawing the screens ----
   While a desk screen is up the broadcast is a studio shot, built from the newsroom's parts (tools/LOOK_BOOK.md, section 6):
   Bo and his guest seated at a PBC anchor desk on the left, the screen with the scores, stats or the ad on the right,
   and the newsroom's on-air graphics over it (corner bug, segment tag, lower third). The booth and scoreboard windows
   only come back for the replays themselves (deskStudio). */
const DESK_SCREEN = {x0: 214, y0: 36, x1: 466, y1: 166};        // the studio's big screen, in broadcast pixels (Baldur's bed is under it)
const DESK_TOP = 150;                                             // the anchor desk's top edge
const DESK_SEATS = [44, 134];                                     // where Bo and the guest sit
// a booth look (drawAnnouncer) in the newsroom's style (person in shared/people.js): same people, same colours
function deskPerson(c){
  return {skin: c.skin, hair: c.hair, coat: c.jacket, shirt: c.shirt || '#f2f0e8', tie: c.tie, glasses: c.glasses,
    style: c.longHair ? 'long' : c.bald ? 'bald' : 'short', stache: c.stache, cap: c.cap, capBrim: c.capBrim, capLogo: c.capLogo,
    earring: c.earring, pants: '#2b2f3a'};
}
// Bo and Dot as the newsroom draws them (CAST.S and CAST.D in index.html)
const DESK_LOOKS = {
  BO: {skin: '#f1c6a0', hair: '#c4582b', style: 'short', coat: '#1f7a52', shirt: '#ffffff', pants: '#2b2f3a'},
  DOT: {skin: '#b97a52', hair: '#1c1418', style: 'bob', coat: '#c2417a', shirt: '#f6eef2', pants: '#2a2230', glasses: true, earring: '#f2b632'}
};
const deskLook = c => DESK_LOOKS[c.tag] || deskPerson(c.look);
function deskRender(now){
  const g = ctx, b = DESK_SCREEN;
  deskSet(g, now);
  if (SHOW.scene === 'ad') deskDrawAd(g, b, now); else deskDrawPanel(g, b, now);
  deskAnchors(g, now);
  deskBaldur(g, now);
}
// the room: the newsroom's back wall, ceiling, lights and floor, and the show's name on the wall behind the desk
function deskSet(g, now){
  const R = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  R('#151b3d', 0, 0, W, 196);
  for (let x = 0; x < W; x += 30) R('#1b2250', x, 12, 1, 170);    // the newsroom's panels: 1/16 of the screen apart
  R('#10153a', 0, 182, W, 14); R('#f2b632', 0, 182, W, 1);
  R('#07091a', 0, 0, W, 12); for (let x = 0; x < W; x += 6) R('#1c2146', x, 4, 3, 3);
  R('#0c1029', 0, 196, W, H - 196);
  for (let y = 200; y < H; y += 8) R('#10153a', 0, y, W, 1);
  const cans = [60, 180, 300, 420];
  g.globalAlpha = 0.045; g.fillStyle = '#fff2c0';
  for (const lx of cans) { g.beginPath(); g.moveTo(lx - 2, 12); g.lineTo(lx + 2, 12); g.lineTo(lx + 50, 182); g.lineTo(lx - 50, 182); g.closePath(); g.fill(); }
  g.globalAlpha = 1;
  for (const lx of cans) { R('#2a2f55', lx - 4, 9, 9, 4); R('#fff2c0', lx - 3, 13, 7, 1); }
  // the show's name on the wall over the anchors
  const t = 'SPORTS DESK', cx = (DESK_SEATS[0] + DESK_SEATS[1] + 42) >> 1, tw = dWide(t, true) * 2, tx = cx - (tw >> 1);
  dPix(g, t, tx + 1, 57, true, '#05060d', 2); dPix(g, t, tx, 56, true, '#f2b632', 2);
  R('#f2b632', tx, 74, tw, 1);
  // the screen hangs on a dark mount
  R('#05071a', ((DESK_SCREEN.x0 + DESK_SCREEN.x1) >> 1) - 12, DESK_SCREEN.y1 + 3, 24, 182 - DESK_SCREEN.y1 - 3);
}
// Bo and the guest (or Dot, in the break) at the anchor desk, with the newsroom's desk in front of them
function deskAnchors(g, now){
  const R = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const cr = crew(), {person, anim} = PBC_PEOPLE, sc = 3;
  [['A', cr.A], ['B', cr.B]].forEach(([seat, c], i) => {
    const talk = S.speaking === seat, st = anim(c.tag, now, talk, 0);
    person(deskLook(c), g, DESK_SEATS[i], DESK_TOP - 20 * sc, sc, Object.assign({seated: true}, st));
  });
  const x0 = 20, x1 = 202, w = x1 - x0;
  R('#e3e7f0', x0 - 4, DESK_TOP, w + 8, 4); R('#b9bfd0', x0 - 4, DESK_TOP + 4, w + 8, 1);
  R('#1d2766', x0, DESK_TOP + 5, w, 42); R('#253282', x0, DESK_TOP + 5, w, 3);
  R('#f2b632', x0, DESK_TOP + 18, w, 2);
  const lg = 'PBC', lw = dWide(lg, true) * 2;
  dPix(g, lg, x0 + ((w - lw) >> 1), DESK_TOP + 24, true, '#ffffff', 2);
  R('#07091a', x0 + 2, DESK_TOP + 47, w - 4, 2);
  // a football on the desk between them
  const fx = ((DESK_SEATS[0] + DESK_SEATS[1] + 42) >> 1) - 6, fy = DESK_TOP - 5;
  R('#7a4423', fx + 2, fy, 8, 1); R('#8b4f2a', fx, fy + 1, 12, 3); R('#7a4423', fx + 2, fy + 4, 8, 1);
  R('#ffffff', fx + 3, fy + 2, 6, 1); R('#ffffff', fx + 4, fy + 1, 1, 1); R('#ffffff', fx + 7, fy + 1, 1, 1);
}
/* ---- Baldur, the kitchen dog, visiting the studio (shared/baldur.js: the same drawing as in the kitchen) ----
   He sleeps in his bed under the big screen. Every few minutes he gets up, turns round and settles again, and now and
   then (about once in twenty minutes) he trots over to the end of the desk for a pat from whoever is in the guest's seat,
   then goes back to bed. Both are set by the clock, not a dice roll, so every viewer sees him do the same thing, and a
   visit that falls during a highlight is skipped: he is only ever up while the studio is on screen. */
const DESK_DOG = {bedX: 232, floor: 194, deskX: 207, nap: 180000, visit: 10 * 60000};   // a visit in about half of each ten minutes
const DESK_VISIT = {wake: 1200, go: 4200, pet: 10200, back: 13200, done: 14400};   // ms into a visit
const deskHash = n => { let h = (n | 0) ^ 0x9e3779b9; h = Math.imul(h ^ (h >>> 16), 0x45d9f3b); h = Math.imul(h ^ (h >>> 16), 0x45d9f3b); return (h ^ (h >>> 16)) >>> 0; };
// what he is doing at wall-clock time t: asleep, a stretch in his bed, or a visit to the desk (with the ms into it)
function deskDogAt(t){
  const v = Math.floor(t / DESK_DOG.visit), vAt = v * DESK_DOG.visit + (deskHash(v) % (DESK_DOG.visit - 60000));
  if (deskHash(v + 7) % 2 === 0 && t >= vAt && t < vAt + DESK_VISIT.done) return {mode: 'visit', el: t - vAt, from: vAt};
  const s = Math.floor(t / DESK_DOG.nap), sAt = s * DESK_DOG.nap + (deskHash(s + 101) % (DESK_DOG.nap - 10000));
  if (t >= sAt && t < sAt + 4000) return {mode: 'stretch', el: t - sAt};
  return {mode: 'sleep'};
}
function deskBaldur(g, now){
  const B = window.PBC_BALDUR; if (!B) return;
  const R = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
  const {bedX, floor, deskX} = DESK_DOG, bedY = floor - B.BED.length + 1, top = floor - 25;
  let st = deskDogAt(Date.now());
  // a visit only plays if the studio was on screen when it began; one that started during a highlight is skipped
  if (st.mode === 'visit') { if (!deskBaldur.seen || deskBaldur.seen < st.from - 500) st = {mode: 'sleep'}; }
  if (st.mode !== 'visit') deskBaldur.seen = Date.now();
  const bed = () => { R(B.DOG.m, bedX + 3, bedY + 7, 50, 3);
    for (let r = 9; r < B.BED.length; r++) for (let c = 0; c < B.BED[r].length; c++) { const ch = B.BED[r][c]; if (ch !== '.') R(B.DOG[/[mnq]/.test(ch) ? ch : 'n'], bedX + c, bedY + r, 1, 1); } };
  if (st.mode === 'sleep') {
    const br = Math.floor(now / 1400) % 2;                       // breathing: his back rises a pixel
    B.sprite(R, B.BED, bedX, bedY, false, 9, B.BED.length);
    B.sprite(R, B.BED, bedX, bedY - br, false, 0, 9);
    if (br) B.sprite(R, B.BED, bedX, bedY, false, 8, 9);
    if (Math.floor(now / 1800) % 3 === 0) dPix(g, 'Z', bedX + 50, bedY - 8 - (Math.floor(now / 600) % 3), false, '#9fb2ff');
    return;
  }
  bed();
  const home = bedX + 12;
  if (st.mode === 'stretch') { B.dog(R, home, top, st.el > 2000, 'stand', now); return; }   // up, a look round, and back down
  const V = DESK_VISIT, e = st.el;
  if (e < V.wake) { B.dog(R, home, top, true, 'stand', now); return; }
  if (e < V.go) { const k = (e - V.wake) / (V.go - V.wake); B.dog(R, home + (deskX - home) * k, top, true, 'walk', now); return; }
  if (e < V.pet) { B.dog(R, deskX, top, true, 'stand', now); deskPat(g, R, now, e - V.go); return; }
  if (e < V.back) { const k = (e - V.pet) / (V.back - V.pet); B.dog(R, deskX + (home - deskX) * k, top, false, 'walk', now); return; }
  B.dog(R, home, top, false, 'stand', now);
}
// the guest leans over the end of the desk and pats his head, and a little heart floats up
function deskPat(g, R, now, el){
  const c = deskLook(crew().B), x0 = DESK_SEATS[1] + 42, y0 = DESK_TOP - 21;     // the guest's right shoulder
  for (let k = 0; k < 11; k++) R(c.coat, x0 + k * 3, y0 + k * 3, 5, 5);          // the arm, reaching down past the desk
  const pat = Math.floor(now / 260) % 2;
  R(c.skin, x0 + 32, y0 + 32 + pat, 4, 4);
  const rise = Math.floor(el / 120) % 18, hx = DESK_DOG.deskX + 6, hy = DESK_DOG.floor - 32 - rise;
  if (el > 1200) [[1, 0, 1], [3, 0, 1], [0, 1, 5], [1, 2, 3], [2, 3, 1]].forEach(([dx, dy, w]) => R('#d8707e', hx + dx, hy + dy, w, 1));
}
// the on-air graphics over the studio (sports/index.html #studio), and the booth and scoreboard windows put away.
// Called every frame; the page only changes when something on it does.
function deskStudio(now){
  const on = !!SHOW.scene;
  if (on !== deskStudio.on) { deskStudio.on = on; $('stage').classList.toggle('studio', on); $('studio').hidden = !on; }
  if (!on) return;
  const set = (id, t) => { const el = $(id); if (el.textContent !== t) el.textContent = t; };
  const cr = crew(), ln = SHOW.line, who = ln && cr[ln.who] ? ln.who : 'A';
  set('dname', cr[who].name);
  set('drole', who === 'A' ? 'SPORTS DESK' : SHOW.brk ? 'HEAD OF SALES' : (SPORTS[S.sport]?.name || '') + (SHOW.guestRole === 'A' ? ' PLAY-BY-PLAY' : ' ANALYST'));
  set('dseg', SHOW.seg === 'break' ? 'COMMERCIAL BREAK' : SHOW.seg && SPORTS[SHOW.seg] ? SPORTS[SHOW.seg].name + ' RECAP' : 'PBC SPORTS DESK');
  const ad = SHOW.scene === 'ad' && SHOW.ad;
  set('dcat', ad ? (ad.house ? 'PBC' : 'SPONSOR') : SHOW.head);
  set('dhead', ad ? (ad.house ? 'Advertise on PBC' : deskTcase(ad.name)) : (SHOW.title || SHOW.note).replace(/\.$/, ''));
  // the line types out as it is read, as the newsroom's summary does
  const text = ln ? ln.text : '', n = DESK_CALM.matches ? text.length : Math.min(text.length, Math.floor((now - (ln?.at || 0)) / 30));
  set('dsum', text.slice(0, n));
  set('dline', text);
}
const DESK_CALM = matchMedia('(prefers-reduced-motion: reduce)');
// say() hands every line here while the show is on, so the lower third can show who is talking and what they said
function deskLine(who, text){ SHOW.line = {who, text, at: performance.now()}; }
function deskDrawPanel(g, b, now){
  const R = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const w = b.x1 - b.x0, h = b.y1 - b.y0;
  R('#05060d', b.x0 - 2, b.y0 - 2, w + 4, h + 4);
  R('#101743', b.x0, b.y0, w, h);
  R('#1f2a66', b.x0, b.y0, w, 13);                                   // heading bar
  dPix(g, deskTxt(SHOW.head), b.x0 + 5, b.y0 + 4, true, '#f2b632');
  const rows = SHOW.rows || [];
  const top = b.y0 + 18, rowH = Math.max(9, Math.min(15, Math.floor((h - 30) / Math.max(1, rows.length))));
  rows.forEach((r, i) => {
    const y = top + i * rowH; if (y + 7 > b.y1 - 10) return;
    R(i % 2 ? '#141c4e' : '#121848', b.x0 + 3, y - 2, w - 6, rowH - 1);
    let x = b.x0 + 6;
    if (r.c) { R(r.c, x, y, 3, 7); x += 7; }
    const col = r.hd ? '#f2b632' : '#f2f0e8', num = r.hd ? '#f2b632' : '#9be15d';
    dPix(g, deskTxt(r.l), x, y, true, col);
    if (r.m != null) { const t = deskTxt(r.m); dPix(g, t, b.x0 + ((w - dWide(t, true)) >> 1), y, true, num); }
    if (r.r != null) { const t = deskTxt(r.r); dPix(g, t, b.x1 - 6 - dWide(t, true), y, true, r.m != null ? num : '#9ba3cc'); }
  });
  if (!rows.length) {
    const t = deskTxt(SHOW.note || ''); const tw = dWide(t, true);
    dPix(g, t, b.x0 + ((w - tw) >> 1), b.y0 + (h >> 1) - 3, true, '#c9c6b4');
    return;
  }
  const n = deskTxt(SHOW.note || '');
  if (n) dPix(g, n, b.x0 + 6, b.y1 - 8, false, '#6f78a8');
}
// the break: the studio's big screen with the ad on it, a QR code where the ad has a website, and the clock back to the desk
function deskDrawAd(g, b, now){
  const R = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const ad = SHOW.ad; if (!ad) return;
  const w = b.x1 - b.x0, h = b.y1 - b.y0;
  R('#05060d', b.x0 - 3, b.y0 - 3, w + 6, h + 6);
  R(ad.bg, b.x0, b.y0, w, h);
  const left = Math.round(Date.now() < SHOW.adEnd ? (SHOW.adEnd - Date.now()) / 1000 : 0);
  const clock = deskTxt(`SPORTS DESK IN 0.${String(left).padStart(2, '0')}`);
  // a website gets the QR code, as on the boards and in the newsroom's break
  let tx = b.x0 + 6, tw = w - 12;
  if (ad.url) {
    if (!deskDrawAd.qr || deskDrawAd.qrFor !== ad.url) { deskDrawAd.qr = dQR(ad.url); deskDrawAd.qrFor = ad.url; }
    const q = deskDrawAd.qr;
    if (q) {
      const m = Math.max(1, Math.floor((h - 20) / (q.length + 8))), qs = (q.length + 8) * m, qx = b.x0 + 6, qy = b.y0 + ((h - qs) >> 1);
      R('#ffffff', qx, qy, qs, qs); g.fillStyle = '#05060d';
      q.forEach((row, y) => row.forEach((d, x) => { if (d) g.fillRect(qx + (x + 4) * m, qy + (y + 4) * m, m, m); }));
      tx = qx + qs + 8; tw = b.x1 - 6 - tx;
    }
  }
  const mid = t => tx + ((tw - t) >> 1);
  const small = (t, y, col) => { t = deskTxt(t); dPix(g, t, mid(dWide(t, false)), y, false, col); };
  const big = (t, y) => {
    t = deskTxt(t);
    let sc = 2; while (sc > 1 && dWide(t, true) * sc > tw) sc--;
    const fits = dWide(t, true) * sc <= tw;
    dPix(g, t, mid(dWide(t, fits) * sc) + 1, y + 1, fits, 'rgba(0,0,0,.45)', sc);
    dPix(g, t, mid(dWide(t, fits) * sc), y, fits, ad.fg, sc);
    return (fits ? 7 : 5) * sc;
  };
  small(ad.house ? 'PIXEL BROADCASTING CO' : 'THIS BREAK BROUGHT TO YOU BY', b.y0 + 8, ad.fg);
  // the brand sits in the middle of the screen, with the slogan under it
  const words = ad.name.split(' '), half = Math.ceil(words.length / 2);
  const names = ad.house ? ['ADVERTISE', 'ON PBC']
    : (dWide(ad.name, true) * 2 <= tw || words.length < 2 ? [ad.name] : [words.slice(0, half).join(' '), words.slice(half).join(' ')]);
  const foot = ad.house ? 'YOUR BRAND ON THIS SCREEN' : (ad.line || '');
  const block = names.length * 18 + (foot ? 9 : 0);
  let y = b.y0 + Math.max(20, ((b.y1 - b.y0) - block) >> 1);
  names.forEach(l => { y += big(l, y) + 4; });
  if (foot) small(foot, y + 2, ad.house ? '#e7e1cc' : ad.fg);
  if (Math.floor(now / 600) % 2 && ad.url) small('SCAN OR CLICK', b.y1 - 20, ad.house ? '#8fd3ff' : ad.fg);
  // along the bottom: the sponsor tag on the left and the clock back to the desk on the right
  dPix(g, ad.house ? 'PBC HOUSE AD' : 'SPONSOR', tx, b.y1 - 10, false, ad.fg);
  dPix(g, clock, b.x1 - 6 - dWide(clock, false), b.y1 - 10, false, ad.fg);
  g.fillStyle = 'rgba(0,0,0,.10)'; for (let r = b.y0 + 1; r < b.y1; r += 2) g.fillRect(b.x0, r, w, 1);
}
