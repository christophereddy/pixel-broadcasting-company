# Building a new channel, desk or page

Every PBC page looks like one company: the same fonts, the same colors, the same masthead, the same control row, the same cards and the same rundown. This guide is how to build something new without anyone having to correct those details afterwards. If a rule here and a page disagree, the rule wins and the page gets fixed.

**The one rule:** fonts, colors and shared parts are written once, in `shared/pbc.css`. A page uses them by name and never writes its own. `tools/check_style.cjs` enforces this and runs on every pull request.

## What are you building?

| You're adding | It looks like | Start from | Also read |
| --- | --- | --- | --- |
| **A channel** (a new tab in NEWS \| SPORTS, a full broadcast) | `index.html` (News) and `sports/index.html` (Sports) | the skeleton below, with a `.pbc-screen` broadcast in `.pbc-main` | "Channels" below |
| **A desk** (a hosted show inside a channel, like the Sports Desk) | `sports/show.js` and its rundown | the channel's own page; the desk adds a rundown card and drives the broadcast | "Desks" below |
| **A sport** on Pixel Sports Live | the other sports | `tools/ADDING_A_SPORT.md` | this guide for anything visual |
| **A company or info page** (About, Advertise, a new department) | `advertise/` (Marketing Division) and `about/` | the skeleton below, with `shared/company.css` cards in `.pbc-main` | "Company pages" below |

## The shared source

| File | What's in it | Who uses it |
| --- | --- | --- |
| `shared/pbc.css` | **All fonts and colors** (the `:root` block), the page grid, masthead, NEWS \| SPORTS switch, ON AIR, control row, FULL SCREEN and SOUND buttons, the broadcast frame, full-screen mode, cards (`.pbc-card`), the rundown (`.pbc-rundown`), the LIVE NOW chip, the company footer | every page |
| `shared/pbc.js` | SOUND, FULL SCREEN, voices, the company footer, business settings | every page |
| `shared/company.css` | Text cards, directory, steps, stats, menu, forms, tags (`co-*` classes) | company pages |
| `shared/live.js`, `shared/music.js`, `shared/ads.js` | LIVE NOW, the theme music and TUNE IN, the ad copy | channels |

### Fonts

Three fonts, each with one job. Use the name, never the font itself.

| Name | Font | Use it for | Weight |
| --- | --- | --- | --- |
| `var(--f-display)` | Pixelify Sans | headlines, names, big titles on the broadcast | always write `font-weight:700` (or `500` for a name in a list, like ON THE DESK) |
| `var(--f-label)` | Silkscreen | labels, card titles, buttons, tabs, chips, NOW/NEXT, LIVE | always `font-weight:400`, also on `h2`-`h6` and `b`, which are bold by default (the check catches this) |
| `var(--f-body)` | VT323 | everything else: body text, times, lists, captions | normal |

The body already uses `--f-body` at 20px, so plain text needs nothing. Every page loads the fonts with this exact line (the check compares it character for character):

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@500;700&family=Press+Start+2P&family=Silkscreen&family=VT323&display=swap">
```

Press Start 2P is only for small numbers drawn on sports canvases (jersey numbers). Never use it in CSS.

### Colors

All in the `:root` block of `shared/pbc.css`, each with a comment saying what it's for. The ones you'll use most:

| Name | For |
| --- | --- |
| `--room` | the page background |
| `--panel` | cards and buttons; `--panel-2` for a raised box inside a card |
| `--line` | card and button borders; `--rule` for dashed rows inside a list |
| `--text`, `--muted` | text, and quieter text (hints, times, credits) |
| `--gold` | card titles, the current item, hover, focus rings; `--gold-hi` for a gold button's hover |
| `--navy` | text on gold, the rundown row on air |
| `--live` | LIVE, ON AIR, NOW |
| `--picked` | the rundown row a viewer picked (NEXT) |
| `--white`, `--black` | text on red chips, the monitor's background |
| `--overlay`, `--overlay-85`, `--overlay-90` | captions over the broadcast picture |
| `--paper`, `--paper-ink` | white lower-thirds and speech bubbles, and their text |
| `--frame`, `--shadow` | the monitor bezel and the hard pixel shadows |
| `--ok`, `--err`, `--err-soft` | form and load messages |

**Need a color that isn't there?** First look again: most "new" colors are one of these. If it really is new, add it to the `:root` block in `shared/pbc.css` with a comment saying what it's for, in the same pull request. Never write `#hex`, `rgb()` or a color word in a page's CSS, and never give a shared color a second name (`--ink:var(--text)`): that's how the Sports page drifted before.

**Pictures are exempt.** Canvas drawing (`fillStyle`, sprites, fields, team colors from data) and SVG illustrations (`fill="..."`) are pixel art with their own palettes. The rule covers page styling: CSS, `style=""` and `el.style.*` set from JS.

## The page skeleton

Every page starts with this. Copy it exactly; only the three marked lines change. (Paths are for a page one folder down, like `about/`. A page at the site root drops the `../`.)

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>PAGE NAME · Pixel Broadcasting Company</title>          <!-- 1 -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@500;700&family=Press+Start+2P&family=Silkscreen&family=VT323&display=swap">
<link rel="stylesheet" href="../shared/pbc.css">
<link rel="stylesheet" href="../shared/company.css">   <!-- company pages only -->
<script src="../shared/business.js"></script>
<script src="../shared/pbc.js"></script>
</head>
<body>
<div class="pbc-page">
  <div class="pbc-top">
  <header class="pbc-mast">
    <div class="pbc-brand">
      <span class="pbc-mark" aria-hidden="true">PBC</span>
      <div><h1>Pixel Broadcasting Company</h1><p>SUBTITLE</p></div>  <!-- 2 -->
    </div>
    <div class="pbc-side">
      <nav class="pbc-chan" aria-label="Channel"><a href="../">NEWS</a><a href="../sports/">SPORTS</a></nav>
      <div class="pbc-onair"><span class="pbc-dot"></span>ON AIR 24 HOURS</div>
    </div>
  </header>
  <div class="pbc-ctl">
    <!-- 3: the page's own control on the left (channel: tabs or a picker; company page: <div class="co-dept">) -->
    <div class="pbc-btns"><!-- channel: FULL SCREEN #fs and SOUND #snd; company page: BACK TO THE BROADCAST --></div>
  </div>
  </div>
  <main class="pbc-main"> ... </main>
  <aside class="side"> ... cards ... </aside>
</div>
</body>
</html>
```

The masthead, NEWS \| SPORTS switch, ON AIR, control row, broadcast and right column must sit in exactly the same place on every page. On the current channel's page, add `aria-current="page"` to its link in `.pbc-chan`.

## Shared parts (use these, don't rebuild them)

**Cards.** Every box in the right column is `<div class="pbc-card"><h2>TITLE</h2> ...</div>`. Card titles are short capitals in `--f-label`, 14px, gold, `letter-spacing:.1em`, on every page.

**The rundown.** One look for every channel and desk:

```html
<div class="pbc-card" id="...">
  <h2>RUNDOWN</h2>
  <p class="pbc-rdhint">Pick a segment to jump to it after the current one.</p>
  <ol class="pbc-rundown" id="..."></ol>
</div>
```

Your script fills the list with one `<li>` per segment: `<span class="tm">` with the clock time, then the name. The row on air is `li.now` with its name in a plain `<span>`; other rows have their name in `<button class="pk">`; the row a viewer picked is `li.picked`. NOW and NEXT are added by the CSS. Copy `deskRundown()` in `sports/show.js` or `renderRundown()` in `index.html`.

**LIVE NOW chip.** Built by `shared/live.js`. A page only places it, with one `.livenow{position:absolute;right:...;top:...}` rule.

**Company page cards** (`shared/company.css`), as on the Marketing Division page:
- `co-card` for each section, with an `<h2>` label and `<h3>` subheads; `co-hero` and `co-lead` for the opening card
- `co-steps` (numbered steps), `co-stats` (number tiles), `co-menu` with `co-item` (options side by side with a picture, text and price), `co-banner` (a gold notice across the top), `co-note`, `co-tag`
- `co-form` for forms, `co-faq` for questions and answers
- `co-side` with a `co-dir` directory card in the right column; mark the current page with `aria-current="page"`

Write a new `co-*` part in `shared/company.css` only when none of these fits, using the shared fonts and colors.

## Channels

- The broadcast is a `<div class="pbc-screen">` 16:9 monitor in `.pbc-main`. Everything drawn over it sizes in `cqw` units so it scales with the monitor.
- Graphics over the picture use the same vocabulary as News and Sports: gold label plates in `--f-label`, headlines in `--f-display` at weight 700, captions on `--overlay`, lower-thirds on `--paper`.
- Wire up `PBC.sound(...)` and `PBC.fullScreen(screen)` from `shared/pbc.js`; don't write your own.
- Add the channel to the `.pbc-chan` switch on **every** page in the same pull request, and add its two selectors to `SHARED` in `tools/check_layout.cjs` so its controls are checked against News.

## Desks

A desk is a hosted show inside a channel, like the Sports Desk (`sports/show.js`).
- It lives in its own file next to the channel's page and runs on the page's existing state, the way `show.js` uses `S`, `CAST` and `SPORTS`.
- It shows its running order with the shared rundown card above.
- Its host and guests come from the channel's cast; commercial breaks use `shared/ads.js`.
- Everything it says comes from data already on the page. Nothing is invented.

## Before opening the pull request

Run all three (in a Claude cloud session, put `NODE_PATH=$(npm root -g)` in front of the last two):

```
node tools/check_style.cjs    # fonts, colors and shared parts come from shared/pbc.css
node tools/check_layout.cjs   # shared controls sit in the same place on News and Sports
node tools/check_sports.cjs   # only when Sports changed
```

Then look at the page at phone (390px), laptop (1280px) and wide (1700px) widths next to News and the Marketing Division page. If anything shared needs to change, change it in `shared/` so every page follows, and say so in the pull request.
