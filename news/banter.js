/* Pixel Broadcasting Company: desk banter between news segments.
   The words live in news/banter.json (short exchanges, the Batty and Pip running bits, cast birthdays and anniversaries),
   a fixed file Chris edits. Nothing here is written live: the page only picks from that file.
   weave() takes the newsroom's list of beats and slips a two-line exchange in where one segment ends and the next begins,
   at most perLoop times a loop, and never next to a serious story. Each exchange takes exactly one story's time,
   so the loop is the same length whichever lines are picked; the picks rotate from loop to loop. */
(function(){
"use strict";
let DATA=null,WORDS=null;
const STUDIO={A:{shot:"A"},B:{shot:"B"},P:{shot:"P"},W:{shot:"W"},S:{shot:"S"},X:{scene:"lab",topic:"atom"},L:{scene:"local"},I:{scene:"intl"}};
const ok=x=>typeof x==="string"&&x.trim().length>0&&x.length<=200;
const okLine=l=>l&&STUDIO[l.who]&&ok(l.say);
const okEx=e=>e&&Array.isArray(e.lines)&&e.lines.length>=1&&e.lines.slice(0,2).every(okLine);

async function load(){
  if(location.protocol==="file:")return false;
  try{const r=await fetch("news/banter.json",{cache:"no-cache"});if(!r.ok)return false;
    const j=await r.json();if(!j||typeof j!=="object")return false;
    DATA=j;
    WORDS=new RegExp("\\b("+(Array.isArray(j.seriousWords)?j.seriousWords:[]).filter(ok)
      .map(w=>{const stem=w.endsWith("*");w=w.replace(/\*$/,"").replace(/[.*+?^${}()|[\]\\]/g,"\\$&").replace(/ /g,"\\s+");return stem?w+"\\w*":w+"\\b"})
      .join("|")+")","i");
    if(WORDS.source==="\\b()")WORDS=null;
    return true}catch(e){DATA=null;return false}
}
// A beat is serious when its words are; a whole segment is when it's on the always-serious list.
function seriousText(b){return !!(WORDS&&b&&WORDS.test(String(b.head||"")+" "+String(b.body||"")))}
function seriousSeg(seg){return !!(DATA&&Array.isArray(DATA.alwaysSerious)&&DATA.alwaysSerious.includes(seg))}

// Today's date where the local desk is, as {y, md:"MM-DD"}.
function today(now,tz){
  let s;try{s=new Intl.DateTimeFormat("en-CA",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(now))}
  catch(e){s=new Intl.DateTimeFormat("en-CA",{year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(now))}
  return {y:+s.slice(0,4),md:s.slice(5,10)};
}
const fill=(s,v)=>String(s).replace(/\{(\w+)\}/g,(m,k)=>v[k]!=null?v[k]:m);
// Birthdays and anniversaries that fall on today, already turned into exchanges.
function specials(now,tz,cast){
  const out=[],d=today(now,tz),person=x=>{const name=x.name||(cast[x.who]&&cast[x.who].name)||"";return {name,first:x.first||name.split(" ")[0]}};
  (Array.isArray(DATA.birthdays)?DATA.birthdays:[]).forEach((x,i)=>{
    if(!x||x.date!==d.md||!ok(x.reply))return;const p=person(x);if(!p.name)return;
    const replyBy=STUDIO[x.who]?x.who:(STUDIO[x.by]?x.by:"B");
    const ops=(Array.isArray(DATA.birthdayOpeners)?DATA.birthdayOpeners:[]).filter(okLine);
    let op=ops.length?ops[(d.y+i)%ops.length]:{who:"A",say:"Happy birthday, {first}!"};
    let who=op.who;if(who===replyBy)who=who==="A"?"B":"A";
    out.push({title:"Happy birthday, "+p.first+"!",lines:[{who,say:fill(op.say,p)},{who:replyBy,say:x.reply}]})});
  (Array.isArray(DATA.anniversaries)?DATA.anniversaries:[]).forEach(x=>{
    if(!x||typeof x.date!=="string"||x.date.slice(5)!==d.md||!Array.isArray(x.lines))return;
    const years=d.y-+x.date.slice(0,4);if(!(years>=1))return;
    const v=Object.assign(person(x),{years,yearWord:years===1?"year":"years"}),by=Array.isArray(x.by)?x.by:["A","B"];
    const lines=x.lines.slice(0,2).map((s,k)=>({who:STUDIO[by[k]]?by[k]:(k?"B":"A"),say:fill(s,v)}));
    if(lines.every(okLine))out.push({title:x.title||"Happy anniversary",lines})});
  return out;
}
// A small seeded shuffle so the picks change from loop to loop but every viewer sees the same show.
function rng(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

function beatsOf(ex,seg,beat){
  const lines=ex.lines.slice(0,2),dur=Math.round(beat/lines.length);
  return lines.map((l,k)=>{
    const b=Object.assign({seg,sp:l.who,cat:"ON THE DESK",head:ex.title||"On the desk",body:l.say,dur,cont:true,banter:true,wall:"logo"},STUDIO[l.who]);
    if(ex.bit==="batty"){delete b.scene;b.shot="two";b.bit=k?"batty-after":"batty";b.prop=ex.prop||"mug"}
    if(ex.bit==="pip"&&l.who==="W"){delete b.shot;b.scene="wx";b.bit="pip"}
    return b});
}

// Every exchange that could fill the hand-off from one segment to the next, before skipping repeats.
function base(prev,next){const bits=DATA.bits||{},L=x=>(Array.isArray(x)?x:[]).filter(okEx);
  return [].concat(L(DATA.before&&DATA.before[next]),L(DATA.anytime),L(bits.batty),prev==="Weather"?L(bits.pip):[])}

/* B: the loop's beats in order. ctx: {c (loop number), now (when the loop starts), tz, beat (one story's length), cast}. */
function weave(B,ctx){
  if(!DATA||!B.length)return B;
  const per=Math.max(0,Math.min(6,Math.floor(+DATA.perLoop||0)));if(!per)return B;
  // where one segment hands off to the next
  const runs=[];B.forEach((b,i)=>{const r=runs[runs.length-1];if(!r||r.seg!==b.seg)runs.push({seg:b.seg,from:i,to:i});else r.to=i});
  const slots=[];
  for(let k=1;k<runs.length;k++){
    const prev=runs[k-1],next=runs[k];
    if(prev.seg==="Commercial break"||next.seg==="Commercial break"||!base(prev.seg,next.seg).length)continue;
    if(seriousSeg(prev.seg)||seriousSeg(next.seg))continue;
    // the whole segment just finished, and the next segment's opening and first story
    if(B.slice(prev.from,prev.to+1).some(seriousText)||B.slice(next.from,Math.min(next.to,next.from+1)+1).some(seriousText))continue;
    slots.push({at:next.from,prev:prev.seg,next:next.seg});
  }
  if(!slots.length)return B;
  const n=Math.min(per,slots.length),c=Math.max(0,ctx.c|0),first=c%slots.length,chosen=[];
  for(let i=0;i<n;i++)chosen.push(slots[(first+i)%slots.length]);
  chosen.sort((a,b)=>a.at-b.at);
  // fill them: today's birthdays and anniversaries first, then banter from the pools
  const sp=specials(ctx.now||Date.now(),ctx.tz,ctx.cast||{}),bits=DATA.bits||{},used=new Set(),r=rng(c*7919+13);
  let batty=false;
  const exs=chosen.map(s=>{
    if(sp.length)return sp.shift();
    const pool=[];
    const add=(list,bit,w)=>(Array.isArray(list)?list:[]).forEach(e=>{if(okEx(e)&&!used.has(e))for(let i=0;i<w;i++)pool.push({e,bit})});
    add(DATA.before&&DATA.before[s.next],null,3);
    add(DATA.anytime,null,1);
    if(!batty)add(bits.batty,"batty",1);
    if(s.prev==="Weather")add(bits.pip,"pip",6);
    if(!pool.length){const e=base(s.prev,s.next)[c%base(s.prev,s.next).length];return Object.assign({},e,{bit:(bits.pip||[]).includes(e)?"pip":(bits.batty||[]).includes(e)?"batty":null})}
    const p=pool[Math.floor(r()*pool.length)];used.add(p.e);if(p.bit==="batty")batty=true;
    return Object.assign({},p.e,{bit:p.bit})});
  const out=B.slice();
  for(let i=chosen.length-1;i>=0;i--)out.splice(chosen[i].at,0,...beatsOf(exs[i],chosen[i].prev,ctx.beat||13000));
  return out;
}
window.PBC_BANTER={load,weave,seriousText};
})();
