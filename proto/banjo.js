// 盤上の立ち合い 第三案（#42、オーナーが画面見本に「おｋ」）。#38・#40 の「赤い予告」と「札」はやめた。
// 5×5のマス目で、弟子ひとりと相手ひとりが交代に動く。相手の手は見えず、相手が次に届く範囲だけがうっすら赤く見える。
// 自分の番：動く（青いマス）→ 技か計略をひとつ（計略は気を使う）。相手の番：相手も自由に動いて攻める（強敵ごとにクセ）。
// 駒には向きがあり、背後からは会心。盤の外へ押し出すと一本（強敵は大きな傷）。勝つと3つから1つ、技か計略を覚える。
// その作品のルールは使っていない。数字は試作の仮のもの。
import {$,R,V,S,clamp,sharpCanvas,wazaOf,wazaHits,artImage} from './kit.js';

const N=5,inB=(x,y)=>x>=0&&y>=0&&x<N&&y<N,key=(x,y)=>x+','+y;
const DIR={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
const sgn=v=>v>0?1:v<0?-1:0;
const dirTo=(ax,ay,bx,by)=>{const dx=bx-ax,dy=by-ay;return Math.abs(dx)>=Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up');};
const sideOf=(att,tgt)=>{const [fx,fy]=DIR[tgt.dir],d=fx*sgn(att.x-tgt.x)+fy*sgn(att.y-tgt.y);return d>0?'front':d<0?'back':'side';};
function adj(x,y,n){const o=[];for(const dx of [-1,0,1])for(const dy of [-1,0,1]){if(!dx&&!dy)continue;if(n===4&&dx&&dy)continue;if(inB(x+dx,y+dy))o.push([x+dx,y+dy]);}return o;}
function front3(x,y,f){const [dx,dy]=DIR[f];return [[x+dx,y+dy],[x+dx+dy,y+dy+dx],[x+dx-dy,y+dy-dx]].filter(([a,b])=>inB(a,b));}
function line(x,y,f,n){const [dx,dy]=DIR[f],o=[];for(let k=1;k<=n;k++)if(inB(x+dx*k,y+dy*k))o.push([x+dx*k,y+dy*k]);return o;}
const near=(x,y,r)=>{const o=[];for(let a=0;a<N;a++)for(let b=0;b<N;b++)if(Math.max(Math.abs(a-x),Math.abs(b-y))<=r&&(a!==x||b!==y))o.push([a,b]);return o;};

// ---- 技と計略. 技 strike from where the pupil stands (hit: the cells); 計略 cost 気 and do something else
export const MOVES={
 kiru:{kind:'技',name:'斬る',note:'まわり1マス',hit:'adj8',mult:1},
 tsuki:{kind:'技',name:'突き',note:'まっすぐ2マス・押す',hit:'line2',mult:1,push:1},
 nidan:{kind:'技',name:'二段斬り',note:'まわり1マスを2回',hit:'adj8',mult:0.62,hits:2},
 nagi:{kind:'技',name:'なぎ払い',note:'まわり全部・押す',hit:'adj8',mult:0.85,push:1},
 atari:{kind:'技',name:'体当たり',note:'となりを2マス押す',hit:'adj4',mult:0.3,push:2},
 mawari:{kind:'技',name:'回りこみ斬り',note:'横・背後へ跳んで斬る',hit:'adj8',mult:0.9,jump:'around'},
 kamae:{kind:'技',name:'構え',note:'前からの傷を半分・返す',guard:true},
 kaeshi:{kind:'技',name:'返し斬り',note:'受けた傷の分だけ斬り返す',counter:true,rare:true},
 kiai1:{kind:'技',name:'気合の一太刀',note:'気2・まわり1マスに2倍',hit:'adj8',mult:2,ki:2,rare:true},
 chohatsu:{kind:'計略',name:'挑発',note:'気1・相手を2マス引き寄せる',ki:1,pull:2,range:3},
 mekura:{kind:'計略',name:'目くらまし',note:'気2・相手は次の番うごけない',ki:2,stun:true,range:2},
 kiai:{kind:'計略',name:'気合',note:'気1・次の技が1.5倍',ki:1,buff:1.5},
 ashi:{kind:'計略',name:'足払い',note:'気2・となりを転ばせる（1回休み・背中を見せる）',ki:2,stun:true,spin:true,range:1},
 mikiri:{kind:'計略',name:'見切り',note:'気2・次の攻撃をかわして返す',ki:2,dodge:true},
 kemuri:{kind:'計略',name:'煙玉',note:'気1・2マス下がる',ki:1,retreat:2},
 kagefumi:{kind:'計略',name:'影踏み',note:'気2・相手の背後へ跳ぶ（次の技は会心）',ki:2,jump:'back',crit:true,rare:true}
};
export const START_MOVES={'攻め':['kiru','tsuki','kiai'],'素早さ':['kiru','mawari','kemuri'],'守り':['kiru','kamae','chohatsu']};
export const MAX_MOVES=6;
// three to learn after a win (a boss win offers the rare ones too)
export function learnChoices(known,boss=false){
 const pool=Object.keys(MOVES).filter(k=>!known.includes(k)&&(boss||!MOVES[k].rare));
 const out=[];while(out.length<3&&pool.length)out.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);return out;
}
// ---- the foes and their ways (クセ)
export const FOES2={
 shihan:{move:1,acts:['kiru','tsuki'],note:'正面から来る'},
 shihan2:{move:2,acts:['kiru','tsuki','atari'],tricks:['kamae'],note:'構えや体当たりも使う'},
 kashira:{move:2,acts:['oofuri','atari'],note:'まっすぐ詰めて大振り・体当たり'},
 taisho:{move:2,acts:['tosshin','kiru'],note:'突進して押す・端の弟子を押し出す'},
 ooni:{move:1,acts:['nagi','oofuri'],note:'動きは遅いが、なぎ払い'},
 tengu:{move:3,acts:['kiru','tsuki'],note:'3マス飛んで背後を取る'},
 kitsune:{move:2,acts:['kiru'],tricks:['mekura'],note:'目くらましを使う'}
};
const FOE_ACTS={
 kiru:{name:'斬り',hit:'adj8',mult:1},tsuki:{name:'突き',hit:'line2',mult:1,push:1},atari:{name:'体当たり',hit:'adj4',mult:0.5,push:2},
 oofuri:{name:'大振り',hit:'front3',mult:1.35},nagi:{name:'なぎ払い',hit:'adj8',mult:1.05,push:1},tosshin:{name:'突進',hit:'adj4',mult:1.15,push:1,charge:3}
};
function cellsFor(hit,x,y,f,form){if(hit==='adj8')return adj(x,y,8);if(hit==='adj4')return adj(x,y,4);if(hit==='front3')return front3(x,y,f);if(hit==='line2')return line(x,y,f,form==='yari'?3:2);if(hit==='near2')return near(x,y,2);return [];}

// a pupil with a sword, on the board
export function boardFighter(p,s){
 const u={name:p.name,face:p.face,form:s.form,power:V.strikePower(s)*p.atk*(p.like.includes(s.form)?1.2:1)*0.6,hp:Math.round((60+30*V.maxDurability(s))*p.vit),waza:wazaOf(s),
  move:2+((p.spd>=1.1||s.form==='tanto'||s.form==='wakizashi')?1:0),moves:[...(p.moves||START_MOVES[p.trait]||['kiru'])]};
 u.maxHp=u.hp;return u;
}

export function startBanjo({me,foe,title,rounds=0,boss=false,onEnd}){
 const over=$('#over');over.hidden=false;
 over.innerHTML=`<div class="sheet banjo"><p class="tag">${title}</p>
  <div class="bj-top"><span class="bj-n">${foe.face||''} ${foe.name}</span><i class="hp"><b class="bj-fhp"></b></i><span class="bj-st bj-fst"></span></div>
  <div class="bj-board"><canvas class="bj-cv"></canvas><div class="bj-cut" hidden></div></div>
  <div class="bj-top"><span class="bj-n">${me.face||''} ${me.name}</span><i class="hp"><b class="bj-mhp"></b></i><span class="bj-ki"></span></div>
  <p class="bj-hint"></p><div class="bj-acts"></div></div>`;
 const cv=over.querySelector('.bj-cv'),ctx=sharpCanvas(cv),hint=over.querySelector('.bj-hint'),acts=over.querySelector('.bj-acts'),cut=over.querySelector('.bj-cut');
 const F=FOES2[foe.kind]||FOES2.shihan;
 const B={phase:'move',round:1,me:{...me,x:2,y:3,dir:'up',ki:1,buff:1,guard:false,dodge:false,counter:false,critNext:false},foe:{...foe,x:2,y:1,dir:'down',skip:0,guard:false},
  fx:[],stop:0,shake:0,stats:{dealt:0,taken:0,backs:0,pushes:0,tricks:0},done:false,log:''};
 window.__banjo=B;
 for(const f of [B.me,B.foe]){f.dx=f.x;f.dy=f.y;}
 const cell=()=>Math.min(cv.W,cv.H)/N,org=()=>({x:(cv.W-cell()*N)/2,y:(cv.H-cell()*N)/2});
 const px=(x,y)=>{const c=cell(),o=org();return {x:o.x+(x+0.5)*c,y:o.y+(y+0.5)*c};};
 const num=(text,x,y,color='#fff',size=20)=>{const p=px(x,y);B.fx.push({type:'num',text,x:p.x,y:p.y-cell()*0.45,color,size,age:0,life:1.1});};
 const slash=(x,y,color='255,255,255')=>{const p=px(x,y);B.fx.push({type:'slash',x:p.x,y:p.y,r:cell()*0.5,color,age:0,life:0.3,a:Math.random()*Math.PI});};
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 const other=w=>w===B.me?B.foe:B.me,free=(x,y,w)=>inB(x,y)&&!(other(w).x===x&&other(w).y===y);
 const dist=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
 // cells within n steps (around the other piece)
 function reachable(w,n){const seen=new Map([[key(w.x,w.y),0]]),q=[[w.x,w.y]];
  while(q.length){const [x,y]=q.shift(),d=seen.get(key(x,y));if(d>=n)continue;for(const [a,b] of adj(x,y,4))if(free(a,b,w)&&!seen.has(key(a,b))){seen.set(key(a,b),d+1);q.push([a,b]);}}
  return [...seen.keys()].map(k=>k.split(',').map(Number));}
 // the cells the foe could strike on its next turn (shown faint red)
 function threat(){const e=B.foe,s=new Set();if(e.skip)return s;
  for(const [x,y] of reachable(e,F.move))for(const a of F.acts){const A=FOE_ACTS[a],f=dirTo(x,y,B.me.x,B.me.y);
   for(const [cx,cy] of cellsFor(A.hit,x,y,f))s.add(key(cx,cy));if(A.charge)for(const [cx,cy] of line(x,y,f,A.charge+1))s.add(key(cx,cy));}
  return s;}
 const known=()=>B.me.moves.map(k=>({k,...MOVES[k]})).concat(B.me.ki>=3?[{k:'waza',kind:'技',name:`必殺『${B.me.waza.name}』`,note:'気3・2マス以内・崩す',hit:'near2',waza:true,ki:3}]:[]);
 const reaches=(m,x=B.me.x,y=B.me.y)=>{if(!m.hit)return false;if(m.jump)return Math.abs(x-B.foe.x)+Math.abs(y-B.foe.y)<=4;return cellsFor(m.hit,x,y,dirTo(x,y,B.foe.x,B.foe.y),B.me.form).some(([a,b])=>a===B.foe.x&&b===B.foe.y);};
 function usable(m){if((m.ki||0)>B.me.ki)return false;if(m.kind==='技'&&m.hit)return reaches(m);if(m.range&&dist(B.me,B.foe)>m.range)return false;return true;}
 function render(){
  over.querySelector('.bj-fhp').style.width=`${Math.round(100*Math.max(0,B.foe.hp)/B.foe.maxHp)}%`;over.querySelector('.bj-mhp').style.width=`${Math.round(100*Math.max(0,B.me.hp)/B.me.maxHp)}%`;
  over.querySelector('.bj-ki').textContent=`気 ${'▰'.repeat(B.me.ki)}${'▱'.repeat(3-B.me.ki)}`;over.querySelector('.bj-fst').textContent=B.foe.skip?'うごけない':B.foe.guard?'構え':'';
  if(B.done){acts.innerHTML='';return;}
  if(B.phase==='move'){hint.innerHTML=`<b>${B.round}手目・自分の番</b>　${B.log?B.log+'　':''}<b>青いマス</b>へ動く（うっすら赤いマスは、${foe.name}が次に届く範囲）。`;
   acts.innerHTML=`<button class="btn small" data-stay>動かない</button>`;acts.querySelector('[data-stay]').onclick=()=>{S.tick();B.phase='act';render();};return;}
  if(B.phase==='act'){hint.innerHTML=`${B.me.blindNote?'目くらましで動けない。':''}<b>技か計略をひとつ</b>（計略は気を使う）。黄色いふちは届く技。`;
   acts.innerHTML=known().map(m=>`<button class="bj-act ${m.kind==='計略'?'kei':''} ${m.waza?'waza':''} ${m.hit&&reaches(m)?'reach':''}" data-m="${m.k}" ${usable(m)?'':'disabled'}><b>${m.name}</b><small>${m.note}</small></button>`).join('')+`<button class="bj-act" data-m="wait"><b>待つ</b><small>気＋1</small></button>`;
   for(const b of acts.querySelectorAll('[data-m]'))b.onclick=()=>{S.unlock();doMove(b.dataset.m);};return;}
  acts.querySelectorAll('button').forEach(b=>b.disabled=true);
 }
 function hitFoe(dmg,label,color='#fff',size=20){const e=B.foe;if(e.guard){dmg=Math.round(dmg*0.5);label=(label?label+'・':'')+'構えで半分';}
  e.hp=Math.max(0,e.hp-dmg);B.stats.dealt+=dmg;num(String(dmg),e.x,e.y,color,size);if(label)num(label,e.x,e.y-0.5,'#ffe08a',16);slash(e.x,e.y,color==='#bfe6ff'?'143,211,255':'255,255,255');S.clang(1);B.stop=0.08;B.shake=0.15;}
 function push(t,from,k){const [dx,dy]=DIR[dirTo(from.x,from.y,t.x,t.y)];for(let i=0;i<k;i++){const nx=t.x+dx,ny=t.y+dy;if(!inB(nx,ny)){t.out={dx,dy};return true;}if(!free(nx,ny,t))return false;t.x=nx;t.y=ny;}return false;}
 async function doMove(id){
  const m=B.me,e=B.foe;if(B.phase!=='act')return;B.phase='busy';m.blindNote=false;render();
  if(id==='wait'){m.ki=Math.min(3,m.ki+1);num('気＋1',m.x,m.y,'#8fd3ff',16);await wait(300);return foeTurn();}
  const M=id==='waza'?known().find(x=>x.waza):{k:id,...MOVES[id]};if(!M||!usable(M)){B.phase='act';render();return;}
  m.ki-=M.ki||0;
  if(M.kind==='計略'){B.stats.tricks++;cutIn(M.name,'kei');await wait(450);
   if(M.pull){const [dx,dy]=DIR[dirTo(e.x,e.y,m.x,m.y)];for(let i=0;i<M.pull;i++){if(free(e.x+dx,e.y+dy,e)){e.x+=dx;e.y+=dy;}}e.dir=dirTo(e.x,e.y,m.x,m.y);num('引き寄せた',e.x,e.y,'#bfe6ff',16);}
   if(M.stun){e.skip=1;num(M.spin?'転んだ！':'うごけない',e.x,e.y,'#bfe6ff',16);if(M.spin)e.dir=['up','right','down','left'].find(d=>sideOf(m,{...e,dir:d})==='back')||e.dir;}
   if(M.buff){m.buff=M.buff;num('気合！',m.x,m.y,'#ffe08a',16);}
   if(M.dodge){m.dodge=true;num('見切りの構え',m.x,m.y,'#bfe6ff',16);}
   if(M.retreat){const [dx,dy]=DIR[dirTo(e.x,e.y,m.x,m.y)];for(let i=0;i<M.retreat;i++)if(free(m.x+dx,m.y+dy,m)){m.x+=dx;m.y+=dy;}num('さがった',m.x,m.y,'#bfe6ff',16);}
   if(M.jump==='back'){const [fx,fy]=DIR[e.dir],bx=e.x-fx,by=e.y-fy;if(free(bx,by,m)){m.x=bx;m.y=by;}m.dir=dirTo(m.x,m.y,e.x,e.y);m.critNext=true;num('影踏み',m.x,m.y,'#bfe6ff',16);}
   S.glint(1);render();await wait(400);return foeTurn();}
  // 技
  if(M.guard){m.guard=true;num('構え',m.x,m.y,'#bfe6ff',16);await wait(300);return foeTurn();}
  if(M.counter){m.counter=true;num('返しの構え',m.x,m.y,'#bfe6ff',16);await wait(300);return foeTurn();}
  if(M.jump==='around'){const r=c=>({back:0,side:1,front:2})[sideOf({x:c[0],y:c[1]},e)];const cand=adj(e.x,e.y,8).filter(([x,y])=>free(x,y,m)&&Math.abs(x-m.x)+Math.abs(y-m.y)<=4).sort((a,b)=>r(a)-r(b));
   if(cand[0]){m.x=cand[0][0];m.y=cand[0][1];await wait(200);}}
  m.dir=dirTo(m.x,m.y,e.x,e.y);
  const side=sideOf(m,e);let out=false;
  if(M.waza){const hs=wazaHits(m.waza,m.power,{hp:e.hp,maxHp:e.maxHp},Math.random);cutIn(m.waza.name,'waza');await wait(550);for(const h of hs){hitFoe(h,null,'#bfe6ff',24);await wait(160);}e.skip=1;num('崩れた！',e.x,e.y+0.6,'#8fd3ff',16);}
  else{const n=(M.hits||1)+(m.form==='tanto'&&M.k==='kiru'?1:0);
   for(let k=0;k<n;k++){const crit=side==='back'||m.critNext||Math.random()<(side==='side'?0.3:0.1);
    const mult=(M.mult||1)*(side==='side'?1.25:1)*(crit?1.5:1)*m.buff*(m.form==='odachi'&&M.k==='kiru'?1.3:1)*(m.form==='tanto'&&M.k==='kiru'?0.6:1);
    hitFoe(Math.max(1,Math.round(m.power*mult*(0.9+0.2*Math.random()))),k===0&&side!=='front'?(side==='back'?'背後！':'横から！'):crit?'会心':null,crit?'#ffe08a':'#fff',crit?26:20);
    if(side==='back'&&k===0)B.stats.backs++;await wait(170);}
   m.critNext=false;m.buff=1;m.ki=Math.min(3,m.ki+1);
   if(M.push&&e.hp>0){out=push(e,m,M.push);B.stats.pushes++;if(out)num('場外！',e.x,e.y,'#ffe08a',26);}}
  e.guard=false;render();await wait(300);
  if(out){if(!boss)return end(true,'場外で一本！');const d=Math.round(e.maxHp*0.25);e.out=null;e.x=Math.max(0,Math.min(N-1,e.x));e.y=Math.max(0,Math.min(N-1,e.y));hitFoe(d,'場外','#ffe08a',24);e.skip=1;}
  if(e.hp<=0)return end(true);
  return foeTurn();
 }
 // the foe's turn: it goes where it can strike hardest (behind the pupil if it can, pushing them out if it can), or closes in
 async function foeTurn(){
  const m=B.me,e=B.foe;B.phase='foe';render();await wait(250);
  if(e.skip){e.skip=0;num('うごけない',e.x,e.y,'#bfe6ff',16);B.log=`${foe.name}は動けなかった。`;}
  else{
   const trick=(F.tricks||[]).find(()=>Math.random()<0.3);
   if(trick==='mekura'&&dist(e,m)<=3){cutIn('目くらまし','foe');await wait(450);m.blind=1;B.log=`${foe.name}の目くらまし！ 次の番は動けない。`;}
   else if(trick==='kamae'&&dist(e,m)<=2){e.guard=true;num('構え',e.x,e.y,'#ffb08a',16);B.log=`${foe.name}は構えた（次の技は半分）。`;}
   else{
    let best=null;
    for(const [x,y] of reachable(e,F.move))for(const a of F.acts){const A=FOE_ACTS[a],f=dirTo(x,y,m.x,m.y);
     let cells=cellsFor(A.hit,x,y,f),fx=x,fy=y;
     if(A.charge){let ok=null;for(const [cx,cy] of line(x,y,f,A.charge)){if(!free(cx,cy,e))break;ok=[cx,cy];}if(ok&&adj(ok[0],ok[1],4).some(([a2,b2])=>a2===m.x&&b2===m.y)){fx=ok[0];fy=ok[1];cells=adj(fx,fy,4);}}
     const hits=cells.some(([a2,b2])=>a2===m.x&&b2===m.y),sd=hits?sideOf({x:fx,y:fy},m):null,edge=m.x===0||m.y===0||m.x===N-1||m.y===N-1;
     const s=(hits?10*A.mult+(sd==='back'?6:sd==='side'?3:0)+(A.push&&edge?6:0):-(Math.abs(fx-m.x)+Math.abs(fy-m.y)))+Math.random()*1.5;
     if(!best||s>best.s)best={s,x,y,fx,fy,a,hits};}
    e.x=best.x;e.y=best.y;e.dir=dirTo(e.x,e.y,m.x,m.y);await wait(220);
    if(best.fx!==best.x||best.fy!==best.y){e.x=best.fx;e.y=best.fy;e.dir=dirTo(e.x,e.y,m.x,m.y);await wait(180);}
    if(best.hits){const A=FOE_ACTS[best.a],sd=sideOf(e,m);cutIn(A.name,'foe');await wait(300);
     if(m.dodge){m.dodge=false;num('見切った！',m.x,m.y,'#bfe6ff',18);hitFoe(Math.round(m.power*(0.9+0.2*Math.random())),'返し');B.log=`${foe.name}の${A.name}を見切って返した。`;}
     else{let dmg=Math.round(e.power*A.mult*(sd==='back'?1.5:sd==='side'?1.2:1)*(0.9+0.2*Math.random()));const guarded=m.guard&&sd==='front';if(guarded)dmg=Math.round(dmg*(m.form==='chokuto'?0.25:0.5));
      m.hp=Math.max(0,m.hp-dmg);B.stats.taken+=dmg;num(`-${dmg}`,m.x,m.y,'#ff9a8a',22);if(sd!=='front')num(sd==='back'?'背後から！':'横から！',m.x,m.y-0.5,'#ff9a8a',16);slash(m.x,m.y,'255,120,90');B.shake=0.25;B.stop=0.08;S.thud();
      if(guarded)hitFoe(Math.round(m.power*0.45),'返し');if(m.counter&&m.hp>0)hitFoe(dmg,'返し斬り','#ffe08a',22);
      B.log=`${foe.name}の${A.name}${sd!=='front'?`（${sd==='back'?'背後':'横'}から）`:''}で${dmg}の傷。`;
      if(A.push&&!guarded&&m.hp>0&&push(m,e,A.push)){num('場外！',m.x,m.y,'#ff9a8a',24);await wait(350);if(!boss)return end(false,'場外で一本とられた');
       const d=Math.round(m.maxHp*0.25);m.hp=Math.max(0,m.hp-d);B.stats.taken+=d;m.out=null;m.x=Math.max(0,Math.min(N-1,m.x));m.y=Math.max(0,Math.min(N-1,m.y));}}
    }else B.log=`${foe.name}は間合いをつめた。`;
   }
  }
  m.guard=false;m.counter=false;await wait(300);
  if(e.hp<=0)return end(true);if(m.hp<=0)return end(false);
  if(rounds&&B.round>=rounds)return end(B.foe.hp/B.foe.maxHp<B.me.hp/B.me.maxHp,'稽古おわり');
  B.round++;m.ki=Math.min(3,m.ki+1);
  if(m.blind){m.blind=0;m.blindNote=true;B.phase='act';}else B.phase='move';render();
 }
 function cutIn(name,kind=''){cut.hidden=false;cut.className=`bj-cut ${kind}`;cut.textContent=`『${name}』`;void cut.offsetWidth;cut.classList.add('go');if(kind==='waza')S.glint(3);setTimeout(()=>{cut.hidden=true;},800);}
 function end(win,why=''){B.done=true;B.win=win;B.phase='done';render();hint.innerHTML=win?`<b class="ok">${why||'勝った！'}</b>`:`<b class="bad">${why||'負けた……'}</b>`;
  S.phrase(win?5:1);setTimeout(()=>onEnd({win,why,rounds:B.round,...B.stats,hpLeft:B.me.hp}),1000);}
 cv.addEventListener('pointerdown',ev=>{
  if(B.done||B.phase!=='move')return;cv.refit?.();const r=cv.getBoundingClientRect(),x=Math.floor((ev.clientX-r.left-org().x)/cell()),y=Math.floor((ev.clientY-r.top-org().y)/cell());
  if(reachable(B.me,B.me.move).some(([a,b])=>a===x&&b===y)){S.tick();B.me.x=x;B.me.y=y;B.me.dir=dirTo(x,y,B.foe.x,B.foe.y);B.phase='act';render();}
 });
 let last=performance.now();
 function frame(t){if(!over.contains(cv))return;const raw=Math.min(0.05,(t-last)/1000);let dt=raw;last=t;if(B.stop>0){B.stop-=raw;dt=0;}B.shake=Math.max(0,B.shake-raw);
  for(const f of [B.me,B.foe]){const k=Math.min(1,dt*14);f.dx+=(f.x+(f.out?f.out.dx*2:0)-f.dx)*k;f.dy+=(f.y+(f.out?f.out.dy*2:0)-f.dy)*k;}
  for(const f of B.fx)f.age+=dt;B.fx=B.fx.filter(f=>f.age<f.life);draw(t/1000);requestAnimationFrame(frame);}
 function draw(time){
  const W=cv.W,H=cv.H,c=cell(),o=org();if(!W)return;ctx.clearRect(0,0,W,H);ctx.save();
  if(B.shake>0)ctx.translate((Math.random()-0.5)*10*B.shake/0.25,(Math.random()-0.5)*8*B.shake/0.25);
  for(let x=0;x<N;x++)for(let y=0;y<N;y++){ctx.fillStyle=(x+y)%2?'#5a4330':'#644b36';ctx.fillRect(o.x+x*c,o.y+y*c,c,c);ctx.strokeStyle='rgba(0,0,0,.35)';ctx.strokeRect(o.x+x*c,o.y+y*c,c,c);}
  ctx.strokeStyle='rgba(200,60,40,.6)';ctx.lineWidth=3;ctx.strokeRect(o.x,o.y,c*N,c*N);
  if(!B.done&&B.phase!=='foe')for(const k of threat()){const [x,y]=k.split(',').map(Number);ctx.fillStyle='rgba(210,60,40,.22)';ctx.fillRect(o.x+x*c+1,o.y+y*c+1,c-2,c-2);}
  if(B.phase==='move'&&!B.done)for(const [x,y] of reachable(B.me,B.me.move)){ctx.strokeStyle='rgba(120,190,255,.95)';ctx.lineWidth=3;ctx.strokeRect(o.x+x*c+5,o.y+y*c+5,c-10,c-10);
   const s=sideOf({x,y},B.foe);if(Math.max(Math.abs(x-B.foe.x),Math.abs(y-B.foe.y))===1&&s!=='front'){ctx.fillStyle='#ffe08a';ctx.font='700 11px sans-serif';ctx.textAlign='center';ctx.fillText(s==='back'?'背後':'横',o.x+(x+0.5)*c,o.y+y*c+15);}}
  if(B.phase==='act'&&!B.done&&known().some(m=>m.hit&&reaches(m))){const p=px(B.foe.x,B.foe.y);ctx.strokeStyle=`rgba(255,213,106,${0.6+0.3*Math.sin(time*8)})`;ctx.lineWidth=4;ctx.strokeRect(p.x-c/2+3,p.y-c/2+3,c-6,c-6);}
  const tok=(f,isFoe)=>{const p={x:o.x+(f.dx+0.5)*c,y:o.y+(f.dy+0.5)*c},r=c*0.38,img=isFoe&&f.key?artImage('foe-'+f.key):null;ctx.save();if(isFoe&&f.skip)ctx.globalAlpha=0.6;
   if(img)ctx.drawImage(img,p.x-r*1.25,p.y-r*1.25,r*2.5,r*2.5);else{ctx.fillStyle=isFoe?'#3a1a14':'#2e2018';ctx.strokeStyle=isFoe?'#ff8a6a':'#ffd56a';ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.font=`${r*1.1}px serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(f.face||'',p.x,p.y+1);}
   const [fx,fy]=DIR[f.dir];ctx.globalAlpha=1;ctx.fillStyle=isFoe?'#ff8a6a':'#ffd56a';ctx.beginPath();const ax=p.x+fx*r*1.15,ay=p.y+fy*r*1.15;ctx.moveTo(ax+fx*8,ay+fy*8);ctx.lineTo(ax-fy*7,ay+fx*7);ctx.lineTo(ax+fy*7,ay-fx*7);ctx.closePath();ctx.fill();
   ctx.restore();};
  tok(B.foe,true);tok(B.me,false);
  for(const f of B.fx){const a=1-f.age/f.life;ctx.save();
   if(f.type==='slash'){ctx.strokeStyle=`rgba(${f.color},${a})`;ctx.lineWidth=6*a+2;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(f.x+Math.cos(f.a)*f.r,f.y+Math.sin(f.a)*f.r);ctx.lineTo(f.x-Math.cos(f.a)*f.r,f.y-Math.sin(f.a)*f.r);ctx.stroke();}
   else{ctx.globalAlpha=a;ctx.font=`800 ${f.size}px "Hiragino Mincho ProN",serif`;ctx.textAlign='center';ctx.lineWidth=4;ctx.strokeStyle='rgba(0,0,0,.7)';const y=f.y-f.age*28;ctx.strokeText(f.text,f.x,y);ctx.fillStyle=f.color;ctx.fillText(f.text,f.x,y);}
   ctx.restore();}
  ctx.restore();
 }
 render();requestAnimationFrame(frame);
 // for the QA: one sensible step — move out of the red onto a cell that reaches (behind if it can), then the strongest usable move
 B.bot=()=>{if(B.done)return null;
  if(B.phase==='move'){const red=threat(),opts=reachable(B.me,B.me.move).map(([x,y])=>{const r=known().some(m=>m.hit&&!m.jump&&(m.ki||0)<=B.me.ki&&reaches(m,x,y)),s=sideOf({x,y},B.foe);
    return {x,y,s:(r?3:0)+(r&&s==='back'?2:r&&s==='side'?1:0)-(red.has(key(x,y))?1.5:0)-dist({x,y},B.foe)*0.1};}).sort((a,b)=>b.s-a.s);
   const b=opts[0];B.me.x=b.x;B.me.y=b.y;B.me.dir=dirTo(b.x,b.y,B.foe.x,B.foe.y);B.phase='act';render();return 'move';}
  if(B.phase==='act'){const order=m=>(m.waza?10:0)+(m.hit?5*(m.mult||1)*(m.hits||1):0)+(m.stun?3:0)+(m.buff?1:0);const ms=known().filter(usable).sort((a,b)=>order(b)-order(a));doMove(ms[0]?ms[0].k:'wait');return 'act';}
  return null;};
 return B;
}
