// The save in the browser. Never thrown away when unreadable; a broken save is kept aside under a backup key and play starts fresh.
export const SAVE_KEY='tamahagane-kobo.save.v1';
export const MAX_SWORDS=200;
export const START_MONEY=3000;
// collection: the 刀帳 {name: {first, count, no}}; money: 文; ledger: the orders delivered, newest first;
// seq: drives the save's own random draws and ids; fame: the shop's 評判; orders: the requests on the board;
// synergies: the hidden pairs found {id: first} (#17); rack: the 刀掛け, swords ready to carry or deliver (each with its wear, dur);
// materials: steel in hand {id: count} (#19, D54: mostly from the dives)
export const emptySave=()=>({version:1,swords:[],forged:0,collection:{},money:START_MONEY,ledger:[],seq:1,fame:0,orders:[],synergies:{},rack:[],materials:{jou:1,nami:2},dives:0,deepest:{},settings:{sound:true}});

export function parseSave(text){
 if(!text)return emptySave();
 const data=JSON.parse(text);
 if(!data||data.version!==1||!Array.isArray(data.swords))throw Error('not a v1 save');
 return {...emptySave(),...data,collection:{...(data.collection||{})},synergies:{...(data.synergies||{})},materials:{...(data.materials??emptySave().materials)},deepest:{...(data.deepest||{})},settings:{...emptySave().settings,...data.settings}};
}
export function loadSave(storage){
 let text=null;
 try{text=storage.getItem(SAVE_KEY);}catch{return emptySave();}
 try{return parseSave(text);}
 catch{try{storage.setItem(SAVE_KEY+'.broken-'+Date.now(),text);}catch{}return emptySave();}
}
export function writeSave(storage,save){try{storage.setItem(SAVE_KEY,JSON.stringify(save));return true;}catch{return false;}}

// #19: from older saves, the swords of the old 蔵 come onto the 刀掛け (as many as fit; the rest go to the wholesaler at six tenths),
// free-steel vouchers become steel in hand, and the old requests, customers and journeys go. Returns the save and a line to show once.
export function migrateRack(save,rackMax=12){
 const kura=save.kura||[],vouchers=save.vouchers||{};
 const old=kura.length||Object.keys(vouchers).length||save.requests||save.customers!=null||save.owners;
 if(!old)return {save,notice:null};
 const room=Math.max(0,rackMax-(save.rack||[]).length),keep=kura.slice(-room),sold=kura.slice(0,kura.length-keep.length);
 const paid=sold.reduce((t,s)=>t+Math.round((s.price||0)*0.6/50)*50,0);
 const materials={...(save.materials||{})};for(const [id,n] of Object.entries(vouchers))if(n>0)materials[id]=(materials[id]||0)+n;
 const {kura:_k,requests:_r,customers:_c,vouchers:_v,owners:_o,...rest}=save;
 const next={...rest,rack:[...(save.rack||[]),...keep],materials,money:(save.money??START_MONEY)+paid};
 const lines=[];
 if(keep.length)lines.push(`蔵にあった刀${keep.length}振を、刀掛けに移した。`);
 if(sold.length)lines.push(`入りきらない${sold.length}振は問屋が引き取った（＋${paid.toLocaleString('ja-JP')}文）。`);
 if(Object.keys(vouchers).length)lines.push('素材の無料券は、素材そのものに替えた。');
 if(save.owners?.some(p=>p.journey))lines.push('旅に出ていた持ち主たちは、それぞれの道を行った。');
 return {save:next,notice:lines.length?lines.join('<br>'):null};
}

// Newest first. The total count keeps going even when old entries drop off the list. The new sword goes onto the 刀掛け.
export function addSword(save,sword,at=Date.now()){
 const forged=(save.forged||save.swords.length)+1;
 const entry={no:forged,at,...sword};
 const collection={...(save.collection||{})};
 if(sword.meito){const was=collection[sword.meito];collection[sword.meito]=was?{...was,count:was.count+1}:{first:at,count:1,no:forged};}
 const synergies={...(save.synergies||{})};if(sword.synergy&&!synergies[sword.synergy])synergies[sword.synergy]=at;
 return {...save,forged,collection,synergies,rack:[...(save.rack||[]),entry],swords:[entry,...save.swords].slice(0,MAX_SWORDS)};
}
// take the steel for a build: from what is in hand first, otherwise bought at the shop (null when it cannot be had)
export function takeSteel(save,mats,shop){
 const materials={...(save.materials||{})};let cost=0;const bought=[];
 for(const id of mats){if(materials[id]>0)materials[id]--;else if(id in shop){cost+=shop[id];bought.push(id);}else return null;}
 const money=save.money??START_MONEY;if(cost>money)return null;
 return {...save,materials,money:money-cost,cost,bought};
}
export function addLoot(save,loot){
 const materials={...(save.materials||{})};for(const [id,n] of Object.entries(loot.mats||{}))materials[id]=(materials[id]||0)+n;
 return {...save,money:(save.money??START_MONEY)+(loot.money||0),fame:Math.max(0,(save.fame||0)+(loot.fame||0)),materials};
}
export const bestSword=save=>save.swords.reduce((best,s)=>!best||s.overall>best.overall?s:best,null);
