// The save in the browser. Never thrown away when unreadable; a broken save is kept aside under a backup key and play starts fresh.
export const SAVE_KEY='tamahagane-kobo.save.v1';
export const MAX_SWORDS=200;
export const START_MONEY=3000;
// collection: the 刀帳 {name: {first, count, no}}; money: 文, spent on steel; vouchers: free uses of a steel {id: count};
// ledger: the orders delivered, newest first; seq: drives the save's own random draws and ids;
// fame: the shop's 評判; owners: the people who took swords on journeys, and the regulars (#15);
// orders: the three orders on the board; synergies: the hidden pairs found {id: first} (#17)
export const emptySave=()=>({version:1,swords:[],forged:0,collection:{},money:START_MONEY,vouchers:{},ledger:[],seq:1,fame:0,owners:[],orders:[],synergies:{},settings:{sound:true}});

export function parseSave(text){
 if(!text)return emptySave();
 const data=JSON.parse(text);
 if(!data||data.version!==1||!Array.isArray(data.swords))throw Error('not a v1 save');
 return {...emptySave(),...data,collection:{...(data.collection||{})},vouchers:{...(data.vouchers||{})},synergies:{...(data.synergies||{})},settings:{...emptySave().settings,...data.settings}};
}
export function loadSave(storage){
 let text=null;
 try{text=storage.getItem(SAVE_KEY);}catch{return emptySave();}
 try{return parseSave(text);}
 catch{try{storage.setItem(SAVE_KEY+'.broken-'+Date.now(),text);}catch{}return emptySave();}
}
export function writeSave(storage,save){try{storage.setItem(SAVE_KEY,JSON.stringify(save));return true;}catch{return false;}}

// #17 (owner D43: only orders now): swords left in the old 蔵 are taken by the wholesaler at six tenths of their 相場,
// and the old requests and shop-front customers go. Returns the save and a line to show once (or null).
export function migrateOrders(save){
 const kura=save.kura||[];
 if(!kura.length&&!save.requests&&save.customers==null)return {save,notice:null};
 const paid=kura.reduce((t,s)=>t+Math.round((s.price||0)*0.6/50)*50,0);
 const {kura:_k,requests:_r,customers:_c,...rest}=save;
 const next={...rest,money:(save.money??START_MONEY)+paid};
 return {save:next,notice:kura.length?`店を注文だけにしたので、蔵に残っていた刀${kura.length}振は問屋が引き取った（＋${paid.toLocaleString('ja-JP')}文）。`:null};
}

// Newest first. The total count keeps going even when old entries drop off the list.
export function addSword(save,sword,at=Date.now()){
 const forged=(save.forged||save.swords.length)+1;
 const entry={no:forged,at,...sword};
 const collection={...(save.collection||{})};
 if(sword.meito){const was=collection[sword.meito];collection[sword.meito]=was?{...was,count:was.count+1}:{first:at,count:1,no:forged};}
 const synergies={...(save.synergies||{})};if(sword.synergy&&!synergies[sword.synergy])synergies[sword.synergy]=at;
 // every sword forged brings the journeys one step nearer their end (#15, D34)
 const owners=(save.owners||[]).map(p=>p.journey&&p.journey.left>0?{...p,journey:{...p.journey,left:p.journey.left-1}}:p);
 return {...save,forged,collection,synergies,owners,swords:[entry,...save.swords].slice(0,MAX_SWORDS)};
}
export function pay(save,cost){
 const money=save.money??START_MONEY;
 if(cost>money)return null;
 return {...save,money:money-cost};
}
// pay for a build's steel, using free vouchers first (one per piece)
export function payBuild(save,mats,priceOf){
 const vouchers={...(save.vouchers||{})};let cost=0;const used=[];
 for(const id of mats){if(vouchers[id]>0){vouchers[id]--;used.push(id);}else cost+=priceOf(id);}
 const paid=pay(save,cost);
 return paid?{...paid,vouchers,used,cost}:null;
}
export const bestSword=save=>save.swords.reduce((best,s)=>!best||s.overall>best.overall?s:best,null);
