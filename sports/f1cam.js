/* Pixel Sports Live: the F1 onboard chase camera.
   A Mode 7 floor (the old racing-game trick: every screen row below the horizon samples the circuit map at one
   distance), the cars as sprites seen from behind, a minimap in the upper right and the timing tower on the left.
   Everything on screen comes from the replay model in f1.js: real lap and sector times put each car on the real
   circuit shape. Loaded after f1.js; it only defines functions. */

const F1C = {hor: 100, h: 6, f: 200, back: 10, tw: 14, far: 700, carW: 3.2};

/* ---- the circuit as a map the camera can fly over ---- */
// one byte per map pixel: 0 grass, 1 run-off, 2 kerb, 3 asphalt, 4 white edge line
function f1World(tr){
  if (tr.world) return tr.world;
  let s = F1C.tw / (tr.len / 400);
  const xs = tr.raw.map(p => p[0]), ys = tr.raw.map(p => p[1]), m = 90;
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  if (span * s + 2 * m > 2600) s = (2600 - 2 * m) / span;
  const tw = s * tr.len / 400;
  const ox = m - Math.min(...xs) * s, oy = m - Math.min(...ys) * s;
  const Wd = Math.ceil((Math.max(...xs) - Math.min(...xs)) * s + 2 * m), Hd = Math.ceil((Math.max(...ys) - Math.min(...ys)) * s + 2 * m);
  const pts = tr.raw.map(([x, y]) => [x * s + ox, y * s + oy]), cum = tr.cum.map(c => c * s);
  const w = {s, tw, Wd, Hd, pts, cum, len: cum.at(-1)};
  // each layer goes into its own colour channel, so soft stroke edges can't blend into a wrong surface
  const c = document.createElement('canvas'); c.width = Wd; c.height = Hd; const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, Wd, Hd); g.globalCompositeOperation = 'lighter'; g.lineJoin = g.lineCap = 'round';
  const path = (from = 0, to = 1) => { g.beginPath(); for (let f = from, k = 0; f <= to + 1e-9; f += 0.0015, k++) { const [x, y] = f1WAt(w, f); k ? g.lineTo(x, y) : g.moveTo(x, y); } };
  g.strokeStyle = '#00ff00'; g.lineWidth = tw * 2.3; path(); g.stroke();
  // kerbs on the bends
  g.strokeStyle = '#0000ff'; g.lineWidth = tw * 1.3;
  for (let f = 0; f < 1; f += 0.003) {
    const [, , a] = f1WAt(w, f - 0.004, true), [, , b] = f1WAt(w, f + 0.004, true); let t = Math.abs(b - a); if (t > Math.PI) t = 2 * Math.PI - t;
    if (t > 0.12) { path(f - 0.002, f + 0.002); g.stroke(); }
  }
  g.strokeStyle = '#ff0000'; g.lineWidth = tw; path(); g.stroke();
  // the pit lane, inside the main straight
  g.lineWidth = tw * 0.45; g.beginPath();
  for (let f = -0.035, k = 0; f <= 0.035; f += 0.001, k++) { const [x, y] = f1WSide(w, f, -tw * 1.15); k ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
  const px = g.getImageData(0, 0, Wd, Hd).data, M = new Uint8Array(Wd * Hd);
  for (let i = 0, j = 0; i < M.length; i++, j += 4) M[i] = px[j] >= 128 ? 3 : px[j + 2] >= 128 ? 2 : px[j + 1] >= 128 ? 1 : 0;
  for (let y = 1; y < Hd - 1; y++) for (let x = 1; x < Wd - 1; x++) { const i = y * Wd + x; if (M[i] === 3 && (M[i - 1] < 3 && M[i - 1] !== 4 || M[i + 1] < 3 && M[i + 1] !== 4 || M[i - Wd] < 3 && M[i - Wd] !== 4 || M[i + Wd] < 3 && M[i + Wd] !== 4)) M[i] = 4; }
  w.M = M;
  const [sx, sy, sa] = f1WAt(w, 0, true); w.start = {x: sx, y: sy, ca: Math.cos(sa), sa: Math.sin(sa)};
  return tr.world = w;
}
// a point on the racing line, f in laps; with ang, the direction of travel as the third value
function f1WAt(w, f, ang){
  f = ((f % 1) + 1) % 1; const want = f * w.len, c = w.cum;
  let lo = 0, hi = c.length - 1; while (lo < hi - 1) { const m = (lo + hi) >> 1; if (c[m] <= want) lo = m; else hi = m; }
  const u = (want - c[lo]) / ((c[hi] - c[lo]) || 1), a = w.pts[lo], b = w.pts[hi];
  const x = a[0] + (b[0] - a[0]) * u, y = a[1] + (b[1] - a[1]) * u;
  return ang ? [x, y, Math.atan2(b[1] - a[1], b[0] - a[0])] : [x, y];
}
// sideways from the racing line: positive is to the driver's right
function f1WSide(w, f, by){
  const [x, y] = f1WAt(w, f), [ax, ay] = f1WAt(w, f - 0.002), [bx, by2] = f1WAt(w, f + 0.002), a = Math.atan2(by2 - ay, bx - ax);
  return [x - Math.sin(a) * by, y + Math.cos(a) * by];
}

/* ---- the scenery: sky and far hills that turn with the camera, and the trackside sprites ---- */
function f1Scenery(){
  const S2 = S.f1; if (S2.sky) return S2.sky;
  const len = Math.round(2 * Math.PI * F1C.f), c = document.createElement('canvas'); c.width = len; c.height = F1C.hor; const g = c.getContext('2d');
  const sky = ['#3d7dd8', '#4d8fe0', '#5fa2e8', '#76b5ee', '#8fc6f2', '#a9d6f5'];
  sky.forEach((col, i) => { g.fillStyle = col; g.fillRect(0, Math.round(i * F1C.hor / sky.length), len, Math.ceil(F1C.hor / sky.length)); });
  const rnd = mulberry(11);
  // clouds
  for (let k = 0; k < 9; k++) { const x = rnd() * len, y = 8 + rnd() * 34, n = 3 + (rnd() * 4 | 0); g.fillStyle = '#eef6fb'; for (let i = 0; i < n; i++) g.fillRect(Math.round(x + i * 7), Math.round(y - (i % 2) * 3), 12, 5); }
  // far hills, then near hills with trees, then the city and grandstands on the horizon
  const ridge = (col, base, amp, per, seed) => { const r = mulberry(seed); g.fillStyle = col; const ph = r() * 9; for (let x = 0; x < len; x++) { const hgt = base + amp * (Math.sin(x / per * 2 * Math.PI + ph) * 0.6 + Math.sin(x / (per * 0.37) * 2 * Math.PI) * 0.4); g.fillRect(x, F1C.hor - hgt, 1, hgt); } };
  ridge('#7e9fb8', 22, 9, len / 5, 3); ridge('#4f8a52', 12, 6, len / 9, 5);
  for (let k = 0; k < 40; k++) { const x = Math.round(rnd() * len), hgt = 4 + (rnd() * 6 | 0); g.fillStyle = '#2f6a3a'; g.fillRect(x - 2, F1C.hor - 10 - hgt, 5, hgt); }
  for (let k = 0; k < 6; k++) {
    const x = Math.round(rnd() * len); g.fillStyle = '#5b6380';
    for (let b = 0; b < 6; b++) { const bh = 8 + (rnd() * 18 | 0); g.fillRect(x + b * 7, F1C.hor - 6 - bh, 6, bh + 6); g.fillStyle = '#e8d27a'; for (let wy = F1C.hor - bh; wy < F1C.hor - 6; wy += 4) if (rnd() < 0.5) g.fillRect(x + b * 7 + 2, wy, 1, 1); g.fillStyle = '#5b6380'; }
  }
  g.fillStyle = '#3c7a42'; g.fillRect(0, F1C.hor - 3, len, 3);
  return S2.sky = c;
}
// trackside sponsor boards and the main grandstand, as small canvases the camera scales
function f1Props(w){
  if (S.f1.props?.w === w && S.f1.props.n === S.cutN) return S.f1.props.list;
  const list = [];
  for (let k = 0; k < 12; k++) {
    const c = document.createElement('canvas'); c.width = 64; c.height = 11; const ad = adFitting(k * 2 + 1, 64);
    adBoard(c.getContext('2d'), 0, 0, 64, 11, ad);
    const f = (k + 0.5) / 12, side = k % 2 ? 1 : -1;
    list.push({kind: 'board', img: c, f, side, ww: 18, wh: 3.1, lift: 0.9});
  }
  const gs = document.createElement('canvas'); gs.width = 90; gs.height = 26; const g = gs.getContext('2d'), r = mulberry(4);
  g.fillStyle = '#39405e'; g.fillRect(0, 4, 90, 22); g.fillStyle = '#c0392b'; g.fillRect(0, 0, 90, 5);
  for (let y = 7; y < 25; y += 3) for (let x = 2; x < 88; x += 2) { g.fillStyle = ['#e9e4cf', '#c0392b', '#f2b632', '#5aa9e6', '#2b2f45'][r() * 5 | 0]; g.fillRect(x, y, 1, 2); }
  list.push({kind: 'stand', img: gs, f: 0.012, side: 1, ww: 34, wh: 10, lift: 0, off: 2.2});
  list.push({kind: 'stand', img: gs, f: 0.04, side: 1, ww: 34, wh: 10, lift: 0, off: 2.2});
  S.f1.props = {w, n: S.cutN, list}; return list;
}

/* ---- where every car is in the world ---- */
const f1Lane = num => ((num * 7) % 5 - 2) * 0.17;
function f1CarSpots(R, w){
  const out = [], lat = S.f1.lat || (S.f1.lat = new Map()), typ = 95000;
  for (const [i, o] of (R.order || []).entries()) {
    const d = o.d; let f, side, parked = false;
    if (o.grid) { const g0 = (d.grid || i + 1) - 1; f = -0.0016 - g0 * 0.0013; side = g0 % 2 ? 0.2 : -0.2; }
    else {
      f = o.p;
      if (o.fin) f = o.p + Math.min(0.5, (R.clock - o.at) / (typ * 1.6));   // the slowing-down lap after the flag
      side = f1Lane(d.num);
      if (o.out) { side = 1.05; parked = true; }
      else if (f1Pitting(d, R.clock)) side = -1.15;
    }
    const cur = lat.get(d.num); const s = cur == null || o.grid ? side : cur + (side - cur) * 0.05; lat.set(d.num, s);
    const [x, y] = f1WSide(w, f, s * w.tw);
    out.push({o, d, f, x, y, pos: i + 1, parked});
  }
  return out;
}
// the car the camera rides with: the viewer's pick, else the race winner, else the leader
function f1CamCar(R){
  const want = S.f1.cam ?? R.win?.driver_number;
  const o = (R.order || []).find(r => r.d.num === want && !r.out) || (R.order || []).find(r => r.d.num === R.win?.driver_number && !r.out) || R.order?.[0];
  return o?.d.num;
}

/* ---- drawing ---- */
const F1PAL = {grass: [[0x2f, 0x8a, 0x3b], [0x3a, 0x9c, 0x45]], run: [[0xd6, 0xc4, 0x93], [0xcc, 0xb8, 0x86]], kerb: [[0xd8, 0x28, 0x2f], [0xf2, 0xf0, 0xe8]],
  asph: [[0x55, 0x58, 0x63], [0x4f, 0x52, 0x5d]], edge: [[0xee, 0xee, 0xe8], [0xee, 0xee, 0xe8]], fog: [0xa9, 0xd6, 0xf5]};
function f1Floor(w, cx, cy, th){
  const hor = F1C.hor, rows = H - hor;
  if (!S.f1.img || S.f1.img.height !== rows) { S.f1.img = ctx.createImageData(W, rows); S.f1.px = new Uint32Array(S.f1.img.data.buffer); }
  const px = S.f1.px, M = w.M, Wd = w.Wd, Hd = w.Hd, fx = Math.cos(th), fy = Math.sin(th), rx = -fy, ry = fx;
  const pack = (c, k) => { const r = c[0] + (F1PAL.fog[0] - c[0]) * k, g = c[1] + (F1PAL.fog[1] - c[1]) * k, b = c[2] + (F1PAL.fog[2] - c[2]) * k; return 0xff000000 | (b << 16) | (g << 8) | r; };
  const pal = new Uint32Array(10), sx0 = w.start.x, sy0 = w.start.y, sca = w.start.ca, ssa = w.start.sa;
  for (let row = 0; row < rows; row++) {
    const z = F1C.h * F1C.f / (row + 0.5), fog = Math.min(1, Math.max(0, (z - 120) / F1C.far)) ** 0.8, k = z / F1C.f;
    [F1PAL.grass, F1PAL.run, F1PAL.kerb, F1PAL.asph, F1PAL.edge].forEach((p, i) => { pal[i * 2] = pack(p[0], fog); pal[i * 2 + 1] = pack(p[1], fog); });
    const chk0 = pack([0x11, 0x11, 0x14], fog), chk1 = pack([0xf4, 0xf4, 0xf0], fog);
    let wx = cx + fx * z - rx * (W / 2) * k, wy = cy + fy * z - ry * (W / 2) * k; const dx = rx * k, dy = ry * k;
    let o = row * W;
    for (let x = 0; x < W; x++, wx += dx, wy += dy, o++) {
      const tx = wx | 0, ty = wy | 0;
      if (tx < 0 || ty < 0 || tx >= Wd || ty >= Hd) { px[o] = pal[((tx >> 4) + (ty >> 4)) & 1]; continue; }
      const m = M[ty * Wd + tx];
      if (m === 0) px[o] = pal[((tx >> 4) + (ty >> 4)) & 1];
      else if (m === 2) px[o] = pal[4 + (((tx + ty) >> 2) & 1)];
      else if (m >= 3) {
        // the start and finish line: a chequered band across the track
        const ax = wx - sx0, ay = wy - sy0, along = ax * sca + ay * ssa;
        if (along > -1.2 && along < 1.2) { const across = -ax * ssa + ay * sca; px[o] = ((Math.floor(along / 0.6) + Math.floor(across / 0.6)) & 1) ? chk0 : chk1; }
        else px[o] = m === 4 ? pal[8] : pal[6 + ((((tx >> 3) * 7 + (ty >> 3) * 13) & 7) === 0 ? 1 : 0)];
      } else px[o] = pal[2 + (((tx * 3 + ty * 5) & 15) === 0 ? 1 : 0)];
    }
  }
  ctx.putImageData(S.f1.img, 0, hor);
}
// a car from behind, sixteen blocks wide; tiny when far away
function f1CarSprite(g, sx, sy, wpx, col, lit){
  if (wpx < 5) { g.fillStyle = '#05060d'; g.fillRect(Math.round(sx - 2), Math.round(sy - 2), 4, 2); g.fillStyle = col; g.fillRect(Math.round(sx - 1), Math.round(sy - 3), 2, 2); return; }
  const u = wpx / 16, x0 = sx - wpx / 2, y0 = sy - u * 10;
  const r = (cx, cy, cw, ch, c) => { g.fillStyle = c; const X = Math.round(x0 + cx * u), Y = Math.round(y0 + cy * u); g.fillRect(X, Y, Math.max(1, Math.round(x0 + (cx + cw) * u) - X), Math.max(1, Math.round(y0 + (cy + ch) * u) - Y)); };
  r(1, 9.4, 14, 0.8, 'rgba(0,0,0,.35)');                 // shadow
  r(0, 4, 4, 6, '#15161c'); r(12, 4, 4, 6, '#15161c');    // rear tyres
  r(0.6, 4.6, 1, 4.6, '#3a3c46'); r(14.4, 4.6, 1, 4.6, '#3a3c46');
  r(4, 4, 8, 4.5, col); r(6, 1.5, 4, 3, col);              // body and engine cover
  r(7, 0.4, 2, 1.6, '#f2f0e8');                            // helmet
  r(1.5, 1.6, 13, 1.4, col); r(1.5, 1.6, 0.8, 3, '#15161c'); r(13.7, 1.6, 0.8, 3, '#15161c');  // rear wing
  r(4.5, 8.5, 7, 1.3, '#2a2c34');                          // diffuser
  r(7.3, 7, 1.4, 1.2, lit ? '#ff3b3b' : '#7a1d1d');        // rain light
}
function f1Project(cx, cy, th, x, y){
  const ax = x - cx, ay = y - cy, z = ax * Math.cos(th) + ay * Math.sin(th), l = -ax * Math.sin(th) + ay * Math.cos(th);
  if (z < 0.6) return null;
  const k = F1C.f / z; return {sx: W / 2 + l * k, sy: F1C.hor + F1C.h * k, k, z};
}
function f1Chase(now){
  const R = S.f1r, tr = S.f1.track, w = f1World(tr), cam = S.f1.camst || (S.f1.camst = {});
  const cars = f1CarSpots(R, w), me = cars.find(c => c.d.num === f1CamCar(R)) || cars[0]; if (!me) return;
  // the camera sits behind the car, looking the way the track runs a little ahead of it
  const ahead = me.o.grid || me.parked ? me.f + 0.001 : me.f + 0.0035, [ax, ay] = f1WSide(w, ahead, (S.f1.lat.get(me.d.num) || 0) * w.tw * 0.5);
  let want = Math.atan2(ay - me.y, ax - me.x);
  if (cam.num !== me.d.num || cam.th == null || Math.abs(cam.f - me.f) > 0.05) cam.th = want;
  let dth = want - cam.th; while (dth > Math.PI) dth -= 2 * Math.PI; while (dth < -Math.PI) dth += 2 * Math.PI;
  cam.th += dth * 0.18; cam.num = me.d.num; cam.f = me.f;
  const th = cam.th, cx = me.x - Math.cos(th) * F1C.back, cy = me.y - Math.sin(th) * F1C.back;
  // sky, turned with the camera
  const sky = f1Scenery(), off = ((Math.round(th * F1C.f) % sky.width) + sky.width) % sky.width;
  ctx.drawImage(sky, -off, 0); ctx.drawImage(sky, sky.width - off, 0); if (sky.width - off < W) ctx.drawImage(sky, 2 * sky.width - off, 0);
  f1Floor(w, cx, cy, th);
  // sprites, far to near: other cars, boards, grandstands, the start gantry, the safety car
  const spr = [];
  for (const c of cars) { const p = f1Project(cx, cy, th, c.x, c.y); if (p && p.z < F1C.far + 200) spr.push({...p, car: c}); }
  for (const pr of f1Props(w)) {
    const [x, y] = f1WSide(w, pr.f, pr.side * w.tw * (pr.off || 1.45)); const p = f1Project(cx, cy, th, x, y); if (p && p.z < F1C.far) spr.push({...p, prop: pr});
  }
  const lead = R.order?.[0];
  if (f1Flag(R)?.kind === 'sc' && lead && !lead.grid && !lead.out) { const [x, y] = f1WSide(w, lead.p + 0.012, 0); const p = f1Project(cx, cy, th, x, y); if (p) spr.push({...p, sc: true}); }
  const gl = f1WSide(w, 0, -w.tw * 0.75), gr = f1WSide(w, 0, w.tw * 0.75), pl = f1Project(cx, cy, th, ...gl), prr = f1Project(cx, cy, th, ...gr);
  if (pl && prr) spr.push({z: (pl.z + prr.z) / 2, gantry: [pl, prr]});
  spr.sort((a, b) => b.z - a.z);
  const tags = [];
  for (const s of spr) {
    if (s.prop) {
      const ww = s.prop.ww * s.k, hh = s.prop.wh * s.k, lift = s.prop.lift * s.k; if (ww < 3) continue;
      if (lift) { ctx.fillStyle = '#6b7090'; ctx.fillRect(Math.round(s.sx - ww / 2 + ww * 0.1), Math.round(s.sy - lift), Math.max(1, Math.round(s.k * 0.3)), Math.round(lift)); ctx.fillRect(Math.round(s.sx + ww / 2 - ww * 0.1), Math.round(s.sy - lift), Math.max(1, Math.round(s.k * 0.3)), Math.round(lift)); }
      ctx.drawImage(s.prop.img, Math.round(s.sx - ww / 2), Math.round(s.sy - lift - hh), Math.round(ww), Math.round(hh));
    } else if (s.gantry) {
      const [a, b] = s.gantry, top = Math.min(a.sy - 7.5 * a.k, b.sy - 7.5 * b.k), pw = Math.max(1, Math.round(a.k * 0.5));
      ctx.fillStyle = '#2b2f45'; ctx.fillRect(Math.round(a.sx), Math.round(top), pw, Math.round(a.sy - top)); ctx.fillRect(Math.round(b.sx), Math.round(top), pw, Math.round(b.sy - top));
      const bh = Math.max(2, Math.round(a.k * 1.3)); ctx.fillRect(Math.round(a.sx), Math.round(top), Math.round(b.sx - a.sx) + pw, bh);
      // the five red lights, lit until the start
      const on = R.clock < R.t0 ? Math.min(5, Math.max(0, Math.floor((R.clock - (R.t0 - 6000)) / 1000) + 1)) : 0;
      for (let i = 0; i < 5; i++) { const lx = a.sx + (b.sx - a.sx) * (0.3 + i * 0.1), ls = Math.max(1, Math.round(a.k * 0.5)); ctx.fillStyle = i < on ? '#ff3b3b' : '#11121a'; ctx.fillRect(Math.round(lx), Math.round(top + bh * 0.25), ls, ls); }
    } else if (s.sc) {
      f1CarSprite(ctx, s.sx, s.sy, F1C.carW * s.k, '#e9e4cf', false);
      if (s.k > 3) { ctx.fillStyle = Math.floor(now / 250) % 2 ? '#f2b632' : '#c0392b'; ctx.fillRect(Math.round(s.sx - s.k * 0.6), Math.round(s.sy - s.k * 2.2), Math.max(2, Math.round(s.k * 1.2)), Math.max(1, Math.round(s.k * 0.3))); pixText(ctx, 'SC', Math.round(s.sx) - 3, Math.round(s.sy - s.k * 2.2) - 7, false, '#f2b632'); }
    } else {
      const c = s.car, wpx = F1C.carW * s.k, braking = c.parked || c.o.fin;
      if (c === me) continue;
      f1CarSprite(ctx, s.sx, s.sy, wpx, c.d.color, braking);
      // name tags on the nearer cars, skipping one that would print on top of another
      const lx = Math.round(s.sx - pixWidth(c.d.code, false) / 2), ly = Math.round(s.sy - wpx * 0.7) - 7;
      if (s.k > 2.2 && s.sy > F1C.hor + 4 && !tags.some(([x, y]) => Math.abs(x - lx) < 14 && Math.abs(y - ly) < 7)) { tags.push([lx, ly]); pixText(ctx, c.d.code, lx, ly, false, '#ffffff'); }
    }
  }
  // our car last, so nothing draws over it
  const pm = f1Project(cx, cy, th, me.x, me.y);
  if (pm) { const bob = me.o.grid || me.parked ? 0 : (Math.floor(now / 90) % 2); f1CarSprite(ctx, pm.sx, pm.sy + bob, F1C.carW * pm.k, me.d.color, me.parked || me.o.fin); }
  f1Hud(R, w, cars, me, now);
}
// the minimap (upper right, under the scoreboard), the tower (left, under the booth), and the big position number
function f1Hud(R, w, cars, me, now){
  const cov = f1CoverCache(), booth = cov[0] || {x1: 150, y1: 134}, board = cov[1] || {x0: 350, y1: 78};
  const mw = Math.round(Math.min(110, W - board.x0 - 8)), mx = W - 8 - mw, my = Math.round(board.y1) + 5;
  const mm = S.f1.mini?.w === w && S.f1.mini.mw === mw ? S.f1.mini : (S.f1.mini = f1MiniMap(w, mw));
  ctx.fillStyle = 'rgba(8,10,26,.72)'; ctx.fillRect(mx, my, mw, mm.h); ctx.drawImage(mm.c, mx, my);
  for (const c of [...cars].reverse()) {
    if (c.parked && c !== me) continue;
    const x = Math.round(mx + mm.ox + c.x * mm.s), y = Math.round(my + mm.oy + c.y * mm.s);
    if (c === me) { if (Math.floor(now / 300) % 2) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 2, y - 2, 5, 5); } ctx.fillStyle = c.d.color; ctx.fillRect(x - 1, y - 1, 3, 3); }
    else { ctx.fillStyle = '#05060d'; ctx.fillRect(x - 1, y - 1, 3, 3); ctx.fillStyle = c.d.color; ctx.fillRect(x, y, 1, 1); }
  }
  pixText(ctx, 'TRACK', mx + 3, my + 3, false, '#9ba3cc');
  // the timing tower down the left
  const order = R.order || [], ty = Math.round(booth.y1) + 4, rh = 7, rows = Math.min(order.length, Math.floor((H - 6 - ty) / rh)), tx = 8;
  if (rows > 0) {
    ctx.fillStyle = 'rgba(8,10,26,.78)'; ctx.fillRect(tx - 2, ty - 2, 64, rows * rh + 3);
    let list = order.slice(0, rows); const mi = order.findIndex(o => o.d.num === me.d.num);
    if (mi >= rows) list = order.slice(0, rows - 1).concat(order[mi]);
    list.forEach((o, k) => {
      const y = ty + k * rh, pos = order.indexOf(o) + 1, mine = o.d.num === me.d.num;
      if (mine) { ctx.fillStyle = '#f2b632'; ctx.fillRect(tx - 2, y - 1, 64, rh); }
      pixText(ctx, String(pos).padStart(2, ' '), tx, y, false, mine ? '#05060d' : '#9ba3cc');
      ctx.fillStyle = o.d.color; ctx.fillRect(tx + 9, y, 2, 5);
      pixText(ctx, o.d.code, tx + 13, y, false, mine ? '#05060d' : o.out ? '#6b7090' : '#f2f0e8');
      const gp = o.gap || ''; pixText(ctx, gp, tx + 60 - pixWidth(gp, false), y, false, mine ? '#05060d' : o.out ? '#6b7090' : k ? '#c9c6b4' : '#f2b632');
    });
  }
  // the big position, racing-game style, bottom right
  const pos = order.findIndex(o => o.d.num === me.d.num) + 1;
  if (pos && !S.cut) {
    const txt = 'P' + pos, sc = 3, tw = pixWidth(txt, true) * sc, bx = W - 10 - tw, by = H - 30;
    ctx.fillStyle = 'rgba(8,10,26,.6)'; ctx.fillRect(W - 14 - Math.max(tw, 66), by - 18, Math.max(tw, 66) + 8, 47);
    pixText(ctx, txt, bx + sc, by + sc, true, '#05060d', sc); pixText(ctx, txt, bx, by, true, pos === 1 ? '#f2b632' : '#ffffff', sc);
    const sub = `${me.d.code} ${f1TeamShort(me.d.team).toUpperCase()}`; pixText(ctx, sub, W - 10 - pixWidth(sub, false), by - 8, false, '#ffffff');
    const cap = S.f1.cam == null ? 'ONBOARD - WINNER' : 'ONBOARD'; pixText(ctx, cap, W - 10 - pixWidth(cap, false), by - 15, false, '#f2b632');
  }
}
function f1MiniMap(w, mw){
  const s = (mw - 8) / Math.max(w.Wd, w.Hd) * 1.0, h = Math.round(Math.min(90, w.Hd * s + 14)), s2 = Math.min(s, (h - 14) / w.Hd);
  const c = document.createElement('canvas'); c.width = mw; c.height = h; const g = c.getContext('2d');
  const ox = (mw - w.Wd * s2) / 2, oy = 10 + (h - 12 - w.Hd * s2) / 2;
  g.strokeStyle = '#e9e4cf'; g.lineWidth = 3; g.lineJoin = 'round'; g.beginPath(); w.pts.forEach(([x, y], i) => i ? g.lineTo(ox + x * s2, oy + y * s2) : g.moveTo(ox + x * s2, oy + y * s2)); g.closePath(); g.stroke();
  g.strokeStyle = '#4a4d57'; g.lineWidth = 1.5; g.stroke();
  const [sx, sy] = w.pts[0]; g.fillStyle = '#ffffff'; g.fillRect(Math.round(ox + sx * s2) - 1, Math.round(oy + sy * s2) - 1, 3, 3);
  return {w, mw, c, h, s: s2, ox, oy};
}
// where the booth and scoreboard sit, checked once a second rather than every frame
function f1CoverCache(){
  const t = performance.now(); if (!S.f1.cov || t - S.f1.covT > 1000) { S.f1.cov = f1Covers(); S.f1.covT = t; } return S.f1.cov;
}

/* ---- the camera picker: any driver, grouped by team; the race winner unless the viewer picks ---- */
function f1CamPicker(){
  const box = $('f1cam'), sel = $('f1cam-sel'), R = S.f1r; if (!box) return;
  const on = isF1() && S.mode === 'replay' && !!R; box.hidden = !on; if (!on) return;
  if (sel.dataset.race !== String(R.k)) {
    sel.dataset.race = String(R.k); sel.replaceChildren();
    const win = R.D.get(R.win?.driver_number);
    const o0 = document.createElement('option'); o0.value = ''; o0.textContent = win ? `Race winner (${win.code})` : 'Race leader'; sel.append(o0);
    const teams = new Map(); for (const d of R.cars) { if (!teams.has(d.team)) teams.set(d.team, []); teams.get(d.team).push(d); }
    for (const [team, ds] of [...teams].sort((a, b) => a[0].localeCompare(b[0]))) {
      const og = document.createElement('optgroup'); og.label = team;
      for (const d of ds.sort((a, b) => (a.res?.position || 99) - (b.res?.position || 99))) { const o = document.createElement('option'); o.value = String(d.num); o.textContent = `${d.code} · ${d.name}`; og.append(o); }
      sel.append(og);
    }
    sel.onchange = () => { S.f1.cam = sel.value ? +sel.value : null; S.f1.camst = {}; };
  }
  sel.value = S.f1.cam == null ? '' : String(S.f1.cam);
}
