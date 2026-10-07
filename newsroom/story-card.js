/* Pixel Broadcasting Company newsroom: the "Current story" card above the rundown.
   It shows the article behind the story on air: PBC's headline, the publisher, when the publisher put the article out
   (and last updated it), when PBC gathered it, the article's own title as a link, and a QR code of the link.
   The two kinds of time are labelled apart on purpose: an older article gathered today must not look new.
   A time the data doesn't carry is shown as unknown, never filled in from another time.
   The page calls PBC_STORY.show(beat, tz) when a new beat goes on air, so the card changes with the broadcast itself:
   a segment a viewer queued from the rundown only reaches the card once it airs.
   Story fields (all optional, written by the 3-hour refresh, see tools/REFRESH.md): publisher, url, title,
   published, updated, gathered (ISO times), plus the older date (YYYY-MM-DD) every story has. */
(function(){
"use strict";
const $ = id => document.getElementById(id);
let shownKey = null;

const iso = s => typeof s === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(s) && !isNaN(Date.parse(s)) ? Date.parse(s) : null;
const dayOnly = s => typeof s === "string" && /^\d{4}-\d\d-\d\d$/.test(s) ? s : null;
const httpsUrl = s => typeof s === "string" && /^https:\/\/[^\s"<>]+$/.test(s) ? s : null;
function safeTz(tz){try{new Intl.DateTimeFormat("en-US",{timeZone:tz});return tz}catch(e){return undefined}}
function when(t, tz){
  return new Intl.DateTimeFormat("en-US",{timeZone:safeTz(tz),month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZoneName:"short"}).format(new Date(t));
}
function ago(t){
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 0) return "";
  if (m < 60) return m <= 1 ? "just now" : m + " min ago";
  const h = Math.round(m / 60); if (h < 48) return h + (h === 1 ? " hour ago" : " hours ago");
  return Math.round(h / 24) + " days ago";
}
function publisherOf(url){try{return new URL(url).hostname.replace(/^www\./,"")}catch(e){return ""}}

function build(root){
  root.innerHTML =
    '<h2>CURRENT STORY</h2>' +
    '<div class="cs-body" id="csBody">' +
      '<p class="cs-seg" id="csSeg"></p>' +
      '<p class="cs-head" id="csHead"></p>' +
      '<dl class="cs-meta">' +
        '<div><dt>PUBLISHER</dt><dd id="csPub"></dd></div>' +
        '<div><dt>PUBLISHED</dt><dd id="csPubAt"></dd></div>' +
        '<div id="csUpdRow"><dt>UPDATED</dt><dd id="csUpdAt"></dd></div>' +
        '<div><dt>PBC GATHERED</dt><dd id="csGot"></dd></div>' +
      '</dl>' +
      '<div class="cs-link">' +
        '<div class="cs-art"><span class="cs-lbl">ARTICLE</span><a id="csTitle" target="_blank" rel="noopener noreferrer"></a><span id="csNoLink" class="cs-unk"></span></div>' +
        '<a class="cs-qr" id="csQr" target="_blank" rel="noopener noreferrer" tabindex="-1" aria-hidden="true"><canvas id="csQrC"></canvas><span>SCAN TO READ</span></a>' +
      '</div>' +
      '<a class="cs-read" id="csRead" target="_blank" rel="noopener noreferrer">READ THE ARTICLE ▸</a>' +
    '</div>' +
    '<p class="cs-idle" id="csIdle"></p>';
}

function drawQr(url){
  const c = $("csQrC"), M = url && window.PBC_ADS ? PBC_ADS.qrMatrix(url) : null;
  if (!M) return false;
  const n = M.length, q = 2, px = 4, size = (n + 2 * q) * px;   // 2-module quiet zone; the card's white frame adds more
  c.width = c.height = size;
  const g = c.getContext("2d"); g.fillStyle = "#ffffff"; g.fillRect(0, 0, size, size); g.fillStyle = "#05060d";
  M.forEach((row, y) => row.forEach((d, x) => { if (d) g.fillRect((x + q) * px, (y + q) * px, px, px); }));
  return true;
}

function time(el, t, tz, fallback){
  el.textContent = ""; el.classList.toggle("cs-unk", t == null && !fallback);
  if (t != null) { el.append(when(t, tz)); const a = ago(t); if (a) { const s = document.createElement("span"); s.className = "cs-ago"; s.textContent = " · " + a; el.append(s); } }
  else el.textContent = fallback || "Unknown";
}

function show(beat, tz){
  const root = $("storyCard"); if (!root) return;
  if (!root.firstChild) build(root);
  const s = beat && beat.story;
  const key = s ? [s.h, s.url || "", s.published || "", s.date || ""].join("|") : "idle:" + (beat ? beat.seg : "");
  if (key === shownKey) return;   // the same story's next beat: nothing changes
  shownKey = key;
  root.classList.toggle("cs-off", !s);
  if (!s) {
    const seg = beat ? beat.seg : "";
    $("csIdle").textContent = seg === "Commercial break" ? "Commercial break. The next story's article will show here when it airs."
      : (seg ? seg + ": " : "") + "no article on air right now. The card fills in when the next story starts.";
    return;
  }
  $("csSeg").textContent = String(beat.cat || beat.seg || "").toUpperCase();
  $("csHead").textContent = s.h;
  const url = httpsUrl(s.url);
  $("csPub").textContent = s.publisher || "Unknown"; $("csPub").classList.toggle("cs-unk", !s.publisher);
  const pub = iso(s.published), upd = iso(s.updated), day = dayOnly(s.date);
  time($("csPubAt"), pub, tz, pub == null && day ? new Intl.DateTimeFormat("en-US",{timeZone:"UTC",month:"short",day:"numeric"}).format(new Date(day + "T12:00:00Z")) + " · time unknown" : "");
  $("csUpdRow").hidden = upd == null || (pub != null && Math.abs(upd - pub) < 60000);
  if (upd != null) time($("csUpdAt"), upd, tz);
  time($("csGot"), iso(s.gathered), tz);
  const t = $("csTitle"), r = $("csRead"), qr = $("csQr");
  if (url) {
    t.href = r.href = qr.href = url; t.hidden = false; r.hidden = false; $("csNoLink").textContent = "";
    t.textContent = s.title || s.h;
    t.setAttribute("aria-label", (s.title || s.h) + (s.publisher ? ", " + s.publisher : "") + " (opens in a new tab)");
    r.setAttribute("aria-label", "Read the article" + (s.publisher ? " at " + s.publisher : " at " + publisherOf(url)) + " (opens in a new tab)");
    qr.hidden = !drawQr(url);
  } else {
    t.hidden = r.hidden = qr.hidden = true; t.removeAttribute("href");
    $("csNoLink").textContent = s.title ? s.title + " (link not recorded)" : "Link not recorded";
  }
}

window.PBC_STORY = {show};
})();
