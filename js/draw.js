// Code-drawn art for 玉鋼工房 (until the owner's ChatGPT images arrive; see art.js). Flat Japanese colours,
// warm forge light. Static backdrops are painted once per size into an offscreen canvas; fire, glow and sparks per frame.
import {steelRGB} from './rules.js';
import {artImage,coverRect,artBox} from './art.js';

export const C={sumi:'#1b1512',night:'#120c0a',wood:'#4a3324',woodHi:'#6b4a33',woodDark:'#2e2018',paper:'#efe6d2',paperDark:'#d9cbb0',
 shu:'#c8402a',gold:'#d4aa52',ai:'#2b3a55',clay:'#7a6656',clayHi:'#9a8673',iron:'#3b3a40',ironHi:'#6d6c75',water:'#2f5d73'};

const rgb=(c,a=1)=>`rgba(${c[0]},${c[1]},${c[2]},${a})`;
export const steelColor=(temp,a=1)=>rgb(steelRGB(temp),a);
// glow strength of hot steel, 0 when black
export const glowOf=temp=>Math.max(0,Math.min(1,(temp-560)/600));

// deterministic noise so painted textures do not change between frames
function rand(seed){let s=seed>>>0||1;return ()=>((s=Math.imul(s^(s>>>15),2246822519)^Math.imul(s^(s>>>13),3266489917))>>>0)/4294967296;}

const cache=new Map();
function painted(key,w,h,paint){
 const k=`${key}:${w}x${h}`;let c=cache.get(k);
 if(!c){c=document.createElement('canvas');c.width=Math.ceil(w*DPR());c.height=Math.ceil(h*DPR());const g=c.getContext('2d');g.scale(DPR(),DPR());paint(g,w,h);if(cache.size>24)cache.clear();cache.set(k,c);}
 return c;
}
let dpr=1;export const setDPR=v=>{dpr=v;cache.clear();};const DPR=()=>dpr;

// ---------- the room ----------
function paintRoom(g,w,h,{floor=0.74,light=false,rope=true}={}){
 const r=rand(7);
 const wall=g.createLinearGradient(0,0,0,h);
 if(light){wall.addColorStop(0,'#3a2a20');wall.addColorStop(1,'#5a4231');}else{wall.addColorStop(0,'#140d0a');wall.addColorStop(1,'#2a1c15');}
 g.fillStyle=wall;g.fillRect(0,0,w,h);
 // wall boards
 const bw=Math.max(34,w/9);
 for(let x=0;x<w;x+=bw){g.fillStyle=`rgba(0,0,0,${0.12+r()*0.12})`;g.fillRect(x,0,1.5,h*floor);g.fillStyle=`rgba(255,220,180,${light?0.05:0.025})`;g.fillRect(x+2,0,bw*0.4,h*floor);}
 // beam and posts
 g.fillStyle=light?'#2a1d16':'#0d0806';g.fillRect(0,h*0.1,w,Math.max(14,h*0.028));
 g.fillRect(w*0.04,0,Math.max(10,w*0.03),h*floor);g.fillRect(w*0.93,0,Math.max(10,w*0.03),h*floor);
 // 注連縄 and 紙垂 under the beam
 if(rope){
 const ry=h*0.1+Math.max(14,h*0.028)+6;
 g.strokeStyle='#b89a5e';g.lineWidth=Math.max(5,h*0.011);g.lineCap='round';g.beginPath();
 g.moveTo(w*0.08,ry);g.quadraticCurveTo(w*0.5,ry+h*0.045,w*0.92,ry);g.stroke();
 g.strokeStyle='rgba(90,60,30,0.6)';g.lineWidth=1.2;
 for(let i=0;i<26;i++){const t=i/25,x=w*0.08+t*w*0.84,y=ry+h*0.045*4*t*(1-t)*0.5*2;g.beginPath();g.moveTo(x-4,y-3);g.lineTo(x+3,y+3);g.stroke();}
 for(const t of [0.22,0.4,0.6,0.78]){
  // 紙垂: a strip of paper cut into a zigzag that steps down
  const x=w*0.08+t*w*0.84,y=ry+h*0.045*4*t*(1-t)+1,s=Math.max(4,h*0.01);
  g.fillStyle=C.paper;g.beginPath();
  g.moveTo(x-s*0.4,y);g.lineTo(x+s*0.4,y);g.lineTo(x+s*0.4,y+s*1.6);g.lineTo(x+s*1.3,y+s*1.6);g.lineTo(x+s*1.3,y+s*3.2);g.lineTo(x+s*0.4,y+s*3.2);g.lineTo(x+s*0.4,y+s*4.8);g.lineTo(x+s*1.3,y+s*4.8);g.lineTo(x+s*1.3,y+s*6.4);
  g.lineTo(x+s*0.5,y+s*6.4);g.lineTo(x+s*0.5,y+s*5.2);g.lineTo(x-s*0.4,y+s*5.2);g.lineTo(x-s*0.4,y+s*3.6);g.lineTo(x+s*0.5,y+s*3.6);g.lineTo(x+s*0.5,y+s*2);g.lineTo(x-s*0.4,y+s*2);g.closePath();g.fill();
  g.fillStyle='rgba(0,0,0,0.12)';g.fillRect(x+s*0.4,y+s*1.6,s*0.9,s*0.35);g.fillRect(x+s*0.4,y+s*4.8,s*0.9,s*0.35);
 }
 }
 // 土間 floor
 const fy=h*floor,fl=g.createLinearGradient(0,fy,0,h);
 fl.addColorStop(0,light?'#4a372a':'#251a14');fl.addColorStop(1,light?'#3a2b21':'#17100c');
 g.fillStyle=fl;g.fillRect(0,fy,w,h-fy);
 g.fillStyle='rgba(0,0,0,0.35)';g.fillRect(0,fy,w,2);
 for(let i=0;i<w*h*0.0016;i++){g.fillStyle=`rgba(${r()<0.5?'255,230,200':'0,0,0'},${0.04+r()*0.06})`;g.fillRect(r()*w,fy+r()*(h-fy),1+r()*2,1);}
}

// 火床 (hearth): clay box with a bed of charcoal; returns the mouth rectangle for the scene to place steel and flames
export function hearthBox(w,h){const bw=Math.min(w*0.78,420),bh=Math.max(90,h*0.2);return {x:(w-bw)/2,y:h*0.62-bh*0.5,w:bw,h:bh};}
function paintHearth(g,w,h){
 const b=hearthBox(w,h),r=rand(11);
 // clay body
 g.fillStyle='#5b3a28';roundRect(g,b.x-14,b.y-10,b.w+28,b.h+40,16);g.fill();
 g.fillStyle='#6e4a34';roundRect(g,b.x-14,b.y-10,b.w+28,14,8);g.fill();
 for(let i=0;i<40;i++){g.fillStyle=`rgba(0,0,0,${0.08+r()*0.1})`;g.fillRect(b.x-10+r()*(b.w+20),b.y+r()*(b.h+26),4+r()*10,1.5);}
 // mouth
 g.fillStyle='#1a0d08';roundRect(g,b.x,b.y+4,b.w,b.h,10);g.fill();
 // charcoal pieces
 for(let i=0;i<70;i++){
  const x=b.x+8+r()*(b.w-16),y=b.y+b.h*0.45+r()*b.h*0.5,s=6+r()*12;
  g.fillStyle=`rgb(${18+r()*14},${14+r()*10},${12+r()*8})`;g.beginPath();
  for(let k=0;k<5;k++){const a=k/5*Math.PI*2+r();g.lineTo(x+Math.cos(a)*s*(0.6+r()*0.5),y+Math.sin(a)*s*0.6*(0.6+r()*0.5));}
  g.closePath();g.fill();
 }
 // 鞴 (bellows) box on the left
 const fx=Math.max(4,b.x-Math.min(70,w*0.16)),fw=Math.min(62,w*0.15),fh=b.h*0.8,fyb=b.y+b.h*0.2;
 g.fillStyle=C.wood;roundRect(g,fx,fyb,fw,fh,6);g.fill();g.fillStyle=C.woodHi;g.fillRect(fx+4,fyb+4,fw-8,6);
 g.strokeStyle='rgba(0,0,0,0.35)';g.lineWidth=1.5;for(let i=1;i<4;i++){g.beginPath();g.moveTo(fx+3,fyb+fh*i/4);g.lineTo(fx+fw-3,fyb+fh*i/4);g.stroke();}
}
export const bellowsBox=(w,h)=>{const b=hearthBox(w,h);const fx=Math.max(4,b.x-Math.min(70,w*0.16)),fw=Math.min(62,w*0.15);return {x:fx,y:b.y+b.h*0.2,w:fw,h:b.h*0.8};};

// 金床 (anvil) on a stump
export function anvilBox(w,h){const aw=Math.min(w*0.62,320),ah=Math.max(40,h*0.07);return {x:(w-aw)/2,y:h*0.6,w:aw,h:ah};}
function paintAnvil(g,w,h){
 const a=anvilBox(w,h);
 // distant hearth glow at the back left
 const gl=g.createRadialGradient(w*0.15,h*0.45,4,w*0.15,h*0.45,w*0.6);gl.addColorStop(0,'rgba(255,120,40,0.28)');gl.addColorStop(1,'rgba(255,120,40,0)');g.fillStyle=gl;g.fillRect(0,0,w,h);
 // stump
 g.fillStyle='#4f3524';roundRect(g,a.x+a.w*0.2,a.y+a.h*0.9,a.w*0.6,h-(a.y+a.h*0.9)+20,8);g.fill();
 g.fillStyle='rgba(0,0,0,0.25)';for(let i=0;i<6;i++)g.fillRect(a.x+a.w*0.24+i*a.w*0.09,a.y+a.h,2,h);
 // anvil body
 g.fillStyle=C.iron;g.beginPath();
 g.moveTo(a.x,a.y);g.lineTo(a.x+a.w,a.y);g.lineTo(a.x+a.w*0.92,a.y+a.h*0.55);g.lineTo(a.x+a.w*0.75,a.y+a.h*0.7);g.lineTo(a.x+a.w*0.78,a.y+a.h*1.05);
 g.lineTo(a.x+a.w*0.22,a.y+a.h*1.05);g.lineTo(a.x+a.w*0.25,a.y+a.h*0.7);g.lineTo(a.x+a.w*0.08,a.y+a.h*0.55);g.closePath();g.fill();
 g.fillStyle=C.ironHi;g.fillRect(a.x,a.y,a.w,Math.max(4,a.h*0.12));
 g.fillStyle='rgba(255,255,255,0.12)';g.fillRect(a.x+6,a.y+1,a.w*0.5,2);
}

// 水舟 (water trough) for quenching, and a long hearth above it
export function troughBox(w,h){const own=artBox('bg-quench',w,h,'box2');if(own)return own;const tw=Math.min(w*0.9,460),th=Math.max(60,h*0.14);return {x:(w-tw)/2,y:h*0.78,w:tw,h:th};}
export function longHearth(w,h){const lw=Math.min(w*0.92,470),lh=Math.max(70,h*0.15);return {x:(w-lw)/2,y:h*0.3,w:lw,h:lh};}
function paintQuench(g,w,h){
 const t=troughBox(w,h),L=longHearth(w,h),r=rand(5);
 g.fillStyle='#5b3a28';roundRect(g,L.x-10,L.y-8,L.w+20,L.h+24,14);g.fill();
 g.fillStyle='#1a0d08';roundRect(g,L.x,L.y,L.w,L.h,10);g.fill();
 for(let i=0;i<80;i++){const x=L.x+6+r()*(L.w-12),y=L.y+L.h*0.5+r()*L.h*0.45,s=5+r()*9;g.fillStyle=`rgb(${18+r()*14},${14+r()*10},12)`;g.beginPath();g.ellipse(x,y,s,s*0.55,r()*3,0,Math.PI*2);g.fill();}
 // trough
 g.fillStyle=C.wood;roundRect(g,t.x,t.y,t.w,t.h,8);g.fill();
 g.fillStyle=C.woodHi;g.fillRect(t.x,t.y,t.w,6);
 const wg=g.createLinearGradient(0,t.y+8,0,t.y+t.h);wg.addColorStop(0,'#3d7790');wg.addColorStop(1,'#1b3644');
 g.fillStyle=wg;roundRect(g,t.x+8,t.y+10,t.w-16,t.h-18,5);g.fill();
 g.strokeStyle='rgba(255,255,255,0.18)';g.lineWidth=1.5;for(let i=0;i<4;i++){g.beginPath();const y=t.y+16+i*7;g.moveTo(t.x+20+i*18,y);g.lineTo(t.x+t.w*0.5-i*10,y);g.stroke();}
}

// 研ぎ場: bright work bench
function paintBench(g,w,h){
 const top=h*0.3,bh=h*0.5,r=rand(3);
 const wd=g.createLinearGradient(0,top,0,top+bh);wd.addColorStop(0,'#8a6444');wd.addColorStop(1,'#6b4a33');
 g.fillStyle=wd;g.fillRect(0,top,w,bh);
 for(let i=0;i<22;i++){g.strokeStyle=`rgba(40,25,15,${0.08+r()*0.12})`;g.lineWidth=1+r()*1.5;g.beginPath();const y=top+r()*bh;g.moveTo(0,y);g.bezierCurveTo(w*0.3,y+r()*10-5,w*0.7,y+r()*10-5,w,y+r()*8-4);g.stroke();}
 g.fillStyle='rgba(0,0,0,0.3)';g.fillRect(0,top,w,3);g.fillRect(0,top+bh,w,4);
 // window light
 const lt=g.createRadialGradient(w*0.8,0,10,w*0.8,0,h*0.9);lt.addColorStop(0,'rgba(255,240,210,0.25)');lt.addColorStop(1,'rgba(255,240,210,0)');g.fillStyle=lt;g.fillRect(0,0,w,h);
}

export function backdrop(ctx,w,h,kind){
 const own=artImage('bg-'+({hamon:'bench',polish:'bench',plain:'room',materials:'room'}[kind]||kind));
 if(own){const r=coverRect(own,w,h);ctx.fillStyle=C.night;ctx.fillRect(0,0,w,h);ctx.drawImage(own,r.dx,r.dy,r.dw,r.dh);return;}
 const img=painted(kind,w,h,(g,w,h)=>{
  if(kind==='polish'||kind==='hamon'){paintRoom(g,w,h,{floor:0.84,light:true});paintBench(g,w,h);}
  else{paintRoom(g,w,h,{rope:kind!=='title'&&kind!=='plain'});if(kind==='heat'||kind==='title')paintHearth(g,w,h);if(kind==='hammer')paintAnvil(g,w,h);if(kind==='quench')paintQuench(g,w,h);}
 });
 ctx.drawImage(img,0,0,w,h);
}

// warm flickering light over the room
export function fireLight(ctx,x,y,rad,strength,t){
 const f=strength*(0.85+0.08*Math.sin(t*7.3)+0.05*Math.sin(t*13.1+1));
 const g=ctx.createRadialGradient(x,y,2,x,y,rad);g.addColorStop(0,`rgba(255,150,60,${0.45*f})`);g.addColorStop(0.4,`rgba(255,100,30,${0.18*f})`);g.addColorStop(1,'rgba(255,90,20,0)');
 ctx.save();ctx.globalCompositeOperation='lighter';ctx.fillStyle=g;ctx.fillRect(x-rad,y-rad,rad*2,rad*2);ctx.restore();
}

// tongues of flame along a box; power 0..1 makes them taller
export function flames(ctx,box,t,power){
 ctx.save();ctx.globalCompositeOperation='lighter';
 const n=Math.max(6,Math.round(box.w/26));
 for(let i=0;i<n;i++){
  const cx=box.x+box.w*(i+0.5)/n,base=box.y+box.h*0.62,ph=i*1.7;
  const ht=box.h*(0.35+0.5*power)*(0.75+0.25*Math.sin(t*(6+i%3)+ph)+0.15*Math.sin(t*11+ph*2));
  const wd=box.w/n*0.9;
  for(const [k,col] of [[1,'rgba(255,70,20,0.55)'],[0.7,'rgba(255,150,40,0.6)'],[0.4,'rgba(255,230,140,0.7)']]){
   const sway=Math.sin(t*4+ph)*wd*0.25;
   ctx.fillStyle=col;ctx.beginPath();ctx.moveTo(cx-wd*0.5*k,base);
   ctx.quadraticCurveTo(cx-wd*0.6*k,base-ht*k*0.5,cx+sway,base-ht*k);
   ctx.quadraticCurveTo(cx+wd*0.6*k,base-ht*k*0.5,cx+wd*0.5*k,base);ctx.closePath();ctx.fill();
  }
 }
 // glowing coals
 const cg=ctx.createLinearGradient(0,box.y+box.h*0.5,0,box.y+box.h);cg.addColorStop(0,`rgba(255,110,30,${0.25+0.35*power})`);cg.addColorStop(1,'rgba(255,60,10,0.05)');
 ctx.fillStyle=cg;ctx.fillRect(box.x+4,box.y+box.h*0.45,box.w-8,box.h*0.55);
 ctx.restore();
}

// a bar of steel (延べ棒) glowing at temp
export function steelBar(ctx,x,y,len,thick,temp){
 const gl=glowOf(temp);
 ctx.save();
 if(gl>0){ctx.shadowColor=steelColor(temp,0.9);ctx.shadowBlur=10+24*gl;}
 const g=ctx.createLinearGradient(0,y-thick/2,0,y+thick/2);
 g.addColorStop(0,steelColor(temp+60));g.addColorStop(0.5,steelColor(temp));g.addColorStop(1,steelColor(temp-90));
 ctx.fillStyle=g;roundRect(ctx,x,y-thick/2,len,thick,thick*0.35);ctx.fill();
 ctx.restore();
 ctx.fillStyle='rgba(255,255,255,0.18)';ctx.fillRect(x+thick*0.3,y-thick/2+2,len-thick*0.6,Math.max(1.5,thick*0.12));
}
// tongs (箸) holding the bar from the right
export function tongs(ctx,x,y,toX,spread){
 ctx.save();ctx.strokeStyle='#17120f';ctx.lineCap='round';ctx.lineWidth=5;
 ctx.beginPath();ctx.moveTo(x,y-spread);ctx.lineTo(toX,y-spread*2.2);ctx.moveTo(x,y+spread);ctx.lineTo(toX,y+spread*2.2);ctx.stroke();
 ctx.strokeStyle='#3a332d';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y-spread);ctx.lineTo(toX,y-spread*2.2);ctx.stroke();ctx.restore();
}

// ---------- the blade ----------
// u runs 0 (元, by the 鎺) … 1 (切っ先). Edge (刃) down, back (棟) up. sori bows the blade.
// opt: widen (wider toward the tip, 薙刀), double (両刃: 剣・槍), leaf (槍の穂), hira (平造: no 鎬 line), fukura (短刀の丸い切っ先), kiriha (切刃造: 鎬が刃寄り)
export function bladeGeom(x0,x1,y,wid,sori=0,opt={}){
 const len=x1-x0,sag=len*0.05*sori;
 const cy=u=>y+sag*4*u*(1-u)-sag*0.6*u;
 let hw=u=>wid*0.5*(1-0.28*u+(opt.widen||0)*u);
 if(opt.double)hw=opt.leaf?(u=>wid*0.5*(u<0.3?0.55+0.45*u/0.3:Math.max(0,(1-u)/0.7))):(u=>wid*0.5*(u<0.8?1-0.15*u:Math.max(0,(1-u)/0.2*0.88)));
 const back=u=>cy(u)-hw(u);
 const tipFrom=opt.fukura?0.72:0.88;
 const edge=opt.double?(u=>cy(u)+hw(u)):(u=>{const e=cy(u)+hw(u);if(u<tipFrom)return e;const k=(u-tipFrom)/(1-tipFrom);return e-(e-back(u)-hw(u)*0.15)*Math.pow(k,opt.fukura?1.3:1.7);});
 const ratio=opt.kiriha?0.3:0.7;
 const shinogi=opt.double?cy:(u=>edge(u)-(edge(u)-back(u))*ratio);
 const X=u=>x0+len*u;
 // a point in the 刃文 band: v 0 at the edge … 1 at the 鎬 (for 両刃, toward the middle ridge)
 const band=opt.double?((u,v)=>edge(u)-(edge(u)-cy(u))*v*0.85):((u,v)=>edge(u)-(edge(u)-shinogi(u))*v);
 return {x0,x1,len,wid,cy,back,edge,shinogi,X,band,yokote:opt.double||opt.hira?null:tipFrom,double:!!opt.double,hira:!!opt.hira,tangLen:opt.tangLen,tangWid:opt.tangWid};
}
// each 形 seen whole: share of tang, width (of the blade length), bow, length (of the widest), and the shape options
export const SHAPE={
 tachi:{tang:0.24,wid:0.04,sori:0.9,len:1},
 katana:{tang:0.24,wid:0.044,sori:0.55,len:0.88},
 wakizashi:{tang:0.26,wid:0.055,sori:0.45,len:0.64},
 tanto:{tang:0.45,wid:0.11,sori:0,len:0.4,hira:true,fukura:true},
 odachi:{tang:0.22,wid:0.03,sori:0.7,len:1},
 naginata:{tang:0.75,wid:0.075,sori:1.4,len:0.62,widen:0.75},
 yari:{tang:1.2,wid:0.12,sori:0,len:0.4,double:true,leaf:true},
 ken:{tang:0.32,wid:0.09,sori:0,len:0.58,double:true},
 chokuto:{tang:0.22,wid:0.045,sori:0,len:0.86,kiriha:true}
};
// the whole sword, fitted into box. opt.sori overrides the form's bow (from the real sword's numbers).
export function fullSwordGeom(formId,box,opt={}){
 const S=SHAPE[formId]||SHAPE.katana,lenF=opt.len??S.len;
 const blade=box.w*lenF/(1+S.tang),total=blade*(1+S.tang),x0=box.x+(box.w-total)/2+blade*S.tang;
 const wid=Math.max(5,Math.min(box.h*0.6,blade*S.wid*(opt.widScale||1)));
 return bladeGeom(x0,x0+blade,box.y+box.h*0.5,wid,opt.sori??S.sori,{...S,tangLen:blade*S.tang,tangWid:S.double?0.32:0.6});
}
export function fullSword(ctx,formId,box,opt={}){const G=fullSwordGeom(formId,box,opt);blade(ctx,G,{...opt,tang:true});return G;}
function bladeOutline(ctx,G,from=0){
 ctx.beginPath();const N=48;
 for(let i=0;i<=N;i++){const u=from+(1-from)*i/N;i?ctx.lineTo(G.X(u),G.back(u)):ctx.moveTo(G.X(u),G.back(u));}
 for(let i=N;i>=0;i--){const u=from+(1-from)*i/N;ctx.lineTo(G.X(u),G.edge(u));}
 ctx.closePath();
}
// profile: HAMON_N heights 0..1 in the band; drawn from u=0 to the 横手 then following the tip (帽子)
function hamonPath(ctx,G,profile){
 const n=profile.length,at=u=>{const p=Math.min(n-1,Math.max(0,u*(n-1)));const i=Math.floor(p),f=p-i;return profile[i]*(1-f)+(profile[Math.min(n-1,i+1)]??profile[i])*f;};
 ctx.beginPath();const N=80;
 for(let i=0;i<=N;i++){const u=i/N*0.97,v=u<0.88?at(u/0.88):at(1)*(1-(u-0.88)/0.09)+0.9*((u-0.88)/0.09);ctx.lineTo(G.X(u),G.band(u,Math.min(1.2,v)));}
 for(let i=N;i>=0;i--){const u=i/N*0.97;ctx.lineTo(G.X(u),G.edge(u)+1);}
 ctx.closePath();
}
// A finished, polished blade with its tang, 鎺 and 刃文. opts: profile, temp (glowing), clay (0..1 band height trace), crack
export function blade(ctx,G,{profile=null,temp=0,crack=false,tang=true,gleam=-1,dull=false}={}){
 ctx.save();
 if(tang){
  const tl=G.tangLen??G.len*0.2,ty=G.cy(0)+(G.double?0:G.wid*0.08),tw=(G.tangWid??0.6)*(G.edge(0)-G.back(0));
  ctx.fillStyle='#4a3326';ctx.beginPath();ctx.moveTo(G.x0,ty-tw/2-1);ctx.lineTo(G.x0-tl,ty-tw*0.3);ctx.lineTo(G.x0-tl-Math.min(tw*0.4,6),ty+tw*0.12);ctx.lineTo(G.x0,ty+tw/2+1);ctx.closePath();ctx.fill();
  ctx.fillStyle='rgba(0,0,0,0.35)';ctx.beginPath();ctx.arc(G.x0-tl*0.55,ty,Math.max(1.5,tw*0.18),0,Math.PI*2);ctx.fill();
  // 鎺
  const hw=Math.max(8,G.wid*0.45);const hg=ctx.createLinearGradient(0,G.back(0)-3,0,G.edge(0)+3);hg.addColorStop(0,'#f2d27a');hg.addColorStop(0.5,'#c9962f');hg.addColorStop(1,'#8a6420');
  ctx.fillStyle=hg;roundRect(ctx,G.x0-hw,G.back(0)-3,hw,G.edge(0)-G.back(0)+6,3);ctx.fill();
 }
 const gl=glowOf(temp);
 if(gl>0){
  ctx.shadowColor=steelColor(temp,0.9);ctx.shadowBlur=8+22*gl;
  const g=ctx.createLinearGradient(0,G.back(0.5),0,G.edge(0.5));g.addColorStop(0,steelColor(temp+50));g.addColorStop(1,steelColor(temp-70));
  ctx.fillStyle=g;bladeOutline(ctx,G);ctx.fill();ctx.restore();return;
 }
 // polished steel: dark 地鉄 above, bright 刃文 toward the edge
 const g=ctx.createLinearGradient(0,G.back(0.5),0,G.edge(0.5));
 if(dull){g.addColorStop(0,'#9aa0a8');g.addColorStop(0.35,'#7c838c');g.addColorStop(0.75,'#6a7079');g.addColorStop(1,'#8b929b');}
 else{g.addColorStop(0,'#cfd6de');g.addColorStop(0.3,'#7f8a96');g.addColorStop(0.7,'#5d6874');g.addColorStop(1,'#8d98a4');}
 ctx.fillStyle=g;bladeOutline(ctx,G);ctx.fill();
 ctx.save();bladeOutline(ctx,G);ctx.clip();
 if(profile&&!dull){
  const side=()=>{
   ctx.fillStyle='rgba(236,242,248,0.9)';hamonPath(ctx,G,profile);ctx.fill();
   ctx.strokeStyle='rgba(255,255,255,0.9)';ctx.lineWidth=Math.max(1,G.wid*0.05);ctx.shadowColor='rgba(255,255,255,0.9)';ctx.shadowBlur=6;
   // 匂口 (the bright line of the hamon)
   ctx.beginPath();const n=profile.length;for(let i=0;i<=80;i++){const u=i/80*0.88,p=u/0.88*(n-1),k=Math.floor(p),f=p-k,v=profile[k]*(1-f)+(profile[Math.min(n-1,k+1)])*f;ctx.lineTo(G.X(u),G.band(u,v));}ctx.stroke();ctx.shadowBlur=0;
  };
  side();
  if(G.double){const c=G.cy(0.5);ctx.save();ctx.translate(0,2*c);ctx.scale(1,-1);side();ctx.restore();}
 }
 // 鎬 line and 横手 (none on 平造; the middle ridge on 両刃)
 ctx.strokeStyle='rgba(30,35,45,0.45)';ctx.lineWidth=1;
 if(!G.hira){ctx.beginPath();for(let i=0;i<=40;i++){const u=i/40*(G.double?0.97:0.88);ctx.lineTo(G.X(u),G.shinogi(u));}ctx.stroke();}
 if(G.yokote){ctx.beginPath();ctx.moveTo(G.X(G.yokote),G.shinogi(G.yokote));ctx.lineTo(G.X(G.yokote),G.edge(G.yokote));ctx.stroke();}
 if(gleam>=0){const gx=G.X(gleam),gg=ctx.createLinearGradient(gx-G.wid*2,0,gx+G.wid*2,0);gg.addColorStop(0,'rgba(255,255,255,0)');gg.addColorStop(0.5,'rgba(255,255,255,0.55)');gg.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=gg;ctx.fillRect(gx-G.wid*2,G.back(gleam)-G.wid,G.wid*4,G.wid*3);}
 if(crack){ctx.strokeStyle='rgba(15,10,10,0.9)';ctx.lineWidth=Math.max(1.5,G.wid*0.06);ctx.beginPath();const u=0.55;ctx.moveTo(G.X(u),G.edge(u));ctx.lineTo(G.X(u+0.012),G.band(u,0.4));ctx.lineTo(G.X(u-0.006),G.band(u,0.75));ctx.lineTo(G.X(u+0.01),G.band(u,1.05));ctx.stroke();}
 ctx.restore();
 ctx.strokeStyle='rgba(10,10,15,0.55)';ctx.lineWidth=1;bladeOutline(ctx,G);ctx.stroke();
 ctx.restore();
}
// the clay (焼刃土) laid along the traced line: thick toward the back, thin toward the edge
export function clay(ctx,G,line){
 ctx.save();bladeOutline(ctx,G);ctx.clip();
 ctx.fillStyle='rgba(94,74,59,0.35)';ctx.fillRect(G.x0,G.back(0)-G.wid,G.len,G.wid*3);
 if(line.length>1){
  ctx.fillStyle='#5e4a3b';ctx.beginPath();ctx.moveTo(line[0].px,line[0].py);for(const p of line)ctx.lineTo(p.px,p.py);
  ctx.lineTo(line.at(-1).px,G.back(0)-G.wid);ctx.lineTo(line[0].px,G.back(0)-G.wid);ctx.closePath();ctx.fill();
  ctx.save();ctx.clip();const r=rand(21);for(let i=0;i<260;i++){ctx.fillStyle=`rgba(${r()<0.5?'30,20,14':'150,125,100'},0.35)`;ctx.fillRect(G.x0+r()*G.len,G.back(0.5)-G.wid*0.6+r()*G.wid*1.8,2+r()*3,1.5+r()*2);}ctx.restore();
  ctx.fillStyle='rgba(255,255,255,0.08)';ctx.beginPath();ctx.moveTo(line[0].px,line[0].py);for(const p of line)ctx.lineTo(p.px,p.py-3);for(let i=line.length-1;i>=0;i--)ctx.lineTo(line[i].px,line[i].py);ctx.closePath();ctx.fill();
  ctx.strokeStyle='#4d3f34';ctx.lineWidth=2.5;ctx.lineJoin='round';ctx.beginPath();for(const p of line)ctx.lineTo(p.px,p.py);ctx.stroke();
 }
 ctx.restore();
}
export function bladeShape(ctx,G){bladeOutline(ctx,G);}
export function clayFromProfile(ctx,G,profile,alpha=1){
 const n=profile.length;ctx.save();bladeOutline(ctx,G);ctx.clip();ctx.globalAlpha=alpha;
 ctx.fillStyle=C.clay;ctx.beginPath();
 for(let i=0;i<=60;i++){const u=i/60*0.88,p=u/0.88*(n-1),k=Math.floor(p),f=p-k,v=profile[k]*(1-f)+profile[Math.min(n-1,k+1)]*f;ctx.lineTo(G.X(u),G.band(u,v));}
 ctx.lineTo(G.X(0.88),G.band(0.88,0.9));ctx.lineTo(G.X(1),G.back(1));ctx.lineTo(G.X(1),G.back(0)-G.wid);ctx.lineTo(G.X(0),G.back(0)-G.wid);ctx.closePath();ctx.fill();
 ctx.fillStyle='rgba(122,102,86,0.5)';bladeOutline(ctx,G);ctx.fill();
 ctx.restore();
}

// ---------- hammer and sparks ----------
// 槌: pivot is the hand; ang 0.9 is raised, -0.15 is striking (the head's lower face level with the pivot - 0.45·size)
export const HAMMER_UP=0.9,HAMMER_DOWN=-0.15;
export function hammerPivot(cx,top,size){return {x:cx+1.206*size,y:top-0.449*size};}
export function hammer(ctx,px,py,size,swing){
 const ang=HAMMER_UP+(HAMMER_DOWN-HAMMER_UP)*swing;
 ctx.save();ctx.translate(px,py);ctx.rotate(ang);
 ctx.fillStyle='#7a5536';roundRect(ctx,-size*1.1,-size*0.07,size*1.35,size*0.14,size*0.05);ctx.fill();
 ctx.fillStyle='rgba(255,255,255,0.12)';ctx.fillRect(-size*1.05,-size*0.06,size*1.2,size*0.03);
 const hg=ctx.createLinearGradient(-size*1.38,-size*0.27,-size*1.06,size*0.27);hg.addColorStop(0,'#8a8992');hg.addColorStop(1,'#2f2e34');
 ctx.fillStyle=hg;roundRect(ctx,-size*1.38,-size*0.27,size*0.32,size*0.54,size*0.05);ctx.fill();
 ctx.fillStyle='rgba(0,0,0,0.3)';ctx.fillRect(-size*1.38,size*0.2,size*0.32,size*0.07);
 ctx.restore();
}
export class Sparks{
 constructor(){this.p=[];}
 burst(x,y,n,power=1,dir=-Math.PI/2,spread=Math.PI*0.9){
  for(let i=0;i<n;i++){const a=dir+(Math.random()-0.5)*spread*2,s=(120+Math.random()*320)*power;this.p.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:0.5+Math.random()*0.6,age:0});}
 }
 ember(x,y){this.p.push({x,y,vx:(Math.random()-0.5)*20,vy:-30-Math.random()*50,life:1.5+Math.random()*1.5,age:0,slow:true});}
 update(dt){for(const p of this.p){p.age+=dt;p.vy+=(p.slow?-6:520)*dt;p.vx*=p.slow?1:0.985;p.x+=p.vx*dt;p.y+=p.vy*dt;}this.p=this.p.filter(p=>p.age<p.life);}
 draw(ctx){
  ctx.save();ctx.globalCompositeOperation='lighter';ctx.lineCap='round';
  for(const p of this.p){const k=1-p.age/p.life;ctx.strokeStyle=`rgba(255,${Math.round(150+100*k)},${Math.round(60*k)},${k})`;ctx.lineWidth=p.slow?2:1.6;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x-p.vx*0.018,p.y-p.vy*0.018);ctx.stroke();}
  ctx.restore();
 }
}
export class Steam{
 constructor(){this.p=[];}
 puff(x,y,n,spread){for(let i=0;i<n;i++)this.p.push({x:x+(Math.random()-0.5)*spread,y,vx:(Math.random()-0.5)*30,vy:-40-Math.random()*70,r:6+Math.random()*10,life:1.2+Math.random()*1,age:0});}
 update(dt){for(const p of this.p){p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.r+=22*dt;}this.p=this.p.filter(p=>p.age<p.life);}
 draw(ctx){for(const p of this.p){const k=1-p.age/p.life;ctx.fillStyle=`rgba(235,235,230,${0.35*k})`;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();}}
}

// ---------- gauge ----------
// vertical temperature gauge: lo..hi, a gold band for the right colour, a red zone above danger
export function gauge(ctx,x,y,w,h,{lo,hi,temp,band,danger,label}){
 ctx.save();
 ctx.fillStyle='rgba(0,0,0,0.45)';roundRect(ctx,x-6,y-8,w+12,h+16,10);ctx.fill();
 const g=ctx.createLinearGradient(0,y+h,0,y);
 for(let i=0;i<=8;i++){const t=lo+(hi-lo)*i/8;g.addColorStop(i/8,steelColor(t));}
 ctx.fillStyle=g;roundRect(ctx,x,y,w,h,w/2);ctx.fill();
 const Y=t=>y+h-(Math.max(lo,Math.min(hi,t))-lo)/(hi-lo)*h;
 if(danger!=null){ctx.fillStyle='rgba(200,40,30,0.75)';ctx.fillRect(x,y,w,Y(danger)-y);ctx.strokeStyle='rgba(255,255,255,0.5)';ctx.lineWidth=1;for(let yy=y+4;yy<Y(danger);yy+=6){ctx.beginPath();ctx.moveTo(x,yy+4);ctx.lineTo(x+w,yy);ctx.stroke();}}
 ctx.strokeStyle=C.gold;ctx.lineWidth=3;ctx.strokeRect(x-3,Y(band[1]),w+6,Y(band[0])-Y(band[1]));
 // needle
 const ny=Y(temp);ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(x-12,ny-7);ctx.lineTo(x-2,ny);ctx.lineTo(x-12,ny+7);ctx.closePath();ctx.fill();
 ctx.fillRect(x-2,ny-1.5,w+4,3);
 if(label){ctx.fillStyle=C.gold;ctx.font='bold 11px "Hiragino Sans","Yu Gothic",sans-serif';ctx.textAlign='right';ctx.fillText(label,x-14,(Y(band[0])+Y(band[1]))/2+4);}
 ctx.restore();
}

export function gaugeH(ctx,x,y,w,h,{lo,hi,temp,band,danger,label}){
 ctx.save();
 ctx.fillStyle='rgba(0,0,0,0.5)';roundRect(ctx,x-8,y-6,w+16,h+12,10);ctx.fill();
 const g=ctx.createLinearGradient(x,0,x+w,0);
 for(let i=0;i<=8;i++){const t=lo+(hi-lo)*i/8;g.addColorStop(i/8,steelColor(t));}
 ctx.fillStyle=g;roundRect(ctx,x,y,w,h,h/2);ctx.fill();
 const X=t=>x+(Math.max(lo,Math.min(hi,t))-lo)/(hi-lo)*w;
 if(danger!=null){ctx.fillStyle='rgba(200,40,30,0.8)';ctx.fillRect(X(danger),y,x+w-X(danger),h);}
 ctx.strokeStyle=C.gold;ctx.lineWidth=3;ctx.strokeRect(X(band[0]),y-3,X(band[1])-X(band[0]),h+6);
 const nx=X(temp);ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(nx-7,y-12);ctx.lineTo(nx,y-2);ctx.lineTo(nx+7,y-12);ctx.closePath();ctx.fill();ctx.fillRect(nx-1.5,y-2,3,h+4);
 if(label){ctx.fillStyle=C.gold;ctx.font='bold 11px "Hiragino Sans","Yu Gothic",sans-serif';ctx.textAlign='center';ctx.fillText(label,(X(band[0])+X(band[1]))/2,y+h+16);}
 if(danger!=null){ctx.fillStyle='#ff9a8a';ctx.font='bold 11px "Hiragino Sans","Yu Gothic",sans-serif';ctx.textAlign='center';ctx.fillText('割れる',(X(danger)+x+w)/2,y+h+16);}
 ctx.restore();
}
export function roundRect(ctx,x,y,w,h,r){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
