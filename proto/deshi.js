// 試作 道場＋派遣（#36、オーナー「道場と派遣を組み合わせたい」→ 試作を先に・自分で戦う出陣はなくす・刀を打つと日が進む・稽古＋派遣で育つ）。
// 弟子を育てて刀を授け、送り出す。刀を1振打つと1日すすみ、旅の便りが届き、何日かで土産話と戦利品を持って帰る。
// 試作では「刀を打つ」はボタンで、新しい刀が1振できる。本番のセーブは読むだけ。数字は試作の仮のもの。
import {$,R,V,S,mySwords,unitOf,foeUnit,battle,loadArt,header,pick,yen,wazaOf,clamp,sharpCanvas} from './kit.js';
import {startBanjo,boardFighter,FORM_NOTE} from './banjo.js';
const el={top:$('#top'),panel:$('#panel'),over:$('#over')};
const PUPILS=[
 {name:'太郎丸',face:'👦',trait:'攻め',like:['odachi','tachi','naginata'],atk:1,vit:1,spd:1,grow:{atk:0.09,vit:0.04,spd:0.03}},
 {name:'小春',face:'👧',trait:'素早さ',like:['tanto','wakizashi','katana'],atk:0.9,vit:0.9,spd:1.15,grow:{atk:0.05,vit:0.04,spd:0.08}},
 {name:'源吾',face:'🧔',trait:'守り',like:['chokuto','yari','ken'],atk:0.9,vit:1.25,spd:0.9,grow:{atk:0.04,vit:0.09,spd:0.03}}
];
const DAYS_OF={touge:3,kosenjo:4,oniyama:5};
const Z={state:'loading',day:1,pupils:[],rack:[],total:{money:0,mats:{}},news:[],coached:false,mini:null,cleared:false,nextNo:-100};
window.__proto=Z;
const lvOf=p=>1+Math.floor(p.exp/100);
const match=(p,s)=>!!s&&p.like.includes(s.form);
const swordBusy=s=>Z.pupils.some(p=>p.trip&&p.trip.sword===s);
function train(p,k){const lv0=lvOf(p);p.exp+=Math.round(40*k);for(const s of ['atk','vit','spd'])p[s]+=p.grow[s]*k*(0.8+0.4*Math.random());return lvOf(p)>lv0;}
// the pupil with this sword, as a warrior
function warrior(p,s){const u=unitOf(s,{skill:p.atk*(match(p,s)?1.2:1),vigor:p.vit,who:p.name});u.speed*=p.spd;return u;}
// the whole trip is decided when the pupil leaves; one day of the road comes with each sword forged
function plan(p,s,placeId){
 const place=V.placeOf(placeId),days=DAYS_OF[placeId],u=warrior(p,s),lines=[],bag={money:0,mats:{}};let fell=false,broke=false,cleared=0,boss=false,bossAt=0;
 const sw={dur:V.durOf(s),kills:{...(s.kills||{})},names:[...(s.names||[])]};
 for(let d=1;d<=days;d++){
  // the boss is not fought here: on its day the player commands the pupil on the board (#38)
  if(d===days&&days>=4){bossAt=d;break;}
  const key=pick(place.foes),f=foeUnit(key,d+lvOf(p)-1,place);u.ki=0;
  const r=battle([u],[f]),mine=r.log.filter(b=>b.from===u),big=mine.find(b=>b.waza);sw.dur=Math.max(0,sw.dur-(f.boss?2:1));
  if(!r.win){fell=true;lines.push(`${d}日目：${f.name}${f.boss?'（強敵）':''}に押されて、引き返すことに……`);break;}
  cleared=d;if(f.boss)boss=true;const loot=V.rollLoot(Math.random,place,d,f.boss);bag.money+=loot.money;for(const m of loot.mats)bag.mats[m]=(bag.mats[m]||0)+1;
  const t=V.earnTitle(sw,{key,boss:f.boss});sw.kills=t.kills;sw.names=t.names;
  lines.push(`${d}日目：${f.name}${f.boss?'（強敵）':''}を${big?`『${big.waza}』で`:`${mine.length}太刀で`}倒した。${loot.mats.map(m=>R.material(m).name).join('・')}${loot.mats.length?'と':''}${yen(loot.money)}文。${t.title?`刀は「${t.title}」と呼ばれはじめた。`:''}`);
  if(sw.dur<=0){broke=true;lines.push(`${s.name}が折れた。${p.name}は帰り道を急いだ。`);break;}
 }
 if(fell){bag.money=Math.floor(bag.money/2);for(const k in bag.mats)bag.mats[k]=Math.floor(bag.mats[k]/2);}
 return {place,sword:s,days:bossAt||Math.max(1,lines.length),day0:Z.day,lines,bag,fell,broke,boss,cleared,sw,exp:0.6*cleared,bossAt,bossDone:false,lv:lvOf(p)};
}
const daysGone=p=>Z.day-p.trip.day0,atBoss=p=>p.trip&&p.trip.bossAt&&!p.trip.bossDone&&daysGone(p)>=p.trip.bossAt,home=p=>p.trip&&daysGone(p)>=p.trip.days&&!atBoss(p);
// a new sword from the forge (in the prototype: steel and the steps at random)
function forgeOne(){
 const form=pick(['katana','katana','tanto','wakizashi','tachi','yari','odachi','chokuto']),kawa=pick(['nami','nami','jou','oroshi','kera','kugi']),hamon=pick(Object.keys(R.HAMON).filter(h=>h!=='hitatsura'));
 const q=0.6+Math.random()*0.35,b={structure:'kobuse',kawa,shin:'houcho'},st=R.expectStats(b,form,q,R.synergyOf(kawa,'houcho',form)),ov=Math.round((st.sharp+st.tough)/2);
 const s={no:Z.nextNo--,name:`無銘の${R.form(form).name}`,form,kawa,shin:'houcho',grade:R.gradeFor(ov).id,stats:st,hamon,profile:R.canonicalHamon(hamon,Math.floor(Math.random()*99)),steps:{hamon:q}};
 s.dur=V.maxDurability(s);return s;
}
function menu(){
 Z.state='menu';const mine=mySwords(6);
 el.over.hidden=false;el.over.innerHTML=`<div class="sheet"><p class="tag">出陣の試作</p><h1>道場＋派遣</h1>
  <p class="howto"><b>弟子を育てて、刀を授けて、送り出す。</b>自分では戦わない。<br>
  ・<b>刀を1振打つと1日すすむ</b>（試作ではボタン。新しい刀が刀掛けにかかる）。旅に出た弟子から便りが届き、何日かで土産話と戦利品を持って帰る。<br>
  ・1日にひとり<b>稽古をつけられる</b>：<b>盤の上で師範代と立ち合う</b>（赤いマスは次の攻撃。動いてよけるか、構えるか、先に斬る）。旅の経験でも育つ。得意な形の刀なら相性◎。<br>
  ・旅の最後の<b>強敵の日</b>は、自分で弟子に指示を出して盤の上で立ち合う。<br>
  ・目標：<b>鬼の山の大鬼を倒して帰ってくる</b>。</p>
  <p class="sw">${mine.own?'あなたの刀掛けの刀':'見本の刀'}から：${mine.list.map(s=>`<b>${s.name}</b>`).join('・')}</p>
  <div class="places"><button class="btn primary" data-start>道場をひらく</button></div><p class="note">本番のセーブは変わりません。</p></div>`;
 el.over.querySelector('[data-start]').onclick=()=>{S.unlock();Z.day=1;Z.cleared=false;Z.total={money:0,mats:{}};Z.news=['道場をひらいた。弟子が3人いる。'];Z.coached=false;
  Z.rack=mine.list.map(s=>({...s,dur:V.durOf(s)}));Z.pupils=PUPILS.map((p,i)=>({...p,exp:0,sword:Z.rack[i%Z.rack.length]||null,trip:null}));el.over.hidden=true;Z.state='play';render();};
}
function render(){
 const mats=Object.entries(Z.total.mats);
 el.top.innerHTML=header('道場＋派遣')+`<div class="fn"><span>${Z.day}日目　持ち帰った合計：${yen(Z.total.money)}文${mats.length?'・'+mats.map(([id,n])=>`${R.material(id).name}${n}`).join('・'):''}${Z.cleared?'　<em>大鬼を倒した</em>':''}</span></div>`;
 el.panel.innerHTML=`<div class="news">${Z.news.slice(-3).map(n=>`<p>${n}</p>`).join('')}</div>
  <div class="pupils">${Z.pupils.map((p,i)=>{const t=p.trip;
   return `<div class="pupil ${t?(home(p)?'back':'away'):''}"><div class="gh"><span class="gf">${p.face}</span><b>${p.name}</b><small>Lv${lvOf(p)}・${p.trait}・得意：${p.like.map(f=>R.form(f).name).join('・')}</small></div>
    <div class="stats3"><span>攻 <b>${p.atk.toFixed(2)}</b></span><span>体 <b>${p.vit.toFixed(2)}</b></span><span>速 <b>${p.spd.toFixed(2)}</b></span><i class="bar"><b style="width:${p.exp%100}%"></b></i></div>
    ${t?`<p class="gt">${t.place.name}へ（${t.sword.name}）　${home(p)?'<b class="ok">帰ってきた！</b>':atBoss(p)?'<b class="bad">強敵の日</b>':`${daysGone(p)}/${t.days}日`}</p><i class="bar"><b style="width:${Math.round(100*Math.min(1,daysGone(p)/t.days))}%"></b></i>
      <p class="letter">${atBoss(p)?`<b class="bad">${V.FOES[t.place.boss].name}と対峙した！</b>`:t.lines.slice(0,Math.min(daysGone(p),t.lines.length)).at(-1)||'旅立った。'}</p>${atBoss(p)?`<button class="btn primary" data-boss="${i}">強敵と立ち合う（指示を出す）</button>`:home(p)?`<button class="btn primary" data-hear="${i}">話を聞く</button>`:''}`
    :`<button class="chip ${match(p,p.sword)?'on':''}" data-give="${i}"><b>${p.sword?p.sword.name:'刀がない'}</b><small>${p.sword?`${R.form(p.sword.form).name}・攻撃力${V.atkOf(p.sword)}・耐久${V.durOf(p.sword)}・必殺『${wazaOf(p.sword).name}』　相性${match(p,p.sword)?'◎':'－'}`:'刀を授けよう'}</small></button>
      <div class="row"><button class="btn small" data-coach="${i}" ${Z.coached||!p.sword?'disabled':''}>稽古をつける</button><button class="btn small primary" data-send="${i}" ${p.sword&&V.durOf(p.sword)>0?'':'disabled'}>送り出す</button></div>`}</div>`;}).join('')}</div>
  <div class="row sticky"><button class="btn primary" data-forge>刀を打つ（1日すすむ）</button></div>`;
 for(const b of el.panel.querySelectorAll('[data-give]'))b.onclick=()=>{S.tick();openGive(+b.dataset.give);};
 for(const b of el.panel.querySelectorAll('[data-coach]'))b.onclick=()=>{S.unlock();openKeiko(+b.dataset.coach);};
 for(const b of el.panel.querySelectorAll('[data-send]'))b.onclick=()=>{S.tick();openSend(+b.dataset.send);};
 for(const b of el.panel.querySelectorAll('[data-hear]'))b.onclick=()=>{S.tick();hear(+b.dataset.hear);};
 for(const b of el.panel.querySelectorAll('[data-boss]'))b.onclick=()=>{S.unlock();bossFight(+b.dataset.boss);};
 el.panel.querySelector('[data-forge]').onclick=()=>{S.unlock();nextDay();};
}
function nextDay(){
 const s=forgeOne();Z.rack.push(s);Z.day++;Z.coached=false;S.clang(1);
 const news=[`${Z.day}日目：${s.name}（${R.form(s.form).name}・攻撃力${V.atkOf(s)}）を打った。`];
 for(const p of Z.pupils){if(!p.trip){if(train(p,0.35))news.push(`${p.name}がひとりで稽古して、Lv${lvOf(p)}になった。`);continue;}
  const g=daysGone(p);if(atBoss(p)&&g===p.trip.bossAt)news.push(`${p.name}が${V.FOES[p.trip.place.boss].name}と対峙した！ 指示を出そう。`);else if(home(p)&&g===p.trip.days)news.push(`${p.name}が${p.trip.place.name}から帰ってきた！`);else if(g<p.trip.days)news.push(`${p.name}から便り：${p.trip.lines[g-1]||'道中は静かだ。'}`);}
 Z.news.push(...news);render();
}
function openGive(i){
 const p=Z.pupils[i];el.over.hidden=false;
 el.over.innerHTML=`<div class="sheet"><p class="tag">${p.face} ${p.name}に刀を授ける</p><h1>どの刀を？</h1><p class="howto">得意：${p.like.map(f=>R.form(f).name).join('・')}（合うと相性◎で攻撃×1.2）</p>
  <div class="pickgrid">${Z.rack.map((s,k)=>`<button class="chip ${match(p,s)?'on':''}" data-sw="${k}" ${swordBusy(s)||V.durOf(s)<=0?'disabled':''}><b>${s.name}</b><small>${R.form(s.form).name}・攻撃力${V.atkOf(s)}・耐久${V.durOf(s)}${V.durOf(s)<=0?'（折れた）':''}　相性${match(p,s)?'◎':'－'}</small></button>`).join('')}</div>
  <div class="row"><button class="btn" data-cancel>やめる</button></div></div>`;
 for(const b of el.over.querySelectorAll('[data-sw]'))b.onclick=()=>{p.sword=Z.rack[+b.dataset.sw];el.over.hidden=true;S.tick();render();};
 el.over.querySelector('[data-cancel]').onclick=()=>{el.over.hidden=true;};
}
function openSend(i,place='touge'){
 const p=Z.pupils[i];el.over.hidden=false;
 el.over.innerHTML=`<div class="sheet"><p class="tag">${p.face} ${p.name}（Lv${lvOf(p)}）を送り出す</p><h1>どこへ？</h1><p class="howto">刀：<b>${p.sword.name}</b>（攻撃力${V.atkOf(p.sword)}・耐久${V.durOf(p.sword)}）　相性${match(p,p.sword)?'◎':'－'}</p>
  <div class="pickgrid">${V.PLACES.map(pl=>`<button class="chip ${place===pl.id?'on':''}" data-pl="${pl.id}"><b>${pl.name}</b><small>${DAYS_OF[pl.id]}日（刀を${DAYS_OF[pl.id]}振打つあいだ）${DAYS_OF[pl.id]>=4?'・最後に強敵':''}</small></button>`).join('')}</div>
  <div class="row"><button class="btn" data-cancel>やめる</button><button class="btn primary" data-go>出発</button></div></div>`;
 for(const b of el.over.querySelectorAll('[data-pl]'))b.onclick=()=>{S.tick();openSend(i,b.dataset.pl);};
 el.over.querySelector('[data-cancel]').onclick=()=>{el.over.hidden=true;};
 el.over.querySelector('[data-go]').onclick=()=>{p.trip=plan(p,p.sword,place);Z.news.push(`${p.name}が${p.trip.place.name}へ旅立った。`);el.over.hidden=true;S.phrase(2);render();};
}
function hear(i){
 const p=Z.pupils[i],t=p.trip,mats=Object.entries(t.bag.mats).filter(([,n])=>n>0),lv0=lvOf(p);
 train(p,t.exp+0.2);const up=lvOf(p)>lv0;
 el.over.hidden=false;el.over.innerHTML=`<div class="sheet"><p class="tag">${p.face} ${p.name}の土産話</p><h1>${t.fell?'引き返してきた':t.broke?'刀が折れた……':t.boss?'強敵を倒して帰ってきた！':'無事に帰ってきた'}</h1>
  <div class="story">${t.lines.map(l=>`<p>${l}</p>`).join('')}</div>
  <p class="howto">戦利品：<b>${yen(t.bag.money)}文</b>${mats.map(([id,n])=>`・<b>${R.material(id).name}×${n}</b>`).join('')}${t.fell?'（半分を落とした）':''}<br>${p.name}：経験 +${Math.round(40*(t.exp+0.2))}${up?`　<b class="ok">Lv${lvOf(p)}に上がった！</b>`:''}<br>${t.sword.name}：耐久 ${V.durOf(t.sword)} → ${t.sw.dur}${t.sw.names.length>(t.sword.names||[]).length?`　二つ名「${t.sw.names.at(-1)}」`:''}</p>
  <div class="places"><button class="btn primary" data-take>受け取る</button></div></div>`;
 el.over.querySelector('[data-take]').onclick=()=>{
  Z.total.money+=t.bag.money;for(const [id,n] of mats)Z.total.mats[id]=(Z.total.mats[id]||0)+n;
  Object.assign(t.sword,{dur:t.sw.dur,kills:t.sw.kills,names:t.sw.names});
  if(t.boss&&t.place.id==='oniyama'&&!Z.cleared){Z.cleared=true;Z.news.push(`${p.name}が鬼の山の大鬼を倒した！`);}
  p.trip=null;el.over.hidden=true;S.phrase(up?5:4);render();
  if(Z.cleared&&Z.state==='play'){Z.state='clear';setTimeout(()=>{el.over.hidden=false;el.over.innerHTML=`<div class="sheet"><p class="tag">道場＋派遣</p><h1>鬼の山の大鬼を倒した！</h1><p class="howto">${Z.day}日目。${p.name}（Lv${lvOf(p)}）が、${t.sword.name}で成しとげた。持ち帰った合計 ${yen(Z.total.money)}文。</p>
   <div class="places"><button class="btn primary" data-cont>続ける</button><button class="btn" data-again>はじめから</button><a class="btn" href="./">ほかの試作へ</a><a class="btn" href="../">ゲームへ戻る</a></div><p class="note">気に入ったか、直してほしいところを教えてください。</p></div>`;
   el.over.querySelector('[data-cont]').onclick=()=>{el.over.hidden=true;Z.state='play';render();};el.over.querySelector('[data-again]').onclick=menu;},400);}
 };
}
// 稽古 (#38): a duel on the board with the 師範代; the better it goes, the more the pupil grows. The sword is not worn.
function openKeiko(i){
 const p=Z.pupils[i];if(!p.sword)return;const lv=lvOf(p),me=boardFighter(p,p.sword,lv);
 const foe={name:'師範代',face:'🥋',form:'katana',power:16+lv*5,hp:170+lv*45};foe.maxHp=foe.hp;
 startBanjo({me,foe,title:`${p.face} ${p.name}の稽古（${R.form(p.sword.form).name}：${FORM_NOTE[p.sword.form]||''}）`,moves:lv>=3?['kesa','tsuki','fumi']:['kesa','tsuki'],rounds:8,onEnd:r=>{
  const score=clamp(r.dealt/foe.maxHp*0.6+(1-r.taken/me.maxHp)*0.3+(r.win?0.15:0)+r.guards*0.03),up=train(p,(0.5+1.5*score)*1.6);Z.coached=true;
  Z.news.push(`${p.name}に稽古をつけた（${Math.round(score*100)}点${r.win?'・師範代から一本':''}）。${up?`Lv${lvOf(p)}に上がった！`:''}`);
  $('#over').hidden=true;S.phrase(up?4:2);render();}});
}
// the boss of a trip (#38): the player commands the pupil on the board
function bossFight(i){
 const p=Z.pupils[i],t=p.trip,key=t.place.boss,F=V.FOES[key],u=foeUnit(key,t.bossAt+t.lv-1,t.place),me=boardFighter(p,t.sword,lvOf(p));
 me.hp=Math.round(me.hp*clamp(t.sw.dur/Math.max(1,V.maxDurability(t.sword)),0.5,1));
 const foe={name:F.name,face:F.face,key,form:'katana',power:u.power*0.9,hp:Math.round(u.hp*0.55)};foe.maxHp=foe.hp;
 startBanjo({me,foe,title:`${p.face} ${p.name}対${F.name}（${t.place.name}・${t.bossAt}日目）`,moves:['kesa','tsuki','nagi','fumi'],onEnd:r=>{
  t.sw.dur=Math.max(0,t.sw.dur-2);
  if(r.win){t.boss=true;t.cleared=t.bossAt;t.exp+=1.2;const loot=V.rollLoot(Math.random,t.place,t.bossAt,true);t.bag.money+=loot.money;for(const m of loot.mats)t.bag.mats[m]=(t.bag.mats[m]||0)+1;
   const ti=V.earnTitle(t.sw,{key,boss:true});t.sw.kills=ti.kills;t.sw.names=ti.names;
   t.lines.push(`${t.bossAt}日目：${F.name}（強敵）を${r.rounds}手で倒した！ ${loot.mats.map(m=>R.material(m).name).join('・')}と${yen(loot.money)}文。${ti.title?`刀は「${ti.title}」と呼ばれはじめた。`:''}`);}
  else{t.fell=true;t.bag.money=Math.floor(t.bag.money/2);for(const k in t.bag.mats)t.bag.mats[k]=Math.floor(t.bag.mats[k]/2);t.lines.push(`${t.bossAt}日目：${F.name}（強敵）に押し返された……`);}
  t.bossDone=true;Z.news.push(r.win?`${p.name}が${F.name}を倒した！`:`${p.name}は${F.name}に敗れて引き返した。`);$('#over').hidden=true;render();}});
}
// 稽古（前の版）: five rings in a small canvas on the sheet; tap as each meets the middle
function openMini(i){
 const p=Z.pupils[i];el.over.hidden=false;el.over.innerHTML=`<div class="sheet"><p class="tag">${p.face} ${p.name}の稽古</p><h1>輪が重なった瞬間にタップ</h1><canvas id="mini" style="width:100%;height:260px;display:block;touch-action:none"></canvas><p class="howto" id="mres">5回</p></div>`;
 const cv=$('#mini'),ctx=sharpCanvas(cv);Z.mini={i,k:0,t:0,dur:1,scores:[],cv,ctx,done:false};
 cv.addEventListener('pointerdown',miniTap);
}
function miniTap(){const m=Z.mini;if(!m||m.done)return;const k=m.t/m.dur,sc=clamp(1-Math.abs(1-k)*4);m.scores.push(sc);m.flash={text:sc>0.8?'会心':sc>0.4?'よし':'はずれ',age:0};S.clang(0.6+sc*0.6);m.k++;m.t=0;if(m.k>=5)finishMini();}
function finishMini(q){
 const m=Z.mini;m.done=true;const p=Z.pupils[m.i],avg=q??m.scores.reduce((a,b)=>a+b,0)/m.scores.length,up=train(p,(0.5+1.5*avg)*1.6);Z.coached=true;
 Z.news.push(`${p.name}に稽古をつけた（${Math.round(avg*100)}点）。${up?`Lv${lvOf(p)}に上がった！`:''}`);
 $('#mres').textContent=`${Math.round(avg*100)}点　${up?`Lv${lvOf(p)}に上がった！`:'経験が増えた'}`;S.phrase(up?4:2);
 setTimeout(()=>{el.over.hidden=true;Z.mini=null;render();},700);
}
let last=performance.now();
function frame(t){const dt=Math.min(0.05,(t-last)/1000);last=t;const m=Z.mini;
 if(m&&!m.done){m.t+=dt;if(m.t>m.dur*1.3){m.scores.push(0);m.flash={text:'おそい',age:0};m.k++;m.t=0;if(m.k>=5)finishMini();}}
 if(m&&m.cv.W){const {ctx,cv}=m,W=cv.W,H=cv.H,r=Math.min(W,H)*0.16,cx=W/2,cy=H/2,k=Math.min(1.3,m.t/m.dur),rr=r+r*2.2*(1-Math.min(1,k));ctx.clearRect(0,0,W,H);
  ctx.strokeStyle='rgba(255,255,255,.5)';ctx.setLineDash([8,6]);ctx.lineWidth=4;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
  if(!m.done){ctx.strokeStyle=k>0.9&&k<1.1?'#fff':'rgba(255,170,90,.95)';ctx.lineWidth=k>0.9&&k<1.1?10:6;ctx.beginPath();ctx.arc(cx,cy,rr,0,Math.PI*2);ctx.stroke();}
  if(m.flash&&(m.flash.age+=dt)<0.7){ctx.fillStyle='#ffe08a';ctx.font='800 26px "Hiragino Mincho ProN",serif';ctx.textAlign='center';ctx.fillText(m.flash.text,cx,cy-r-20);}
  ctx.fillStyle='#efe6d2';ctx.font='14px sans-serif';ctx.textAlign='center';ctx.fillText(`${Math.min(5,m.k+1)}/5`,cx,H-10);}
 requestAnimationFrame(frame);}
el.over.hidden=false;el.over.innerHTML='<div class="sheet"><p class="tag">出陣の試作</p><h1>読みこみ中…</h1></div>';
loadArt('../assets/').finally(()=>{menu();requestAnimationFrame(frame);});
Z.finishMini=q=>finishMini(q);Z.nextDay=()=>nextDay();
// for the QA: put pupil i on a trip that has reached its boss today
Z.bossToday=(i,placeId='kosenjo')=>{const p=Z.pupils[i];for(let k=0;k<20;k++){p.trip=plan(p,p.sword,placeId);if(p.trip.bossAt)break;}if(!p.trip.bossAt){p.trip.bossAt=p.trip.days=Math.max(1,p.trip.lines.length)+1;p.trip.fell=false;p.trip.broke=false;}p.trip.day0=Z.day-p.trip.bossAt;render();};
