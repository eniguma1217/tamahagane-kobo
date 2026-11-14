// 試作 7 用心棒の派遣（#34）：刀を用心棒に持たせて送り出すと、時間がたって戦利品と土産話を持って帰る。
// 道中は自動で戦う（刀の攻撃力・耐久・必殺技、用心棒の得意）。試作は早送り（本当は1時間〜6時間を15〜45秒）。数字は試作の仮のもの。
import {$,R,V,S,mySwords,unitOf,foeUnit,battle,loadArt,header,pick,yen,wazaOf} from './kit.js';
const el={top:$('#top'),panel:$('#panel'),over:$('#over')};
const GUARDS=[
 {name:'弥七',face:'🗡',trait:'攻め',note:'腕前が高い（攻撃×1.2）',skill:1.2,vigor:0.9},
 {name:'お凛',face:'🎐',trait:'素早さ',note:'動きが速い（手数×1.3）',skill:1,vigor:1,quick:1.3},
 {name:'権六',face:'🛡',trait:'守り',note:'体が強い（体力×1.4）',skill:0.9,vigor:1.4}
];
const TRIPS={touge:{floors:3,secs:15,real:'1時間'},kosenjo:{floors:4,secs:30,real:'3時間'},oniyama:{floors:5,secs:45,real:'6時間'}};
const H={state:'loading',swords:[],own:false,parties:GUARDS.map(g=>({g,trip:null})),total:{money:0,mats:{}},sheet:null};
window.__proto=H;
// the whole trip is decided when they leave; the letters come as the time passes
function plan(g,s,placeId){
 const place=V.placeOf(placeId),T=TRIPS[placeId],sword={...s,dur:V.durOf(s)};
 const u=unitOf(sword,{skill:g.skill,vigor:g.vigor,who:g.name});if(g.quick)u.speed*=g.quick;
 const lines=[],bag={money:0,mats:{}};let fell=false,broke=false,depth=0;const w=wazaOf(s);
 for(let d=1;d<=T.floors;d++){
  const key=d===T.floors&&T.floors>=4?place.boss:pick(place.foes),f=foeUnit(key,d,place);u.ki=0;
  const r=battle([u],[f]);const used=r.log.filter(b=>b.from===u),big=used.find(b=>b.waza);
  sword.dur=Math.max(0,sword.dur-(f.boss?2:1));
  if(!r.win){fell=true;lines.push(`${d}日目：${f.name}${f.boss?'（強敵）':''}に押されて、逃げ帰ることに……`);break;}
  depth=d;const loot=V.rollLoot(Math.random,place,d,f.boss);bag.money+=loot.money;for(const m of loot.mats)bag.mats[m]=(bag.mats[m]||0)+1;
  const t=V.earnTitle(sword,{key,boss:f.boss});sword.kills=t.kills;sword.names=t.names;
  lines.push(`${d}日目：${f.name}${f.boss?'（強敵）':''}を${big?`『${big.waza}』で`:`${used.length}太刀で`}倒した。${loot.mats.map(m=>R.material(m).name).join('・')||''}${loot.mats.length?'と':''}${yen(loot.money)}文を得た。${t.title?`この刀は「${t.title}」と呼ばれはじめた。`:''}`);
  if(sword.dur<=0){broke=true;lines.push(`${s.name}が折れた。${g.name}は帰り道を急いだ。`);break;}
 }
 if(fell){bag.money=Math.floor(bag.money/2);for(const k in bag.mats)bag.mats[k]=Math.floor(bag.mats[k]/2);}
 const end=fell?'戦利品の半分を落としてきた。':broke?'刀は折れたが、戦利品は持ち帰った。':`${place.name}の${depth}日分の道を守りきった！`;
 return {place,sword:s,after:sword,secs:T.secs,real:T.real,lines,bag,fell,broke,end,startAt:performance.now(),title:sword.names?.filter(n=>!(s.names||[]).includes(n))||[]};
}
const progress=p=>Math.min(1,(performance.now()-p.trip.startAt)/1000/p.trip.secs);
function menu(){
 H.state='menu';const mine=mySwords(6);H.swords=mine.list;H.own=mine.own;
 el.over.hidden=false;el.over.innerHTML=`<div class="sheet"><p class="tag">出陣の試作</p><h1>7 用心棒の派遣</h1>
  <p class="howto">刀を<b>用心棒</b>に持たせて送り出す。道中は自動で戦い、時間がたつと<b>戦利品と土産話</b>を持って帰る。いくつかの組を同時に出せる。<br>強い刀ほど遠くまで行ける。刀は傷み、折れることも。<b>試作は早送り</b>（本当は1時間〜6時間を15〜45秒で）。</p>
  <p class="sw">${mine.own?'あなたの刀掛けの刀':'見本の刀'}：${mine.list.map(s=>`<b>${s.name}</b>`).join('・')}</p>
  <div class="places"><button class="btn primary" data-start>はじめる</button></div><p class="note">本番のセーブは変わりません。</p></div>`;
 el.over.querySelector('[data-start]').onclick=()=>{S.unlock();el.over.hidden=true;H.state='play';render();};
}
const busySword=no=>H.parties.some(p=>p.trip&&p.trip.sword.no===no);
function render(){
 const mats=Object.entries(H.total.mats);
 el.top.innerHTML=header('7 用心棒の派遣')+`<div class="fn"><span>持ち帰った合計：${yen(H.total.money)}文${mats.length?'・'+mats.map(([id,n])=>`${R.material(id).name}${n}`).join('・'):''}</span></div>`;
 el.panel.innerHTML=`<div class="guards">${H.parties.map((p,i)=>{const t=p.trip,k=t?progress(p):0;
  return `<div class="guard ${t?(k>=1?'back':'away'):''}"><div class="gh"><span class="gf">${p.g.face}</span><b>${p.g.name}</b><small>${p.g.trait}：${p.g.note}</small></div>
   ${t?`<p class="gt">${t.place.name}へ（${t.sword.name}）　${k>=1?'<b class="ok">帰ってきた！</b>':`のこり ${Math.ceil(t.secs*(1-k))}秒（本当は${t.real}）`}</p><i class="bar"><b style="width:${Math.round(k*100)}%"></b></i>
    <p class="letter">${t.lines.slice(0,Math.floor(k*t.lines.length+0.0001)).at(-1)||'旅立った。'}</p>
    ${k>=1?`<button class="btn primary" data-hear="${i}">話を聞く</button>`:''}`
   :`<button class="btn" data-send="${i}">送り出す</button>`}</div>`;}).join('')}</div>`;
 for(const b of el.panel.querySelectorAll('[data-send]'))b.onclick=()=>{S.tick();openSend(+b.dataset.send);};
 for(const b of el.panel.querySelectorAll('[data-hear]'))b.onclick=()=>{S.tick();hear(+b.dataset.hear);};
}
function openSend(i,sel={sword:null,place:'touge'}){
 const p=H.parties[i];H.sheet={i,...sel};
 el.over.hidden=false;el.over.innerHTML=`<div class="sheet"><p class="tag">${p.g.face} ${p.g.name}を送り出す</p><h1>どの刀で、どこへ？</h1>
  <p class="howto">刀：</p><div class="pickgrid">${H.swords.map((s,k)=>`<button class="chip ${sel.sword===k?'on':''}" data-sw="${k}" ${busySword(s.no)?'disabled':''}><b>${s.name}</b><small>攻撃力${V.atkOf(s)}・耐久${V.durOf(s)}</small><small>必殺『${wazaOf(s).name}』</small></button>`).join('')}</div>
  <p class="howto">行き先：</p><div class="pickgrid">${V.PLACES.map(pl=>`<button class="chip ${sel.place===pl.id?'on':''}" data-pl="${pl.id}"><b>${pl.name}</b><small>${TRIPS[pl.id].floors}日・本当は${TRIPS[pl.id].real}</small></button>`).join('')}</div>
  <div class="row"><button class="btn" data-cancel>やめる</button><button class="btn primary" data-go ${sel.sword==null?'disabled':''}>出発</button></div></div>`;
 for(const b of el.over.querySelectorAll('[data-sw]'))b.onclick=()=>{S.tick();openSend(i,{...sel,sword:+b.dataset.sw});};
 for(const b of el.over.querySelectorAll('[data-pl]'))b.onclick=()=>{S.tick();openSend(i,{...sel,place:b.dataset.pl});};
 el.over.querySelector('[data-cancel]').onclick=()=>{el.over.hidden=true;H.sheet=null;};
 el.over.querySelector('[data-go]').onclick=()=>{p.trip=plan(p.g,H.swords[sel.sword],sel.place);el.over.hidden=true;H.sheet=null;S.phrase(2);render();};
}
function hear(i){
 const p=H.parties[i],t=p.trip,mats=Object.entries(t.bag.mats).filter(([,n])=>n>0);
 el.over.hidden=false;el.over.innerHTML=`<div class="sheet"><p class="tag">${p.g.face} ${p.g.name}の土産話</p><h1>${t.fell?'逃げ帰ってきた':t.broke?'刀が折れた……':'無事に帰ってきた'}</h1>
  <div class="story">${t.lines.map(l=>`<p>${l}</p>`).join('')}<p><b>${t.end}</b></p></div>
  <p class="howto">戦利品：<b>${yen(t.bag.money)}文</b>${mats.map(([id,n])=>`・<b>${R.material(id).name}×${n}</b>`).join('')}${t.title.length?`<br>二つ名：<b>${t.title.join('・')}</b>`:''}<br>${t.sword.name}の耐久：${V.durOf(t.sword)} → ${t.after.dur}</p>
  <div class="places"><button class="btn primary" data-take>受け取る</button></div></div>`;
 el.over.querySelector('[data-take]').onclick=()=>{
  H.total.money+=t.bag.money;for(const [id,n] of mats)H.total.mats[id]=(H.total.mats[id]||0)+n;
  const k=H.swords.findIndex(s=>s.no===t.sword.no);if(k>=0)H.swords[k]={...H.swords[k],dur:t.after.dur,names:t.after.names,kills:t.after.kills};
  if(t.after.dur<=0)H.swords=H.swords.filter(s=>s.no!==t.sword.no);
  p.trip=null;el.over.hidden=true;S.phrase(4);render();
 };
}
setInterval(()=>{if(H.state==='play'&&!H.sheet&&el.over.hidden)render();},500);
el.over.hidden=false;el.over.innerHTML='<div class="sheet"><p class="tag">出陣の試作</p><h1>読みこみ中…</h1></div>';
loadArt('../assets/').finally(menu);
// for the QA: finish every trip now
H.skip=()=>{for(const p of H.parties)if(p.trip)p.trip.startAt=performance.now()-p.trip.secs*1000-10;render();};
