// The rules of 玉鋼工房 as pure functions: materials and their combination, how each forging step is scored,
// and the finished sword (stats, stars, name, price). No DOM here; the screens only call these, and tests import them.

export const MATERIALS=[
 {id:'jou',name:'上玉鋼',kana:'じょうたまはがね',hard:5,tough:1,beauty:5,note:'硬くて美しい。熱する色にきびしい'},
 {id:'nami',name:'並玉鋼',kana:'なみたまはがね',hard:4,tough:2,beauty:3,note:'扱いやすい玉鋼'},
 {id:'oroshi',name:'卸し鉄',kana:'おろしがね',hard:3,tough:3,beauty:2,note:'古い鉄を卸した、ほどほどの鉄'},
 {id:'houcho',name:'包丁鉄',kana:'ほうちょうてつ',hard:1,tough:5,beauty:1,note:'やわらかく、よくねばる'}
];
export const material=id=>{const m=MATERIALS.find(m=>m.id===id);if(!m)throw Error('unknown material '+id);return m;};

const clamp=(v,lo=0,hi=1)=>Math.max(lo,Math.min(hi,v));
const lerp=(a,b,t)=>a+(b-a)*t;

// 皮鉄 (outer, becomes the edge) and 心鉄 (inner core). Hard outside and soft inside is the classic 甲伏せ.
export function combine(kawaId,shinId){
 const kawa=material(kawaId),shin=material(shinId),diff=kawa.hard-shin.hard;
 let kind,bonus;
 if(diff>0){kind='kobuse';const b=Math.min(8,2*diff);bonus={sharp:b,tough:b,beauty:b};}
 else if(diff===0){kind='maru';bonus={sharp:0,tough:0,beauty:0};}
 else{kind='gyaku';bonus={sharp:-10,tough:-5,beauty:0};}
 return {kawa,shin,kind,label:COMBO_LABEL[kind],bonus,
  base:{sharp:kawa.hard*8,tough:shin.tough*8,beauty:kawa.beauty*8},
  heatHalf:HEAT_HALF[kawa.id]};
}
export const COMBO_LABEL={kobuse:'甲伏せ（硬い皮でやわらかい芯を包む）',maru:'丸鍛え（同じ鉄だけで打つ）',gyaku:'あべこべ（やわらかい皮で硬い芯を包む）'};
// The harder and finer the outer steel, the narrower the right colour when heating.
const HEAT_HALF={jou:45,nami:60,oroshi:70,houcho:80};

// ---- 熱する: hold to blow the bellows, let go at the right colour.
export const HEAT={start:650,center:1100,burn:1280,tooEarly:900};
// Temperature rise per second while blowing (accelerates as the fire takes), and cooling when not.
export const heatRate=temp=>90+(temp-600)*0.35;
export const heatCool=40;
export function heatScore(temp,half){
 if(temp>=HEAT.burn)return {score:0.15,grade:'burn',label:'沸かしすぎ'};
 const d=Math.abs(temp-HEAT.center);
 if(d<=half*0.4)return {score:1,grade:'best',label:'会心'};
 if(d<=half)return {score:lerp(1,0.7,(d-half*0.4)/(half*0.6)),grade:'good',label:'よし'};
 const side=temp<HEAT.center?'ぬるい':'熱い';
 if(d<=half*2.5)return {score:lerp(0.7,0.25,(d-half)/(half*1.5)),grade:'weak',label:side};
 return {score:0.15,grade:'bad',label:side==='ぬるい'?'冷たい':'熱すぎ'};
}

// ---- 叩く: a ring shrinks onto the target; tap when it meets. 12 hits, a fold after every 4.
export const HAMMER={hits:12,foldEvery:4,startR:118,targetR:30};
export const hammerDuration=i=>1000-i*25;          // ms for the ring to reach the target on hit i (0-based)
export const hammerWindow=heat=>70+50*clamp(heat); // a well-heated steel is more forgiving
export function hitScore(errMs,windowMs){
 const e=Math.abs(errMs);
 if(e<=windowMs*0.4)return {score:1,grade:'best',label:'会心'};
 if(e<=windowMs)return {score:0.7,grade:'good',label:'よし'};
 if(e<=windowMs*2)return {score:0.35,grade:'weak',label:'あまい'};
 return {score:0,grade:'miss',label:'空振り'};
}
export const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:0;

// ---- 土置き: the traced line across the blade becomes the 刃文.
// points: {x,y} with x 0..1 along the blade (元→先) and y 0..1 across the band (0 刃先 side … 1 鎬 side).
// Eight kinds, told apart by height, size, how many waves, how even they are and how pointed (owner D15: real hamon names).
export const HAMON_N=96;
export const HAMON={
 suguha:{name:'直刃',kana:'すぐは',how:'まっすぐ引く'},
 komidare:{name:'小乱れ',kana:'こみだれ',how:'小さく、ばらばらにゆらす'},
 notare:{name:'湾れ',kana:'のたれ',how:'大きくゆったり、1〜2回うねらせる'},
 gunome:{name:'互の目',kana:'ぐのめ',how:'丸い山（∩）を3〜5つ、大きく同じ間かくで'},
 choji:{name:'丁子',kana:'ちょうじ',how:'丸い山（∩）を6つ以上、大きくぎっしり'},
 togari:{name:'尖り刃',kana:'とがりば',how:'とがった山（Λ）を3つ以上、大きくそろえて'},
 omidare:{name:'大乱れ',kana:'おおみだれ',how:'大きく、ばらばらに'},
 hitatsura:{name:'皆焼',kana:'ひたつら',how:'鎬（上）の近くの高いところを通す'}
};
// names of older records (the first version had three kinds)
export const HAMON_NAME={...Object.fromEntries(Object.entries(HAMON).map(([k,v])=>[k,v.name])),midare:'乱れ刃'};
// local tops that stand out by at least minProm above the lower of the two valleys reaching the next higher ground
function peaksOf(p,minProm){
 const out=[];
 for(let i=1;i<p.length-1;i++){
  if(!(p[i]>=p[i-1]&&p[i]>p[i+1]))continue;
  let l=p[i],r=p[i];
  for(let j=i-1;j>=0&&p[j]<=p[i];j--)l=Math.min(l,p[j]);
  for(let j=i+1;j<p.length&&p[j]<=p[i];j++)r=Math.min(r,p[j]);
  if(p[i]-Math.max(l,r)>=minProm)out.push(i);
 }
 return out;
}
export function hamonFeatures(profile){
 const amp=Math.max(...profile)-Math.min(...profile),avg=mean(profile);
 const major=peaksOf(profile,Math.max(0.045,amp*0.25)),minor=peaksOf(profile,0.035);
 const gaps=major.slice(1).map((p,i)=>p-major[i]);
 const cv=gaps.length>1?Math.sqrt(mean(gaps.map(g=>(g-mean(gaps))**2)))/mean(gaps):1;
 const heights=major.map(i=>profile[i]);
 const heightSpread=heights.length>1?Math.sqrt(mean(heights.map(h=>(h-mean(heights))**2)))/Math.max(0.01,amp):1;
 // how full each head is between its two valleys: round heads (∩) fill much of their box, pointed ones (Λ) half or less
 const fills=[];
 for(let k=1;k<major.length;k++){
  const a=major[k-1],b=major[k];let v=a;for(let i=a;i<=b;i++)if(profile[i]<profile[v])v=i;
  if(k>1)fills.push(fillOf(profile,fills.lastValley,v));
  fills.lastValley=v;
 }
 const fill=fills.length?mean(fills):0.5;
 const jitter=mean(profile.slice(2).map((v,i)=>Math.abs(v-2*profile[i+1]+profile[i])));
 return {amp,avg,peaks:major.length,minor:minor.length,cv,heightSpread,fill,jitter};
}
function fillOf(p,from,to){
 const base=i=>p[from]+(p[to]-p[from])*(i-from)/Math.max(1,to-from);
 let area=0,top=0;for(let i=from;i<=to;i++){const d=p[i]-base(i);area+=Math.max(0,d);top=Math.max(top,d);}
 return top>0?area/(top*(to-from+1)):0.5;
}
export function classifyHamon(f){
 if(f.avg>=0.66)return {type:'hitatsura',form:1};
 if(f.amp<0.12)return {type:'suguha',form:1-Math.min(1,f.jitter*30)};
 // even heads of the same height, with no extra wiggles between them
 if(f.peaks>=3&&f.cv<0.3&&f.amp>=0.24&&f.heightSpread<0.15&&f.minor<=f.peaks*1.5+1){
  const form=1-Math.min(1,f.cv*1.5);
  if(f.fill<0.46)return {type:'togari',form};
  return {type:f.peaks>=6?'choji':'gunome',form};
 }
 if(f.minor<=2)return {type:'notare',form:1-Math.min(1,f.jitter*20)};
 if(f.amp>=0.3)return {type:'omidare',form:Math.min(1,f.amp/0.45)};
 return {type:'komidare',form:Math.min(1,f.amp/0.25)};
}
export function analyzeHamon(points){
 const pts=points.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)).slice().sort((a,b)=>a.x-b.x);
 if(pts.length<2)return {ok:false,reason:'short'};
 const covered=clamp(pts.at(-1).x)-clamp(pts[0].x);
 if(covered<0.75)return {ok:false,reason:'short'};
 const out=pts.filter(p=>p.y<0.1||p.y>0.92).length/pts.length;
 const raw=[];
 for(let i=0;i<HAMON_N;i++){
  const x=(i+0.5)/HAMON_N;let y;
  if(x<=pts[0].x)y=pts[0].y;else if(x>=pts.at(-1).x)y=pts.at(-1).y;
  else{let j=1;while(pts[j].x<x)j++;const a=pts[j-1],b=pts[j],t=b.x===a.x?0:(x-a.x)/(b.x-a.x);y=lerp(a.y,b.y,t);}
  raw.push(clamp(y,0.06,0.94));
 }
 const profile=raw.map((_,i)=>mean(raw.slice(Math.max(0,i-1),i+2)));
 const f=hamonFeatures(profile),{type,form}=classifyHamon(f);
 const quality=clamp(1-out*1.5);
 return {ok:true,type,name:HAMON[type].name,score:clamp(quality*(0.6+0.4*clamp(form))),
  profile:profile.map(v=>Math.round(v*100)/100),outside:out,features:f};
}
// a typical line of each kind, for drawing the swords in the 刀帳 (and for the tests: each must read back as its kind)
export function canonicalHamonFn(type,seed=1){
 let s=seed>>>0||1;const r=()=>((s=Math.imul(s^(s>>>15),2246822519)^Math.imul(s^(s>>>13),3266489917))>>>0)/4294967296;
 const ph=r()*0.5,r1=r(),r2=r(),r3=r(),r4=r();
 const tri=t=>{const f=t-Math.floor(t);return f<0.5?f*2:2-f*2;};
 // a round head (∩) between sharp valleys
 const head=t=>{const f=t-Math.floor(t);return Math.sqrt(Math.max(0,1-(2*f-1)**2));};
 const wave={
  suguha:x=>0.42+0.012*Math.sin(x*9+ph),
  komidare:x=>0.42+0.04*Math.sin(x*(26+r1*14)+ph)+0.04*Math.sin(x*(43+r2*18)+ph*3)+0.035*Math.sin(x*(67+r3*22)+ph*5)+0.03*Math.sin(x*(97+r4*25)),
  notare:x=>0.45+0.16*Math.sin(x*Math.PI*2*1.3+ph),
  gunome:x=>0.26+0.42*head(x*4+ph),
  choji:x=>0.24+0.5*head(x*7+ph)**0.8,
  togari:x=>0.28+0.38*tri(x*4.5+ph)**1.6,
  omidare:x=>0.45+0.19*Math.sin(x*13+ph)+0.15*Math.sin(x*31+ph*2)+0.08*Math.sin(x*53),
  hitatsura:x=>0.76+0.06*Math.sin(x*17+ph)
 }[type];
 return x=>clamp(wave(x),0.06,0.94);
}
export function canonicalHamon(type,seed=1){const f=canonicalHamonFn(type,seed);return Array.from({length:HAMON_N},(_,i)=>Math.round(f((i+0.5)/HAMON_N)*100)/100);}

// ---- 焼き入れ: the blade heats by itself; tap at the right colour to plunge it into the water.
export const QUENCH={start:600,center:800,crack:900,auto:960};
export const quenchRate=temp=>80+(temp-600)*0.6;
export const quenchHalf=kawaId=>kawaId==='jou'?35:45;
export function quenchScore(temp,half){
 if(temp>=QUENCH.crack)return {score:0.1,grade:'crack',label:'焼き割れ',crack:true};
 const d=Math.abs(temp-QUENCH.center);
 if(d<=half*0.4)return {score:1,grade:'best',label:'会心',crack:false};
 if(d<=half)return {score:lerp(1,0.7,(d-half*0.4)/(half*0.6)),grade:'good',label:'よし',crack:false};
 if(temp<QUENCH.center)return {score:lerp(0.6,0.25,clamp((d-half)/(QUENCH.center-half-QUENCH.start))),grade:'weak',label:'焼きが甘い',crack:false};
 return {score:lerp(0.55,0.3,clamp((temp-QUENCH.center-half)/(QUENCH.crack-QUENCH.center-half))),grade:'weak',label:'熱すぎ',crack:false};
}
export const soriFor=q=>0.35+0.65*clamp(q); // the curve the blade takes in the water

// ---- 研ぐ: rub the clouded blade clear; too fast leaves scratches.
export const POLISH={seconds:20,fastPxPerMs:2.4,scratchCooldownMs:400};
export const polishScore=(coverage,scratches)=>clamp(clamp(coverage)**1.5-0.08*scratches);

// ---- 形・時代・名刀（owner D10〜D17）
export const FORMS=[
 {id:'tachi',name:'太刀',note:'反りが深く長い。刃を下にして腰に吊るす',bar:0.95},
 {id:'katana',name:'打刀',note:'いちばんよく知られた刀。刃を上にして腰に差す',bar:0.85},
 {id:'wakizashi',name:'脇差',note:'打刀より短い、二本目の刀',bar:0.68},
 {id:'tanto',name:'短刀',note:'30cmほどの短い刀',bar:0.5},
 {id:'odachi',name:'大太刀',note:'人の背たけほどもある長い太刀',bar:1},
 {id:'naginata',name:'薙刀',note:'長い柄の先につける、先の反った刃',bar:0.75},
 {id:'yari',name:'槍',note:'まっすぐな両刃の穂先',bar:0.5},
 {id:'ken',name:'剣',note:'まっすぐな両刃',bar:0.65},
 {id:'chokuto',name:'直刀',note:'反りのない、古い時代の片刃の刀',bar:0.85}
];
export const form=id=>FORMS.find(f=>f.id===id)||FORMS[1];
export const ERAS={
 joko:{name:'上古',long:'古墳〜奈良時代'},heian:{name:'平安',long:'平安時代'},kamakura:{name:'鎌倉',long:'鎌倉時代'},
 nanbokucho:{name:'南北朝',long:'南北朝時代'},muromachi:{name:'室町',long:'室町時代'},edo:{name:'江戸',long:'安土桃山〜江戸時代'},kindai:{name:'幕末以降',long:'幕末以降'}
};
// The game's rule (not a record of real steel): which 地鉄 era a combination of 皮鉄 and 心鉄 makes.
// Same steel both sides (丸鍛え) is the oldest way; the six 甲伏せ combinations run from 平安 to 幕末; あべこべ makes none.
export const ERA_COMBO={heian:['jou','houcho'],kamakura:['jou','oroshi'],nanbokucho:['jou','nami'],muromachi:['nami','houcho'],edo:['nami','oroshi'],kindai:['oroshi','houcho']};
export function eraOf(kawaId,shinId){
 if(kawaId===shinId)return 'joko';
 return Object.keys(ERA_COMBO).find(e=>ERA_COMBO[e][0]===kawaId&&ERA_COMBO[e][1]===shinId)||null;
}
export const comboText=era=>era==='joko'?'皮鉄と心鉄に同じ素材（丸鍛え）':`皮鉄 ${material(ERA_COMBO[era][0]).name}＋心鉄 ${material(ERA_COMBO[era][1]).name}`;

// 成功数: 熱する1・叩く12・土置き1・焼き入れ1・研ぐ1 の「会心・よし」の数（最大16）
export const SUCCESS_MAX=16;
export function successCount(run){
 const ok=g=>g==='best'||g==='good';
 return (ok(run.heat?.grade)?1:0)+(run.hitGrades||[]).filter(ok).length+((run.hamon?.score??0)>=0.7?1:0)
  +(ok(run.quench?.grade)?1:0)+((run.polish?.coverage??0)>=0.95&&(run.polish?.scratches??1)===0?1:0);
}
// 格 (r) 5 天下五剣・天下三名槍など, 4 国宝, 3 重要文化財・御物, 2 重要美術品など, 1 そのほかの名物
export const NEED={1:8,2:10,3:12,4:14,5:16};
export const TIER_NAME={1:'名物',2:'重要美術品級',3:'重要文化財級',4:'国宝級',5:'天下の名刀'};
function hash(s){let h=2166136261;for(const ch of s){h^=ch.codePointAt(0);h=Math.imul(h,16777619)>>>0;}return h;}
// Which real sword this run made: same 形, same 刃文, same 地鉄 era, enough successes. Ones not yet in the 刀帳 come first,
// then the more famous; among equals the run itself decides, so the same run always gives the same sword.
export function pickMeito(list,{form,hamon,kawa,shin,successes,crack,seed=''},collection={}){
 if(crack)return null;
 const era=eraOf(kawa,shin);if(!era)return null;
 const c=list.filter(m=>m.t===form&&m.h===hamon&&m.e===era&&successes>=NEED[m.r]);
 if(!c.length)return null;
 return c.slice().sort((a,b)=>(!!collection[a.n]-!!collection[b.n])||(b.r-a.r)||(hash(seed+a.n)-hash(seed+b.n)))[0];
}
// one line on why no 名刀 came out, pointing at the nearest one
export function meitoHint(list,{form,hamon,kawa,shin,successes,crack}){
 const F=FORMS.find(f=>f.id===form)?.name||'刀';
 if(crack)return '焼き割れた刀は、名刀にならない。';
 const era=eraOf(kawa,shin);
 if(!era)return 'あべこべの組み合わせ（やわらかい皮鉄）では、名刀にならない。';
 const same=list.filter(m=>m.t===form&&m.h===hamon&&m.e===era);
 if(same.length){const need=Math.min(...same.map(m=>NEED[m.r]));return `この形・刃文・地鉄の名刀まで、成功があと${need-successes}つ。`;}
 const byEra=list.filter(m=>m.t===form&&m.e===era);
 if(byEra.length){const hs=[...new Set(byEra.map(m=>m.h))].map(h=>HAMON[h].name).slice(0,3);return `${ERAS[era].long}の${F}の名刀は、刃文が「${hs.join('・')}」。`;}
 const byHamon=list.filter(m=>m.t===form&&m.h===hamon);
 if(byHamon.length){const es=[...new Set(byHamon.map(m=>m.e))].slice(0,2);return `${HAMON[hamon].name}の${F}の名刀は、${es.map(e=>ERAS[e].long).join('・')}の地鉄（${comboText(es[0])}）。`;}
 const any=list.filter(m=>m.t===form).length;
 return any?`${F}の名刀は${any}振。刀帳でヒントを見てみよう。`:`${F}の名刀は、まだ見つかっていない。`;
}

// ---- 仕上がり
export const RANKS=['なまくら','並物','良品','業物','名刀'];
const PRICE_BASE=[200,900,3000,8000,20000];
const MEITO_PRICE={1:20000,2:40000,3:80000,4:200000,5:600000};
export const starsFor=overall=>overall<35?1:overall<52?2:overall<68?3:overall<84?4:5;
export function finishSword(run,list=[],collection={}){
 const c=combine(run.kawa,run.shin);
 const H=clamp(run.heat.score),M=clamp(mean(run.hits)),T=clamp(run.hamon.score),Q=clamp(run.quench.score),P=clamp(run.polish.score);
 let sharp=c.base.sharp+55*(0.45*Q+0.25*M+0.30*P)+c.bonus.sharp;
 let tough=c.base.tough+55*(0.50*M+0.30*H+0.20*Q)+c.bonus.tough;
 let beauty=c.base.beauty+55*(0.35*P+0.35*T+0.30*H)+c.bonus.beauty;
 if(run.heat.grade==='burn'){tough-=10;beauty-=10;}
 const crack=!!run.quench.crack;
 if(crack){sharp*=0.6;tough*=0.35;}
 const stats={sharp:Math.round(clamp(sharp,0,100)),tough:Math.round(clamp(tough,0,100)),beauty:Math.round(clamp(beauty,0,100))};
 const overall=Math.round((stats.sharp+stats.tough+stats.beauty)/3);
 const stars=crack?1:starsFor(overall);
 const formId=run.form||'katana',successes=successCount(run);
 const pick={form:formId,hamon:run.hamon.type,kawa:c.kawa.id,shin:c.shin.id,successes,crack,seed:`${stats.sharp}-${stats.tough}-${stats.beauty}`};
 const meito=pickMeito(list,pick,collection);
 const price=meito?Math.round(MEITO_PRICE[meito.r]*(0.85+overall/200)/100)*100:Math.round(PRICE_BASE[stars-1]*(0.85+overall/200)/50)*50;
 return {name:meito?meito.n:`無銘の${form(formId).name}`,meito:meito?meito.n:null,tier:meito?meito.r:0,form:formId,era:eraOf(c.kawa.id,c.shin.id),successes,
  hint:meito?null:meitoHint(list,pick),stars,rank:RANKS[stars-1],stats,overall,price,crack,
  hamon:run.hamon.type,profile:run.hamon.profile,sori:soriFor(Q),kawa:c.kawa.id,shin:c.shin.id,combo:c.kind,
  steps:{heat:H,hammer:M,hamon:T,quench:Q,polish:P}};
}

// ---- 鋼の色: temperature (°C) to the colour the steel glows.
const GLOW=[[500,[42,40,44]],[650,[92,26,16]],[800,[176,37,15]],[950,[232,87,26]],[1100,[255,180,58]],[1200,[255,240,138]],[1300,[255,255,255]]];
export function steelRGB(temp){
 if(temp<=GLOW[0][0])return GLOW[0][1].slice();
 for(let i=1;i<GLOW.length;i++)if(temp<=GLOW[i][0]){const [t0,c0]=GLOW[i-1],[t1,c1]=GLOW[i],t=(temp-t0)/(t1-t0);return c0.map((v,k)=>Math.round(lerp(v,c1[k],t)));}
 return GLOW.at(-1)[1].slice();
}
