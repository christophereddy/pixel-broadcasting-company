/* Pixel Broadcasting Company: Baldur, the PBC Cooking kitchen dog, drawn from Chris's photos
   (cooking-channel/baldur-sketch.png in the project; tools/LOOK_BOOK.md, section 5). One drawing, used wherever he
   turns up: the kitchen (cooking/kitchen.js) and the Sports Desk studio (sports/show.js).
   PBC_BALDUR.DOG     the palette, one letter per colour
   PBC_BALDUR.STAND   standing, facing right, 32 x 15 (the legs are drawn under it, 5 more rows)
   PBC_BALDUR.BED     asleep in his round grey bed, 55 x 20 (rows 0-8 are Baldur, 9 on the bed)
   PBC_BALDUR.sprite(fill, rows, x, y, flip, from, to)   draws rows [from, to) with fill(colour, x, y, w, h)
   PBC_BALDUR.dog(fill, x, y, flip, mode, t)            standing, walking or licking ('stand', 'walk', 'lick') at time t */
(function(){
"use strict";
const DOG = {K: "#2a221e", D: "#3e332c", T: "#b4824c", E: "#1b1b25", G: "#b9b2a6", N: "#121218", B: "#8c6034", P: "#d8707e", W: "#ece6da", L: "#4a3a30", m: "#9a95a2", n: "#7d7884", q: "#5f5a68"};
const STAND = [
  "....................KKKKKKKK....",
  "....................DDDKKKTK....",
  "KK..................DDDKKEKK....",
  "KK..................DDDKKKGGGGNN",
  ".KK................TDDDKGGGGGGNN",
  ".KK................TDDDKGGGGGGG.",
  "..BBKKDDDDDDDDDDDDKTDDDKKKKK....",
  "..BTKKKKKKKKKKKKKKKTTTT.........",
  "...TKKKKKKKKKKKKKKKTTTT.........",
  "...TTTTTTTTTTTTTTTTTTTT.........",
  "...TTTTTTTTTTTTTTTTTTWWW........",
  "...TTTTTTTTTTTTTTTTTTWWW........",
  "...TTTTTTTTTTTTTTTTTTWWW........",
  "...TTTTTTTTTTTTTTTTTTWWW........",
  "...BBBBBBBBBBBBBBBBBBWWW........"];
const BED = [
  "..............KKKDDDDDDDDDDDDDDKKKKK...................",
  ".............TKKKKKKKKKKKKKKKKKKKKKKT..................",
  ".............TKKKKKKKKKKKKKKKKKKKKKKT..KKKTKKKTK.......",
  "...........TTTTTTTTTTTTTTTTTTTTTTTTTTTTDDDKKKKKK.......",
  "...........TTTTTTTTTTTTTTTTTTTTTTTTTTTTDDDKKLLKK.......",
  "...........TTTTTTTTTTTTTTTTTTTTTTTTTTTTDDDKKKGGGGGNN...",
  "...........TTTTTTTTTTTTTTTTTTTTTTTTTTTTDDDKKKGGGGGNN...",
  "...mmmmmmmmTTTTTTTTTTTTTTTTTTTTTTTTTTTTDDDKKKGGGGGGmm..",
  "...mmmmmmmmTTTTTTTTTTTTTTTTTTTTTTTTTTTTDDDKKKKKKmmmmm..",
  ".mmmmmmmmBBBBBBBBBBTTTTTTTTTTTTTTTTTTTTTTmmmmmmmmmmmmmm",
  ".mmnnnnKKKKBBBBBBBBTTWWWWTWWWWTTTTTTTTTTTnnnnnnnnnnnnmm",
  ".mmnnnnKKKKBBBBBBBBTTWWWWTWWWWTTTTTTTTTTTnnnnnnnnnnnnmm",
  ".mmnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnmm",
  ".mmnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnmm",
  ".mmnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnmm",
  ".nnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn",
  ".nnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn",
  ".nnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn",
  ".nnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn",
  "...qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq.."];
function sprite(fill, rows, x, y, flip, from, to){
  const w = rows[0].length;
  for (let r = from || 0; r < (to || rows.length); r++) for (let c = 0; c < w; c++) { const ch = rows[r][c]; if (ch !== ".") fill(DOG[ch], x + (flip ? w - 1 - c : c), y + r, 1, 1); }
}
// standing, walking (legs swap) or licking (head down, tongue out), drawn with fill R; x is his left edge and y his top,
// so his feet are on the floor at y + 25
function dog(R, x, y, flip, mode, t){
  const leg = mode === "walk" ? Math.floor(t / 160) % 2 : 0;
  if (mode === "lick") { sprite(R, STAND, x, y + 5, flip, 6, 15); const hx = flip ? x : x; sprite(R, STAND.map(r => r.slice(18)), hx + (flip ? 0 : 18), y + 9, flip, 0, 6);
    if (Math.floor(t / 250) % 2) R(DOG.P, flip ? x + 1 : x + 30, y + 15, 2, 2); }
  else sprite(R, STAND, x, y + 5, flip);
  // legs: back pair and front pair, the darker leg of each behind
  const L = (lx, c, dx) => R(c, flip ? x + 31 - lx - 1 - dx : x + lx + dx, y + 20, 2, 5);
  L(4, DOG.T, leg); L(7, DOG.B, -leg); L(17, DOG.T, -leg); L(20, DOG.B, leg);
  R(DOG.W, flip ? x + 31 - 6 : x + 4 + leg, y + 24, 2, 1); R(DOG.W, flip ? x + 31 - 19 : x + 17 - leg, y + 24, 2, 1);
}
window.PBC_BALDUR = {DOG, STAND, BED, sprite, dog};
})();
