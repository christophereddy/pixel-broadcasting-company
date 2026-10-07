/* Live games on PBC Sports, for the newsroom's cross-promotion: Bo's "X vs Y is live right now on PBC Sports" and the
   LIVE NOW chip in the corner of the news broadcast, which opens the sports page on that game.
   It reads the same feeds the sports page does, one per sport (ESPN for football and basketball, MLB's own Stats API for
   baseball), every couple of minutes while the page is on screen. F1 isn't here: the sports page only replays races.
   PBC_LIVE.watch(onChange)  Starts watching. onChange(game) runs when the promoted game changes; game is null when
                             nothing is live, else {sport, league, id, away, home, title, href}.
   PBC_LIVE.current          The promoted game, or null.
   PBC_LIVE.pickLive(lists)  Picks the game to promote from {sport: [games]} (exposed for tests). */
window.PBC_LIVE = (function(){
  "use strict";
  const ESPN = "https://site.api.espn.com/apis/site/v2/sports/";
  // in the order a game is promoted when several are live; college football is ESPN's Top 25 scoreboard, so only
  // games with a ranked team are promoted
  const FEEDS = [
    {sport: "nfl", league: "NFL", url: () => ESPN + "football/nfl/scoreboard", read: espn},
    {sport: "mlb", league: "MLB", url: mlbURL, read: mlb},
    {sport: "nba", league: "NBA", url: () => ESPN + "basketball/nba/scoreboard", read: espn},
    {sport: "wnba", league: "WNBA", url: () => ESPN + "basketball/wnba/scoreboard", read: espn},
    {sport: "cfb", league: "NCAAF", url: () => ESPN + "football/college-football/scoreboard", read: espn}
  ];
  const EVERY = 2 * 60000, STALE = 7 * 60000;
  const seen = {}; // sport -> {at, games}
  let current = null, onChange = () => {}, lastPoll = 0, timer = 0;

  // MLB's schedule by date; yesterday is included so a game that runs past midnight stays on the list
  function mlbURL(){
    const d = t => new Date(t).toLocaleDateString("en-CA", {timeZone: "America/New_York"});
    return "https://statsapi.mlb.com/api/v1/schedule?sportId=1&hydrate=team&startDate=" + d(Date.now() - 864e5) + "&endDate=" + d(Date.now());
  }
  const nick = t => String(t && (t.shortDisplayName || t.name || t.abbreviation) || "").trim();
  function espn(j){
    const out = [];
    for (const ev of (j && j.events) || []) {
      const c = ev.competitions && ev.competitions[0] || {}, st = (ev.status || c.status || {}).type || {};
      if (st.state !== "in") continue;
      const side = ha => (c.competitors || []).find(x => x.homeAway === ha) || {};
      const a = side("away"), h = side("home"), rank = x => (x.curatedRank && x.curatedRank.current) || 99;
      if (!nick(a.team) || !nick(h.team)) continue;
      out.push({id: String(ev.id), away: nick(a.team), home: nick(h.team), rank: Math.min(rank(a), rank(h))});
    }
    return out;
  }
  function mlb(j){
    const out = [];
    for (const day of (j && j.dates) || []) for (const g of day.games || []) {
      if (!g.status || g.status.abstractGameState !== "Live") continue;
      const t = ha => { const x = g.teams && g.teams[ha] && g.teams[ha].team || {}; return x.teamName || x.clubName || x.name || ""; };
      if (!t("away") || !t("home")) continue;
      out.push({id: String(g.gamePk), away: t("away"), home: t("home"), rank: 99});
    }
    return out;
  }

  // the game to promote: the one already promoted while it stays live, else the first league in FEEDS with a live game
  // (in college football, the game with the highest-ranked team)
  function pickLive(lists, keep){
    if (keep && (lists[keep.sport] || []).some(g => g.id === keep.id)) return keep;
    for (const f of FEEDS) {
      const gs = (lists[f.sport] || []).slice().sort((x, y) => (f.sport === "cfb" ? x.rank - y.rank : 0));
      if (gs.length) return shape(f, gs[0]);
    }
    return null;
  }
  function shape(f, g){
    return {sport: f.sport, league: f.league, id: g.id, away: g.away, home: g.home, title: g.away + " vs " + g.home,
      href: (window.PBC && PBC.root || "") + "sports/#" + f.sport + "/" + encodeURIComponent(g.id)};
  }

  async function getJSON(url){
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 12000);
    try { const r = await fetch(url, {signal: ctl.signal, cache: "no-store"}); if (!r.ok) throw new Error("HTTP " + r.status); return await r.json(); }
    finally { clearTimeout(t); }
  }
  async function poll(){
    lastPoll = Date.now();
    await Promise.all(FEEDS.map(async f => {
      try { seen[f.sport] = {at: Date.now(), games: f.read(await getJSON(f.url()))}; } catch (e) {}
    }));
    // a feed that stopped answering a while ago no longer counts its games as live
    const lists = {};
    for (const f of FEEDS) { const s = seen[f.sport]; if (s && Date.now() - s.at < STALE) lists[f.sport] = s.games; }
    const next = pickLive(lists, current);
    if ((next && next.sport + next.id) !== (current && current.sport + current.id)) { current = next; onChange(current); }
  }
  function watch(cb){
    onChange = cb || onChange;
    clearInterval(timer);
    poll();
    timer = setInterval(() => { if (!document.hidden) poll(); }, EVERY);
    document.addEventListener("visibilitychange", () => { if (!document.hidden && Date.now() - lastPoll > EVERY) poll(); });
  }
  return {watch, pickLive, get current(){ return current; }};
})();
