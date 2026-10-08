/* Pixel Broadcasting Company: the newsroom's people.
   person() draws one member of the cast on a 14 x 32 pixel grid (head 0-11, body 12-21, legs 22-32), at any whole-pixel
   scale; anim() gives the blink, mouth and head-bob for a moment in time. News draws its whole cast with these, and the
   Sports Desk seats Bo and his guests at its anchor desk with them (tools/LOOK_BOOK.md, section 5).
   look: skin, hair, style (short, long, bob, curly, pony, beard, wild, bald), coat, shirt, pants, and optionally tie, shoe,
   dress, glasses, earring, stache, cap (+ capBrim, capLogo). state: seated, headOnly, point, mic, blink, open, bob. */
(function(){
"use strict";
function hex(c){return [parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)]}
function mix(a,b,k){const A=hex(a),B=hex(b);return "#"+A.map((x,i)=>Math.round(x+(B[i]-x)*k).toString(16).padStart(2,"0")).join("")}
function person(look,ctx,x,y,s,st){
  st=st||{};
  const r=(col,px,py,w,h)=>{ctx.fillStyle=col;ctx.fillRect(x+px*s,y+py*s,w*s,h*s)};
  const Y=st.bob?-1:0, h=look.hair, sh="#15151c";
  if(!st.seated&&!st.headOnly){
    r(look.pants,3,22,4,8);r(look.pants,7,22,4,8);
    r(look.shoe||sh,2,30,5,2);r(look.shoe||sh,7,30,5,2);
  }
  if(!st.headOnly){
    r(look.coat,1,12,12,10);
    if(look.dress){r(look.coat,2,22,10,4)}
    r(mix(look.coat,"#000000",.25),1,12,1,10);
    r(look.shirt,5,12,4,2);r(look.shirt,6,14,2,1);
    if(look.tie)r(look.tie,6,13,2,6);
    r(look.coat,0,13,1,8);r(look.skin,0,21,1,1);
    if(st.point){r(look.coat,13,12,6,2);r(look.skin,19,12,2,2)}
    else if(st.mic){r(look.coat,12,13,2,4);r(look.coat,11,12,2,2);r(look.skin,10,10,2,2);r("#2a2a33",10,8,2,2);r("#c9ccd6",10,7,2,1);r("#f2b632",9,9,1,1)}
    else{r(look.coat,13,13,1,8);r(look.skin,13,21,1,1)}
    if(st.seated){r(look.skin,3,20,2,1);r(look.skin,9,20,2,1)}
  }
  r(look.skin,6,10,2,2);
  // back hair
  if(look.style==="long")r(h,1,2+Y,12,11);
  if(look.style==="curly"){r(h,1,1+Y,12,8);r(h,0,3+Y,14,5)}
  if(look.style==="bob")r(h,2,2+Y,10,8);
  if(look.style==="pony"){r(h,11,3+Y,3,3);r(h,12,6+Y,2,5)}
  if(look.style==="wild"){r(h,0,-1+Y,14,12);r(h,-1,1+Y,16,8);r(h,1,-2+Y,4,1);r(h,9,-2+Y,4,1);r(h,-2,4+Y,1,3);r(h,15,3+Y,1,4);r(h,1,11+Y,2,2);r(h,11,11+Y,2,2)}
  // face
  r(look.skin,3,2+Y,8,9);r(look.skin,2,5+Y,1,2);r(look.skin,11,5+Y,1,2);
  r(mix(look.skin,"#000000",.12),3,10+Y,8,1);
  // eyes
  if(!st.blink){r("#1b1b25",5,5+Y,1,1);r("#1b1b25",8,5+Y,1,1)}else{r(mix(look.skin,"#000000",.3),5,5+Y,1,1);r(mix(look.skin,"#000000",.3),8,5+Y,1,1)}
  // glasses: thin dark frames around each eye with a bridge, and a faint lens glint
  if(look.glasses){const fr="#3a3440";r(fr,4,4+Y,2,1);r(fr,8,4+Y,2,1);r(fr,4,5+Y,1,1);r(fr,6,5+Y,2,1);r(fr,9,5+Y,1,1);r(fr,4,6+Y,2,1);r(fr,8,6+Y,2,1);
    if(!st.blink){r("#9fb8d8",5,6+Y,1,1);r("#9fb8d8",8,6+Y,1,1)}}
  // front hair
  if(look.style==="short"||look.style==="beard"||look.style==="pony"){r(h,3,1+Y,8,2);r(h,2,2+Y,1,3);r(h,11,2+Y,1,3);r(h,3,3+Y,1,1);r(h,10,3+Y,1,1)}
  if(look.style==="pony")r(h,3,3+Y,4,1);
  if(look.style==="long"){r(h,3,1+Y,8,2);r(h,2,2+Y,1,5);r(h,11,2+Y,1,5);r(h,3,3+Y,3,1)}
  if(look.style==="curly"){r(h,2,0+Y,10,2);r(h,3,2+Y,8,1);r(mix(h,"#ffffff",.15),4,0+Y,1,1);r(mix(h,"#ffffff",.15),9,1+Y,1,1)}
  if(look.style==="wild"){r(h,3,0+Y,8,2);r(h,2,2+Y,2,4);r(h,10,2+Y,2,4);r(h,4,2+Y,2,1);r(h,8,2+Y,1,1);r(mix(h,"#ffffff",.25),5,0+Y,1,1);r(mix(h,"#ffffff",.25),1,4+Y,1,1);r(mix(h,"#ffffff",.25),12,6+Y,1,1)}
  if(look.earring){r(look.earring,2,8+Y,1,1);r(look.earring,11,8+Y,1,1)}
  if(look.style==="bob"){r(h,3,1+Y,8,2);r(h,3,3+Y,8,1);r(h,2,2+Y,1,8);r(h,11,2+Y,1,8)}
  if(look.style==="beard"){r(h,3,8+Y,1,3);r(h,10,8+Y,1,3);r(h,3,10+Y,8,1);r(h,5,7+Y,4,1)}
  if(look.style==="bald"){r(h,2,3+Y,1,3);r(h,11,3+Y,1,3)}
  if(look.stache)r(h,5,7+Y,4,1);
  // a ball cap over the hair: crown, a darker brim across the forehead, a small logo
  if(look.cap){r(look.cap,3,0+Y,8,3);r(look.cap,2,2+Y,10,1);r(look.capBrim||mix(look.cap,"#000000",.25),2,3+Y,10,1);if(look.capLogo)r(look.capLogo,6,1+Y,2,1)}
  // mouth
  if(st.open)r("#4a1418",6,8+Y,2,2);else r(mix(look.skin,"#5a1a1a",.55),6,8+Y,2,1);
}
function anim(key,t,speaking,phase){
  phase=phase||0;
  const seed=key.charCodeAt(0)*977;
  const blink=((t+seed)%3700)<130;
  let open=false,bob=false;
  if(speaking&&phase<.9){
    const pause=Math.sin(t/650+seed)>.82;
    open=!pause&&((Math.floor(t/105)*7+seed)%5)>1;
    bob=Math.floor((t+seed)/900)%3===0;
  }
  return {blink,open,bob};
}
window.PBC_PEOPLE={person,anim,mix};
})();
