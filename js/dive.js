// 出陣（#19、owner D49〜D54・D56）。鍛冶師の自分が、刀掛けから刀を3振まで背負って潜る。深いほど敵が強く、素材が良い。
// 刀は攻撃力で斬り、斬るたびに耐久が1減って、尽きると折れる（#23 owner：攻撃力＋耐久の2つ、敵の弱点はなくした）。
// 帰れば戦利品はすべて持ち帰れる。刀が尽きたら半分を失う（賭け）。数字は Claude の案（GAME_SPEC G20）。
// #26：斬るたびに気がたまり、刃文から生まれた必殺技を撃てる。倒した敵で刀に二つ名「〇〇切」がつき、強くなる。
import * as R from './rules.js';
import {wazaOf,wazaHits,KI_MAX} from './waza.js';
export {KI_MAX};

export const RACK_MAX=12,CARRY_MAX=3;
// 店で買える基本の素材（D54）。卸し鉄・包丁鉄は無料でいくらでも
export const SHOP={nami:300,zuku:100,oroshi:0,houcho:0};
// cut: the 二つ名 a sword earns by felling it (#26), named as the real swords were (童子切・蜘蛛切)
export const FOES={
 sanzoku:{name:'山賊',face:'🥷',cut:'山賊切'},ookami:{name:'山の狼',face:'🐺',cut:'狼切'},kitsunebi:{name:'狐火',face:'🦊',cut:'狐火切'},
 kashira:{name:'山賊の頭',face:'🪓',boss:true,cut:'頭切'},
 ochimusha:{name:'落ち武者',face:'💀',cut:'落武者切'},inoshishi:{name:'大猪',face:'🐗',cut:'猪切'},onryo:{name:'怨霊',face:'👻',cut:'怨霊切'},
 taisho:{name:'古戦場の大将',face:'⚔',boss:true,cut:'大将切'},
 akaoni:{name:'赤鬼',face:'👹',cut:'赤鬼切'},orochi:{name:'大蛇',face:'🐍',cut:'大蛇切'},tengu:{name:'天狗',face:'👺',cut:'天狗切'},
 ooni:{name:'大鬼',face:'👹',boss:true,cut:'鬼切'}
};
// 二つ名 (#26): five of one foe, or one boss, by the same sword's last blow; each gives 攻撃力 +TITLE_ATK, up to TITLE_MAX
export const TITLE_KILLS=5,TITLE_ATK=5,TITLE_MAX=3;
export function earnTitle(s,foe){
 const kills={...(s.kills||{})};kills[foe.key]=(kills[foe.key]||0)+1;
 const names=[...(s.names||[])],cut=FOES[foe.key]?.cut;
 const title=cut&&names.length<TITLE_MAX&&!names.includes(cut)&&(foe.boss||kills[foe.key]>=TITLE_KILLS)?cut:null;
 return {kills,names:title?[...names,title]:names,title};
}
// loot: [material, weight, from which depth]
export const PLACES=[
 {id:'touge',name:'峠の街道',fame:0,foes:['sanzoku','ookami','kitsunebi'],boss:'kashira',hard:0,loot:[['nami',5,1],['kugi',3,1],['jou',1.5,2],['kera',2,3]],note:'山賊や獣の出る峠道'},
 {id:'kosenjo',name:'古戦場',fame:2,foes:['ochimusha','inoshishi','onryo'],boss:'taisho',hard:4,loot:[['kera',4,1],['jou',3,1],['kugi',3,1],['chikusa',2,3],['nanban',1,5]],note:'昔の戦の跡。落ち武者や怨霊がさまよう'},
 {id:'oniyama',name:'鬼の山',fame:4,foes:['akaoni','orochi','tengu'],boss:'ooni',hard:9,loot:[['chikusa',3,1],['nanban',3,1],['hakusai',2,3],['inseki',1,8]],note:'鬼が棲むという深い山'}
];
const clamp=(v,lo=0,hi=1)=>Math.max(lo,Math.min(hi,v));
const pickOf=(rng,a)=>a[Math.floor(rng()*a.length)];
export const placeOf=id=>PLACES.find(p=>p.id===id)||PLACES[0];
export const placesFor=level=>PLACES.filter(p=>p.fame<=level);

// ---- 刀の2つの数字 (#23): 攻撃力と耐久。耐久は粘りが高いほど多く、名刀は1つ多い。どちらにも形の癖が乗る (#25)
export const ATK_MAX=150;
export const atkOf=s=>Math.max(0,Math.min(ATK_MAX,(s.stats?.sharp||0)+(R.form(s.form).atk||0)+TITLE_ATK*(s.names?.length||0)));
// 研ぎ直し (#26): the 耐久 comes back for money, more for a finer sword (a 名刀 twice); a broken sword is gone and cannot be
export const repairPerPip=s=>50*(Math.max(0,R.GRADES.findIndex(g=>g.id===s.grade))+1)*(s.meito?2:1);
export const repairCost=s=>durOf(s)<=0?0:Math.max(0,maxDurability(s)-durOf(s))*repairPerPip(s);
export const maxDurability=s=>Math.max(1,2+Math.floor((s.stats?.tough||0)/25)+(s.meito?1:0)+(R.form(s.form).dur||0));
export const durOf=s=>Math.min(s.dur??maxDurability(s),maxDurability(s));

// ---- 形を覚える (#25, owner: 強敵を倒すと増える). Each time a place's boss falls (at any depth), the smith learns the next
// form on that place's list. Every place's first boss (5階) can be reached, so nothing is out of reach.
export const TEACH={touge:['tanto','wakizashi'],kosenjo:['tachi','yari','chokuto'],oniyama:['naginata','odachi','ken']};
// the next form this place teaches to a smith who knows these forms (null when it has taught all of its own)
export const nextTeach=(placeId,forms=[])=>(TEACH[placeId]||[]).find(f=>!forms.includes(f))||null;
export const teacherOf=formId=>{for(const [place,list] of Object.entries(TEACH)){const i=list.indexOf(formId);if(i>=0)return {place,order:i+1};}return null;};

// ---- 敵
export function makeFoe(rng,place,depth){
 const boss=depth%5===0,key=boss?place.boss:pickOf(rng,place.foes),F=FOES[key],d=depth+place.hard;
 const hp=Math.round((40+d*18)*(boss?2:1));
 return {key,name:F.name,face:F.face,boss,hp,maxHp:hp};
}
// how much a strike does: the 攻撃力 counts by its square, so a 90 hits about twice as hard as a 60
export const POWER={base:6,div:80};
export const strikePower=s=>(POWER.base+atkOf(s)*atkOf(s)/POWER.div)*(s.meito?1.2:1);
export const CRIT=0.1;

// ---- 出陣の進み方
export function startDive(rng,placeId,swords){
 const place=placeOf(placeId);
 return {place:place.id,depth:1,foe:makeFoe(rng,place,1),carry:swords.map(carried),bag:{money:0,mats:{}},fame:0,won:false,over:false,log:[],titles:[]};
}
// a sword on the back: its numbers, its 必殺技 and 気 (#26), what it has felled and its 二つ名
export const carried=s=>({no:s.no,name:s.name,meito:s.meito||null,stats:s.stats,form:s.form,grade:s.grade,dur:durOf(s),max:maxDurability(s),
 waza:wazaOf(s),ki:0,kills:{...(s.kills||{})},names:[...(s.names||[])]});
const alive=d=>d.carry.filter(c=>c.dur>0);
// one strike with the i-th sword: 耐久 -1, broken at 0, 気 +1. forms: what the smith knows (a boss may teach a new one, #25)
export function strike(d,i,rng,forms=[]){
 if(d.won||d.over)return d;
 const carry=d.carry.map(c=>({...c})),s=carry[i];if(!s||s.dur<=0)return d;
 const crit=rng()<CRIT,dmg=Math.max(1,Math.round(strikePower(s)*(crit?1.5:1)));
 s.dur--;s.ki=Math.min(KI_MAX,(s.ki||0)+1);
 return settleBlow(d,carry,i,{sword:s.name,dmg,hits:[dmg],crit,broke:false},rng,forms);
}
// the 必殺技 of the i-th sword, when its 気 is full: the 気 is spent, the 耐久 it costs taken (or given back)
export const canWaza=(d,i)=>!d.won&&!d.over&&d.carry[i]?.dur>0&&(d.carry[i].ki||0)>=KI_MAX;
export function useWaza(d,i,rng,forms=[]){
 if(!canWaza(d,i))return d;
 const carry=d.carry.map(c=>({...c})),s=carry[i],w=s.waza||wazaOf(s);
 const hits=wazaHits(w,strikePower(s),d.foe,rng),dmg=hits.reduce((t,v)=>t+v,0);
 s.ki=0;s.dur=Math.max(0,s.dur-w.cost);if(s.dur>0)s.dur=Math.min(s.max,s.dur+w.heal);
 return settleBlow(d,carry,i,{sword:s.name,dmg,hits,crit:w.crit,waza:w.name,broke:false},rng,forms);
}
// after a blow: a broken sword, a fallen foe (loot, 評判, a form taught, a 二つ名 for the sword that felled it), or no swords left
function settleBlow(d,carry,i,ev,rng,forms){
 const s=carry[i],foe={...d.foe,hp:Math.max(0,d.foe.hp-ev.dmg)};
 if(s.dur<=0){s.dur=0;ev.broke=true;}
 let next={...d,carry,foe,log:[...d.log,ev].slice(-5)};
 if(foe.hp<=0){
  const loot=rollLoot(rng,placeOf(d.place),d.depth,foe.boss),bag={money:d.bag.money+loot.money,mats:{...d.bag.mats}};
  for(const id of loot.mats)bag.mats[id]=(bag.mats[id]||0)+1;
  const form=foe.boss?nextTeach(d.place,[...forms,...(d.taught||[])]):null;
  const t=earnTitle(s,foe);s.kills=t.kills;s.names=t.names;
  const title=t.title?{no:s.no,sword:s.name,title:t.title}:null;
  next={...next,won:true,bag,loot:{...loot,form,title},fame:d.fame+floorFame(d.depth,foe.boss),taught:form?[...(d.taught||[]),form]:(d.taught||[]),
   titles:title?[...(d.titles||[]),title]:(d.titles||[])};
 }else if(!alive(next).length)next={...next,over:true,lost:true};
 return next;
}
export const floorFame=(depth,boss)=>1+Math.floor(depth/4)+(boss?5+Math.floor(depth/5)*3:0);
export function rollLoot(rng,place,depth,boss){
 const table=place.loot.filter(([,,from])=>depth>=from);
 const pick=()=>{const tot=table.reduce((t,[,w])=>t+w,0);let r=rng()*tot;for(const [id,w] of table){r-=w;if(r<=0)return id;}return table.at(-1)[0];};
 const mats=[];
 if(boss){mats.push(pick());mats.push(table.slice().sort((a,b)=>b[2]-a[2]||a[1]-b[1])[0][0]);}
 else if(rng()<0.7)mats.push(pick());
 const money=Math.round((boss?150*depth:40*depth+rng()*60)/10)*10;
 return {mats,money};
}
export function goDeeper(d,rng){
 if(!d.won||d.over)return d;
 return {...d,depth:d.depth+1,foe:makeFoe(rng,placeOf(d.place),d.depth+1),won:false,loot:null,log:[]};
}
// coming home: all of the bag when you turn back; half when every sword is gone (D50)
export function finishDive(d){
 const lost=!!d.lost,half=v=>Math.floor(v/2);
 const mats={};for(const [id,n] of Object.entries(d.bag.mats)){const k=lost?half(n):n;if(k>0)mats[id]=k;}
 // depth: the deepest floor cleared
 return {money:lost?half(d.bag.money):d.bag.money,mats,fame:d.fame,lost,depth:d.won?d.depth:d.depth-1,carry:d.carry,taught:d.taught||[],titles:d.titles||[]};
}
// the rack after the dive: swords keep their wear, what they felled and their 二つ名; a broken one stays, at 耐久 0, to be re-forged (#32)
export function returnSwords(rack,carry){
 const by=Object.fromEntries(carry.map(c=>[c.no,c]));
 return rack.map(s=>{const c=by[s.no];if(!c)return s;return {...s,dur:Math.max(0,c.dur),kills:c.kills||s.kills,names:c.names||s.names};});
}
// 打ち直し (#32, owner: 「刀が壊れたらしゅうりできるようにしたい」→ 叩くだけ遊ぶ): a broken sword comes back whole after
// 熱して叩く once more, for a little money (more for a finer sword, a 名刀 twice). 研ぎ直し is for swords that are only worn.
export const isBroken=s=>durOf(s)<=0;
export const reforgeCost=s=>100*(Math.max(0,R.GRADES.findIndex(g=>g.id===s.grade))+1)*(s.meito?2:1);
