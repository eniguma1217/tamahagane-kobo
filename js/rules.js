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
export const HAMON_N=40;
export const HAMON_NAME={suguha:'直刃',gunome:'互の目',midare:'乱れ刃'};
export function analyzeHamon(points){
 const pts=points.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)).slice().sort((a,b)=>a.x-b.x);
 if(pts.length<2)return {ok:false,reason:'short'};
 const covered=clamp(pts.at(-1).x)-clamp(pts[0].x);
 if(covered<0.75)return {ok:false,reason:'short'};
 const out=pts.filter(p=>p.y<0.12||p.y>0.88).length/pts.length;
 const raw=[];
 for(let i=0;i<HAMON_N;i++){
  const x=(i+0.5)/HAMON_N;let y;
  if(x<=pts[0].x)y=pts[0].y;else if(x>=pts.at(-1).x)y=pts.at(-1).y;
  else{let j=1;while(pts[j].x<x)j++;const a=pts[j-1],b=pts[j],t=b.x===a.x?0:(x-a.x)/(b.x-a.x);y=lerp(a.y,b.y,t);}
  raw.push(clamp(y,0.08,0.92));
 }
 const profile=raw.map((_,i)=>mean(raw.slice(Math.max(0,i-1),i+2)));
 const amp=Math.max(...profile)-Math.min(...profile);
 const peaks=[];
 for(let i=1;i<HAMON_N-1;i++){
  if(profile[i]>=profile[i-1]&&profile[i]>profile[i+1]){
   const left=Math.min(...profile.slice(Math.max(0,i-5),i)),right=Math.min(...profile.slice(i+1,i+6));
   if(profile[i]-Math.max(left,right)>=0.06)peaks.push(i);
  }
 }
 const gaps=peaks.slice(1).map((p,i)=>p-peaks[i]);
 const cv=gaps.length>1?Math.sqrt(mean(gaps.map(g=>(g-mean(gaps))**2)))/mean(gaps):1;
 const jitter=mean(profile.slice(2).map((v,i)=>Math.abs(v-2*profile[i+1]+profile[i])));
 let type,form;
 if(amp<0.15){type='suguha';form=1-Math.min(1,jitter*25);}
 else if(peaks.length>=3&&cv<0.4){type='gunome';form=1-Math.min(1,cv*1.5);}
 else{type='midare';form=Math.min(1,amp/0.4);}
 const quality=clamp(1-out*1.5);
 return {ok:true,type,name:HAMON_NAME[type],score:clamp(quality*(0.6+0.4*clamp(form))),
  profile:profile.map(v=>Math.round(v*100)/100),outside:out};
}

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

// ---- 仕上がり
export const RANKS=['なまくら','並物','良品','業物','名刀'];
const PRICE_BASE=[200,900,3000,8000,20000];
export const starsFor=overall=>overall<35?1:overall<52?2:overall<68?3:overall<84?4:5;
export function finishSword(run){
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
 const price=Math.round(PRICE_BASE[stars-1]*(0.85+overall/200)/50)*50;
 return {name:swordName(stats,run.hamon.type,stars),stars,rank:RANKS[stars-1],stats,overall,price,crack,
  hamon:run.hamon.type,profile:run.hamon.profile,sori:soriFor(Q),kawa:c.kawa.id,shin:c.shin.id,combo:c.kind,
  steps:{heat:H,hammer:M,hamon:T,quench:Q,polish:P}};
}

// 銘: a two-kanji name from the 刃文 and the strongest quality, the same results always give the same name.
const HAMON_KANJI={suguha:['澄','凛','静','白'],gunome:['連','波','鈴','雲'],midare:['嵐','焔','龍','雷']};
const STAT_KANJI={sharp:['月','牙','光'],tough:['岩','松','鉄'],beauty:['花','雪','霞']};
function hash(s){let h=2166136261;for(const ch of s){h^=ch.codePointAt(0);h=Math.imul(h,16777619)>>>0;}return h;}
export function swordName(stats,hamonType,stars){
 const top=Object.entries(stats).sort((a,b)=>b[1]-a[1]||(a[0]<b[0]?-1:1))[0][0];
 const h=hash(`${stats.sharp}-${stats.tough}-${stats.beauty}-${hamonType}`);
 const a=HAMON_KANJI[hamonType][h%HAMON_KANJI[hamonType].length],b=STAT_KANJI[top][(h>>>8)%STAT_KANJI[top].length];
 return stars>=5?`名刀 ${a}${b}`:stars===4?`${a}${b}`:`${a}${b}丸`;
}

// ---- 鋼の色: temperature (°C) to the colour the steel glows.
const GLOW=[[500,[42,40,44]],[650,[92,26,16]],[800,[176,37,15]],[950,[232,87,26]],[1100,[255,180,58]],[1200,[255,240,138]],[1300,[255,255,255]]];
export function steelRGB(temp){
 if(temp<=GLOW[0][0])return GLOW[0][1].slice();
 for(let i=1;i<GLOW.length;i++)if(temp<=GLOW[i][0]){const [t0,c0]=GLOW[i-1],[t1,c1]=GLOW[i],t=(temp-t0)/(t1-t0);return c0.map((v,k)=>Math.round(lerp(v,c1[k],t)));}
 return GLOW.at(-1)[1].slice();
}
