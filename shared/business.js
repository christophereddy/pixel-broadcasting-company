/* Pixel Broadcasting Company: the business switchboard.
   Every "plug it in later" setting for the company pages lives here, and nothing else needs editing
   to turn a part on. Empty means "not set up yet": the pages show a "coming soon" note in that spot
   and never send anything anywhere. See tools/BUSINESS_SETUP.md for what each one is and where to get it.

   Safety rule: whatever a viewer or advertiser types goes to the form service and on to Chris's email.
   It never goes to Claude, the news refresh, or into the broadcast. Sponsor copy that airs is fixed text
   Chris approves, added by hand. */
window.PBC_BUSINESS = {
  company: "Pixel Broadcasting Company",   // legal name once the LLC exists, e.g. "Pixel Broadcasting Company LLC"
  mailingAddress: "",                      // business mailing address for the legal pages (optional)

  // Marketing Division. salesOpen:false keeps the request form visible but switched off.
  salesOpen: false,
  // Where the ad request form posts. A form service URL such as "https://formspree.io/f/xxxxxxxx".
  // Empty: the form can be filled in to try it, but SEND only explains that requests open soon.
  adFormEndpoint: "",

  // Email addresses shown on the Contact page and around the site. Empty shows "coming soon".
  email: {
    general: "",
    advertising: "",
    press: "",
    corrections: "",
    accessibility: "",
    privacy: ""
  },

  // Ad menu. Each id matches a card on the Marketing Division page.
  //   price: text to show, e.g. "$250 / month". Empty shows "Rates coming soon".
  //   payLink: a payment link (e.g. a Stripe Payment Link) sent after Chris approves an ad.
  //            Empty hides the pay button. Only fill this in once paid ads are allowed to run.
  packages: {
    sports: { price: "", payLink: "" },   // arena boards + the big screen during breaks in play
    news:   { price: "", payLink: "" }    // Dot reads the ad on the big screen in news commercial breaks
  },

  // Audience numbers for advertisers, e.g. [["Monthly viewers", "12,400"], ["Average watch time", "18 min"]].
  // Empty shows "Audience numbers coming soon".
  audience: [],

  // Privacy-friendly analytics. Set src to the provider's script URL and any data-* attributes it needs,
  // e.g. { src: "https://gc.zgo.at/count.js", attrs: { "data-goatcounter": "https://pbc.goatcounter.com/count" } }.
  // Empty loads nothing. Update the Privacy page when this is turned on.
  analytics: { src: "", attrs: {} }
};
