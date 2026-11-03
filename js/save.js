// The save in the browser: swords forged so far and the sound setting. Never thrown away when unreadable;
// a broken save is kept aside under a backup key and play starts fresh.
export const SAVE_KEY='tamahagane-kobo.save.v1';
export const MAX_SWORDS=200;
// collection: the 刀帳 — real swords forged so far, {name: {first, count}} (added for #4; older saves start with none)
// money: 文 from selling swords, spent on steel (#7; older saves start with the same 3,000)
export const START_MONEY=3000;
// kura: unsold swords; requests: the open orders; vouchers: free uses of a steel {id: count}; customers: how many may still
// come to the shop; ledger: what was sold, newest first; seq: drives the save's own random draws (#12)
export const emptySave=()=>({version:1,swords:[],forged:0,collection:{},money:START_MONEY,kura:[],requests:[],vouchers:{},customers:2,ledger:[],seq:1,settings:{sound:true}});

export function parseSave(text){
 if(!text)return emptySave();
 const data=JSON.parse(text);
 if(!data||data.version!==1||!Array.isArray(data.swords))throw Error('not a v1 save');
 return {...emptySave(),...data,collection:{...(data.collection||{})},vouchers:{...(data.vouchers||{})},settings:{...emptySave().settings,...data.settings}};
}
export function loadSave(storage){
 let text=null;
 try{text=storage.getItem(SAVE_KEY);}catch{return emptySave();}
 try{return parseSave(text);}
 catch{try{storage.setItem(SAVE_KEY+'.broken-'+Date.now(),text);}catch{}return emptySave();}
}
export function writeSave(storage,save){try{storage.setItem(SAVE_KEY,JSON.stringify(save));return true;}catch{return false;}}

// Newest first. The total count keeps going even when old entries drop off the list.
export function addSword(save,sword,at=Date.now()){
 const forged=(save.forged||save.swords.length)+1;
 const entry={no:forged,at,...sword};
 const collection={...(save.collection||{})};
 if(sword.meito){const was=collection[sword.meito];collection[sword.meito]=was?{...was,count:was.count+1}:{first:at,count:1,no:forged};}
 // the finished sword goes into the 蔵 (owner D26: no longer sold at once); two more customers may come
 const kura=[...(save.kura||[]),entry];
 return {...save,forged,collection,kura,customers:Math.min(5,(save.customers??2)+2),swords:[entry,...save.swords].slice(0,MAX_SWORDS)};
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
// sell one sword from the 蔵; kind: quick | shop | auction | request
export function sell(save,no,amount,kind,extra={}){
 const s=(save.kura||[]).find(x=>x.no===no);if(!s)return null;
 const ledger=[{at:Date.now(),no,name:s.name,kind,amount,...extra},...(save.ledger||[])].slice(0,100);
 return {...save,money:(save.money??START_MONEY)+amount,kura:save.kura.filter(x=>x.no!==no),ledger};
}
export const bestSword=save=>save.swords.reduce((best,s)=>!best||s.overall>best.overall?s:best,null);
