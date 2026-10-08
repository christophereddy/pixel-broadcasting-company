/* Pixel Broadcasting Company: the Sports Desk.
   The channel's entry point. Bo Kowalski hosts a loop that works its way through every sport: the recent finals,
   highlights cut from the real play-by-play, the team stats, then the next sport, and a commercial break at the end
   of the loop. A live game always wins: when one is on, the desk hands the broadcast straight over to it.

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
// which booth seat a line comes from: Bo hosts from the left, the guest (or Dot) answers from the right.
// A play-by-play line ('A') is the guest reading the play; the colour line ('B') is left out, so clips stay tight.
const deskSlot = who => who === 'H' ? 'A' : who === 'D' ? 'B' : who === 'A' ? 'B' : null;
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
const DESK_EST_SPORT = 180000;
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

/* ---- one sport's slot ---- */
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
  deskPanel(name + ' SCOREBOARD', fin.slice(0, 5).map(ev => deskRow(ev, 'fin')), 'Scores from ' + SPORTS[sp].src + '.', sp === 'f1' ? '' : deskResult(fin[0]));
  await deskSay('H', `${SHOW.loop ? 'Still with you at' : 'Welcome to'} the PBC sports desk. I am Bo Kowalski, and ${deskName(guest.name)} is alongside me for ${deskLg(sp)}.`, tok);
  if (!deskGo(tok)) return;
  if (sp === 'f1') return deskF1(sp, fin, tok);

  const ev = fin[0];
  await deskSay(SHOW.guestRole, deskResult(ev), tok);
  if (!deskGo(tok)) return;
  await deskSay('H', 'Let us look at how it happened.', tok);
  if (!deskGo(tok)) return;
  SHOW.driving = true;
  try { await selectGame(String(ev.id), 'replay'); } finally { SHOW.driving = false; }
  if (!deskGo(tok)) return;
  deskTabs();
  const clips = deskClips();
  if (!clips.length) await deskSay('H', 'The play-by-play has no highlight to cut to, so here is the top of the game.', tok);
  for (const c of clips) {
    if (!deskGo(tok)) break;
    SHOW.scene = null;                                   // back to the field for the clip itself
    await deskSay('H', c.intro, tok);
    await deskClip(c, tok);
  }
  if (!deskGo(tok)) return;
  const rows = deskStatRows();
  deskPanel(name + ' TEAM STATS', rows, S.away && S.home ? `${S.away.abbr} at ${S.home.abbr} · ${SPORTS[sp].src}` : SPORTS[sp].src,
    S.away && S.home ? `${fullName(S.away)} at ${fullName(S.home)}, by the numbers` : '');
  await deskSay(SHOW.guestRole, deskStatLine(rows), tok);
  if (!deskGo(tok)) return;
  await deskSay('H', deskOutro(sp), tok);
  await deskHold(1200, tok);
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
  if (win) await deskSay(SHOW.guestRole, `${win.name} won it for ${win.team}.`, tok);
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
function deskClips(){
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
    out.push({i0: Math.max(0, n - 3), i1: n - 1, why: 'the finish', intro: 'And the finish.'});
  } else {
    const picks = sc.length <= 3 ? sc.slice() : [sc[0], sc[Math.floor(sc.length / 2)], sc[sc.length - 1]];
    for (const s of picks) out.push({i0: Math.max(R.driveOf(s.i), s.i - 2), i1: s.i, why: where(s.i),
      intro: `${s.team.loc}, ${deskKind(s.kind)} ${at(s.i)}.`});
  }
  return out.filter(c => c.i1 >= c.i0);
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
const DESK_SCREEN = {x0: 214, y0: 36, x1: 466, y1: 176};        // the studio's big screen, in broadcast pixels
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
