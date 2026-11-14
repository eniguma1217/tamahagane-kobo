// 出陣の試作その2（#34：合戦・用心棒の派遣・道場・国取り・村を守る）の共通部品。
// 本番のセーブは読むだけで、書きかえない。刀は刀掛けの強い順（折れた刀はのぞく）、なければ見本。数字は試作の仮のもの。
import * as R from '../js/rules.js';
import * as V from '../js/dive.js';
import {wazaOf,wazaHits} from '../js/waza.js';
import {loadArt,artImage,coverRect} from '../js/art.js';
import * as S from '../js/sound.js';
export {R,V,S,wazaOf,wazaHits,artImage,coverRect,loadArt};

export const $=s=>document.querySelector(s);
export const clamp=(v,lo=0,hi=1)=>Math.max(lo,Math.min(hi,v));
export const pick=a=>a[Math.floor(Math.random()*a.length)];

const SAMPLE=[['見本の打刀','katana','gunome',84,80],['見本の槍','yari','suguha',80,78],['見本の大太刀','odachi','notare',82,82],['見本の短刀','tanto','komidare',80,76],['見本の太刀','tachi','choji',83,80],['見本の直刀','chokuto','togari',78,84]]
 .map(([name,form,hamon,a,t],i)=>({no:-1-i,name,form,grade:'B',stats:{sharp:a,tough:t},hamon,profile:R.canonicalHamon(hamon,i+2),steps:{hamon:0.8}}));
// the player's own swords, read only: the strongest on the 刀掛け that are not broken (the samples when there are none)
export function mySwords(n=6){
 try{const sv=JSON.parse(localStorage.getItem('tamahagane-kobo.save.v1')||'null');
  const rack=(sv?.rack||[]).filter(s=>V.durOf(s)>0).sort((a,b)=>V.atkOf(b)-V.atkOf(a)).slice(0,n);
  if(rack.length)return {list:rack,own:true};}catch{}
 return {list:SAMPLE.slice(0,n),own:false};
}

// what each form does when a warrior carries it (for the 合戦, the 村, the 国取り): speed, reach (rows), how many it cuts, guard
export const ROLE={
 katana:{speed:1,range:1,sweep:1,label:'ふつう'},tanto:{speed:1.7,range:1,sweep:1,label:'手数が多い'},wakizashi:{speed:1.3,range:1,sweep:1,label:'速い'},
 tachi:{speed:0.95,range:1,sweep:1,label:'重い一太刀'},yari:{speed:1,range:2,sweep:1,label:'後ろから届く'},naginata:{speed:0.85,range:2,sweep:2,label:'後ろから2体'},
 odachi:{speed:0.65,range:1,sweep:3,label:'なぎ払い3体'},ken:{speed:1.05,range:1,sweep:1,label:'強い'},chokuto:{speed:0.8,range:1,sweep:1,guard:0.5,label:'受ける傷が半分'}
};
export const roleOf=s=>ROLE[s.form]||ROLE.katana;
export const KAN=f=>R.form(f).name[0];
// a warrior with a sword. skill: the warrior's 腕前 (×power), vigor: ×体力
export function unitOf(s,{skill=1,vigor=1,who=null}={}){
 const r=roleOf(s),hp=Math.round((60+30*V.maxDurability(s))*vigor);
 return {kind:'ally',name:who||s.name,sword:s,form:s.form,power:V.strikePower(s)*skill,hp,maxHp:hp,speed:r.speed,range:r.range,sweep:r.sweep,guard:r.guard||0,waza:wazaOf(s),ki:0,cd:0.3+Math.random()*0.4,row:0,col:0};
}
// a foe of a place at a depth, as a unit
export function foeUnit(key,depth,place){
 const F=V.FOES[key],d=depth+place.hard,hp=Math.round((40+d*18)*(F.boss?2:1)*1.6);
 return {kind:'foe',key,name:F.name,face:F.face,boss:!!F.boss,power:(14+d*4)*(F.boss?1.6:1),hp,maxHp:hp,speed:F.boss?0.8:1,range:1,sweep:F.boss?2:1,guard:0,ki:0,cd:0.5+Math.random()*0.5,row:0,col:0};
}
// one step of a battle between two sides of units (rows 0 front, 1 back). Returns the blows struck, for drawing.
// A unit hits when its timer runs out, if its reach covers the row the foe's front has (back row needs reach 2 while the front stands).
export function battleStep(A,B,dt,rng=Math.random){
 const blows=[];
 for(const [me,them] of [[A,B],[B,A]]){
  for(const u of me){if(u.hp<=0)continue;u.cd-=dt;if(u.cd>0)continue;
   const alive=them.filter(t=>t.hp>0);if(!alive.length)break;
   const frontRow=Math.min(...alive.map(t=>t.row)),reachOk=u.row===0||u.range>=2||!me.some(m=>m.hp>0&&m.row===0);
   if(!reachOk){u.cd=0.3;continue;}
   const row=alive.filter(t=>t.row===frontRow).sort((a,b)=>Math.abs(a.col-u.col)-Math.abs(b.col-u.col)).slice(0,u.sweep);
   let mult=0.85+0.3*rng(),waza=null;
   u.ki=(u.ki||0)+1;if(u.waza&&u.ki>=3){u.ki=0;waza=u.waza.name;mult*=wazaHits(u.waza,1,{hp:1e9,maxHp:0},rng).reduce((t,v)=>t+v,0)||2;}
   for(const t of row){const dmg=Math.max(1,Math.round(u.power*mult*(1-(t.guard||0))));t.hp=Math.max(0,t.hp-dmg);blows.push({from:u,to:t,dmg,waza,kill:t.hp<=0});}
   u.cd=1.2/u.speed;
  }
 }
 return blows;
}
export const sideDown=side=>side.every(u=>u.hp<=0);
// a whole battle at once (for the 派遣 and the 国取り): who won, the blows, how long it took
export function battle(A,B,rng=Math.random){
 const log=[];let t=0;
 while(t<120&&!sideDown(A)&&!sideDown(B)){t+=0.1;for(const b of battleStep(A,B,0.1,rng))log.push({...b,t});}
 return {win:sideDown(B)&&!sideDown(A),log,t};
}
// a unit's token on a canvas: a circle with the form's first letter (or the foe's picture), its HP bar
export function drawUnit(ctx,u,x,y,r,{flash=0,sel=false}={}){
 ctx.save();
 if(u.kind==='foe'){const img=artImage('foe-'+u.key);if(img)ctx.drawImage(img,x-r*1.2,y-r*1.2,r*2.4,r*2.4);else{ctx.font=`${r*1.4}px serif`;ctx.textAlign='center';ctx.fillText(u.face,x,y+r*0.5);}}
 else{ctx.fillStyle=u.hp>0?'#2e2018':'#1a1210';ctx.strokeStyle=sel?'#ffd56a':'rgba(212,170,82,.8)';ctx.lineWidth=sel?4:2;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.fillStyle='#efe6d2';ctx.font=`700 ${r}px "Hiragino Mincho ProN",serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(KAN(u.form),x,y+1);}
 if(flash>0){ctx.globalCompositeOperation='lighter';ctx.fillStyle=`rgba(255,240,200,${flash})`;ctx.beginPath();ctx.arc(x,y,r*1.1,0,Math.PI*2);ctx.fill();ctx.globalCompositeOperation='source-over';}
 if(u.hp<=0){ctx.globalAlpha=0.6;ctx.strokeStyle='#e0604a';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x-r*0.6,y-r*0.6);ctx.lineTo(x+r*0.6,y+r*0.6);ctx.moveTo(x+r*0.6,y-r*0.6);ctx.lineTo(x-r*0.6,y+r*0.6);ctx.stroke();ctx.globalAlpha=1;}
 const w=r*2,k=u.hp/u.maxHp;ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillRect(x-w/2,y+r+4,w,5);ctx.fillStyle=u.kind==='foe'?'#ff7a3a':'#7fd36a';ctx.fillRect(x-w/2,y+r+4,w*k,5);
 if(u.kind!=='foe'&&u.ki){ctx.fillStyle='#8fd3ff';for(let i=0;i<u.ki;i++)ctx.fillRect(x-w/2+i*(w/3)+1,y+r+11,w/3-2,3);}
 ctx.restore();
}
// floating numbers and slash lines, drawn over a canvas
export class Fx{
 constructor(){this.items=[];}
 num(text,x,y,color='#fff',size=22){this.items.push({type:'num',text,x,y,color,size,age:0,life:0.9});}
 line(x0,y0,x1,y1,color='255,255,255'){this.items.push({type:'line',x0,y0,x1,y1,color,age:0,life:0.3});}
 update(dt){for(const i of this.items)i.age+=dt;this.items=this.items.filter(i=>i.age<i.life);}
 draw(ctx){for(const i of this.items){const a=1-i.age/i.life;ctx.save();
  if(i.type==='line'){ctx.strokeStyle=`rgba(${i.color},${a})`;ctx.lineWidth=4+6*a;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(i.x0,i.y0);ctx.lineTo(i.x1,i.y1);ctx.stroke();}
  else{ctx.globalAlpha=a;ctx.font=`800 ${i.size}px "Hiragino Mincho ProN",serif`;ctx.textAlign='center';ctx.lineWidth=4;ctx.strokeStyle='rgba(0,0,0,.7)';const y=i.y-i.age*36;ctx.strokeText(i.text,i.x,y);ctx.fillStyle=i.color;ctx.fillText(i.text,i.x,y);}
  ctx.restore();}}
}
// a canvas that fills its box at the device's sharpness
// it follows its box: the panel below changes height as its content does
export function sharpCanvas(cv){const ctx=cv.getContext('2d'),fit=()=>{const r=cv.getBoundingClientRect(),d=Math.min(2,devicePixelRatio||1);if(!r.width||!r.height)return;cv.width=r.width*d;cv.height=r.height*d;ctx.setTransform(d,0,0,d,0,0);cv.W=r.width;cv.H=r.height;};fit();cv.refit=fit;addEventListener('resize',fit);if(typeof ResizeObserver!=='undefined')new ResizeObserver(fit).observe(cv);return ctx;}
export function background(ctx,w,h,placeId,dim=0.35){const bg=artImage('bg-'+placeId);if(bg){const r=coverRect(bg,w,h);ctx.drawImage(bg,r.dx,r.dy,r.dw,r.dh);}else{ctx.fillStyle='#1d140f';ctx.fillRect(0,0,w,h);}ctx.fillStyle=`rgba(10,6,4,${dim})`;ctx.fillRect(0,0,w,h);}
export const yen=n=>Math.round(n).toLocaleString('ja-JP');
// the page header: its name and the way back
export function header(title){return `<div class="tp"><b>${title}</b><small>試作</small><a href="./">試作をえらぶ</a></div>`;}
