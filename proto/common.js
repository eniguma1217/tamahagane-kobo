// 出陣の試作（#30、オーナー：①見切り斬り と ②斬り筋なぞり を試作して触り比べる）の共通部分。
// 本番のセーブは読むだけで、書きかえない。刀は刀掛けの強い順に3振（なければ見本）。敵は本番と同じ絵と出陣先で、5階が強敵。
// ここの数字は試作の仮のもの。
import * as R from '../js/rules.js';
import * as V from '../js/dive.js';
import {wazaOf,wazaHits,KI_MAX} from '../js/waza.js';
import {loadArt,artImage,coverRect} from '../js/art.js';
import * as S from '../js/sound.js';
export {R,V,S,KI_MAX};

const $=s=>document.querySelector(s);
const clamp=(v,lo=0,hi=1)=>Math.max(lo,Math.min(hi,v));
export const FLOORS=5,HP_SCALE=2.5;
const SAMPLE=[
 {no:-1,name:'見本の打刀',form:'katana',grade:'B',stats:{sharp:82,tough:80},hamon:'gunome',steps:{hamon:0.8}},
 {no:-2,name:'見本の太刀',form:'tachi',grade:'B',stats:{sharp:80,tough:78},hamon:'notare',steps:{hamon:0.8}},
 {no:-3,name:'見本の短刀',form:'tanto',grade:'B',stats:{sharp:84,tough:76},hamon:'suguha',steps:{hamon:0.8}}
].map(s=>({...s,profile:R.canonicalHamon(s.hamon,3)}));
// the player's own swords, read only: the three strongest on the 刀掛け that are not broken
function mySwords(){
 try{const sv=JSON.parse(localStorage.getItem('tamahagane-kobo.save.v1')||'null');
  const rack=(sv?.rack||[]).filter(s=>V.durOf(s)>0).sort((a,b)=>V.atkOf(b)-V.atkOf(a)).slice(0,3);
  if(rack.length)return {list:rack,own:true};}catch{}
 return {list:SAMPLE,own:false};
}

// combat: {name, howto, begin(proto), update(dt), draw(ctx), down(p), move(p), up(p), qa()} — the part each prototype changes
export function startProto(combat){
 S.setSound(true);
 const cv=$('#cv'),ctx=cv.getContext('2d'),el={top:$('#top'),cards:$('#cards'),over:$('#over'),hint:$('#hint')};
 const P={combat,place:V.PLACES[0],depth:1,foe:null,carry:[],active:0,fx:[],nums:[],shake:0,flash:0,flashColor:'255,60,40',
  stats:{good:0,perfect:0,miss:0,waza:0},trace:null,busy:0,state:'menu',w:0,h:0};
 window.__proto=P;
 const fit=()=>{const r=cv.getBoundingClientRect(),d=Math.min(2,devicePixelRatio||1);cv.width=r.width*d;cv.height=r.height*d;ctx.setTransform(d,0,0,d,0,0);P.w=r.width;P.h=r.height;};
 addEventListener('resize',fit);
 // the foe's box on the canvas
 P.box=()=>{const s=Math.min(P.w*0.92,P.h*0.78);return {x:(P.w-s)/2,y:Math.max(8,(P.h-s)/2-10),w:s,h:s};};
 P.sword=()=>P.carry[P.active];
 P.say=t=>{el.hint.innerHTML=t;};
 P.num=(text,x,y,color='#fff',size=30)=>P.nums.push({text,x,y,color,size,age:0});
 P.slash=(pts,color='255,255,255')=>P.fx.push({pts,color,age:0});
 // a blow on the foe with the active sword: mult times its strike; returns the damage
 P.hit=(mult=1,crit=false,{ki=1,x,y}={})=>{
  const s=P.sword();if(!s||s.dur<=0||!P.foe)return 0;
  const dmg=Math.max(1,Math.round(V.strikePower(s)*mult*(crit?1.5:1)));
  P.foe.hp=Math.max(0,P.foe.hp-dmg);s.ki=Math.min(KI_MAX,(s.ki||0)+ki);
  const b=P.box();P.num(String(dmg),x??b.x+b.w/2,y??b.y+b.h*0.4,crit?'#ffe08a':'#fff',crit?40:32);
  P.foe.hurt=0.35;S.clang(crit?1.2:0.9);renderCards();renderTop();
  if(P.foe.hp<=0)P.foeDown();
  return dmg;
 };
 // the foe's blow lands: the active sword takes it (耐久 -1); a broken one gives way to the next
 P.hurt=(why='')=>{
  const s=P.sword();if(!s)return;
  s.dur=Math.max(0,s.dur-1);P.shake=0.35;P.flash=0.4;P.flashColor='255,60,40';P.stats.miss++;S.thud();
  const b=P.box();P.num(why||'受けた！',b.x+b.w/2,b.y+b.h*0.75,'#ff8a7a',24);
  if(s.dur<=0){P.num(`${s.name}が折れた`,P.w/2,P.h*0.55,'#ff8a7a',22);const next=P.carry.findIndex(c=>c.dur>0);if(next<0)return P.end(false);P.active=next;}
  renderCards();
 };
 P.foeDown=()=>{
  P.busy=1.3;S.phrase(P.foe.boss?5:3);
  setTimeout(()=>{if(P.depth>=FLOORS)return P.end(true);P.depth++;nextFoe();},1300);
 };
 function nextFoe(){
  const f=V.makeFoe(Math.random,P.place,P.depth),hp=Math.round(f.hp*HP_SCALE);
  P.foe={...f,hp,maxHp:hp,hurt:0};P.trace=null;
  renderTop();renderCards();combat.begin(P);
 }
 // ---- 必殺技: trace the sword's own 刃文 over the foe; the closer, the stronger
 P.startWaza=()=>{
  const s=P.sword();if(!s||s.dur<=0||(s.ki||0)<KI_MAX||P.trace||P.busy>0)return;
  const b=P.box(),band={x:b.x+b.w*0.04,y:b.y+b.h*0.3,w:b.w*0.92,h:b.h*0.4},prof=s.profile&&s.profile.length>8?s.profile:R.canonicalHamon(s.waza.type,3);
  const guide=prof.map((v,i)=>({x:band.x+band.w*(i/(prof.length-1)),y:band.y+band.h*(1-v)}));
  P.trace={guide,band,pts:[],left:3,w:s.waza};S.glint(2);P.say(`<b>『${s.waza.name}』</b> 光る刃文を、左から右へなぞれ！`);
 };
 P.endWaza=()=>{
  const t=P.trace;if(!t)return;P.trace=null;const s=P.sword();
  const pts=t.pts.slice().sort((a,b)=>a.x-b.x),xs=pts.map(p=>p.x);
  const cover=pts.length>2?(Math.max(...xs)-Math.min(...xs))/t.band.w:0;
  const yAt=x=>{const g=t.guide,i=clamp(Math.floor((x-g[0].x)/(g[1].x-g[0].x)),0,g.length-2),k=clamp((x-g[i].x)/(g[i+1].x-g[i].x));return g[i].y+(g[i+1].y-g[i].y)*k;};
  const err=pts.length?R.mean(pts.map(p=>Math.abs(p.y-yAt(p.x))))/t.band.h:1;
  const acc=clamp((1-err*3))*clamp(cover/0.8);
  const hits=wazaHits(t.w,V.strikePower(s)*(0.6+0.6*acc),P.foe,Math.random);
  s.ki=0;s.dur=Math.max(0,s.dur-t.w.cost);if(s.dur>0)s.dur=Math.min(s.max,s.dur+t.w.heal);P.stats.waza++;
  P.lastWaza={name:t.w.name,acc,hits};P.slash(t.guide,'143,211,255');P.say(`『${t.w.name}』 なぞり ${Math.round(acc*100)}%`);
  P.busy=0.5+hits.length*0.17;const b=P.box();
  hits.forEach((h,k)=>setTimeout(()=>{if(!P.foe)return;P.foe.hp=Math.max(0,P.foe.hp-h);P.foe.hurt=0.3;S.clang(1.1);
   P.num(String(h),b.x+b.w*(0.3+0.4*Math.random()),b.y+b.h*(0.3+0.3*Math.random()),t.w.crit?'#ffe08a':'#bfe6ff',34);renderTop();
   if(k===hits.length-1&&P.foe.hp<=0)P.foeDown();},k*170));
  renderCards();
 };
 // ---- screens
 function renderTop(){
  if(!P.foe){el.top.innerHTML='';return;}
  el.top.innerHTML=`<div class="tp"><b>${P.place.name}</b><small>深さ ${P.depth}/${FLOORS}</small><a href="./">試作をえらぶ</a></div>
   <div class="fn"><span>${P.foe.name}${P.foe.boss?'<em>強敵</em>':''}</span><i class="hp"><b style="width:${Math.round(100*P.foe.hp/P.foe.maxHp)}%"></b></i></div>`;
 }
 function renderCards(){
  el.cards.innerHTML=P.carry.map((c,i)=>`<div class="cd ${i===P.active?'on':''} ${c.dur<=0?'broken':''} ${(c.ki||0)>=KI_MAX&&c.dur>0?'full':''}">
   <button class="pick" data-pick="${i}" ${c.dur<=0?'disabled':''}><b>${c.name}</b><span>攻撃力 ${V.atkOf(c)}</span><span class="pips">${'●'.repeat(c.dur)}${'○'.repeat(Math.max(0,c.max-c.dur))}</span><span class="ki">気 ${'▰'.repeat(c.ki||0)}${'▱'.repeat(KI_MAX-(c.ki||0))}</span></button>
   <button class="wz" data-waza="${i}" ${(c.ki||0)>=KI_MAX&&c.dur>0?'':'disabled'}>${c.waza.name}</button></div>`).join('');
  for(const b of el.cards.querySelectorAll('[data-pick]'))b.onclick=()=>{S.unlock();if(P.trace)return;P.active=+b.dataset.pick;S.tick();renderCards();};
  for(const b of el.cards.querySelectorAll('[data-waza]'))b.onclick=()=>{S.unlock();P.active=+b.dataset.waza;renderCards();P.startWaza();};
 }
 function menu(){
  P.state='menu';P.foe=null;renderTop();el.cards.innerHTML='';
  const mine=mySwords();
  el.over.hidden=false;el.over.innerHTML=`<div class="sheet"><p class="tag">出陣の試作</p><h1>${combat.name}</h1><p class="howto">${combat.howto}</p>
   <p class="sw">${mine.own?'あなたの刀掛けの強い3振':'見本の刀（刀掛けに刀がないため）'}：${mine.list.map(s=>`<b>${s.name}</b>`).join('・')}</p>
   <div class="places">${V.PLACES.map((p,i)=>`<button class="btn ${i===0?'primary':''}" data-place="${p.id}">${p.name}</button>`).join('')}</div>
   <p class="note">5階まで。5階は強敵。本番のセーブは変わりません。</p></div>`;
  for(const b of el.over.querySelectorAll('[data-place]'))b.onclick=()=>{S.unlock();start(b.dataset.place,mine.list);};
 }
 function start(placeId,list){
  P.place=V.placeOf(placeId);P.depth=1;P.stats={good:0,perfect:0,miss:0,waza:0};P.lastWaza=null;
  P.carry=list.map(s=>{const c=V.carried(s);return {...c,dur:c.max,profile:s.profile};});P.active=0;
  el.over.hidden=true;P.state='play';nextFoe();
 }
 P.end=win=>{
  P.state=win?'clear':'lost';P.busy=99;
  el.over.hidden=false;el.over.innerHTML=`<div class="sheet"><p class="tag">${combat.name}</p><h1>${win?'踏破！':'刀が尽きた……'}</h1>
   <p class="howto">深さ ${win?FLOORS:P.depth-1}　${combat.result?combat.result(P):''}　受けた ${P.stats.miss}回　必殺技 ${P.stats.waza}回</p>
   <div class="places"><button class="btn primary" data-again>もう一度</button><a class="btn" href="${combat.other.href}">${combat.other.label}</a><a class="btn" href="../">ゲームへ戻る</a></div>
   <p class="note">気に入ったほう、直してほしいところを教えてください。</p></div>`;
  el.over.querySelector('[data-again]').onclick=()=>{P.busy=0;menu();};
 };
 // ---- input and the loop
 const pt=e=>{const r=cv.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top,t:performance.now()};};
 cv.addEventListener('pointerdown',e=>{S.unlock();if(P.state!=='play')return;cv.setPointerCapture?.(e.pointerId);const p=pt(e);
  if(P.trace){P.trace.pts=[p];P.trace.drawing=true;return;}if(P.busy>0)return;combat.down?.(p,P);});
 cv.addEventListener('pointermove',e=>{if(P.state!=='play')return;const p=pt(e);
  if(P.trace?.drawing){P.trace.pts.push(p);return;}if(P.busy>0)return;combat.move?.(p,P);});
 cv.addEventListener('pointerup',e=>{if(P.state!=='play')return;const p=pt(e);
  if(P.trace?.drawing){P.trace.drawing=false;P.endWaza();return;}if(P.busy>0)return;combat.up?.(p,P);});
 let last=performance.now();
 function frame(t){
  const dt=Math.min(0.05,(t-last)/1000);last=t;
  if(P.state==='play'){
   if(P.busy>0)P.busy-=dt;
   if(P.trace){P.trace.left-=dt;if(P.trace.left<=0)P.endWaza();}
   else if(P.busy<=0&&P.foe&&P.foe.hp>0)combat.update(dt,P);
  }
  if(P.foe)P.foe.hurt=Math.max(0,(P.foe.hurt||0)-dt);
  P.shake=Math.max(0,P.shake-dt);P.flash=Math.max(0,P.flash-dt);
  for(const n of P.nums)n.age+=dt;P.nums=P.nums.filter(n=>n.age<1);
  for(const f of P.fx)f.age+=dt;P.fx=P.fx.filter(f=>f.age<0.5);
  draw(t/1000);requestAnimationFrame(frame);
 }
 function draw(time){
  const w=P.w,h=P.h;ctx.clearRect(0,0,w,h);
  const bg=artImage('bg-'+P.place.id);
  if(bg){const r=coverRect(bg,w,h);ctx.drawImage(bg,r.dx,r.dy,r.dw,r.dh);}else{ctx.fillStyle='#1d140f';ctx.fillRect(0,0,w,h);}
  ctx.fillStyle='rgba(10,6,4,0.25)';ctx.fillRect(0,0,w,h);
  ctx.save();if(P.shake>0)ctx.translate((Math.random()-0.5)*14*P.shake/0.35,(Math.random()-0.5)*10*P.shake/0.35);
  if(P.foe){const b=P.box(),img=artImage('foe-'+P.foe.key),k=P.foe.hurt||0,dead=P.foe.hp<=0;
   ctx.save();if(dead){ctx.globalAlpha=0.45;ctx.translate(0,12);}if(k>0)ctx.translate(Math.sin(time*80)*8*k/0.35,0);
   if(img)ctx.drawImage(img,b.x,b.y,b.w,b.h);else{ctx.font=`${b.w*0.5}px serif`;ctx.textAlign='center';ctx.fillText(P.foe.face,b.x+b.w/2,b.y+b.h*0.65);}
   if(k>0){ctx.globalCompositeOperation='lighter';ctx.globalAlpha=k/0.35*0.5;if(img)ctx.drawImage(img,b.x,b.y,b.w,b.h);}
   ctx.restore();
   if(P.state==='play'&&!dead)combat.draw(ctx,P,time);
  }
  // 必殺技 guide and trail
  if(P.trace){const t=P.trace;ctx.save();ctx.fillStyle='rgba(10,20,40,0.35)';ctx.fillRect(0,0,w,h);
   ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=`rgba(143,211,255,${0.55+0.35*Math.sin(time*8)})`;ctx.lineWidth=14;ctx.shadowColor='#8fd3ff';ctx.shadowBlur=18;
   ctx.beginPath();t.guide.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();
   ctx.shadowBlur=0;ctx.strokeStyle='rgba(255,255,255,0.95)';ctx.lineWidth=5;ctx.beginPath();t.pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();
   ctx.fillStyle='#bfe6ff';ctx.font='bold 18px "Hiragino Mincho ProN",serif';ctx.textAlign='center';ctx.fillText(`のこり ${Math.max(0,t.left).toFixed(1)}秒`,w/2,t.band.y-14);
   ctx.restore();}
  for(const f of P.fx){const a=1-f.age/0.5;ctx.save();ctx.strokeStyle=`rgba(${f.color},${a})`;ctx.lineWidth=10*a+2;ctx.lineCap='round';ctx.shadowColor=`rgb(${f.color})`;ctx.shadowBlur=20;
   ctx.beginPath();f.pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();ctx.restore();}
  ctx.restore();
  if(P.flash>0){ctx.fillStyle=`rgba(${P.flashColor},${P.flash*0.5})`;ctx.fillRect(0,0,w,h);}
  for(const n of P.nums){ctx.save();ctx.globalAlpha=1-n.age;ctx.font=`800 ${n.size}px "Hiragino Mincho ProN",serif`;ctx.textAlign='center';ctx.lineWidth=5;ctx.strokeStyle='rgba(0,0,0,0.7)';
   const y=n.y-n.age*40;ctx.strokeText(n.text,n.x,y);ctx.fillStyle=n.color;ctx.fillText(n.text,n.x,y);ctx.restore();}
 }
 loadArt('../assets/').finally(()=>{fit();menu();requestAnimationFrame(frame);});
 return P;
}
