// The save in the browser: swords forged so far and the sound setting. Never thrown away when unreadable;
// a broken save is kept aside under a backup key and play starts fresh.
export const SAVE_KEY='tamahagane-kobo.save.v1';
export const MAX_SWORDS=200;
// collection: the 刀帳 — real swords forged so far, {name: {first, count}} (added for #4; older saves start with none)
export const emptySave=()=>({version:1,swords:[],forged:0,collection:{},settings:{sound:true}});

export function parseSave(text){
 if(!text)return emptySave();
 const data=JSON.parse(text);
 if(!data||data.version!==1||!Array.isArray(data.swords))throw Error('not a v1 save');
 return {...emptySave(),...data,collection:{...(data.collection||{})},settings:{...emptySave().settings,...data.settings}};
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
 return {...save,forged,collection,swords:[entry,...save.swords].slice(0,MAX_SWORDS)};
}
export const bestSword=save=>save.swords.reduce((best,s)=>!best||s.overall>best.overall?s:best,null);
