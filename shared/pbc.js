/* Pixel Broadcasting Company: behavior News and Sports share (see pbc.css for the look).
   PBC.sound(onChange)   SOUND button (#snd) cycling OFF, BLIPS, VOICES. Calls onChange(mode) inside the tap,
                         which iPhone needs before it will play audio or speech.
   PBC.voices()          Usable English speech voices: on-device ones first, no Apple novelty voices.
   PBC.fullScreen(el)    FULL SCREEN button (#fs) for the broadcast element.
   PBC.root              The site's root URL, worked out from where this file was loaded.
   PBC.fractions(el)     Shows ⅛ ¼ ⅓ ½ ⅔ ¾ in el as VT323 digits (1/3, small and stacked) instead of the fraction
                         characters, which VT323 doesn't all have; the text itself stays ⅓. Runs on every page, and on text added later.
   Every page also gets the company footer (About, Advertise, Contact, legal pages) under the page, and the
   business settings in shared/business.js (which turn on analytics once one is set up there). */
window.PBC = (function(){
  "use strict";
  const $ = id => document.getElementById(id);

  const MODES = ["off", "blips", "voices"];
  let mode = "off";
  function sound(onChange){
    const b = $("snd");
    const set = m => {
      mode = m; b.textContent = "SOUND: " + m.toUpperCase(); b.classList.toggle("on", m !== "off");
      if (m !== "voices") { try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {} }
    };
    b.addEventListener("click", () => {
      let next = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
      if (next === "voices" && !("speechSynthesis" in window)) next = "off";
      set(next); onChange(next);
    });
    return { get mode(){ return mode; }, set(m){ set(m); onChange(m); } };
  }

  // Network voices (like Chrome's "Google" voices) stop partway through longer lines, so on-device voices
  // come first. Apple's novelty voices (Bells, Zarvox...) sound broken on an iPhone, so they are skipped.
  const NOVELTY = /^(albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|deranged|hysterical|pipe organ)\b/i;
  function voices(){
    let all = [];
    try { all = (window.speechSynthesis && speechSynthesis.getVoices()) || []; } catch (e) {}
    all = all.filter(v => /^en(-|_|$)/i.test(v.lang) && !NOVELTY.test(v.name));
    const local = all.filter(v => v.localService);
    return local.length ? local : all;
  }
  try { if (window.speechSynthesis) speechSynthesis.getVoices(); } catch (e) {}

  function fullScreen(screen){
    const b = $("fs");
    let idleTimer = 0;
    const wake = () => {
      document.body.classList.remove("idle"); clearTimeout(idleTimer);
      if (document.body.classList.contains("theater-on")) idleTimer = setTimeout(() => document.body.classList.add("idle"), 3000);
    };
    const setTheater = on => {
      screen.classList.toggle("theater", on); document.body.classList.toggle("theater-on", on);
      b.textContent = on ? "EXIT FULL SCREEN" : "FULL SCREEN"; wake();
    };
    b.addEventListener("click", async () => {
      if (screen.classList.contains("theater")) {
        setTheater(false); try { if (document.fullscreenElement) await document.exitFullscreen(); } catch (e) {} return;
      }
      setTheater(true);
      // The whole page goes full screen so the floating buttons stay reachable; iPhone has no full screen
      // for pages, so there the monitor just fills the window.
      try { if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen(); } catch (e) {}
      try { await navigator.wakeLock.request("screen"); } catch (e) {}
    });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && screen.classList.contains("theater") && !document.fullscreenElement) setTheater(false); });
    document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement && screen.classList.contains("theater")) setTheater(false); });
    ["pointermove", "pointerdown", "keydown"].forEach(t => document.addEventListener(t, wake, { passive: true }));
  }

  // The site root, from this script's own address, so the footer links work from / and from /sports/.
  let root = "./";
  try { root = new URL("..", document.currentScript.src).href; } catch (e) {}

  const LINKS = [
    ["recipes/", "Recipes"], ["about/", "About"], ["advertise/", "Advertise"], ["contact/", "Contact"], ["sources/", "Sources & Credits"],
    ["corrections/", "Corrections"], ["accessibility/", "Accessibility"], ["ad-policy/", "Ad Policy"],
    ["privacy/", "Privacy"], ["terms/", "Terms"]
  ];
  function siteFooter(){
    if (document.querySelector(".pbc-sitefoot")) return;
    const B = window.PBC_BUSINESS || {};
    const f = document.createElement("footer"); f.className = "pbc-sitefoot";
    const nav = document.createElement("nav"); nav.setAttribute("aria-label", "Company");
    const here = location.href.split(/[?#]/)[0];
    LINKS.forEach(([path, label]) => {
      const a = document.createElement("a"); a.href = root + path; a.textContent = label;
      if (here === a.href || here === a.href + "index.html") a.setAttribute("aria-current", "page");
      nav.appendChild(a);
    });
    const c = document.createElement("p");
    c.textContent = "© " + new Date().getFullYear() + " " + (B.company || "Pixel Broadcasting Company") + " · An independent pixel-art channel. The cast is fictional; the news and games they cover are real.";
    f.append(nav, c);
    const page = document.querySelector(".pbc-page");
    if (page) page.after(f); else document.body.appendChild(f);
  }
  let analyticsOn = false;
  function analytics(){
    const a = (window.PBC_BUSINESS || {}).analytics || {};
    if (analyticsOn || !/^https:\/\//.test(a.src || "")) return;
    analyticsOn = true;
    const s = document.createElement("script"); s.async = true; s.src = a.src;
    Object.entries(a.attrs || {}).forEach(([k, v]) => s.setAttribute(k, v));
    document.head.appendChild(s);
  }
  function business(){
    if (window.PBC_BUSINESS) { siteFooter(); analytics(); return; }
    const s = document.createElement("script"); s.src = root + "shared/business.js";
    s.onload = () => { const old = document.querySelector(".pbc-sitefoot"); if (old) old.remove(); siteFooter(); analytics(); };
    document.head.appendChild(s);
    siteFooter();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", business); else business();

  // Fractions: the text keeps ⅓ (screen readers, copy and paste and search engines read it), wrapped as
  // <span class="pbc-frac" data-n="1" data-d="3"><span>⅓</span></span>; pbc.css hides the character and draws
  // 1/3 from data-n and data-d in VT323, like every other number.
  const FRACS = {"⅛": "1/8", "¼": "1/4", "⅓": "1/3", "½": "1/2", "⅔": "2/3", "¾": "3/4"}, FRAC_RE = /[⅛¼⅓½⅔¾]/;
  const SKIP = /^(SCRIPT|STYLE|TEXTAREA|OPTION|SELECT|TITLE|svg|text|tspan)$/;
  function fracSpan(ch){
    const [n, d] = FRACS[ch].split("/"), s = document.createElement("span"), c = document.createElement("span");
    s.className = "pbc-frac"; s.dataset.n = n; s.dataset.d = d; c.textContent = ch; s.appendChild(c);
    return s;
  }
  function fractions(el){
    if (!el || (el.nodeType === 1 && (SKIP.test(el.nodeName) || el.closest(".pbc-frac,svg")))) return;
    if (el.nodeType === 3) {
      const p = el.parentNode;
      if (!p || !FRAC_RE.test(el.nodeValue) || SKIP.test(p.nodeName) || (p.closest && p.closest(".pbc-frac,svg"))) return;
      const out = document.createDocumentFragment();
      for (const part of el.nodeValue.split(/([⅛¼⅓½⅔¾])/)) if (part) out.appendChild(FRACS[part] ? fracSpan(part) : document.createTextNode(part));
      p.replaceChild(out, el);
      return;
    }
    if (el.nodeType !== 1 && el.nodeType !== 9 && el.nodeType !== 11) return;
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), hits = [];
    for (let t = w.nextNode(); t; t = w.nextNode()) if (FRAC_RE.test(t.nodeValue)) hits.push(t);
    hits.forEach(fractions);
  }
  function watchFractions(){
    fractions(document.body);
    new MutationObserver(list => {
      for (const m of list) {
        if (m.type === "characterData") fractions(m.target);
        else m.addedNodes.forEach(fractions);
      }
    }).observe(document.body, {childList: true, subtree: true, characterData: true});
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watchFractions); else watchFractions();

  return { sound, voices, fullScreen, root, fractions };
})();
