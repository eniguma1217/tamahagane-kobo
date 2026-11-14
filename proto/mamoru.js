// 試作 11 村を守る（#34）：道のそばに、刀を持たせた侍を置いて、押し寄せる妖怪から村を守る。侍は自動で斬る。
// 形が役割：槍・薙刀は遠くまで、短刀は手数、大太刀はまとめて、直刀は足止め。気がたまった侍をタップで必殺技。
// 波が終わるたびに刀は傷み、折れたら置き直し。5波目は強敵。数字は試作の仮のもの。
import {$,R,V,S,mySwords,foeUnit,roleOf,KAN,sharpCanvas,background,loadArt,header,pick,wazaOf,wazaHits,Fx,artImage} from './kit.js';
const cv=$('#cv'),ctx=sharpCanvas(cv),fx=new Fx(),el={top:$('#top'),panel:$('#panel'),over:$('#over')};
const PATH=[[0.5,-0.04],[0.5,0.14],[0.16,0.24],[0.16,0.42],[0.84,0.52],[0.84,0.7],[0.42,0.8],[0.5,0.96]];
const SLOTS=[[0.3,0.12],[0.72,0.2],[0.36,0.33],[0.6,0.4],[0.3,0.58],[0.66,0.62],[0.2,0.82],[0.72,0.86]];
const WAVES=[{n:6,gap:1.1},{n:8,gap:0.95},{n:10,gap:0.85},{n:12,gap:0.75},{n:8,gap:0.9,boss:true}];
const M={state:'loading',place:V.PLACES[0],wave:0,village:10,swords:[],towers:SLOTS.map(()=>null),foes:[],spawn:null,sel:null,speed:1};
window.__proto=M;
const P=(x,y)=>({x:x*cv.W,y:(0.04+y*0.9)*cv.H});
const pathPts=()=>PATH.map(([x,y])=>P(x,y));
// where a foe stands, by the distance it has walked
function at(dist){const pts=pathPts();for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1],L=Math.hypot(b.x-a.x,b.y-a.y);if(dist<=L)return {x:a.x+(b.x-a.x)*dist/L,y:a.y+(b.y-a.y)*dist/L,done:false};dist-=L;}return {...pts.at(-1),done:true};}
function tower(s){const r=roleOf(s);return {sword:s,role:r,range:Math.min(cv.W,cv.H)*(r.range>=2?0.34:0.23),cd:0.5,ki:0,power:V.strikePower(s)*0.8,waza:wazaOf(s),slow:r.guard?0.45:0,flash:0};}
function menu(){
 M.state='menu';const mine=mySwords(6);
 el.over.hidden=false;el.over.innerHTML=`<div class="sheet"><p class="tag">出陣の試作</p><h1>11 村を守る</h1>
  <p class="howto">道のそばの<b>○</b>に、刀を持たせた侍を置く。侍は近くに来た妖怪を<b>自動で斬る</b>。<br>槍・薙刀は遠くまで／短刀は手数／大太刀はまとめて／直刀は足止め。<b>光った侍をタップで必殺技</b>。波が終わるたびに刀は傷む。<b>5波目は強敵</b>。村の体力が0で負け。</p>
  <p class="sw">${mine.own?'あなたの刀掛けの刀':'見本の刀'}：${mine.list.map(s=>`<b>${s.name}</b>`).join('・')}</p>
  <div class="places">${V.PLACES.map((p,i)=>`<button class="btn ${i===0?'primary':''}" data-place="${p.id}">${p.name}</button>`).join('')}</div><p class="note">本番のセーブは変わりません。</p></div>`;
 for(const b of el.over.querySelectorAll('[data-place]'))b.onclick=()=>{S.unlock();M.place=V.placeOf(b.dataset.place);M.swords=mine.list.map(s=>({...s,dur:V.maxDurability(s),max:V.maxDurability(s)}));M.towers=SLOTS.map(()=>null);M.wave=0;M.village=10;M.foes=[];M.state='build';el.over.hidden=true;render();};
}
const placed=i=>M.towers.some(t=>t&&t.sword===M.swords[i]);
function render(){
 el.top.innerHTML=header('11 村を守る')+`<div class="fn"><span>${M.place.name}　${M.wave}/${WAVES.length}波　村の体力 ${'♥'.repeat(Math.max(0,M.village))}</span></div>`;
 el.panel.innerHTML=`<p class="hint">${M.state==='wave'?'侍が自動で斬っている。光った侍をタップで必殺技！':'刀をえらんで、道のそばの○をタップ（置いた侍をタップでもどす）。'}</p>
  <div class="chips">${M.swords.map((s,i)=>`<button class="chip ${M.sel===i?'on':''} ${s.dur<=0?'dead':''} ${placed(i)?'used':''}" data-sw="${i}" ${s.dur<=0||placed(i)?'disabled':''}><b>${s.name}</b><small>${R.form(s.form).name}・${roleOf(s).label}</small><small>耐久${'●'.repeat(s.dur)}${'○'.repeat(Math.max(0,s.max-s.dur))}</small></button>`).join('')}</div>
  <div class="row">${M.state==='wave'?`<button class="btn" data-sp>${M.speed===1?'倍速にする':'ふつうの速さ'}</button>`:`<button class="btn primary" data-wave ${M.towers.some(Boolean)?'':'disabled'}>${M.wave+1}波目をむかえる</button>`}</div>`;
 for(const b of el.panel.querySelectorAll('[data-sw]'))b.onclick=()=>{S.tick();M.sel=M.sel===+b.dataset.sw?null:+b.dataset.sw;render();};
 el.panel.querySelector('[data-wave]')?.addEventListener('click',()=>{S.unlock();startWave();});
 el.panel.querySelector('[data-sp]')?.addEventListener('click',()=>{M.speed=M.speed===1?2:1;render();});
}
function startWave(){
 const W=WAVES[M.wave];M.wave++;M.state='wave';M.spawn={left:W.n,gap:W.gap,t:0,boss:W.boss};S.phrase(2);render();
}
function spawnOne(){
 const p=M.place,s=M.spawn,boss=s.boss&&s.left===Math.ceil(WAVES[M.wave-1].n/2);
 const f=foeUnit(boss?p.boss:pick(p.foes),M.wave+1,p);f.hp=Math.round(f.hp*(boss?2.2:0.85));f.maxHp=f.hp;
 M.foes.push({...f,dist:0,spd:(boss?28:44+M.wave*3)*(cv.H/700),slowT:0,flash:0});s.left--;
}
function endWave(){
 for(const t of M.towers)if(t){t.sword.dur=Math.max(0,t.sword.dur-1);}
 M.towers=M.towers.map(t=>t&&t.sword.dur<=0?(fx.num(`${t.sword.name}が折れた`,cv.W/2,cv.H*0.45,'#ff9a8a',18),null):t);
 if(M.wave>=WAVES.length)return end(true);
 M.state='build';fx.num(`${M.wave}波目をしのいだ！`,cv.W/2,cv.H*0.4,'#ffe08a',26);S.phrase(4);render();
}
function end(win){M.state=win?'clear':'lost';el.over.hidden=false;el.over.innerHTML=`<div class="sheet"><p class="tag">11 村を守る</p><h1>${win?'村を守りきった！':'村が荒らされた……'}</h1><p class="howto">${M.place.name}　${win?WAVES.length:M.wave-1}/${WAVES.length}波　村の体力 ${Math.max(0,M.village)}</p>
 <div class="places"><button class="btn primary" data-again>もう一度</button><a class="btn" href="./">ほかの試作へ</a><a class="btn" href="../">ゲームへ戻る</a></div><p class="note">気に入ったか、直してほしいところを教えてください。</p></div>`;el.over.querySelector('[data-again]').onclick=menu;}
// a tower's 必殺技: every foe in its reach takes the move
function fire(t){if(t.ki<3)return false;t.ki=0;t.flash=0.5;const mult=wazaHits(t.waza,1,{hp:1e9,maxHp:0},Math.random).reduce((a,b)=>a+b,0)||2;
 const tp=towerPos(t);fx.num(`『${t.waza.name}』`,tp.x,tp.y-30,'#bfe6ff',20);S.phrase(4);
 for(const f of M.foes){const p=at(f.dist);if(f.hp>0&&Math.hypot(p.x-tp.x,p.y-tp.y)<=t.range*1.3){const d=Math.round(t.power*mult*1.5);f.hp-=d;f.flash=0.3;fx.num(String(d),p.x,p.y-20,'#bfe6ff');fx.line(tp.x,tp.y,p.x,p.y,'143,211,255');}}
 return true;}
const towerPos=t=>{const i=M.towers.indexOf(t);return P(...SLOTS[i]);};
cv.addEventListener('pointerdown',e=>{
 if(M.state!=='build'&&M.state!=='wave')return;cv.refit?.();const r=cv.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
 SLOTS.forEach(([sx,sy],i)=>{const p=P(sx,sy);if(Math.hypot(x-p.x,y-p.y)>26)return;const t=M.towers[i];
  if(t){if(t.ki>=3){fire(t);return;}if(M.state==='build'){M.towers[i]=null;S.tick();render();}return;}
  if(M.sel!=null&&!placed(M.sel)&&M.swords[M.sel].dur>0){M.towers[i]=tower(M.swords[M.sel]);M.sel=null;S.tick();render();}});
});
let last=performance.now();
function frame(t){
 const dt0=Math.min(0.05,(t-last)/1000);last=t;fx.update(dt0);const dt=dt0*M.speed;
 if(M.state==='wave'){
  const s=M.spawn;if(s.left>0){s.t-=dt;if(s.t<=0){spawnOne();s.t=s.gap;}}
  for(const f of M.foes){if(f.hp<=0)continue;f.dist+=f.spd*dt*(f.slowT>0?0.55:1);f.slowT-=dt;f.flash=Math.max(0,f.flash-dt);
   if(at(f.dist).done){f.hp=0;f.leaked=true;M.village-=f.boss?3:1;fx.num(f.boss?'−3':'−1',cv.W/2,cv.H*0.93,'#ff9a8a',24);S.thud();render();}}
  for(const tw of M.towers){if(!tw)continue;tw.flash=Math.max(0,tw.flash-dt);tw.cd-=dt;const tp=towerPos(tw);
   const inR=M.foes.filter(f=>f.hp>0&&!f.leaked).map(f=>({f,p:at(f.dist)})).filter(o=>Math.hypot(o.p.x-tp.x,o.p.y-tp.y)<=tw.range).sort((a,b)=>b.f.dist-a.f.dist);
   if(tw.slow)for(const o of inR)o.f.slowT=0.3;
   if(tw.cd<=0&&inR.length){for(const o of inR.slice(0,tw.role.sweep)){const d=Math.round(tw.power*(0.85+0.3*Math.random()));o.f.hp-=d;o.f.flash=0.2;fx.line(tp.x,tp.y,o.p.x,o.p.y);fx.num(String(d),o.p.x,o.p.y-18);}
    tw.ki=Math.min(3,tw.ki+1);tw.cd=1.1/tw.role.speed;S.clang(0.5);}}
  M.foes=M.foes.filter(f=>f.hp>0||f.flash>0);
  if(M.village<=0)return end(false),requestAnimationFrame(frame);
  if(s.left<=0&&!M.foes.some(f=>f.hp>0))endWave();
 }
 draw(t/1000);requestAnimationFrame(frame);
}
function draw(time){
 const W=cv.W,H=cv.H;ctx.clearRect(0,0,W,H);background(ctx,W,H,M.place.id,0.45);
 if(M.state==='menu'||M.state==='loading')return;
 const pts=pathPts();ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='rgba(120,90,60,.85)';ctx.lineWidth=30;ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();
 ctx.strokeStyle='rgba(239,230,210,.25)';ctx.lineWidth=2;ctx.setLineDash([6,8]);ctx.stroke();ctx.setLineDash([]);
 const v=pts.at(-1);ctx.font='28px serif';ctx.textAlign='center';ctx.fillText('🏯',v.x,v.y-4);
 SLOTS.forEach(([sx,sy],i)=>{const p=P(sx,sy),t=M.towers[i];
  if(t){ctx.strokeStyle='rgba(255,255,255,.12)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(p.x,p.y,t.range,0,Math.PI*2);ctx.stroke();
   ctx.fillStyle=t.ki>=3?`rgba(58,123,213,${0.7+0.3*Math.sin(time*8)})`:'#2e2018';ctx.strokeStyle=t.ki>=3?'#bfe6ff':'rgba(212,170,82,.9)';ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y,20,0,Math.PI*2);ctx.fill();ctx.stroke();
   ctx.fillStyle='#efe6d2';ctx.font='700 18px "Hiragino Mincho ProN",serif';ctx.textBaseline='middle';ctx.fillText(KAN(t.sword.form),p.x,p.y+1);ctx.textBaseline='alphabetic';
   ctx.fillStyle='#8fd3ff';for(let k=0;k<t.ki;k++)ctx.fillRect(p.x-15+k*10,p.y+24,8,3);}
  else{ctx.strokeStyle=M.sel!=null?'rgba(255,213,106,.9)':'rgba(239,230,210,.45)';ctx.lineWidth=2;ctx.setLineDash([4,4]);ctx.beginPath();ctx.arc(p.x,p.y,18,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}});
 for(const f of M.foes){const p=at(f.dist),r=f.boss?30:20,img=artImage('foe-'+f.key);ctx.save();if(f.hp<=0)ctx.globalAlpha=f.flash/0.3;
  if(img)ctx.drawImage(img,p.x-r,p.y-r,r*2,r*2);else{ctx.font=`${r*1.4}px serif`;ctx.fillText(f.face,p.x,p.y+r*0.5);}
  if(f.flash>0){ctx.globalCompositeOperation='lighter';ctx.fillStyle=`rgba(255,240,200,${f.flash})`;ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();ctx.globalCompositeOperation='source-over';}
  ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillRect(p.x-r,p.y+r+2,r*2,4);ctx.fillStyle='#ff7a3a';ctx.fillRect(p.x-r,p.y+r+2,r*2*Math.max(0,f.hp)/f.maxHp,4);ctx.restore();}
 fx.draw(ctx);
}
el.over.hidden=false;el.over.innerHTML='<div class="sheet"><p class="tag">出陣の試作</p><h1>読みこみ中…</h1></div>';
loadArt('../assets/').finally(()=>{menu();requestAnimationFrame(frame);});
M.place_=(slot,i)=>{if(!M.towers[slot]&&M.swords[i]&&!placed(i)){M.towers[slot]=tower(M.swords[i]);render();}};M.startWave=()=>startWave();M.fire=i=>M.towers[i]&&fire(M.towers[i]);
