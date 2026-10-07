/* Story visuals for the newsroom's video wall.
   - World, international and national stories get a pixel map with a pin on the story's place. The place comes from the
     story's own `place` when it has one, otherwise from a country, state or city named in its headline or summary.
     Everything is looked up in news/places.js and news/world-map.bin; there is no map service and no live AI.
   - Every desk story also gets category art (courts, health, ships, baseball...) picked from words in the story.
   - A story whose place can't be matched shows only its category art, never a guessed pin.
   The map and the art take turns on the wall. Juniper's science screen and the local desk are not touched. */
(function(){
"use strict";
const P=window.PBC_PLACES;

/* ---------- places ---------- */
const fold=s=>String(s||"").normalize("NFKD").replace(/[̀-ͯ]/g,"").replace(/[‘’]/g,"'");
// Other names the news uses for a region on the map (left: what a story says; right: the map's name).
const ALIAS={"United Kingdom":"United Kingdom","UK":"United Kingdom","U.K.":"United Kingdom","Britain":"United Kingdom","Great Britain":"United Kingdom",
  "Democratic Republic of the Congo":"Dem. Rep. Congo","Democratic Republic of Congo":"Dem. Rep. Congo","DR Congo":"Dem. Rep. Congo","DRC":"Dem. Rep. Congo","Congo":"Dem. Rep. Congo",
  "Republic of the Congo":"Congo","Congo-Brazzaville":"Congo","Central African Republic":"Central African Rep.","Bosnia and Herzegovina":"Bosnia and Herz.","Bosnia":"Bosnia and Herz.",
  "South Sudan":"S. Sudan","Ivory Coast":"Côte d'Ivoire","Cote d'Ivoire":"Côte d'Ivoire","Eswatini":"eSwatini","Swaziland":"eSwatini","Czech Republic":"Czechia",
  "North Macedonia":"Macedonia","Dominican Republic":"Dominican Rep.","Equatorial Guinea":"Eq. Guinea","United Arab Emirates":"United Arab Emirates","UAE":"United Arab Emirates",
  "Emirates":"United Arab Emirates","Burma":"Myanmar","Cape Verde":"Cabo Verde","East Timor":"Timor-Leste","Western Sahara":"W. Sahara","Vatican City":"Vatican",
  "Palestinian territories":"Palestine","Solomon Islands":"Solomon Is.","Marshall Islands":"Marshall Is.","Turkiye":"Turkey","Antigua":"Antigua and Barb.",
  "Trinidad":"Trinidad and Tobago","Sao Tome":"São Tomé and Principe","Falklands":"Falkland Is.","Falkland Islands":"Falkland Is.","Faroe Islands":"Faeroe Is.",
  "Macau":"Macao","Northern Cyprus":"N. Cyprus","Saint Lucia":"Saint Lucia","Cayman Islands":"Cayman Is.","Holland":"Netherlands","the Netherlands":"Netherlands"};
// Words for a country's people or things ("Israelis weigh reports...").
const DEMONYM={Israeli:"Israel",Palestinian:"Palestine",Ukrainian:"Ukraine",Russian:"Russia",Chinese:"China",Iranian:"Iran",Iraqi:"Iraq",Syrian:"Syria",Lebanese:"Lebanon",
  Afghan:"Afghanistan",Pakistani:"Pakistan",French:"France",German:"Germany",British:"United Kingdom",Italian:"Italy",Spanish:"Spain",Japanese:"Japan",
  Mexican:"Mexico",Canadian:"Canada",Brazilian:"Brazil",Sudanese:"Sudan",Turkish:"Turkey",Saudi:"Saudi Arabia",Yemeni:"Yemen",Egyptian:"Egypt",Venezuelan:"Venezuela",
  Cuban:"Cuba",Haitian:"Haiti",Nigerian:"Nigeria",Ethiopian:"Ethiopia",Kenyan:"Kenya",Congolese:"Dem. Rep. Congo",Somali:"Somalia",Libyan:"Libya",Malian:"Mali",
  Polish:"Poland",Greek:"Greece",Dutch:"Netherlands",Swiss:"Switzerland",Swedish:"Sweden",Norwegian:"Norway",Danish:"Denmark",Finnish:"Finland",Irish:"Ireland",
  Australian:"Australia",Filipino:"Philippines",Indonesian:"Indonesia",Vietnamese:"Vietnam",Thai:"Thailand",Taiwanese:"Taiwan",Colombian:"Colombia",
  Argentine:"Argentina",Argentinian:"Argentina",Peruvian:"Peru",Chilean:"Chile",Hungarian:"Hungary",Serbian:"Serbia",Bulgarian:"Bulgaria",Romanian:"Romania",
  Armenian:"Armenia",Azerbaijani:"Azerbaijan",Belarusian:"Belarus",Qatari:"Qatar",Emirati:"United Arab Emirates",Jordanian:"Jordan",Omani:"Oman",Moroccan:"Morocco",
  Algerian:"Algeria",Tunisian:"Tunisia",Kosovar:"Kosovo",Bangladeshi:"Bangladesh",Nepali:"Nepal","Sri Lankan":"Sri Lanka",Rwandan:"Rwanda",Ugandan:"Uganda",Ghanaian:"Ghana",
  Senegalese:"Senegal",Zimbabwean:"Zimbabwe",Mozambican:"Mozambique",Ecuadorian:"Ecuador",Bolivian:"Bolivia",Nicaraguan:"Nicaragua",Guatemalan:"Guatemala",
  Honduran:"Honduras",Salvadoran:"El Salvador",Panamanian:"Panama",Jamaican:"Jamaica",Icelandic:"Iceland",Estonian:"Estonia",Latvian:"Latvia",Lithuanian:"Lithuania",
  Slovak:"Slovakia",Czech:"Czechia",Austrian:"Austria",Belgian:"Belgium",Portuguese:"Portugal",Croatian:"Croatia",Bosnian:"Bosnia and Herz.",Albanian:"Albania",
  Moldovan:"Moldova",Kazakh:"Kazakhstan",Uzbek:"Uzbekistan",Mongolian:"Mongolia",Cambodian:"Cambodia",Malaysian:"Malaysia",Singaporean:"Singapore",Kuwaiti:"Kuwait",
  Bahraini:"Bahrain",Cypriot:"Cyprus",Maltese:"Malta",Eritrean:"Eritrea",Chadian:"Chad",Nigerien:"Niger",Burkinabe:"Burkina Faso",Cameroonian:"Cameroon",
  Tanzanian:"Tanzania",Zambian:"Zambia",Malawian:"Malawi",Angolan:"Angola",Namibian:"Namibia",Greenlandic:"Greenland",Scottish:"Scotland",Welsh:"Wales",
  Catalan:"Catalonia",Kashmiri:"Kashmir",Tibetan:"Tibet",Uyghur:"Xinjiang",Crimean:"Crimea",Gazan:"Gaza"};
// Places inside a country that the news names often, and smaller cities missing from the city list. [name, lat, lon]
const EXTRA=[["England",52.6,-1.5],["Scotland",56.8,-4.2],["Wales",52.3,-3.7],["Northern Ireland",54.6,-6.7],["Quebec",48.5,-72],["Ontario",46.5,-81],
  ["British Columbia",53.7,-124.5],["Alberta",54.5,-115],["Gaza",31.42,34.38],["Gaza Strip",31.42,34.38],["West Bank",31.95,35.25],["Crimea",45.3,34.4],["Donbas",48.2,38],
  ["Kashmir",34.1,74.8],["Darfur",13.5,24.0],["Catalonia",41.8,1.5],["Tibet",31.0,88.0],["Xinjiang",41.0,85.0],["Tigray",14.0,39.0],["Sicily",37.6,14.1],
  ["Sardinia",40.1,9.0],["Bavaria",48.9,11.4],["Siberia",60,100],["Patagonia",-45,-69],["Sahel",15,0],["Geneva",46.2,6.15],["The Hague",52.08,4.3],["Davos",46.8,9.84],
  ["Strasbourg",48.58,7.75],["Rafah",31.29,34.25],["Khan Younis",31.35,34.3],["Bethlehem",31.7,35.2],["Jenin",32.46,35.3],["Nablus",32.22,35.26],["Hebron",31.53,35.1],
  ["Ramallah",31.9,35.2],["Tel Aviv",32.08,34.78],["Jerusalem",31.78,35.22],["Haifa",32.8,35.0],["El Fasher",13.63,25.35],["Port Sudan",19.6,37.2],["Kidal",18.44,1.41],
  ["Timbuktu",16.77,-3.0],["Goma",-1.68,29.23],["Kherson",46.64,32.6],["Sevastopol",44.6,33.52],["Idlib",35.93,36.63],["Fukushima",37.75,140.47],["Chernobyl",51.27,30.22],
  ["Pokrovsk",48.28,37.18],["Kursk",51.73,36.19],["Belgorod",50.6,36.6],["Sumy",50.9,34.8],["Hodeidah",14.8,42.95],["Aden",12.8,45.03],["Marib",15.46,45.33],
  ["Taiz",13.58,44.02],["Erbil",36.19,44.01],["Kirkuk",35.47,44.39],["Raqqa",35.95,39.01],["Latakia",35.52,35.78],["Sidon",33.56,35.37],["Tyre",33.27,35.2],
  ["Nuuk",64.18,-51.72],["Merowe",18.48,31.82],["Pristina",42.66,21.17],["Fairford",51.71,-1.78],["Rabat",34.02,-6.84],["Sanaa",15.37,44.19],["Sana'a",15.37,44.19]];
// "Washington" in the news is the capital; the state is "Washington state".
const DC=["Washington, D.C.","Washington DC","Washington","D.C."];
// Seas and straits: a pin with no country lit up.
const WATER=[["Strait of Hormuz",26.6,56.4],["Hormuz",26.6,56.4],["Red Sea",20,38.5],["Black Sea",43.2,34],["Mediterranean",35,18],["South China Sea",12,114],
  ["Taiwan Strait",24.5,119.5],["Persian Gulf",27,51],["Gulf of Aden",12.5,48],["English Channel",50.2,-1.5],["Baltic Sea",58,20],["Caribbean",15,-75],
  ["Gulf of Mexico",25,-90],["Gulf of America",25,-90],["Arabian Sea",15,65],["Sea of Japan",40,135],["Bab el-Mandeb",12.6,43.3],["Suez Canal",30.5,32.35],
  ["Panama Canal",9.1,-79.7],["North Sea",56,3],["Aegean",39,25],["Sea of Azov",46,36.5],["Caspian Sea",42,50.5],["Strait of Gibraltar",35.95,-5.6]];
// Too often a person's name or a plain word to trust in a story's text; they count only as "Name, State" or as a story's own `place`.
const RISKY={
  world:new Set(["Chad","Jordan","Jersey","Georgetown","Victoria","Kingston","Hamilton","Male","Santiago","Valencia","Cordoba","Merida","San Juan","Leon","Medina",
    "Surrey","Markham","Vaughan","Santos","Natal","Serra","Guadalupe","Batman","Van","Kirov","Vladimir","Engels","Constantine","Jos","Soledad","Florence","Toyota",
    "Kawasaki","Nice","Sale","Salem","Halifax"]),
  us:new Set(["Columbus","Jackson","Lincoln","Madison","Charlotte","Austin","Aurora","Henderson","Arlington","Irving","Chandler","Garland","Gilbert","Norman",
    "Lafayette","Orlando","Mesa","Independence","Surprise","Hollywood","Columbia","Concord","Frisco","Springfield","Glendale","Pasadena","Peoria","Salem","Orange",
    "Elizabeth","Lakewood","Westminster","Everett","Thornton","Hampton","Kent","Cambridge","Warren","Cary","Fremont","Richardson","Tyler","Davenport","Ontario",
    "Billings","Pueblo","Odessa","Miramar","Mobile","Paradise","Enterprise","Brandon","Jamaica","Chinatown","Koreatown","Vista","Corona","Montgomery","Lowell",
    "Edison","Eugene","Davie","Chesapeake","Meads","Universal City","Athens","Alexandria","Manhattan","Victoria"])};
const regionByName={};P.regions.forEach((r,i)=>{if(!(r[0] in regionByName)||!r[3])regionByName[r[0]]=i+1});
let grid=null;const SIZE=[]; // cells per region, for zooming the map to fit
const BASE=document.currentScript?document.currentScript.src:new URL("news/visuals.js",location.href).href;
const ready=(async()=>{try{
  if(typeof DecompressionStream!=="function")return;
  const res=await fetch(new URL("world-map.bin",BASE));if(!res.ok)return;
  const buf=await new Response(res.body.pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer();
  grid=new Uint16Array(buf);
  for(let i=0;i<grid.length;i++)if(grid[i])SIZE[grid[i]]=(SIZE[grid[i]]||0)+1;
}catch(e){grid=null}})();
function regionAt(lat,lon){if(!grid)return 0;const r=Math.floor((90-lat)/P.res),c=((Math.floor((lon+180)/P.res)%P.w)+P.w)%P.w;return r<0||r>=P.h?0:grid[r*P.w+c]}

// One finder per scope. "world" knows countries, provinces, big world cities, seas and the US states; "us" knows only US places.
function finder(scope){
  const T=new Map(),add=(name,target)=>{name=fold(name);if(name&&!T.has(name))T.set(name,target)};
  const region=(id,label)=>({name:label||P.regions[id-1][0],lat:P.regions[id-1][1],lon:P.regions[id-1][2],rid:id,kind:"region",us:P.regions[id-1][3]==="US"});
  const dc=regionByName["District of Columbia"];
  DC.forEach(n=>add(n,{name:"Washington, D.C.",lat:38.9,lon:-77.04,rid:dc,kind:"city",us:true}));
  if(regionByName.Washington){add("Washington state",region(regionByName.Washington));add("Washington State",region(regionByName.Washington))}
  if(scope==="world"){
    Object.entries(ALIAS).forEach(([a,n])=>{if(regionByName[n])add(a,region(regionByName[n],n==="Dem. Rep. Congo"?"DR Congo":n))});
    P.regions.forEach((r,i)=>{if(!r[3]&&!/\.$/.test(r[0]))add(r[0],region(i+1))});
    P.regions.forEach((r,i)=>{if(r[3]&&r[0]!=="Georgia")add(r[0],region(i+1))});
    P.cities.forEach(c=>{if(!c[4])add(c[0],{name:c[0],lat:c[1],lon:c[2],rid:c[3],kind:"city",us:false})});
    EXTRA.forEach(([n,la,lo])=>add(n,{name:n==="Sana'a"?"Sanaa":n,lat:la,lon:lo,rid:null,kind:"city",us:false}));
    Object.entries(DEMONYM).forEach(([d,n])=>{const tg=T.get(fold(n));if(tg){add(d,tg);if(!/(ese|ish|ch|ss)$/.test(d))add(d+"s",tg)}});
    WATER.forEach(([n,la,lo])=>add(n,{name:n==="Hormuz"?"Strait of Hormuz":n,lat:la,lon:lo,rid:0,kind:"water"}));
  }else{
    P.regions.forEach((r,i)=>{if(r[3])add(r[0],region(i+1))});
    if(regionByName["Puerto Rico"])add("Puerto Rico",region(regionByName["Puerto Rico"]));
    P.cities.forEach(c=>{if(c[4])add(c[0],{name:c[0],lat:c[1],lon:c[2],rid:c[3],kind:"city",us:true})});
  }
  const names=[...T.keys()].sort((a,b)=>b.length-a.length).map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"));
  const re=new RegExp("(^|[^A-Za-z])("+names.join("|")+")(?![A-Za-z])","g");
  return {T,re};
}
const FIND={};
function matches(text,scope,strict){
  const f=FIND[scope]||(FIND[scope]=finder(scope)),out=[],s=fold(text);let m;f.re.lastIndex=0;
  while((m=f.re.exec(s))){const name=m[2],tg=f.T.get(name);
    if(strict&&RISKY[scope].has(name)){
      // a risky city name counts only as "Name, State" (Jackson, Mississippi)
      const rest=s.slice(m.index+m[0].length);if(!(tg.kind==="city"&&/^,\s*[A-Z]/.test(rest)))continue}
    out.push(tg)}
  return out;
}
// Extra places carry no region id; it is read off the map once the map has loaded.
const ridOf=tg=>tg.rid===null?regionAt(tg.lat,tg.lon):tg.rid;
// The most precise place: the first place named, or a city or province inside it named later.
function bestOf(list){
  if(!list.length)return null;
  const first=list[0];
  if(first.kind==="region"){const inner=list.find(x=>x!==first&&x.kind!=="water"&&x.name!==first.name&&ridOf(x)===first.rid);if(inner)return inner}
  return first;
}
function locate(s,desk){
  const scope=desk==="national"?"us":"world";
  if(s.place){const tg=bestOf(matches(s.place,scope,false));if(tg)return tg}
  if(desk==="intl"&&s.place)return null;          // a place we can't read: no guessing from the text
  const tg=bestOf(matches(s.h,scope,true))||bestOf(matches(s.b,scope,true));
  if(tg&&desk==="national"&&!tg.us)return null;
  return tg;
}

/* ---------- categories ---------- */
const CATS=[
  ["obit","REMEMBERING",/\b(dies|died at|dead at \d+)\b/i,true],
  ["courts","COURTS",/\b(court|courts|judge|judges|trial|jury|guilty|plead|pleads|pleaded|lawsuit|sues|sued|indict\w*|prosecut\w*|justice department|DOJ|execution|sentenced|verdict|acquit\w*|denaturali[sz]\w*|attorney general)\b/i],
  ["election","ELECTION",/\b(election|elections|vote|votes|voting|voters?|ballots?|polls|referendum|elected|reelection|re-election|candidates?)\b/i],
  ["immigration","IMMIGRATION",/\b(ICE|[Ii]mmigra\w*|[Mm]igrants?|[Dd]eport\w*|[Aa]sylum|[Bb]order [Pp]atrol|[Rr]efugees?)\b/],
  ["health","HEALTH",/\b(health|hospitals?|flu|ebola|virus|vaccin\w*|disease|outbreak|medicaid|medicare|cancer|CDC|doctors?|nurses?|patients?|pandemic|measles|covid|FDA|legionella)\b/i],
  ["protest","PROTEST",/\b(protest\w*|demonstrat\w*|riot\w*|marches|marched)\b/i],
  ["maritime","AT SEA",/\b(ships?|tankers?|vessels?|boats?|shipping|cargo|crew|ferry|coast guard|sank|sinks|sunk)\b/i],
  ["conflict","CONFLICT",/\b(war|wars|air strikes?|attacks?|attacked|missiles?|drones?|troops|military|army|rebels?|militants?|bomb\w*|ceasefire|cease-fire|airstrikes?|shelling|invasion|hostages?|houthis?|hamas|hezbollah|insurgents?|soldiers?|weapons?|forces|fighting|RSF)\b/i],
  ["fire","FIRE",/\b(wildfires?|fires?|blaze|burn\w*)\b/i],
  ["quake","EARTHQUAKE",/\b(earthquakes?|quakes?|tsunami|volcano\w*|eruption)\b/i],
  ["storm","STORM",/\b(storms?|hurricanes?|typhoons?|cyclones?|flood\w*|tornado\w*|blizzard|drought|heat wave)\b/i],
  ["government","GOVERNMENT",/\b(parliament|congress|senate|lawmakers|speaker|prime minister|ministers?|cabinet|government|White House|Pentagon|FCC|FBI|EPA)\b/i],
  ["energy","ENERGY",/\b(oil|gas prices|pipelines?|OPEC|solar|nuclear plant|power grid|electricity|energy|coal|reservoir)\b/i],
  ["tech","TECH",/\b(AI|artificial intelligence|tech|chips?|data centers?|cyber\w*|hack\w*|software|apps?|internet|social media|spyware|Pegasus)\b/],
  ["media","MEDIA",/\b(film|films|movies?|TV|television|Emmys?|Oscars?|Hollywood|actor|actress|streaming|music|singer|album|Broadway|Disney|journalists?|newspapers?|broadcast\w*|Prime Video|Paramount|Warner)\b/],
  ["education","EDUCATION",/\b(schools?|college|colleges|universit\w*|students?|teachers?|classes|campus)\b/i],
  ["travel","TRAVEL",/\b(jets?|flights?|airlines?|airports?|planes?|trains?|rail\w*|transit|subway)\b/i],
  ["money","ECONOMY",/(\$\d|\b(econom\w*|inflation|prices|rates?|mortgages?|jobs|unemploy\w*|stocks?|markets?|tariffs?|trade|banks?|tax|taxes|budget|debt|wages?|rent|vouchers?)\b)/i]];
const SPORTS=[["baseball","BASEBALL",/\b(MLB|baseball|ALDS|NLDS|ALCS|NLCS|World Series|innings?|homered|homers?|home runs?|pitch\w*|Dodgers|Braves|Yankees|Mets|Red Sox|White Sox|Rays|Cubs|Phillies|Astros|Mariners|Guardians|Padres|Brewers|Orioles|Royals|Blue Jays|Twins|Diamondbacks|Rockies|Marlins|Nationals)\b/],
  ["football","FOOTBALL",/\b(NFL|[Ff]ootball|touchdowns?|quarterbacks?|Super Bowl|field goals?|Heisman|refs)\b/],
  ["basketball","BASKETBALL",/\b(NBA|WNBA|[Bb]asketball|March Madness|dunks?)\b/],
  ["hockey","HOCKEY",/\b(NHL|[Hh]ockey|Stanley Cup|puck|goalies?|Ovechkin)\b/],
  ["soccer","SOCCER",/\b([Ss]occer|MLS|World Cup|Premier League|Champions League|FIFA|UEFA|NWSL)\b/],
  ["tennis","TENNIS",/\b([Tt]ennis|Wimbledon|ATP|WTA)\b/],
  ["golf","GOLF",/\b([Gg]olf|PGA|LPGA|Ryder Cup)\b/],
  ["racing","RACING",/\b(Formula 1|Formula One|F1|Grand Prix|NASCAR|IndyCar)\b/]];
function category(s,desk){
  const list=desk==="sports"?SPORTS:CATS,txt=[s.h,s.b];
  for(const t of txt)for(const c of list){if(c[3]&&t!==s.h)continue;if(c[2].test(fold(t)))return c[0]}
  return null;
}
const LABEL={};CATS.concat(SPORTS).forEach(c=>LABEL[c[0]]=c[1]);

/* What a story shows. desk comes from the beat: world, intl, national, politics, business, sports. */
function forStory(s,base){
  const desk=base.scene==="intl"?"intl":base.wall==="world"?"world":base.wall==="nation"?"national":["politics","business","sports"].includes(base.wall)?base.wall:null;
  if(!desk||!s)return null;
  const pin=["world","intl","national"].includes(desk)?locate(s,desk):null,cat=category(s,desk);
  if(!pin&&!cat)return null;
  return {desk,pin,cat};
}

/* ---------- drawing ---------- */
let G=null,S=1,X0=0,Y0=0;
const R=(c,x,y,w,h)=>{G.fillStyle=c;G.fillRect(X0+Math.round(x)*S,Y0+Math.round(y)*S,Math.round(w)*S,Math.round(h)*S)};
function disc(cx,cy,r,c){for(let y=-r;y<=r;y++){const w=Math.floor(Math.sqrt(r*r-y*y));R(c,cx-w,cy+y,w*2+1,1)}}
function rngf(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

const SEA="#123a6e",SEA2="#16457f",SURF="#2f6fb0",LAND="#3f8a55",LAND2="#4fa063",EDGE="#2b6040",LIT="#f2b632",LITE="#b07a10";
const CONUS={lat:37.5,lon:-96,w:60,h:27};
const maps=new Map();
// Renders the map for a pin once (cell by cell from the grid) and keeps it.
function mapCanvas(pin,w,h){
  const key=pin.name+"|"+pin.lat+"|"+w+"x"+h;if(maps.has(key))return maps.get(key);
  // degrees of latitude per pixel: zoom in on a small country, out on a big one
  const rid=ridOf(pin),span=rid>0&&SIZE[rid]?Math.sqrt(SIZE[rid])*P.res:8;
  let lat0=pin.lat,lon0=pin.lon,deg=Math.max(.25,Math.min(pin.kind==="region"?.6:.45,span*3.2/w));
  if(pin.kind==="water")deg=.4;
  const inConus=pin.us&&pin.lat>24&&pin.lat<50&&pin.lon>-126&&pin.lon<-66;
  if(inConus){lat0=CONUS.lat;lon0=CONUS.lon;deg=Math.max(CONUS.w*Math.cos(lat0*Math.PI/180)/w,CONUS.h/h)}
  lat0=Math.max(-60+h*deg/2,Math.min(82-h*deg/2,lat0));
  const k=Math.cos(lat0*Math.PI/180),c=document.createElement("canvas");c.width=w;c.height=h;
  const cx=c.getContext("2d"),img=cx.createImageData(w,h),id=new Int32Array(w*h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)id[y*w+x]=regionAt(lat0+(h/2-y-.5)*deg,lon0+(x-w/2+.5)*deg/k);
  const col=hexes=>hexes.map(h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)]);
  const [cSea,cSea2,cSurf,cLand,cLand2,cEdge,cLit,cLite]=col([SEA,SEA2,SURF,LAND,LAND2,EDGE,LIT,LITE]);
  const hl=pin.kind==="water"?-1:ridOf(pin);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x,v=id[i];let c3;
    const r=x+1<w?id[i+1]:v,d=y+1<h?id[i+w]:v,l=x>0?id[i-1]:v,u=y>0?id[i-w]:v;
    if(!v){const lat=lat0+(h/2-y-.5)*deg,lon=lon0+(x-w/2+.5)*deg/k;
      c3=(r||d||l||u)?cSurf:(Math.abs(lat%10)<deg||Math.abs(lon%10)<deg/k)?cSea2:cSea}
    else if(v===hl)c3=(r!==v&&r)||(d!==v&&d)?cLite:cLit;
    else c3=(r!==v&&r&&r!==hl)||(d!==v&&d&&d!==hl)?cEdge:(v%3?cLand:cLand2);
    img.data.set([c3[0],c3[1],c3[2],255],i*4)}
  cx.putImageData(img,0,0);
  const px=w/2+(pin.lon-lon0)*k/deg,py=h/2-(pin.lat-lat0)/deg;
  const out={c,px:Math.round(px),py:Math.round(py)};maps.set(key,out);if(maps.size>40)maps.delete(maps.keys().next().value);
  return out;
}
function drawPin(px,py,t){
  const bob=Math.floor(t/350)%2,ring=Math.floor(t/120)%12;
  if(ring<8){const r=2+ring;G.globalAlpha=1-ring/8;for(let a=0;a<24;a++){const ax=Math.round(px+Math.cos(a/24*Math.PI*2)*r),ay=Math.round(py+Math.sin(a/24*Math.PI*2)*r*.6);R("#ffffff",ax,ay,1,1)}G.globalAlpha=1}
  R("#05071a",px-1,py,3,1);
  R("#7a1418",px,py-6-bob,1,6);
  disc(px,py-9-bob,3,"#e5383b");R("#ff8a8c",px-1,py-11-bob,1,1);R("#7a1418",px+2,py-8-bob,1,1);
}
function label(txt,s,x,y,c){txt(String(s).toUpperCase().replace(/[^A-Z0-9 .:\-\/]/g," ").replace(/\s+/g," ").trim(),X0+x*S,Y0+y*S,c,S)}
function drawMap(v,w,h,t,txt){
  const m=mapCanvas(v.pin,w,h);
  G.imageSmoothingEnabled=false;G.drawImage(m.c,X0,Y0,w*S,h*S);
  drawPin(Math.max(2,Math.min(w-3,m.px)),Math.max(12,Math.min(h-2,m.py)),t);
  const name=String(v.pin.name);const lw=Math.min(w,name.length*4+5);
  R("#05071acc",0,h-9,lw,9);label(txt,name.slice(0,Math.floor((w-5)/4)),3,h-7,"#f2b632");
  R("#05071acc",0,0,v.desk==="national"?35:23,9);label(txt,v.desk==="national"?"NATIONAL":v.desk==="intl"?"ABROAD":"WORLD",3,2,"#ffffff");
}

/* Category art. Each draws a w x h panel (about 128 x 72, or 100 x 52 at double size) in its own colours. */
const ART={
  obit(w,h,t){R("#1a1426",0,0,w,h);const cx=w/2|0;R("#e9e4d8",cx-4,h-26,9,20);R("#c8c0b0",cx+3,h-26,2,20);R("#3a2a1a",cx-10,h-7,21,3);
    const f=Math.floor(t/160)%3;disc(cx,h-31,3,"#f2b632");R("#fff2b0",cx,h-34-f,1,4);R("#ff8a3a",cx-1,h-30,3,2);
    G.globalAlpha=.12;disc(cx,h-31,16,"#ffd77a");G.globalAlpha=1},
  courts(w,h,t){R("#3a2418",0,0,w,h);for(let i=0;i<w;i+=10)R("#442c1e",i,0,5,h);const cx=w/2|0,cy=h/2|0,up=Math.floor(t/600)%2;
    R("#6b4a2e",cx-22,cy+10,44,6);R("#8a6440",cx-22,cy+10,44,2);           // block
    R("#c9a26a",cx-6,cy-14+up*4,4,22);R("#8a6440",cx-12,cy-18+up*4,16,8);R("#c9a26a",cx-12,cy-18+up*4,16,2); // gavel
    R("#e9e4d8",cx+18,cy-12,1,22);R("#e9e4d8",cx+8,cy-12,21,1);R("#e9e4d8",cx+7,cy-4,6,2);R("#e9e4d8",cx+24,cy-4,6,2);R("#e9e4d8",cx+15,cy+10,7,2)},
  election(w,h,t){R("#1d2766",0,0,w,h);for(let i=0;i<h;i+=8)R("#212c74",0,i,w,4);const cx=w/2|0,cy=h/2+6|0,k=(t%1800)/1800;
    R("#f4f5fb",cx-6,cy-30+Math.round(k*18),12,9);R("#c8283a",cx-4,cy-28+Math.round(k*18),2,2);R("#253282",cx-1,cy-28+Math.round(k*18),5,1);
    R("#e3e7f0",cx-18,cy-10,36,26);R("#b9bfd0",cx-18,cy-10,36,3);R("#05071a",cx-8,cy-9,16,2);R("#c8283a",cx-18,cy+4,36,4);txtSmall("VOTE",cx-7,cy+10,"#1d2766")},
  immigration(w,h,t){R("#20304a",0,0,w,h);const cx=w/2|0,cy=h/2|0;R("#2b4a7a",cx-16,cy-18,26,36);R("#3a5f96",cx-16,cy-18,26,2);disc(cx-3,cy-4,6,"#d8c070");
    R("#2b4a7a",cx-5,cy-5,4,2);if(Math.floor(t/900)%2){R("#c8283a",cx+4,cy+2,20,12);R("#20304a",cx+6,cy+4,16,8);R("#c8283a",cx+8,cy+6,12,4)}},
  health(w,h,t){R("#0f2a3a",0,0,w,h);const cx=w/2|0;R("#e5383b",cx-4,8,9,25);R("#e5383b",cx-12,16,25,9);
    const base=h-14;for(let x=0;x<w;x++){const p=((x+Math.floor(t/30))%40);const y=p===20?base-10:p===21?base+6:p===22?base-4:base;R("#3fd28a",x,y,1,1);if(p>=20&&p<=22)R("#3fd28a",x,Math.min(y,base),1,Math.abs(y-base)+1)}},
  protest(w,h,t){R("#2a2040",0,0,w,h);R("#3a3050",0,h-12,w,12);const cols=["#f2b632","#e5383b","#f4f5fb","#7fd1c8"];
    for(let i=0;i<6;i++){const x=6+i*Math.floor((w-12)/6),b=Math.floor((t/300+i*1.7))%2;R("#8a6440",x+5,h-30-b,1,20);R(cols[i%4],x,h-40-b,12,9);R("#2a2040",x+2,h-37-b,8,1);R("#2a2040",x+2,h-35-b,6,1);
      R("#15151c",x+3,h-10-b,6,8)}},
  maritime(w,h,t){R("#9fd0f0",0,0,w,h/2);R("#1d5b9a",0,h/2|0,w,h);const sx=Math.round(((t/60)%(w+60))-50),sy=(h/2|0)-10,b=Math.floor(t/500)%2;
    R("#8a2a2a",sx,sy+6+b,44,6);R("#4a1414",sx+3,sy+12+b,38,2);R("#e9e4d8",sx+28,sy-4+b,10,10);R("#2a2f3a",sx+31,sy-10+b,4,6);
    for(let i=0;i<4;i++)R(["#f2b632","#3fae6c","#2a74d6","#e5383b"][i],sx+4+i*6,sy+b,5,6);
    for(let y=(h/2|0)+4;y<h;y+=6)for(let x=0;x<w;x+=12)R("#3a7fc0",(x+Math.floor(t/90)+y*3)%w,y,6,1)},
  conflict(w,h,t){R("#0a1a12",0,0,w,h);const cx=w/2|0,cy=h/2|0,r=Math.min(cx,cy)-4;
    for(let k=1;k<=3;k++){for(let a=0;a<64;a++)R("#1f5a3a",Math.round(cx+Math.cos(a/64*Math.PI*2)*r*k/3),Math.round(cy+Math.sin(a/64*Math.PI*2)*r*k/3),1,1)}
    R("#1f5a3a",cx-r,cy,r*2,1);R("#1f5a3a",cx,cy-r,1,r*2);const a=t/700;
    for(let i=0;i<r;i++)R("#3fd28a",Math.round(cx+Math.cos(a)*i),Math.round(cy+Math.sin(a)*i),1,1);
    const q=rngf(5);for(let i=0;i<4;i++){const ba=q()*Math.PI*2,br=q()*r*.9,d=((a-ba)%(Math.PI*2)+Math.PI*2)%(Math.PI*2);if(d<2.5){G.globalAlpha=1-d/2.5;R("#9ff0c0",Math.round(cx+Math.cos(ba)*br)-1,Math.round(cy+Math.sin(ba)*br)-1,2,2);G.globalAlpha=1}}},
  fire(w,h,t){R("#2a0f0a",0,0,w,h);R("#1a0a06",0,h-8,w,8);const cx=w/2|0;
    for(let i=0;i<9;i++){const x=cx-24+i*6,f=Math.abs(Math.sin(t/180+i*1.3)),hh=12+Math.round(f*14)+(i%3)*4;R("#e5383b",x,h-8-hh,6,hh);R("#ff8a3a",x+1,h-8-hh*.7,4,hh*.7);R("#f6e27a",x+2,h-8-hh*.35,2,hh*.35)}},
  quake(w,h,t){const sh=Math.floor(t/90)%4<2?1:-1;R("#3a2a1a",0,0,w,h);R("#6a5038",0,h/2|0,w,h);
    for(let i=0;i<4;i++){const x=10+i*Math.floor((w-20)/4)+sh,bh=14+i%2*8;R("#8a8070",x,(h/2|0)-bh,14,bh);for(let y=(h/2|0)-bh+3;y<(h/2|0);y+=5)R("#2a2438",x+3,y,3,2)}
    let x=w/2|0;for(let y=h/2|0;y<h;y+=2){x+=((y*7)%5)-2;R("#1a1008",x,y,2,2)}},
  storm(w,h,t){R("#2a3448",0,0,w,h);const cx=w/2|0;disc(cx-10,18,9,"#8a94a8");disc(cx+6,15,11,"#9aa4b8");disc(cx+18,20,7,"#8a94a8");R("#8a94a8",cx-18,20,42,8);
    for(let i=0;i<14;i++){const x=cx-20+(i*7)%42,y=30+((t/12+i*11)%(h-32));R("#7fb8ff",x,y,1,3)}
    if(Math.floor(t/1300)%4===0){R("#f6e27a",cx+2,28,2,6);R("#f6e27a",cx-1,33,4,2);R("#f6e27a",cx-1,35,2,8)}},
  government(w,h,t){R("#2b3a66",0,0,w,h);const cx=w/2|0,b=h-6;disc(cx,b-30,12,"#e9e4f3");R("#2b3a66",cx-13,b-29,27,13);
    R("#e9e4f3",cx-36,b-4,72,4);for(let i=0;i<10;i++)R("#e9e4f3",cx-32+i*7,b-22,3,18);R("#e9e4f3",cx-36,b-26,72,4);R("#e9e4f3",cx-26,b-30,52,4);
    R("#e9e4f3",cx,b-48,1,6);const wv=Math.floor(t/300)%2;R("#c8283a",cx+1,b-48+wv,6,3)},
  energy(w,h,t){R("#1a2238",0,0,w,h);R("#3a3220",0,h-8,w,8);const x=w/2-22|0,b=h-8,top=b-40;
    for(let i=0;i<=40;i++){const k=i/40,half=Math.round(2+k*10);R("#8a8070",x-half,top+i,1,1);R("#8a8070",x+half,top+i,1,1);if(i%8===0&&i)R("#8a8070",x-half,top+i,half*2+1,1)}  // derrick
    R("#8a8070",x-2,top-2,5,2);G.globalAlpha=.5+.5*Math.abs(Math.sin(t/500));R("#e5383b",x,top-4,1,2);G.globalAlpha=1;
    const bx=w/2+16|0,fl=Math.floor(t/250)%4===0;const Y=fl?"#ffffff":"#f6e27a";   // lightning bolt
    R(Y,bx+6,8,8,4);R(Y,bx+4,12,8,4);R(Y,bx+2,16,12,4);R(Y,bx+6,20,6,4);R(Y,bx+4,24,6,4);R(Y,bx+2,28,5,4);R(Y,bx,32,4,4)},
  tech(w,h,t){R("#0d2a1e",0,0,w,h);const q=rngf(3);const lines=[];for(let i=0;i<7;i++){const y=6+Math.floor(q()*(h-12)),x0=Math.floor(q()*w/2),x1=x0+20+Math.floor(q()*w/2);R("#1f6a46",x0,y,x1-x0,1);R("#3fd28a",x1,y-1,3,3);lines.push([x0,x1,y])}
    lines.forEach(([x0,x1,y],i)=>{const p=x0+((t/20+i*17)%(x1-x0));R("#c8ffe0",p,y,2,1)});
    const cx=w/2|0,cy=h/2|0;R("#2a2f3a",cx-12,cy-10,24,20);R("#3a4050",cx-10,cy-8,20,16);txtSmall("AI",cx-3,cy-2,"#3fd28a");
    for(let i=0;i<5;i++){R("#8a94a8",cx-10+i*5,cy-13,1,3);R("#8a94a8",cx-10+i*5,cy+10,1,3)}},
  media(w,h,t){R("#2a1430",0,0,w,h);const cx=w/2|0,cy=h/2|0,open=Math.floor(t/700)%2;
    R("#15151c",cx-20,cy-4,40,22);R("#f4f5fb",cx-18,cy+2,36,1);txtSmall("PBC",cx-5,cy+6,"#f4f5fb");
    G.save();for(let i=0;i<5;i++)R(i%2?"#f4f5fb":"#15151c",cx-20+i*8,cy-10-(open?4:0),8,5);G.restore();
    for(let i=0;i<w;i+=8)R(Math.floor(t/250+i/8)%2?"#f2b632":"#7a5a10",i,2,3,2)},
  education(w,h,t){R("#1f4a3a",0,0,w,h);R("#6b4a2e",0,0,w,3);R("#6b4a2e",0,h-3,w,3);const cx=w/2|0,cy=h/2|0;
    [["#c8283a",0],["#2a74d6",7],["#f2b632",14]].forEach(([c,o])=>{R(c,cx-18,cy+8-o,30,6);R("#f4efe6",cx+10,cy+9-o,2,4)});
    R("#e5383b",cx+16,cy-4,8,8);R("#3fae6c",cx+20,cy-7,3,3);R("#6b4a2e",cx+19,cy-6,1,2);
    const k=(t/40)%(w-30);R("#e9e4d8",6+k,10,1,1);R("#e9e4d8",7+k,11,4,1)},
  travel(w,h,t){R("#5aa7e0",0,0,w,h);R("#bfe3f5",0,h-14,w,14);G.globalAlpha=.7;R("#ffffff",(w-((t/50)%(w+30))),12,18,4);R("#ffffff",(w-((t/70+60)%(w+30))),28,24,4);G.globalAlpha=1;
    const px=Math.round(((t/30)%(w+40))-30),py=(h/2|0)-4+Math.round(Math.sin(t/500)*2);R("#f4f5fb",px,py,26,5);R("#e9eef6",px+24,py+1,3,3);R("#c8283a",px,py-6,4,6);R("#d0d8e8",px+9,py+4,8,6);R("#2a74d6",px+18,py+1,2,2);R("#2a74d6",px+14,py+1,2,2)},
  money(w,h,t){R("#0e2a2a",0,0,w,h);for(let i=8;i<h;i+=12)R("#163a3a",0,i,w,1);const b=h-6;
    for(let i=0;i<5;i++){const bh=8+((i*13+Math.floor(t/1200))%5)*6;R("#3fd28a",8+i*10,b-bh,7,bh)}
    const cx=w-36;for(let k=0;k<4;k++){R("#c9a030",cx,b-6-k*5,22,5);R("#f2d14a",cx,b-6-k*5,22,2)}
    const s=Math.floor(t/400)%2;disc(cx+11,b-30-s,7,"#f2d14a");txtSmall("$",cx+10,b-32-s,"#7a5a10")},
  baseball(w,h,t){R("#2c7a3a",0,0,w,h);const cx=w/2|0,b=h-6;for(let i=0;i<22;i++){R("#b5793a",cx-i,b-i,i*2+1,1)}R("#2c7a3a",cx-10,b-16,21,8);
    [[cx,b-22],[cx-21,b-2],[cx+21,b-2],[cx,b]].forEach(([x,y])=>R("#f4f5fb",x-1,y-1,3,3));
    const k=(t%2000)/2000;disc(Math.round(cx-30+k*60),Math.round(b-24-Math.sin(k*Math.PI)*20),2,"#f4f5fb")},
  football(w,h,t){R("#1f7a3a",0,0,w,h);for(let i=0;i<w;i+=12)R("#e9f5ec",i,0,1,h);const gx=w-20,b=h-8;R("#f2d14a",gx,b-20,2,20);R("#f2d14a",gx-10,b-20,22,2);R("#f2d14a",gx-10,b-34,2,14);R("#f2d14a",gx+10,b-34,2,14);
    const k=(t%2200)/2200,x=Math.round(10+k*(gx-14)),y=Math.round(b-10-Math.sin(k*Math.PI)*30);R("#8a4a22",x-3,y-1,7,3);R("#8a4a22",x-2,y-2,5,5);R("#f4f5fb",x,y,1,1)},
  basketball(w,h,t){R("#c8894a",0,0,w,h);for(let i=0;i<w;i+=8)R("#b87a3e",i,0,4,h);const hx=w-26;R("#f4f5fb",hx,8,18,12);R("#e5383b",hx+5,13,8,5);R("#e5383b",hx+3,20,12,1);
    for(let i=0;i<4;i++)R("#f4f5fb",hx+4+i*3,21,1,6);const k=(t%1600)/1600,x=Math.round(14+k*(hx-8)),y=Math.round(h-14-Math.sin(k*Math.PI)*36);disc(x,y,4,"#e07a2a");R("#5a2a10",x-4,y,9,1)},
  hockey(w,h,t){R("#e9f2f8",0,0,w,h);R("#c8283a",w/2|0,0,2,h);R("#2a74d6",w/4|0,0,2,h);R("#2a74d6",(w*3/4)|0,0,2,h);
    const k=(t%2400)/2400,px=Math.round(10+Math.abs(Math.sin(k*Math.PI*2))*(w-30));R("#15151c",px,h/2+8|0,6,3);R("#6b4a2e",px-14,h/2-12|0,2,20);R("#6b4a2e",px-14,h/2+8|0,8,2)},
  soccer(w,h,t){R("#2c8f48",0,0,w,h);for(let i=0;i<w;i+=16)R("#287f40",i,0,8,h);const gx=w-14;R("#f4f5fb",gx,10,2,h-20);R("#f4f5fb",gx,10,12,2);R("#f4f5fb",gx,h-12,12,2);
    const k=(t%1800)/1800,x=Math.round(10+k*(gx-14)),y=Math.round(h/2+Math.sin(k*Math.PI*2)*8);disc(x,y,3,"#f4f5fb");R("#15151c",x,y,1,1)},
  tennis(w,h,t){R("#3a6ab0",0,0,w,h);R("#2f8f5a",6,6,w-12,h-12);R("#f4f5fb",w/2|0,4,1,h-8);for(let y=4;y<h-4;y+=2)R("#e9e4d8",(w/2|0)-1,y,3,1);
    const k=(t%1400)/1400,x=Math.round(10+Math.abs(k*2-1)*(w-20)),y=Math.round(h/2-Math.sin(k*Math.PI*2)*10);disc(x,y,2,"#d8f04a")},
  golf(w,h,t){R("#7fc8f0",0,0,w,h);R("#3fae6c",0,h-18,w,18);disc(w-30,h-18,14,"#5fc87f");R("#7fc8f0",w-44,h-32,30,14);const fx=w-30;R("#15151c",fx-2,h-18,4,2);R("#f4f5fb",fx,h-40,1,22);
    R("#e5383b",fx+1,h-40+Math.floor(t/400)%2,8,5);const k=(t%2600)/2600;disc(Math.round(10+k*(fx-14)),Math.round(h-20-Math.sin(k*Math.PI)*24),1,"#f4f5fb")},
  racing(w,h,t){R("#3a3a44",0,0,w,h);R("#2a2a30",0,h/2-10|0,w,20);for(let x=0;x<w;x+=12)R("#e9e4d8",(x+Math.floor(t/12))%w,h/2|0,6,1);
    for(let i=0;i<8;i++)for(let j=0;j<4;j++)R((i+j)%2?"#15151c":"#f4f5fb",4+i*4,4+j*4,4,4);const cx=w/2-10|0,cy=h/2-4|0;
    R("#e5383b",cx,cy,22,5);R("#e5383b",cx+18,cy-2,6,2);R("#15151c",cx+2,cy+4,5,4);R("#15151c",cx+15,cy+4,5,4);R("#f2b632",cx+9,cy-1,3,2)}
};
let TXT=null;
function txtSmall(s,x,y,c){if(TXT)TXT(s,X0+x*S,Y0+y*S,c,S)}

/* The video wall. phase is how far through the beat we are (0-1). Returns false when the story has nothing to show, so the page keeps its usual wall. */
function wall(g,x,y,w,h,v,t,txt,phase){
  if(!v)return false;
  const hasMap=v.pin&&grid,hasArt=v.cat&&ART[v.cat];
  if(!hasMap&&!hasArt)return false;
  G=g;TXT=txt;S=w>=180?2:1;X0=x;Y0=y;const lw=Math.floor(w/S),lh=Math.floor(h/S);
  g.fillStyle="#05071a";g.fillRect(x-3,y-3,w+6,h+6);
  g.save();g.beginPath();g.rect(x,y,w,h);g.clip();
  // the map leads; the art takes over for the end of the beat (and on the beat's follow-up lines)
  const showMap=hasMap&&(!hasArt||(phase==null?(t%13000)<8500:phase<.6));
  if(showMap)drawMap(v,lw,lh,t,txt);
  else{ART[v.cat](lw,lh,t);R("#05071acc",0,0,LABEL[v.cat].length*4+5,9);label(txt,LABEL[v.cat],3,2,"#f2b632")}
  g.restore();
  return true;
}
/* A locator map for a field report (Teo abroad). */
function inset(g,x,y,w,h,v,t,txt){
  if(!v||!v.pin||!grid)return false;
  G=g;TXT=txt;S=1;X0=x;Y0=y;
  g.fillStyle="#05071a";g.fillRect(x-2,y-2,w+4,h+4);g.fillStyle="#f2b632";g.fillRect(x-2,y-2,w+4,1);
  g.save();g.beginPath();g.rect(x,y,w,h);g.clip();
  const m=mapCanvas(v.pin,w,h);g.imageSmoothingEnabled=false;g.drawImage(m.c,x,y);
  drawPin(Math.max(2,Math.min(w-3,m.px)),Math.max(12,Math.min(h-2,m.py)),t);
  const name=String(v.pin.name);R("#05071acc",0,h-9,Math.min(w,name.length*4+5),9);label(txt,name.slice(0,Math.floor((w-5)/4)),3,h-7,"#f2b632");
  g.restore();return true;
}

window.PBC_VIS={forStory,wall,inset,locate,category,ready};
})();
