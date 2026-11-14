// 必殺技（#26、owner：「波紋によって必殺技が作られるみたいにできる？」→ 刃文の種類＋描いた形、斬るたびにたまる）。
// 刃文の種類で技の中身が、描いた形（山の数・高さ）となぞりの出来で回数と威力が決まる。同じ刃文でも刀ごとに少しちがう。
// 斬るたびに気が1たまり、KI_MAX で撃てる。数字は Claude の案（GAME_SPEC G21）。
import * as R from './rules.js';

export const KI_MAX=3;
const clamp=(v,lo=0,hi=1)=>Math.max(lo,Math.min(hi,v));
const KAN=['〇','一','二','三','四','五','六','七','八','九','十'];

// the 必殺技 a sword's 刃文 makes. mult: each hit, times the sword's strike; pct: part of the foe's full 体力 added to the first hit;
// crit: every hit is 会心; wild: [lowest, highest] times the strike; cost: 耐久 it takes; heal: 耐久 it gives back
export function wazaOf(s){
 const type=R.HAMON[s.hamon]?s.hamon:s.hamon==='midare'?'omidare':'suguha';   // 'midare' is from the first version's records
 const profile=Array.isArray(s.profile)&&s.profile.length>8?s.profile:R.canonicalHamon(type,7);
 const f=R.hamonFeatures(profile),q=0.85+0.3*clamp(s.steps?.hamon??0.7);
 const base={type,hits:1,mult:1,pct:0,crit:false,wild:null,cost:1,heal:0,q};
 if(type==='gunome'){const n=Math.max(3,Math.min(5,f.peaks));return {...base,name:`${KAN[n]}ツ山斬り`,text:`${n}回続けて斬る`,hits:n,mult:0.6*q};}
 if(type==='choji'){const n=Math.max(6,Math.min(9,f.peaks));return {...base,name:`乱れ咲き・${KAN[n]}連`,text:`${n}つの小さな連撃が、すべて会心`,hits:n,mult:0.3*q,crit:true};}
 if(type==='togari'){const n=Math.max(3,Math.min(6,f.peaks));return {...base,name:`${KAN[n]}ツ牙突き`,text:'耐久を使わない、鋭い突き',mult:(1.1+0.1*n)*q,cost:0};}
 if(type==='notare'){const big=clamp(f.amp/0.35);return {...base,name:f.peaks>=2?'二重波斬り':'大波斬り',text:'敵の体力を大きく削る',mult:q,pct:0.2+0.15*big};}
 if(type==='komidare')return {...base,name:'さざなみ',text:'3回斬って、耐久を1戻す',hits:3,mult:0.5*q,heal:1};
 if(type==='omidare'){const big=clamp(f.amp/0.45);return {...base,name:big>0.85?'大嵐':'嵐',text:'威力が大きくばらつく大技',wild:[0.5*q,(3+2*big)*q]};}
 if(type==='hitatsura')return {...base,name:'皆焼の焔',text:'特大の一撃（耐久を2使う）',mult:4.4*q,cost:2};
 return {...base,name:'一文字斬り',text:'まっすぐな、大きい一撃',mult:2.2*q};
}
// the hits of one 必殺技 against a foe, for a strike of this power (stops when the foe falls)
export function wazaHits(w,power,foe,rng){
 const out=[];let hp=foe.hp;
 for(let k=0;k<w.hits&&hp>0;k++){
  const m=w.wild?w.wild[0]+(w.wild[1]-w.wild[0])*rng():w.mult;
  const dmg=Math.max(1,Math.round(power*m*(w.crit?1.5:1)+(k===0&&w.pct?foe.maxHp*w.pct:0)));
  out.push(dmg);hp-=dmg;
 }
 return out;
}
