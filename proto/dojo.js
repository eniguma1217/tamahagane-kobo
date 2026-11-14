// 試作 13 道場（#34）：弟子を育てて刀を授ける。毎日ひとりに稽古をつけ（輪が重なった瞬間にタップ×5）、ほかの弟子は自分で稽古。
// 得意な形の刀を授けると相性◎。腕試しで道場破りと戦い（自動）、5日目は御前試合。数字は試作の仮のもの。
import {$,R,V,S,mySwords,unitOf,battleStep,sideDown,drawUnit,Fx,sharpCanvas,background,loadArt,header,clamp,wazaOf} from './kit.js';
const cv=$('#cv'),ctx=sharpCanvas(cv),fx=new Fx(),el={top:$('#top'),panel:$('#panel'),over:$('#over')};
const DAYS=5;
const PUPILS=[
 {name:'太郎丸',face:'👦',trait:'攻め',like:['odachi','tachi','naginata'],atk:1,vit:1,spd:1,grow:{atk:0.09,vit:0.04,spd:0.03}},
 {name:'小春',face:'👧',trait:'素早さ',like:['tanto','wakizashi','katana'],atk:0.9,vit:0.9,spd:1.1,grow:{atk:0.05,vit:0.04,spd:0.08}},
 {name:'源吾',face:'🧔',trait:'守り',like:['chokuto','yari','ken'],atk:0.9,vit:1.2,spd:0.9,grow:{atk:0.04,vit:0.09,spd:0.03}}
];
const D={state:'loading',day:1,pupils:[],swords:[],coach:null,duel:null,mini:null,coached:false,place:V.PLACES[0],log:[]};
window.__proto=D;
const lvOf=p=>1+Math.floor(p.exp/100);
const match=(p,s)=>s&&p.like.includes(s.form);
// the pupil with the sword, as a warrior
function warrior(p){const s=p.sword||D.swords[0];const u=unitOf(s,{skill:p.atk*(match(p,s)?1.2:1),vigor:p.vit,who:p.name});u.speed*=p.spd;u.face=p.face;return u;}
// the challenger of the day (the 5th day: the 御前試合)
function challenger(){const d=D.day,final=d>=DAYS,s={no:-99,name:final?'御前試合の剣豪':'道場破り',form:final?'tachi':'katana',grade:'B',stats:{sharp:60+d*6+(final?10:0),tough:60+d*5},hamon:'suguha'};
 const u=unitOf(s,{skill:0.9+d*0.06+(final?0.15:0),vigor:1+d*0.08+(final?0.3:0),who:s.name});u.kind='foe2';return u;}
function menu(){
 D.state='menu';const mine=mySwords(6);D.swords=mine.list;
 el.over.hidden=false;el.over.innerHTML=`<div class="sheet"><p class="tag">出陣の試作</p><h1>13 道場</h1>
  <p class="howto"><b>弟子を育てて、刀を授ける</b>。1日にひとりだけ、自分で稽古をつけられる（輪がまん中に重なった瞬間にタップ×5。うまいほど伸びる）。ほかの弟子は自分で稽古する。<br>弟子には<b>得意な形</b>があり、合う刀を授けると強い（相性◎）。<b>腕試し</b>で道場破りと戦える。<b>${DAYS}日目は御前試合</b>。</p>
  <p class="sw">${mine.own?'あなたの刀掛けの刀':'見本の刀'}：${mine.list.map(s=>`<b>${s.name}</b>（${R.form(s.form).name}）`).join('・')}</p>
  <div class="places"><button class="btn primary" data-start>道場をひらく</button></div><p class="note">本番のセーブは変わりません。</p></div>`;
 el.over.querySelector('[data-start]').onclick=()=>{S.unlock();D.day=1;D.coached=false;D.pupils=PUPILS.map((p,i)=>({...p,exp:0,sword:D.swords[i%D.swords.length]}));el.over.hidden=true;D.state='home';render();};
}
function render(){
 el.top.innerHTML=header('13 道場')+`<div class="fn"><span>${D.day}日目 / ${DAYS}日${D.day>=DAYS?'<em>御前試合</em>':''}</span></div>`;
 if(D.state!=='home')return;
 el.panel.innerHTML=`<div class="pupils">${D.pupils.map((p,i)=>`<div class="pupil"><div class="gh"><span class="gf">${p.face}</span><b>${p.name}</b><small>Lv${lvOf(p)}・${p.trait}・得意：${p.like.map(f=>R.form(f).name).join('・')}</small></div>
   <div class="stats3"><span>攻 <b>${p.atk.toFixed(2)}</b></span><span>体 <b>${p.vit.toFixed(2)}</b></span><span>速 <b>${p.spd.toFixed(2)}</b></span><i class="bar"><b style="width:${p.exp%100}%"></b></i></div>
   <button class="chip ${match(p,p.sword)?'on':''}" data-give="${i}"><b>${p.sword.name}</b><small>${R.form(p.sword.form).name}・必殺『${wazaOf(p.sword).name}』　相性${match(p,p.sword)?'◎':'－'}</small></button>
   <div class="row"><button class="btn small" data-coach="${i}" ${D.coached?'disabled':''}>稽古をつける</button><button class="btn small" data-duel="${i}">${D.day>=DAYS?'御前試合へ':'腕試し'}</button></div></div>`).join('')}</div>
  <div class="row"><button class="btn primary" data-next ${D.day>=DAYS?'disabled':''}>1日おわる</button></div>`;
 for(const b of el.panel.querySelectorAll('[data-give]'))b.onclick=()=>{S.tick();openGive(+b.dataset.give);};
 for(const b of el.panel.querySelectorAll('[data-coach]'))b.onclick=()=>{S.unlock();startMini(+b.dataset.coach);};
 for(const b of el.panel.querySelectorAll('[data-duel]'))b.onclick=()=>{S.unlock();startDuel(+b.dataset.duel);};
 el.panel.querySelector('[data-next]').onclick=()=>{S.tick();endDay();};
}
function openGive(i){
 const p=D.pupils[i];el.over.hidden=false;
 el.over.innerHTML=`<div class="sheet"><p class="tag">${p.face} ${p.name}に刀を授ける</p><h1>どの刀を？</h1><p class="howto">得意：${p.like.map(f=>R.form(f).name).join('・')}（合うと相性◎で攻撃×1.2）</p>
  <div class="pickgrid">${D.swords.map((s,k)=>`<button class="chip ${match(p,s)?'on':''}" data-sw="${k}"><b>${s.name}</b><small>${R.form(s.form).name}・攻撃力${V.atkOf(s)}　相性${match(p,s)?'◎':'－'}</small></button>`).join('')}</div>
  <div class="row"><button class="btn" data-cancel>やめる</button></div></div>`;
 for(const b of el.over.querySelectorAll('[data-sw]'))b.onclick=()=>{p.sword=D.swords[+b.dataset.sw];el.over.hidden=true;S.tick();render();};
 el.over.querySelector('[data-cancel]').onclick=()=>{el.over.hidden=true;};
}
// 稽古: five rings; tap as each meets the middle
function startMini(i){D.state='mini';D.mini={i,k:0,t:0,dur:1.0,scores:[]};el.panel.innerHTML=`<p class="hint">輪がまん中の輪に重なった瞬間にタップ！（5回）</p>`;}
function miniTap(){const m=D.mini;if(!m||m.done)return;const k=m.t/m.dur,sc=clamp(1-Math.abs(1-k)*4);m.scores.push(sc);
 fx.num(sc>0.8?'会心':sc>0.4?'よし':'はずれ',cv.W/2,cv.H*0.35,sc>0.8?'#ffe08a':'#fff',26);S.clang(0.6+sc*0.6);m.k++;m.t=0;if(m.k>=5)finishMini();}
function finishMini(q){
 const m=D.mini;m.done=true;const p=D.pupils[m.i],avg=q??m.scores.reduce((a,b)=>a+b,0)/m.scores.length,lv0=lvOf(p);
 const gain=0.5+1.5*avg;train(p,gain*1.6);D.coached=true;D.coachedIdx=m.i;
 setTimeout(()=>{D.state='home';D.mini=null;render();if(lvOf(p)>lv0)fx.num(`${p.name} Lv${lvOf(p)}！`,cv.W/2,cv.H*0.4,'#ffe08a',30);S.phrase(lvOf(p)>lv0?4:2);},500);
}
function train(p,k){p.exp+=Math.round(40*k);for(const s of ['atk','vit','spd'])p[s]+=p.grow[s]*k*(0.8+0.4*Math.random());}
function endDay(){D.pupils.forEach((p,i)=>{if(i!==D.coachedIdx)train(p,0.6);});D.day=Math.min(DAYS,D.day+1);D.coached=false;D.coachedIdx=null;fx.num(`${D.day}日目`,cv.W/2,cv.H*0.4,'#efe6d2',30);render();}
// 腕試し・御前試合: the pupil against the challenger, fought out on the canvas
function startDuel(i){const p=D.pupils[i],a=warrior(p),b=challenger();a.row=0;a.col=0;b.row=0;b.col=0;D.duel={p,a,b,flash:new Map(),done:false};D.state='duel';
 el.panel.innerHTML=`<p class="hint">${p.name}（${a.sword.name}）対 ${b.name}</p>`;}
function endDuel(){
 const d=D.duel,won=sideDown([d.b]);d.done=true;const final=D.day>=DAYS;train(d.p,won?0.8:0.4);
 setTimeout(()=>{
  if(final&&won){D.state='clear';el.over.hidden=false;el.over.innerHTML=`<div class="sheet"><p class="tag">13 道場</p><h1>御前試合に勝った！</h1><p class="howto">${d.p.name}（Lv${lvOf(d.p)}）が、${d.a.sword.name}で剣豪を破った。</p>
   <div class="places"><button class="btn primary" data-again>もう一度</button><a class="btn" href="./">ほかの試作へ</a><a class="btn" href="../">ゲームへ戻る</a></div><p class="note">気に入ったか、直してほしいところを教えてください。</p></div>`;el.over.querySelector('[data-again]').onclick=menu;S.phrase(5);return;}
  el.over.hidden=false;el.over.innerHTML=`<div class="sheet"><p class="tag">${final?'御前試合':'腕試し'}</p><h1>${won?`${d.p.name}の勝ち！`:`${d.p.name}の負け……`}</h1><p class="howto">${won?'腕が上がった。':'もっと稽古が要る。刀を変えるのもいい。'}${final&&!won?'もう一度、挑める。':''}</p><div class="places"><button class="btn primary" data-ok>道場へ戻る</button></div></div>`;
  el.over.querySelector('[data-ok]').onclick=()=>{el.over.hidden=true;D.state='home';D.duel=null;render();};
 },700);
}
cv.addEventListener('pointerdown',()=>{if(D.state==='mini')miniTap();});
let last=performance.now();
function frame(t){
 const dt=Math.min(0.05,(t-last)/1000);last=t;fx.update(dt);
 if(D.state==='mini'&&D.mini&&!D.mini.done){D.mini.t+=dt;if(D.mini.t>D.mini.dur*1.3){D.mini.scores.push(0);fx.num('おそい',cv.W/2,cv.H*0.35,'#ff9a8a',24);D.mini.k++;D.mini.t=0;if(D.mini.k>=5)finishMini();}}
 if(D.state==='duel'&&D.duel&&!D.duel.done){const d=D.duel;
  for(const b of battleStep([d.a],[d.b],dt)){const x0=b.from===d.a?cv.W*0.3:cv.W*0.7,x1=b.to===d.a?cv.W*0.3:cv.W*0.7,y=cv.H*0.5;fx.line(x0,y,x1,y,b.from===d.a?(b.waza?'143,211,255':'255,255,255'):'255,120,90');fx.num(String(b.dmg),x1,y-50,b.waza?'#bfe6ff':'#fff');d.flash.set(b.to,0.3);if(b.waza)fx.num(`『${b.waza}』`,cv.W/2,cv.H*0.25,'#bfe6ff',26);if(b.from===d.a)S.clang(0.8);}
  for(const [u,v] of d.flash){v-dt>0?d.flash.set(u,v-dt):d.flash.delete(u);}
  if(sideDown([d.a])||sideDown([d.b]))endDuel();}
 draw();requestAnimationFrame(frame);
}
function draw(){
 const W=cv.W,H=cv.H;ctx.clearRect(0,0,W,H);background(ctx,W,H,'touge',0.55);
 const r=Math.min(W,H)*0.12;
 if(D.state==='mini'&&D.mini){const m=D.mini,cx=W/2,cy=H*0.55,k=Math.min(1.3,m.t/m.dur),rr=r+r*2.2*(1-Math.min(1,k));
  ctx.strokeStyle='rgba(255,255,255,.5)';ctx.setLineDash([8,6]);ctx.lineWidth=4;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
  ctx.strokeStyle=k>0.9&&k<1.1?'#fff':'rgba(255,170,90,.95)';ctx.lineWidth=k>0.9&&k<1.1?10:6;ctx.beginPath();ctx.arc(cx,cy,rr,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle='#efe6d2';ctx.font='700 16px "Hiragino Mincho ProN",serif';ctx.textAlign='center';ctx.fillText(`${D.pupils[m.i].name}の稽古　${Math.min(5,m.k+1)}/5`,cx,H*0.15);}
 else if(D.state==='duel'&&D.duel){const d=D.duel;drawUnit(ctx,d.a,W*0.3,H*0.5,r,{flash:d.flash.get(d.a)||0});drawUnit(ctx,{...d.b,kind:'ally'},W*0.7,H*0.5,r,{flash:d.flash.get(d.b)||0});
  ctx.fillStyle='#efe6d2';ctx.font='700 14px "Hiragino Mincho ProN",serif';ctx.textAlign='center';ctx.fillText(d.p.name,W*0.3,H*0.5-r-12);ctx.fillText(d.b.name,W*0.7,H*0.5-r-12);}
 else if(D.state==='home'){ctx.fillStyle='rgba(239,230,210,.85)';ctx.font='700 20px "Hiragino Mincho ProN",serif';ctx.textAlign='center';ctx.fillText('道場',W/2,H*0.45);ctx.font='13px sans-serif';ctx.fillText('稽古をつけるか、腕試しをしよう',W/2,H*0.45+24);}
 fx.draw(ctx);
}
el.over.hidden=false;el.over.innerHTML='<div class="sheet"><p class="tag">出陣の試作</p><h1>読みこみ中…</h1></div>';
loadArt('../assets/').finally(()=>{menu();requestAnimationFrame(frame);});
D.finishMini=q=>finishMini(q);
