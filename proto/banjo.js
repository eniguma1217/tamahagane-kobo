// 盤上の立ち合い（#38、オーナー：「ターンごとに動く」盤の上の戦い → 稽古と、弟子の戦いの両方で）。5×5のマス目で、弟子に指示を出して1対1。
// 相手は次に攻めるマスを赤く予告する。毎ターン「動く（1〜2マス）→ 斬る・構える・必殺技」。会心か必殺技で相手が崩れ、予告の攻撃が止まる。
// 刀の形で届く範囲が変わる。数字は試作の仮のもの。
import {$,R,V,S,clamp,sharpCanvas,wazaOf,wazaHits,artImage} from './kit.js';

const N=5;
const key=(x,y)=>x+','+y,inB=(x,y)=>x>=0&&y>=0&&x<N&&y<N;
// the cells a form reaches from (x,y)
export function reach(form,x,y){
 const out=[],add=(dx,dy)=>{if(inB(x+dx,y+dy))out.push([x+dx,y+dy]);};
 const adj4=()=>{add(1,0);add(-1,0);add(0,1);add(0,-1);},adj8=()=>{for(const dx of [-1,0,1])for(const dy of [-1,0,1])if(dx||dy)add(dx,dy);};
 if(form==='yari'){for(const d of [1,2]){add(d,0);add(-d,0);add(0,d);add(0,-d);}}
 else if(form==='naginata'){adj8();for(const d of [2]){add(d,0);add(-d,0);add(0,d);add(0,-d);}}
 else if(form==='tanto'||form==='chokuto')adj4();
 else adj8();
 return out;
}
export const FORM_NOTE={yari:'まっすぐ2マス先まで届く',naginata:'まわり＋まっすぐ2マス',tanto:'上下左右・2回斬る',chokuto:'上下左右・構えが固い',odachi:'まわり8マス・重い一撃',wakizashi:'まわり8マス・よく動ける',katana:'まわり8マス',tachi:'まわり8マス',ken:'まわり8マス'};
// the foe's moves: the cells they will strike, from where they stand toward the pupil
const sign=v=>v>0?1:v<0?-1:0;
function aim(e,p){const dx=p.x-e.x,dy=p.y-e.y;return Math.abs(dx)>=Math.abs(dy)?{dx:sign(dx),dy:0}:{dx:0,dy:sign(dy)};}
const MOVES={
 kesa:{name:'斬り下ろし',cells:(e,d)=>[[e.x+d.dx,e.y+d.dy],[e.x+d.dx+d.dy,e.y+d.dy+d.dx],[e.x+d.dx-d.dy,e.y+d.dy-d.dx]]},
 tsuki:{name:'突き',cells:(e,d)=>[1,2,3].map(k=>[e.x+d.dx*k,e.y+d.dy*k])},
 nagi:{name:'なぎ払い',cells:e=>[-1,0,1].flatMap(dx=>[-1,0,1].map(dy=>[e.x+dx,e.y+dy])).filter(([x,y])=>x!==e.x||y!==e.y),mult:0.8},
 fumi:{name:'踏みこみ',step:true,cells:(e,d)=>{const n={x:e.x+d.dx,y:e.y+d.dy};return [[n.x+1,n.y],[n.x-1,n.y],[n.x,n.y+1],[n.x,n.y-1]].filter(([x,y])=>x!==e.x||y!==e.y);},mult:1.2}
};

// fighters: {name, face, form, power, hp, maxHp, move, guard, ki, waza, img}
export function startBanjo({me,foe,title,moves=['kesa','tsuki'],rounds=0,onEnd}){
 const over=$('#over');over.hidden=false;
 over.innerHTML=`<div class="sheet banjo"><p class="tag">${title}</p>
  <div class="bj-top"><span class="bj-n">${foe.face||''} ${foe.name}</span><i class="hp"><b class="bj-fhp"></b></i></div>
  <canvas class="bj-cv"></canvas>
  <div class="bj-top"><span class="bj-n">${me.face||''} ${me.name}</span><i class="hp"><b class="bj-mhp"></b></i><span class="bj-ki"></span></div>
  <p class="bj-hint"></p><div class="bj-act"></div></div>`;
 const cv=over.querySelector('.bj-cv'),ctx=sharpCanvas(cv),hint=over.querySelector('.bj-hint'),act=over.querySelector('.bj-act');
 const B={phase:'move',round:1,me:{...me,x:2,y:3,ki:me.ki||0},foe:{...foe,x:2,y:1},tele:null,fx:[],stats:{dealt:0,taken:0,guards:0,stagger:0},done:false,moved:false,guard:false};
 window.__banjo=B;
 const cell=()=>Math.min(cv.W,cv.H)/N,org=()=>({x:(cv.W-cell()*N)/2,y:(cv.H-cell()*N)/2});
 const at=(x,y)=>{const c=cell(),o=org();return {x:o.x+(x+0.5)*c,y:o.y+(y+0.5)*c};};
 const num=(text,x,y,color='#fff')=>B.fx.push({text,x,y,color,age:0});
 const teleSet=()=>new Set((B.tele?.cells||[]).map(([x,y])=>key(x,y)));
 const moveCells=()=>{const out=[];for(let x=0;x<N;x++)for(let y=0;y<N;y++){const d=Math.abs(x-B.me.x)+Math.abs(y-B.me.y);if(d<=B.me.move&&!(x===B.foe.x&&y===B.foe.y))out.push([x,y]);}return out;};
 const inReach=()=>reach(B.me.form,B.me.x,B.me.y).some(([x,y])=>x===B.foe.x&&y===B.foe.y);
 const near2=()=>Math.max(Math.abs(B.me.x-B.foe.x),Math.abs(B.me.y-B.foe.y))<=2;
 // the foe steps toward the pupil (unless next to them) and shows its next move
 function foePlan(){
  const e=B.foe,p=B.me,dist=Math.abs(e.x-p.x)+Math.abs(e.y-p.y);
  if(dist>2){const d=aim(e,p),nx=e.x+d.dx,ny=e.y+d.dy;if(inB(nx,ny)&&!(nx===p.x&&ny===p.y)){e.x=nx;e.y=ny;}}
  const d=aim(e,p),opts=moves.map(m=>({m,c:MOVES[m].cells(e,d).filter(([x,y])=>inB(x,y))}));
  const hit=opts.filter(o=>o.c.some(([x,y])=>x===p.x&&y===p.y));const pick=(hit.length?hit:opts)[Math.floor(Math.random()*(hit.length?hit:opts).length)];
  B.tele={m:pick.m,name:MOVES[pick.m].name,cells:pick.c,d};
 }
 function render(){
  over.querySelector('.bj-fhp').style.width=`${Math.round(100*Math.max(0,B.foe.hp)/B.foe.maxHp)}%`;over.querySelector('.bj-mhp').style.width=`${Math.round(100*Math.max(0,B.me.hp)/B.me.maxHp)}%`;
  over.querySelector('.bj-ki').textContent=`気 ${'▰'.repeat(B.me.ki)}${'▱'.repeat(3-B.me.ki)}`;
  if(B.done)return;
  if(B.phase==='move'){hint.innerHTML=`<b>${B.round}手目</b>　相手は<b class="bad">「${B.tele.name}」</b>で赤いマスを狙っている。<b>青いマス</b>をタップして動く。`;
   act.innerHTML=`<button class="btn small" data-stay>動かない</button>`;act.querySelector('[data-stay]').onclick=()=>{S.tick();B.phase='act';render();};}
  else{const r=inReach();hint.innerHTML=r?'届く！ 斬るか、構えるか。':'相手に届かない。構えるか、待つか。';
   act.innerHTML=`<button class="btn small primary" data-cut ${r?'':'disabled'}>斬る</button><button class="btn small" data-guard>構える</button><button class="btn small ${B.me.ki>=3&&near2()?'primary':''}" data-waza ${B.me.ki>=3&&near2()?'':'disabled'}>必殺『${B.me.waza.name}』</button>`;
   act.querySelector('[data-cut]').onclick=()=>doAct('cut');act.querySelector('[data-guard]').onclick=()=>doAct('guard');act.querySelector('[data-waza]').onclick=()=>doAct('waza');}
 }
 function hitFoe(dmg,label,color,apply=true){if(apply){B.foe.hp=Math.max(0,B.foe.hp-dmg);B.stats.dealt+=dmg;}const p=at(B.foe.x,B.foe.y);num(String(dmg),p.x,p.y-cell()*0.4,color);if(label)num(label,p.x,p.y-cell()*0.8,'#ffe08a');S.clang(1);B.foe.flash=0.3;}
 function doAct(kind){
  S.unlock();let stagger=false;B.guard=false;
  if(kind==='cut'&&inReach()){
   const hits=B.me.form==='tanto'?2:1,mult=(B.me.form==='odachi'?1.25:1)*(hits===2?0.6:1);
   for(let k=0;k<hits;k++){const crit=Math.random()<0.18,dmg=Math.round(B.me.power*mult*(0.9+0.2*Math.random())*(crit?1.5:1));hitFoe(dmg,crit?'会心！':null,crit?'#ffe08a':'#fff');if(crit)stagger=true;}
   B.me.ki=Math.min(3,B.me.ki+1);
  }else if(kind==='waza'&&B.me.ki>=3&&near2()){
   const hs=wazaHits(B.me.waza,B.me.power,{hp:B.foe.hp,maxHp:B.foe.maxHp},Math.random),sum=hs.reduce((a,b)=>a+b,0);
   B.foe.hp=Math.max(0,B.foe.hp-sum);B.stats.dealt+=sum;B.me.ki=0;stagger=true;S.phrase(4);
   hs.forEach((h,k)=>setTimeout(()=>hitFoe(h,k===0?`『${B.me.waza.name}』`:null,'#bfe6ff',false),k*160));
  }else if(kind==='guard'){B.guard=true;}
  if(stagger){B.stats.stagger++;num('崩れた！',at(B.foe.x,B.foe.y).x,at(B.foe.x,B.foe.y).y+cell()*0.6,'#8fd3ff');}
  B.phase='foe';render();setTimeout(()=>resolve(stagger),kind==='waza'?700:350);
 }
 function resolve(stagger){
  if(B.foe.hp<=0)return end(true);
  if(!stagger&&B.tele){const m=MOVES[B.tele.m];if(m.step){const nx=B.foe.x+B.tele.d.dx,ny=B.foe.y+B.tele.d.dy;if(inB(nx,ny)&&!(nx===B.me.x&&ny===B.me.y)){B.foe.x=nx;B.foe.y=ny;}}
   if(teleSet().has(key(B.me.x,B.me.y))){let dmg=Math.round(B.foe.power*(m.mult||1)*(0.9+0.2*Math.random()));
    if(B.guard){dmg=Math.round(dmg*(B.me.form==='chokuto'?0.25:0.5));B.stats.guards++;B.me.ki=Math.min(3,B.me.ki+1);const c=Math.round(B.me.power*0.4);hitFoe(c,'返し',"#d9f0ff");}
    B.me.hp=Math.max(0,B.me.hp-dmg);B.stats.taken+=dmg;const p=at(B.me.x,B.me.y);num(`-${dmg}`,p.x,p.y-cell()*0.4,'#ff9a8a');B.me.flash=0.3;S.thud();}
   else{const p=at(B.me.x,B.me.y);num('かわした',p.x,p.y-cell()*0.4,'#b9f0b0');}}
  if(B.foe.hp<=0)return end(true);if(B.me.hp<=0)return end(false);
  if(rounds&&B.round>=rounds)return end(B.stats.dealt>B.stats.taken,true);
  B.round++;foePlan();B.phase='move';render();
 }
 function end(win,timeUp=false){B.done=true;B.win=win;act.innerHTML='';hint.innerHTML=win?`<b class="ok">${timeUp?'稽古おわり':'勝った！'}</b>`:`<b class="bad">${timeUp?'稽古おわり':'負けた……'}</b>`;
  S.phrase(win?5:1);setTimeout(()=>onEnd({win,timeUp,rounds:B.round,...B.stats,hpLeft:B.me.hp,ki:B.me.ki}),900);}
 cv.addEventListener('pointerdown',e=>{
  if(B.done||B.phase!=='move')return;const r=cv.getBoundingClientRect(),x=Math.floor((e.clientX-r.left-org().x)/cell()),y=Math.floor((e.clientY-r.top-org().y)/cell());
  if(moveCells().some(([a,b])=>a===x&&b===y)){S.tick();B.me.x=x;B.me.y=y;B.phase='act';render();}
 });
 let last=performance.now();
 function frame(t){if(!over.contains(cv))return;const dt=Math.min(0.05,(t-last)/1000);last=t;
  for(const f of B.fx)f.age+=dt;B.fx=B.fx.filter(f=>f.age<0.9);B.me.flash=Math.max(0,(B.me.flash||0)-dt);B.foe.flash=Math.max(0,(B.foe.flash||0)-dt);
  draw(t/1000);requestAnimationFrame(frame);}
 function draw(time){
  const W=cv.W,H=cv.H,c=cell(),o=org();if(!W)return;ctx.clearRect(0,0,W,H);
  for(let x=0;x<N;x++)for(let y=0;y<N;y++){ctx.fillStyle=(x+y)%2?'#5a4330':'#644b36';ctx.fillRect(o.x+x*c,o.y+y*c,c,c);ctx.strokeStyle='rgba(0,0,0,.35)';ctx.strokeRect(o.x+x*c,o.y+y*c,c,c);}
  const tele=teleSet();
  for(const k of tele){const [x,y]=k.split(',').map(Number);ctx.fillStyle=`rgba(220,50,30,${0.35+0.2*Math.sin(time*6)})`;ctx.fillRect(o.x+x*c+2,o.y+y*c+2,c-4,c-4);}
  // a 踏みこみ: the cell the foe will step into, dashed
  if(B.tele&&MOVES[B.tele.m].step){const x=B.foe.x+B.tele.d.dx,y=B.foe.y+B.tele.d.dy;if(inB(x,y)){ctx.save();ctx.setLineDash([6,5]);ctx.strokeStyle='#ff8a6a';ctx.lineWidth=3;ctx.strokeRect(o.x+x*c+6,o.y+y*c+6,c-12,c-12);ctx.restore();}}
  if(B.phase==='move'&&!B.done)for(const [x,y] of moveCells()){ctx.strokeStyle='rgba(120,190,255,.95)';ctx.lineWidth=3;ctx.strokeRect(o.x+x*c+5,o.y+y*c+5,c-10,c-10);}
  if(B.phase==='act'&&!B.done)for(const [x,y] of reach(B.me.form,B.me.x,B.me.y)){ctx.fillStyle='rgba(255,213,106,.18)';ctx.fillRect(o.x+x*c+4,o.y+y*c+4,c-8,c-8);}
  const tok=(f,isFoe)=>{const p=at(f.x,f.y),r=c*0.38;ctx.save();const img=isFoe&&f.key?artImage('foe-'+f.key):null;
   if(img)ctx.drawImage(img,p.x-r*1.25,p.y-r*1.25,r*2.5,r*2.5);else{ctx.fillStyle=isFoe?'#3a1a14':'#2e2018';ctx.strokeStyle=isFoe?'#ff8a6a':'#ffd56a';ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.font=`${r*1.1}px serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(f.face||'',p.x,p.y+1);}
   if(f.flash>0){ctx.globalCompositeOperation='lighter';ctx.fillStyle=`rgba(255,240,200,${f.flash*2})`;ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();}
   ctx.restore();};
  tok(B.foe,true);tok(B.me,false);
  for(const f of B.fx){ctx.save();ctx.globalAlpha=1-f.age/0.9;ctx.font='800 20px "Hiragino Mincho ProN",serif';ctx.textAlign='center';ctx.lineWidth=4;ctx.strokeStyle='rgba(0,0,0,.7)';const y=f.y-f.age*30;ctx.strokeText(f.text,f.x,y);ctx.fillStyle=f.color;ctx.fillText(f.text,f.x,y);ctx.restore();}
 }
 foePlan();render();requestAnimationFrame(frame);
 // for the QA: one sensible turn (out of the red if it can, onto a cell that reaches; strike, or guard)
 B.bot=()=>{if(B.done)return;if(B.phase==='move'){const red=teleSet(),opts=moveCells().map(([x,y])=>({x,y,safe:!red.has(key(x,y)),hit:reach(B.me.form,x,y).some(([a,b])=>a===B.foe.x&&b===B.foe.y)}));
  const best=opts.find(o=>o.safe&&o.hit)||opts.find(o=>o.safe)||opts.find(o=>o.hit)||opts[0];B.me.x=best.x;B.me.y=best.y;B.phase='act';render();return 'move';}
  if(B.phase==='act'){if(B.me.ki>=3&&near2())doAct('waza');else if(inReach())doAct('cut');else doAct('guard');return 'act';}};
 return B;
}
// a pupil with a sword, on the board
export function boardFighter(p,s,lv){const u={name:p.name,face:p.face,form:s.form,power:V.strikePower(s)*p.atk*(p.like.includes(s.form)?1.2:1)*0.6,hp:Math.round((60+30*V.maxDurability(s))*p.vit),waza:wazaOf(s)};
 u.maxHp=u.hp;u.move=1+((p.spd>=1.1||s.form==='tanto'||s.form==='wakizashi')?1:0);return u;}
