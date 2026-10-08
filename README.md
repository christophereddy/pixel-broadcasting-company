# Pixel Broadcasting Company

A pixel-art TV channel that runs around the clock, served by GitHub Pages at
https://christophereddy.github.io/pixel-broadcasting-company/. It has two channels with a NEWS | SPORTS switch at the top.

- **News** (`index.html`): a pixel newsroom with a cast of reporters reading the day's world, national, local, business, science and sports news and the weather, from data that Claude refreshes every 3 hours.
- **Sports** (`sports/index.html`): Pixel Sports Live, live NFL, NBA, WNBA and MLB games animated from play-by-play data (ESPN for football and basketball, MLB's own Stats API for baseball), fetched by the viewer's browser.

## What lives where

| Path | What it is | Who changes it |
| --- | --- | --- |
| `index.html` | The newsroom page: drawing, cast, rundown, sound, city picker. Holds no news itself. | Code changes, through pull requests |
| `data/feed.json` | The national desks (world, international, national, politics, business, science, sports, Good News) and the default city's local desk | The 3-hour refresh |
| `data/locals.json` | One local desk (news, Good News, weather, sources) per city in the picker | The 3-hour refresh |
| `news/visuals.js`, `news/places.js`, `news/world-map.bin` | Story visuals on the newsroom's video wall: a pixel map with a pin for world, international and national stories (from a story's `place`, or a country, state or city its text names), and category art for every desk story. Works from the built-in place list and map; no map service. | `visuals.js` through pull requests; `places.js` and `world-map.bin` only by re-running `tools/build_story_map.py` |
| `sports/index.html` | Pixel Sports Live | Code changes only; the refresh never touches it |
| `shared/pbc.css`, `shared/pbc.js` | The one source for every page's fonts and colors (the `:root` block), plus what all pages share: page grid, masthead, NEWS/SPORTS switch, ON AIR, FULL SCREEN, SOUND, the broadcast frame, full-screen mode, cards and the rundown | Code changes |
| `tools/NEW_PAGE.md` | How to build a new channel, desk or company page so it matches the rest | When a shared part changes |
| `tools/LOOK_BOOK.md`, `tools/look/` | The whole PBC look: spacing, borders, the broadcast screen, pixel-art rules, how characters and sets are drawn, the cast's colors | With every new character, set or look change |
| `tools/check_style.cjs` | Fails when a page writes its own fonts or colors, or restyles a shared part (runs on every pull request) | Code changes |
| `shared/music.js` | The newsroom's chiptune theme, segment stings, commercial-break bed and first-visit TUNE IN, all made with WebAudio (news only) | Code changes |
| `tools/REFRESH.md` | Step-by-step instructions the 3-hour refresh follows | When sources or rules change |
| `tools/sources.json`, `tools/fetch_sources.py`, `.github/workflows/fetch-sources.yml` | Chris's approved news sources, and the hourly Action that saves them (plus recent article text and each desk's forecast) to the `feeds` branch for the refresh to read | `sources.json` only when Chris names a source |
| `newsroom/story-card.js`, `newsroom/story-card.css` | The "Current story" card above the news rundown: the article behind the story on air (publisher, published and gathered times, link, QR code) | Code changes |
| `tools/merge.py` | Merges a refresh's gathered stories into `data/`, applying the age rules | Code changes |
| `tools/cities.py` | The places a city desk can be opened for (name, short code, time zone, lat/lon) | When Chris names a city that is missing |
| `tools/check_layout.cjs` | Checks that the shared controls sit in the same place on both channels | Code changes |
| `tools/ADDING_A_SPORT.md` | The checklist every sport on Pixel Sports Live follows | When the shared sports structure changes |
| `tools/check_sports.cjs` | Checks that every sport has every part, in the same place, from its one data source | Code changes |
| `news/index.html` | Redirect for old `/news/` links | Leave as is |
| `about/`, `advertise/`, `contact/`, `sources/`, `corrections/`, `accessibility/`, `ad-policy/`, `privacy/`, `terms/` | The company pages linked from the footer on every page. `advertise/` is the Marketing Division ad page with the request form. | Code changes |
| `data/cooking/ingredients.json`, `data/cooking/recipes/`, `data/cooking/shows.json` | The cooking channel's ingredient library, its AI-written recipes (one file each) and the shows that cook them. The COOKING channel and the recipe site are built on these. | Through pull requests; `tools/check_recipes.cjs` must pass |
| `tools/COOKING.md`, `tools/check_recipes.cjs` | How recipes are written, and the check that enforces it (amounts add up, timers and temperatures match the words, food safety, allergens). Runs on every pull request. | Code changes |
| `shared/business.js` | Plug-in settings for the business side: form service, payment links, emails, analytics. Empty means switched off. See `tools/BUSINESS_SETUP.md`. | Chris, when each service is set up |

## Rules

- Every page takes its fonts, colors and shared parts from `shared/pbc.css`, by name. Before building a new channel, desk or page, follow `tools/NEW_PAGE.md`, and run `node tools/check_style.cjs` before every pull request.
- News and Sports must look like one channel: banner, NEWS | SPORTS, ON AIR, FULL SCREEN, SOUND and the broadcast sit in the same place on both. Change shared parts in `shared/`, not in one page. After any layout change, run the layout check at phone, laptop and wide widths:
  `node tools/check_layout.cjs` (in a Claude cloud session: `NODE_PATH=$(npm root -g) node tools/check_layout.cjs`).
- Every recipe follows `tools/COOKING.md`: ingredients only from the library, amounts that add up, timers and temperatures as written, safe cooking temperatures. Run `node tools/check_recipes.cjs` after changing `data/cooking/`.
- Every sport on Pixel Sports Live is built the same way, from one data source per sport. Before adding or changing a sport, follow `tools/ADDING_A_SPORT.md` and run `node tools/check_sports.cjs`.
- The refresh commits only `data/feed.json` and `data/locals.json`, straight to `main`. Everything else goes through a pull request.
- Never invent news; outdated stories are dropped, not kept (see `tools/REFRESH.md`).
- Viewer text never reaches Claude: the page has no request box, and new cities are added only when Chris names them.

## Previewing

The news page loads `data/*.json` with `fetch`, so open it through a local web server rather than as a file:

```
python3 -m http.server 8000
```

then visit http://localhost:8000/ and http://localhost:8000/sports/.
