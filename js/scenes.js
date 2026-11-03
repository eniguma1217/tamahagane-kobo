// The forging steps. Each scene: enter(), update(dt), draw(ctx,w,h,t), down/move/up(point), qa() for the browser check.
// They read and write api.run, talk through api.say/api.pop, and call api.next() when the step is over.
// All scoring comes from rules.js.
import * as R from './rules.js';
import * as D from './draw.js';
import * as S from './sound.js';
import {artBox} from './art.js';

const after=(api,ms,fn)=>api.later(ms,fn);

// ---------------- 熱する ----------------
export class Heat{
 constructor(api){this.api=api;this.name='heat';}
 enter(){
  const c=R.combine(this.api.run.kawa,this.api.run.shin);
  Object.assign(this,{temp:R.HEAT.start,blowing:false,done:false,half:c.heatHalf,pump:0,sparks:new D.Sparks()});
  this.api.say(`押しているあいだ、ふいごで火を強くする。鋼が<b>山吹色</b>に光ったら、指をはなせ。${c.kawa.id==='jou'?'上玉鋼は色にきびしいぞ。':''}`);
  this.api.controls([{label:'押して ふいごを吹く',hold:true,primary:true}]);
 }
 box(w,h){return artBox('bg-heat',w,h)||D.hearthBox(w,h);}
 down(){if(this.done)return;this.blowing=true;S.startBlow();}
 up(){
  if(this.done||!this.blowing)return;this.blowing=false;S.stopBlow();
  if(this.temp<R.HEAT.tooEarly){this.api.say('まだ鋼が暗い。もう一度、長く押して吹け。');return;}
  this.finish();
 }
 finish(){
  this.done=true;this.blowing=false;S.stopBlow();
  const r=R.heatScore(this.temp,this.half);this.api.run.heat={temp:Math.round(this.temp),...r};
  this.api.pop(r.label,r.grade);S.tick();
  this.api.say({best:'いい色だ！ 鋼がよく沸いた。',good:'よし、いい色だ。',weak:r.label==='ぬるい'?'少しぬるいな。叩くときに苦労するぞ。':'少し熱すぎたな。',bad:'これは色が悪い……。',burn:'沸かしすぎだ！ 鋼が少し燃えてしまった。'}[r.grade],r.grade==='best'||r.grade==='good'?'happy':'normal');
  this.api.controls([]);after(this.api,1500,()=>this.api.next());
 }
 update(dt){
  if(!this.done){
   if(this.blowing){this.temp+=R.heatRate(this.temp)*dt;this.pump+=dt*7;S.blowLevel((this.temp-650)/650);if(this.temp>=R.HEAT.burn){this.temp=R.HEAT.burn;this.finish();}}
   else this.temp=Math.max(R.HEAT.start,this.temp-R.heatCool*dt);
  }
  if(Math.random()<(this.blowing?0.5:0.12)){const b=this.lastBox;if(b)this.sparks.ember(b.x+b.w*(0.2+Math.random()*0.6),b.y+b.h*0.4);}
  this.sparks.update(dt);
 }
 draw(ctx,w,h,t){
  const b=this.box(w,h);this.lastBox=b;
  D.backdrop(ctx,w,h,'heat');
  D.fireLight(ctx,b.x+b.w/2,b.y+b.h*0.5,Math.max(w,h)*0.7,this.blowing?1.2:0.7,t);
  D.flames(ctx,b,t,this.blowing?1:0.25);
  // the steel in the coals, held by the tongs from the right
  const bar=R.form(this.api.run.form).bar,y=b.y+b.h*0.5,len=b.w*0.6*bar,x=b.x+b.w*0.78-len,th=Math.max(16,b.h*0.22);
  D.steelBar(ctx,x,y,len,th,this.temp);D.tongs(ctx,x+len-4,y,w+10,th*0.32);
  ctx.save();ctx.globalAlpha=0.45;D.flames(ctx,{x:b.x,y:b.y+b.h*0.45,w:b.w,h:b.h*0.55},t+1.3,this.blowing?0.4:0.05);ctx.restore();
  // bellows handle
  const f=D.bellowsBox(w,h),pull=this.blowing?(Math.sin(this.pump)*0.5+0.5)*f.w*0.6:0;
  ctx.fillStyle='#2e2018';ctx.fillRect(f.x+f.w*0.2-pull,f.y+f.h*0.45,f.w*0.9,5);ctx.fillStyle='#6b4a33';ctx.fillRect(f.x-6-pull+f.w*0.2,f.y+f.h*0.3,7,f.h*0.4);
  this.sparks.draw(ctx);
  const gh=Math.min(h*0.4,b.y-h*0.08-14),gx=w-34,gy=Math.max(12,b.y-gh-26);
  D.gauge(ctx,gx,gy,16,gh,{lo:650,hi:1300,temp:this.temp,band:[R.HEAT.center-this.half,R.HEAT.center+this.half],danger:R.HEAT.burn,label:'いい色'});
 }
 qa(){return {temp:this.temp,center:R.HEAT.center,half:this.half,done:this.done,blowing:this.blowing};}
}

// ---------------- 叩く ----------------
export class Hammer{
 constructor(api){this.api=api;this.name='hammer';}
 enter(){
  const run=this.api.run;
  Object.assign(this,{i:0,t:0,phase:'wait',phaseT:0,hits:[],grades:[],temp:Math.max(900,run.heat.temp),win:R.hammerWindow(run.heat.score),swingT:9,shake:0,sparks:new D.Sparks(),fold:0});
  this.api.say('白い輪が、金色の的に<b>ぴったり重なった瞬間</b>に叩け。12回、4回ごとに折り返すぞ。');
  this.api.controls([{label:'たたく',tap:true,primary:true}]);
  this.api.progress(0,R.HAMMER.hits);
  after(this.api,700,()=>{this.phase='ring';this.t=0;});
 }
 down(){
  if(this.phase!=='ring')return;
  const D_=R.hammerDuration(this.i),r=R.hitScore(this.t-D_,this.win);
  this.strike(r);
 }
 up(){}
 strike(r){
  this.hits.push(r.score);this.grades.push(r.grade);this.api.pop(r.label,r.grade);
  if(r.grade!=='miss'){this.swingT=0;this.shake=r.grade==='best'?7:4;S.clang(r.score);const p=this.spot;if(p)this.sparks.burst(p.x,p.y,r.grade==='best'?46:r.grade==='good'?28:12,r.grade==='best'?1.2:0.8);this.temp=Math.max(700,this.temp-22);}
  this.i++;this.api.progress(this.i,R.HAMMER.hits);
  if(this.i>=R.HAMMER.hits){this.phase='done';return this.finish();}
  if(this.i%R.HAMMER.foldEvery===0){this.phase='fold';this.phaseT=0;this.api.pop(`折り返し ${this.i/R.HAMMER.foldEvery}回目`,'info');after(this.api,450,()=>S.thud());after(this.api,1100,()=>{this.phase='ring';this.t=0;this.temp=Math.min(this.temp+110,Math.max(900,this.api.run.heat.temp));});}
  else{this.phase='gap';after(this.api,320,()=>{if(this.phase==='gap'){this.phase='ring';this.t=0;}});}
 }
 finish(){
  const run=this.api.run;run.hits=this.hits;run.hitGrades=this.grades;
  const m=R.mean(this.hits),best=this.grades.filter(g=>g==='best').length;
  this.api.say(m>=0.8?`見事な槌さばきだ！ 会心${best}回。`:m>=0.55?'いい調子だ。地鉄がよく締まった。':'まだ叩きがばらばらだな。輪をよく見ろ。',m>=0.55?'happy':'normal');
  this.api.controls([]);after(this.api,1500,()=>this.api.next());
 }
 update(dt){
  this.swingT+=dt;this.shake=Math.max(0,this.shake-dt*40);this.sparks.update(dt);
  if(this.phase==='ring'){
   this.t+=dt*1000;
   if(this.t-R.hammerDuration(this.i)>this.win*2)this.strike(R.hitScore(1e9,this.win));
  }
  if(this.phase==='fold')this.phaseT+=dt;
 }
 draw(ctx,w,h,t){
  const a=artBox('bg-hammer',w,h)||D.anvilBox(w,h);
  ctx.save();if(this.shake)ctx.translate((Math.random()-0.5)*this.shake,(Math.random()-0.5)*this.shake);
  D.backdrop(ctx,w,h,'hammer');
  D.fireLight(ctx,w*0.15,h*0.45,w*0.8,0.6,t);
  // the steel on the anvil; folding squeezes it to half and back
  let len=a.w*0.7*R.form(this.api.run.form).bar,th=Math.max(16,a.h*0.42);
  if(this.phase==='fold'){const k=Math.min(1,this.phaseT/1.0),s=Math.sin(k*Math.PI);len*=1-0.45*s;th*=1+0.8*s;}
  const cx=a.x+a.w/2,y=a.y-th/2+2;
  D.steelBar(ctx,cx-len/2,y,len,th,this.temp);
  this.spot={x:cx,y:y-th/2};
  // target and the shrinking ring
  if(this.phase==='ring'||this.phase==='gap'){
   const T=R.HAMMER.targetR;
   ctx.strokeStyle=D.C.gold;ctx.lineWidth=3;ctx.beginPath();ctx.arc(cx,y,T,0,Math.PI*2);ctx.stroke();
   ctx.fillStyle='rgba(212,170,82,0.15)';ctx.fill();
   if(this.phase==='ring'){
    const Dd=R.hammerDuration(this.i),r=Math.max(4,R.HAMMER.startR-(R.HAMMER.startR-T)*(this.t/Dd));
    const near=Math.abs(this.t-Dd)<=this.win;
    ctx.strokeStyle=near?'#fff7d6':'rgba(255,255,255,0.85)';ctx.lineWidth=near?5:3;ctx.beginPath();ctx.arc(cx,y,r,0,Math.PI*2);ctx.stroke();
   }
  }
  // hammer
  const size=Math.min(w*0.3,130),pv=D.hammerPivot(cx,y-th/2,size);
  const sw=this.swingT<0.05?this.swingT/0.05:Math.max(0,1-(this.swingT-0.05)/0.28);
  D.hammer(ctx,pv.x,pv.y,size,sw);
  this.sparks.draw(ctx);
  ctx.restore();
 }
 qa(){return {phase:this.phase,i:this.i,t:this.t,due:R.hammerDuration(this.i),win:this.win};}
}

// ---------------- 土置き（刃文を描く） ----------------
export class Hamon{
 constructor(api){this.api=api;this.name='hamon';}
 enter(){
  Object.assign(this,{line:[],drawing:false,result:null});
  const dbl=D.SHAPE[this.api.run.form]?.double;
  this.api.say(`刀の上を、<b>左（元）から右（先）まで</b>指でなぞれ。その線が刃文になる。線の形で刃文が決まるぞ（「見本」で8種類）。${dbl?'両刃なので、両側に同じ刃文が入る。':''}`);
  this.setControls();
 }
 setControls(){
  const ok=!!this.result;
  this.api.controls([{label:'見本',onClick:()=>this.api.samples()},{label:'やり直す',disabled:!this.line.length,onClick:()=>{this.line=[];this.result=null;this.setControls();this.api.say('もう一度、左から右へなぞれ。');}},
   {label:'これでよし',primary:true,disabled:!ok,onClick:()=>this.finish()}]);
 }
 geom(w,h){return D.bladeGeom(-w*0.08,w*0.94,h*0.5,Math.min(h*0.3,w*0.34,150),0);}
 toBand(p){
  const G=this.G,u=(p.x-G.x0)/G.len,uc=Math.max(0,Math.min(0.88,u));
  const e=G.edge(uc),sh=G.shinogi(uc),v=(e-p.y)/(e-sh);
  return {u,x:Math.min(1,Math.max(0,u/0.88)),y:v,px:G.X(Math.min(u,0.9)),py:Math.min(e-2,Math.max(G.back(uc)+2,p.y))};
 }
 down(p){if(!this.G||p.key)return;this.line=[];this.result=null;this.drawing=true;this.add(p);this.setControls();}
 move(p){if(this.drawing)this.add(p);}
 add(p){const b=this.toBand(p);if(b.u<0||b.u>0.95)return;const last=this.line.at(-1);if(last&&b.px<=last.px+1.5)return;this.line.push(b);}
 up(){
  if(!this.drawing)return;this.drawing=false;
  const r=R.analyzeHamon(this.line.filter(p=>p.u<=0.9));
  if(!r.ok){this.result=null;this.api.say('途中で止まったな。<b>右の先まで</b>一気になぞれ。');this.setControls();return;}
  this.result=r;S.tick();this.api.pop(r.name,'info');
  this.api.say(`<b>${r.name}</b>（${R.HAMON[r.type].kana}）だな。${r.outside>0.25?'線が刃先や鎬に寄りすぎだ。':r.score>=0.7?'いい線だ。':'線が少し乱れている。'}よければ「これでよし」。`,r.score>=0.7?'happy':'normal');
  this.setControls();
 }
 finish(){
  if(!this.result)return;this.api.run.hamon={type:this.result.type,name:this.result.name,score:this.result.score,profile:this.result.profile};
  this.api.controls([]);this.api.next();
 }
 update(){}
 draw(ctx,w,h){
  D.backdrop(ctx,w,h,'hamon');
  const G=this.G=this.geom(w,h);
  D.blade(ctx,G,{tang:false,dull:true});
  // guide: the band between the edge and the 鎬, with a dotted middle line
  ctx.save();D.bladeShape(ctx,G);ctx.clip();
  ctx.fillStyle='rgba(255,226,160,0.22)';ctx.beginPath();for(let i=0;i<=40;i++){const u=i/40*0.88;ctx.lineTo(G.X(u),G.band(u,0.88));}for(let i=40;i>=0;i--){const u=i/40*0.88;ctx.lineTo(G.X(u),G.band(u,0.12));}ctx.closePath();ctx.fill();
  ctx.setLineDash([6,8]);ctx.strokeStyle='rgba(255,250,235,0.75)';ctx.lineWidth=1.5;ctx.beginPath();for(let i=0;i<=40;i++){const u=i/40*0.88;ctx.lineTo(G.X(u),G.band(u,0.5));}ctx.stroke();ctx.setLineDash([]);
  ctx.restore();
  ctx.strokeStyle='rgba(40,45,55,0.5)';ctx.lineWidth=1.2;ctx.beginPath();for(let i=0;i<=40;i++){const u=i/40*0.88;ctx.lineTo(G.X(u),G.shinogi(u));}ctx.stroke();
  if(this.line.length)D.clay(ctx,G,this.line);
  // labels
  ctx.font='bold 13px "Hiragino Sans","Yu Gothic",sans-serif';ctx.fillStyle='rgba(255,240,215,0.9)';ctx.textAlign='left';
  ctx.fillText('元',8,G.back(0.1)-10);ctx.textAlign='right';ctx.fillText('先 →',w-8,G.back(0.9)-14);
  ctx.textAlign='left';ctx.fillStyle='rgba(255,240,215,0.75)';ctx.font='12px "Hiragino Sans","Yu Gothic",sans-serif';
  ctx.fillText('棟（背）',G.X(0.4),G.back(0.4)-8);ctx.fillText('刃',G.X(0.4),G.edge(0.4)+18);
  if(!this.line.length&&!this.result){const k=(performance.now()/1400)%1,u=0.08+k*0.78;ctx.fillStyle='rgba(255,255,255,0.8)';ctx.beginPath();ctx.arc(G.X(u),G.band(u,0.5+0.18*Math.sin(k*Math.PI*6)),9,0,Math.PI*2);ctx.fill();}
 }
 qa(){const G=this.G;return G?{pointAt:(x,v)=>{const u=x*0.88;return {x:G.X(u),y:G.band(u,v)};},result:this.result}:{};}
}

// ---------------- 焼き入れ ----------------
export class Quench{
 constructor(api){this.api=api;this.name='quench';}
 enter(){
  Object.assign(this,{temp:R.QUENCH.start,phase:'wait',k:0,sori:0,half:R.quenchHalf(this.api.run.kawa),steam:new D.Steam()});
  this.api.say('刀が火の中で赤くなっていく。金色の枠の<b>「月夜の色」になったら水へ</b>！ 熱すぎると割れるぞ。');
  this.api.controls([{label:'水に入れる',tap:true,primary:true}]);
  after(this.api,900,()=>{this.phase='heat';});
 }
 down(){if(this.phase==='heat')this.plunge();}
 up(){}
 plunge(){
  const r=R.quenchScore(this.temp,this.half);this.result=r;
  this.api.run.quench={temp:Math.round(this.temp),score:r.score,grade:r.grade,label:r.label,crack:r.crack};
  this.phase='plunge';this.k=0;this.api.controls([]);
 }
 update(dt){
  this.steam.update(dt);
  if(this.phase==='heat'){this.temp+=R.quenchRate(this.temp)*dt;if(this.temp>=R.QUENCH.auto)this.plunge();}
  else if(this.phase==='plunge'){
   const was=this.k;this.k=Math.min(1,this.k+dt/0.55);
   if(was<0.8&&this.k>=0.8){S.hiss(this.result.crack?1.3:1);this.splash=true;}
   if(this.k>=1){this.phase='sori';this.k=0;this.temp=0;
    const r=this.result;this.api.pop(r.label,r.grade);
    this.api.say({best:'見事だ！ 刃文がくっきり入り、きれいな反りが出た。',good:'よし、焼きがしっかり入った。',weak:r.label==='焼きが甘い'?'色が浅かった。焼きが甘いな。':'少し熱すぎた。割れなかったのが幸いだ。',crack:'……ピシッ。焼き割れだ。熱しすぎたな。'}[r.grade],r.grade==='best'||r.grade==='good'?'happy':'normal');}
  }
  else if(this.phase==='sori'){
   this.k=Math.min(1,this.k+dt/1.2);this.sori=R.soriFor(this.result.score)*this.k;
   if(this.k>=1){this.phase='done';this.api.run.sori=R.soriFor(this.result.score);after(this.api,1100,()=>this.api.next());}
  }
 }
 draw(ctx,w,h,t){
  const L=artBox('bg-quench',w,h)||D.longHearth(w,h),T=D.troughBox(w,h);
  D.backdrop(ctx,w,h,'quench');
  D.fireLight(ctx,L.x+L.w/2,L.y+L.h/2,Math.max(w,h)*0.6,0.9,t);
  D.flames(ctx,L,t,0.55);
  const hy=L.y+L.h*0.52,wy=T.y+T.h*0.55;
  let y=hy;if(this.phase==='plunge')y=hy+(wy-hy)*Math.min(1,this.k/0.8);else if(this.phase==='sori'||this.phase==='done')y=wy-T.h*0.95*Math.min(1,this.k*2);
  const S=D.SHAPE[this.api.run.form]||D.SHAPE.katana,bl=L.w*0.82*Math.max(0.45,S.len),x0=L.x+L.w*0.95-bl;
  const G=D.bladeGeom(x0,x0+bl,y,Math.min(L.h*0.32,30)*(S.double?1.4:S.hira?1.3:1),S.double?0:this.sori*Math.max(0.3,S.sori),{...S,tangLen:Math.min(bl*S.tang,x0-L.x+8),tangWid:S.double?0.32:0.6});
  const hot=this.phase==='heat'||this.phase==='wait'||(this.phase==='plunge'&&this.k<0.8);
  if(hot){D.blade(ctx,G,{temp:this.temp,tang:true});D.clayFromProfile(ctx,G,this.api.run.hamon.profile,0.85);}
  else{D.blade(ctx,G,{dull:true});D.clayFromProfile(ctx,G,this.api.run.hamon.profile,Math.max(0.3,0.85-this.k));}
  if(this.splash){this.splash=false;this.steam.puff(T.x+T.w/2,T.y,40,T.w*0.8);}
  if(this.phase==='sori'&&Math.random()<0.3)this.steam.puff(T.x+T.w/2,T.y,2,T.w*0.6);
  this.steam.draw(ctx);
  if(this.phase==='heat'||this.phase==='wait'){
   const gw=Math.min(w*0.7,320),gx=(w-gw)/2,gy=L.y+L.h+(T.y-L.y-L.h)*0.42;
   D.gaugeH(ctx,gx,gy,gw,12,{lo:600,hi:960,temp:this.temp,band:[R.QUENCH.center-this.half,R.QUENCH.center+this.half],danger:R.QUENCH.crack,label:'月夜の色'});
  }
 }
 qa(){return {phase:this.phase,temp:this.temp,center:R.QUENCH.center,half:this.half};}
}

// ---------------- 研ぐ ----------------
const COLS=36,ROWS=5;
export class Polish{
 constructor(api){this.api=api;this.name='polish';}
 enter(){
  Object.assign(this,{u0:0.08,cells:new Float32Array(COLS*ROWS),scratches:[],left:R.POLISH.seconds,started:false,done:false,last:null,lastScratch:-1e9,rubbing:false});
  this.api.say('刀の上を、指で<b>左右にゆっくり大きく</b>こすって曇りを取れ。速すぎるとキズになる。');
  this.api.controls([]);this.api.progress(0,1,'曇りを取る');
 }
 geom(w,h){return D.bladeGeom(-w*0.06,w*0.95,h*0.5,Math.min(h*0.3,w*0.34,150),(this.api.run.sori??0.5)*0.3);}
 cell(c,r){const G=this.G,u=this.u0+(c+0.5)/COLS*(0.98-this.u0),s=(r+0.5)/ROWS;return {x:G.X(u),y:G.edge(u)-(G.edge(u)-G.back(u))*s};}
 coverage(){let s=0;for(const v of this.cells)s+=Math.min(1,v);return s/this.cells.length;}
 down(p){if(this.done||p.key||!this.G)return;this.rubbing=true;this.started=true;this.v=0;this.last={x:p.x,y:p.y,t:p.t};}
 move(p){
  if(!this.rubbing||this.done)return;
  const l=this.last;this.last={x:p.x,y:p.y,t:p.t};
  const d=Math.hypot(p.x-l.x,p.y-l.y),dt=Math.max(4,p.t-l.t);
  if(d<0.5)return;
  // smoothed speed, so one jumpy event does not count as a scratch
  const speed=this.v=this.v*0.5+(d/dt)*0.5;
  if(speed>R.POLISH.fastPxPerMs&&p.t-this.lastScratch>R.POLISH.scratchCooldownMs&&this.onBlade(p)){
   this.lastScratch=p.t;this.scratches.push({x:p.x,y:p.y,a:Math.atan2(p.y-l.y,p.x-l.x)});S.scratch();this.api.pop('キズ！','miss');
   this.api.say('速すぎる！ ゆっくり大きく、だ。');
  }
  const R_=this.G.wid*0.55,gain=d/(R_*2*4);
  for(let c=0;c<COLS;c++)for(let r=0;r<ROWS;r++){const q=this.cell(c,r),dd=Math.hypot(q.x-p.x,q.y-p.y);if(dd<R_)this.cells[c*ROWS+r]+=gain*(1-dd/R_*0.4);}
  if(Math.random()<0.35)S.rub(Math.min(2,speed));
  const cov=this.coverage();this.api.progress(cov,1,'曇りを取る');
  if(cov>=0.985)this.finish();
 }
 up(){this.rubbing=false;}
 onBlade(p){const G=this.G,u=(p.x-G.x0)/G.len;return u>0&&u<1&&p.y>G.back(Math.min(1,u))-10&&p.y<G.edge(Math.min(1,u))+10;}
 finish(){
  if(this.done)return;this.done=true;this.rubbing=false;
  const cov=this.coverage(),sc=this.scratches.length,score=R.polishScore(cov,sc);
  this.api.run.polish={coverage:Math.round(cov*100)/100,scratches:sc,score};
  this.api.pop(cov>=0.985&&sc===0?'会心':cov>=0.9?'よし':'曇りが残った',cov>=0.985&&sc===0?'best':cov>=0.9?'good':'weak');
  this.api.say(cov>=0.985?(sc?`よく光った。キズが${sc}つあるのが惜しいな。`:'見事な研ぎだ。刃文がくっきり見える。'):'時間切れだ。まだ曇りが残っているな。',cov>=0.9&&sc<2?'happy':'normal');
  after(this.api,1600,()=>this.api.next());
 }
 update(dt){if(this.started&&!this.done){this.left=Math.max(0,this.left-dt);if(this.left<=0)this.finish();}}
 draw(ctx,w,h){
  D.backdrop(ctx,w,h,'polish');
  const G=this.G=this.geom(w,h),run=this.api.run;this.u0=Math.max(0.02,-G.x0/G.len+0.015);
  D.blade(ctx,G,{profile:run.hamon.profile,tang:false,crack:run.quench.crack});
  // the cloud left by the stones: one patch per cell, fading as it is polished
  ctx.save();D.bladeShape(ctx,G);ctx.clip();
  const span=0.98-this.u0,uAt=k=>this.u0+k/COLS*span;
  for(let c=0;c<COLS;c++){
   let any=false;for(let r=0;r<ROWS;r++)if(this.cells[c*ROWS+r]<0.98)any=true;if(!any)continue;
   const u0=c===0?0:uAt(c),u1=c===COLS-1?1.02:uAt(c+1),um=(u0+u1)/2,top=G.back(um)-4,bot=G.edge(um)+4;
   const gr=ctx.createLinearGradient(0,bot,0,top);
   for(let r=0;r<ROWS;r++){const a=1-Math.min(1,this.cells[c*ROWS+r]);gr.addColorStop((r+0.5)/ROWS,`rgba(128,121,112,${(0.94*a).toFixed(3)})`);}
   const a0=1-Math.min(1,this.cells[c*ROWS]),aN=1-Math.min(1,this.cells[c*ROWS+ROWS-1]);gr.addColorStop(0,`rgba(128,121,112,${(0.94*a0).toFixed(3)})`);gr.addColorStop(1,`rgba(128,121,112,${(0.94*aN).toFixed(3)})`);
   ctx.fillStyle=gr;ctx.beginPath();ctx.moveTo(G.X(u0),G.back(u0)-6);ctx.lineTo(G.X(u1),G.back(u1)-6);ctx.lineTo(G.X(u1),G.edge(u1)+6);ctx.lineTo(G.X(u0),G.edge(u0)+6);ctx.closePath();ctx.fill();
  }
  // edge strips outside the cell range
  ctx.restore();
  ctx.strokeStyle='rgba(30,20,20,0.85)';ctx.lineWidth=1.6;
  for(const s of this.scratches){ctx.beginPath();ctx.moveTo(s.x-Math.cos(s.a)*14,s.y-Math.sin(s.a)*14);ctx.lineTo(s.x+Math.cos(s.a)*14,s.y+Math.sin(s.a)*14);ctx.stroke();}
  // the stone under the finger
  if(this.rubbing&&this.last){const sw=G.wid*0.84,sh=G.wid*0.38;ctx.save();ctx.translate(this.last.x,this.last.y);ctx.rotate(-0.08);ctx.fillStyle='rgba(0,0,0,0.25)';D.roundRect(ctx,-sw/2+3,-sh/2+5,sw,sh,6);ctx.fill();ctx.fillStyle='#c9b48f';D.roundRect(ctx,-sw/2,-sh/2,sw,sh,6);ctx.fill();ctx.fillStyle='#a8916b';ctx.fillRect(-sw/2+4,sh*0.18,sw-8,sh*0.24);ctx.restore();}
  // time
  const tw=w-32;ctx.fillStyle='rgba(0,0,0,0.4)';D.roundRect(ctx,16,12,tw,8,4);ctx.fill();ctx.fillStyle=this.left<4?'#e0604a':D.C.gold;D.roundRect(ctx,16,12,tw*(this.left/R.POLISH.seconds),8,4);ctx.fill();
  ctx.fillStyle='rgba(255,240,215,0.9)';ctx.font='12px "Hiragino Sans","Yu Gothic",sans-serif';ctx.textAlign='right';ctx.fillText(this.started?`のこり ${Math.ceil(this.left)}秒`:'こすると時間が進む',w-16,36);
 }
 qa(){const G=this.G;return G?{coverage:this.coverage(),scratches:this.scratches.length,done:this.done,left:this.left,pointAt:(u,s)=>({x:G.X(u),y:G.edge(u)-(G.edge(u)-G.back(u))*s})}:{};}
}

// ---------------- 背景だけの場面（タイトル・素材・仕上がり・記録） ----------------
export class Ambient{
 constructor(api,name,kind,{sword=null,dim=0}={}){Object.assign(this,{api,name,kind,sword,dim,sparks:new D.Sparks(),gleam:0});}
 enter(){}
 update(dt){this.sparks.update(dt);this.gleam=(this.gleam+dt*0.35)%1.6;if(Math.random()<0.15&&this.box)this.sparks.ember(this.box.x+this.box.w*Math.random(),this.box.y+this.box.h*0.4);}
 draw(ctx,w,h,t){
  D.backdrop(ctx,w,h,this.kind);
  if(this.kind==='title'){const b=this.box=artBox('bg-title',w,h)||D.hearthBox(w,h);D.fireLight(ctx,b.x+b.w/2,b.y+b.h/2,Math.max(w,h)*0.75,0.9,t);if(!artBox('bg-title',w,h))D.flames(ctx,b,t,0.4);}
  this.sparks.draw(ctx);
  if(this.dim){ctx.fillStyle=`rgba(10,6,4,${this.dim})`;ctx.fillRect(0,0,w,h);}
  if(this.sword){
   const s=this.sword,top=this.api.swordTop?.()??h*0.16;
   const sp=ctx.createRadialGradient(w*0.55,top,10,w*0.55,top,w*0.6);sp.addColorStop(0,'rgba(255,230,190,0.22)');sp.addColorStop(1,'rgba(255,230,190,0)');ctx.fillStyle=sp;ctx.fillRect(0,0,w,h);
   const S=D.SHAPE[s.form]||D.SHAPE.katana;
   D.fullSword(ctx,s.form||'katana',{x:w*0.04,y:top-Math.min(70,w*0.16)/2,w:w*0.92,h:Math.min(70,w*0.16)},{profile:s.profile,crack:s.crack,gleam:this.gleam<1?this.gleam:-1,sori:S.sori*(s.sori??0.6)/0.8});
  }
 }
 down(){}move(){}up(){}
 qa(){return {};}
}
