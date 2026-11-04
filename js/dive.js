// 出陣（#19、owner D49〜D54・D56）。鍛冶師の自分が、刀掛けから刀を3振まで背負って潜る。深いほど敵が強く、素材が良い。
// 敵の弱点（鎧＝切れ味、獣＝粘り、もののけ＝美しさ）を見て、合う刀を選んで斬る。刀は使うと傷み、折れる（粘りが高いほど長もち）。
// 帰れば戦利品はすべて持ち帰れる。刀が尽きたら半分を失う（賭け）。数字は Claude の案（GAME_SPEC G20）。
export const RACK_MAX=12,CARRY_MAX=3;
// 店で買える基本の素材（D54）。卸し鉄・包丁鉄は無料でいくらでも
export const SHOP={nami:300,zuku:100,oroshi:0,houcho:0};
export const KINDS={
 yoroi:{name:'鎧',weak:'sharp',hint:'鎧が厚い。切れ味の鋭い刀で'},
 kemono:{name:'獣',weak:'tough',hint:'すばやく、噛みついてくる。粘りのある刀で受けて斬れ'},
 mononoke:{name:'もののけ',weak:'beauty',hint:'この世のものではない。美しい刀でなければ斬れぬ'}
};
export const STAT_NAME={sharp:'切れ味',tough:'粘り',beauty:'美しさ'};
export const FOES={
 sanzoku:{name:'山賊',face:'🥷',kind:'yoroi'},ookami:{name:'山の狼',face:'🐺',kind:'kemono'},kitsunebi:{name:'狐火',face:'🦊',kind:'mononoke'},
 kashira:{name:'山賊の頭',face:'🪓',kind:'yoroi',boss:true},
 ochimusha:{name:'落ち武者',face:'💀',kind:'yoroi'},inoshishi:{name:'大猪',face:'🐗',kind:'kemono'},onryo:{name:'怨霊',face:'👻',kind:'mononoke'},
 taisho:{name:'古戦場の大将',face:'⚔',kind:'yoroi',boss:true},
 akaoni:{name:'赤鬼',face:'👹',kind:'yoroi'},orochi:{name:'大蛇',face:'🐍',kind:'kemono'},tengu:{name:'天狗',face:'👺',kind:'mononoke'},
 ooni:{name:'大鬼',face:'👹',kind:'kemono',boss:true}
};
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

// ---- 刀の耐久 (D51): 粘りが高いほど長もち、名刀は1つ多い
export const maxDurability=s=>2+Math.floor((s.stats?.tough||0)/25)+(s.meito?1:0);
export const durOf=s=>s.dur??maxDurability(s);

// ---- 敵
export function makeFoe(rng,place,depth){
 const boss=depth%5===0,key=boss?place.boss:pickOf(rng,place.foes),F=FOES[key],d=depth+place.hard;
 const hp=Math.round((40+d*18)*(boss?2:1));
 return {key,name:F.name,face:F.face,kind:F.kind,boss,hp,maxHp:hp,atk:30+d*5+(boss?10:0)};
}
// how much a strike does: the stat the foe is weak to counts most (D56)
export function strikePower(s,foe){
 const w=KINDS[foe.kind].weak,st=s.stats||{sharp:0,tough:0,beauty:0};
 const others=Object.keys(st).filter(k=>k!==w).reduce((t,k)=>t+st[k],0)/2;
 // the weak stat counts by its square: a 90 hits about twice as hard as a 60
 return (4+st[w]*st[w]/80+others*0.15)*(s.meito?1.2:1);
}
export const critChance=s=>0.08+(s.stats?.beauty||0)/1000;

// ---- 出陣の進み方
export function startDive(rng,placeId,swords){
 const place=placeOf(placeId);
 return {place:place.id,depth:1,foe:makeFoe(rng,place,1),carry:swords.map(s=>({no:s.no,name:s.name,meito:s.meito||null,stats:s.stats,form:s.form,grade:s.grade,dur:durOf(s),max:maxDurability(s)})),
  bag:{money:0,mats:{}},fame:0,won:false,over:false,log:[]};
}
const alive=d=>d.carry.filter(c=>c.dur>0);
// one strike with the i-th sword; the foe answers if it still stands (a hard hit chips the edge: 粘り below its strength)
export function strike(d,i,rng){
 if(d.won||d.over)return d;
 const carry=d.carry.map(c=>({...c})),s=carry[i];if(!s||s.dur<=0)return d;
 const crit=rng()<critChance(s),dmg=Math.max(1,Math.round(strikePower(s,d.foe)*(crit?1.5:1)));
 const foe={...d.foe,hp:Math.max(0,d.foe.hp-dmg)};
 s.dur--;
 const ev={sword:s.name,dmg,crit,chip:false,broke:false};
 if(foe.hp>0&&s.dur>0&&foe.atk>(s.stats?.tough||0)){s.dur--;ev.chip=true;}
 if(s.dur<=0){s.dur=0;ev.broke=true;}
 let next={...d,carry,foe,log:[...d.log,ev].slice(-5)};
 if(foe.hp<=0){
  const loot=rollLoot(rng,placeOf(d.place),d.depth,foe.boss),bag={money:d.bag.money+loot.money,mats:{...d.bag.mats}};
  for(const id of loot.mats)bag.mats[id]=(bag.mats[id]||0)+1;
  next={...next,won:true,bag,loot,fame:d.fame+floorFame(d.depth,foe.boss)};
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
 return {money:lost?half(d.bag.money):d.bag.money,mats,fame:d.fame,lost,depth:d.won?d.depth:d.depth-1,carry:d.carry};
}
// the rack after the dive: worn swords keep their wear, broken ones are gone
export function returnSwords(rack,carry){
 const by=Object.fromEntries(carry.map(c=>[c.no,c]));
 return rack.flatMap(s=>{const c=by[s.no];if(!c)return [s];return c.dur>0?[{...s,dur:c.dur}]:[];});
}
