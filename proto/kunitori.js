// 試作 10 国取り（#34）：地図の国々へ、刀を持たせた部隊を送って取っていく。戦いは自動。取った国から毎日お金と素材。
// 敵がとなりの国から攻めてくることもある。刀は戦うたびに傷み、休むと少し戻る。数字は試作の仮のもの。
import {$,R,V,S,mySwords,unitOf,foeUnit,battle,sharpCanvas,loadArt,header,pick,yen,Fx} from './kit.js';
const cv=$('#cv'),ctx=sharpCanvas(cv),fx=new Fx(),el={top:$('#top'),panel:$('#panel'),over:$('#over')};
const LAND=[
 {id:'owari',name:'尾張',x:0.5,y:0.62,str:0,mat:'nami',gold:120},{id:'mino',name:'美濃',x:0.48,y:0.4,str:1,mat:'kugi',gold:100},{id:'mikawa',name:'三河',x:0.78,y:0.68,str:1,mat:'nami',gold:100},
 {id:'ise',name:'伊勢',x:0.3,y:0.8,str:2,mat:'kera',gold:140},{id:'omi',name:'近江',x:0.22,y:0.45,str:3,mat:'jou',gold:160},{id:'kai',name:'甲斐',x:0.82,y:0.3,str:3,mat:'kera',gold:160},
 {id:'echizen',name:'越前',x:0.25,y:0.16,str:4,mat:'chikusa',gold:200},{id:'yamashiro',name:'山城',x:0.08,y:0.66,str:4,mat:'nanban',gold:220},{id:'shinano',name:'信濃',x:0.6,y:0.12,str:5,mat:'hakusai',gold:260}
];
const ROADS=[['owari','mino'],['owari','mikawa'],['owari','ise'],['mino','omi'],['mino','kai'],['mino','shinano'],['mikawa','kai'],['ise','yamashiro'],['ise','omi'],['omi','echizen'],['omi','yamashiro'],['kai','shinano'],['echizen','shinano']];
const K={state:'loading',day:1,own:new Set(['owari']),land:LAND.map(l=>({...l})),swords:[],sel:null,pickSw:[],money:0,mats:{},news:'',clash:null};
window.__proto=K;
const land=id=>K.land.find(l=>l.id===id),near=id=>ROADS.flatMap(([a,b])=>a===id?[b]:b===id?[a]:[]);
const canAttack=id=>!K.own.has(id)&&near(id).some(n=>K.own.has(n));
const usable=()=>K.swords.filter(s=>s.dur>0);
// an enemy army for a province's strength: foes of the right place, at a depth
function army(str){const place=V.PLACES[str<=2?0:str<=4?1:2],n=Math.min(3,1+Math.floor(str/2));
 const list=Array.from({length:n},(_,i)=>{const f=foeUnit(i===0&&str>=4?place.boss:pick(place.foes),str+1,place);f.row=0;f.col=i;return f;});return list;}
function menu(){
 K.state='menu';const mine=mySwords(6);
 el.over.hidden=false;el.over.innerHTML=`<div class="sheet"><p class="tag">出陣の試作</p><h1>10 国取り</h1>
  <p class="howto">尾張から、となりの国へ<b>部隊</b>（刀1振＝1部隊、3つまで）を送って取っていく。戦いは自動。<b>取った国から毎日お金と素材</b>。<br>強い国ほど敵が多い。刀は戦うたびに傷み、<b>休む</b>と少し戻る。ときどき敵が攻めてくる。<b>9か国</b>を取れば天下統一。</p>
  <p class="sw">${mine.own?'あなたの刀掛けの刀':'見本の刀'}：${mine.list.map(s=>`<b>${s.name}</b>`).join('・')}</p>
  <div class="places"><button class="btn primary" data-start>はじめる</button></div><p class="note">本番のセーブは変わりません。</p></div>`;
 el.over.querySelector('[data-start]').onclick=()=>{S.unlock();K.swords=mine.list.map(s=>({...s,dur:V.maxDurability(s),max:V.maxDurability(s)}));K.own=new Set(['owari']);K.day=1;K.money=0;K.mats={};K.news='尾張から天下をめざせ。';K.state='play';el.over.hidden=true;render();};
}
function render(){
 const mats=Object.entries(K.mats);
 el.top.innerHTML=header('10 国取り')+`<div class="fn"><span>${K.day}日目　${K.own.size}/9か国　${yen(K.money)}文${mats.length?'・'+mats.map(([id,n])=>`${R.material(id).name}${n}`).join('・'):''}</span></div>`;
 const L=K.sel&&land(K.sel);
 el.panel.innerHTML=`<p class="hint">${K.news}</p>${L?`<div class="prov"><b>${L.name}</b>　${K.own.has(L.id)?'自分の国':`敵の兵 ${'●'.repeat(L.str)}`}　毎日 ${yen(L.gold)}文＋${R.material(L.mat).name}</div>`:'<div class="prov">となりの国をタップ</div>'}
  ${L&&canAttack(L.id)?`<div class="chips">${K.swords.map((s,i)=>`<button class="chip ${K.pickSw.includes(i)?'on':''} ${s.dur<=0?'dead':''}" data-sw="${i}" ${s.dur<=0?'disabled':''}><b>${s.name}</b><small>攻撃力${V.atkOf(s)}　耐久${'●'.repeat(s.dur)}${'○'.repeat(Math.max(0,s.max-s.dur))}</small></button>`).join('')}</div>`:''}
  <div class="row"><button class="btn" data-rest>休む（1日・耐久+2）</button><button class="btn primary" data-go ${L&&canAttack(L.id)&&K.pickSw.length?'':'disabled'}>攻める（${K.pickSw.length}部隊）</button></div>`;
 for(const b of el.panel.querySelectorAll('[data-sw]'))b.onclick=()=>{S.tick();const i=+b.dataset.sw;K.pickSw=K.pickSw.includes(i)?K.pickSw.filter(x=>x!==i):K.pickSw.length<3?[...K.pickSw,i]:K.pickSw;render();};
 el.panel.querySelector('[data-rest]').onclick=()=>{S.tick();for(const s of K.swords)if(s.dur>0)s.dur=Math.min(s.max,s.dur+2);nextDay('休んで、刀を手入れした。');};
 el.panel.querySelector('[data-go]').onclick=()=>{S.unlock();attack(K.sel,K.pickSw);};
}
function attack(id,idx){
 const L=land(id),swords=idx.map(i=>K.swords[i]).filter(s=>s&&s.dur>0);if(!swords.length||!canAttack(id))return null;
 const A=swords.map((s,k)=>{const u=unitOf(s);u.row=0;u.col=k;return u;}),B=army(L.str),r=battle(A,B);
 for(const s of swords)s.dur=Math.max(0,s.dur-(r.win?1:2));
 K.clash={L,win:r.win,t:0,blows:r.log.length,A,B};K.pickSw=[];S.phrase(r.win?4:1);
 if(r.win){K.own.add(id);K.money+=L.gold;K.mats[L.mat]=(K.mats[L.mat]||0)+1;}
 const msg=r.win?`${L.name}を取った！（${r.log.length}合の戦い）`:`${L.name}を攻めたが、押し返された……`;
 setTimeout(()=>{K.clash=null;nextDay(msg);},1500);render();return r.win;
}
function nextDay(msg){
 K.day++;let income=0;for(const id of K.own){const L=land(id);income+=Math.round(L.gold*0.5);K.mats[L.mat]=(K.mats[L.mat]||0)+(Math.random()<0.3?1:0);}K.money+=income;
 let news=`${msg}　国々から ${yen(income)}文。`;
 // sometimes a neighbour strikes back at a border province (not 尾張); the best sword left defends it
 const border=[...K.own].filter(id=>id!=='owari'&&near(id).some(n=>!K.own.has(n)));
 if(border.length&&Math.random()<0.25){const id=pick(border),from=land(pick(near(id).filter(n=>!K.own.has(n)))),def=usable().sort((a,b)=>V.atkOf(b)-V.atkOf(a))[0];
  const r=def?battle([Object.assign(unitOf(def),{row:0,col:0})],army(Math.max(1,from.str-1))):{win:false};if(def)def.dur=Math.max(0,def.dur-1);
  if(!r.win){K.own.delete(id);news+=`　${from.name}の軍が攻めてきて、${land(id).name}を取られた！`;}else news+=`　${from.name}の軍を${def.name}が追い返した。`;}
 K.news=news;
 if(K.own.size===9)return end(true);if(!usable().length)return end(false);
 render();
}
function end(win){K.state=win?'clear':'lost';el.over.hidden=false;el.over.innerHTML=`<div class="sheet"><p class="tag">10 国取り</p><h1>${win?'天下統一！':'刀が尽きた……'}</h1><p class="howto">${K.day}日　${K.own.size}/9か国　${yen(K.money)}文</p>
 <div class="places"><button class="btn primary" data-again>もう一度</button><a class="btn" href="./">ほかの試作へ</a><a class="btn" href="../">ゲームへ戻る</a></div><p class="note">気に入ったか、直してほしいところを教えてください。</p></div>`;el.over.querySelector('[data-again]').onclick=menu;}
cv.addEventListener('pointerdown',e=>{if(K.state!=='play'||K.clash)return;cv.refit?.();const r=cv.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
 const hit=K.land.find(l=>Math.hypot(x-l.x*cv.W,y-(0.06+l.y*0.88)*cv.H)<30);if(hit){S.tick();K.sel=hit.id;K.pickSw=K.pickSw.filter(i=>K.swords[i].dur>0);render();}});
let last=performance.now();
function frame(t){const dt=Math.min(0.05,(t-last)/1000);last=t;fx.update(dt);if(K.clash)K.clash.t+=dt;draw(t/1000);requestAnimationFrame(frame);}
function draw(time){
 const W=cv.W,H=cv.H,P=l=>({x:l.x*W,y:(0.06+l.y*0.88)*H});ctx.clearRect(0,0,W,H);
 const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#3a2c1c');g.addColorStop(1,'#241a10');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
 if(K.state==='menu'||K.state==='loading')return;
 ctx.lineWidth=3;for(const [a,b] of ROADS){const p=P(land(a)),q=P(land(b));ctx.strokeStyle='rgba(239,230,210,.25)';ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();}
 for(const l of K.land){const p=P(l),mine=K.own.has(l.id),att=canAttack(l.id),sel=K.sel===l.id;
  ctx.fillStyle=mine?'#c99a3a':att?'#8a2a1f':'#4a2a22';ctx.strokeStyle=sel?'#fff':att?'#ffb08a':'rgba(239,230,210,.4)';ctx.lineWidth=sel?4:2;
  ctx.beginPath();ctx.arc(p.x,p.y,24+(att&&!mine?2*Math.sin(time*4):0),0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.fillStyle='#fff';ctx.font='700 14px "Hiragino Mincho ProN",serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(l.name,p.x,p.y-1);
  if(!mine){ctx.fillStyle='#ffd1a8';ctx.font='10px sans-serif';ctx.fillText('●'.repeat(l.str),p.x,p.y+34);}}
 if(K.clash){const c=K.clash,p=P(c.L),k=Math.min(1,c.t/1.2);ctx.save();ctx.globalAlpha=1-Math.max(0,c.t-1.2)/0.3;
  for(let i=0;i<6;i++){const a=time*8+i;ctx.strokeStyle=i%2?'rgba(255,255,255,.9)':'rgba(255,120,90,.9)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(p.x+Math.cos(a)*40,p.y+Math.sin(a)*40);ctx.lineTo(p.x-Math.cos(a)*40,p.y-Math.sin(a)*40);ctx.stroke();}
  if(k>=1){ctx.font='800 26px "Hiragino Mincho ProN",serif';ctx.lineWidth=5;ctx.strokeStyle='rgba(0,0,0,.7)';ctx.strokeText(c.win?'勝ち！':'負け…',p.x,p.y-46);ctx.fillStyle=c.win?'#ffe08a':'#ff9a8a';ctx.fillText(c.win?'勝ち！':'負け…',p.x,p.y-46);}
  ctx.restore();}
 fx.draw(ctx);
}
el.over.hidden=false;el.over.innerHTML='<div class="sheet"><p class="tag">出陣の試作</p><h1>読みこみ中…</h1></div>';
loadArt('../assets/').finally(()=>{menu();requestAnimationFrame(frame);});
K.attack=(id,idx)=>attack(id,idx);K.rest=()=>{for(const s of K.swords)if(s.dur>0)s.dur=Math.min(s.max,s.dur+2);nextDay('休んだ。');};
