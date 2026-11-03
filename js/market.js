// 売る (#12, owner D25・D26): the 蔵, requests, haggling at the shop front and the auction, as pure rules.
// A sword's price from finishSword is its 相場 (market value); every way of selling starts from it.
import * as R from './rules.js';
import * as J from './journey.js';
import {ownerOf} from './owners.js';

export const QUICK_RATE=0.6;          // 売り払う: at once, cheaply
export const AUCTION_FEE=0.1;         // the auction house keeps a tenth
export const KURA_MAX=60;
export const REQUESTS_MAX=3;
export const CUSTOMERS_PER_FORGE=2,CUSTOMERS_MAX=5;
const gi=id=>R.GRADES.findIndex(g=>g.id===id);
const round=(v,step=50)=>Math.max(step,Math.round(v/step)*step);
const pickOf=(rng,a)=>a[Math.floor(rng()*a.length)];

// fame: the 名声 level (index) from which they come (#15, D30); pay: how much more they pay; picky: they look for the best piece
export const CLIENTS={
 bushi:{name:'武士',face:'🗡',hello:'腕のいい鍛冶がいると聞いた。',fame:0,pay:1},
 shonin:{name:'商人',face:'💰',hello:'よい品なら、いくらでも。……いや、ほどほどに。',fame:0,pay:1},
 tabibito:{name:'旅人',face:'🎒',hello:'道中の守りに、一振りほしいのだが。',fame:0,pay:0.9},
 kenjutsu:{name:'剣術家',face:'🥋',hello:'道場で使う、折れぬ刀がほしい。',fame:1,pay:1.05},
 jisha:{name:'寺社の使い',face:'⛩',hello:'神前に納める一振りを探しております。',fame:2,pay:1.1},
 mekiki:{name:'目利き',face:'🔍',hello:'名のある刀はないかね。',fame:3,pay:1.15,picky:true},
 daimyo:{name:'大名の使い',face:'🏯',hello:'殿のお目にかなう刀を。',fame:4,pay:1.25,picky:true},
 kuge:{name:'公家の使い',face:'📜',hello:'都の宴に、雅な一振りを。',fame:5,pay:1.35,picky:true},
 shogun:{name:'将軍家の使い',face:'🎌',hello:'上様への献上の品を探しておる。',fame:6,pay:1.5,picky:true}
};
export const clientsFor=level=>Object.keys(CLIENTS).filter(k=>CLIENTS[k].fame<=level);

// ---- 名声 (#15, D30・D31): selling raises it a little, the owners' journeys a lot (journey.js). The numbers are Claude's proposal (G16).
export const FAME_LEVELS=[
 {name:'無名の鍛冶場',min:0,requests:3,reward:1,gift:0.35,house:0},
 {name:'町の鍛冶屋',min:40,requests:3,reward:1.05,gift:0.4,house:0},
 {name:'評判の店',min:150,requests:4,reward:1.1,gift:0.45,house:1},
 {name:'城下一の店',min:400,requests:4,reward:1.15,gift:0.5,house:1},
 {name:'大名家御用達',min:900,requests:5,reward:1.2,gift:0.55,house:2},
 {name:'京に名高い店',min:1800,requests:5,reward:1.3,gift:0.6,house:2},
 {name:'天下一の鍛冶場',min:3200,requests:5,reward:1.4,gift:0.65,house:3}
];
export function fameLevel(fame=0){
 let i=0;FAME_LEVELS.forEach((l,k)=>{if(fame>=l.min)i=k;});
 const L=FAME_LEVELS[i],next=FAME_LEVELS[i+1]||null;
 return {index:i,lv:i+1,...L,fame,next:next?.name||null,toNext:next?next.min-fame:0,progress:next?(fame-L.min)/(next.min-L.min):1};
}
// what a level brings, for the level-up notice
export function fameNews(from,to){
 const out=[];
 for(let i=from+1;i<=to;i++){
  const L=FAME_LEVELS[i],P=FAME_LEVELS[i-1];
  for(const k of Object.keys(CLIENTS))if(CLIENTS[k].fame===i)out.push(`${CLIENTS[k].face} ${CLIENTS[k].name}が来るようになった`);
  if(L.house!==P.house)out.push(`競りが「${HOUSES[L.house].name}」に`);
  if(L.requests>P.requests)out.push(`依頼が${L.requests}件まで`);
  if(L.reward>P.reward)out.push(`依頼のお礼が相場の${Math.round(1.8*L.reward*10)/10}倍ほどに`);
 }
 if(J.BASE_STAR[Math.min(6,to)]>J.BASE_STAR[from])out.push('旅がむずかしくなり、活躍したときの名声も大きく');
 return out;
}
const WORTH={E:0,D:1,C:2,B:3,A:5,S:7,SS:10};
const SALE_FAME={request:2,shop:1,auction:1,quick:0};
// the little 名声 from a sale (D31: by how it was sold, more for a better sword); a なまくら brings none
export function saleFame(sword,kind){
 const g=sword.crack?'E':(sword.grade||R.gradeFor(sword.overall??0).id);
 if(g==='E')return 0;
 return Math.round((SALE_FAME[kind]||0)*(1+WORTH[g]+(sword.tier||0)*2)/2);
}

// ---- 依頼: only what the smith can make at the current rank (no dead ends). Each comes with the person who will carry it (#15).
export const requestsMax=level=>FAME_LEVELS[Math.max(0,Math.min(6,level))].requests;
export const makeRequest=(rng,rankIndex,list=[],level=0,regulars=[])=>makeRequestFor(rng,rankOpen(rankIndex),rankIndex,list,level,regulars);
export function rankOpen(rankIndex){
 const open={forms:new Set(),structures:new Set(),materials:new Set()};
 for(const r of R.SMITH_RANKS.slice(0,rankIndex+1))for(const k of ['forms','structures','materials'])r[k].forEach(x=>open[k].add(x));
 return open;
}
export function makeRequestFor(rng,open,rankIndex,list=[],level=0,regulars=[]){
 const forms=[...open.forms],eras=[...new Set(R.MATERIALS.filter(m=>open.materials.has(m.id)&&m.era).map(m=>m.era))];
 const grades=['D','C','B','A','S'].slice(0,2+Math.min(3,Math.floor(rankIndex/2)));
 const L=FAME_LEVELS[Math.max(0,Math.min(6,level))];
 const client=pickOf(rng,clientsFor(level));
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
 const base=(meito?R.MEITO_VALUE[meito.r]*1.4:R.GRADE_VALUE[need.grade]*mult)*L.reward;
 const gifts=R.MATERIALS.filter(m=>open.materials.has(m.id)&&m.price>=500).sort((a,b)=>a.price-b.price);
 // a higher name brings gifts more often, and better ones (D30)
 const gift=gifts.length&&rng()<L.gift?gifts[Math.min(gifts.length-1,Math.floor(rng()**(1/(1+level*0.4))*gifts.length))].id:null;
 const req={client,need,reward:round(base,100),gift};
 // a regular asks for a sword fit for their 得意 (D36); otherwise a new person of this kind will carry it
 const idle=regulars.filter(p=>!p.journey&&!p.real);
 if(!need.meito&&idle.length&&rng()<0.3){
  const p=pickOf(rng,idle),j=J.planJourney(rng,p,level),k=J.mainStat(J.journeyInfo(j).w);
  need.stat={k,min:Math.min(90,40+8*j.star)};
  return {...req,client:p.client in CLIENTS?p.client:'bushi',ownerId:p.id,journey:j,reward:round(base*1.2,100)};
 }
 const person=J.newPerson(rng,client,level);
 return {...req,person,journey:J.planJourney(rng,person,level)};
}
// 名指しの依頼 (D37): the real owner of a 名刀 now in the 蔵 asks for it by name
export function namedRequest(meito,level=0){
 const o=ownerOf(meito.n);if(!o)return null;
 return {client:'real',ownerId:'r:'+o.o,real:true,need:{form:meito.t,meito:meito.n},reward:round(R.MEITO_VALUE[meito.r]*1.2*FAME_LEVELS[Math.max(0,Math.min(6,level))].reward,100),gift:null,journey:J.realJourneyFor(meito)};
}
export const NAMED_MAX=2;
const STAT_JA={sharp:'切れ味',tough:'粘り',beauty:'美しさ'};
export function requestText(req,list=[]){
 const n=req.need,F=R.form(n.form).name;
 if(req.real)return `その${F}「${n.meito}」を、譲ってもらえぬか。`;
 if(n.meito)return `名刀「${n.meito}」を打ってほしい。`;
 return `${n.era?R.ERAS[n.era].long+'の地鉄の':''}${n.hamon?R.HAMON[n.hamon].name+'の':''}${n.stat?STAT_JA[n.stat.k]+n.stat.min+'以上の':''}${F}を、${R.GRADES.find(g=>g.id===n.grade).name}（${n.grade}）以上で。`;
}
export function matchesRequest(sword,req){
 const n=req.need;
 if(sword.crack||sword.form!==n.form)return false;
 if(n.meito)return sword.meito===n.meito;
 if(n.era&&sword.era!==n.era)return false;
 if(n.hamon&&sword.hamon!==n.hamon)return false;
 if(n.stat&&(sword.stats?.[n.stat.k]??0)<n.stat.min)return false;
 return gi(sword.grade||'E')>=gi(n.grade);
}

// ---- 店先: a customer names a price; push your luck. A regular sometimes comes back (D36).
export function newCustomer(rng,kura,level=0,regulars=[]){
 if(!kura.length)return null;
 const idle=regulars.filter(p=>!p.journey);
 const person=idle.length&&rng()<0.35?pickOf(rng,idle):null;
 const client=person?(person.client in CLIENTS?person.client:'bushi'):pickOf(rng,clientsFor(level));
 const C=CLIENTS[client];
 const who=person||J.newPerson(rng,client,level,regulars.map(p=>p.name));
 const journey=J.planJourney(rng,who,level);
 // the picky look for the best piece; a regular picks what suits the journey; the others take a liking to any
 const sword=C.picky?kura.slice().sort((a,b)=>(b.tier||0)-(a.tier||0)||b.price-a.price)[0]
  :person?kura.slice().sort((a,b)=>J.chances(who,b,journey).m-J.chances(who,a,journey).m)[0]:pickOf(rng,kura);
 let f=(0.8+rng()*0.7)*C.pay;
 if(C.picky&&sword.meito)f+=0.25;
 const max=round(sword.price*f),offer=round(max*(0.6+rng()*0.2));
 return {client,person:who,regular:!!person,journey,swordId:sword.no,value:sword.price,max,offer,patience:2+Math.floor(rng()*2),mood:person?'again':'hello'};
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

// ---- 競り: bidders raise in turn until one is left. The house grows with the shop's fame (D30).
export const HOUSES=[
 {name:'町の競り',bidders:-1,budget:0.85,names:['呉服屋','両替商','寺の住職','刀剣商','旅籠の主人']},
 {name:'城下の競り',bidders:0,budget:1,names:['呉服屋','両替商','旗本','寺の住職','豪商','刀剣商']},
 {name:'京の大競り',bidders:1,budget:1.15,names:['豪商','公家の使い','大名の使い','目利き','刀剣商','旗本']},
 {name:'天下の大競り',bidders:2,budget:1.3,names:['豪商','大名の使い','将軍家の使い','公家の使い','目利き','大寺院の使い']}
];
export const houseFor=level=>HOUSES[FAME_LEVELS[Math.max(0,Math.min(6,level))].house];
export function newAuction(rng,sword,reserve=0,level=0){
 const H=houseFor(level);
 const n=Math.max(2,3+Math.min(3,(sword.tier||0))+(gi(sword.grade||'E')>=gi('S')?1:0)+H.bidders);
 const names=H.names;
 const bidders=Array.from({length:n},(_,i)=>({name:names[(i+Math.floor(rng()*names.length))%names.length],budget:round(sword.price*H.budget*(0.6+rng()*(sword.meito?1.6:1.1))),last:0,out:false}));
 return {house:H.name,swordId:sword.no,value:sword.price,price:round(sword.price*0.5),step:round(sword.price*0.07),reserve,bidders,leader:null,done:false,log:[]};
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
