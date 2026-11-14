// 盤上の立ち合い（#38 → #40 で作り直し。オーナー「方向性はいいけどおもしろくない」：単調・簡単すぎる → 手札・背後と押し出し・手ざわり）。
// 5×5のマス目で、弟子に指示を出して1対1。相手は次に攻めるマスを赤く予告する。毎ターン、刀から配られる3枚の技から1枚えらび、動き先をタップ。
// 駒には向きがあり、横から斬ると強く、背後からは会心。相手が崩れて攻撃が止まるのは足払いと必殺技だけ。押して盤の外へ出せば一本（強敵は大きな傷）。相手も押してくる。
// その作品のルールは使っていない。数字は試作の仮のもの。
import {$,R,V,S,clamp,sharpCanvas,wazaOf,wazaHits,artImage} from './kit.js';

const N=5,inB=(x,y)=>x>=0&&y>=0&&x<N&&y<N,key=(x,y)=>x+','+y;
const DIR={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
const sgn=v=>v>0?1:v<0?-1:0;
const dirTo=(ax,ay,bx,by)=>{const dx=bx-ax,dy=by-ay;return Math.abs(dx)>=Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up');};
// where an attacker stands, seen from the one it strikes: front, side or back
function sideOf(att,tgt){const [fx,fy]=DIR[tgt.dir],vx=sgn(att.x-tgt.x),vy=sgn(att.y-tgt.y),d=fx*vx+fy*vy;return d>0?'front':d<0?'back':'side';}

// ---- 技のカード. move: where the pupil may go; hit: the cells struck from there, facing the foe
export const CARDS={
 kiru:{name:'斬る',text:'1マス動いて、まわりを斬る',move:'step1',hit:'adj8',mult:1},
 fumikomi:{name:'踏みこみ斬り',text:'まっすぐ2マスまで出て、前3マスを強く斬る',move:'line2',hit:'front3',mult:1.3},
 mawari:{name:'回りこみ斬り',text:'相手のとなりへ回りこんで斬る（背後なら会心1.5倍）',move:'around',hit:'adj8',mult:0.9},
 tsuki:{name:'突き',text:'まっすぐ2マス先まで突き、1マス押す',move:'step1',hit:'line2',mult:1,push:1},
 taiatari:{name:'体当たり',text:'となりの相手を2マス押す（端なら場外）',move:'step1',hit:'adj4',mult:0.3,push:2},
 ashi:{name:'足払い',text:'となりの相手を崩す（攻撃が止まり、向きが乱れる）',move:'stay',hit:'adj8',mult:0.35,stagger:true,spin:true},
 kamae:{name:'下がって構える',text:'1マス下がり、前からの攻撃を半分にして返す',move:'back1',guard:true},
 nidan:{name:'二段斬り',text:'1マス動いて、となりを2回斬る',move:'step1',hit:'adj8',mult:0.65,hits:2},
 nagi:{name:'なぎ払い',text:'まわり8マスを斬り、1マス押す',move:'stay',hit:'adj8',mult:0.9,push:1}
};
const DECK={
 katana:['kiru','kiru','kiru','fumikomi','fumikomi','mawari','taiatari','kamae','ashi'],
 tachi:['fumikomi','fumikomi','fumikomi','kiru','kiru','taiatari','mawari','kamae'],
 wakizashi:['nidan','nidan','kiru','kiru','mawari','mawari','kamae','ashi'],
 tanto:['nidan','nidan','nidan','mawari','mawari','kiru','kiru','kamae','ashi'],
 yari:['tsuki','tsuki','tsuki','tsuki','kamae','kamae','taiatari','kiru','fumikomi'],
 naginata:['nagi','nagi','tsuki','tsuki','kiru','kiru','taiatari','kamae'],
 odachi:['nagi','nagi','nagi','kiru','kiru','taiatari','taiatari','kamae'],
 chokuto:['kamae','kamae','kamae','kiru','kiru','kiru','taiatari','taiatari'],
 ken:['kiru','kiru','kiru','fumikomi','fumikomi','mawari','mawari','taiatari']
};
const TRAIT_CARD={'攻め':'fumikomi','素早さ':'mawari','守り':'kamae'};
export const FORM_NOTE={yari:'突きが多い',naginata:'なぎ払いと突き',tanto:'二段斬りと回りこみ',wakizashi:'二段斬りと回りこみ',chokuto:'構えが多い',odachi:'なぎ払いと体当たり',tachi:'踏みこみ斬りが多い',katana:'斬る・踏みこみ・回りこみ',ken:'回りこみ斬り'};
// ---- the foe's moves (shown in red one turn ahead)
const FOE_MOVES={
 kesa:{name:'斬り下ろし',cells:(e,f)=>front3(e.x,e.y,f),mult:1},
 tsuki:{name:'突き',cells:(e,f)=>line(e.x,e.y,f,3),mult:1,push:1},
 nagi:{name:'なぎ払い',cells:e=>adj(e.x,e.y,8),mult:0.85},
 fumi:{name:'踏みこみ',step:1,cells:(e,f)=>{const [dx,dy]=DIR[f];return adj(e.x+dx,e.y+dy,4).filter(([x,y])=>x!==e.x||y!==e.y);},mult:1.15,push:1},
 atari:{name:'体当たり',step:1,cells:(e,f)=>{const [dx,dy]=DIR[f];return [[e.x+2*dx,e.y+2*dy]].filter(([x,y])=>inB(x,y));},mult:0.5,push:2}
};
function adj(x,y,n){const o=[];for(const dx of [-1,0,1])for(const dy of [-1,0,1]){if(!dx&&!dy)continue;if(n===4&&dx&&dy)continue;if(inB(x+dx,y+dy))o.push([x+dx,y+dy]);}return o;}
function front3(x,y,f){const [dx,dy]=DIR[f];return [[x+dx,y+dy],[x+dx+dy,y+dy+dx],[x+dx-dy,y+dy-dx]].filter(([a,b])=>inB(a,b));}
function line(x,y,f,n){const [dx,dy]=DIR[f],o=[];for(let k=1;k<=n;k++)if(inB(x+dx*k,y+dy*k))o.push([x+dx*k,y+dy*k]);return o;}
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};

// a pupil with a sword, on the board: their deck comes from the sword's form and the pupil's strength
export function boardFighter(p,s){
 const u={name:p.name,face:p.face,form:s.form,power:V.strikePower(s)*p.atk*(p.like.includes(s.form)?1.2:1)*0.6,hp:Math.round((60+30*V.maxDurability(s))*p.vit),waza:wazaOf(s),
  deck:[...(DECK[s.form]||DECK.katana),...(TRAIT_CARD[p.trait]?[TRAIT_CARD[p.trait]]:[])]};
 u.maxHp=u.hp;return u;
}

export function startBanjo({me,foe,title,moves=['kesa','tsuki','fumi'],rounds=0,boss=false,onEnd}){
 const over=$('#over');over.hidden=false;
 over.innerHTML=`<div class="sheet banjo"><p class="tag">${title}</p>
  <div class="bj-top"><span class="bj-n">${foe.face||''} ${foe.name}</span><i class="hp"><b class="bj-fhp"></b></i></div>
  <div class="bj-board"><canvas class="bj-cv"></canvas><div class="bj-cut" hidden></div></div>
  <div class="bj-top"><span class="bj-n">${me.face||''} ${me.name}</span><i class="hp"><b class="bj-mhp"></b></i><span class="bj-ki"></span></div>
  <p class="bj-hint"></p><div class="bj-hand"></div></div>`;
 const cv=over.querySelector('.bj-cv'),ctx=sharpCanvas(cv),hint=over.querySelector('.bj-hint'),hand=over.querySelector('.bj-hand'),cut=over.querySelector('.bj-cut');
 const B={phase:'pick',round:1,me:{...me,x:2,y:3,dir:'up',ki:0},foe:{...foe,x:2,y:1,dir:'down'},tele:null,sel:null,hand:[],pile:shuffle([...me.deck]),fx:[],stop:0,shake:0,
  stats:{dealt:0,taken:0,guards:0,backs:0,pushes:0},done:false,guard:false};
 window.__banjo=B;
 for(const f of [B.me,B.foe]){f.dx=f.x;f.dy=f.y;}
 const cell=()=>Math.min(cv.W,cv.H)/N,org=()=>({x:(cv.W-cell()*N)/2,y:(cv.H-cell()*N)/2});
 const px=(x,y)=>{const c=cell(),o=org();return {x:o.x+(x+0.5)*c,y:o.y+(y+0.5)*c};};
 const num=(text,x,y,color='#fff',size=20)=>{const p=px(x,y);B.fx.push({type:'num',text,x:p.x,y:p.y-cell()*0.45,color,size,age:0,life:1});};
 const slash=(x,y,color='255,255,255')=>{const p=px(x,y);B.fx.push({type:'slash',x:p.x,y:p.y,r:cell()*0.5,color,age:0,life:0.3,a:Math.random()*Math.PI});};
 const draw3=()=>{while(B.hand.length<3){if(!B.pile.length)B.pile=shuffle([...me.deck]);B.hand.push(B.pile.pop());}};
 const occupied=(x,y,who)=>{const o=who===B.me?B.foe:B.me;return o.x===x&&o.y===y;};
 const teleSet=()=>new Set((B.tele?.cells||[]).map(([x,y])=>key(x,y)));
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 // where a card lets the pupil go
 function dests(c){
  const m=B.me,e=B.foe,ok=(x,y)=>inB(x,y)&&!occupied(x,y,m),out=[];
  if(c.move==='stay')out.push([m.x,m.y]);
  if(c.move==='step1'){out.push([m.x,m.y]);for(const [dx,dy] of Object.values(DIR))if(ok(m.x+dx,m.y+dy))out.push([m.x+dx,m.y+dy]);}
  if(c.move==='line2'){for(const [dx,dy] of Object.values(DIR))for(let k=1;k<=2;k++){if(!ok(m.x+dx*k,m.y+dy*k))break;out.push([m.x+dx*k,m.y+dy*k]);}if(!out.length)out.push([m.x,m.y]);}
  if(c.move==='back1'){out.push([m.x,m.y]);const d=dirTo(e.x,e.y,m.x,m.y),[dx,dy]=DIR[d];if(ok(m.x+dx,m.y+dy))out.push([m.x+dx,m.y+dy]);}
  if(c.move==='around'){for(const [x,y] of adj(e.x,e.y,8))if(ok(x,y)&&Math.abs(x-m.x)+Math.abs(y-m.y)<=3)out.push([x,y]);if(!out.length)out.push([m.x,m.y]);}
  return out;
 }
 // the cells a card strikes from (x,y), facing the foe
 function hits(c,x,y){const f=dirTo(x,y,B.foe.x,B.foe.y);
  if(c.hit==='adj8')return adj(x,y,8);if(c.hit==='adj4')return adj(x,y,4);if(c.hit==='front3')return front3(x,y,f);if(c.hit==='line2')return line(x,y,f,2);
  if(c.hit==='near2'){const o=[];for(let a=0;a<N;a++)for(let b=0;b<N;b++)if(Math.max(Math.abs(a-x),Math.abs(b-y))<=2&&(a!==x||b!==y))o.push([a,b]);return o;}return [];}
 const cardOf=id=>id==='waza'?{name:`必殺『${B.me.waza.name}』`,text:'2マス以内の相手に必殺技（崩す）',move:'step1',hit:'near2',waza:true}:CARDS[id];
 // the foe steps in and chooses the move that covers the pupil and the cells they could run to (and pushes them toward the edge)
 function foePlan(){
  const e=B.foe,m=B.me,far=Math.abs(e.x-m.x)+Math.abs(e.y-m.y);
  if(far>2){const d=dirTo(e.x,e.y,m.x,m.y),[dx,dy]=DIR[d];if(inB(e.x+dx,e.y+dy)&&!occupied(e.x+dx,e.y+dy,e)){e.x+=dx;e.y+=dy;}}
  e.dir=dirTo(e.x,e.y,m.x,m.y);
  const run=adj(m.x,m.y,4).concat([[m.x,m.y]]),edge=m.x===0||m.y===0||m.x===N-1||m.y===N-1;let best=null;
  for(const id of moves){const M=FOE_MOVES[id],c=M.cells(e,e.dir).filter(([x,y])=>inB(x,y));if(!c.length)continue;const s=new Set(c.map(([x,y])=>key(x,y)));
   const score=(s.has(key(m.x,m.y))?3:0)+run.filter(([x,y])=>s.has(key(x,y))).length*0.7+(M.push&&edge&&s.has(key(m.x,m.y))?2:0)+Math.random()*1.2;
   if(!best||score>best.score)best={id,cells:c,score};}
  if(!best)best={id:'nagi',cells:FOE_MOVES.nagi.cells(e,e.dir)};
  B.tele={id:best.id,name:FOE_MOVES[best.id].name,cells:best.cells,dir:e.dir};
 }
 // a push: k cells away from the pusher; off the board is 場外
 function push(tgt,from,k){const d=dirTo(from.x,from.y,tgt.x,tgt.y),[dx,dy]=DIR[d];
  for(let i=0;i<k;i++){const nx=tgt.x+dx,ny=tgt.y+dy;if(!inB(nx,ny)){tgt.out={dx,dy};return true;}if(occupied(nx,ny,tgt))return false;tgt.x=nx;tgt.y=ny;}return false;}
 const ids=()=>[...B.hand,...(B.me.ki>=3?['waza']:[])];
 function render(){
  over.querySelector('.bj-fhp').style.width=`${Math.round(100*Math.max(0,B.foe.hp)/B.foe.maxHp)}%`;over.querySelector('.bj-mhp').style.width=`${Math.round(100*Math.max(0,B.me.hp)/B.me.maxHp)}%`;
  over.querySelector('.bj-ki').textContent=`気 ${'▰'.repeat(B.me.ki)}${'▱'.repeat(3-B.me.ki)}`;
  if(B.done){hand.innerHTML='';return;}
  if(B.phase==='busy'){hand.querySelectorAll('button').forEach(b=>b.disabled=true);return;}
  const sc=selCard();
  hint.innerHTML=`<b>${B.round}手目</b>　相手は<b class="bad">「${B.tele.name}」</b>（赤いマス）。${sc?`<b>${sc.c.name}</b>：${sc.c.text}。<b>青いマス</b>をタップ。`:'技の札をえらぶ。'}`;
  hand.innerHTML=ids().map((id,i)=>{const c=cardOf(id);return `<button class="bj-card ${B.sel===i?'on':''} ${id==='waza'?'waza':''}" data-card="${i}">${c.name}</button>`;}).join('');
  for(const b of hand.querySelectorAll('[data-card]'))b.onclick=()=>{S.tick();B.sel=B.sel===+b.dataset.card?null:+b.dataset.card;render();};
 }
 const selCard=()=>{if(B.sel==null)return null;const id=ids()[B.sel];return id?{id,c:cardOf(id)}:null;};
 // the pupil plays the chosen card to (x,y)
 async function play(x,y){
  const sc=selCard();if(!sc)return;const {id,c}=sc,m=B.me,e=B.foe;
  if(!dests(c).some(([a,b])=>a===x&&b===y))return;
  B.phase='busy';B.sel=null;render();S.tick();
  if(id==='waza')m.ki=0;else B.hand.splice(B.hand.indexOf(id),1);
  m.x=x;m.y=y;m.dir=dirTo(m.x,m.y,e.x,e.y);B.guard=!!c.guard;await wait(200);
  let stagger=false,out=false;
  if(c.hit&&hits(c,m.x,m.y).some(([a,b])=>a===e.x&&b===e.y)){
   const side=sideOf(m,e);
   if(c.waza){const hs=wazaHits(m.waza,m.power,{hp:e.hp,maxHp:e.maxHp},Math.random);cutIn(m.waza.name);await wait(550);
    for(const h of hs){e.hp=Math.max(0,e.hp-h);B.stats.dealt+=h;num(String(h),e.x,e.y,'#bfe6ff',24);slash(e.x,e.y,'143,211,255');S.clang(1.2);B.stop=0.08;B.shake=0.2;await wait(160);}
    stagger=true;}
   else{
    const n=c.hits||1;for(let k=0;k<n;k++){const back=side==='back',crit=back||Math.random()<(side==='side'?0.35:0.12),mult=(c.mult||1)*(side==='side'?1.25:1)*(crit?1.5:1);
     const dmg=Math.max(1,Math.round(m.power*mult*(0.9+0.2*Math.random())));e.hp=Math.max(0,e.hp-dmg);B.stats.dealt+=dmg;
     num(String(dmg),e.x,e.y,crit?'#ffe08a':'#fff',crit?26:20);if(k===0&&side!=='front')num(side==='back'?'背後！':'横から！',e.x,e.y-0.5,'#ffe08a',18);slash(e.x,e.y,crit?'255,224,138':'255,255,255');
     S.clang(crit?1.2:0.8);B.stop=crit?0.12:0.07;B.shake=crit?0.2:0.1;if(back)B.stats.backs++;await wait(170);}
    if(c.stagger)stagger=true;if(c.spin)e.dir=['up','right','down','left'][Math.floor(Math.random()*4)];
    m.ki=Math.min(3,m.ki+1);
    if(c.push&&e.hp>0){out=push(e,m,c.push);B.stats.pushes++;if(out){num('場外！',e.x,e.y,'#ffe08a',26);S.phrase(4);}}
   }
  }
  render();await wait(250);
  if(out){if(!boss)return end(true,'場外で一本！');const d=Math.round(e.maxHp*0.25);e.hp=Math.max(0,e.hp-d);B.stats.dealt+=d;e.out=null;num(String(d),e.x,e.y,'#ffe08a',26);stagger=true;}
  if(e.hp<=0)return end(true);
  if(stagger)num('崩れた！',e.x,e.y+0.6,'#8fd3ff',18);
  await foeTurn(stagger);
 }
 async function foeTurn(stagger){
  const m=B.me,e=B.foe,t=B.tele,M=FOE_MOVES[t.id];
  if(!stagger){
   if(M.step){const [dx,dy]=DIR[t.dir];if(inB(e.x+dx,e.y+dy)&&!occupied(e.x+dx,e.y+dy,e)){e.x+=dx;e.y+=dy;await wait(160);}}
   if(teleSet().has(key(m.x,m.y))){
    const side=sideOf(e,m),guarded=B.guard&&side==='front';let dmg=Math.round(e.power*(M.mult||1)*(0.9+0.2*Math.random()));
    if(guarded){dmg=Math.round(dmg*(m.form==='chokuto'?0.25:0.5));B.stats.guards++;m.ki=Math.min(3,m.ki+1);const c=Math.round(m.power*0.45);e.hp=Math.max(0,e.hp-c);B.stats.dealt+=c;num(`返し ${c}`,e.x,e.y,'#d9f0ff',18);}
    m.hp=Math.max(0,m.hp-dmg);B.stats.taken+=dmg;num(`-${dmg}`,m.x,m.y,'#ff9a8a',22);slash(m.x,m.y,'255,120,90');B.shake=0.25;B.stop=0.08;S.thud();
    if(M.push&&!guarded&&m.hp>0&&push(m,e,M.push)){num('場外！',m.x,m.y,'#ff9a8a',24);await wait(350);
     if(!boss)return end(false,'場外で一本とられた');const d=Math.round(m.maxHp*0.25);m.hp=Math.max(0,m.hp-d);B.stats.taken+=d;m.out=null;}
   }else num('かわした',m.x,m.y,'#b9f0b0',18);
  }
  await wait(300);
  if(e.hp<=0)return end(true);if(m.hp<=0)return end(false);
  if(rounds&&B.round>=rounds)return end(B.stats.dealt>=B.stats.taken*1.5,'稽古おわり');
  B.round++;draw3();foePlan();B.phase='pick';B.guard=false;render();
 }
 function cutIn(name){cut.hidden=false;cut.textContent=`『${name}』`;cut.classList.remove('go');void cut.offsetWidth;cut.classList.add('go');S.glint(3);setTimeout(()=>{cut.hidden=true;},900);}
 function end(win,why=''){B.done=true;B.win=win;B.phase='done';render();hint.innerHTML=win?`<b class="ok">${why||'勝った！'}</b>`:`<b class="bad">${why||'負けた……'}</b>`;
  S.phrase(win?5:1);setTimeout(()=>onEnd({win,why,rounds:B.round,...B.stats,hpLeft:B.me.hp}),1000);}
 cv.addEventListener('pointerdown',ev=>{
  if(B.done||B.phase!=='pick'||B.sel==null)return;const r=cv.getBoundingClientRect(),x=Math.floor((ev.clientX-r.left-org().x)/cell()),y=Math.floor((ev.clientY-r.top-org().y)/cell());
  play(x,y);
 });
 let last=performance.now();
 function frame(t){if(!over.contains(cv))return;const raw=Math.min(0.05,(t-last)/1000);let dt=raw;last=t;
  if(B.stop>0){B.stop-=raw;dt=0;}B.shake=Math.max(0,B.shake-raw);
  for(const f of [B.me,B.foe]){const k=Math.min(1,dt*14);f.dx+=(f.x+(f.out?f.out.dx*2:0)-f.dx)*k;f.dy+=(f.y+(f.out?f.out.dy*2:0)-f.dy)*k;}
  for(const f of B.fx)f.age+=dt;B.fx=B.fx.filter(f=>f.age<f.life);
  draw(t/1000);requestAnimationFrame(frame);}
 function draw(time){
  const W=cv.W,H=cv.H,c=cell(),o=org();if(!W)return;ctx.clearRect(0,0,W,H);ctx.save();
  if(B.shake>0)ctx.translate((Math.random()-0.5)*10*B.shake/0.25,(Math.random()-0.5)*8*B.shake/0.25);
  for(let x=0;x<N;x++)for(let y=0;y<N;y++){ctx.fillStyle=(x+y)%2?'#5a4330':'#644b36';ctx.fillRect(o.x+x*c,o.y+y*c,c,c);ctx.strokeStyle='rgba(0,0,0,.35)';ctx.strokeRect(o.x+x*c,o.y+y*c,c,c);}
  ctx.strokeStyle='rgba(200,60,40,.6)';ctx.lineWidth=3;ctx.strokeRect(o.x,o.y,c*N,c*N);
  if(!B.done)for(const k of teleSet()){const [x,y]=k.split(',').map(Number);ctx.fillStyle=`rgba(220,50,30,${0.33+0.18*Math.sin(time*6)})`;ctx.fillRect(o.x+x*c+2,o.y+y*c+2,c-4,c-4);}
  if(B.tele&&FOE_MOVES[B.tele.id].step&&!B.done){const [dx,dy]=DIR[B.tele.dir],x=B.foe.x+dx,y=B.foe.y+dy;if(inB(x,y)){ctx.save();ctx.setLineDash([6,5]);ctx.strokeStyle='#ff8a6a';ctx.lineWidth=3;ctx.strokeRect(o.x+x*c+6,o.y+y*c+6,c-12,c-12);ctx.restore();}}
  const sc=B.phase==='pick'?selCard():null;
  if(sc){for(const [x,y] of dests(sc.c)){ctx.strokeStyle='rgba(120,190,255,.95)';ctx.lineWidth=3;ctx.strokeRect(o.x+x*c+5,o.y+y*c+5,c-10,c-10);
    if(sc.c.hit&&hits(sc.c,x,y).some(([a,b])=>a===B.foe.x&&b===B.foe.y)){ctx.fillStyle='rgba(255,213,106,.25)';ctx.fillRect(o.x+x*c+5,o.y+y*c+5,c-10,c-10);
     const s=sideOf({x,y},B.foe);if(s!=='front'){ctx.fillStyle='#ffe08a';ctx.font='700 12px sans-serif';ctx.textAlign='center';ctx.fillText(s==='back'?'背後':'横',o.x+(x+0.5)*c,o.y+y*c+16);}}}}
  const tok=(f,isFoe)=>{const p={x:o.x+(f.dx+0.5)*c,y:o.y+(f.dy+0.5)*c},r=c*0.38,img=isFoe&&f.key?artImage('foe-'+f.key):null;ctx.save();
   if(img)ctx.drawImage(img,p.x-r*1.25,p.y-r*1.25,r*2.5,r*2.5);else{ctx.fillStyle=isFoe?'#3a1a14':'#2e2018';ctx.strokeStyle=isFoe?'#ff8a6a':'#ffd56a';ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.font=`${r*1.1}px serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(f.face||'',p.x,p.y+1);}
   const [fx,fy]=DIR[f.dir];ctx.fillStyle=isFoe?'#ff8a6a':'#ffd56a';ctx.beginPath();const ax=p.x+fx*r*1.15,ay=p.y+fy*r*1.15;ctx.moveTo(ax+fx*8,ay+fy*8);ctx.lineTo(ax-fy*7,ay+fx*7);ctx.lineTo(ax+fy*7,ay-fx*7);ctx.closePath();ctx.fill();
   ctx.restore();};
  tok(B.foe,true);tok(B.me,false);
  for(const f of B.fx){const a=1-f.age/f.life;ctx.save();
   if(f.type==='slash'){ctx.strokeStyle=`rgba(${f.color},${a})`;ctx.lineWidth=6*a+2;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(f.x+Math.cos(f.a)*f.r,f.y+Math.sin(f.a)*f.r);ctx.lineTo(f.x-Math.cos(f.a)*f.r,f.y-Math.sin(f.a)*f.r);ctx.stroke();}
   else{ctx.globalAlpha=a;ctx.font=`800 ${f.size}px "Hiragino Mincho ProN",serif`;ctx.textAlign='center';ctx.lineWidth=4;ctx.strokeStyle='rgba(0,0,0,.7)';const y=f.y-f.age*30;ctx.strokeText(f.text,f.x,y);ctx.fillStyle=f.color;ctx.fillText(f.text,f.x,y);}
   ctx.restore();}
  ctx.restore();
 }
 draw3();foePlan();render();requestAnimationFrame(frame);
 // for the QA: one sensible turn — the card and the cell that hit hardest (behind, a push), out of the red if it can
 B.bot=()=>{if(B.done||B.phase!=='pick')return null;const red=teleSet();let best=null;
  ids().forEach((id,i)=>{const c=cardOf(id);for(const [x,y] of dests(c)){const hit=c.hit&&hits(c,x,y).some(([a,b])=>a===B.foe.x&&b===B.foe.y),side=hit?sideOf({x,y},B.foe):null;
   const s=(hit?2+(c.mult||0)*(c.hits||1)+(side==='back'?2:side==='side'?1:0)+(c.waza?4:0)+(c.push?1:0):0)+(red.has(key(x,y))?(c.guard?0.5:-3):0)+Math.random()*0.3;
   if(!best||s>best.s)best={s,i,x,y};}});
  B.sel=best.i;play(best.x,best.y);return best;};
 return B;
}
