/* Marketing Division office.
   The newsroom's black cat naps in the intro card. Now and then it wakes to stretch or wash, and if the mouse comes
   close it sits up and swipes at it (a tap does the same on a phone).
   Dot Delgado, head of sales, answers the questions listed in the page (#faqList). The answers are fixed text in the
   page; nothing a visitor clicks is sent anywhere. */
(function(){
"use strict";
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const K = "#121218", H2 = "#2c2c3a", EYE = "#f2d14a";

/* ---------- the cat ---------- */
const cat = document.getElementById("cat");
if (cat) {
  const c = cat.getContext("2d");
  const W = cat.width, H = cat.height, X0 = 10, Y0 = H - 4;   // cat's left edge and the cushion's top
  let mode = "sleep", until = 0, dir = 1, near = false, lastNear = 0;
  // An idle routine between naps: wake, stretch, sit, wash, sit, back to sleep.
  const ROUTINE = [["sit", 1800], ["stretch", 2200], ["sit", 2600], ["groom", 3200], ["sit", 1800]];
  let step = -1, nextWake = performance.now() + 18000 + Math.random() * 20000;

  const R = (col, x, y, w, h) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  // f() draws a part of the cat facing dir: dx/dy are from the cat's back-left corner, mirrored when facing left.
  const f = (dx, dy, w, h, col) => R(col, dir > 0 ? X0 + dx : X0 + 16 - dx - w, Y0 + dy, w, h);
  const Z = (x, y, col) => { R(col, x, y, 3, 1); R(col, x + 2, y + 1, 1, 1); R(col, x + 1, y + 2, 1, 1); R(col, x, y + 3, 1, 1); R(col, x, y + 4, 3, 1); };

  function sitBody(t){
    f(4, -8, 6, 8, K); f(5, -8, 3, 1, H2);
    f(5, -12, 5, 4, K); f(5, -13, 1, 1, K); f(9, -13, 1, 1, K);
    const blink = (t % 4200) < 140;
    if (!blink) { f(6, -11, 1, 1, EYE); f(8, -11, 1, 1, EYE); }
    const sw = Math.floor(t / 700) % 3;
    f(0 + sw % 2, -1, 5, 1, K); f(0, -3 + (sw === 2 ? -1 : 0), 1, 2, K);
  }

  function draw(t){
    c.clearRect(0, 0, W, H);
    // cushion
    R("#7a2a3a", X0 - 4, Y0 - 1, 24, 2); R("#9c3a4c", X0 - 5, Y0 + 1, 26, 2); R("#5e1f2c", X0 - 4, Y0 + 3, 24, 1);
    if (mode === "sleep") {
      const br = reduce ? 0 : Math.floor(t / 1400) % 2;
      R(K, X0 + 1, Y0 - 5 - br, 13, 4 + br); R(H2, X0 + 3, Y0 - 5 - br, 6, 1);
      R(K, X0 + 10, Y0 - 7 - br, 4, 3); R(K, X0 + 10, Y0 - 8 - br, 1, 1); R(K, X0 + 13, Y0 - 8 - br, 1, 1);
      R(K, X0, Y0 - 2, 4, 1);
      if (!reduce) { const z = Math.floor(t / 900) % 4; if (z < 3) Z(X0 + 16 + z, Y0 - 12 - z * 3, "#9fb2ff"); }
    } else if (mode === "stretch") {
      f(1, -7, 9, 3, K); f(2, -7, 5, 1, H2);            // body, rear up
      f(1, -4, 1, 4, K); f(4, -4, 1, 4, K);              // back legs
      f(9, -4, 6, 2, K); f(15, -2, 1, 1, K);             // front legs reaching forward
      f(10, -7, 4, 4, K); f(10, -8, 1, 1, K); f(13, -8, 1, 1, K);
      f(12, -6, 1, 1, H2);                               // eyes squeezed shut
      f(0, -12, 1, 5, K); f(-1, -13, 1, 1, K);            // tail up
    } else if (mode === "groom") {
      f(4, -8, 6, 8, K); f(5, -8, 3, 1, H2);
      f(6, -11, 5, 4, K); f(6, -12, 1, 1, K); f(10, -12, 1, 1, K);   // head tipped down
      f(7, -9, 2, 1, H2);                                // eyes closed
      const lick = Math.floor(t / 260) % 2;
      f(9, -9 - lick, 2, 4, K); f(11, -10 - lick, 1, 1, "#e58a9a");   // paw up to the mouth, tongue
      f(0, -1, 5, 1, K);
    } else {
      sitBody(t);
      if (mode === "swipe") {
        const out = Math.floor(t / 150) % 2;
        if (out) { f(10, -8, 5, 1, K); f(15, -9, 1, 1, K); f(15, -7, 1, 1, K); f(16, -8, 1, 1, "#eceefa"); }
        else { f(10, -10, 2, 1, K); f(11, -11, 2, 1, K); }
        f(7, -10, 1, 1, "#e58a9a");                      // little open mouth
      } else if (mode === "alert") {
        f(5, -14, 1, 1, K); f(9, -14, 1, 1, K);           // ears up
      }
    }
  }

  function setMode(m, ms, now){ mode = m; until = ms ? now + ms : 0; }
  function tick(now){
    if (near) setMode(mode === "swipe" || Math.random() < .5 ? "swipe" : "alert", 0, now);
    else if ((mode === "swipe" || mode === "alert") && now - lastNear > 2500) { step = -1; setMode("sit", 1500, now); nextWake = now + 1500; }
    else if (mode === "sleep" && now > nextWake) { step = 0; setMode(ROUTINE[0][0], ROUTINE[0][1], now); }
    else if (until && now > until) {
      step++;
      if (step >= 0 && step < ROUTINE.length) setMode(ROUTINE[step][0], ROUTINE[step][1], now);
      else { step = -1; setMode("sleep", 0, now); nextWake = now + 25000 + Math.random() * 30000; }
    }
    draw(now);
    requestAnimationFrame(tick);
  }

  // The cat notices a pointer within about 160px of it, and swipes when it's within 100px.
  document.addEventListener("pointermove", e => {
    if (e.pointerType === "touch") return;
    const r = cat.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height * .6;
    const d = Math.hypot(e.clientX - cx, e.clientY - cy);
    if (d < 160) {
      dir = e.clientX >= cx ? 1 : -1; lastNear = performance.now();
      if (d < 100) { near = true; mode = "swipe"; } else { near = false; if (mode !== "swipe") mode = "alert"; }
    } else near = false;
  }, { passive: true });
  cat.addEventListener("pointerdown", e => {
    const r = cat.getBoundingClientRect(); dir = e.clientX >= r.left + r.width / 2 ? 1 : -1;
    lastNear = performance.now(); mode = "swipe";
  });
  requestAnimationFrame(tick);
}

/* ---------- Dot Delgado, head of sales ---------- */
const rep = document.getElementById("rep"), list = document.getElementById("faqList");
if (rep && list) {
  const c = rep.getContext("2d"), W = rep.width, H = rep.height;
  const DOT = { skin: "#b97a52", hair: "#1c1418", style: "bob", coat: "#c2417a", shirt: "#f6eef2", pants: "#2a2230", glasses: true, earring: "#f2b632" };
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, k) => { const A = hex(a), B = hex(b); return "#" + A.map((x, i) => Math.round(x + (B[i] - x) * k).toString(16).padStart(2, "0")).join(""); };
  const R = (col, x, y, w, h) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  // 3x5 pixel letters, the same font as the newsroom's signs
  const F = { S:"011100010001110", A:"010101111101101", L:"100100100100111", E:"111100110100111", P:"110101110100100", B:"110101110101110", C:"011100100100011", " ":"000000000000000" };
  const txt = (s, x, y, col) => { c.fillStyle = col; [...s].forEach((ch, i) => { const m = F[ch] || F[" "]; for (let k = 0; k < 15; k++) if (m[k] === "1") c.fillRect(x + i * 4 + k % 3, y + Math.floor(k / 3), 1, 1); }); };

  // The same pixel person the newsroom cast is drawn with (index.html, person()), trimmed to what Dot needs.
  function person(look, x, y, s, st){
    const r = (col, px, py, w, h) => { c.fillStyle = col; c.fillRect(x + px * s, y + py * s, w * s, h * s); };
    const Y = st.bob ? -1 : 0, h = look.hair;
    r(look.coat, 1, 12, 12, 10); r(mix(look.coat, "#000000", .25), 1, 12, 1, 10);
    r(look.shirt, 5, 12, 4, 2); r(look.shirt, 6, 14, 2, 1);
    r(look.coat, 0, 13, 1, 8); r(look.skin, 0, 21, 1, 1);
    if (st.point) { r(look.coat, 13, 12, 6, 2); r(look.skin, 19, 12, 2, 2); }
    else { r(look.coat, 13, 13, 1, 8); r(look.skin, 13, 21, 1, 1); }
    r(look.skin, 6, 10, 2, 2);
    r(h, 2, 2 + Y, 10, 8);
    r(look.skin, 3, 2 + Y, 8, 9); r(look.skin, 2, 5 + Y, 1, 2); r(look.skin, 11, 5 + Y, 1, 2);
    r(mix(look.skin, "#000000", .12), 3, 10 + Y, 8, 1);
    if (!st.blink) { r("#1b1b25", 5, 5 + Y, 1, 1); r("#1b1b25", 8, 5 + Y, 1, 1); }
    else { r(mix(look.skin, "#000000", .3), 5, 5 + Y, 1, 1); r(mix(look.skin, "#000000", .3), 8, 5 + Y, 1, 1); }
    const fr = "#3a3440"; r(fr, 4, 4 + Y, 2, 1); r(fr, 8, 4 + Y, 2, 1); r(fr, 4, 5 + Y, 1, 1); r(fr, 6, 5 + Y, 2, 1); r(fr, 9, 5 + Y, 1, 1); r(fr, 4, 6 + Y, 2, 1); r(fr, 8, 6 + Y, 2, 1);
    r(look.earring, 2, 8 + Y, 1, 1); r(look.earring, 11, 8 + Y, 1, 1);
    r(h, 3, 1 + Y, 8, 2); r(h, 3, 3 + Y, 8, 1); r(h, 2, 2 + Y, 1, 8); r(h, 11, 2 + Y, 1, 8);
    if (st.open) r("#4a1418", 6, 8 + Y, 2, 2); else r(mix(look.skin, "#5a1a1a", .55), 6, 8 + Y, 2, 1);
  }

  let talking = false, talkEnd = 0;
  function draw(t){
    // office wall, window with the city at night, a framed PBC poster
    R("#1a1f45", 0, 0, W, H); for (let x = 0; x < W; x += 12) R("#1f2552", x, 0, 1, H);
    R("#0b0e24", 74, 6, 40, 30); R("#2c3364", 74, 6, 40, 1); R("#2c3364", 93, 6, 1, 30);
    [[76, 22, 6, 14], [83, 16, 5, 20], [89, 26, 4, 10], [95, 18, 7, 18], [103, 12, 5, 24], [109, 24, 5, 12]].forEach(([x, y, w, h], i) => {
      R("#262c5a", x, y, w, h);
      for (let wy = y + 2; wy < 34; wy += 3) for (let wx = x + 1; wx < x + w - 1; wx += 2) if ((wx * 7 + wy * 3 + i) % 5 === 0) R("#f2d14a", wx, wy, 1, 1);
    });
    R("#f2b632", 8, 8, 16, 12); R("#1d2766", 9, 9, 14, 10); txt("PBC", 10, 11, "#f2b632");
    // Dot, seated behind the desk
    const blink = (t % 3900) < 130;
    const open = talking && ((Math.floor(t / 105) * 7) % 5) > 1;
    const bob = talking && Math.floor(t / 900) % 3 === 0;
    person(DOT, 32, 12, 2, { blink, open, bob, point: talking && !reduce });
    // desk
    R("#e3e7f0", 0, 50, W, 2); R("#6b4a2b", 0, 52, W, 20); R("#8a6239", 0, 52, W, 2);
    R("#f2b632", 38, 58, 23, 9); txt("SALES", 40, 60, "#1d2766");
    R("#eceefa", 14, 45, 6, 5); R("#eceefa", 20, 46, 2, 3); R("#9ba3cc", 15, 46, 4, 1);   // mug
    R("#1b1b25", 82, 46, 12, 4); R("#2c2c3a", 83, 44, 10, 2);                              // phone
    R("#f4f5fb", 100, 47, 12, 3); R("#f2b632", 101, 46, 10, 1);                          // stack of forms
  }
  function loop(t){ if (talking && t > talkEnd) talking = false; draw(t); requestAnimationFrame(loop); }

  // Build a button per question from the page's own list, then show the desk instead of the list.
  const bubble = document.getElementById("bubble"), asks = document.getElementById("asks");
  const dts = [...list.querySelectorAll("dt")];
  let typing = 0;
  function answer(dd, btn){
    asks.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b === btn ? "true" : "false"));
    clearInterval(typing);
    const full = dd.textContent, ms = reduce ? 0 : 22;
    talking = true; talkEnd = performance.now() + full.length * ms + 400;
    if (!ms) { bubble.replaceChildren(...[...dd.childNodes].map(n => n.cloneNode(true))); return; }
    let i = 0; bubble.textContent = "";
    typing = setInterval(() => {
      i += 2; bubble.textContent = full.slice(0, i);
      if (i >= full.length) { clearInterval(typing); bubble.replaceChildren(...[...dd.childNodes].map(n => n.cloneNode(true))); }
    }, ms * 2);
  }
  dts.forEach(dt => {
    const dd = dt.nextElementSibling, b = document.createElement("button");
    b.type = "button"; b.className = "co-ask"; b.textContent = dt.textContent; b.setAttribute("aria-pressed", "false");
    b.addEventListener("click", () => answer(dd, b));
    asks.appendChild(b);
  });
  list.hidden = true;
  document.getElementById("repDesk").hidden = false;
  requestAnimationFrame(loop);
}
})();
