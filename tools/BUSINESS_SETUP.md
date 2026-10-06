# Turning on the business parts

The company pages (About, Marketing Division, Contact, Sources & Credits, Corrections, Accessibility, Ad Policy, Privacy, Terms) are built and live, but nothing is switched on yet: no form service, payments, email or analytics.
Every switch is one setting in `shared/business.js`. While a setting is empty, its spot on the page shows a COMING SOON tag and nothing is sent anywhere.

**Don't sell or run paid ads until the news and sports data are licensed for commercial use** (see the business notes in the project folder: ESPN, the MLB Stats API, Democracy Now! and ProPublica are non-commercial only).

| Setting | What it turns on | Where to get it |
| --- | --- | --- |
| `company`, `mailingAddress` | The legal name in the footer and Terms, and the mailing address on Contact | After the LLC is formed |
| `email.*` | Email links on Contact, Corrections, Accessibility, Privacy and the Marketing Division's "Talk to sales" card. Any empty one falls back to `email.general`. | A business email on your own domain |
| `adFormEndpoint` | Where the Marketing Division's request form sends its answers | A form service (for example Formspree, Basin or Web3Forms). Make a form, copy its endpoint URL, and set the service to email you. |
| `salesOpen` | Set to `true` to take requests. It also hides the OPENING SOON banner. The form only sends when this is `true` **and** `adFormEndpoint` is set. | Your call |
| `adFormUploads` | Shows a logo-upload field on the form | Only if the form service plan accepts file uploads |
| `packages.<id>.price` | The price shown on each ad card (`boards`, `timeout`, `segment`, `desk`, `founding`). Empty shows RATES COMING SOON. | Your rates |
| `packages.<id>.payLink` | A PAY button on that card, shown only while `salesOpen` is `true` | A payment link (for example a Stripe Payment Link). Or leave these empty and email each approved advertiser a link instead, so nobody can pay before you approve. |
| `audience` | The "Who's watching" numbers | From the analytics below, once there is data |
| `analytics` | Loads a privacy-friendly analytics script on every page | For example GoatCounter, Plausible or Cloudflare Web Analytics. Update the Analytics section of the Privacy page at the same time. |

## Other things to finish before launch

- The Privacy, Terms and Ad Policy pages are marked DRAFT. Have a lawyer review them, then remove the `co-note` DRAFT line from each page.
- Ad Policy's "What we don't accept" list is a starting point (it excludes political ads, alcohol and gambling, among others). Edit it to match what you'll actually accept.
- Corrections: add each correction as a line in the log on `corrections/index.html`. The comment there shows the format.
- Sponsor art and on-air lines go into the broadcast by hand, as fixed text you approve. Request-form answers go only to your email and never into the broadcast or the news refresh.

## Where things live

- `shared/business.js`: the settings above
- `shared/company.css`, `shared/company.js`: the look of the company pages and the code that fills in emails and the company name
- `shared/pbc.js`: adds the company footer to every page, News and Sports included, and loads analytics once it's set
- `<page>/index.html`: one folder per company page. They share the News/Sports masthead.
