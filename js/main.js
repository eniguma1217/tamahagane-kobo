// The app shell: screens (title, form, materials, the forging steps, result, 刀帳, records), the canvas loop, input and the save.
import * as R from './rules.js';
import {loadSave,writeSave,addSword,bestSword,pay,START_MONEY} from './save.js';
import * as S from './sound.js';
import * as D from './draw.js';
import {MEITO} from './meito.js';
import {loadArt,artSrc} from './art.js';
import {Heat,Hammer,Hamon,Quench,Polish,Ambient} from './scenes.js';

const $=s=>document.querySelector(s);
const el={app:$('#app'),bar:$('#bar'),steps:$('#steps'),meter:$('#meter'),stage:$('#stage'),cv:$('#cv'),panel:$('#panel'),pop:$('#pop'),talk:$('#talk'),face:$('#face'),line:$('#line'),controls:$('#controls'),sound:$('#sound')};
const ctx=el.cv.getContext('2d');
const {setDPR}=D;
let save=loadSave(window.localStorage);
S.setSound(save.settings.sound);
let scene=null,timers=[],W=360,H=480,last=performance.now(),runTime=0;

const FORGE=[['heat','熱する'],['hammer','叩く'],['hamon','焼き入れ'],['quench','焼き入れ'],['polish','研ぐ']];
const STEP_NAMES=['素材','熱する','叩く','焼き入れ','研ぐ'];
const MAT_COLOR={hakusai:'#7d6a5a',chikusa:'#e2e8ee',jou:'#c9d3dc',kera:'#7a6f66',nami:'#9aa3ab',nanban:'#7f8ea6',kugi:'#6b4e3d',inseki:'#4a4d57',oroshi:'#8a6a55',houcho:'#5b6470',zuku:'#3d3f45'};
const money=()=>save.money??START_MONEY;

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
 samples(){showSamples();},
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
 const c=MAT_COLOR[id]||'#888',lump=`<path d="M6 26 12 10 26 6 35 16 32 31 17 35z" fill="${c}"/><path d="M12 10 26 6 35 16 22 19z" fill="rgba(255,255,255,0.28)"/><path d="M22 19 17 35 6 26z" fill="rgba(0,0,0,0.22)"/>`;
 const body={
  hakusai:`<path d="M5 14h30l-5 6 5 6H5l5-6z" fill="${c}"/><path d="M5 14h30l-5 6H10z" fill="rgba(255,255,255,0.2)"/>`,
  kugi:[8,18,28].map((x,i)=>`<rect x="${x}" y="${6+i*2}" width="4" height="${26-i*3}" rx="1" fill="${c}"/><rect x="${x-2}" y="${5+i*2}" width="8" height="3" rx="1" fill="#4b362a"/>`).join(''),
  inseki:lump+'<path d="M12 14l14 14M16 10l14 14M10 20l10 10" stroke="rgba(190,200,215,.55)" stroke-width="1.2"/>',
  nanban:`<rect x="5" y="15" width="30" height="11" rx="2" fill="${c}"/><rect x="5" y="15" width="30" height="4" rx="2" fill="rgba(255,255,255,0.25)"/>`,
  chikusa:lump+'<path d="M28 9l1.5 3 3 1.5-3 1.5-1.5 3-1.5-3-3-1.5 3-1.5z" fill="#fff"/>',
  jou:lump+'<path d="M28 9l1.5 3 3 1.5-3 1.5-1.5 3-1.5-3-3-1.5 3-1.5z" fill="#fff"/>'
 }[id]||lump;
 return `<svg viewBox="0 0 40 40" width="${size}" height="${size}" aria-hidden="true">${body}</svg>`;
}
const yen=n=>n.toLocaleString('ja-JP');
const starStr=n=>'★'.repeat(n)+'☆'.repeat(5-n);

// ---------- small pictures of swords (drawn once, kept as images) ----------
const thumbs=new Map(),thumbCv=document.createElement('canvas');
function swordPic(formId,profile,w,h,key,opt={}){
 const k=`${key}:${w}x${h}`;if(thumbs.has(k))return thumbs.get(k);
 const r=Math.min(2,window.devicePixelRatio||1);thumbCv.width=Math.round(w*r);thumbCv.height=Math.round(h*r);
 const g=thumbCv.getContext('2d');g.setTransform(r,0,0,r,0,0);g.clearRect(0,0,w,h);
 D.fullSword(g,formId,{x:2,y:2,w:w-4,h:h-4},{profile,dull:!profile,...opt});
 const url=thumbCv.toDataURL('image/png');thumbs.set(k,url);return url;
}
const meitoProfile=m=>R.canonicalHamon(m.h,[...m.n].reduce((a,c)=>a+c.codePointAt(0),0));
const meitoSori=m=>m.l&&m.so!=null?Math.max(0,Math.min(1.5,m.so/m.l/0.04)):undefined;
const meitoPic=(m,w,h)=>swordPic(m.t,meitoProfile(m),w,h,'m:'+m.n,{sori:meitoSori(m),widScale:w<200?1.5:1.2});
const found=()=>Object.keys(save.collection||{}).length;
const basisText=b=>b.startsWith('資料')?'資料による':b==='作風'?'刀工・流派の作風から':'推定（資料なし）';

function showSamples(){
 const box=document.createElement('div');box.className='overlay';
 box.innerHTML=`<div class="sheet"><h3>刃文の見本 <small>なぞる線の形で決まる</small></h3><div class="sheet-body"><ul class="samples">${Object.entries(R.HAMON).map(([k,v])=>
  `<li><img alt="" src="${swordPic('tachi',R.canonicalHamon(k,7),150,30,'s:'+k,{len:1,widScale:1.6})}"><b>${v.name}<small>${v.kana}</small></b><span>${v.how}</span></li>`).join('')}</ul></div>
  <button class="btn primary" data-close>とじる</button></div>`;
 closable(box);el.panel.append(box);
}

// an overlay closes with its button or a tap on the dark space around it
function closable(box){
 const close=()=>{S.tick();box.remove();};
 box.querySelector('[data-close]').onclick=close;
 // taps on the overlay never reach the blade underneath
 box.addEventListener('pointerdown',e=>{e.stopPropagation();if(e.target===box)close();});
}

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
  <p class="title-money">所持金 ${yen(money())}文</p>
  <div class="menu"><button class="btn primary big" data-go="forge">刀を打つ</button>
  <div class="menu-row"><button class="btn" data-go="zukan">刀帳（${found()}/${MEITO.length}）</button>
  <button class="btn" data-go="records" ${n?'':'disabled'}>打った刀（${n}振）</button></div></div>
 </div>`;
 el.panel.querySelector('[data-go=forge]').onclick=()=>{S.unlock();S.tick();showForms();};
 el.panel.querySelector('[data-go=zukan]').onclick=()=>{S.unlock();S.tick();showZukan();};
 el.panel.querySelector('[data-go=records]').onclick=()=>{S.tick();showRecords();};
}

let pick={form:null,structure:'kobuse',kawa:null,shin:null,ha:null,mune:null,active:'kawa'};
function showForms(){
 mode('forms');steps(0);el.meter.hidden=true;
 setScene(new Ambient(api,'forms','title',{dim:0.78}));
 api.say('まず、<b>何を打つか</b>を決めろ。形ごとに、打てる名刀がちがうぞ。');
 api.controls([{label:'タイトルへ',onClick:showTitle}]);
 el.panel.innerHTML=`<div class="forms-screen"><div class="forms">${R.FORMS.map(f=>{
  const all=MEITO.filter(m=>m.t===f.id),got=all.filter(m=>save.collection[m.n]).length;
  return `<button class="form-card ${pick.form===f.id?'on':''}" data-form="${f.id}"><img alt="" src="${swordPic(f.id,null,160,40,'f:'+f.id+':c',{widScale:1.7})}"><b>${f.name}</b><span>${f.note}</span><small>名刀 ${got}/${all.length}</small></button>`;}).join('')}</div></div>`;
 for(const b of el.panel.querySelectorAll('[data-form]'))b.onclick=()=>{S.unlock();S.tick();pick.form=b.dataset.form;showMaterials();};
}
function showMaterials(){
 if(!pick.form)return showForms();
 mode('materials');steps(0);el.meter.hidden=true;
 setScene(new Ambient(api,'materials','title',{dim:0.8}));
 api.controls([{label:'形を選び直す',onClick:showForms},{label:'これで打つ',primary:true,disabled:true,onClick:startForging}]);
 renderMaterials();
}
const yenOr=n=>n?`${yen(n)}文`:'無料';
function renderMaterials(){
 const st=R.structure(pick.structure);
 if(!st.slots.includes(pick.active))pick.active=st.slots.find(k=>!pick[k])||st.slots[0];
 const ready=R.buildReady(pick),c=ready?R.combine(pick):null,cost=R.buildCost(pick),enough=cost<=money();
 const used=st.slots.filter(k=>pick[k]);
 el.panel.innerHTML=`<div class="mats-screen">
  <div class="structs">${R.STRUCTURES.map(t=>`<button class="chip-btn ${t.id===st.id?'on':''}" data-struct="${t.id}">${t.name}</button>`).join('')}</div>
  <div class="slots">${st.slots.map(k=>{const m=pick[k]?R.material(pick[k]):null;return `<button class="slot ${pick.active===k?'active':''}" data-slot="${k}"><small>${R.SLOTS[k].name}</small><b>${m?m.name:'えらぶ'}</b><em>${R.SLOTS[k].role}</em></button>`;}).join('')}</div>
  <p class="era-line">${eraLine()}</p>
  <div class="mats">${R.MATERIALS.map(m=>{const marks=used.filter(k=>pick[k]===m.id).map(k=>R.SLOTS[k].name[0]).join('');
   return `<button class="mat ${marks?'picked':''}" data-mat="${m.id}"><em class="era-tag ${m.era?'':'none'}">${m.era?R.ERAS[m.era].short:'時代なし'}</em>${matIcon(m.id,24)}<span class="mat-text"><b>${m.name}${marks?`<i>${marks}</i>`:''}</b><small>${yenOr(m.price)}</small></span></button>`;}).join('')}</div>
  <p class="cost-line ${enough?'':'short'}">材料代 <b>${yen(cost)}</b>文　所持金 <b>${yen(money())}</b>文</p>
 </div>`;
 for(const b of el.panel.querySelectorAll('[data-struct]'))b.onclick=()=>{S.tick();pick.structure=b.dataset.struct;renderMaterials();};
 for(const b of el.panel.querySelectorAll('[data-slot]'))b.onclick=()=>{S.tick();pick.active=b.dataset.slot;renderMaterials();};
 for(const b of el.panel.querySelectorAll('[data-mat]'))b.onclick=()=>{S.unlock();S.tick();pick[pick.active]=b.dataset.mat;pick.last=b.dataset.mat;
  const next=st.slots.find(k=>!pick[k]);if(next)pick.active=next;renderMaterials();};
 const go=el.controls.querySelector('.btn.primary');go.disabled=!(ready&&enough);go.textContent=cost?`これで打つ（${yen(cost)}文）`:'これで打つ';
 api.say(materialsTalk(st,c,cost,enough),c&&c.kind!=='gyaku'&&c.era&&enough?'happy':'normal');
}
function materialsTalk(st,c,cost,enough){
 const last=pick.last?R.material(pick.last):null;
 const about=last?`<b>${last.name}</b>：${last.note}。硬さ${last.hard}・粘り${last.tough}・美しさ${last.beauty}。`:'';
 if(!c)return about+(pick.active?`次は<b>${R.SLOTS[pick.active].name}</b>だ（${R.SLOTS[pick.active].role}）。`:'');
 if(!enough)return `材料代が足りない。無料の<b>卸し鉄・包丁鉄</b>なら、いつでも打てるぞ。`;
 if(c.kind==='gyaku')return 'おいおい、あべこべだ。皮がやわらかいと刃がなまくらになる。名刀にはならないぞ。';
 if(!c.era)return `${c.kawa.name}の皮鉄には時代の札がない。打てるが、名刀にはならないぞ。`;
 if(c.kawa.id==='inseki')return `隕鉄はやわらかい。榎本武揚の流星刀は、<b>玉鋼をまぜて</b>打ったそうだ。`;
 return `${c.kawa.name}の皮鉄で、<b>${R.ERAS[c.era].long}</b>の地鉄になる。${st.id==='shiho'?'四方詰めは手間だが、いい刀になりやすい。':st.id==='sanmai'?'刃鉄が切れ味を決めるぞ。':''}`;
}

function eraLine(){
 const F=R.form(pick.form).name;
 if(!R.buildReady(pick))return `打つ形：<b>${F}</b>　${R.structure(pick.structure).note}`;
 const c=R.combine(pick),era=c.era;
 if(!era)return `打つ形：<b>${F}</b>　地鉄：${c.kind==='gyaku'?'あべこべ':'時代なし'}（名刀にならない）`;
 const all=MEITO.filter(m=>m.t===pick.form&&m.e===era),got=all.filter(m=>save.collection[m.n]).length;
 return `打つ形：<b>${F}</b>　地鉄：<b>${R.ERAS[era].long}</b>　この名刀 ${got}/${all.length}`;
}
let forgeIndex=-1;
function startForging(){
 const build={structure:pick.structure,...Object.fromEntries(R.structure(pick.structure).slots.map(k=>[k,pick[k]]))};
 const paid=pay(save,R.buildCost(build));if(!paid)return;
 save=paid;writeSave(window.localStorage,save);
 api.run={form:pick.form,...build};forgeIndex=-1;el.panel.innerHTML='';forgeNext();
}
function forgeNext(){
 forgeIndex++;
 if(forgeIndex>=FORGE.length)return showResult();
 const [name]=FORGE[forgeIndex];mode('forge');el.panel.innerHTML='';
 steps(STEP_NAMES.indexOf(FORGE[forgeIndex][1]));api.progress(null);
 el.stage.classList.remove('fade');void el.stage.offsetWidth;el.stage.classList.add('fade');
 setScene(new ({heat:Heat,hammer:Hammer,hamon:Hamon,quench:Quench,polish:Polish}[name])(api));
}

function showResult(){
 const sword=R.finishSword(api.run,MEITO,save.collection);
 const isNew=!!sword.meito&&!save.collection[sword.meito];
 save=addSword(save,sword);writeSave(window.localStorage,save);
 mode('result');setScene(new Ambient(api,'result','plain',{sword,dim:0.2}));S.phrase(sword.meito?Math.max(4,sword.stars):sword.stars);
 const g=api.run,chip=(k,v)=>`<span><small>${k}</small>${v}</span>`,m=sword.meito?MEITO.find(x=>x.n===sword.meito):null;
 const hits=(g.hitGrades||[]).filter(x=>x==='best').length,F=R.form(sword.form).name;
 el.panel.innerHTML=`<div class="result">
  <div class="sword-space"></div>
  ${m?`<p class="meito-badge">${isNew?'<b>NEW</b>':''}名刀を打ち上げた！</p>`:''}
  <h2 class="mei">${sword.name}${m?`<small>${m.k}</small>`:''}</h2>
  <p class="tags">${m?`${F}・${R.ERAS[m.e].long}・${m.s}　<b class="des">${m.d}</b>`:`${R.HAMON_NAME[sword.hamon]}・${{kobuse:'甲伏せ',maru:'丸鍛え',sanmai:'本三枚',shiho:'四方詰め',gyaku:'あべこべ'}[sword.combo]}（${[sword.kawa,sword.shin,sword.ha,sword.mune].filter(Boolean).map(id=>R.material(id).name).join('＋')}）`}${sword.crack?'・<b class="bad">焼き割れ</b>':''}</p>
  ${m?`<p class="desc">${m.x}</p>`:`<p class="hint">${sword.hint}</p>`}
  <div class="stars s${sword.stars}">${starStr(sword.stars)}<span>${sword.rank}</span><em>成功 ${sword.successes}/${R.SUCCESS_MAX}</em></div>
  <div class="stats">${[['切れ味','sharp'],['粘り','tough'],['美しさ','beauty']].map(([n,k])=>`<div><small>${n}</small><i><b style="width:${sword.stats[k]}%"></b></i><em>${sword.stats[k]}</em></div>`).join('')}</div>
  <p class="price">売値 <b>${yen(sword.price)}</b> 文<small>所持金 ${yen(money())}文</small></p>
  <div class="chips">${chip('熱する',g.heat.label)}${chip('叩く',`会心${hits}/12`)}${chip('土置き',g.hamon.name)}${chip('焼き入れ',g.quench.label)}${chip('研ぐ',g.polish.scratches?`キズ${g.polish.scratches}`:g.polish.coverage>=0.985?'会心':`曇り${Math.round((1-g.polish.coverage)*100)}%`)}</div>
  ${m?'':`<p class="comment">${resultComment(sword)}</p>`}
 </div>`;
 api.controls([{label:'刀帳',onClick:()=>showZukan(sword.meito)},{label:'もう一振り',primary:true,onClick:showForms}]);
 api.swordTop=()=>{const s=el.panel.querySelector('.sword-space');if(!s)return null;const a=s.getBoundingClientRect(),b=el.stage.getBoundingClientRect();return a.top-b.top+a.height/2;};
 if(isNew)api.pop('名刀','best');
}

// ---------- 刀帳 ----------
let zukanFilter='all';
function showZukan(open=null){
 mode('zukan');setScene(new Ambient(api,'zukan','plain',{dim:0.5}));
 api.controls([{label:'タイトルへ',primary:true,onClick:showTitle}]);
 renderZukan();
 if(open)showMeito(open);
}
function renderZukan(){
 const list=MEITO.filter(m=>zukanFilter==='all'||m.t===zukanFilter);
 const got=list.filter(m=>save.collection[m.n]).length;
 el.panel.innerHTML=`<div class="zukan">
  <h2>刀帳 <small>${found()}/${MEITO.length}振</small></h2>
  <div class="filters">${[['all','全部'],...R.FORMS.map(f=>[f.id,f.name])].map(([id,n])=>`<button class="chip-btn ${zukanFilter===id?'on':''}" data-filter="${id}">${n}</button>`).join('')}</div>
  <p class="zukan-sum">${zukanFilter==='all'?'すべて':R.form(zukanFilter).name}：${got}/${list.length}振</p>
  <ul class="zgrid">${list.map(m=>{const c=save.collection[m.n];return `<li><button class="zcell ${c?'got':''}" data-meito="${m.n}">
   <span class="zpic" data-pic="${m.n}"></span><b>${c?m.n:'？？？'}</b><small>${R.form(m.t).name}・${R.ERAS[m.e].name}${m.r>=4?`・${m.r>=5?'★':''}${m.d}`:''}</small></button></li>`;}).join('')}</ul>
 </div>`;
 for(const b of el.panel.querySelectorAll('[data-filter]'))b.onclick=()=>{S.tick();zukanFilter=b.dataset.filter;renderZukan();};
 for(const b of el.panel.querySelectorAll('[data-meito]'))b.onclick=()=>{S.tick();showMeito(b.dataset.meito);};
 // pictures only for the cells that come into view
 const io=new IntersectionObserver(es=>{for(const e of es){if(!e.isIntersecting)continue;const sp=e.target,m=MEITO.find(x=>x.n===sp.dataset.pic);
  sp.innerHTML=`<img alt="" src="${save.collection[m.n]?meitoPic(m,140,30):swordPic(m.t,null,140,30,'f:'+m.t+':s',{widScale:1.5})}">`;io.unobserve(sp);}},{root:el.panel.querySelector('.zgrid')});
 for(const sp of el.panel.querySelectorAll('[data-pic]'))io.observe(sp);
}
function showMeito(name){
 const m=MEITO.find(x=>x.n===name);if(!m)return;
 const c=save.collection[m.n],F=R.form(m.t).name;
 const box=document.createElement('div');box.className='overlay';
 const size=[m.l?`刃長 ${m.l}cm`:'',m.so?`反り ${m.so}cm`:''].filter(Boolean).join('・');
 box.innerHTML=`<div class="sheet meito-sheet"><div class="sheet-body">
  <img class="big-pic" alt="" src="${c?meitoPic(m,320,56):swordPic(m.t,null,320,56,'f:'+m.t+':b')}">
  ${c?`<h3>${m.n}<small>${m.k}</small></h3>
   <p class="mtags">${F}・${R.ERAS[m.e].long}・${m.s}${m.sc?`（${m.sc}）`:''}<br><b>${m.d}</b>${size?`・${size}`:''}</p>
   <p class="mhamon">刃文：<b>${R.HAMON[m.h].name}</b>（${basisText(m.b)}）</p>
   <p class="desc">${m.x}</p>
   <p class="mfound">はじめて打った日：${new Date(c.first).toLocaleDateString('ja-JP')}　打った数：${c.count}振</p>`
  :`<h3>？？？<small>まだ打っていない</small></h3>
   <p class="mtags">${F}・${R.ERAS[m.e].long}</p>
   <ul class="mhint"><li>形：<b>${F}</b></li><li>素材：<b>${R.comboText(m.e,m.mat)}</b></li><li>刃文：<b>${R.HAMON[m.h].name}</b>（${R.HAMON[m.h].how}）</li><li>成功：<b>${R.NEED[m.r]}/${R.SUCCESS_MAX}以上</b></li></ul>`}
  </div><button class="btn primary" data-close>とじる</button></div>`;
 closable(box);el.panel.append(box);
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
  <ol>${save.swords.map(s=>`<li><span class="no">${s.no}</span><span class="nm"><b>${s.name}</b><small>${s.meito?'名刀・':''}${R.HAMON_NAME[s.hamon]||''}・${s.rank}${s.crack?'・割れ':''}</small></span><span class="st s${s.stars}">${starStr(s.stars)}</span><span class="pr">${yen(s.price)}文</span></li>`).join('')}</ol>
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
