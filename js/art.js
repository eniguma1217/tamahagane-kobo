// The owner's own pictures (made with ChatGPT from docs/ART_PROMPTS.md). assets/art.json lists the ones that exist:
//   {"bg-hammer": {"file": "bg-hammer.png", "box": [x, y, w, h]}, "oyakata": {"file": "oyakata.png"}, ...}
// box is where the key object (hearth mouth, anvil top, trough, …) sits in the picture, 0..1 of its width/height,
// so the code-drawn steel lands on it. Anything not listed keeps the code-drawn version.
// "later": true (the dive pictures, #21) loads after the first screen, so the start is not slowed.
const loaded=new Map(),listed=new Map();

export async function loadArt(base='assets/'){
 let list={};
 try{const r=await fetch(base+'art.json',{cache:'no-cache'});if(r.ok)list=await r.json();}catch{}
 const load=([key,entry])=>new Promise(done=>{
  const img=new Image();img.onload=()=>{loaded.set(key,{img,...entry});done();};img.onerror=()=>{listed.delete(key);done();};img.src=base+entry.file;
 });
 const all=Object.entries(list);for(const [key,entry] of all)listed.set(key,base+entry.file);
 await Promise.all(all.filter(([,e])=>!e.later).map(load));
 Promise.all(all.filter(([,e])=>e.later).map(load));
 return [...loaded.keys()];
}
export const artImage=key=>loaded.get(key)?.img||null;
export const artSrc=key=>loaded.get(key)?.img.src||null;
// for an <img>: the file's address even before it has finished loading (null once it failed, e.g. no WebP: then the emoji)
export const artUrl=key=>listed.get(key)||null;

// draw an image to fill w×h, cropping the overflow evenly
export function coverRect(img,w,h){
 const s=Math.max(w/img.naturalWidth,h/img.naturalHeight),dw=img.naturalWidth*s,dh=img.naturalHeight*s;
 return {dx:(w-dw)/2,dy:(h-dh)/2,dw,dh,s};
}
// the key object's box on screen, or null when the picture has none (then the code layout is used)
export function artBox(key,w,h,which='box'){
 const a=loaded.get(key);if(!a?.[which])return null;
 const r=coverRect(a.img,w,h),[x,y,bw,bh]=a[which];
 return {x:r.dx+x*r.dw,y:r.dy+y*r.dh,w:bw*r.dw,h:bh*r.dh};
}
