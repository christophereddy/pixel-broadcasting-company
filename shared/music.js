/* Pixel Broadcasting Company: the newsroom's music, all made live with WebAudio like the voice blips (no audio files).
   PBCMusic.enable(ac, mode)   Called from the SOUND button's tap with the page's AudioContext and the new mode
                               (off / blips / voices). Music plays whenever sound is on, and the choice is remembered.
   PBCMusic.cue(seg, scene, first)  Called when a new beat airs: the theme at the top of the news, a short sting when
                               the segment changes, and a soft bed under the commercial break.
   PBCMusic.duck(on)           True while a voice is reading, so the music always sits under the voices.
   PBCMusic.tuneIn(screen, snd)  First visit: a one-tap TUNE IN over the broadcast that turns on voices and music
                               (iPhone only plays sound that starts inside a tap). Later visits skip the prompt and
                               bring back the last sound choice on the first tap anywhere on the page.
   News only: the sports page doesn't load this file. */
window.PBCMusic = (function(){
  "use strict";
  const KEY = "pbc-sound";
  let ac = null, out = null, duckGain = null, on = false, lastSeg = "", bed = null;
  const live = new Set();
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  const store = v => { try { localStorage.setItem(KEY, v); } catch (e) {} };
  const stored = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };

  function graph(){
    if (out || !ac) return;
    duckGain = ac.createGain(); duckGain.gain.value = 1; duckGain.connect(ac.destination);
    out = ac.createGain(); out.gain.value = 1; out.connect(duckGain);
  }
  // One chiptune note: square for the tune, triangle for the bass, with a short attack and decay.
  function note(type, m, t, len, vol, dest){
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = hz(m);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.setValueAtTime(vol, t + Math.max(0.02, len * 0.55));
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(dest || out); o.start(t); o.stop(t + len + 0.02);
    live.add(o); o.onended = () => live.delete(o);
  }
  let noiseBuf = null;
  function hit(t, len, vol, cut, dest){
    if (!noiseBuf) { noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.3, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; f.type = "highpass"; f.frequency.value = cut;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    s.connect(f).connect(g).connect(dest || out); s.start(t); s.stop(t + len + 0.02);
    live.add(s); s.onended = () => live.delete(s);
  }
  // Plays [midi or null, length in steps] pairs one after another.
  function line(seq, t, step, type, vol, gap){
    seq.forEach(([m, n]) => { if (m != null) note(type, m, t, n * step * (gap || 0.9), vol); t += n * step; });
    return t;
  }

  /* Theme: about six seconds in C major at 150 bpm. A rising fanfare, a call and answer, then a held high C. */
  const THEME_LEAD = [[67,1],[72,1],[76,1],[79,2],[76,1],[79,2], [81,1],[79,1],[76,1],[72,1],[74,2],[79,2],
                      [77,1],[76,1],[74,1],[72,1],[74,1],[76,1],[79,2], [84,6]];
  const THEME_BASS = [[48,2],[48,2],[43,2],[43,2], [45,2],[45,2],[40,2],[40,2], [41,2],[41,2],[43,2],[43,2], [48,6]];
  function theme(){
    const t = ac.currentTime + 0.05, e = 0.2;
    line(THEME_LEAD, t, e, "square", 0.05);
    line(THEME_BASS, t, e, "triangle", 0.09);
    [76, 79].forEach(m => note("square", m, t + 24 * e, 6 * e, 0.025)); // the last chord under the high C
    for (let i = 0; i < 24; i++) hit(t + i * e, i % 4 === 2 ? 0.12 : 0.03, i % 4 === 2 ? 0.05 : 0.02, i % 4 === 2 ? 1500 : 7000);
    hit(t + 24 * e, 0.6, 0.05, 3000);
  }

  /* Sting: half a second between segments, two versions taking turns so it doesn't wear thin. */
  let stingN = 0;
  function sting(){
    const t = ac.currentTime + 0.03, e = 0.07;
    const v = stingN++ % 2 ? [[79,1],[76,1],[79,1],[84,4]] : [[72,1],[76,1],[79,1],[84,4]];
    line(v, t, e, "square", 0.04);
    note("triangle", 48, t + 3 * e, 0.35, 0.08);
    hit(t + 3 * e, 0.2, 0.03, 4000);
  }

  /* Break bed: a slow, quiet arpeggio (C, Am, F, G at 90 bpm) that loops for as long as the commercial break runs. */
  const BED = [[48,52,55,60],[45,48,52,57],[41,45,48,53],[43,47,50,55]];
  function bedStart(){
    if (bed) return;
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.6, ac.currentTime + 1.2); g.connect(out);
    bed = { g, next: ac.currentTime + 0.1, bar: 0, timer: 0 };
    const beat = 60 / 90, step = beat / 2;
    const fill = () => {
      while (bed && bed.next < ac.currentTime + 1.5) {
        const ch = BED[bed.bar % BED.length], t = bed.next;
        [0, 1, 2, 3, 2, 1, 2, 3].forEach((k, i) => note("triangle", ch[k] + 12, t + i * step, step * 0.95, 0.05, g));
        note("triangle", ch[0], t, beat * 1.8, 0.06, g); note("triangle", ch[0], t + 2 * beat, beat * 1.8, 0.05, g);
        bed.next += 4 * beat; bed.bar++;
      }
    };
    fill(); bed.timer = setInterval(fill, 250);
  }
  function bedStop(){
    if (!bed) return;
    const b = bed; bed = null; clearInterval(b.timer);
    const t = ac.currentTime; b.g.gain.cancelScheduledValues(t); b.g.gain.setValueAtTime(Math.max(0.0001, b.g.gain.value), t); b.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    setTimeout(() => b.g.disconnect(), 1500);
  }
  function hush(){
    bedStop();
    live.forEach(n => { try { n.stop(); } catch (e) {} }); live.clear();
  }

  let cur = null;
  function enable(context, mode){
    store(mode);
    ac = context; on = !!ac && mode !== "off";
    if (!ac) return;
    graph();
    if (!on) { hush(); return; }
    if (cur && cur.scene === "ads") bedStart(); // turned on mid-break: bring the bed in, no sting
  }
  function cue(seg, scene, first){
    const prev = lastSeg; lastSeg = seg; cur = { seg, scene };
    if (!on || !ac) return;
    if (scene === "ads") { bedStart(); return; }
    bedStop();
    if (first && seg === "Top of the news") theme();
    else if (prev && seg !== prev) sting();
  }
  let ducked = false;
  function duck(v){
    v = !!v; if (v === ducked || !duckGain) return; ducked = v;
    const t = ac.currentTime; duckGain.gain.cancelScheduledValues(t);
    duckGain.gain.setValueAtTime(duckGain.gain.value, t); duckGain.gain.linearRampToValueAtTime(v ? 0.35 : 1, t + (v ? 0.15 : 0.6));
  }

  function tuneIn(screen, snd){
    const best = () => ("speechSynthesis" in window) ? "voices" : "blips";
    const was = stored();
    if (was) {
      // Been here before: no prompt. Their last choice comes back on the first tap anywhere (browsers need a tap first).
      if (was === "off") return;
      const evs = ["click", "touchend", "keydown"];
      const back = e => {
        evs.forEach(t => document.removeEventListener(t, back, true));
        if (snd.mode !== "off" || (e.target && e.target.closest && e.target.closest("#snd"))) return;
        snd.set(was === "blips" ? "blips" : best());
      };
      evs.forEach(t => document.addEventListener(t, back, true));
      return;
    }
    const css = document.createElement("style");
    css.textContent =
      ".tunein{position:absolute;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;background:var(--scrim)}" +
      ".tunein .box{display:flex;flex-direction:column;align-items:center;gap:1.4cqw;background:var(--panel);border:.5cqw solid var(--gold);box-shadow:.8cqw .8cqw 0 var(--navy);padding:2.6cqw 4cqw 2cqw}" +
      ".tunein .go{font-family:var(--f-label);font-size:4cqw;letter-spacing:.06em;background:var(--gold);color:var(--navy);border:0;padding:.55em 1.1em;cursor:pointer;box-shadow:.5cqw .5cqw 0 var(--navy)}" +
      ".tunein .go:hover{background:var(--gold-hi)}.tunein .go:focus-visible,.tunein .no:focus-visible{outline:.4cqw solid var(--white);outline-offset:.4cqw}" +
      ".tunein .what{margin:0;color:var(--text);font-family:var(--f-body);font-size:2.6cqw}" +
      ".tunein .no{all:unset;cursor:pointer;color:var(--muted);font-family:var(--f-body);font-size:2.3cqw;text-decoration:underline;text-underline-offset:.2em}" +
      ".tunein .no:hover{color:var(--text)}" +
      "@container (max-width:600px){.tunein .go{font-size:6cqw}.tunein .what{font-size:4.2cqw}.tunein .no{font-size:4cqw}}";
    document.head.appendChild(css);
    const wrap = document.createElement("div"); wrap.className = "tunein"; wrap.setAttribute("role", "dialog"); wrap.setAttribute("aria-label", "Tune in");
    const box = document.createElement("div"); box.className = "box";
    const go = document.createElement("button"); go.type = "button"; go.className = "go"; go.textContent = "▶ TUNE IN";
    const what = document.createElement("p"); what.className = "what"; what.textContent = "Turns on the cast's voices and the PBC theme music.";
    const no = document.createElement("button"); no.type = "button"; no.className = "no"; no.textContent = "Watch without sound";
    box.append(go, what, no); wrap.appendChild(box); screen.appendChild(wrap);
    const close = () => wrap.remove();
    go.addEventListener("click", () => { close(); snd.set(best()); });
    no.addEventListener("click", () => { close(); store("off"); });
    // Using the SOUND button instead counts as an answer too.
    document.getElementById("snd").addEventListener("click", close);
  }

  return { enable, cue, duck, tuneIn };
})();
