# Sold ads

`sold.json` lists the ads that have been sold for the sports page. When it has any, they replace the twelve made-up
brands on the stadium signs and in the timeout window. When it's empty, the made-up brands fill every spot.

The PBC house ad (the QR code to the Advertise page) is not in this file. It is built into `sports/index.html`, takes
every third break, and can't be replaced.

Each ad:

```json
{"name": "GRID COFFEE", "line": "FRESH ROAST EVERY ROUND", "bg": "#4a3526", "fg": "#f7d9a8"}
```

- `name`: up to 16 characters, capitals A-Z, digits, spaces, `&`, `-`, `.` (what the sign lettering can draw).
- `line`: the slogan, up to 26 characters, capitals A-Z, digits and spaces. The announcer reads it at breaks.
- `bg`, `fg`: background and lettering colors as `#rrggbb`.

An entry that breaks these rules is skipped. The wording is fixed text the advertiser and Chris approve; it is never
written or changed by the news refresh or by Claude.
