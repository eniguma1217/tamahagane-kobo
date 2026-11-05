// 依頼（#17 の注文パズルを #19 で「依頼」に。owner D55）。名前が売れると「こんな刀を」と注文が来る。
// 刀掛けの刀から合うものを納める。名刀は実在の持ち主から名指し（D42）。お礼はお金と珍しい素材。
// 合わない刀はお礼が減るだけ（D47）。数字は Claude の案（GAME_SPEC G18）。
import * as R from './rules.js';
import * as M from './market.js';
import * as P from './people.js';
import {ownerOf} from './owners.js';
import {durOf} from './dive.js';

const clamp=(v,lo=0,hi=1)=>Math.max(lo,Math.min(hi,v));
const pickOf=(rng,a)=>a[Math.floor(rng()*a.length)];
const round=(v,step=100)=>Math.max(step,Math.round(v/step)*step);
// #23 (owner): orders ask for the 攻撃力 or the 耐久 (the number of ● left), no longer 切れ味・粘り・美しさ
export const STAT_NAME={atk:'攻撃力',dur:'耐久'};
const gi=id=>R.GRADES.findIndex(g=>g.id===id);
// 名前が売れるほど依頼が増える（D55）
export const ORDER_SLOTS=[1,1,2,2,3,3,3];
export const slotsFor=level=>ORDER_SLOTS[Math.max(0,Math.min(6,level))];
export const DIFF_BASE=[1,1,2,2,3,3,4];

export const orderBase=d=>round(1000*1.8**d);   // お礼のもと：★1 1,800 … ★5 18,900文
export const namedBase=tier=>5000*2**tier;      // 名指し：名物 10,000 … 天下 160,000文
export const statNeed=d=>40+10*d;               // 攻撃力の条件：★1 50 … ★5 90
export const durNeed=d=>[3,3,4,4,5][Math.max(1,Math.min(5,d))-1]; // 耐久の条件：★1 3 … ★5 5
export const durFor=tough=>2+Math.floor(tough/25);  // the 耐久 a 粘り gives (as dive.js maxDurability, without the 名刀's one more)
const openEras=open=>[...new Set(R.MATERIALS.filter(m=>open.materials.has(m.id)&&m.era&&m.id!=='inseki').map(m=>m.era))];

// the best a stat can reach with the steel of this level (perfect steps, any found pair), for this form and, if asked, this era
export function bestStat(open,formId,stat,era=null){
 let best=0;const ids=[...open.materials];
 for(const kawa of ids){if(era&&R.material(kawa).era!==era)continue;
  for(const shin of ids){const b={structure:kawa===shin?'maru':'kobuse',kawa,shin:kawa===shin?undefined:shin};
   best=Math.max(best,R.expectStats(b,formId,1,R.synergyOf(kawa,shin,formId))[stat]);}}
 return best;
}
export function makeOrder(rng,level=0,ctx={}){
 const {list=[],collection={},taken=[],named=0}=ctx;
 const open=R.openAt(level);
 if(named<1&&list.length&&rng()<0.15+0.03*level){const o=namedOrder(rng,level,list,collection,taken);if(o)return o;}
 const client=pickOf(rng,M.clientsFor(level)),person=P.newPerson(rng,client);
 const d=Math.max(1,Math.min(5,DIFF_BASE[Math.max(0,Math.min(6,level))]+(rng()<0.4?1:0)-(rng()<0.15?1:0)));
 const forms=[...open.forms],eras=openEras(open);
 const want=P.CLIENT_STAT[client]||'atk';
 const conds=[want==='dur'?{k:'dur',min:durNeed(d)}:{k:'atk',min:statNeed(d)}];
 const extra=rng()<0.5?['hamon','era']:['era','hamon'];
 for(const k of extra.slice(0,d>=4?2:d>=2?1:0))conds.push(k==='hamon'?{k:'hamon',hamon:pickOf(rng,Object.keys(R.HAMON))}:{k:'era',era:pickOf(rng,eras)});
 if(d>=5)conds.push({k:'grade',grade:'A'});
 const era=conds.find(c=>c.k==='era')?.era||null,st=conds[0],form=pickOf(rng,forms);
 if(st.k==='atk'){const top=bestStat(open,form,'sharp',era);if(st.min>top)st.min=Math.max(30,Math.floor(top/5)*5);}
 else st.min=Math.min(st.min,durFor(bestStat(open,form,'tough',era)));
 const reward=round(orderBase(d)*M.CLIENTS[client].pay*M.fameReward(level));
 const gifts=R.MATERIALS.filter(m=>open.materials.has(m.id)&&m.price>=500).sort((a,b)=>a.price-b.price);
 const gift=gifts.length&&rng()<0.5+0.05*level?gifts[Math.min(gifts.length-1,Math.floor(rng()**(1/(1+level*0.4))*gifts.length))].id:null;
 return {client,person,form,diff:d,conds,reward,gift};
}
// 名指し: the 名刀's own form, 刃文, 地鉄 (and steel), and the 技 it needs. Not yet in the 刀帳 first, easier ones while young.
export function namedOrder(rng,level,list,collection={},taken=[]){
 const open=R.openAt(level),eras=openEras(open);
 const ok=m=>{const o=ownerOf(m.n);return o&&!taken.includes('r:'+o.o)&&open.forms.has(m.t)&&(m.mat?m.mat.every(x=>open.materials.has(x)):eras.includes(m.e));};
 const all=list.filter(ok),fresh=all.filter(m=>!collection[m.n]);
 let pool=fresh.length?fresh:all;
 const easy=pool.filter(m=>m.r<=level+2);if(easy.length)pool=easy;
 if(!pool.length)return null;
 const m=pickOf(rng,pool),o=ownerOf(m.n);
 const conds=[{k:'hamon',hamon:m.h},m.mat?{k:'mats',mats:m.mat,era:m.e}:{k:'era',era:m.e},{k:'points',min:R.NEED[m.r]},{k:'meito',name:m.n}];
 const rares=R.MATERIALS.filter(x=>open.materials.has(x.id)&&x.price>=1500).map(x=>x.id);
 return {client:'real',real:true,ownerId:'r:'+o.o,form:m.t,diff:Math.min(5,1+m.r),tier:m.r,meito:m.n,ev:o.ev,conds,
  reward:round(namedBase(m.r)*M.fameReward(level)),gift:rares.length?pickOf(rng,rares):null};
}
// an order from before #23: 切れ味・美しさ become the 攻撃力, 粘り the 耐久 it gives
export function upgradeOrder(o){
 if(!o.conds?.some(c=>c.k==='stat'))return o;
 return {...o,conds:o.conds.map(c=>c.k!=='stat'?c:c.stat==='tough'?{k:'dur',min:durFor(c.min)}:{k:'atk',min:c.min})};
}
export function fillOrders(save,level,list,rngFor){
 // orders whose person is gone (the #17 regulars) leave the board
 const orders=[...(save.orders||[])].filter(o=>P.personOf(o)).map(upgradeOrder);let seq=save.seq||1;
 while(orders.length<slotsFor(level)){
  const taken=orders.flatMap(o=>o.ownerId?[o.ownerId]:[]);
  const o=makeOrder(rngFor(seq),level,{list,collection:save.collection||{},taken,named:orders.filter(x=>x.real).length});
  orders.push({id:seq,...o});seq++;
 }
 return {...save,orders,seq};
}

// ---- 条件の言葉
export function condText(c){
 if(c.k==='atk')return `攻撃力 ${c.min}以上`;
 if(c.k==='dur')return `耐久 ${c.min}以上`;
 if(c.k==='hamon')return `刃文：${R.HAMON[c.hamon].name}`;
 if(c.k==='era')return `地鉄：${R.ERAS[c.era].name}`;
 if(c.k==='mats')return `皮鉄に${R.material(c.mats[0]).name}・心鉄に${R.material(c.mats[1]).name}`;
 if(c.k==='grade')return `出来 ${c.grade}以上`;
 if(c.k==='points')return `技 ${c.min}以上`;
 if(c.k==='meito')return `名刀「${c.name}」`;
 return '';
}

// ---- 注文どおり度
export function evaluateOrder(order,sword){
 const parts=order.conds.map(c=>{
  if(c.k==='form')return {c,score:1,ok:true};
  if(c.k==='atk'){const v=sword.stats?.sharp??0;return {c,score:clamp(v/c.min),ok:v>=c.min,value:v};}
  // the 耐久 left on the sword (a worn one counts less)
  if(c.k==='dur'){const v=durOf(sword);return {c,score:clamp(v/c.min),ok:v>=c.min,value:v};}
  if(c.k==='hamon'){const ok=sword.hamon===c.hamon;return {c,score:ok?1:0,ok};}
  if(c.k==='era'){const ok=sword.era===c.era;return {c,score:ok?1:0,ok};}
  if(c.k==='mats'){const ok=sword.kawa===c.mats[0]&&sword.shin===c.mats[1];return {c,score:ok?1:0,ok};}
  if(c.k==='grade'){const ok=gi(sword.grade||'E')>=gi(c.grade);return {c,score:clamp((gi(sword.grade||'E')+1)/(gi(c.grade)+1)),ok};}
  if(c.k==='points'){const v=sword.successes||0;return {c,score:clamp(v/c.min),ok:v>=c.min,value:v};}
  if(c.k==='meito'){const ok=sword.meito===c.name;return {c,score:ok?1:0,ok};}
  return {c,score:1,ok:true};
 });
 // the form must be the one asked for; another form is no use to them
 const formOk=sword.form===order.form;
 let match=parts.reduce((t,p)=>t+p.score,0)/parts.length;
 if(order.meito&&sword.meito===order.meito)match=1;
 if(sword.crack||!formOk)match=0;
 const stars=match>=0.999?3:match>=0.8?2:match>=0.5?1:0;
 const reward=Math.round(order.reward*(stars===3?1:match*0.8)/50)*50;
 const fame=stars===3?3+2*order.diff:stars===2?1+order.diff:stars===1?1:0;
 return {parts,match,stars,reward,fame,formOk,gift:stars>=2?order.gift:null};
}
export const STARS_NAME=['不満','まずまず','満足','ぴったり'];

// ---- 納める: the sword leaves the rack; the money, the 評判 and the gift come in; the order leaves the board
export function settle(save,order,sword,result){
 const person=P.personOf(order);
 const materials={...(save.materials||{})};if(result.gift)materials[result.gift]=(materials[result.gift]||0)+1;
 const ledger=[{at:Date.now(),no:sword.no,name:sword.name,kind:'order',amount:result.reward,stars:result.stars,client:order.client,owner:person?.name,fame:result.fame},...(save.ledger||[])].slice(0,100);
 return {...save,money:(save.money??0)+result.reward,fame:Math.max(0,(save.fame||0)+result.fame),materials,ledger,
  rack:(save.rack||[]).filter(s=>s.no!==sword.no),orders:(save.orders||[]).filter(o=>o.id!==order.id)};
}
