// 注文パズル（#17、owner D38〜D47）。注文は3枚から選ぶ。条件（能力・刃文・地鉄の時代・出来）を読んで素材を選び、
// 30秒で打つ。注文どおり度で ★0〜3・お礼・評判が決まり、刀は注文した人と旅に出る（journey.js）。
// 名刀は実在の持ち主の名指し注文（D42）。合わない刀はお礼が減るだけ（D47）。数字は Claude の案（GAME_SPEC G17）。
import * as R from './rules.js';
import * as M from './market.js';
import * as J from './journey.js';
import {ownerOf} from './owners.js';

export const ORDERS_MAX=3;
const clamp=(v,lo=0,hi=1)=>Math.max(lo,Math.min(hi,v));
const pickOf=(rng,a)=>a[Math.floor(rng()*a.length)];
const round=(v,step=100)=>Math.max(step,Math.round(v/step)*step);
export const STAT_NAME={sharp:'切れ味',tough:'粘り',beauty:'美しさ'};
const gi=id=>R.GRADES.findIndex(g=>g.id===id);

export const orderBase=d=>round(1000*1.8**d);   // お礼のもと：★1 1,800 … ★5 18,900文
export const namedBase=tier=>5000*2**tier;      // 名指し：名物 10,000 … 天下 160,000文
export const statNeed=d=>40+10*d;               // 能力の条件：★1 50 … ★5 90
// the eras the open steel can give as 皮鉄
const openEras=open=>[...new Set(R.MATERIALS.filter(m=>open.materials.has(m.id)&&m.era&&m.id!=='inseki').map(m=>m.era))];

// the best a stat can reach with the open steel (perfect steps, any found pair), for this form and, if asked, this era
export function bestStat(open,formId,stat,era=null){
 let best=0;const ids=[...open.materials];
 for(const kawa of ids){if(era&&R.material(kawa).era!==era)continue;
  for(const shin of ids){const b={structure:kawa===shin?'maru':'kobuse',kawa,shin:kawa===shin?undefined:shin};
   best=Math.max(best,R.expectStats(b,formId,1,R.synergyOf(kawa,shin,formId))[stat]);}}
 return best;
}
// ---- 注文をつくる
export function makeOrder(rng,level=0,ctx={}){
 const {list=[],collection={},regulars=[],taken=[],named=0}=ctx;
 const open=R.openAt(level);
 // 名指し (D42): a real owner asks for their 名刀 by name; one at a time
 if(named<1&&list.length&&rng()<0.12+0.03*level){const o=namedOrder(rng,level,list,collection,taken);if(o)return o;}
 // a regular comes back with an order fit for their 得意 (D36)
 const idle=regulars.filter(p=>!p.journey&&!taken.includes(p.id));
 const reg=idle.length&&rng()<0.3?pickOf(rng,idle):null;
 const client=reg?(reg.client in M.CLIENTS?reg.client:'bushi'):pickOf(rng,M.clientsFor(level));
 const person=reg||J.newPerson(rng,client,level);
 const d=Math.max(1,Math.min(5,J.BASE_STAR[Math.max(0,Math.min(6,level))]+(rng()<0.4?1:0)-(rng()<0.15?1:0)+(reg?Math.floor((reg.lv-1)/2):0)));
 const forms=[...open.forms],eras=openEras(open);
 const kind=J.JOURNEYS[client]?client:'bushi',main=J.mainStat(J.JOURNEYS[kind].w);
 const conds=[{k:'stat',stat:reg?reg.skill:main,min:statNeed(d)}];
 const extra=rng()<0.5?['hamon','era']:['era','hamon'];
 for(const k of extra.slice(0,d>=4?2:d>=2?1:0))conds.push(k==='hamon'?{k:'hamon',hamon:pickOf(rng,Object.keys(R.HAMON))}:{k:'era',era:pickOf(rng,eras)});
 if(d>=5)conds.push({k:'grade',grade:'A'});
 // no order that cannot be met: the stat asked never passes what the open steel can reach with this form and era
 const era=conds.find(c=>c.k==='era')?.era||null,st=conds[0],form=pickOf(rng,forms),top=bestStat(open,form,st.stat,era);
 if(st.min>top)st.min=Math.max(30,Math.floor(top/5)*5);
 const reward=round(orderBase(d)*M.CLIENTS[client].pay*M.fameReward(level)*(reg?1.2:1));
 const gifts=R.MATERIALS.filter(m=>open.materials.has(m.id)&&m.price>=500).sort((a,b)=>a.price-b.price);
 const gift=gifts.length&&rng()<M.fameGift(level)?gifts[Math.min(gifts.length-1,Math.floor(rng()**(1/(1+level*0.4))*gifts.length))].id:null;
 const o={client,form,diff:d,conds,reward,gift,journey:{type:kind,title:J.JOURNEYS[kind].titles[d-1],star:d}};
 return reg?{...o,ownerId:reg.id,regular:true}:{...o,person};
}
// 名指しの注文: the 名刀's own form, 刃文, 地鉄 (and steel), and the 技 it needs. Not yet in the 刀帳 first, and
// easier ones while the shop is young.
export function namedOrder(rng,level,list,collection={},taken=[]){
 const open=R.openAt(level),eras=openEras(open);
 const ok=m=>{const o=ownerOf(m.n);return o&&!taken.includes('r:'+o.o)&&open.forms.has(m.t)&&(m.mat?m.mat.every(x=>open.materials.has(x)):eras.includes(m.e));};
 const all=list.filter(ok),fresh=all.filter(m=>!collection[m.n]);
 let pool=fresh.length?fresh:all;
 const easy=pool.filter(m=>m.r<=level+2);if(easy.length)pool=easy;
 if(!pool.length)return null;
 const m=pickOf(rng,pool),o=ownerOf(m.n);
 const conds=[{k:'hamon',hamon:m.h},m.mat?{k:'mats',mats:m.mat,era:m.e}:{k:'era',era:m.e},{k:'points',min:R.NEED[m.r]},{k:'meito',name:m.n}];
 return {client:'real',real:true,ownerId:'r:'+o.o,form:m.t,diff:Math.min(5,1+m.r),tier:m.r,meito:m.n,conds,
  reward:round(namedBase(m.r)*M.fameReward(level)),gift:null,journey:J.realJourneyFor(m)};
}
// fill the board up to three; ids from the save's own counter
export function fillOrders(save,level,list,rngFor){
 const orders=[...(save.orders||[])];let seq=save.seq||1;
 while(orders.length<ORDERS_MAX){
  // nobody is asked twice at once, and nobody away on a journey
  const taken=[...orders.flatMap(o=>o.ownerId?[o.ownerId]:[]),...(save.owners||[]).filter(p=>p.journey).map(p=>p.id)];
  const o=makeOrder(rngFor(seq),level,{list,collection:save.collection||{},regulars:(save.owners||[]).filter(p=>p.regular),taken,named:orders.filter(x=>x.real).length});
  orders.push({id:seq,...o});seq++;
 }
 return {...save,orders,seq};
}

// ---- 条件の言葉
export function condText(c){
 if(c.k==='stat')return `${STAT_NAME[c.stat]} ${c.min}以上`;
 if(c.k==='hamon')return `刃文：${R.HAMON[c.hamon].name}`;
 if(c.k==='era')return `地鉄：${R.ERAS[c.era].name}`;
 if(c.k==='mats')return `皮鉄に${R.material(c.mats[0]).name}・心鉄に${R.material(c.mats[1]).name}`;
 if(c.k==='grade')return `出来 ${c.grade}以上`;
 if(c.k==='points')return `技 ${c.min}以上`;
 if(c.k==='meito')return `名刀「${c.name}」`;
 return '';
}
// how to meet it, in a few words (the 刀帳's hint, for the named orders)
export function condHow(c){
 if(c.k==='hamon')return R.HAMON[c.hamon].how;
 if(c.k==='era')return R.comboText(c.era);
 if(c.k==='points')return '会心2点・よし1点（最大16）';
 return '';
}

// ---- 注文どおり度 (D47: a sword that does not fit only brings less)
export function evaluateOrder(order,sword){
 const parts=order.conds.map(c=>{
  if(c.k==='stat'){const v=sword.stats?.[c.stat]??0;return {c,score:clamp(v/c.min),ok:v>=c.min,value:v};}
  if(c.k==='hamon'){const ok=sword.hamon===c.hamon;return {c,score:ok?1:0,ok,value:R.HAMON_NAME[sword.hamon]||''};}
  if(c.k==='era'){const ok=sword.era===c.era;return {c,score:ok?1:0,ok,value:sword.era?R.ERAS[sword.era].name:'なし'};}
  if(c.k==='mats'){const ok=sword.kawa===c.mats[0]&&sword.shin===c.mats[1];return {c,score:ok?1:0,ok,value:''};}
  if(c.k==='grade'){const ok=gi(sword.grade||'E')>=gi(c.grade);return {c,score:clamp((gi(sword.grade||'E')+1)/(gi(c.grade)+1)),ok,value:sword.grade};}
  if(c.k==='points'){const v=sword.successes||0;return {c,score:clamp(v/c.min),ok:v>=c.min,value:v};}
  if(c.k==='meito'){const ok=sword.meito===c.name;return {c,score:ok?1:0,ok,value:sword.meito||'無銘'};}
  return {c,score:1,ok:true};
 });
 let match=parts.reduce((t,p)=>t+p.score,0)/parts.length;
 if(order.meito&&sword.meito===order.meito)match=1;
 if(sword.crack)match=0;
 const stars=sword.crack?0:match>=0.999?3:match>=0.8?2:match>=0.5?1:0;
 const reward=sword.crack?0:Math.round(order.reward*(stars===3?1:match*0.8)/50)*50;
 const fame=stars===3?3+2*order.diff:stars===2?1+order.diff:stars===1?1:0;
 return {parts,match,stars,reward,fame,gift:stars>=2?order.gift:null};
}
export const STARS_NAME=['不満','まずまず','満足','ぴったり'];

// ---- 納める: the money, the 評判, the gift; the order leaves the board and the sword goes on its journey
export function settle(save,order,sword,result,rng,giftable=[]){
 const person=order.person||J.personById(save,order.ownerId);
 const vouchers={...(save.vouchers||{})};if(result.gift)vouchers[result.gift]=(vouchers[result.gift]||0)+1;
 const ledger=[{at:Date.now(),no:sword.no,name:sword.name,kind:'order',amount:result.reward,stars:result.stars,client:order.client,owner:person.name,fame:result.fame},...(save.ledger||[])].slice(0,100);
 let next={...save,money:(save.money??0)+result.reward,fame:Math.max(0,(save.fame||0)+result.fame),vouchers,ledger,orders:(save.orders||[]).filter(o=>o.id!==order.id)};
 next=J.depart(next,person,sword,order.journey,rng,giftable);
 return next;
}
