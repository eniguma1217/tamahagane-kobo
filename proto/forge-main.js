// #74 (owner: 「刀作りは前のやり方の方がよかった」→ ふいごで熱する・刃文を自由に描く・自分で焼き入れ、叩くのも工房の絵と親方も本編のまま):
// the 名刀 of the 道場 are forged with the main game's own steps (dist/js/scenes.js: 熱する → 叩く → 刃文 → 焼き入れ, 研ぎは自動),
// in an overlay over the phone. The steel is 並玉鋼 (the dojo's 炭4・砂鉄4, made into steel in a たたら), or 上玉鋼 with the
// 御前試合's 玉鋼; the real sword it becomes is picked by the main game's own rules. Nothing here reads or writes the main game's save.
import * as R from '../js/rules.js';
import * as S from '../js/sound.js';
import * as D from '../js/draw.js';
import {MEITO} from '../js/meito.js';
import {loadArt,artSrc} from '../js/art.js';
import {Heat,Hammer,Hamon,Quench} from '../js/scenes.js';

const $=s=>document.querySelector(s);
const FLOW=[['heat',0],['hammer',0],['hamon',1],['quench',2]],STEP_NAMES=['熱して叩く','刃文','焼き入れ'];
const SCENES={heat:Heat,hammer:Hammer,hamon:Hamon,quench:Quench};
const FACE='<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="24" fill="#3a2a20"/><ellipse cx="24" cy="26" rx="13" ry="15" fill="#e0b48a"/><rect x="10" y="13" width="28" height="5" rx="2" fill="#2b3a55"/></svg>';
let el=null,ctx=null,scene=null,timers=[],index=-1,W=360,H=400,last=0,runTime=0,live=false,finish=null,collection={},art=null;

const api={
 run:null,foresee:null,swordTop:()=>null,
 say(html,mood='normal'){el.line.innerHTML=html;const src=artSrc(mood==='happy'?'oyakata-happy':'oyakata')||artSrc('oyakata');el.face.innerHTML=src?`<img src="${src}" alt="">`:FACE;},
 pop(text,grade='info'){el.pop.textContent=text;el.pop.className='';void el.pop.offsetWidth;el.pop.className='show g-'+grade;},
 later(ms,fn){const id=setTimeout(()=>{timers=timers.filter(t=>t!==id);fn();},ms);timers.push(id);},
 controls(list){
  el.controls.replaceChildren(...list.map(b=>{
   const n=document.createElement('button');n.className='btn'+(b.primary?' main':'')+(b.hold?' hold':'');n.textContent=b.label;n.disabled=!!b.disabled;
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
 next(){next();},
 samples(){samples();}
};

function setScene(s){for(const t of timers)clearTimeout(t);timers=[];S.stopBlow();scene=s;s.enter?.();}
function steps(i){el.steps.innerHTML=STEP_NAMES.map((n,k)=>`<span class="${k<i?'done':k===i?'now':''}">${n}</span>`).join('<i>›</i>');}
function next(){
 index++;
 if(index>=FLOW.length)return done(R.finishSword(api.run,MEITO,collection));
 const [name,step]=FLOW[index];el.panel.innerHTML='';steps(step);api.progress(null);
 setScene(new SCENES[name](api));
}
function done(sword){
 live=false;setScene({name:null,update(){},draw(){},down(){},move(){},up(){}});scene=null;el.root.hidden=true;
 const f=finish;finish=null;
 f?.(sword?{sword,info:sword.meito?MEITO.find(m=>m.n===sword.meito)||null:null,hamonName:R.HAMON_NAME[sword.hamon]||'',eraName:sword.meito?R.ERAS[MEITO.find(m=>m.n===sword.meito)?.e]?.long||'':''}:null);
}
// 刃文の見本: the eight kinds the line can make
function samples(){
 const cv=document.createElement('canvas'),pic=type=>{const w=150,h=30,r=Math.min(2,devicePixelRatio||1);cv.width=w*r;cv.height=h*r;const g=cv.getContext('2d');g.setTransform(r,0,0,r,0,0);g.clearRect(0,0,w,h);D.fullSword(g,'tachi',{x:2,y:2,w:w-4,h:h-4},{profile:R.canonicalHamon(type,7),len:1,widScale:1.6});return cv.toDataURL('image/png');};
 const box=document.createElement('div');box.className='mf-sheet';
 box.innerHTML=`<div class="in"><b>刃文の見本</b><span class="small">なぞる線の形で決まる</span><ul>${Object.entries(R.HAMON).map(([k,v])=>`<li><img alt="" src="${pic(k)}"><span><b>${v.name}</b> ${v.how}</span></li>`).join('')}</ul><button class="btn main" data-close>とじる</button></div>`;
 box.querySelector('[data-close]').onclick=()=>{S.tick();box.remove();};
 box.addEventListener('pointerdown',e=>{e.stopPropagation();if(e.target===box)box.remove();});
 el.panel.append(box);
}
function resize(){
 const r=el.stage.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1);
 W=Math.max(1,Math.round(r.width));H=Math.max(1,Math.round(r.height));
 el.cv.width=Math.round(W*dpr);el.cv.height=Math.round(H*dpr);D.setDPR(dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
}
function frame(now){
 if(!live)return;const dt=Math.min(0.05,(now-last)/1000);last=now;runTime+=dt;
 if(scene){scene.update(dt);const d=Math.min(2,devicePixelRatio||1);ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,W,H);scene.draw(ctx,W,H,runTime);}
 requestAnimationFrame(frame);
}
function wire(){
 el={root:$('#mforge'),steps:$('#mfSteps'),meter:$('#mfMeter'),stage:$('#mfStage'),cv:$('#mfCv'),panel:$('#mfPanel'),pop:$('#mfPop'),face:$('#mfFace'),line:$('#mfLine'),controls:$('#mfCtl'),close:$('#mfClose')};
 ctx=el.cv.getContext('2d');
 new ResizeObserver(()=>{if(live)resize();}).observe(el.stage);
 const pt=e=>{const r=el.stage.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top,t:e.timeStamp};};
 el.stage.addEventListener('pointerdown',e=>{if(e.target.closest('button,.mf-sheet'))return;S.unlock();el.stage.setPointerCapture?.(e.pointerId);scene?.down(pt(e));});
 el.stage.addEventListener('pointermove',e=>scene?.move(pt(e)));
 for(const ev of ['pointerup','pointercancel'])el.stage.addEventListener(ev,e=>scene?.up(pt(e)));
 let key=false;
 addEventListener('keydown',e=>{if(!live||e.code!=='Space')return;e.preventDefault();if(e.repeat||key)return;key=true;S.unlock();scene?.down({key:true,t:e.timeStamp});});
 addEventListener('keyup',e=>{if(!live||e.code!=='Space')return;key=false;scene?.up({key:true,t:e.timeStamp});});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)S.stopBlow();});
 el.close.onclick=()=>{S.tick();done(null);};
}

// start({form: a main-game form id, kawa: 'nami'|'jou', collection: {名刀の名: true}}) → Promise of {sword, info, hamonName, eraName} or null (やめた)
async function start({form,kawa,collection:have={}}){
 if(!el)wire();
 art??=loadArt('../assets/').catch(()=>[]);await art;
 collection=have;api.run={form,structure:'maru',kawa};
 api.foresee=()=>R.rareOf(R.finishSword(api.run,MEITO,collection));
 el.root.hidden=false;live=true;resize();index=-1;runTime=0;
 return new Promise(ok=>{finish=ok;next();last=performance.now();requestAnimationFrame(frame);});
}

window.MainForge={start};
// read-only handle for scripts/machi-qa.mjs (the same shape as the main game's __tk)
window.__mf={scene:()=>scene?.name??null,qa:()=>scene?.qa?.()??{},stage:()=>el?.stage.getBoundingClientRect().toJSON(),run:()=>api.run,live:()=>live};
