// 試作 5 合戦（#34）：刀を持たせた侍を、前列・後列に並べて合戦。戦いは自動で、並べ方が作戦。3戦目は強敵。
// 形で役割がちがう：槍・薙刀は後ろから届く、大太刀はなぎ払い、短刀は手数、直刀は傷を半分に。数字は試作の仮のもの。
import {$,R,V,S,mySwords,unitOf,foeUnit,battleStep,sideDown,drawUnit,Fx,sharpCanvas,background,loadArt,header,roleOf,pick} from './kit.js';
const cv=$('#cv'),ctx=sharpCanvas(cv),fx=new Fx(),el={top:$('#top'),panel:$('#panel'),over:$('#over')};
const G={state:'loading',place:V.PLACES[0],wave:1,allies:[],foes:[],sel:null,speed:1,flash:new Map(),banner:null};
window.__proto=G;
const WAVES=3,slotXY=(side,row,col)=>{const W=cv.W,H=cv.H,x=W*(0.2+0.3*col),y=side==='ally'?H*(row===0?0.62:0.82):H*(row===0?0.36:0.16);return {x,y};};
const R0=()=>Math.min(cv.W,cv.H)*0.075;
function menu(){
 G.state='menu';const mine=mySwords(5);
 el.over.hidden=false;el.over.innerHTML=`<div class="sheet"><p class="tag">出陣の試作</p><h1>5 合戦</h1>
  <p class="howto">刀を持たせた侍を、<b>前列・後列</b>に並べて戦う。戦いは自動。<b>並べ方が作戦</b>。<br>槍・薙刀は後ろから届く／大太刀は3体なぎ払い／短刀は手数が多い／直刀は受ける傷が半分。3回たたくと必殺技。3戦目は強敵。</p>
  <p class="sw">${mine.own?'あなたの刀掛けの5振':'見本の刀'}：${mine.list.map(s=>`<b>${s.name}</b>`).join('・')}</p>
  <div class="places">${V.PLACES.map((p,i)=>`<button class="btn ${i===0?'primary':''}" data-place="${p.id}">${p.name}</button>`).join('')}</div><p class="note">本番のセーブは変わりません。</p></div>`;
 for(const b of el.over.querySelectorAll('[data-place]'))b.onclick=()=>{S.unlock();G.place=V.placeOf(b.dataset.place);G.wave=1;G.allies=mine.list.map(s=>({...unitOf(s),row:-1,col:-1}));setup();};
}
function makeWave(){
 const p=G.place,n=G.wave===WAVES?3:2+G.wave,d=G.wave*2;
 const list=Array.from({length:n},()=>foeUnit(pick(p.foes),d,p));if(G.wave===WAVES)list[1]=foeUnit(p.boss,5,p);
 list.forEach((f,i)=>{f.row=i<3?0:1;f.col=i<3?i:(i-3)*2;});return list;
}
function setup(){
 G.state='setup';el.over.hidden=true;G.foes=makeWave();for(const a of G.allies){a.cd=0.3+Math.random()*0.4;a.ki=0;}
 if(G.allies.every(a=>a.row<0))auto();renderTop();renderPanel();
}
// a sensible line-up: guards and sweepers in front, the long reach behind
function auto(){
 const live=G.allies.filter(a=>a.hp>0);for(const a of G.allies){a.row=-1;a.col=-1;}
 const back=live.filter(a=>a.range>=2),front=live.filter(a=>a.range<2).sort((a,b)=>(b.guard+b.sweep)-(a.guard+a.sweep));
 const put=(a,row)=>{for(const c of [1,0,2]){if(!G.allies.some(x=>x.row===row&&x.col===c)){a.row=row;a.col=c;return true;}}return false;};
 for(const a of front)if(!put(a,0))put(a,1);for(const a of back)if(!put(a,1))put(a,0);
}
function renderTop(){el.top.innerHTML=header('5 合戦')+`<div class="fn"><span>${G.place.name}　${G.wave}/${WAVES}戦目${G.wave===WAVES?'<em>強敵</em>':''}</span></div>`;}
function renderPanel(){
 if(G.state==='setup'){
  el.panel.innerHTML=`<p class="hint">侍をえらんで、下の陣のマスをタップ（前列は前、後列は後ろ）。</p><div class="chips">${G.allies.map((a,i)=>`<button class="chip ${G.sel===i?'on':''} ${a.hp<=0?'dead':''}" data-u="${i}" ${a.hp<=0?'disabled':''}><b>${a.name}</b><small>${R.form(a.form).name}・${roleOf(a).label}</small><small>${a.row<0?'待機':a.row===0?'前列':'後列'}　体力${a.hp}</small></button>`).join('')}</div>
   <div class="row"><button class="btn" data-auto>おまかせで並べる</button><button class="btn primary" data-go ${G.allies.some(a=>a.row>=0&&a.hp>0)?'':'disabled'}>合戦はじめ</button></div>`;
  for(const b of el.panel.querySelectorAll('[data-u]'))b.onclick=()=>{S.tick();G.sel=G.sel===+b.dataset.u?null:+b.dataset.u;renderPanel();};
  el.panel.querySelector('[data-auto]').onclick=()=>{S.tick();auto();renderPanel();};
  el.panel.querySelector('[data-go]').onclick=()=>{S.unlock();G.state='battle';G.sel=null;G.banner={text:'合戦はじめ！',age:0};S.phrase(2);renderPanel();};
 }else if(G.state==='battle'){
  el.panel.innerHTML=`<p class="hint">自動で戦っている。必殺技はひとりでに出る。</p><div class="row"><button class="btn" data-sp>${G.speed===1?'倍速にする':'ふつうの速さ'}</button></div>`;
  el.panel.querySelector('[data-sp]').onclick=()=>{G.speed=G.speed===1?2:1;renderPanel();};
 }
}
cv.addEventListener('pointerdown',e=>{
 if(G.state!=='setup')return;const r=cv.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
 for(const row of [0,1])for(const col of [0,1,2]){const p=slotXY('ally',row,col);if(Math.hypot(x-p.x,y-p.y)<R0()*1.3){
  const here=G.allies.find(a=>a.row===row&&a.col===col);
  if(G.sel!=null){const a=G.allies[G.sel];if(here&&here!==a){here.row=a.row;here.col=a.col;}a.row=row;a.col=col;G.sel=null;}
  else if(here){here.row=-1;here.col=-1;}
  S.tick();renderPanel();return;}}
});
function endWave(){
 const won=sideDown(G.foes)&&!sideDown(G.allies.filter(a=>a.row>=0));
 G.state='after';
 setTimeout(()=>{
  if(won&&G.wave<WAVES){G.wave++;G.banner={text:'勝った！ 次の戦へ',age:0};S.phrase(4);setTimeout(setup,900);return;}
  el.over.hidden=false;el.over.innerHTML=`<div class="sheet"><p class="tag">5 合戦</p><h1>${won?'合戦に勝った！':'負けた……'}</h1>
   <p class="howto">${G.place.name}　${won?WAVES:G.wave-1}/${WAVES}戦　残った侍 ${G.allies.filter(a=>a.hp>0).length}人</p>
   <div class="places"><button class="btn primary" data-again>もう一度</button><a class="btn" href="./">ほかの試作へ</a><a class="btn" href="../">ゲームへ戻る</a></div><p class="note">気に入ったか、直してほしいところを教えてください。</p></div>`;
  el.over.querySelector('[data-again]').onclick=menu;G.state=won?'clear':'lost';
 },700);
}
let last=performance.now();
function frame(t){
 const dt=Math.min(0.05,(t-last)/1000);last=t;fx.update(dt);
 for(const [u,v] of G.flash){const n=v-dt;n>0?G.flash.set(u,n):G.flash.delete(u);}
 if(G.banner){G.banner.age+=dt;if(G.banner.age>1.4)G.banner=null;}
 if(G.state==='battle'){
  const A=G.allies.filter(a=>a.row>=0);
  for(const b of battleStep(A,G.foes,dt*G.speed)){const fp=pos(b.from),tp=pos(b.to);
   fx.line(fp.x,fp.y,tp.x,tp.y,b.from.kind==='foe'?'255,120,90':b.waza?'143,211,255':'255,255,255');fx.num(String(b.dmg),tp.x,tp.y-R0(),b.from.kind==='foe'?'#ff9a8a':b.waza?'#bfe6ff':'#fff');
   G.flash.set(b.to,0.3);if(b.waza)G.banner={text:`『${b.waza}』`,age:0};if(b.from.kind!=='foe')S.clang(b.waza?1.2:0.7);}
  if(sideDown(G.foes)||sideDown(A))endWave();
 }
 draw(t/1000);requestAnimationFrame(frame);
}
const pos=u=>slotXY(u.kind==='foe'?'foe':'ally',u.row,u.col);
function draw(time){
 const W=cv.W,H=cv.H;ctx.clearRect(0,0,W,H);background(ctx,W,H,G.place.id,0.4);
 if(G.state==='menu'||G.state==='loading')return;
 ctx.strokeStyle='rgba(239,230,210,.25)';ctx.setLineDash([8,8]);ctx.beginPath();ctx.moveTo(16,H*0.5);ctx.lineTo(W-16,H*0.5);ctx.stroke();ctx.setLineDash([]);
 ctx.fillStyle='rgba(239,230,210,.6)';ctx.font='12px sans-serif';ctx.textAlign='left';ctx.fillText('敵',12,18);ctx.fillText('前列',12,H*0.62-R0()-8);ctx.fillText('後列',12,H*0.82-R0()-8);
 if(G.state==='setup')for(const row of [0,1])for(const col of [0,1,2]){const p=slotXY('ally',row,col);ctx.strokeStyle=G.sel!=null?'rgba(255,213,106,.8)':'rgba(239,230,210,.3)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,R0()*1.15,0,Math.PI*2);ctx.stroke();}
 for(const f of G.foes){const p=pos(f);drawUnit(ctx,f,p.x,p.y,R0()*(f.boss?1.25:1),{flash:G.flash.get(f)||0});}
 G.allies.forEach((a,i)=>{if(a.row<0)return;const p=pos(a);drawUnit(ctx,a,p.x,p.y,R0(),{flash:G.flash.get(a)||0,sel:G.sel===i});});
 fx.draw(ctx);
 if(G.banner){ctx.save();ctx.globalAlpha=Math.min(1,2-G.banner.age*1.4);ctx.font='800 28px "Hiragino Mincho ProN",serif';ctx.textAlign='center';ctx.lineWidth=5;ctx.strokeStyle='rgba(0,0,0,.7)';ctx.strokeText(G.banner.text,W/2,H*0.5+10);ctx.fillStyle='#ffe08a';ctx.fillText(G.banner.text,W/2,H*0.5+10);ctx.restore();}
}
el.over.hidden=false;el.over.innerHTML='<div class="sheet"><p class="tag">出陣の試作</p><h1>読みこみ中…</h1></div>';
loadArt('../assets/').finally(()=>{menu();requestAnimationFrame(frame);});
G.auto=()=>{auto();renderPanel();};
