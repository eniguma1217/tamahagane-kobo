// 売る (#12, owner D25・D26): the 蔵, requests, haggling at the shop front and the auction, as pure rules.
// A sword's price from finishSword is its 相場 (market value); every way of selling starts from it.
import * as R from './rules.js';

export const QUICK_RATE=0.6;          // 売り払う: at once, cheaply
export const AUCTION_FEE=0.1;         // the auction house keeps a tenth
export const KURA_MAX=60;
export const REQUESTS_MAX=3;
export const CUSTOMERS_PER_FORGE=2,CUSTOMERS_MAX=5;
const gi=id=>R.GRADES.findIndex(g=>g.id===id);
const round=(v,step=50)=>Math.max(step,Math.round(v/step)*step);
const pickOf=(rng,a)=>a[Math.floor(rng()*a.length)];

export const CLIENTS={
 bushi:{name:'武士',face:'🗡',hello:'腕のいい鍛冶がいると聞いた。'},
 shonin:{name:'商人',face:'💰',hello:'よい品なら、いくらでも。……いや、ほどほどに。'},
 jisha:{name:'寺社の使い',face:'⛩',hello:'神前に納める一振りを探しております。'},
 daimyo:{name:'大名の使い',face:'🏯',hello:'殿のお目にかなう刀を。'},
 kenjutsu:{name:'剣術家',face:'🥋',hello:'道場で使う、折れぬ刀がほしい。'},
 tabibito:{name:'旅人',face:'🎒',hello:'道中の守りに、一振りほしいのだが。'},
 mekiki:{name:'目利き',face:'🔍',hello:'名のある刀はないかね。'}
};

// ---- 依頼: only what the smith can make at the current rank (no dead ends)
export const makeRequest=(rng,rankIndex,list=[])=>makeRequestFor(rng,rankOpen(rankIndex),rankIndex,list);
export function rankOpen(rankIndex){
 const open={forms:new Set(),structures:new Set(),materials:new Set()};
 for(const r of R.SMITH_RANKS.slice(0,rankIndex+1))for(const k of ['forms','structures','materials'])r[k].forEach(x=>open[k].add(x));
 return open;
}
export function makeRequestFor(rng,open,rankIndex,list=[]){
 const forms=[...open.forms],eras=[...new Set(R.MATERIALS.filter(m=>open.materials.has(m.id)&&m.era).map(m=>m.era))];
 const grades=['D','C','B','A','S'].slice(0,2+Math.min(3,Math.floor(rankIndex/2)));
 const client=pickOf(rng,Object.keys(CLIENTS));
 const roll=rng(),need={form:pickOf(rng,forms)};
 let mult=1.8;
 const named=list.filter(m=>open.forms.has(m.t)&&eras.includes(m.e)&&(!m.mat||m.mat.every(x=>open.materials.has(x))));
 if(rankIndex>=2&&roll<0.1&&named.length){const m=pickOf(rng,named);need.form=m.t;need.meito=m.n;}
 else{
  need.grade=pickOf(rng,grades);
  if(roll<0.4){need.era=pickOf(rng,eras);mult*=1.3;}
  else if(roll<0.6){need.hamon=pickOf(rng,Object.keys(R.HAMON));mult*=1.4;}
 }
 const meito=need.meito?list.find(m=>m.n===need.meito):null;
 const base=meito?R.MEITO_VALUE[meito.r]*1.4:R.GRADE_VALUE[need.grade]*mult;
 const gifts=R.MATERIALS.filter(m=>open.materials.has(m.id)&&m.price>=500);
 const gift=gifts.length&&rng()<0.35?pickOf(rng,gifts).id:null;
 return {client,need,reward:round(base,100),gift};
}
export function requestText(req,list=[]){
 const n=req.need,F=R.form(n.form).name;
 if(n.meito)return `名刀「${n.meito}」を打ってほしい。`;
 return `${n.era?R.ERAS[n.era].long+'の地鉄の':''}${n.hamon?R.HAMON[n.hamon].name+'の':''}${F}を、${R.GRADES.find(g=>g.id===n.grade).name}（${n.grade}）以上で。`;
}
export function matchesRequest(sword,req){
 const n=req.need;
 if(sword.crack||sword.form!==n.form)return false;
 if(n.meito)return sword.meito===n.meito;
 if(n.era&&sword.era!==n.era)return false;
 if(n.hamon&&sword.hamon!==n.hamon)return false;
 return gi(sword.grade||'E')>=gi(n.grade);
}

// ---- 店先: a customer names a price; push your luck
export function newCustomer(rng,kura){
 if(!kura.length)return null;
 const client=pickOf(rng,Object.keys(CLIENTS));
 // 目利き and 大名の使い look for the best piece; the others take a liking to any
 const sword=client==='mekiki'||client==='daimyo'?kura.slice().sort((a,b)=>(b.tier||0)-(a.tier||0)||b.price-a.price)[0]:pickOf(rng,kura);
 let f=0.8+rng()*0.7;
 if((client==='mekiki'||client==='daimyo')&&sword.meito)f+=0.25;
 if(client==='tabibito')f-=0.15;
 const max=round(sword.price*f),offer=round(max*(0.6+rng()*0.2));
 return {client,swordId:sword.no,value:sword.price,max,offer,patience:2+Math.floor(rng()*2),mood:'hello'};
}
// action: 'sell' (take the offer), 'nudge' (+10%), 'push' (+25%), 'refuse'
export function haggle(c,action){
 if(action==='sell')return {...c,sold:true,price:c.offer,mood:'happy'};
 if(action==='refuse')return {...c,left:true,mood:'bye'};
 const ask=round(c.offer*(action==='push'?1.25:1.1));
 if(ask<=c.max)return {...c,sold:true,price:ask,mood:'happy'};
 const patience=c.patience-1;
 if(patience<=0)return {...c,patience,left:true,mood:'angry'};
 // a counter-offer halfway to what they would really pay; the mood says how far the ask was
 return {...c,patience,offer:round(c.offer+(c.max-c.offer)*0.5),mood:ask<=c.max*1.12?'close':'far'};
}

// ---- 競り: bidders raise in turn until one is left
export function newAuction(rng,sword,reserve=0){
 const n=3+Math.min(3,(sword.tier||0))+(gi(sword.grade||'E')>=gi('S')?1:0);
 const names=['呉服屋','両替商','旗本','寺の住職','豪商','大名の使い','目利き','刀剣商'];
 const bidders=Array.from({length:n},(_,i)=>({name:names[(i+Math.floor(rng()*names.length))%names.length],budget:round(sword.price*(0.6+rng()*(sword.meito?1.6:1.1))),last:0,out:false}));
 return {swordId:sword.no,value:sword.price,price:round(sword.price*0.5),step:round(sword.price*0.07),reserve,bidders,leader:null,done:false,log:[]};
}
export function auctionStep(a,rng){
 if(a.done)return a;
 const can=a.bidders.map((b,i)=>({b,i})).filter(({b,i})=>!b.out&&i!==a.leader&&b.budget>=a.price+a.step);
 const bidders=a.bidders.map(b=>({...b}));
 for(const b of bidders)if(!b.out&&b.budget<a.price+a.step&&bidders.indexOf(b)!==a.leader)b.out=true;
 if(!can.length){
  const sold=a.leader!==null&&a.price>=a.reserve;
  return {...a,bidders,done:true,sold,net:sold?round(a.price*(1-AUCTION_FEE)):0};
 }
 const {i}=can[Math.floor(rng()*can.length)],price=a.price+a.step;
 bidders[i].last=price;
 return {...a,bidders,price,leader:i,log:[...a.log,{name:bidders[i].name,price}].slice(-6)};
}
