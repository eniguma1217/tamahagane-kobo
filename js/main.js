// The app shell: screens (title, materials, the forging steps, result, records), the canvas loop, input and the save.
import * as R from './rules.js';
import {loadSave,writeSave,addSword,bestSword} from './save.js';
import * as S from './sound.js';
import {setDPR} from './draw.js';
import {loadArt,artSrc} from './art.js';
import {Heat,Hammer,Hamon,Quench,Polish,Ambient} from './scenes.js';

const $=s=>document.querySelector(s);
const el={app:$('#app'),bar:$('#bar'),steps:$('#steps'),meter:$('#meter'),stage:$('#stage'),cv:$('#cv'),panel:$('#panel'),pop:$('#pop'),talk:$('#talk'),face:$('#face'),line:$('#line'),controls:$('#controls'),sound:$('#sound')};
const ctx=el.cv.getContext('2d');
let save=loadSave(window.localStorage);
S.setSound(save.settings.sound);
let scene=null,timers=[],W=360,H=480,last=performance.now(),runTime=0;

const FORGE=[['heat','熱する'],['hammer','叩く'],['hamon','焼き入れ'],['quench','焼き入れ'],['polish','研ぐ']];
const STEP_NAMES=['素材','熱する','叩く','焼き入れ','研ぐ'];
const MAT_COLOR={jou:'#c9d3dc',nami:'#9aa3ab',oroshi:'#8a6a55',houcho:'#5b6470'};

const api={
 run:null,
 say(html,mood='normal'){el.line.innerHTML=html;setFace(mood);},
 pop(text,grade='info'){el.pop.textContent=text;el.pop.className='';void el.pop.offsetWidth;el.pop.className='show g-'+grade;},
 later(ms,fn){const id=setTimeout(()=>{timers=timers.filter(t=>t!==id);fn();},ms);timers.push(id);},
 controls(list){
  el.controls.replaceChildren(...list.map(b=>{
   const n=document.createElement('button');n.className='btn'+(b.primary?' primary':'')+(b.hold?' hold':'');n.textContent=b.label;n.disabled=!!b.disabled;
   if(b.hold){n.addEventListener('pointerdown',e=>{e.preventDefault();S.unlock();n.setPointerCapture?.(e.pointerId);n.classList.add('on');scene?.down({key:true,t:e.timeStamp});});
    for(const ev of ['pointerup','pointercancel','lostpointercapture'])n.addEventListener(ev,e=>{if(!n.classList.contains('on'))return;n.classList.remove('on');scene?.up({key:true,t:e.timeStamp});});}
   else if(b.tap)n.addEventListener('pointerdown',e=>{e.preventDefault();S.unlock();scene?.down({key:true,t:e.timeStamp});});
   else n.addEventListener('click',()=>{S.unlock();S.tick();b.onClick?.();});
   return n;}));
 },
 progress(v,max,label){
  if(v==null){el.meter.hidden=true;return;}
  el.meter.hidden=false;el.meter.querySelector('i').style.width=`${Math.round(100*v/max)}%`;
  el.meter.querySelector('span').textContent=label?`${label} ${Math.round(100*v/max)}%`:`${v} / ${max}`;
 },
 next(){forgeNext();},
 swordTop:()=>null
};

// ---------- faces ----------
const FACE={normal:`<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="24" fill="#3a2a20"/><ellipse cx="24" cy="26" rx="13" ry="15" fill="#e0b48a"/><rect x="10" y="13" width="28" height="5" rx="2" fill="#2b3a55"/><path d="M37 15l7-4-1 7z" fill="#2b3a55"/><path d="M14 22q4-3 8 0M26 22q4-3 8 0" stroke="#f4f1ea" stroke-width="2.6" fill="none" stroke-linecap="round"/><circle cx="18.5" cy="25.5" r="1.5" fill="#2a1d16"/><circle cx="29.5" cy="25.5" r="1.5" fill="#2a1d16"/><path d="M12 31q12 20 24 0q-5 4-12 4t-12-4z" fill="#f4f1ea"/><path d="M20 33q4 1.5 8 0" stroke="#2a1d16" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>`,
 happy:`<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="24" fill="#3a2a20"/><ellipse cx="24" cy="26" rx="13" ry="15" fill="#e0b48a"/><rect x="10" y="13" width="28" height="5" rx="2" fill="#2b3a55"/><path d="M37 15l7-4-1 7z" fill="#2b3a55"/><path d="M14 21q4-3 8 0M26 21q4-3 8 0" stroke="#f4f1ea" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M16 26q2.5-2.5 5 0M27 26q2.5-2.5 5 0" stroke="#2a1d16" stroke-width="1.7" fill="none" stroke-linecap="round"/><path d="M12 31q12 20 24 0q-5 4-12 4t-12-4z" fill="#f4f1ea"/><path d="M19 32q5 4 10 0" stroke="#2a1d16" stroke-width="1.8" fill="#8a3a2a" stroke-linecap="round"/></svg>`};
function setFace(mood){
 const src=artSrc(mood==='happy'?'oyakata-happy':'oyakata')||artSrc('oyakata');
 el.face.innerHTML=src?`<img src="${src}" alt="">`:FACE[mood]||FACE.normal;
}
function matIcon(id,size=40){
 const src=artSrc('mat-'+id);if(src)return `<img class="mat-img" src="${src}" alt="" width="${size}" height="${size}">`;
 const c=MAT_COLOR[id];
 return `<svg viewBox="0 0 40 40" width="${size}" height="${size}" aria-hidden="true"><path d="M6 26 12 10 26 6 35 16 32 31 17 35z" fill="${c}"/><path d="M12 10 26 6 35 16 22 19z" fill="rgba(255,255,255,0.28)"/><path d="M22 19 17 35 6 26z" fill="rgba(0,0,0,0.22)"/>${id==='jou'?'<path d="M28 9l1.5 3 3 1.5-3 1.5-1.5 3-1.5-3-3-1.5 3-1.5z" fill="#fff"/>':''}</svg>`;
}
const pips=(n,label)=>`<span class="pips" title="${label}">${label}<b>${'●'.repeat(n)}<i>${'●'.repeat(5-n)}</i></b></span>`;
const yen=n=>n.toLocaleString('ja-JP');
const starStr=n=>'★'.repeat(n)+'☆'.repeat(5-n);

// ---------- screens ----------
function setScene(s){
 for(const t of timers)clearTimeout(t);timers=[];S.stopBlow();
 scene=s;s.enter?.();
}
function mode(m){el.app.dataset.mode=m;}
function steps(index){
 el.steps.innerHTML=STEP_NAMES.map((n,i)=>`<span class="${i<index?'done':i===index?'now':''}">${n}</span>`).join('<i>›</i>');
}

function showTitle(){
 mode('title');setScene(new Ambient(api,'title','title'));
 const n=save.forged||0;
 el.panel.innerHTML=`<div class="title">
  <div class="title-name"><h1>玉鋼工房</h1><span class="seal">工房</span></div>
  <p class="title-sub">たまはがね こうぼう</p>
  <div class="menu"><button class="btn primary big" data-go="forge">刀を打つ</button>
  <button class="btn" data-go="records" ${n?'':'disabled'}>打った刀（${n}振）</button></div>
 </div>`;
 el.panel.querySelector('[data-go=forge]').onclick=()=>{S.unlock();S.tick();showMaterials();};
 el.panel.querySelector('[data-go=records]').onclick=()=>{S.tick();showRecords();};
}

let pick={kawa:null,shin:null,active:'kawa'};
function showMaterials(){
 mode('materials');steps(0);el.meter.hidden=true;
 setScene(new Ambient(api,'materials','title',{dim:0.78}));
 api.controls([{label:'これで打つ',primary:true,disabled:true,onClick:()=>{if(pick.kawa&&pick.shin)startForging();}}]);
 renderMaterials();
}
function renderMaterials(){
 const c=pick.kawa&&pick.shin?R.combine(pick.kawa,pick.shin):null;
 const slot=(k,label,sub)=>{const m=pick[k]?R.material(pick[k]):null;return `<button class="slot ${pick.active===k?'active':''}" data-slot="${k}"><small>${label}</small><b>${m?m.name:'えらぶ'}</b><em>${sub}</em></button>`;};
 const cross=`<svg class="cross" viewBox="0 0 40 100" aria-hidden="true"><path d="M20 4 30 18 26 86 20 97 14 86 10 18z" fill="${pick.kawa?MAT_COLOR[pick.kawa]:'#3a302a'}" stroke="#d4aa52" stroke-width="1"/><path d="M20 14 25.5 23 23 60 20 66 17 60 14.5 23z" fill="${pick.shin?MAT_COLOR[pick.shin]:'#2a221d'}" stroke="rgba(0,0,0,.4)"/></svg>`;
 el.panel.innerHTML=`<div class="mats-screen">
  <div class="slots">${slot('kawa','皮鉄（かわがね）','外側・刃になる')}${cross}${slot('shin','心鉄（しんがね）','内側・折れにくさ')}</div>
  <div class="mats">${R.MATERIALS.map(m=>`<button class="mat ${pick.kawa===m.id?'is-kawa':''} ${pick.shin===m.id?'is-shin':''}" data-mat="${m.id}">
   ${matIcon(m.id)}<span class="mat-text"><b>${m.name}</b><small>${m.note}</small><span class="mat-pips">${pips(m.hard,'硬さ')}${pips(m.tough,'粘り')}${pips(m.beauty,'美しさ')}</span></span></button>`).join('')}</div>
 </div>`;
 for(const b of el.panel.querySelectorAll('[data-slot]'))b.onclick=()=>{S.tick();pick.active=b.dataset.slot;renderMaterials();};
 for(const b of el.panel.querySelectorAll('[data-mat]'))b.onclick=()=>{S.unlock();S.tick();pick[pick.active]=b.dataset.mat;if(pick.active==='kawa'&&!pick.shin)pick.active='shin';renderMaterials();};
 el.controls.querySelector('button').disabled=!c;
 if(!c)api.say(pick.active==='kawa'?'まず<b>皮鉄</b>をえらべ。外側を包んで、刃になる鉄だ。':'次は<b>心鉄</b>だ。内側の芯で、折れにくさを決める。');
 else{
  const d=c.kawa.hard-c.shin.hard;
  api.say({kobuse:d>=3?'いい組み合わせだ。硬い皮が刃になり、やわらかい芯が折れを防ぐ。':'甲伏せだな。悪くない組み合わせだ。',maru:'同じ鉄だけの丸鍛えか。素直だが、良さが片寄るぞ。',gyaku:'おいおい、あべこべだ。皮がやわらかいと刃がなまくらになる。'}[c.kind]+(c.kawa.id==='jou'?' 上玉鋼は熱する色にきびしいぞ。':''),c.kind==='kobuse'&&d>=3?'happy':'normal');
 }
}

let forgeIndex=-1;
function startForging(){
 api.run={kawa:pick.kawa,shin:pick.shin};forgeIndex=-1;el.panel.innerHTML='';forgeNext();
}
function forgeNext(){
 forgeIndex++;
 if(forgeIndex>=FORGE.length)return showResult();
 const [name]=FORGE[forgeIndex];mode('forge');
 steps(STEP_NAMES.indexOf(FORGE[forgeIndex][1]));api.progress(null);
 el.stage.classList.remove('fade');void el.stage.offsetWidth;el.stage.classList.add('fade');
 setScene(new ({heat:Heat,hammer:Hammer,hamon:Hamon,quench:Quench,polish:Polish}[name])(api));
}

function showResult(){
 const sword=R.finishSword(api.run);
 save=addSword(save,sword);writeSave(window.localStorage,save);
 mode('result');setScene(new Ambient(api,'result','plain',{sword,dim:0.2}));S.phrase(sword.stars);
 const g=api.run,chip=(k,v)=>`<span><small>${k}</small>${v}</span>`;
 const hits=(g.hitGrades||[]).filter(x=>x==='best').length;
 el.panel.innerHTML=`<div class="result">
  <div class="sword-space"></div>
  <div class="stars s${sword.stars}">${starStr(sword.stars)}<span>${sword.rank}</span></div>
  <h2 class="mei">${sword.name}</h2>
  <p class="tags">${R.HAMON_NAME[sword.hamon]}・${{kobuse:'甲伏せ',maru:'丸鍛え',gyaku:'あべこべ'}[sword.combo]}（${R.material(sword.kawa).name}＋${R.material(sword.shin).name}）${sword.crack?'・<b class="bad">焼き割れ</b>':''}</p>
  <div class="stats">${[['切れ味','sharp'],['粘り','tough'],['美しさ','beauty']].map(([n,k])=>`<div><small>${n}</small><i><b style="width:${sword.stats[k]}%"></b></i><em>${sword.stats[k]}</em></div>`).join('')}</div>
  <p class="price">売値 <b>${yen(sword.price)}</b> 文</p>
  <div class="chips">${chip('熱する',g.heat.label)}${chip('叩く',`会心${hits}/12`)}${chip('土置き',g.hamon.name)}${chip('焼き入れ',g.quench.label)}${chip('研ぐ',g.polish.scratches?`キズ${g.polish.scratches}`:g.polish.coverage>=0.985?'会心':`曇り${Math.round((1-g.polish.coverage)*100)}%`)}</div>
  <p class="comment">${resultComment(sword)}</p>
 </div>`;
 api.controls([{label:'タイトルへ',onClick:showTitle},{label:'もう一振り打つ',primary:true,onClick:showMaterials}]);
 api.swordTop=()=>{const s=el.panel.querySelector('.sword-space');if(!s)return null;const a=s.getBoundingClientRect(),b=el.stage.getBoundingClientRect();return a.top-b.top+a.height/2;};
}
function resultComment(s){
 if(s.crack)return '親方「焼き割れだ……。焼き入れの色が熱すぎたな。次は月夜の色をよく見ろ」';
 return '親方「'+['まあ、最初はこんなものだ。上の工程のどこでつまずいたか見てみろ','並の刀だ。売り物にはなる','なかなかの良品だ。腕が上がってきたな','業物だ！ これは高く売れるぞ','……見事だ。名刀と呼んでいい'][s.stars-1]+'」';
}

function showRecords(){
 mode('records');setScene(new Ambient(api,'records','plain',{dim:0.45}));
 const best=bestSword(save),sum=save.swords.reduce((s,x)=>s+x.price,0);
 el.panel.innerHTML=`<div class="records">
  <h2>打った刀 <small>${save.forged}振</small></h2>
  <p class="rec-sum">売値の合計 <b>${yen(sum)}</b> 文${best?`　いちばんの刀：${best.name}（${starStr(best.stars)}）`:''}</p>
  <ol>${save.swords.map(s=>`<li><span class="no">${s.no}</span><span class="nm"><b>${s.name}</b><small>${R.HAMON_NAME[s.hamon]}・${s.rank}${s.crack?'・割れ':''}</small></span><span class="st s${s.stars}">${starStr(s.stars)}</span><span class="pr">${yen(s.price)}文</span></li>`).join('')}</ol>
 </div>`;
 api.controls([{label:'タイトルへ',primary:true,onClick:showTitle}]);
}

// ---------- canvas, loop, input ----------
function resize(){
 const r=el.stage.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);
 W=Math.max(1,Math.round(r.width));H=Math.max(1,Math.round(r.height));
 el.cv.width=Math.round(W*dpr);el.cv.height=Math.round(H*dpr);setDPR(dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
}
new ResizeObserver(resize).observe(el.stage);
function frame(now){
 const dt=Math.min(0.05,(now-last)/1000);last=now;runTime+=dt;
 if(scene){scene.update(dt);ctx.setTransform(Math.min(2,window.devicePixelRatio||1),0,0,Math.min(2,window.devicePixelRatio||1),0,0);ctx.clearRect(0,0,W,H);scene.draw(ctx,W,H,runTime);}
 requestAnimationFrame(frame);
}
const pt=e=>{const r=el.stage.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top,t:e.timeStamp};};
el.stage.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;S.unlock();el.stage.setPointerCapture?.(e.pointerId);scene?.down(pt(e));});
el.stage.addEventListener('pointermove',e=>scene?.move(pt(e)));
for(const ev of ['pointerup','pointercancel'])el.stage.addEventListener(ev,e=>scene?.up(pt(e)));
let keyDown=false;
addEventListener('keydown',e=>{if(e.code!=='Space'||el.app.dataset.mode!=='forge')return;e.preventDefault();if(e.repeat||keyDown)return;keyDown=true;S.unlock();scene?.down({key:true,t:e.timeStamp});});
addEventListener('keyup',e=>{if(e.code!=='Space')return;keyDown=false;scene?.up({key:true,t:e.timeStamp});});
document.addEventListener('visibilitychange',()=>{if(document.hidden){S.stopBlow();if(keyDown){keyDown=false;scene?.up({key:true,t:performance.now()});}}});
el.sound.onclick=()=>{const v=!S.soundOn();S.setSound(v);save={...save,settings:{...save.settings,sound:v}};writeSave(window.localStorage,save);el.sound.classList.toggle('off',!v);if(v){S.unlock();S.tick();}};
el.sound.classList.toggle('off',!save.settings.sound);

// read-only handle for scripts/play-qa.mjs
window.__tk={scene:()=>scene?.name,qa:()=>scene?.qa?.()??{},stage:()=>el.stage.getBoundingClientRect().toJSON(),run:()=>api.run,save:()=>save};

resize();setFace('normal');
loadArt().finally(()=>{showTitle();requestAnimationFrame(t=>{last=t;frame(t);});});
