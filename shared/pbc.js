/* Pixel Broadcasting Company: behavior News and Sports share (see pbc.css for the look).
   PBC.sound(onChange)   SOUND button (#snd) cycling OFF, BLIPS, VOICES. Calls onChange(mode) inside the tap,
                         which iPhone needs before it will play audio or speech.
   PBC.voices()          Usable English speech voices: on-device ones first, no Apple novelty voices.
   PBC.fullScreen(el)    FULL SCREEN button (#fs) for the broadcast element. */
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

  return { sound, voices, fullScreen };
})();
