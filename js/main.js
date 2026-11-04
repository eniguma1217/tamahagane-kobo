// The app shell: screens (title, form, materials, the forging steps, result, 刀帳, records), the canvas loop, input and the save.
import * as R from './rules.js';
import {loadSave,writeSave,addSword,bestSword,payBuild,migrateOrders,START_MONEY} from './save.js';
import * as M from './market.js';
import * as J from './journey.js';
import * as O from './orders.js';
import * as S from './sound.js';
import * as D from './draw.js';
import {MEITO} from './meito.js';
import {loadArt,artSrc} from './art.js';
import {Heat,Hammer,Hamon,Quench,Ambient} from './scenes.js';

const $=s=>document.querySelector(s);
const el={app:$('#app'),bar:$('#bar'),steps:$('#steps'),meter:$('#meter'),stage:$('#stage'),cv:$('#cv'),panel:$('#panel'),pop:$('#pop'),talk:$('#talk'),face:$('#face'),line:$('#line'),controls:$('#controls'),sound:$('#sound')};
const ctx=el.cv.getContext('2d');
const {setDPR}=D;
let save=loadSave(window.localStorage),notice=null;
{const m=migrateOrders(save);if(m.save!==save){save=m.save;notice=m.notice;writeSave(window.localStorage,save);}}
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

const letterCount=()=>J.travelling(save).filter(p=>p.journey.left<=0).length;
function showNotice(text){
 const box=document.createElement('div');box.className='overlay';
 box.innerHTML=`<div class="sheet rankup"><p class="rankup-head">お知らせ</p><p class="mtags">${text}</p><button class="btn primary" data-close>とじる</button></div>`;
 closable(box);el.panel.append(box);
}
function showTitle(){
 mode('title');setScene(new Ambient(api,'title','title'));
 const n=save.forged||0,F=fameNow(),away=J.travelling(save).length;
 el.panel.innerHTML=`<div class="title">
  <div class="title-name"><h1>玉鋼工房</h1><span class="seal">工房</span></div>
  <p class="title-sub">たまはがね こうぼう</p>
  <p class="title-money">所持金 ${yen(money())}文</p>
  <p class="title-rank">評判 <b>Lv${F.lv} ${F.name}</b>${letterCount()?`<small>✉ 便りが${letterCount()}通届いている</small>`:away?`<small>旅に出ている持ち主 ${away}人</small>`:F.next?`<small>次の「${F.next}」まで あと${yen(F.toNext)}</small>`:''}</p>
  <div class="menu"><button class="btn primary big" data-go="board">注文を受ける</button>
  <div class="menu-row"><button class="btn" data-go="zukan">刀帳 ${found()}/${MEITO.length}</button><button class="btn" data-go="aisho">相性帳 ${foundSyn()}/${R.SYNERGIES.length}</button>
  <button class="btn" data-go="records" ${n?'':'disabled'}>記録</button></div></div>
 </div>`;
 el.panel.querySelector('[data-go=board]').onclick=()=>{S.unlock();S.tick();showBoard();};
 el.panel.querySelector('[data-go=zukan]').onclick=()=>{S.unlock();S.tick();showZukan();};
 el.panel.querySelector('[data-go=aisho]').onclick=()=>{S.unlock();S.tick();showAisho(showTitle);};
 el.panel.querySelector('[data-go=records]').onclick=()=>{S.tick();showRecords();};
 if(notice){const t=notice;notice=null;showNotice(t);}
}

// ---------- 注文の板 (#17, D38・D41): three orders; choose one and forge for it ----------
const rngAt=seq=>R.seededRandom(seq*7919+13);
const rngNext=()=>{const r=rngAt(save.seq||1);save={...save,seq:(save.seq||1)+1};return r;};
const fameNow=()=>M.fameLevel(save.fame||0);
const openNow=()=>R.openAt(fameNow().index);
const starLine=(n,max=5)=>`<span class="stars">${'★'.repeat(n)}<i>${'★'.repeat(Math.max(0,max-n))}</i></span>`;
const skillText=k=>`${J.SKILLS[k].name}（${J.SKILLS[k].stat}）`;
const giftable=()=>[...openNow().materials].filter(id=>R.material(id).price>=500);
const pct=x=>Math.round(x*100);
const foundSyn=()=>Object.keys(save.synergies||{}).length;
const personOf=o=>o.person||J.personById(save,o.ownerId);
function ensureOrders(){save=O.fillOrders(save,fameNow().index,MEITO,rngAt);writeSave(window.localStorage,save);}
function showBoard(){
 mode('shop');steps(-1);el.meter.hidden=true;
 setScene(new Ambient(api,'shop','plain',{dim:0.55}));
 api.controls([{label:'タイトルへ',onClick:showTitle}]);
 // 便り (D34): the journeys that have ended are told when the board is opened
 const before=fameNow(),out=J.deliverLetters(save);
 if(out.letters.length)save=out.save;
 ensureOrders();renderBoard();
 if(out.letters.length)showLetters(out.letters,before);
}
function fameBar(){
 const F=fameNow();
 return `<div class="fame"><span class="fame-lv">評判 Lv${F.lv}</span><b>${F.name}</b><i><b style="width:${Math.round(F.progress*100)}%"></b></i><small>${F.next?`次まで${yen(F.toNext)}`:'最高'}</small></div>`;
}
function condChips(o){return o.conds.filter(c=>c.k!=='meito').map(c=>`<i class="cond c-${c.k}">${O.condText(c)}</i>`).join('');}
function orderCard(o){
 const p=personOf(o),tag=o.real?'名指し':o.regular?'常連':M.CLIENTS[o.client]?.name||'';
 return `<li class="o-wrap"><button class="o-skip" data-skip="${o.id}">見送る</button><button class="order ${o.real?'named':''}" data-order="${o.id}">
  <span class="o-who">${p.face} <b>${p.name}</b>${o.real?'<small class="real">実在</small>':''}<small>${tag}</small>${starLine(o.diff)}</span>
  ${o.real?`<span class="o-meito">名刀「${o.meito}」を打ってほしい</span>`:''}
  <span class="o-what"><b>${R.form(o.form).name}</b>${condChips(o)}</span>
  <span class="o-foot"><em>お礼 ${yen(o.reward)}文${o.gift?`＋${R.material(o.gift).name}の券`:''}</em><small>旅：${J.journeyInfo(o.journey).title}</small></span></button></li>`;
}
function renderBoard(){
 const owners=save.owners||[],away=J.travelling(save).length;
 el.panel.innerHTML=`<div class="shop board"><div class="shop-head"><b>所持金 ${yen(money())}文</b><small>${away?`旅に出ている持ち主 ${away}人`:''}</small></div>${fameBar()}
  <p class="board-title">注文 <small>どれか1つを選んで打つ。刀は注文した人と旅に出る</small></p>
  <ul class="orders">${save.orders.slice().sort((a,b)=>!!b.real-!!a.real).map(orderCard).join('')}</ul>
  <div class="board-links"><button class="chip-btn" data-go="jouren">常連 ${owners.filter(p=>p.regular).length}・旅 ${away}</button><button class="chip-btn" data-go="aisho">相性帳 ${foundSyn()}/${R.SYNERGIES.length}</button><button class="chip-btn" data-go="zukan">刀帳 ${found()}</button></div></div>`;
 for(const b of el.panel.querySelectorAll('[data-order]'))b.onclick=()=>{S.unlock();S.tick();showMaterials(+b.dataset.order);};
 // 見送る: the order goes and a new one comes (nothing is lost)
 for(const b of el.panel.querySelectorAll('[data-skip]'))b.onclick=()=>{S.tick();save={...save,orders:save.orders.filter(o=>o.id!==+b.dataset.skip)};ensureOrders();renderBoard();};
 el.panel.querySelector('[data-go=jouren]').onclick=()=>{S.tick();showJouren();};
 el.panel.querySelector('[data-go=aisho]').onclick=()=>{S.tick();showAisho(showBoard);};
 el.panel.querySelector('[data-go=zukan]').onclick=()=>{S.tick();showZukan();};
}

// ---------- 素材 (D44): 皮鉄と心鉄を買って選ぶ。同じものを2つで丸鍛え ----------
let order=null,pick={kawa:null,shin:null,active:'kawa',last:null};
const buildOf=()=>({structure:pick.kawa&&pick.kawa===pick.shin?'maru':'kobuse',kawa:pick.kawa,shin:pick.kawa===pick.shin?undefined:pick.shin});
function showMaterials(id){
 order=save.orders.find(o=>o.id===id)||null;if(!order)return showBoard();
 mode('materials');steps(0);el.meter.hidden=true;
 setScene(new Ambient(api,'materials','title',{dim:0.8}));
 api.controls([{label:'戻る',onClick:showBoard},{label:'打つ',primary:true,disabled:true,onClick:startForging}]);
 renderMaterials();
}
const yenOr=n=>n?`${yen(n)}文`:'無料';
// what a build costs after the free vouchers (one per piece)
function costWithVouchers(mats){const v={...(save.vouchers||{})};let c=0;for(const id of mats){if(v[id]>0)v[id]--;else c+=R.material(id).price;}return c;}
function orderStrip(o){
 const p=personOf(o);
 return `<div class="ostrip ${o.real?'named':''}"><p>${p.face} <b>${p.name}</b>${o.real?`<small>名刀「${o.meito}」</small>`:''}${starLine(o.diff)}</p><p class="o-what"><b>${R.form(o.form).name}</b>${condChips(o)}</p></div>`;
}
function renderMaterials(){
 const open=openNow();
 for(const k of ['kawa','shin'])if(pick[k]&&!open.materials.has(pick[k]))pick[k]=null;
 const ready=!!(pick.kawa&&pick.shin),build=buildOf(),c=ready?R.combine(build):null,mats=ready?R.buildMats(build):[];
 const cost=costWithVouchers(mats),enough=cost<=money();
 const syn=ready?R.synergyOf(pick.kawa,pick.shin,order.form):null,known=syn&&save.synergies?.[syn.id];
 const ex=ready?R.expectStats(build,order.form,0.8,known?syn:null):null,best=ready?R.expectStats(build,order.form,1,known?syn:null):null;
 const need=Object.fromEntries(order.conds.filter(x=>x.k==='stat').map(x=>[x.stat,x.min]));
 el.panel.innerHTML=`<div class="mats-screen">
  ${orderStrip(order)}
  <div class="slots">${['kawa','shin'].map(k=>{const m=pick[k]?R.material(pick[k]):null;return `<button class="slot ${pick.active===k?'active':''}" data-slot="${k}"><small>${R.SLOTS[k].name}</small><b>${m?m.name:'えらぶ'}</b><em>${R.SLOTS[k].role}</em></button>`;}).join('')}</div>
  <p class="era-line">${eraLine(c,syn,known)}</p>
  ${ex?`<div class="statpv">${['sharp','tough','beauty'].map(k=>{const n=need[k];return `<div class="${n?(ex[k]>=n?'ok':best[k]>=n?'maybe':'no'):''}"><small>${O.STAT_NAME[k]}</small><i><b style="width:${ex[k]}%"></b><u style="width:${best[k]}%"></u>${n?`<s style="left:${n}%"></s>`:''}</i><em>${ex[k]}${n?`／${n}`:''}</em></div>`;}).join('')}</div>`:''}
  <div class="mats">${R.MATERIALS.map(m=>{const marks=['kawa','shin'].filter(k=>pick[k]===m.id).map(k=>R.SLOTS[k].name[0]).join('');
   const lk=!open.materials.has(m.id);
   return `<button class="mat ${marks?'picked':''} ${lk?'locked':''}" data-mat="${m.id}" ${lk?`data-lock="${R.opensAt('materials',m.id)}"`:''}><em class="era-tag ${m.era?'':'none'}">${lk?`🔒評判Lv${R.opensAt('materials',m.id)+1}`:m.era?R.ERAS[m.era].short:'時代なし'}</em>${matIcon(m.id,24)}<span class="mat-text"><b>${m.name}${marks?`<i>${marks}</i>`:''}</b><small>${yenOr(m.price)}${save.vouchers?.[m.id]?`<i class="voucher">無料券${save.vouchers[m.id]}</i>`:''}</small></span></button>`;}).join('')}</div>
  <p class="cost-line ${enough?'':'short'}">材料代 <b>${yen(cost)}</b>文　所持金 <b>${yen(money())}</b>文</p>
 </div>`;
 for(const b of el.panel.querySelectorAll('[data-slot]'))b.onclick=()=>{S.tick();pick.active=b.dataset.slot;renderMaterials();};
 for(const b of el.panel.querySelectorAll('[data-mat]'))b.onclick=()=>{S.unlock();S.tick();
  if(b.dataset.lock)return api.say(`まだ使えない。店の評判が <b>Lv${+b.dataset.lock+1}</b> になると使える。`);
  pick[pick.active]=b.dataset.mat;pick.last=b.dataset.mat;pick.active=pick.active==='kawa'?'shin':'kawa';if(pick.kawa&&!pick.shin)pick.active='shin';renderMaterials();};
 const go=el.controls.querySelectorAll('.btn')[1];
 go.disabled=!(ready&&enough);go.textContent=cost?`打つ ${yen(cost)}文`:'打つ（無料）';
 api.say(materialsTalk(c,syn,known,enough),c&&c.kind!=='gyaku'&&enough?'happy':'normal');
}
function materialsTalk(c,syn,known,enough){
 const last=pick.last?R.material(pick.last):null;
 const about=last?`<b>${last.name}</b>：${last.note}。硬さ${last.hard}・粘り${last.tough}・美しさ${last.beauty}。`:'注文を読んで、<b>皮鉄</b>（外側。地鉄の時代と美しさ）と<b>心鉄</b>（芯。粘り）を選べ。';
 if(!c)return about;
 if(!enough)return `材料代が足りない。無料の<b>卸し鉄・包丁鉄</b>なら、いつでも打てるぞ。`;
 if(c.kind==='gyaku')return 'おいおい、あべこべだ。皮がやわらかいと刃がなまくらになる。名刀にもならないぞ。';
 if(syn&&known)return `<b>${syn.name}</b>の組み合わせだ。${about}`;
 return about+(c.era?'':'この皮鉄には時代の札がない。名刀にはならないぞ。');
}
function eraLine(c,syn,known){
 const F=R.form(order.form).name;
 if(!c)return `打つ形：<b>${F}</b>　${pick.active==='kawa'?'皮鉄':'心鉄'}を選ぶ`;
 const era=c.era?`地鉄：<b>${R.ERAS[c.era].long}</b>`:`地鉄：${c.kind==='gyaku'?'あべこべ':'時代なし'}（名刀にならない）`;
 return `打つ形：<b>${F}</b>　${era}${known?`　<span class="syn">相性「${syn.name}」</span>`:''}`;
}
let forgeIndex=-1;
function startForging(){
 const build=buildOf();
 const paid=payBuild(save,R.buildMats(build),id=>R.material(id).price);if(!paid)return;
 const {used,cost,...rest}=paid;save=rest;writeSave(window.localStorage,save);
 api.run={form:order.form,want:order.meito||null,...build};forgeIndex=-1;el.panel.innerHTML='';forgeNext();
}
function forgeNext(){
 forgeIndex++;
 if(forgeIndex>=FORGE.length)return showResult();
 const [name]=FORGE[forgeIndex];mode('forge');el.panel.innerHTML='';
 steps(STEP_NAMES.indexOf(FORGE[forgeIndex][1]));api.progress(null);
 el.stage.classList.remove('fade');void el.stage.offsetWidth;el.stage.classList.add('fade');
 setScene(new ({heat:Heat,hammer:Hammer,hamon:Hamon,quench:Quench}[name])(api));
}

// ---------- 仕上がり：注文どおり度・お礼・評判、そして旅立ち ----------
function showResult(){
 const sword=R.finishSword(api.run,MEITO,save.collection);
 const isNew=!!sword.meito&&!save.collection[sword.meito],synNew=!!sword.synergy&&!save.synergies?.[sword.synergy];
 const ord=order,res=O.evaluateOrder(ord,sword),person=personOf(ord),before=fameNow();
 save=addSword(save,sword);
 save=O.settle(save,ord,save.swords[0],res,rngNext(),giftable());
 const trip=(save.owners||[]).find(p=>p.id===person.id)?.journey;
 ensureOrders();
 mode('result');setScene(new Ambient(api,'result','plain',{sword,dim:0.2}));S.phrase(sword.meito?5:Math.max(1,res.stars+1));
 const g=api.run,m=sword.meito?MEITO.find(x=>x.n===sword.meito):null,syn=sword.synergy?R.SYNERGIES.find(x=>x.id===sword.synergy):null;
 const F=R.form(sword.form).name,info=J.journeyInfo(ord.journey);
 el.panel.innerHTML=`<div class="result">
  <div class="sword-space"></div>
  ${m?`<p class="meito-badge">${isNew?'<b>NEW</b>':''}名刀を打ち上げた！</p>`:''}
  <h2 class="mei">${sword.name}${m?`<small>${m.k}</small>`:''}</h2>
  <p class="tags">${m?`${F}・${R.ERAS[m.e].long}・${m.s}`:`${R.HAMON_NAME[sword.hamon]}・${[sword.kawa,sword.shin].filter(Boolean).map(id=>R.material(id).name).join('＋')}`}${sword.crack?'・<b class="bad">焼き割れ</b>':''}</p>
  <div class="grade-row">${gradeBadge(gradeOf(sword),true)}${m?meitoBadge(m.r):''}<em>技 ${sword.successes}/${R.SUCCESS_MAX}</em></div>
  <div class="stats">${[['切れ味','sharp'],['粘り','tough'],['美しさ','beauty']].map(([n,k])=>`<div><small>${n}</small><i><b style="width:${sword.stats[k]}%"></b></i><em>${sword.stats[k]}</em></div>`).join('')}</div>
  <div class="verdict s${res.stars}"><p class="v-head">${person.face} ${person.name}：<b>${O.STARS_NAME[res.stars]}</b>${'★'.repeat(res.stars)}<small>注文どおり ${pct(res.match)}%</small></p>
   <ul class="v-conds">${res.parts.filter(x=>x.c.k!=='meito'||ord.real).map(x=>`<li class="${x.ok?'ok':'ng'}">${x.ok?'○':'×'} ${O.condText(x.c)}</li>`).join('')}</ul>
   <p class="v-pay">お礼 <b>${yen(res.reward)}</b>文　評判 <b>+${res.fame}</b>${res.gift?`　＋<b>${R.material(res.gift).name}</b>の無料券`:''}</p></div>
  ${syn&&synNew?`<p class="syn-new">相性を見つけた！ 「<b>${syn.name}</b>」（${R.material(syn.kawa).name}×${R.material(syn.shin).name}）</p>`:''}
  ${trip?`<p class="depart">${person.name}は、この刀で「${info.title}」へ旅立った。見こみ <b class="p-${J.prospect(trip.chances)}">${J.prospect(trip.chances)}</b>（便りは刀を${trip.left}振打つと届く）</p>`:''}
  ${m?'':`<p class="comment">${resultComment(sword)}</p>`}
 </div>`;
 api.controls([{label:'刀帳',onClick:()=>showZukan()},{label:'次の注文へ',primary:true,onClick:showBoard}]);
 api.swordTop=()=>{const s=el.panel.querySelector('.sword-space');if(!s)return null;const a=s.getBoundingClientRect(),b=el.stage.getBoundingClientRect();return a.top-b.top+a.height/2;};
 if(isNew)api.pop('名刀','best');else if(synNew)api.pop('相性発見','best');
 api.later(isNew?1300:500,()=>afterFame(before));
}

// ---------- 常連 (D36) ----------
function showJouren(){
 mode('records');setScene(new Ambient(api,'records','plain',{dim:0.45}));
 const list=(save.owners||[]).slice().sort((a,b)=>(!!b.journey-!!a.journey)||(b.real-a.real)||(b.lv-a.lv));
 const personLine=(p,tag)=>`<p class="who">${p.face} <b>${p.name}</b>${p.real?'<small class="real">実在</small>':''}<small>${tag?tag+'・':''}腕前${starLine(p.lv)}・得意 ${skillText(p.skill)}</small></p>`;
 el.panel.innerHTML=`<div class="records"><h2>常連と旅 <small>${list.filter(p=>p.regular).length}人</small></h2>
  <ul class="regs">${list.map(p=>`<li class="reg ${p.journey?'away':''}">${personLine(p,p.regular?'常連':'初めての客')}
   <p class="status">${p.journey?`🧭 旅の途中：「${p.journey.title}」${starLine(p.journey.star)}　${p.journey.left?`あと${p.journey.left}振打つと便りが届く`:'便りが届いている'}`:'🏠 注文に来るのを待っている'}</p>
   <p class="hold">刀：${p.journey?p.journey.swordName:p.sword?p.sword.name:'なし（新しい刀がほしい）'}</p>
   ${(p.story||[]).length?`<p class="story">武勇伝：${p.story.slice(0,3).map(x=>`「${x.t}」<b class="o-${x.r}">${J.OUTCOME[x.r]}</b>`).join('・')}</p>`:''}</li>`).join('')||'<li class="empty">まだ誰もいない。注文に応えると、注文した人がその刀で旅に出る。活躍すると常連になって、また注文に来る。</li>'}</ul></div>`;
 api.controls([{label:'注文へ',primary:true,onClick:showBoard}]);
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

// ---- 便り (D34・D35) and the 評判 level changing
function showLetters(letters,before){
 const L=letters[0],rest=letters.slice(1),info=J.journeyInfo(L.journey);
 const box=document.createElement('div');box.className='overlay';
 box.innerHTML=`<div class="sheet letter o-${L.outcome}"><p class="rankup-head">✉ 便りが届いた${rest.length?`（あと${rest.length}通）`:''}</p>
  <p class="who big">${L.face} <b>${L.name}</b>${L.real?'<small class="real">実在</small>':''}</p>
  <p class="trip-t">「${L.journey.title}」${starLine(L.journey.star)}</p>
  <p class="say">${L.swordName}：${info[L.outcome]||info.hard}</p>
  <h3 class="outcome">${J.OUTCOME[L.outcome]}</h3>
  <p class="mtags">${L.fame>0?`評判 <b>+${L.fame}</b>`:L.fame<0?`評判 <b class="bad">${L.fame}</b>`:'評判はそのまま'}${L.reward?.money?`<br>お礼に <b>${yen(L.reward.money)}文</b> が届いた`:''}${L.reward?.voucher?`<br>お礼に <b>${R.material(L.reward.voucher).name}の無料券</b> が届いた`:''}${L.lvUp?`<br>腕前が上がった！ ${starLine(L.lv)}`:''}${L.newRegular?'<br><b>常連になった！</b> また注文に来てくれる':''}${L.goesHome?'<br>（郷里へ帰っていった）':''}</p>
  <button class="btn primary" data-close>${rest.length?'次の便り':'とじる'}</button></div>`;
 closable(box,()=>{if(rest.length)showLetters(rest,before);else afterFame(before);});
 el.panel.append(box);
 S.phrase(L.outcome==='great'?5:L.outcome==='good'?4:2);
}
function afterFame(before){
 const after=fameNow();
 if(el.app.dataset.mode==='shop')renderBoard();
 if(after.index===before.index)return;
 const up=after.index>before.index,news=up?M.fameNews(before.index,after.index):[];
 const box=document.createElement('div');box.className='overlay';
 box.innerHTML=`<div class="sheet rankup"><p class="rankup-head">${up?'店の評判が上がった！':'店の評判が落ちた……'}</p><h3>Lv${after.lv} ${after.name}</h3>
  ${news.length?`<ul class="fame-news">${news.map(n=>`<li>${n}</li>`).join('')}</ul>`:''}${after.next?`<p class="mfound">次の「${after.next}」まで：評判あと${yen(after.toNext)}</p>`:'<p class="mfound">いちばん上の評判です。</p>'}
  <button class="btn primary" data-close>とじる</button></div>`;
 closable(box);el.panel.append(box);if(up)S.phrase(5);
}

// ---------- 刀帳 ----------
let zukanFilter='all',zukanRank=0;
function showZukan(open=null){
 mode('zukan');setScene(new Ambient(api,'zukan','plain',{dim:0.5}));
 api.controls([{label:'タイトルへ',primary:true,onClick:showTitle}]);
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
  <p class="rec-sum">評判 <b>Lv${fameNow().lv}</b>（${yen(save.fame||0)}）　常連 <b>${(save.owners||[]).filter(p=>p.regular).length}人</b>　相性 <b>${foundSyn()}/${R.SYNERGIES.length}</b><br>お礼の合計 <b>${yen((save.ledger||[]).reduce((t,x)=>t+x.amount,0))}</b> 文${best?`<br>いちばんの刀：${best.name}（${gradeOf(best).id} ${gradeOf(best).name}）`:''}</p>
  <ol>${save.swords.map(s=>`<li><span class="no">${s.no}</span><span class="nm"><b>${s.name}</b><small>${s.meito?'名刀・':''}${R.HAMON_NAME[s.hamon]||''}${s.crack?'・割れ':''}</small></span>${gradeBadge(gradeOf(s))}<span class="pr">${yen(s.price)}文</span></li>`).join('')}</ol>
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
