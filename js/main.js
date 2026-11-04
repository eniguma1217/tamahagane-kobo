// The app shell (#19): the 工房 (title), forging (form, steel, three steps, result), the 刀掛け, the dives, the requests,
// the 刀帳, the 相性帳 and the records; the canvas loop, input and the save.
import * as R from './rules.js';
import {loadSave,writeSave,addSword,bestSword,takeSteel,addLoot,migrateRack,START_MONEY} from './save.js';
import * as M from './market.js';
import * as O from './orders.js';
import * as P from './people.js';
import * as V from './dive.js';
import * as S from './sound.js';
import * as D from './draw.js';
import {MEITO} from './meito.js';
import {loadArt,artSrc,artUrl} from './art.js';
import {Heat,Hammer,Hamon,Quench,Ambient} from './scenes.js';

const $=s=>document.querySelector(s);
const el={app:$('#app'),bar:$('#bar'),steps:$('#steps'),meter:$('#meter'),stage:$('#stage'),cv:$('#cv'),panel:$('#panel'),pop:$('#pop'),talk:$('#talk'),face:$('#face'),line:$('#line'),controls:$('#controls'),sound:$('#sound')};
const ctx=el.cv.getContext('2d');
const {setDPR}=D;
let save=loadSave(window.localStorage),notice=null;
{const m=migrateRack(save);if(m.save!==save){save=m.save;notice=m.notice;writeSave(window.localStorage,save);}}
S.setSound(save.settings.sound);
let scene=null,timers=[],W=360,H=480,last=performance.now(),runTime=0;

// #17 (D39): three steps in about 30 seconds; the polishing is done by the 弟子
const FORGE=[['heat','熱して叩く'],['hammer','熱して叩く'],['hamon','刃文'],['quench','焼き入れ']];
const STEP_NAMES=['素材','熱して叩く','刃文','焼き入れ'];
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
const gradeOf=s=>s.grade?R.GRADES.find(g=>g.id===s.grade):R.gradeFor(s.overall??0,s.crack);
const gradeBadge=(g,big=false)=>`<span class="grade g-${g.id}${big?' big':''}"><b>${g.id}</b>${g.name}</span>`;
const meitoBadge=r=>`<span class="mrank" style="--c:${R.MEITO_RANK[r].color}">${R.MEITO_RANK[r].name}</span>`;

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
function closable(box,onClose){
 const close=()=>{S.tick();box.remove();onClose?.();};
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

function showNotice(text){
 const box=document.createElement('div');box.className='overlay';
 box.innerHTML=`<div class="sheet rankup"><p class="rankup-head">お知らせ</p><p class="mtags">${text}</p><button class="btn primary" data-close>とじる</button></div>`;
 closable(box);el.panel.append(box);
}
const rngAt=seq=>R.seededRandom(seq*7919+13);
const rngNext=()=>{const r=rngAt(save.seq||1);save={...save,seq:(save.seq||1)+1};return r;};
const fameNow=()=>M.fameLevel(save.fame||0);
const openNow=()=>R.openAt(fameNow().index);
const pct=x=>Math.round(x*100);
const foundSyn=()=>Object.keys(save.synergies||{}).length;
const rack=()=>save.rack||[];
const matCount=()=>Object.values(save.materials||{}).reduce((t,n)=>t+n,0);
const pips=(n,max)=>`<span class="pips">${'●'.repeat(Math.max(0,n))}<i>${'●'.repeat(Math.max(0,max-n))}</i></span>`;
const statLine=(st,hi=null)=>`<span class="cst">${['sharp','tough','beauty'].map(k=>`<i class="${hi===k?'hit':''}">${{sharp:'切',tough:'粘',beauty:'美'}[k]}${st?.[k]??0}</i>`).join('')}</span>`;
function save_(){writeSave(window.localStorage,save);}

// ---------- 工房（タイトル）----------
function showTitle(){
 mode('title');setScene(new Ambient(api,'title','title'));
 const n=save.forged||0,F=fameNow(),orders=(save.orders||[]).length;
 el.panel.innerHTML=`<div class="title">
  <div class="title-name"><h1>玉鋼工房</h1><span class="seal">工房</span></div>
  <p class="title-sub">たまはがね こうぼう</p>
  <p class="title-money">所持金 ${yen(money())}文　素材 ${matCount()}</p>
  <p class="title-rank">評判 <b>Lv${F.lv} ${F.name}</b>${F.next?`<small>次の「${F.next}」まで あと${yen(F.toNext)}</small>`:''}</p>
  <div class="menu"><div class="menu-row two"><button class="btn primary big" data-go="forge">刀を打つ</button><button class="btn primary big" data-go="dive">${save.dive?'出陣の続き':'出陣する'}</button></div>
  <div class="menu-row"><button class="btn" data-go="orders">依頼 ${orders}</button><button class="btn" data-go="rack">刀掛け ${rack().length}/${V.RACK_MAX}</button><button class="btn" data-go="zukan">刀帳 ${found()}</button></div>
  <div class="menu-row"><button class="btn" data-go="aisho">相性帳 ${foundSyn()}/${R.SYNERGIES.length}</button><button class="btn" data-go="records" ${n?'':'disabled'}>記録</button></div></div>
 </div>`;
 const go={forge:showForms,dive:()=>save.dive?showDive():showDivePrep(),orders:showOrders,rack:showRack,zukan:()=>showZukan(),aisho:()=>showAisho(showTitle),records:showRecords};
 for(const b of el.panel.querySelectorAll('[data-go]'))b.onclick=()=>{S.unlock();S.tick();go[b.dataset.go]();};
 if(notice){const t=notice;notice=null;showNotice(t);}
}

// ---------- 刀を打つ：形 → 素材 → 3工程 ----------
let pick={form:null,kawa:null,shin:null,active:'kawa',last:null};
function showForms(form){
 if(rack().length>=V.RACK_MAX){showTitle();return showNotice(`刀掛けがいっぱいだ（${V.RACK_MAX}振）。出陣で使うか、依頼に納めるか、刀掛けで手放してから打とう。`);}
 if(form){pick.form=form;return showMaterials();}
 mode('forms');steps(0);el.meter.hidden=true;
 setScene(new Ambient(api,'forms','title',{dim:0.78}));
 api.say('何を打つ？ 形ごとに打てる名刀がちがう。依頼に合わせるなら、その形を。');
 api.controls([{label:'工房へ',onClick:showTitle}]);
 const open=openNow();
 el.panel.innerHTML=`<div class="forms-screen"><div class="forms">${R.FORMS.map(f=>{
  const all=MEITO.filter(m=>m.t===f.id),got=all.filter(m=>save.collection[m.n]).length,lk=!open.forms.has(f.id);
  const asked=(save.orders||[]).some(o=>o.form===f.id);
  return `<button class="form-card ${lk?'locked':''}" data-form="${f.id}" ${lk?`data-lock="${R.opensAt('forms',f.id)}"`:''}>${lk?`<em class="lock">🔒評判Lv${R.opensAt('forms',f.id)+1}</em>`:asked?'<em class="lock asked">依頼</em>':''}<img alt="" src="${swordPic(f.id,null,120,26,'f:'+f.id,{widScale:1.5})}"><b>${f.name}</b><span>${f.note}</span><small>名刀 ${got}/${all.length}</small></button>`;}).join('')}</div></div>`;
 for(const b of el.panel.querySelectorAll('[data-form]'))b.onclick=()=>{S.unlock();S.tick();
  if(b.dataset.lock)return api.say(`${R.form(b.dataset.form).name}は、評判が <b>Lv${+b.dataset.lock+1}</b> になると打てる。`);
  pick.form=b.dataset.form;showMaterials();};
}
const buildOf=()=>({structure:pick.kawa&&pick.kawa===pick.shin?'maru':'kobuse',kawa:pick.kawa,shin:pick.kawa===pick.shin?undefined:pick.shin});
// can this steel be had now: in hand (count), or at the shop (price), or only from the dives
function steelState(id,need=1){const have=(save.materials||{})[id]||0;if(have>=need)return {have,ok:true};if(id in V.SHOP)return {have,ok:true,price:V.SHOP[id]};return {have,ok:false};}
function steelCost(mats){const m={...(save.materials||{})};let c=0;for(const id of mats){if(m[id]>0)m[id]--;else if(id in V.SHOP)c+=V.SHOP[id];else return null;}return c;}
function showMaterials(){
 if(!pick.form)return showForms();
 mode('materials');steps(0);el.meter.hidden=true;
 setScene(new Ambient(api,'materials','title',{dim:0.8}));
 api.controls([{label:'戻る',onClick:()=>showForms()},{label:'打つ',primary:true,disabled:true,onClick:startForging}]);
 renderMaterials();
}
function renderMaterials(){
 const ready=!!(pick.kawa&&pick.shin),build=buildOf(),c=ready?R.combine(build):null,mats=ready?R.buildMats(build):[];
 const cost=ready?steelCost(mats):0,enough=cost!==null&&cost<=money();
 const syn=ready?R.synergyOf(pick.kawa,pick.shin,pick.form):null,known=syn&&save.synergies?.[syn.id];
 const ex=ready?R.expectStats(build,pick.form,0.8,known?syn:null):null,best=ready?R.expectStats(build,pick.form,1,known?syn:null):null;
 el.panel.innerHTML=`<div class="mats-screen">
  <div class="slots">${['kawa','shin'].map(k=>{const m=pick[k]?R.material(pick[k]):null;return `<button class="slot ${pick.active===k?'active':''}" data-slot="${k}"><small>${R.SLOTS[k].name}</small><b>${m?m.name:'えらぶ'}</b><em>${R.SLOTS[k].role}</em></button>`;}).join('')}</div>
  <p class="era-line">${eraLine(c,syn,known)}</p>
  ${ex?`<div class="statpv">${['sharp','tough','beauty'].map(k=>`<div><small>${O.STAT_NAME[k]}</small><i><b style="width:${ex[k]}%"></b><u style="width:${best[k]}%"></u></i><em>${ex[k]}</em></div>`).join('')}<p class="dur-pv">耐久 ${pips(V.maxDurability({stats:ex}),V.maxDurability({stats:best}))}　鎧に${ex.sharp>=70?'◎':ex.sharp>=50?'○':'△'}・獣に${ex.tough>=70?'◎':ex.tough>=50?'○':'△'}・もののけに${ex.beauty>=70?'◎':ex.beauty>=50?'○':'△'}</p></div>`:''}
  <div class="mats">${R.MATERIALS.map(m=>{const marks=['kawa','shin'].filter(k=>pick[k]===m.id).map(k=>R.SLOTS[k].name[0]).join('');const st=steelState(m.id);
   return `<button class="mat ${marks?'picked':''} ${st.ok?'':'locked'}" data-mat="${m.id}" ${st.ok?'':'data-none="1"'}><em class="era-tag ${m.era?'':'none'}">${m.era?R.ERAS[m.era].short:'時代なし'}</em>${matIcon(m.id,24)}<span class="mat-text"><b>${m.name}${marks?`<i>${marks}</i>`:''}</b><small>${st.have?`<i class="voucher">手持ち${st.have}</i>`:''}${st.price!=null&&!st.have?(st.price?`店 ${yen(st.price)}文`:'店 無料'):st.ok?'':'潜って手に入れる'}</small></span></button>`;}).join('')}</div>
  <p class="cost-line ${enough||!ready?'':'short'}">${ready?(cost===null?'手持ちが足りない':`店で買う分 <b>${yen(cost)}</b>文`):'皮鉄と心鉄を選ぶ'}　所持金 <b>${yen(money())}</b>文</p>
 </div>`;
 for(const b of el.panel.querySelectorAll('[data-slot]'))b.onclick=()=>{S.tick();pick.active=b.dataset.slot;renderMaterials();};
 for(const b of el.panel.querySelectorAll('[data-mat]'))b.onclick=()=>{S.unlock();S.tick();
  if(b.dataset.none)return api.say(`${R.material(b.dataset.mat).name}は店にない。<b>出陣</b>して手に入れよう。`);
  pick[pick.active]=b.dataset.mat;pick.last=b.dataset.mat;pick.active=pick.active==='kawa'?'shin':'kawa';if(pick.kawa&&!pick.shin)pick.active='shin';renderMaterials();};
 const go=el.controls.querySelectorAll('.btn')[1];
 go.disabled=!(ready&&enough);go.textContent=ready&&cost?`打つ（${yen(cost)}文）`:'打つ';
 api.say(materialsTalk(c,syn,known,ready,cost,enough),c&&c.kind!=='gyaku'&&enough?'happy':'normal');
}
function materialsTalk(c,syn,known,ready,cost,enough){
 const last=pick.last?R.material(pick.last):null;
 const about=last?`<b>${last.name}</b>：${last.note}。硬さ${last.hard}・粘り${last.tough}・美しさ${last.beauty}。`:'<b>皮鉄</b>（外側。地鉄の時代と美しさ）と<b>心鉄</b>（芯。粘り）を選べ。粘りが高いほど、戦で長もちするぞ。';
 if(!c)return about;
 if(cost===null)return '手持ちの素材が足りない。同じ素材を2つ使うなら、2つ要るぞ。';
 if(!enough)return `お金が足りない。無料の<b>卸し鉄・包丁鉄</b>なら、いつでも打てる。`;
 if(c.kind==='gyaku')return 'おいおい、あべこべだ。皮がやわらかいと刃がなまくらになる。名刀にもならないぞ。';
 if(syn&&known)return `<b>${syn.name}</b>の組み合わせだ。${about}`;
 return about+(c.era?'':'この皮鉄には時代の札がない。名刀にはならないぞ。');
}
function eraLine(c,syn,known){
 const F=R.form(pick.form).name;
 if(!c)return `打つ形：<b>${F}</b>　${pick.active==='kawa'?'皮鉄':'心鉄'}を選ぶ`;
 const era=c.era?`地鉄：<b>${R.ERAS[c.era].long}</b>`:`地鉄：${c.kind==='gyaku'?'あべこべ':'時代なし'}（名刀にならない）`;
 return `打つ形：<b>${F}</b>　${era}${known?`　<span class="syn">相性「${syn.name}」</span>`:''}`;
}
let forgeIndex=-1;
function startForging(){
 const build=buildOf(),paid=takeSteel(save,R.buildMats(build),V.SHOP);if(!paid)return;
 const {cost,bought,...rest}=paid;save=rest;save_();
 const want=(save.orders||[]).find(o=>o.real&&o.form===pick.form)?.meito||null;
 api.run={form:pick.form,want,...build};forgeIndex=-1;el.panel.innerHTML='';forgeNext();
}
function forgeNext(){
 forgeIndex++;
 if(forgeIndex>=FORGE.length)return showResult();
 const [name]=FORGE[forgeIndex];mode('forge');el.panel.innerHTML='';
 steps(STEP_NAMES.indexOf(FORGE[forgeIndex][1]));api.progress(null);
 el.stage.classList.remove('fade');void el.stage.offsetWidth;el.stage.classList.add('fade');
 setScene(new ({heat:Heat,hammer:Hammer,hamon:Hamon,quench:Quench}[name])(api));
}
function showResult(){
 const sword0=R.finishSword(api.run,MEITO,save.collection),sword={...sword0,dur:V.maxDurability(sword0)};
 const isNew=!!sword.meito&&!save.collection[sword.meito],synNew=!!sword.synergy&&!save.synergies?.[sword.synergy];
 save=addSword(save,sword);save_();
 mode('result');setScene(new Ambient(api,'result','plain',{sword,dim:0.2}));S.phrase(sword.meito?5:sword.stars);
 const g=api.run,m=sword.meito?MEITO.find(x=>x.n===sword.meito):null,syn=sword.synergy?R.SYNERGIES.find(x=>x.id===sword.synergy):null,F=R.form(sword.form).name;
 const fits=(save.orders||[]).map(o=>({o,r:O.evaluateOrder(o,sword)})).filter(x=>x.r.stars>=2);
 el.panel.innerHTML=`<div class="result">
  <div class="sword-space"></div>
  ${m?`<p class="meito-badge">${isNew?'<b>NEW</b>':''}名刀を打ち上げた！</p>`:''}
  <h2 class="mei">${sword.name}${m?`<small>${m.k}</small>`:''}</h2>
  <p class="tags">${m?`${F}・${R.ERAS[m.e].long}・${m.s}`:`${R.HAMON_NAME[sword.hamon]}・${[sword.kawa,sword.shin].filter(Boolean).map(id=>R.material(id).name).join('＋')}`}${sword.crack?'・<b class="bad">焼き割れ</b>':''}</p>
  <div class="grade-row">${gradeBadge(gradeOf(sword),true)}${m?meitoBadge(m.r):''}<em>技 ${sword.successes}/${R.SUCCESS_MAX}</em></div>
  <div class="stats">${[['切れ味','sharp'],['粘り','tough'],['美しさ','beauty']].map(([n,k])=>`<div><small>${n}</small><i><b style="width:${sword.stats[k]}%"></b></i><em>${sword.stats[k]}</em></div>`).join('')}</div>
  <p class="dur-line">耐久 ${pips(sword.dur,sword.dur)}　刀掛け ${rack().length}/${V.RACK_MAX}</p>
  ${syn&&synNew?`<p class="syn-new">相性を見つけた！ 「<b>${syn.name}</b>」（${R.material(syn.kawa).name}×${R.material(syn.shin).name}）</p>`:''}
  ${fits.length?`<p class="fit-line">依頼に合う：${fits.map(x=>`${x.o.meito?`名刀「${x.o.meito}」`:P.personOf(x.o).name}（${O.STARS_NAME[x.r.stars]}）`).join('・')} <button class="btn small primary" data-goorders>依頼に納める</button></p>`:''}
  ${m?'':`<p class="comment">${resultComment(sword)}</p>`}
 </div>`;
 api.controls([{label:'工房へ',onClick:showTitle},{label:'出陣へ',onClick:showDivePrep},{label:'もう一振り',primary:true,onClick:()=>showForms()}]);
 el.panel.querySelector('[data-goorders]')?.addEventListener('click',()=>{S.tick();showOrders();});
 api.swordTop=()=>{const s=el.panel.querySelector('.sword-space');if(!s)return null;const a=s.getBoundingClientRect(),b=el.stage.getBoundingClientRect();return a.top-b.top+a.height/2;};
 if(isNew)api.pop('名刀','best');else if(synNew)api.pop('相性発見','best');
}

// ---------- 刀掛け ----------
let rackPick=null;
function swordRow(s,extra=''){
 const m=s.meito?MEITO.find(x=>x.n===s.meito):null;
 return `<span class="sw"><b>${s.name}</b><small>${gradeBadge(gradeOf(s))}${m?meitoBadge(m.r):''} ${R.form(s.form||'katana').name}${s.hamon?'・'+R.HAMON_NAME[s.hamon]:''}${s.era?'・'+R.ERAS[s.era].name:''}</small><em>${statLine(s.stats)} 耐久 ${pips(V.durOf(s),V.maxDurability(s))}</em>${extra}</span>`;
}
function showRack(){
 mode('shop');setScene(new Ambient(api,'records','plain',{dim:0.5}));
 api.controls([{label:'工房へ',onClick:showTitle},{label:'出陣へ',primary:true,onClick:showDivePrep}]);
 el.panel.innerHTML=`<div class="shop"><div class="shop-head"><b>刀掛け</b><small>${rack().length}/${V.RACK_MAX}振</small></div>
  <p class="mise-note">打った刀はここにかかる。出陣に背負っていく刀や、依頼に納める刀をここから選ぶ。刀は使うと傷み、耐久が尽きると折れる。</p>
  <ul class="kura">${rack().slice().reverse().map(s=>`<li><button class="kura-row ${rackPick===s.no?'on':''}" data-rpick="${s.no}">${swordRow(s)}</button>${rackPick===s.no?`<div class="row"><button class="btn small" data-drop="${s.no}">手放す</button></div>`:''}</li>`).join('')||'<li class="empty">まだ刀がない。工房で打とう。</li>'}</ul></div>`;
 for(const b of el.panel.querySelectorAll('[data-rpick]'))b.onclick=()=>{S.tick();rackPick=rackPick===+b.dataset.rpick?null:+b.dataset.rpick;showRack();};
 for(const b of el.panel.querySelectorAll('[data-drop]'))b.onclick=()=>{S.tick();save={...save,rack:rack().filter(s=>s.no!==+b.dataset.drop)};rackPick=null;save_();showRack();};
}

// ---------- 出陣 (D49〜D51・D53・D56) ----------
let divePlace='touge',carryPick=[];
function showDivePrep(){
 if(save.dive)return showDive();
 const lv=fameNow().index;
 carryPick=carryPick.filter(no=>rack().some(s=>s.no===no));
 if(!V.placesFor(lv).some(p=>p.id===divePlace))divePlace='touge';
 mode('shop');setScene(new Ambient(api,'records',divePlace,{dim:0.55}));
 el.panel.innerHTML=`<div class="shop prep"><div class="shop-head"><b>出陣</b><small>刀を${V.CARRY_MAX}振まで背負っていく</small></div>
  <div class="places">${V.PLACES.map(p=>{const lk=p.fame>lv;return `<button class="place ${divePlace===p.id?'on':''} ${lk?'locked':''}" data-place="${p.id}" ${lk?'disabled':''}${artUrl('bg-'+p.id)?` style="--bg:url(${artUrl('bg-'+p.id)})"`:''}><b>${p.name}</b><small>${lk?`🔒評判Lv${p.fame+1}`:`${p.note}・いちばん深く ${save.deepest?.[p.id]||0}`}</small><em>${p.loot.map(([id])=>R.material(id).name).join('・')}</em></button>`;}).join('')}</div>
  <p class="mise-note">鎧の敵には切れ味、獣には粘り、もののけには美しさが効く。いろいろな刀を持っていこう。</p>
  <ul class="kura pick">${rack().slice().reverse().map(s=>`<li><button class="kura-row ${carryPick.includes(s.no)?'on':''}" data-carry="${s.no}">${swordRow(s,carryPick.includes(s.no)?'<i class="req-hit">背負う</i>':'')}</button></li>`).join('')||'<li class="empty">刀掛けに刀がない。まず刀を打とう。</li>'}</ul></div>`;
 api.controls([{label:'工房へ',onClick:showTitle},{label:`出陣する（${carryPick.length}振）`,primary:true,disabled:!carryPick.length,onClick:startDive}]);
 for(const b of el.panel.querySelectorAll('[data-place]'))b.onclick=()=>{S.tick();divePlace=b.dataset.place;showDivePrep();};
 for(const b of el.panel.querySelectorAll('[data-carry]'))b.onclick=()=>{S.tick();const no=+b.dataset.carry;
  carryPick=carryPick.includes(no)?carryPick.filter(x=>x!==no):carryPick.length<V.CARRY_MAX?[...carryPick,no]:carryPick;showDivePrep();};
}
function startDive(){
 const swords=carryPick.map(no=>rack().find(s=>s.no===no)).filter(Boolean);if(!swords.length)return;
 save={...save,dive:V.startDive(rngNext(),divePlace,swords)};carryPick=[];save_();
 showDive();
}
let diveFlash=null,diveHit=false;
function showDive(){
 const d=save.dive;if(!d)return showTitle();
 mode('shop');setScene(new Ambient(api,'records',d.place,{dim:0.25}));
 const art=artUrl('foe-'+d.foe.key);
 const P_=V.placeOf(d.place),f=d.foe,K=V.KINDS[f.kind],w=K.weak,last=d.log.at(-1);
 const bag=Object.entries(d.bag.mats);
 el.panel.innerHTML=`<div class="shop dive"><div class="shop-head"><b>${P_.name}</b><small>深さ <b class="depth">${d.depth}</b>　戦利品 ${yen(d.bag.money)}文${bag.length?'・'+bag.map(([id,n])=>`${R.material(id).name}${n}`).join('・'):''}</small></div>
  <div class="foe ${f.boss?'boss':''} ${d.won?'down':''} ${diveHit?'hit':''}">${art?`<img class="foe-art" src="${art}" alt="${f.name}">`:`<span class="foe-face">${f.face}</span>`}<div class="foe-body"><p class="foe-name">${f.name}<small>${K.name}</small>${f.boss?'<em>強敵</em>':''}</p>
   <p class="foe-weak">弱点：<b>${V.STAT_NAME[w]}</b>　<small>${K.hint}</small></p><i class="hp"><b style="width:${Math.round(100*f.hp/f.maxHp)}%"></b></i><small>体力 ${f.hp}/${f.maxHp}・強さ ${f.atk}（粘りがこれより低い刀は刃こぼれしやすい）</small></div></div>
  <p class="dive-log">${diveFlash||(last?`${last.sword}で斬った！ ${last.dmg}${last.crit?'（会心）':''}${last.chip?'　刃こぼれ…':''}${last.broke?'　<b class="bad">刀が折れた</b>':''}`:'どの刀で斬る？')}</p>
  ${d.won?`<div class="loot"><p>${f.name}を倒した！</p><p>${d.loot.mats.map(id=>`<b>${R.material(id).name}</b>`).join('・')||'素材はなかった'}・${yen(d.loot.money)}文</p><small>このまま帰れば、すべて持ち帰れる。奥へ進んで刀が尽きると、戦利品の半分を失う。</small></div>`:''}
  ${d.over?`<div class="loot lost"><p>刀が尽きた……</p><small>戦利品の半分を置いて、逃げ帰るしかない。</small></div>`:''}
  <div class="carry">${d.carry.map((c,i)=>`<button class="csw ${c.dur<=0?'broken':''} ${c.stats?.[w]>=70?'good':''}" data-strike="${i}" ${c.dur<=0||d.won||d.over?'disabled':''}><b>${c.name}</b>${statLine(c.stats,w)}<span>${c.dur>0?pips(c.dur,c.max):'<b class="bad">折れた</b>'}</span></button>`).join('')}</div></div>`;
 diveFlash=null;diveHit=false;
 for(const b of el.panel.querySelectorAll('[data-strike]'))b.onclick=()=>{S.unlock();
  const before=save.dive,i=+b.dataset.strike;save={...save,dive:V.strike(save.dive,i,rngNext())};save_();diveHit=true;
  const ev=save.dive.log.at(-1);S.clang(ev?.crit?1.2:0.8);api.pop(`${ev?.dmg??''}`,ev?.crit?'best':'good');
  if(save.dive.won&&!before.won)S.phrase(3);
  showDive();};
 api.controls(d.won?[{label:'帰る',onClick:endDive},{label:'さらに奥へ',primary:true,disabled:!d.carry.some(c=>c.dur>0),onClick:()=>{save={...save,dive:V.goDeeper(save.dive,rngNext())};save_();showDive();}}]
  :d.over?[{label:'逃げ帰る',primary:true,onClick:endDive}]:[{label:'帰る（戦利品はそのまま）',onClick:endDive}]);
}
function endDive(){
 const d=save.dive;if(!d)return showTitle();
 const res=V.finishDive(d),before=fameNow();
 save=addLoot(save,res);
 const deepest={...(save.deepest||{})};deepest[d.place]=Math.max(deepest[d.place]||0,res.depth);
 save={...save,rack:V.returnSwords(rack(),res.carry),dive:null,dives:(save.dives||0)+1,deepest};ensureOrders();save_();
 const broken=res.carry.filter(c=>c.dur<=0);
 showTitle();
 const box=document.createElement('div');box.className='overlay';
 box.innerHTML=`<div class="sheet rankup"><p class="rankup-head">${res.lost?'逃げ帰った……':'無事に帰ってきた'}</p><h3>深さ ${res.depth}</h3>
  <p class="mtags">持ち帰ったもの：<b>${yen(res.money)}文</b>${Object.entries(res.mats).map(([id,n])=>`・<b>${R.material(id).name}×${n}</b>`).join('')}<br>評判 <b>+${res.fame}</b>${broken.length?`<br>折れた刀：${broken.map(c=>c.name).join('・')}`:''}${res.lost?'<br>（戦利品の半分を失った）':''}</p>
  <button class="btn primary" data-close>とじる</button></div>`;
 closable(box,()=>afterFame(before));el.panel.append(box);S.phrase(res.lost?1:4);
}

// ---------- 依頼 (D55) ----------
function ensureOrders(){save=O.fillOrders(save,fameNow().index,MEITO,rngAt);}
function showOrders(){
 ensureOrders();save_();
 mode('shop');setScene(new Ambient(api,'shop','plain',{dim:0.55}));
 api.controls([{label:'工房へ',onClick:showTitle},{label:'刀を打つ',primary:true,onClick:()=>showForms()}]);
 const F=fameNow();
 el.panel.innerHTML=`<div class="shop board"><div class="shop-head"><b>所持金 ${yen(money())}文</b><small>依頼 ${O.slotsFor(F.index)}件まで（評判で増える）</small></div>${fameBar()}
  <ul class="orders">${(save.orders||[]).slice().sort((a,b)=>!!b.real-!!a.real).map(orderCard).join('')}</ul></div>`;
 for(const b of el.panel.querySelectorAll('[data-skip]'))b.onclick=()=>{S.tick();save={...save,orders:save.orders.filter(o=>o.id!==+b.dataset.skip)};showOrders();};
 for(const b of el.panel.querySelectorAll('[data-give]'))b.onclick=()=>{S.tick();const [oid,no]=b.dataset.give.split(':').map(Number);deliver(save.orders.find(o=>o.id===oid),rack().find(s=>s.no===no));};
 for(const b of el.panel.querySelectorAll('[data-forform]'))b.onclick=()=>{S.tick();showForms(b.dataset.forform);};
}
function fameBar(){const F=fameNow();return `<div class="fame"><span class="fame-lv">評判 Lv${F.lv}</span><b>${F.name}</b><i><b style="width:${Math.round(F.progress*100)}%"></b></i><small>${F.next?`次まで${yen(F.toNext)}`:'最高'}</small></div>`;}
function orderCard(o){
 const p=P.personOf(o),tag=o.real?'名指し':M.CLIENTS[o.client]?.name||'';
 const cands=rack().filter(s=>s.form===o.form).map(s=>({s,r:O.evaluateOrder(o,s)})).sort((a,b)=>b.r.match-a.r.match).slice(0,3);
 return `<li class="o-wrap"><div class="order ${o.real?'named':''}"><button class="o-skip" data-skip="${o.id}">見送る</button>
  <span class="o-who">${p.face} <b>${p.name}</b>${o.real?'<small class="real">実在</small>':''}<small>${tag}</small>${'★'.repeat(o.diff)}</span>
  ${o.real?`<span class="o-meito">名刀「${o.meito}」を打ってほしい<small>（ゆかり：${o.ev}）</small></span>`:''}
  <span class="o-what"><b>${R.form(o.form).name}</b>${o.conds.filter(c=>c.k!=='meito').map(c=>`<i class="cond c-${c.k}">${O.condText(c)}</i>`).join('')}</span>
  <span class="o-foot"><em>お礼 ${yen(o.reward)}文${o.gift?`＋${R.material(o.gift).name}`:''}</em></span>
  <span class="o-cands">${cands.length?cands.map(({s,r})=>`<button class="btn small ${r.stars===3?'primary':''}" data-give="${o.id}:${s.no}">${s.name}　${O.STARS_NAME[r.stars]} ${pct(r.match)}%</button>`).join(''):`<button class="btn small" data-forform="${o.form}">${R.form(o.form).name}を打つ</button>`}</span></div></li>`;
}
function deliver(o,s){
 if(!o||!s)return;
 const r=O.evaluateOrder(o,s),before=fameNow(),p=P.personOf(o);
 save=O.settle(save,o,s,r);ensureOrders();save_();S.phrase(r.stars+1);api.pop(`${yen(r.reward)}文`,r.stars===3?'best':'good');
 showOrders();
 const box=document.createElement('div');box.className='overlay';
 box.innerHTML=`<div class="sheet rankup"><p class="rankup-head">${p.face} ${p.name}：「${['これでは困る……','まあ、いいだろう','ありがたい','見事だ。これこそ求めていた刀だ'][r.stars]}」</p><h3>${O.STARS_NAME[r.stars]}${'★'.repeat(r.stars)}</h3>
  <p class="mtags">納めた刀：<b>${s.name}</b>（注文どおり ${pct(r.match)}%）<br>お礼 <b>${yen(r.reward)}文</b>${r.gift?`・<b>${R.material(r.gift).name}</b>`:''}　評判 <b>+${r.fame}</b>${o.real&&s.meito===o.meito?`<br>${p.name}は、この刀で「${o.ev}」に臨んだという。`:''}</p>
  <button class="btn primary" data-close>とじる</button></div>`;
 closable(box,()=>afterFame(before));el.panel.append(box);
}

// ---------- 相性帳 (D42) ----------
function showAisho(back){
 mode('records');setScene(new Ambient(api,'records','plain',{dim:0.45}));
 const fx=s=>Object.entries(s.fx).map(([k,v])=>`${O.STAT_NAME[k]}+${v}`).join('・');
 el.panel.innerHTML=`<div class="records"><h2>相性帳 <small>${foundSyn()}/${R.SYNERGIES.length}</small></h2>
  <p class="rec-sum">皮鉄と心鉄には、数字ではわからない相性がある。打ってみると見つかる。</p>
  <ul class="regs">${R.SYNERGIES.map(s=>{const got=save.synergies?.[s.id];return `<li class="reg ${got?'':'unknown'}">
   ${got?`<p class="who"><b>${s.name}</b><small>${R.material(s.kawa).name}（皮鉄）×${R.material(s.shin).name}（心鉄）${s.forms?`・${s.forms.map(f=>R.form(f).name).join('か')}で`:''}</small></p><p class="status">${fx(s)}</p>`
   :`<p class="who"><b>？？？</b></p><p class="hold">ヒント：${s.hint}</p>`}</li>`;}).join('')}</ul></div>`;
 api.controls([{label:'戻る',primary:true,onClick:back||showTitle}]);
}
function afterFame(before){
 const after=fameNow();
 if(after.index===before.index)return;
 const up=after.index>before.index,news=up?M.fameNews(before.index,after.index):[];
 ensureOrders();save_();
 const box=document.createElement('div');box.className='overlay';
 box.innerHTML=`<div class="sheet rankup"><p class="rankup-head">${up?'名前が売れてきた！ 評判が上がった':'評判が落ちた……'}</p><h3>Lv${after.lv} ${after.name}</h3>
  ${news.length?`<ul class="fame-news">${news.map(n=>`<li>${n}</li>`).join('')}</ul>`:''}${after.next?`<p class="mfound">次の「${after.next}」まで：評判あと${yen(after.toNext)}</p>`:'<p class="mfound">いちばん上の評判です。</p>'}
  <button class="btn primary" data-close>とじる</button></div>`;
 closable(box);el.panel.append(box);if(up)S.phrase(5);
}

// ---------- 刀帳 ----------
let zukanFilter='all',zukanRank=0;
function showZukan(open=null){
 mode('zukan');setScene(new Ambient(api,'zukan','plain',{dim:0.5}));
 api.controls([{label:'工房へ',primary:true,onClick:showTitle}]);
 renderZukan();
 if(open)showMeito(open);
}
function renderZukan(){
 const list=MEITO.filter(m=>(zukanFilter==='all'||m.t===zukanFilter)&&(!zukanRank||m.r===zukanRank));
 const got=list.filter(m=>save.collection[m.n]).length;
 el.panel.innerHTML=`<div class="zukan">
  <h2>刀帳 <small>${found()}/${MEITO.length}振</small></h2>
  <div class="filters">${[['all','全部'],...R.FORMS.map(f=>[f.id,f.name])].map(([id,n])=>`<button class="chip-btn ${zukanFilter===id?'on':''}" data-filter="${id}">${n}</button>`).join('')}</div>
  <div class="filters">${[[0,'全ランク'],...[5,4,3,2,1].map(r=>[r,R.MEITO_RANK[r].name])].map(([r,n])=>`<button class="chip-btn ${zukanRank===r?'on':''}" data-rank="${r}" ${r?`style="--c:${R.MEITO_RANK[r].color}"`:''}>${n}</button>`).join('')}</div>
  <p class="zukan-sum">${zukanFilter==='all'?'すべて':R.form(zukanFilter).name}：${got}/${list.length}振</p>
  <ul class="zgrid">${list.map(m=>{const c=save.collection[m.n];return `<li><button class="zcell ${c?'got':''}" data-meito="${m.n}">
   <span class="zpic" data-pic="${m.n}"></span><b>${c?m.n:'？？？'}</b><small>${meitoBadge(m.r)} ${R.form(m.t).name}・${R.ERAS[m.e].name}</small></button></li>`;}).join('')}</ul>
 </div>`;
 for(const b of el.panel.querySelectorAll('[data-filter]'))b.onclick=()=>{S.tick();zukanFilter=b.dataset.filter;renderZukan();};
 for(const b of el.panel.querySelectorAll('[data-rank]'))b.onclick=()=>{S.tick();zukanRank=+b.dataset.rank;renderZukan();};
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
   <p class="mtags">${meitoBadge(m.r)} ${F}・${R.ERAS[m.e].long}・${m.s}${m.sc?`（${m.sc}）`:''}<br><b>${m.d}</b>${size?`・${size}`:''}</p>
   <p class="mhamon">刃文：<b>${R.HAMON[m.h].name}</b>（${basisText(m.b)}）</p>
   <p class="desc">${m.x}</p>
   <p class="mfound">はじめて打った日：${new Date(c.first).toLocaleDateString('ja-JP')}　打った数：${c.count}振</p>`
  :`<h3>？？？<small>まだ打っていない</small></h3>
   <p class="mtags">${meitoBadge(m.r)} ${F}・${R.ERAS[m.e].long}</p>
   <ul class="mhint"><li>形：<b>${F}</b></li><li>素材：<b>${R.comboText(m.e,m.mat)}</b></li><li>刃文：<b>${R.HAMON[m.h].name}</b>（${R.HAMON[m.h].how}）</li><li>技：<b>${R.NEED[m.r]}/${R.SUCCESS_MAX}以上</b>（会心2点・よし1点）</li></ul>`}
  </div><button class="btn primary" data-close>とじる</button></div>`;
 closable(box);el.panel.append(box);
}
function resultComment(s){
 if(s.crack)return '親方「焼き割れだ……。焼き入れの色が熱すぎたな。次は月夜の色をよく見ろ」';
 return '親方「'+{E:'まあ、最初はこんなものだ。どの工程でつまずいたか見てみろ',D:'並の刀だ。売り物にはなる',C:'なかなかの良品だ。腕が上がってきたな',
  B:'業物だ。これなら胸を張って売れる',A:'良業物か。いい仕事をしたな',S:'大業物だ！ これは高く売れるぞ',SS:'……最上大業物。見事というほかない'}[gradeOf(s).id]+'」';
}


function showRecords(){
 mode('records');setScene(new Ambient(api,'records','plain',{dim:0.45}));
 const best=bestSword(save),sum=save.swords.reduce((s,x)=>s+x.price,0);
 el.panel.innerHTML=`<div class="records">
  <h2>打った刀 <small>${save.forged}振</small></h2>
  <p class="rec-sum">評判 <b>Lv${fameNow().lv}</b>（${yen(save.fame||0)}）　出陣 <b>${save.dives||0}回</b>　相性 <b>${foundSyn()}/${R.SYNERGIES.length}</b><br>いちばん深く：${V.PLACES.map(p=>`${p.name} ${save.deepest?.[p.id]||0}`).join('・')}<br>依頼のお礼の合計 <b>${yen((save.ledger||[]).reduce((t,x)=>t+x.amount,0))}</b> 文${best?`<br>いちばんの刀：${best.name}（${gradeOf(best).id} ${gradeOf(best).name}）`:''}</p>
  <ol>${save.swords.map(s=>`<li><span class="no">${s.no}</span><span class="nm"><b>${s.name}</b><small>${s.meito?'名刀・':''}${R.HAMON_NAME[s.hamon]||''}${s.crack?'・割れ':''}</small></span>${gradeBadge(gradeOf(s))}<span class="pr">${yen(s.price)}文</span></li>`).join('')}</ol>
 </div>`;
 api.controls([{label:'工房へ',primary:true,onClick:showTitle}]);
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
