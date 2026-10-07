# Refreshing the Pixel Broadcasting Company headlines

The newsroom is the repo's root `index.html`, served by GitHub Pages at https://christophereddy.github.io/pixel-broadcasting-company/. The page holds no news itself: it reads `data/feed.json` and `data/locals.json` when it loads and checks them again every 5 minutes. A refresh only changes those two files. It never edits `index.html` and never touches `sports/`.

The old claude.ai artifact (https://claude.ai/artifact/Dt3JUvHUyCHFoMgdrqoDpz) is retired (Chris, 2026-10-05): do not republish it or write its database. Do not delete it unless Chris asks.

Schedule: routine trig_015dGokHMd1Msk935koiC35z runs at midnight Eastern and every 3 hours after (12, 3, 6, 9 AM and PM, America/New_York). The page's "Next news refresh" box computes the same slots.

- `data/feed.json`: world, international, national, politics, business, science, sports and goodnews, plus a copy of the default city's local desk (`local`, `weather`, `localgood`; the default city is the one named in `location`).
- `data/locals.json`: a list with one desk per city in the picker (`slug`, `location {name, short, tz}`, `local[]`, `goodnews[]`, `weather {now|null, periods[]}`, `sources[]`, `updatedAt`).
- New cities: only Chris adds cities, by naming them in the project. The place must be in `tools/cities.py` (search it with `python3 tools/cities.py <name>`; add a line there first if it's missing). Then give the gatherer output a `locals_*.json` entry under that slug with fresh `local` stories and its `sources` (https URLs); `merge.py` opens the desk. Find a local newsroom with WebFetch, preferring the city's public radio station or a local nonprofit newsroom. For US places use NWS weather (`https://forecast.weather.gov/MapClick.php?lat=..&lon=..`, lat/lon from cities.py). Outside the US, use the national weather service's page if WebFetch can read it, otherwise leave `periods` empty and `now` null. If no readable local source exists, tell Chris.

## Steps

1. Read the news from the repo, not from the sites. A GitHub Action (`.github/workflows/fetch-sources.yml`) fetches Chris's approved sources (`tools/sources.json`) every hour and saves them to the `feeds` branch: `git clone --depth 1 --branch feeds https://github.com/christophereddy/pixel-broadcasting-company feeds`. Start with `index.json` (when it was fetched, which sources came back, which failed). Each `<id>.json` holds the source's front page text and links or its feed items (title, link, date, summary), plus `articles` (the text of up to 8 recent stories, for `more` details). `local-<slug>.json` is each city's newsroom; `weather/<slug>.json` is each desk's forecast (NWS forecasts in JSON: `currentobservation` with its `Date`, and `time.startPeriodName` with matching `data.text` and `data.temperature`).
   Do not WebFetch news sites during a scheduled refresh: it asks Chris to approve each site. A source listed under `failed` counts as a failed source (keep its previous stories only within the age limits below). If `index.json` is more than 3 hours old, say so in the status checklist and use it anyway. The list below says what each source is for.
   - World, national and politics: `https://www.democracynow.org/YYYY/M/D/headlines` (today's US date, or yesterday's if today's page isn't up).
   - World and international (dated, wide foreign coverage): `https://www.aljazeera.com/news/`.
   - National and politics (dated): `https://www.pbs.org/newshour/`.
   - National and politics backup (Chris, 2026-10-05): ProPublica's dated feed `https://www.propublica.org/feeds/propublica/main` (the homepage hides dates). Investigative, so only a few stories a day: use any inside the 24-hour window, mainly when Democracy Now! and PBS are thin. Skip quizzes, podcasts and "Watch:" video explainers.
   - Business: `https://www.marketplace.org/` (dated; NPR business at `https://www.npr.org/sections/business/` as a backup).
   - Science: `https://www.sciencenews.org/`.
   - Do not use the Christian Science Monitor (Chris's decision, 2026-10-03).
   - Mix sources so no single outlet dominates a segment. Prefer stories that two outlets agree on, and when outlets differ on facts, use only what they share.
   - Sports: `https://www.cbssports.com/` (drop anything you can't place in the current week). CBS "recap" pages are often pre-game previews whose summaries show wrong scores: confirm each score in a CBS postgame article or box score, and drop it if pages disagree.
   - Local news per city: New York `https://tollbit.gothamist.com/news`, Los Angeles `https://laist.com/news`, Chicago `https://www.wbez.org/`, Seattle `https://www.kuow.org/`, Atlanta `https://www.wabe.org/news/` (dated feed: `https://www.wabe.org/category/news/feed/`), Denver `https://denverite.com/`, Boston `https://www.wbur.org/news`, Paris `https://www.thelocal.fr/` (weather: Météo-France `https://meteofrance.com/previsions-meteo-france/paris/75000`, convert °C to °F). Many homepages hide dates: use feeds (`tollbit.gothamist.com/feed`, `laist.com/index.atom`, `denverite.com/feed/`, `kuow.org/latest`, `wbez.org/news`).
   - Weather: `weather/<slug>.json`. Always check the observation date. If it is more than 12 hours old, set `now` to null and keep only forecast periods that are still in the future. If nothing usable comes back, keep the previous weather.
   - Blocked or useless: BBC, Reuters, AP, The Guardian, DW, France 24, Politico, The Verge, ESPN, NPR sports (stale), api.weather.gov, Open-Meteo, wttr.in, timeanddate, WAMU, Houston Public Media (stale).
2. Aim for depth: every list carries 4 to 8 stories, and most stories get a `more` array (a JSON list of separate sentence strings, never one string) of 1 to 3 extra sentences of detail from the article itself (open the article with WebFetch for names, numbers and context). Every story airs once per loop, so a full loop runs about 20 to 25 minutes.
   Give every story a `date` (the source's publish date, `YYYY-MM-DD`).
   Write short, plain, factual items: `h` under ~60 characters; `b` one or two sentences that only state what the source says. International items need `place` and an IANA `tz`. World and national items get a `place` too when the story happens in one place (a country, US state or city, like `Phoenix, Arizona`), and none when it doesn't; the newsroom pins it on the video wall's map.
2a. The article behind each story (Chris, 2026-10-07: the newsroom's "Current story" card shows it, with a QR code). Give every story, local and Good News included, these fields from the feeds files:
   - `publisher`: the outlet's name as it appears in `tools/sources.json` (e.g. "PBS NewsHour", "Gothamist").
   - `url`: the article's own https address (the feed item's `link` or the article's `url`), not the source's front page. Leave it out if you only have the front page.
   - `title`: the article's own headline as the publisher wrote it (feed item `title`, or the article `title` without the " | Site name" tail).
   - `published`: when the publisher put the article out, as an ISO time (`2026-10-07T13:14:00Z`): the feed item's `date`, or the article's `published`. `updated`: the article's `updated`, only when the publisher gives one.
   - `gathered`: the `fetchedAt` of the feeds file the story came from (when PBC gathered it).
   Never guess a time. If the source gives only a day, or nothing, leave `published` out: the card then says the time is unknown rather than showing the gathered time, so an older article never looks new. `merge.py` keeps the first `gathered` time when the same article comes back in a later refresh.
2b. Good News (Chris, 2026-10-03): while scanning, flag genuinely positive stories (a rescue, a recovery, a discovery, a community win, money returned to people, something delightful) and put them in `goodnews` instead of their normal list, so they air once. feed.json `goodnews` holds 0 to 4 national/world/science items; each desk's `goodnews` in data/locals.json holds 0 to 3 local items (feed.json `localgood` mirrors New York City's). Same story shape and age rules. "Less bad" news, partisan or election wins, and ads don't count. Never stretch or invent: an empty list simply means no Good News segment this round. Gatherer output may carry `goodnews` in news.json, bss.json and each locals_* city entry; merge.py handles the rest.
3. merge.py sets `updatedAt` and keeps `desk: "local"` on local and weather sources.
4. Every list is a full replacement; nothing is carried over except by merge.py's fallback rule below.
5. Never invent news.
6. Merge: in a fresh clone of the repo's `main` (`git clone --depth 1 https://github.com/christophereddy/pixel-broadcasting-company`; attach it with add_repo first if the session lacks it), put the gatherers' output in a scratch folder as news.json (world/international/national/politics/goodnews/sources), bss.json (business/science/sports/goodnews/sources) and locals_*.json ({slug:{local, goodnews, weather, sources}}), then run `python3 tools/merge.py <scratch folder>`. It applies the age rules, falls back to still-fresh previous stories, and rewrites `data/feed.json` and `data/locals.json` in place. Check its printed counts.
7. Publish: commit only `data/feed.json` and `data/locals.json` with a short "News refresh <time>" message and push to `main`. If the push is rejected because main moved, `git pull --rebase` and push again. Never commit other files from a refresh; code changes go through a pull request.

## Clearing old news (Chris, 2026-10-03: the database should not keep outdated information)

- Each refresh rebuilds every list from what was fetched this time. Do not append to or carry over the previous lists.
- A story is outdated when its `date` is more than 24 hours before the refresh (sports: more than 48 hours, or outside the current week's games). Drop it even if the source still lists it.
- If a source fails, keep that section's previous stories only while they are still within those limits. When none are, leave the list empty; the page skips empty segments.
- Weather: drop forecast periods that have already ended, and set `now` to null when the observation is more than 12 hours old.
- Apply the same rules to every desk in data/locals.json and to the local desk in feed.json.
