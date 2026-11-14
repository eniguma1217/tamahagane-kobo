// 試作② 斬り筋なぞり（#30）：敵の体に光る線（斬り筋）が出る。光る丸から、時間内に線どおりなぞると斬れる。
// ずれる・時間切れだと、刀で受けて耐久が減る。深いほど線が複雑で、時間が短い。強敵は二連。数字は試作の仮のもの。
import {startProto,S} from './common.js';
const clamp=(v,lo=0,hi=1)=>Math.max(lo,Math.min(hi,v));
// 斬り筋 in the foe's box (0..1), with the depth they first appear
const LINES=[
 {name:'袈裟',from:1,pts:[[0.2,0.18],[0.8,0.8]]},{name:'逆袈裟',from:1,pts:[[0.8,0.18],[0.2,0.8]]},{name:'横一文字',from:1,pts:[[0.1,0.5],[0.9,0.5]]},
 {name:'唐竹',from:2,pts:[[0.5,0.12],[0.5,0.86]]},{name:'弧',from:2,curve:[[0.12,0.7],[0.5,0.0],[0.88,0.7]]},{name:'山',from:3,pts:[[0.14,0.75],[0.5,0.25],[0.86,0.75]]},
 {name:'稲妻',from:4,pts:[[0.14,0.25],[0.4,0.7],[0.62,0.3],[0.86,0.75]]}
];
const sample=(L,b)=>{let raw;
 if(L.curve){const [a,c,d]=L.curve;raw=Array.from({length:40},(_,i)=>{const t=i/39;return [(1-t)**2*a[0]+2*(1-t)*t*c[0]+t*t*d[0],(1-t)**2*a[1]+2*(1-t)*t*c[1]+t*t*d[1]];});}
 else{raw=[];for(let k=0;k<L.pts.length-1;k++){const [x0,y0]=L.pts[k],[x1,y1]=L.pts[k+1];for(let i=0;i<20;i++){const t=i/20;raw.push([x0+(x1-x0)*t,y0+(y1-y0)*t]);}}raw.push(L.pts.at(-1));}
 return raw.map(([x,y])=>({x:b.x+b.w*x,y:b.y+b.h*y}));};
const pace=P=>{const d=P.depth+P.place.hard*0.6,boss=P.foe.boss;return {time:Math.max(0.85,1.9-0.1*d-(boss?0.3:0)),pair:boss};};
const combat={
 name:'② 斬り筋なぞり',
 howto:'敵の体に<b>光る線（斬り筋）</b>が出る。<b>光る丸から</b>、線どおりに指でなぞると斬れる。ずれたり時間切れになると、刀で受けて耐久が1減る。深いほど線が複雑で短い。強敵は二連。<br>斬ると気が1たまり、3つで必殺技。必殺技は<b>自分の刃文をなぞる</b>。',
 other:{href:'mikiri.html',label:'① 見切り斬りへ'},
 begin(P){this.phase='gap';this.t=0;this.wait=0.9;this.queue=0;P.say('<b>光る丸から</b>、線どおりにすばやくなぞれ！');},
 newLine(P){
  const pool=LINES.filter(L=>L.from<=P.depth+(P.foe.boss?1:0)),L=pool[Math.floor(Math.random()*pool.length)];
  let path=sample(L,P.box());if(Math.random()<0.5)path=path.reverse();
  this.line={L,path};this.sp=pace(P);this.phase='line';this.t=0;this.trail=[];this.idx=0;this.dists=[];this.on=false;
 },
 update(dt,P){
  this.t+=dt;
  if(this.phase==='gap'&&this.t>=this.wait){this.queue=this.queue||(pace(P).pair?2:1);this.newLine(P);}
  else if(this.phase==='line'&&this.t>=this.sp.time&&!this.on){P.hurt('遅い！');this.next(P,false);}
  else if(this.phase==='line'&&this.t>=this.sp.time+0.6){P.hurt('遅い！');this.next(P,false);}
 },
 next(P,ok){this.queue=Math.max(0,this.queue-1);this.phase='gap';this.t=0;this.wait=this.queue>0&&ok?0.15:0.5+Math.random()*0.5;if(!ok)this.queue=0;this.line=null;},
 down(p,P){
  if(this.phase!=='line')return;
  const s=this.line.path[0];
  if(Math.hypot(p.x-s.x,p.y-s.y)>46){P.num('光る丸から！',p.x,p.y,'#ffd1a8',18);return;}
  this.on=true;this.trail=[p];this.idx=0;this.dists=[];
 },
 move(p,P){
  if(this.phase!=='line'||!this.on)return;this.trail.push(p);
  const path=this.line.path;let best=this.idx,bd=1e9;
  for(let i=this.idx;i<Math.min(path.length,this.idx+8);i++){const d=Math.hypot(p.x-path[i].x,p.y-path[i].y);if(d<bd){bd=d;best=i;}}
  this.idx=best;this.dists.push(bd);
  if(this.idx>=path.length-1)this.finish(P);
 },
 up(p,P){if(this.phase==='line'&&this.on)this.finish(P);},
 finish(P){
  const path=this.line.path,done=this.idx/(path.length-1),mean=this.dists.length?this.dists.reduce((a,b)=>a+b,0)/this.dists.length:99;
  this.on=false;
  if(done>=0.85&&mean<=34){
   const acc=clamp(1-mean/40),crit=acc>0.75;P.stats.good++;if(crit)P.stats.perfect++;
   P.slash(path,crit?'255,224,138':'255,255,255');const m=path[Math.floor(path.length/2)];
   P.num(crit?`会心！ ${this.line.L.name}`:this.line.L.name,m.x,m.y-30,crit?'#ffe08a':'#fff',20);P.hit(0.75+0.4*acc,crit,{x:m.x,y:m.y});this.next(P,true);
  }else{P.hurt(done<0.85?'途中で止まった':'ずれた！');this.next(P,false);}
 },
 draw(ctx,P,time){
  if(this.phase!=='line'||!this.line)return;
  const path=this.line.path,left=clamp(1-this.t/this.sp.time);
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
  // a dark edge first, so the line shows on a pale foe too
  ctx.strokeStyle='rgba(20,10,5,0.55)';ctx.lineWidth=24;ctx.beginPath();path.forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));ctx.stroke();
  ctx.strokeStyle=`rgba(255,${200+40*Math.sin(time*10)},120,0.95)`;ctx.lineWidth=16;ctx.shadowColor='#ffe9b0';ctx.shadowBlur=20;
  ctx.beginPath();path.forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));ctx.stroke();ctx.shadowBlur=0;
  // done part
  if(this.idx>0){ctx.strokeStyle='rgba(255,255,255,0.95)';ctx.lineWidth=8;ctx.beginPath();path.slice(0,this.idx+1).forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));ctx.stroke();}
  // start dot with its clock, and an arrow at the end
  const s=path[0],e=path.at(-1),pe=path.at(-3);
  ctx.fillStyle='rgba(255,224,138,0.95)';ctx.beginPath();ctx.arc(s.x,s.y,14+3*Math.sin(time*12),0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#ff7a3a';ctx.lineWidth=5;ctx.beginPath();ctx.arc(s.x,s.y,24,-Math.PI/2,-Math.PI/2+Math.PI*2*left);ctx.stroke();
  const a=Math.atan2(e.y-pe.y,e.x-pe.x);ctx.fillStyle='rgba(255,240,200,0.95)';ctx.beginPath();ctx.moveTo(e.x+Math.cos(a)*16,e.y+Math.sin(a)*16);ctx.lineTo(e.x+Math.cos(a+2.5)*14,e.y+Math.sin(a+2.5)*14);ctx.lineTo(e.x+Math.cos(a-2.5)*14,e.y+Math.sin(a-2.5)*14);ctx.closePath();ctx.fill();
  if(this.trail.length>1){ctx.strokeStyle='rgba(255,255,255,0.6)';ctx.lineWidth=4;ctx.beginPath();this.trail.forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));ctx.stroke();}
  ctx.restore();
 },
 result(P){return `斬った ${P.stats.good}回（会心 ${P.stats.perfect}）`;},
 qa(){return {phase:this.phase,t:this.t,time:this.sp?.time,path:this.line?.path||null,on:this.on};}
};
startProto(combat);
