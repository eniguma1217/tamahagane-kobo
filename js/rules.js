// The rules of 玉鋼工房 as pure functions: materials and their combination, how each forging step is scored,
// and the finished sword (stats, stars, name, price). No DOM here; the screens only call these, and tests import them.

// 素材 (#7, owner D18〜D21). era: the 地鉄 era it gives when used as 皮鉄 (a game rule, not a record of real steel);
// null = no era (no 名刀 from it as 皮鉄). price: 文 per use, paid when the forging starts.
export const MATERIALS=[
 {id:'hakusai',name:'舶載鉄',kana:'はくさいてつ',hard:3,tough:3,era:'joko',price:3000,heat:60,note:'大陸から渡ってきた鉄の延べ板'},
 {id:'chikusa',name:'千種鋼',kana:'ちくさはがね',hard:5,tough:2,era:'heian',price:2500,heat:40,note:'播磨・千種の、古くから名高い鋼'},
 {id:'jou',name:'上玉鋼',kana:'じょうたまはがね',hard:5,tough:1,era:'kamakura',price:1500,heat:45,note:'硬くて美しい。熱する色にきびしい'},
 {id:'kera',name:'鉧',kana:'けら',hard:4,tough:2,era:'nanbokucho',price:800,heat:70,note:'たたらで吹いたままの、荒い鋼の塊'},
 {id:'nami',name:'並玉鋼',kana:'なみたまはがね',hard:4,tough:2,era:'muromachi',price:300,heat:60,note:'扱いやすい玉鋼'},
 {id:'nanban',name:'南蛮鉄',kana:'なんばんてつ',hard:4,tough:3,era:'edo',price:2000,heat:55,note:'江戸の初め、越前康継が初めて刀に使った輸入の鉄'},
 {id:'kugi',name:'古釘',kana:'ふるくぎ',hard:3,tough:3,era:'kindai',price:500,heat:65,note:'古い寺の釘。幕末の刀工は古い鉄を卸して使った'},
 {id:'inseki',name:'隕鉄',kana:'いんてつ',hard:2,tough:4,era:'kindai',price:30000,heat:50,note:'隕石の鉄。やわらかく、扱いがむずかしい'},
 {id:'oroshi',name:'卸し鉄',kana:'おろしがね',hard:3,tough:3,era:null,price:0,heat:70,note:'古い鉄を卸した、ほどほどの鉄。無料'},
 {id:'houcho',name:'包丁鉄',kana:'ほうちょうてつ',hard:1,tough:5,era:null,price:0,heat:80,note:'やわらかく、よくねばる。芯に向く。無料'},
 {id:'zuku',name:'銑',kana:'ずく',hard:5,tough:0,era:null,price:100,heat:50,note:'たたらの銑鉄。とても硬いが、もろい'}
];
export const material=id=>{const m=MATERIALS.find(m=>m.id===id);if(!m)throw Error('unknown material '+id);return m;};
// 造り込み: which pieces of steel go into the blade
export const SLOTS={kawa:{name:'皮鉄',kana:'かわがね',role:'外側。地鉄の時代と攻撃力'},shin:{name:'心鉄',kana:'しんがね',role:'芯。耐久'},ha:{name:'刃鉄',kana:'はがね',role:'刃。攻撃力'},mune:{name:'棟鉄',kana:'むねがね',role:'背。耐久を足す'}};
export const STRUCTURES=[
 {id:'maru',name:'丸鍛え',slots:['kawa'],bonus:0,note:'1つの鉄だけで打つ'},
 {id:'kobuse',name:'甲伏せ',slots:['kawa','shin'],bonus:0,note:'硬い皮鉄でやわらかい心鉄を包む'},
 {id:'sanmai',name:'本三枚',slots:['kawa','shin','ha'],bonus:2,note:'皮鉄・心鉄に、刃鉄を足す'},
 {id:'shiho',name:'四方詰め',slots:['kawa','shin','ha','mune'],bonus:4,note:'刃鉄・棟鉄・皮鉄で心鉄を四方から包む'}
];
export const structure=id=>STRUCTURES.find(s=>s.id===id)||STRUCTURES[1];
// the steels a build uses, in its 造り込み's slots
export const buildMats=b=>structure(b.structure).slots.map(k=>b[k]).filter(Boolean);
export const buildCost=b=>buildMats(b).reduce((s,id)=>s+material(id).price,0);
export const buildReady=b=>structure(b.structure).slots.every(k=>b[k]);

const clamp=(v,lo=0,hi=1)=>Math.max(lo,Math.min(hi,v));
const lerp=(a,b,t)=>a+(b-a)*t;

// The pieces together: the hard outer steel sets the 攻撃力 (stats.sharp), the soft core the 粘り behind the 耐久 (stats.tough),
// the skin the era. #23 (owner): a sword is only 攻撃力 and 耐久; 美しさ is gone.
// Hard outside and soft inside is the classic 甲伏せ; a soft skin over a hard core (あべこべ) is penalised and makes no 名刀.
// combine(kawaId, shinId) is the older two-piece form.
export function combine(build,shinId){
 if(typeof build==='string')build={structure:shinId===build?'maru':'kobuse',kawa:build,shin:shinId===build?undefined:shinId};
 const st=structure(build.structure),get=k=>st.slots.includes(k)&&build[k]?material(build[k]):null;
 const kawa=get('kawa'),shin=get('shin'),ha=get('ha'),mune=get('mune');
 const bonus={sharp:st.bonus,tough:st.bonus};
 let kind=st.id;
 if(shin){
  const diff=kawa.hard-shin.hard,fix=SYNERGIES.some(x=>x.fixes&&x.kawa===kawa.id&&x.shin===shin.id);
  if(diff>0){const b=Math.min(8,2*diff);bonus.sharp+=b;bonus.tough+=b;}
  else if(diff<0&&!fix){kind='gyaku';bonus.sharp-=10;bonus.tough-=5;}
 }
 if(ha&&ha.hard>=kawa.hard)bonus.sharp+=4;
 if(mune&&mune.tough>=3)bonus.tough+=4;
 const base={sharp:(ha||kawa).hard*8,tough:(shin||kawa).tough*8+(mune?mune.tough*2:0)};
 return {kawa,shin,ha,mune,structure:st.id,kind,label:COMBO_LABEL[kind],bonus,base,heatHalf:kawa.heat,
  era:kind==='gyaku'?null:kawa.era,mats:buildMats({...build,structure:st.id}),cost:buildCost({...build,structure:st.id})};
}
export const COMBO_LABEL={maru:'丸鍛え（1つの鉄だけで打つ）',kobuse:'甲伏せ（硬い皮でやわらかい芯を包む）',sanmai:'本三枚（皮鉄・心鉄・刃鉄）',shiho:'四方詰め（刃鉄・棟鉄・皮鉄で芯を包む）',gyaku:'あべこべ（やわらかい皮で硬い芯を包む）'};

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

// ---- 叩く: a ring shrinks onto the target; tap when it meets. Five hits (#17, D39: a sword in about 30 seconds).
export const HAMMER={hits:5,foldEvery:99,startR:118,targetR:30};
export const hammerDuration=i=>950-i*40;           // ms for the ring to reach the target on hit i (0-based)
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
export const quenchHalf=kawaId=>material(kawaId).hard>=5?35:45;
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
 joko:{name:'上古',short:'上古',long:'古墳〜奈良時代'},heian:{name:'平安',short:'平安',long:'平安時代'},kamakura:{name:'鎌倉',short:'鎌倉',long:'鎌倉時代'},
 nanbokucho:{name:'南北朝',short:'南北朝',long:'南北朝時代'},muromachi:{name:'室町',short:'室町',long:'室町時代'},edo:{name:'江戸',short:'江戸',long:'安土桃山〜江戸時代'},kindai:{name:'幕末以降',short:'幕末',long:'幕末以降'}
};
// The game's rule (not a record of real steel): the 皮鉄 decides the 地鉄 era (owner D21).
export const eraOf=(kawaId,shinId)=>combine({structure:shinId?'kobuse':'maru',kawa:kawaId,shin:shinId}).era;
export const eraMaterials=era=>MATERIALS.filter(m=>m.era===era&&m.id!=='inseki');
// how to get a sword's steel, in words: the era's skin steel, or the special pieces some swords need
export function comboText(era,mats=null){
 if(mats?.length)return `皮鉄に${material(mats[0]).name}${mats.length>1?`、ほかの枠に${mats.slice(1).map(id=>material(id).name).join('・')}`:''}`;
 return `皮鉄に${eraMaterials(era).map(m=>m.name).join('か')}`;
}

// 技の点（#17、D39）：熱する1・叩く5・土置き1・焼き入れ1 の8つで、会心2点・よし1点（最大16）。研ぎは自動で点にならない。
export const SUCCESS_MAX=16;
export function successCount(run){
 const pt=g=>g==='best'?2:g==='good'?1:0;
 const hamon=run.hamon?.score??0;
 return pt(run.heat?.grade)+(run.hitGrades||[]).reduce((t,g)=>t+pt(g),0)+(hamon>=0.9?2:hamon>=0.7?1:0)+pt(run.quench?.grade);
}
// 研ぐ: done by the 弟子 now (D39); as good as the rest of the work
export const autoPolish=run=>{const m=mean([clamp(run.heat?.score??0),clamp(mean(run.hits||[])),clamp(run.quench?.score??0)]);return {coverage:1,scratches:0,score:0.6+0.4*m,auto:true};};
// 格 (r) 5 天下五剣・天下三名槍など, 4 国宝, 3 重要文化財・御物, 2 重要美術品など, 1 そのほかの名物
// owner D29 (#15) 「少し簡単に高い刀が作れすぎる」: raised from 8/10/12/14/16
export const NEED={1:10,2:12,3:14,4:15,5:16};
export const TIER_NAME={1:'名物',2:'重要美術品級',3:'重要文化財級',4:'国宝級',5:'天下の名刀'};
function hash(s){let h=2166136261;for(const ch of s){h^=ch.codePointAt(0);h=Math.imul(h,16777619)>>>0;}return h;}
// Which real sword this run made: same 形, same 刃文, same 地鉄 era, enough successes. Ones not yet in the 刀帳 come first,
// then the more famous; among equals the run itself decides, so the same run always gives the same sword.
export const matsFit=(m,mats)=>!m.mat||(mats[0]===m.mat[0]&&m.mat.slice(1).every(id=>mats.slice(1).includes(id)));
export function pickMeito(list,{form,hamon,era,mats=[],successes,crack,seed='',want=null},collection={}){
 if(crack||!era)return null;
 const c=list.filter(m=>m.t===form&&m.h===hamon&&m.e===era&&matsFit(m,mats)&&successes>=NEED[m.r]);
 if(!c.length)return null;
 // a named order's 名刀 comes first when the run makes it (#17)
 return c.slice().sort((a,b)=>((b.n===want)-(a.n===want))||(!!collection[a.n]-!!collection[b.n])||(b.r-a.r)||(hash(seed+a.n)-hash(seed+b.n)))[0];
}
// one line on why no 名刀 came out, pointing at the nearest one
export function meitoHint(list,{form,hamon,era,mats=[],kind,successes,crack}){
 const F=FORMS.find(f=>f.id===form)?.name||'刀';
 if(crack)return '焼き割れた刀は、名刀にならない。';
 if(kind==='gyaku')return 'あべこべの組み合わせ（やわらかい皮鉄）では、名刀にならない。';
 if(!era)return `${material(mats[0]).name}の皮鉄には時代の札がない。名刀にするなら、時代のある鋼を皮鉄に。`;
 const same=list.filter(m=>m.t===form&&m.h===hamon&&m.e===era&&matsFit(m,mats));
 if(same.length){const need=Math.min(...same.map(m=>NEED[m.r]));return `この形・刃文・地鉄の名刀まで、技の点があと${need-successes}。`;}
 const byEra=list.filter(m=>m.t===form&&m.e===era);
 if(byEra.length){const hs=[...new Set(byEra.map(m=>m.h))].map(h=>HAMON[h].name).slice(0,3);return `${ERAS[era].long}の${F}の名刀は、刃文が「${hs.join('・')}」。`;}
 const byHamon=list.filter(m=>m.t===form&&m.h===hamon);
 if(byHamon.length){const es=[...new Set(byHamon.map(m=>m.e))].slice(0,2);return `${HAMON[hamon].name}の${F}の名刀は、${es.map(e=>ERAS[e].long).join('・')}の地鉄（${comboText(es[0])}）。`;}
 const any=list.filter(m=>m.t===form).length;
 return any?`${F}の名刀は${any}振。刀帳でヒントを見てみよう。`:`${F}の名刀は、まだ見つかっていない。`;
}

// ---- 隠し相性 (#17, D42): some pairs of 皮鉄 and 心鉄 (and sometimes the form) work better than their numbers say.
// Found by forging them once; then listed in the 相性帳. fixes: the pair is not counted as あべこべ (流星刀 needs it).
export const SYNERGIES=[
 {id:'kobuse',kawa:'jou',shin:'houcho',name:'甲伏せの妙',fx:{tough:8},hint:'硬く美しい玉鋼で、いちばんやわらかい鉄を包む'},
 {id:'chikusa',kawa:'chikusa',shin:'houcho',name:'千種の冴え',fx:{sharp:10},hint:'播磨の名高い鋼の皮に、よくねばる芯'},
 {id:'meiko',kawa:'chikusa',shin:'jou',name:'名鋼くらべ',fx:{sharp:8},hint:'名高い鋼どうしを重ねる'},
 {id:'wayo',kawa:'nanban',shin:'kugi',name:'和洋の継ぎ',fx:{sharp:5,tough:5},hint:'海を渡った鉄と、古い寺の鉄'},
 {id:'tatara',kawa:'kera',shin:'nami',name:'たたらの粘り',fx:{tough:10},hint:'たたらから出たままの塊と、扱いやすい玉鋼'},
 {id:'kokan',kawa:'zuku',shin:'houcho',name:'硬軟の極み',fx:{sharp:12},hint:'いちばん硬い鉄と、いちばんやわらかい鉄'},
 {id:'ryusei',kawa:'inseki',shin:'jou',name:'流星',fx:{sharp:12},fixes:true,hint:'空から落ちてきた鉄に、上等の玉鋼'},
 {id:'furugane',kawa:'kugi',shin:'oroshi',name:'古鉄の生まれ変わり',fx:{sharp:6,tough:6},hint:'捨てられるはずだった古い鉄どうし'},
 {id:'muku',kawa:'nami',shin:'nami',name:'無垢の一本',fx:{tough:8},hint:'同じ玉鋼だけで打つ'},
 {id:'tairiku',kawa:'hakusai',shin:'hakusai',name:'大陸の直刀',fx:{tough:10},forms:['chokuto','ken'],hint:'大陸の鉄だけで、まっすぐな古い形を'},
 {id:'nodachi',kawa:'kera',shin:'houcho',name:'野太刀の鍛え',fx:{sharp:10},forms:['odachi','tachi'],hint:'荒い塊で、長い刀を'},
 {id:'hosaki',kawa:'nanban',shin:'houcho',name:'南蛮の穂先',fx:{sharp:8,tough:4},forms:['yari','naginata'],hint:'江戸に来た輸入の鉄で、長い柄の武器を'}
];
export function synergyOf(kawa,shin,formId){
 return SYNERGIES.find(x=>x.kawa===kawa&&x.shin===(shin||kawa)&&(!x.forms||x.forms.includes(formId)))||null;
}

// ---- 仕上がり
export const RANKS=['なまくら','並物','良品','業物','名刀'];
// 出来ランク (#9, owner D22): the top four are the names of the Edo-period cutting ranks (懐宝剣尺)
export const GRADES=[
 {id:'E',name:'なまくら',min:0},{id:'D',name:'並物',min:30},{id:'C',name:'良品',min:45},{id:'B',name:'業物',min:60},
 {id:'A',name:'良業物',min:72},{id:'S',name:'大業物',min:84},{id:'SS',name:'最上大業物',min:94}
];
export const gradeFor=(overall,crack=false)=>crack?GRADES[0]:GRADES.slice().reverse().find(g=>overall>=g.min);
const PRICE_BY_GRADE={E:200,D:700,C:2000,B:5000,A:10000,S:18000,SS:30000};
export const GRADE_VALUE=PRICE_BY_GRADE;
// 名刀ランク (#9, owner D23)
export const MEITO_RANK={1:{name:'名物',color:'#b7c0c8'},2:{name:'名品',color:'#7fb8ff'},3:{name:'重文級',color:'#c79bff'},4:{name:'国宝級',color:'#ff8a6a'},5:{name:'天下',color:'#ffd56a'}};
const MEITO_PRICE={1:20000,2:40000,3:80000,4:200000,5:600000};
export const MEITO_VALUE=MEITO_PRICE;
export const starsFor=overall=>overall<35?1:overall<52?2:overall<68?3:overall<84?4:5;
// the stats a build would give if every step went at quality q (0..1): for the materials screen's preview (#17)
export function expectStats(build,formId='katana',q=0.8,syn=null){
 const c=combine(build),f=55*q,fx=syn?.fx||{};
 const v=k=>Math.round(clamp(c.base[k]+f+c.bonus[k]+(fx[k]||0),0,100));
 return {sharp:v('sharp'),tough:v('tough')};
}
export function finishSword(run,list=[],collection={}){
 const c=combine(run.structure?run:{structure:run.shin?'kobuse':'maru',kawa:run.kawa,shin:run.shin});
 const polish=run.polish||autoPolish(run);
 const H=clamp(run.heat.score),M=clamp(mean(run.hits)),T=clamp(run.hamon.score),Q=clamp(run.quench.score),P=clamp(polish.score);
 const syn=synergyOf(c.kawa.id,c.shin?.id,run.form||'katana');
 // 攻撃力 (sharp) and the 粘り behind the 耐久 (tough); the 刃文 counts toward the 攻撃力 since #23
 let sharp=c.base.sharp+55*(0.35*Q+0.20*M+0.25*P+0.20*T)+c.bonus.sharp;
 let tough=c.base.tough+55*(0.50*M+0.30*H+0.20*Q)+c.bonus.tough;
 if(run.heat.grade==='burn'){sharp-=5;tough-=10;}
 if(syn){sharp+=syn.fx.sharp||0;tough+=syn.fx.tough||0;}
 const crack=!!run.quench.crack;
 if(crack){sharp*=0.6;tough*=0.35;}
 const stats={sharp:Math.round(clamp(sharp,0,100)),tough:Math.round(clamp(tough,0,100))};
 const overall=Math.round((stats.sharp+stats.tough)/2);
 const stars=crack?1:starsFor(overall);
 const formId=run.form||'katana',successes=successCount(run);
 const pick={form:formId,hamon:run.hamon.type,era:c.era,mats:c.mats,kind:c.kind,successes,crack,seed:`${stats.sharp}-${stats.tough}`,want:run.want||null};
 const meito=pickMeito(list,pick,collection);
 const grade=gradeFor(overall,crack);
 const price=meito?Math.round(MEITO_PRICE[meito.r]*(0.85+overall/200)/100)*100:Math.round(PRICE_BY_GRADE[grade.id]*(0.85+overall/200)/50)*50;
 return {name:meito?meito.n:`無銘の${form(formId).name}`,meito:meito?meito.n:null,tier:meito?meito.r:0,form:formId,era:c.era,successes,
  synergy:syn?.id||null,hint:meito?null:meitoHint(list,pick),stars,rank:RANKS[stars-1],grade:grade.id,gradeName:grade.name,stats,overall,price,crack,
  hamon:run.hamon.type,profile:run.hamon.profile,sori:soriFor(Q),kawa:c.kawa.id,shin:c.shin?.id||null,ha:c.ha?.id||null,mune:c.mune?.id||null,structure:c.structure,combo:c.kind,cost:c.cost,
  steps:{heat:H,hammer:M,hamon:T,quench:Q,polish:P}};
}

// ---- 評判で増えるもの (#17, D45: the 鍛冶師ランク became the shop's 評判). Level i opens what UNLOCKS[i] lists; it adds up.
export const UNLOCKS=[
 {forms:['katana','wakizashi','tanto'],materials:['nami','jou','oroshi','houcho','zuku']},
 {forms:['tachi'],materials:['kera']},
 {forms:['odachi'],materials:['chikusa','kugi']},
 {forms:['naginata','yari'],materials:['nanban']},
 {forms:['ken','chokuto'],materials:['hakusai']},
 {forms:[],materials:['inseki']},
 {forms:[],materials:[]}
];
export function openAt(level=0){
 const open={forms:new Set(),materials:new Set()};
 for(const u of UNLOCKS.slice(0,Math.max(0,Math.min(UNLOCKS.length-1,level))+1)){u.forms.forEach(x=>open.forms.add(x));u.materials.forEach(x=>open.materials.add(x));}
 return open;
}
// the 評判 level that first opens a form or material
export function opensAt(kind,id){const i=UNLOCKS.findIndex(u=>u[kind].includes(id));return i<0?null:i;}
export function seededRandom(seed){let s=(seed>>>0)||1;return ()=>((s=Math.imul(s^(s>>>15),2246822519)^Math.imul(s^(s>>>13),3266489917))>>>0)/4294967296;}

// ---- 鋼の色: temperature (°C) to the colour the steel glows.
const GLOW=[[500,[42,40,44]],[650,[92,26,16]],[800,[176,37,15]],[950,[232,87,26]],[1100,[255,180,58]],[1200,[255,240,138]],[1300,[255,255,255]]];
export function steelRGB(temp){
 if(temp<=GLOW[0][0])return GLOW[0][1].slice();
 for(let i=1;i<GLOW.length;i++)if(temp<=GLOW[i][0]){const [t0,c0]=GLOW[i-1],[t1,c1]=GLOW[i],t=(temp-t0)/(t1-t0);return c0.map((v,k)=>Math.round(lerp(v,c1[k],t)));}
 return GLOW.at(-1)[1].slice();
}
