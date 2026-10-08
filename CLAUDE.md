# Working on Pixel Broadcasting Company

Read `README.md` first. Before building or changing any page, channel, desk or company page, follow `tools/NEW_PAGE.md` and `tools/LOOK_BOOK.md` (spacing, borders, the broadcast screen, characters, sets):
fonts, colors and shared parts (masthead, control row, cards, the rundown) come only from `shared/pbc.css`, by name.
Never write a font name, a `#hex`/`rgb()` color or a second name for a shared color in a page's CSS. A new color goes
in the `:root` block of `shared/pbc.css` with a comment. Run `node tools/check_style.cjs` before every pull request
(GitHub runs it too), plus `tools/check_layout.cjs` for layout changes and `tools/check_sports.cjs` for Sports.
