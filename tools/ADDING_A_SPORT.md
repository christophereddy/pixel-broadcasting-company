# Adding a sport to Pixel Sports Live

NFL, college football (NCAAF), NBA, WNBA and MLB are built the same way, and every new sport (NHL, MLS...) has to match them. A viewer who switches tabs should see the same page with the same controls in the same places. Only the field, the players and the data change.

This list is the contract. `tools/check_sports.cjs` checks the parts it can see on screen. The rest is for whoever builds the sport, and for the person reviewing the pull request.

## Rules that never change

- **One data source per sport.** All of a sport's games, plays, teams, rosters, stats, logos and news come from one provider. Its hosts are listed in `SPORTS.<sport>.hosts`, and the check fails if the page fetches from anywhere else. Don't add a second provider as a fallback, and don't mix two feeds for the same game. Small fixed facts that a feed lacks (like ballpark wall heights) can be built into the page, and they are credited in the footer.
- **Same page for every sport.** The broadcast, booth, scoreboard, live feed, This Game panel, Live Now, Up Next, team boxes and footer sit in the same place. Change shared layout in `shared/` or in the common CSS, never for one sport only.
- **Plays come from data.** Announcers can add color, but every play they describe must come from the feed. Never invent a play, score or stat.
- **No crowd noise.** Sound stays as game blips and announcer voices.

## The checklist

In `sports/index.html`:

1. **`SPORTS` entry.** Fill in `name`, `family` (football, baseball, basketball...), `api`, `src` (the live feed label, e.g. "ESPN play-by-play"), `hosts` (every host the sport fetches from) and `credits` (rows of [what, source name, link] for the footer).
2. **Tab.** Turn the sport's "soon" tab into `<button class="tab" aria-pressed="false" id="sport-<key>">`, and give it a `SPORTS` entry with the same key (the click handler comes from `SPORTS`). A sport that plays like one already on the page shares its code through `family`, the way the NBA and WNBA share the basketball code (`isBB()`).
3. **Booth.** Add a `CAST.<key>` entry with two announcers of the sport's own, play-by-play (A) and color (B). Booths are never shared between sports.
4. **Games list.** `loadScoreboard()` fills `S.events` with games shaped like ESPN events (`id`, `date`, `status.type.state` of pre/in/post, and `competitions[0].competitors` with home/away teams and scores). See `loadMLBGames()` and `mlbEvent()` for a source that isn't ESPN.
5. **Teams.** `loadTeams()` lists every team as `teamObj(...)` objects with colors and a logo, plus a built-in fallback list in case the provider's team list doesn't load (like `NFL_TEAMS` and `NBA_TEAMS`, listed in `FALLBACK_TEAMS`). `logoURL()` returns a logo made for dark backgrounds.
6. **Team page.** `loadTeamData()` fills the season's games (next game, live game, replays), season stats, and news from the same provider. `loadRoster()` returns players with number, name, position and group.
7. **Player card.** `headshotURL()`, `loadSeason()` (season and career stats) and `gameStatsFor()` (this game's line).
8. **Play-by-play.** `gameURL()` and `playsOf()` turn the provider's feed into an ordered list of plays. Each play needs a stable `id` so live polling never repeats one.
9. **Animation.** The field drawing (`buildField()`), player sprites and kits, the formation and how a play moves (`restFormation()`, `runPlay()`), and the scoreboard state (`applyState()`). Players walk on and off from their bench, like the MLB dugouts and the basketball benches.
10. **Commentary.** Lines for each kind of play, read by the sport's own booth.
11. **Replays.** `buildReplay()` and the timeline: periods along the bar, scoring marks, and skip buttons by the sport's natural unit (drive, inning, period).
12. **Footer and labels.** `setCredits()` picks the credits up automatically. Check that the live feed label and footer read right.

In `sports/show.js` (the Sports Desk, the channel's entry point):

13. **Desk slot.** Add the sport's key to `DESK_ORDER` so Bo's loop reaches it, and check `deskClips()` picks sensible highlights for it (the scoring plays its `buildReplay()` marks) and `deskStatRows()` names a few of its box-score keys. The guest in the booth is the sport's own `CAST` pair, so nothing else is needed.

## Before opening the pull request

Run both checks. In a Claude cloud session, put `NODE_PATH=$(npm root -g)` in front of each command.

```
node tools/check_layout.cjs   # News and Sports controls in the same place
node tools/check_sports.cjs   # every sport has every part, in the same place, from its own source
```

Also replay a finished game and watch a live one (or a mocked live one) for each sport, including the existing ones, since most code is shared.
