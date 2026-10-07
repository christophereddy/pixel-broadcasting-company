/* ---------- teases: "Up next" before every hand-off, "Stay with us" before the break ----------
   PBC_TEASE.add() puts a short tease beat at the end of each segment, and the sign-off becomes the break tease.
   The words are filled in only when the beat goes on air (PBC_TEASE.resolve), from whatever segment is really next:
   the next one in the rundown, or the segment a viewer picked. Every line is a fixed template filled with the
   next story's real headline from data/; nothing is written at run time. */
(function(){
"use strict";
const TEASE_MS=7000;
const LEADS=["Coming up","Still ahead","Just ahead"];
const OUTS=["right after this.","coming up next.","stay with us."];
// Segments that don't get their own tease: the top already runs Marcus's "Coming up" list, and the sign-off is the break's tease.
const NO_TEASE_AFTER={"Top of the news":1},NO_TEASE_BEFORE={"Sign-off":1,"Commercial break":1};

function first(name){return String(name).split(" ")[0]}
function hl(s){return String(s||"").trim().replace(/[.!?;:,]+$/,"")}
function segEnd(B,i){const s=B[i].seg;while(i+1<B.length&&B[i+1].seg===s)i++;return i}
// The beat a tease names: the segment's first story (weather: Sunny's first reading).
function storyOf(B,start){
  const s=B[start].seg;
  for(let i=start;i<B.length&&B[i].seg===s;i++){const b=B[i];if(b.story||b.sp==="W")return b}
  return null;
}
function wallOf(B,start){for(let i=start;i<B.length&&B[i].seg===B[start].seg;i++)if(B[i].wall)return B[i].wall;return "logo"}

/* Insert a tease beat before each segment change. Indices shift, so a tease finds its target when it airs. */
function add(B,c){
  const out=[];let n=0;
  B.forEach((b,i)=>{
    out.push(b);
    const nx=B[i+1];
    if(!nx||nx.seg===b.seg||NO_TEASE_AFTER[b.seg]||NO_TEASE_BEFORE[nx.seg])return;
    const sp=n%2?"B":"A";
    out.push({seg:b.seg,sp,shot:sp,cat:"UP NEXT",wall:nx.wall||"logo",tease:"next",v:c+n++,dur:TEASE_MS,
      head:"Up next: "+nx.seg,body:"Stay with us."});
  });
  return out;
}

/* Fill in a tease beat as it goes on air. pick is the start index of a viewer-picked segment, or null. */
function resolve(B,idx,pick,ctx){
  const b=B[idx],CAST=ctx.CAST,loc=ctx.loc;
  const breakNext=b.tease==="break"&&pick==null; // a pending viewer pick skips the break
  const target=pick!=null?pick:b.tease==="break"?0:segEnd(B,idx)+1;
  const t=B[target];if(!t)return b;
  const v=b.v||0,lead=breakNext?"After the break":LEADS[v%LEADS.length],out=OUTS[v%OUTS.length];
  const r=Object.assign({},b,{wall:breakNext?"logo":wallOf(B,target)});
  if(breakNext){
    // the top of the next loop: lead with the first world story (or the first story of any kind)
    let s=null;for(let i=0;i<B.length&&!s;i++)if(B[i].story&&B[i].seg==="World headlines")s=B[i];
    for(let i=0;i<B.length&&!s;i++)if(B[i].story)s=B[i];
    return Object.assign(r,{cat:"PBC NEWS",head:"Stay with us, top of the news is next.",
      body:s?lead+", "+first(CAST[s.sp].name)+" leads with this: "+hl(s.head)+".":"After the break, the latest headlines."});
  }
  r.cat="UP NEXT";
  if(NO_TEASE_BEFORE[t.seg])return Object.assign(r,{head:"Stay with us.",body:"We'll take a short break and be right back."});
  const s=storyOf(B,target);
  if(t.seg==="Top of the news"){
    let w=null;for(let i=0;i<B.length&&!w;i++)if(B[i].story)w=B[i];
    return Object.assign(r,{head:"Back to the top of the news",body:w?first(CAST[w.sp].name)+" leads with this: "+hl(w.head)+", "+out:"The latest headlines, "+out});
  }
  if(!s)return Object.assign(r,{head:lead+": "+t.seg,body:t.seg+", "+out});
  const label={
    "International report":CAST.I.name+", live from "+String(t.head).replace(/^Live: /,""),
    "National news":"National news with "+CAST[s.sp].name,
    "Politics desk":"Politics with "+CAST.P.name,
    "Business":"Business with "+CAST[s.sp].name,
    "Local desk":CAST.L.name+", live around "+loc,
    "Weather":"Weather with "+CAST.W.name,
    "Science":"Science with "+CAST.X.name,
    "Sports":"Sports with "+CAST.S.name,
    "Good News":"Some good news",
    "World headlines":"The world headlines with "+CAST[s.sp].name
  }[t.seg]||t.seg;
  if(t.seg==="Weather")return Object.assign(r,{head:lead+", "+first(CAST.W.name)+" with the "+loc+" forecast",body:hl(s.head)+". "+label+", "+out});
  if(t.seg==="Good News")return Object.assign(r,{head:lead+", some good news: "+hl(s.head),body:label+", "+out});
  return Object.assign(r,{head:lead+": "+hl(s.head),body:label+", "+out});
}

window.PBC_TEASE={add,resolve};
})();
