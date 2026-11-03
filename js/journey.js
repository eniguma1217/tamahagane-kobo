// 持ち主と旅（#15、owner D31〜D37）。店先で売った刀・依頼で納めた刀は、新しい持ち主と旅に出る。
// 刀の能力（切れ味・粘り・美しさ）＋持ち主の腕前と得意で見こみが決まり、刀を何振か打つと旅が終わって、次に店へ来たとき便りが届く。
// 旅の結果・名声・お礼は旅立つときに決まり（セーブの乱数）、便りで明かされる。数字は Claude の案（GAME_SPEC G17）。
import * as R from './rules.js';
import {PEOPLE,ownerOf} from './owners.js';

export const SKILLS={sharp:{name:'剛',stat:'切れ味'},tough:{name:'守',stat:'粘り'},beauty:{name:'雅',stat:'美しさ'}};
const KEYS=['sharp','tough','beauty'];
const clamp=(v,lo=0,hi=1)=>Math.max(lo,Math.min(hi,v));
const pickOf=(rng,a)=>a[Math.floor(rng()*a.length)];

// each kind of customer goes on its own kind of journey; w = how much each of the sword's stats counts
export const JOURNEYS={
 bushi:{name:'合戦',w:{sharp:.6,tough:.4,beauty:0},titles:['村はずれの小競り合い','国ざかいの戦','城攻め','大合戦','天下分け目の戦'],
  great:'一番槍の手柄を立てた！',good:'無事に戦い抜いた。',hard:'苦しい戦だったが、生きて戻った。',broke:'激しい打ち合いのなかで、刀が折れてしまった……'},
 kenjutsu:{name:'試合',w:{sharp:.5,tough:.3,beauty:.2},titles:['道場の手合わせ','他流試合','城下の御前試合','藩の御前試合','将軍家の御前試合'],
  great:'並みいる相手をすべて打ち負かした！',good:'見事に勝ちを収めた。',hard:'辛くも引き分けた。',broke:'打ち合いの最中に、刀が折れてしまった……'},
 tabibito:{name:'旅',w:{sharp:.3,tough:.7,beauty:0},titles:['隣村へのお使い','峠越えの旅','山賊の出る峠','鬼が棲むという山越え','北の果てへの長旅'],
  great:'道中の山賊を追い払い、旅の人々を救った！',good:'無事に旅を終えた。',hard:'道に迷い、やっとの思いで帰りついた。',broke:'山道で賊に襲われ、刀が折れてしまった……'},
 shonin:{name:'荷の守り',w:{sharp:.4,tough:.6,beauty:0},titles:['市への荷運び','街道の荷運び','海賊の出る船旅','千両箱の運び','南蛮船との大商い'],
  great:'荷を守りぬき、大もうけした！',good:'荷は無事に届いた。',hard:'荷の一部を失ったが、命は助かった。',broke:'賊ともみ合ううちに、刀が折れてしまった……'},
 jisha:{name:'奉納',w:{sharp:0,tough:.2,beauty:.8},titles:['村の祠への奉納','寺の宝物に','神社の祭礼','大寺院の開帳','大社への奉納'],
  great:'見事な一振りと、参拝の人々の評判になった！',good:'つつがなく奉納された。',hard:'あまり人の目を引かなかった。',broke:'儀式の最中に、刀にひびが入ってしまった……'},
 mekiki:{name:'刀くらべ',w:{sharp:.3,tough:0,beauty:.7},titles:['町の目利き会','城下の品評会','京の名刀くらべ','大名家の名刀くらべ','天下の名刀くらべ'],
  great:'一番の評価を得た！',good:'なかなかの評価を得た。',hard:'ほかの刀に見劣りした。',broke:'試し斬りで、刀が折れてしまった……'},
 daimyo:{name:'献上',w:{sharp:.4,tough:0,beauty:.6},titles:['家老への贈り物','殿への献上','隣国への贈り物','将軍家への献上','天下人への献上'],
  great:'殿がたいそう喜ばれ、店の名が広まった！',good:'無事に納められた。',hard:'殿の目にはとまらなかった。',broke:'献上の前に、刀にひびが見つかった……'},
 kuge:{name:'雅の会',w:{sharp:.2,tough:0,beauty:.8},titles:['歌会の飾り','花見の宴','月見の宴','都の宝物くらべ','都の大祭'],
  great:'その美しさが都じゅうの評判になった！',good:'雅な一振りとほめられた。',hard:'あまり話題にならなかった。',broke:'宴の最中に、刀にひびが入ってしまった……'},
 shogun:{name:'御前の試し',w:{sharp:.6,tough:0,beauty:.4},titles:['旗本の稽古','御前の試し斬り','将軍家の鷹狩りの供','日光への社参の供','将軍家の宝刀に'],
  great:'上様がたいそうお気に召された！',good:'お役目を立派に果たした。',hard:'上様の目にはとまらなかった。',broke:'試し斬りで、刀が折れてしまった……'}
};
export const mainStat=w=>KEYS.reduce((a,k)=>w[k]>w[a]?k:a,'sharp');
// the journey's text: a real owner's recorded deed (ev = the 名刀) or the customer kind's journey
export function journeyInfo(j){
 if(j.type==='real'){
  const o=ownerOf(j.ev);
  return {name:o.ev,title:o.ev,eb:o.eb,x:o.x,w:Object.fromEntries(KEYS.map(k=>[k,k===o.st?.6:.2])),
   great:`「${o.ev}」で、この刀が大きな力になった！`,good:`「${o.ev}」を、この刀とともになしとげた。`,hard:`「${o.ev}」では苦労したが、刀は無事だった。`,broke:''};
 }
 const J=JOURNEYS[j.type]||JOURNEYS.bushi;return {...J,title:j.title||J.titles[(j.star||1)-1]};
}

// ---- 持ち主 (people)
const NAMES={
 bushi:{fam:['岩倉','黒木','早川','秋山','村井','高森','杉浦','野々村','大庭','曽根'],giv:['兵衛','左近','主水','源太','新八','権六','甚内','又兵衛','伝右衛門','弥十郎'],sep:''},
 kenjutsu:{fam:['柳田','戸川','草壁','堀江','真壁','神崎','久我'],giv:['文五郎','一心','伊織','左門','源心','新之丞'],sep:''},
 tabibito:{fam:[''],giv:['お凛','弥七','鶴吉','お菊','半助','小太郎','お千代','六助','お駒','与吉'],sep:''},
 shonin:{fam:['越後屋','近江屋','大黒屋','三河屋','丹波屋','播磨屋'],giv:['喜兵衛','宗八','利助','清兵衛','嘉七'],sep:''},
 jisha:{fam:['白雲寺','宝光寺','八幡社','稲荷社','龍泉寺','観音堂'],giv:['玄道','智円','宗覚','了海','清人','真澄'],sep:'の'},
 mekiki:{fam:['古賀','松浦','本郷','篠原','宇佐美'],giv:['宗甫','玄斎','道伯','幽谷','閑斎'],sep:''},
 daimyo:{fam:['鷲尾','石動','桐生','月岡','大熊','霧島'],giv:['内膳','頼母','帯刀','図書','主殿'],sep:''},
 kuge:{fam:['月見小路','朝霧','夕凪','白萩','雲居'],giv:['中納言','少将','宰相','大納言'],sep:''},
 shogun:{fam:['御側衆・鷹野','御側衆・青柳','御小姓・瀬川','御側衆・水城'],giv:['主膳','隼人','采女','大膳'],sep:''}
};
export const FACE={bushi:'🗡',kenjutsu:'🥋',tabibito:'🎒',shonin:'💰',jisha:'⛩',mekiki:'🔍',daimyo:'🏯',kuge:'📜',shogun:'🎌'};
// a new customer of this kind, with 腕前 1〜3 (higher shop fame brings stronger ones) and a 得意 that mostly fits their journey
export function newPerson(rng,client,fameLevel=0,taken=[]){
 const N=NAMES[client]||NAMES.bushi;let name='';
 for(let k=0;k<12;k++){name=pickOf(rng,N.fam)+N.sep+pickOf(rng,N.giv);if(!taken.includes(name))break;}
 const main=mainStat(JOURNEYS[client]?.w||JOURNEYS.bushi.w);
 const skill=rng()<0.6?main:pickOf(rng,KEYS);
 const lv=1+(fameLevel>=2&&rng()<0.3?1:0)+(fameLevel>=4&&rng()<0.3?1:0);
 return {id:'g'+Math.floor(rng()*2**31).toString(36),name,face:FACE[client]||'🗡',client,skill,lv,exp:0,regular:false,real:false,story:[],sword:null,journey:null};
}
// the kind of journey a real person goes on after their own recorded deed: by how they are shown
const REAL_KIND={'🥋':'kenjutsu','🏯':'daimyo','🗡':'bushi','⚓':'bushi','📜':'mekiki','💰':'shonin','⛩':'jisha','👑':'daimyo','🌸':'kuge'};
export function realPerson(name){
 const p=PEOPLE[name];if(!p)return null;
 return {id:'r:'+name,name,kana:p.k,face:p.f,client:REAL_KIND[p.f]||'bushi',skill:p.sk,lv:p.lv,exp:0,regular:true,real:true,story:[],sword:null,journey:null,got:[]};
}
export const personById=(save,id)=>(save.owners||[]).find(p=>p.id===id)||(String(id).startsWith('r:')?realPerson(String(id).slice(2)):null);

// ---- 旅の計画と見こみ
// how hard: rises with the shop's fame level (D32); a grown regular takes on bigger ones (D36)
export const BASE_STAR=[1,1,2,2,3,3,4];
export function planJourney(rng,person,fameLevel=0){
 const star=Math.max(1,Math.min(5,BASE_STAR[Math.max(0,Math.min(6,fameLevel))]+(rng()<0.3?1:0)+(person.regular?Math.floor((person.lv-1)/2):0)));
 const J=JOURNEYS[person.client]||JOURNEYS.bushi;
 return {type:person.client in JOURNEYS?person.client:'bushi',title:J.titles[star-1],star};
}
// a real owner's own deed: harder for the more famous swords
export const realJourneyFor=meito=>({type:'real',ev:meito.n,title:ownerOf(meito.n).ev,star:Math.min(5,1+meito.r)});
export const journeyLength=star=>star<=1?1:star<=3?2:3;   // swords to forge before the letter comes
export function chances(person,sword,journey){
 const w=journeyInfo(journey).w,st=sword.stats||{sharp:0,tough:0,beauty:0};
 const power=KEYS.reduce((t,k)=>t+w[k]*(st[k]||0),0);
 const m=power+person.lv*5+(person.skill===mainStat(w)?8:0)+(sword.meito?6:0)-(30+13*journey.star);
 const great=clamp(0.05+m/60,0,0.5);
 let broke=clamp(0.15-m/30,0.02,0.85);
 let hard=Math.min(clamp(0.3-m/80,0.05,0.4),1-great-broke);
 // real people's swords never break (D37): the risk becomes a hard journey
 if(person.real){hard+=broke;broke=0;}
 const good=Math.max(0,1-great-broke-hard);
 return {great,good,hard,broke,m:Math.round(m)};
}
export function prospect(c){
 const ok=c.great+c.good;
 return ok>=0.85?'とても高い':ok>=0.7?'高い':ok>=0.5?'ふつう':ok>=0.3?'低い':'あぶない';
}
export const OUTCOME={great:'大活躍',good:'活躍',hard:'苦戦',broke:'折れた'};
// 名声 from a letter (D31: the big part comes from the journey)
export function journeyFame(outcome,star,real=false){
 const base=4+3*star;
 return outcome==='great'?Math.round(base*2*(real?1.5:1)):outcome==='good'?Math.round(base*(real?1.25:1)):outcome==='hard'?0:-(3+2*star);
}
export function rollOutcome(c,r){return r<c.great?'great':r<c.great+c.good?'good':r<c.great+c.good+c.hard?'hard':'broke';}

// ---- 旅立ち・便り（save → save）
export const REGULARS_MAX=10;
// the sword leaves with its owner; everything is decided now and told by the letter (D34)
export function depart(save,person,sword,journey,rng,giftable=[]){
 const c=chances(person,sword,journey),outcome=rollOutcome(c,rng());
 const fame=journeyFame(outcome,journey.star,person.real);
 let reward=null;
 if(outcome==='great'){
  const pool=giftable.slice().sort((a,b)=>R.material(a).price-R.material(b).price);
  if(pool.length&&rng()<0.5){const u=rng()**(1/(1+journey.star*0.5));reward={voucher:pool[Math.min(pool.length-1,Math.floor(u*pool.length))]};}
  else reward={money:Math.max(500,Math.round(sword.price*(0.15+0.05*journey.star)/100)*100)};
 }else rng();
 const trip={...journey,left:journeyLength(journey.star),outcome,fame,reward,chances:c,swordNo:sword.no,swordName:sword.name,grade:sword.grade||null,meito:sword.meito||null};
 const known=(save.owners||[]).some(p=>p.id===person.id);
 const p={...person,journey:trip,got:person.real&&sword.meito?[...new Set([...(person.got||[]),sword.meito])]:person.got};
 const owners=known?save.owners.map(x=>x.id===p.id?p:x):[...(save.owners||[]),p];
 return {...save,owners};
}
// the letters that have come: any journey with no swords left to wait for (D34: told when the shop is opened)
export function deliverLetters(save){
 const letters=[];let fame=save.fame||0,money=save.money??0;const vouchers={...(save.vouchers||{})};
 let owners=[];
 for(const p of save.owners||[]){
  const j=p.journey;
  if(!j||j.left>0){owners.push(p);continue;}
  fame=Math.max(0,fame+j.fame);
  if(j.reward?.money)money+=j.reward.money;
  if(j.reward?.voucher)vouchers[j.reward.voucher]=(vouchers[j.reward.voucher]||0)+1;
  const ok=j.outcome==='great'||j.outcome==='good';
  let lv=p.lv,exp=p.exp||0;
  if(j.outcome==='great')lv++;else if(j.outcome==='good'&&++exp>=2){lv++;exp=0;}
  lv=Math.min(5,lv);
  const story=[{t:j.title,r:j.outcome,s:j.swordName},...(p.story||[])].slice(0,6);
  const regular=p.regular||ok;
  const np={...p,lv,exp,regular,story,journey:null,sword:j.outcome==='broke'?null:{no:j.swordNo,name:j.swordName,grade:j.grade,meito:j.meito}};
  letters.push({id:p.id,name:p.name,face:p.face,real:p.real,client:p.client,journey:{type:j.type,ev:j.ev,title:j.title,star:j.star},
   outcome:j.outcome,fame:j.fame,reward:j.reward,lvUp:lv>p.lv,lv,newRegular:regular&&!p.regular,goesHome:!regular,swordName:j.swordName});
  if(regular)owners.push(np);
 }
 // keep the book of regulars short: the oldest idle ones who are not real people leave first
 while(owners.filter(p=>p.regular&&!p.real).length>REGULARS_MAX){const i=owners.findIndex(p=>p.regular&&!p.real&&!p.journey);if(i<0)break;owners.splice(i,1);}
 return {save:{...save,fame,money,vouchers,owners},letters};
}
export const idleRegulars=save=>(save.owners||[]).filter(p=>p.regular&&!p.journey);
export const travelling=save=>(save.owners||[]).filter(p=>p.journey);
