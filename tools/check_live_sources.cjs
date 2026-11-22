// Daily check of the live data the site reads, so the next change at ESPN, MLB or OpenF1 (or a news source that stops
// answering) is caught within a day instead of found by a viewer.
//   node tools/check_live_sources.cjs [--report FILE] [--feeds FILE]
// Run by .github/workflows/live-sources.yml every morning; that workflow opens (or updates) one GitHub issue,
// "Live data check failed", when something here fails, and closes it when everything passes again.
// Plain Node 20, no packages. It calls every kind of address the pages fetch, the same way they build it:
//   - ESPN (NFL, NCAAF, NBA, WNBA): the scoreboard, football by week, basketball one day at a time, a game summary,
//     a team's roster, schedule, news and stats, the core API's team details and the NFL depth chart, a player
//     overview, and the college conference standings
//   - MLB Stats API: the schedule (sports page and the newsroom's LIVE NOW), teams, a roster, team stats, a player,
//     a game's live feed and its recap
//   - OpenF1: the season's sessions, drivers and results, and a finished race's drivers, laps, positions, pit stops,
//     race control, results and car location
//   - the news: the hourly fetch's index on the feeds branch (every approved source answered and gave us something)
//     and the newsroom's published data/feed.json (how old the last refresh is)
// Each browser address must answer 200 with the fields the page reads, and must send CORS headers for
// https://christophereddy.github.io: a feed without them works in a local test and fails on the live site
// (that is how the NFL depth chart broke, fixed in PR #69).
// A FAIL means the site is losing data now. A "warn" is a known gap worth seeing (a quiet local desk, a late fetch)
// and does not fail the check. Exit code 1 means at least one FAIL.
'use strict';
const fs = require('node:fs');

const ORIGIN = 'https://christophereddy.github.io';
const SITE = ORIGIN + '/pixel-broadcasting-company';
const FEEDS = 'https://raw.githubusercontent.com/christophereddy/pixel-broadcasting-company/feeds/index.json';
const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/';
const ESPN_WEB = 'https://site.web.api.espn.com/apis/common/v3/sports/';
const CORE = 'https://sports.core.api.espn.com/v2/sports/';
const MLB = 'https://statsapi.mlb.com/api';
const F1 = 'https://api.openf1.org/v1';
// the ESPN leagues, as sports/index.html's SPORTS has them. team: a team to fall back on when no game names one
// (the first team in the page's built-in list)
const LEAGUES = [
  {sport: 'nfl', name: 'NFL', path: 'football/nfl', family: 'football', team: 22, depth: true},
  {sport: 'cfb', name: 'NCAAF', path: 'football/college-football', family: 'football', team: 333, board: 'groups=80&limit=500'},
  {sport: 'nba', name: 'NBA', path: 'basketball/nba', family: 'basketball', team: 1},
  {sport: 'wnba', name: 'WNBA', path: 'basketball/wnba', family: 'basketball', team: 20}
];
const CFB_STANDINGS = 'https://site.web.api.espn.com/apis/v2/sports/football/college-football/standings';

const args = process.argv.slice(2), opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const results = []; // {group, name, level: 'ok'|'warn'|'FAIL', url, note}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ymd = d => d.toISOString().slice(0, 10).replace(/-/g, '');
const iso = d => d.toISOString().slice(0, 10);
const now = new Date(), Y = now.getUTCFullYear(), M = now.getUTCMonth();
// the season each league's team pages ask for (sports/index.html seasonYear)
const season = sport => sport === 'mlb' ? Y : sport === 'nba' ? (M >= 9 ? Y + 1 : Y) : sport === 'wnba' ? (M < 3 ? Y - 1 : Y) : (M > 4 ? Y : Y - 1);

function record(group, name, level, url, note){
  results.push({group, name, level, url, note: note || ''});
  console.log(`${level.padEnd(5)} ${group.padEnd(6)} ${name}${note ? ' · ' + note : ''}${level === 'ok' ? '' : '\n      ' + url}`);
}

// one GET, as a page on github.io makes it. A network error, timeout or 5xx is tried once more; a 429 waits first.
// Gives {status, json, cors} or {error}.
let lastAt = {};
async function get(url, {cors = true, gap = 250} = {}){
  const host = new URL(url).host;
  for (let k = 0; ; k++) {
    const wait = (lastAt[host] || 0) + gap - Date.now(); if (wait > 0) await sleep(wait);
    lastAt[host] = Date.now();
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 20000);
    try {
      const r = await fetch(url, {signal: ctl.signal, headers: cors ? {Origin: ORIGIN, Accept: 'application/json'} : {Accept: 'application/json'}});
      const text = await r.text();
      if (!k && (r.status >= 500 || r.status === 429)) { await sleep(r.status === 429 ? 3000 : 2000); continue; }
      const acao = r.headers.get('access-control-allow-origin');
      let json = null; try { json = JSON.parse(text); } catch (e) {}
      return {status: r.status, json, cors: acao === '*' || acao === ORIGIN, acao};
    } catch (e) {
      if (!k) { await sleep(2000); continue; }
      return {error: e.name === 'AbortError' ? 'timed out after 20 s' : String(e.cause?.code || e.message || e)};
    } finally { clearTimeout(t); }
  }
}

// fetches url and records one line. need(json) gives '' when the fields the page reads are there, else what is missing.
// Gives the json (or null), so later checks can pick ids from it.
async function check(group, name, url, need, {cors = true, gap, warnOnly = false} = {}){
  const r = await get(url, {cors, gap});
  const bad = note => { record(group, name, warnOnly ? 'warn' : 'FAIL', url, note); return null; };
  if (r.error) return bad(r.error);
  if (r.status !== 200) return bad('HTTP ' + r.status);
  if (cors && !r.cors) return bad(`no CORS header for ${ORIGIN} (Access-Control-Allow-Origin: ${r.acao || 'none'}), so it fails on the live site`);
  if (r.json == null) return bad('not JSON');
  let miss = ''; try { miss = need ? need(r.json) || '' : ''; } catch (e) { miss = 'unexpected shape: ' + e.message; }
  if (miss) return bad(miss);
  record(group, name, 'ok', url);
  return r.json;
}
const has = (cond, what) => cond ? '' : what;
const arr = (v, what) => has(Array.isArray(v), `no ${what} list`);
const nonEmpty = (v, what) => has(Array.isArray(v) && v.length > 0, `${what} list is empty`);

/* ---------------- ESPN ---------------- */
const espnEvents = j => j && Array.isArray(j.events) ? j.events : [];
const teamIds = ev => (ev.competitions?.[0]?.competitors || []).map(c => c.team?.id || c.id).filter(Boolean);
const isFinal = ev => (ev.status || ev.competitions?.[0]?.status)?.type?.state === 'post' || ev.competitions?.[0]?.status?.type?.completed;

async function espnLeague(L){
  const g = L.name, api = ESPN + L.path, q = L.board ? '?' + L.board : '';
  const board = await check(g, 'scoreboard', api + '/scoreboard' + q, j => arr(j.events, 'events'));
  const events = [...espnEvents(board)];
  if (L.family === 'football') {
    // football goes by week: the week after this one (sports/index.html loadScoreboard)
    const wk = board?.week?.number, ty = board?.season?.type, yr = board?.season?.year;
    if (wk && ty && yr) {
      const next = await check(g, 'scoreboard by week', `${api}/scoreboard?dates=${yr}&seasontype=${ty}&week=${wk + 1}${L.board ? '&' + L.board : ''}`, j => arr(j.events, 'events'));
      events.push(...espnEvents(next));
    } else if (board) record(g, 'scoreboard by week', 'FAIL', api + '/scoreboard' + q, 'the scoreboard no longer says which week and season it is, so the next and last weeks cannot be asked for');
  } else {
    // basketball one day at a time: tomorrow and yesterday (ranges of days answer 400 since November 2026)
    for (const [name, off] of [['scoreboard, one day ahead', 1], ['scoreboard, one day back', -1]]) {
      const d = await check(g, name, `${api}/scoreboard?dates=${ymd(new Date(now.getTime() + off * 864e5))}`, j => arr(j.events, 'events'));
      events.push(...espnEvents(d));
    }
  }
  // a team: one from a game, or the page's first built-in team
  const teamId = events.map(teamIds).flat()[0] || L.team, yr = season(L.sport);
  const sched = await check(g, 'team schedule', `${api}/teams/${teamId}/schedule?season=${yr}&seasontype=2`, j => arr(j.events, 'events'));
  const roster = await check(g, 'team roster', `${api}/teams/${teamId}/roster`, j => has(Array.isArray(j.athletes) && j.athletes.length, 'no athletes'));
  await check(g, 'team news', `${api}/news?team=${teamId}&limit=8`, j => arr(j.articles, 'articles'));
  await check(g, 'team stats', `${api}/teams/${teamId}/statistics`, j => has(j.results || j.splits || j.team, 'no results'));
  await check(g, 'team details (core)', `${CORE}${L.path.replace('/', '/leagues/')}/teams/${teamId}`, j => has(j.id && (j.color || j.displayName), 'no id or color'));
  if (L.depth) await check(g, 'depth chart (core)', `${CORE}${L.path.replace('/', '/leagues/')}/seasons/${yr}/teams/${teamId}/depthcharts`,
    j => { const c = j.items || j.depthchart || j.depthCharts; return nonEmpty(c, 'depth chart') || has(c.some(f => f.positions && Object.keys(f.positions).length), 'no positions'); });
  // a finished game's summary (the replay and the box score); from the scoreboards, else the team's own schedule
  const fin = events.find(isFinal) || [...espnEvents(sched)].reverse().find(isFinal) || events[0];
  if (fin) await check(g, 'game summary', `${api}/summary?event=${fin.id}`,
    j => has(j.header?.competitions?.length, 'no header') || has(j.boxscore, 'no box score') || (L.family === 'basketball' && isFinal(fin) ? nonEmpty(j.plays, 'plays') : L.family === 'football' && isFinal(fin) ? has(j.drives || j.plays, 'no drives') : ''));
  else record(g, 'game summary', 'warn', api + '/summary', 'no game found to ask for');
  // a player's card
  const ath = roster && (roster.athletes[0]?.items ? roster.athletes[0].items[0] : roster.athletes[0]);
  if (ath?.id) await check(g, 'player overview', `${ESPN_WEB}${L.path}/athletes/${ath.id}/overview`, j => has(typeof j === 'object' && Object.keys(j).length, 'empty'));
  if (L.sport === 'cfb') await check(g, 'conference standings', `${CFB_STANDINGS}?region=us&lang=en&contentorigin=espn&group=80&season=${yr}&type=0&level=3`, j => nonEmpty(j.children, 'conference'));
}

/* ---------------- MLB ---------------- */
async function mlb(){
  const g = 'MLB', yr = season('mlb');
  const d = t => new Date(t).toLocaleDateString('en-CA', {timeZone: 'America/New_York'});
  // the newsroom's LIVE NOW (shared/live.js) and the sports page's games list
  await check(g, 'schedule (LIVE NOW)', `${MLB}/v1/schedule?sportId=1&hydrate=team&startDate=${d(Date.now() - 864e5)}&endDate=${d(Date.now())}`, j => arr(j.dates, 'dates'));
  await check(g, 'schedule (games list)', `${MLB}/v1/schedule?sportId=1&startDate=${iso(new Date(now.getTime() - 8 * 864e5))}&endDate=${iso(new Date(now.getTime() + 10 * 864e5))}&hydrate=team,linescore`, j => arr(j.dates, 'dates'));
  const teams = await check(g, 'teams', `${MLB}/v1/teams?sportId=1&season=${yr}`, j => nonEmpty(j.teams, 'teams'));
  const team = teams?.teams?.find(t => t.active !== false)?.id || 147;
  const sched = await check(g, 'team schedule', `${MLB}/v1/schedule?sportId=1&teamId=${team}&startDate=${yr}-02-01&endDate=${yr}-11-30&hydrate=team,linescore`, j => nonEmpty(j.dates, 'dates'));
  await check(g, 'team stats', `${MLB}/v1/teams/${team}/stats?stats=season&group=hitting,pitching&season=${yr}`, j => nonEmpty(j.stats, 'stats'));
  const roster = await check(g, 'team roster', `${MLB}/v1/teams/${team}/roster?rosterType=active&hydrate=person`, j => arr(j.roster, 'roster'));
  // in the offseason the active roster is empty; the 40-man roster still names a player for the player card
  let pid = roster?.roster?.[0]?.person?.id;
  if (!pid) pid = (await check(g, 'team roster (40-man)', `${MLB}/v1/teams/${team}/roster?rosterType=40Man`, j => nonEmpty(j.roster, 'roster')))?.roster?.[0]?.person?.id;
  if (pid) await check(g, 'player', `${MLB}/v1/people/${pid}?hydrate=stats(group=[hitting,pitching],type=[season,career])`, j => nonEmpty(j.people, 'people'));
  const games = (sched?.dates || []).flatMap(x => x.games || []).filter(x => x.status?.abstractGameState === 'Final');
  const last = games[games.length - 1];
  if (last) {
    await check(g, 'game live feed', `${MLB}/v1.1/game/${last.gamePk}/feed/live`, j => has(j.gameData, 'no gameData') || nonEmpty(j.liveData?.plays?.allPlays, 'plays'));
    await check(g, 'game recap', `${MLB}/v1/game/${last.gamePk}/content`, j => has(j.editorial || j.highlights, 'no editorial or highlights'));
  } else record(g, 'game live feed', 'warn', `${MLB}/v1.1/game/…/feed/live`, 'no finished game found to ask for');
}

/* ---------------- OpenF1 ---------------- */
async function f1(){
  const g = 'F1', o = {gap: 600}; // the free tier allows a few requests a second; the page spaces them out too
  let list = await check(g, 'sessions this season', `${F1}/sessions?year=${Y}`, j => arr(j, 'sessions'), o) || [];
  if (!list.filter(s => s.session_type === 'Race').length) list = (await check(g, 'sessions last season', `${F1}/sessions?year=${Y - 1}`, j => nonEmpty(j, 'sessions'), o) || []).concat(list);
  // the latest race whose free data is out (about half an hour after it ends)
  const races = list.filter(s => s.session_type === 'Race' && Date.parse(s.date_end) + 30 * 60e3 < Date.now()).sort((a, b) => Date.parse(a.date_start) - Date.parse(b.date_start));
  const race = races[races.length - 1];
  if (!race) return record(g, 'a finished race', 'FAIL', `${F1}/sessions?year=${Y}`, 'no finished race in this season or the last');
  const k = race.session_key, minKey = races[0].session_key, name = `${race.country_name || race.location || ''} ${race.year || ''}`.trim();
  await check(g, 'season drivers', `${F1}/drivers?session_key>=${minKey}`, j => nonEmpty(j, 'drivers'), o);
  await check(g, 'season results', `${F1}/session_result?session_key>=${minKey}`, j => nonEmpty(j, 'results'), o);
  const need = {drivers: 'name_acronym', laps: 'lap_number', position: 'position', pit: 'lap_number', race_control: 'message', session_result: 'position'};
  let laps = null;
  for (const [p, key] of Object.entries(need)) {
    const j = await check(g, `race ${p.replace('_', ' ')} (${name})`, `${F1}/${p}?session_key=${k}`, v => nonEmpty(v, p) || has(v.some(x => key in x), `no ${key}`), o);
    if (p === 'laps') laps = j;
  }
  // the onboard camera: one car's location over one lap
  const lap = laps?.find(l => l.lap_number === 2 && l.date_start && l.lap_duration);
  if (lap) {
    const t0 = new Date(Date.parse(lap.date_start)), t1 = new Date(t0.getTime() + lap.lap_duration * 1000);
    await check(g, `race car location (${name})`, `${F1}/location?session_key=${k}&driver_number=${lap.driver_number}&date>=${t0.toISOString()}&date<=${t1.toISOString()}`, j => nonEmpty(j, 'location'), o);
  } else if (laps) record(g, 'race car location', 'warn', `${F1}/laps?session_key=${k}`, 'no timed lap 2 to ask for');
}

/* ---------------- news ---------------- */
async function news(){
  const g = 'News';
  // the hourly fetch's index (feeds branch). Not fetched by a browser, so no CORS check.
  let idx = null;
  const file = opt('--feeds');
  if (file) { try { idx = JSON.parse(fs.readFileSync(file, 'utf8')); record(g, 'feeds index', 'ok', file); } catch (e) { record(g, 'feeds index', 'FAIL', file, e.message); } }
  else idx = await check(g, 'feeds index', FEEDS, j => arr(j.ok, 'ok') || arr(j.failed, 'failed'), {cors: false});
  if (idx) {
    const age = (Date.now() - Date.parse(idx.fetchedAt)) / 36e5;
    if (!(age < 4)) record(g, 'hourly fetch is recent', 'warn', FEEDS, isFinite(age) ? `last fetch ${age.toFixed(1)} hours ago` : 'no fetchedAt');
    else record(g, 'hourly fetch is recent', 'ok', FEEDS, `${age.toFixed(1)} h ago`);
    for (const f of idx.failed || []) record(g, `source ${f.id}`, 'FAIL', f.url || FEEDS, f.error || 'failed');
    for (const s of idx.ok || []) {
      if (/^weather:/.test(s.id)) continue;
      const got = (s.items || 0) + (s.articles || 0);
      // a local desk with headlines but no article text (or the other way) is a known gap (fix plan PR 7), so a warning;
      // a source that gave nothing at all is a FAIL
      if (!got) record(g, `source ${s.id}`, 'FAIL', s.url, 'answered, but no headlines and no articles');
      else if (/^local:/.test(s.id) && !s.articles) record(g, `source ${s.id}`, 'warn', s.url, `${s.items} headlines, no article text`);
      else record(g, `source ${s.id}`, 'ok', s.url);
    }
  }
  // the newsroom's published desks: how old the last 3-hour refresh is
  const feed = await check(g, 'published news', SITE + '/data/feed.json', j => has(j.updatedAt, 'no updatedAt') || nonEmpty(j.world, 'world desk'), {cors: false});
  if (feed) {
    const age = (Date.now() - Date.parse(feed.updatedAt)) / 36e5;
    record(g, 'last news refresh', age < 6 ? 'ok' : 'warn', SITE + '/data/feed.json', `${age.toFixed(1)} hours ago`);
  }
}

/* ---------------- run ---------------- */
(async () => {
  const parts = [...LEAGUES.map(L => [L.name, () => espnLeague(L)]), ['MLB', mlb], ['F1', f1], ['News', news]];
  // one part's surprise (a thrown error) is a FAIL for that part, and the rest still run
  for (const [g, p] of parts) { try { await p(); } catch (e) { record(g, 'the check itself', 'FAIL', '', 'broke: ' + e.message); } }
  const fails = results.filter(r => r.level === 'FAIL'), warns = results.filter(r => r.level === 'warn');
  console.log(`\nLive data check: ${results.length - fails.length - warns.length} ok, ${warns.length} warning${warns.length === 1 ? '' : 's'}, ${fails.length} failed.`);
  const report = opt('--report');
  if (report) {
    const row = r => `| ${r.group} | ${r.name} | ${r.note.replace(/\|/g, '\\|')} | ${r.url ? '`' + r.url.replace(/\|/g, '%7C') + '`' : ''} |`;
    const table = rs => ['| Feed | What | Problem | Address |', '| --- | --- | --- | --- |', ...rs.map(row)].join('\n');
    const lines = [`Checked ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC: ${results.length - fails.length - warns.length} ok, ${warns.length} warnings, ${fails.length} failed.`, ''];
    if (fails.length) lines.push('### Failed', '', table(fails), '');
    if (warns.length) lines.push('### Warnings (known gaps, not failing the check)', '', table(warns), '');
    lines.push(`<!-- failed: ${fails.map(r => r.group + '/' + r.name).sort().join(', ')} -->`);
    fs.writeFileSync(report, lines.join('\n') + '\n');
  }
  process.exit(fails.length ? 1 : 0);
})();
