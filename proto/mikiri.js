// 試作① 見切り斬り（#30）：敵が構えると光の輪が縮む。刀の輪に重なって白く光った瞬間にタップで見切り、反撃の一閃。
// 早すぎ・遅すぎ・フェイント（紫に変わる輪）に手を出すと、刀で受けて耐久が減る。数字は試作の仮のもの。
import {startProto,S} from './common.js';
const clamp=(v,lo=0,hi=1)=>Math.max(lo,Math.min(hi,v));
// faster, tighter and trickier deeper down and at the boss
const pace=P=>{const d=P.depth+P.place.hard*0.6,boss=P.foe.boss;
 return {wind:Math.max(0.55,1.15-0.05*d-(boss?0.15:0)),win:Math.max(0.15,0.27-0.01*d-(boss?0.03:0)),feint:P.depth<2?0:Math.min(0.35,0.08*(P.depth-1)+(boss?0.1:0)),double:boss?0.35:0};};
const combat={
 name:'① 見切り斬り',
 howto:'敵が構えると、赤い輪が縮んでくる。まん中の輪に重なって<b>白く光った瞬間</b>にタップ（どこでも）で見切り、反撃。早すぎ・遅すぎ・<b>紫に変わった輪（フェイント）</b>に手を出すと、刀で受けて耐久が1減る。<br>見切ると気が1たまり、3つで必殺技。必殺技は<b>自分の刃文をなぞる</b>。',
 other:{href:'sujigiri.html',label:'② 斬り筋なぞりへ'},
 begin(P){this.phase='idle';this.t=0;this.wait=1;this.sp=pace(P);P.say('構えを待て。輪が<b>白く光った瞬間</b>にタップ！');},
 update(dt,P){
  this.t+=dt;
  if(this.phase==='idle'&&this.t>=this.wait){this.sp=pace(P);this.feint=Math.random()<this.sp.feint;this.double=Math.random()<this.sp.double;this.phase='wind';this.t=0;}
  else if(this.phase==='wind'&&this.t>=this.sp.wind){this.t=0;if(this.feint)this.phase='feint';else{this.phase='window';S.glint(1);}}
  else if(this.phase==='window'&&this.t>=this.sp.win){P.hurt('遅い！');this.recover();}
  else if(this.phase==='feint'&&this.t>=0.45){P.num('見送った',P.w/2,P.box().y+P.box().h*0.2,'#d9b8ff',20);this.recover();}
  else if(this.phase==='recover'&&this.t>=0.4){
   if(this.double){this.double=false;this.phase='idle';this.t=0;this.wait=0.2;P.say('もう一太刀来るぞ！');}
   else{this.phase='idle';this.t=0;this.wait=0.45+Math.random()*0.7;}
  }
 },
 recover(){this.phase='recover';this.t=0;},
 down(p,P){
  const b=P.box();
  if(this.phase==='window'){
   const k=this.t/this.sp.win,perfect=Math.abs(k-0.5)<0.3;P.stats.good++;if(perfect)P.stats.perfect++;
   P.slash([{x:b.x+b.w*0.12,y:b.y+b.h*0.18},{x:b.x+b.w*0.88,y:b.y+b.h*0.78}],perfect?'255,224,138':'255,255,255');
   P.num(perfect?'見切り！':'よし',b.x+b.w/2,b.y+b.h*0.15,perfect?'#ffe08a':'#fff',22);
   P.hit(1,perfect);this.recover();
  }else if(this.phase==='wind'){P.hurt(this.feint&&this.t/this.sp.wind>0.6?'フェイントだ！':'早い！');this.recover();}
  else if(this.phase==='feint'){P.hurt('フェイントだ！');this.recover();}
 },
 draw(ctx,P,time){
  const b=P.box(),cx=b.x+b.w/2,cy=b.y+b.h*0.46,R0=b.w*0.2;
  ctx.save();ctx.lineWidth=4;ctx.strokeStyle='rgba(255,255,255,0.4)';ctx.setLineDash([10,8]);ctx.beginPath();ctx.arc(cx,cy,R0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
  if(this.phase==='wind'){const k=clamp(this.t/this.sp.wind),r=R0+b.w*0.55*(1-k);
   ctx.strokeStyle=this.feint&&k>0.6?'rgba(200,130,255,0.95)':'rgba(255,90,60,0.95)';ctx.lineWidth=7;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();}
  if(this.phase==='window'){ctx.strokeStyle='#fff';ctx.lineWidth=14;ctx.shadowColor='#fff';ctx.shadowBlur=32;ctx.beginPath();ctx.arc(cx,cy,R0,0,Math.PI*2);ctx.stroke();}
  if(this.phase==='feint'){ctx.globalAlpha=1-this.t/0.45;ctx.strokeStyle='rgba(200,130,255,0.9)';ctx.lineWidth=7;ctx.beginPath();ctx.arc(cx,cy,R0,0,Math.PI*2);ctx.stroke();}
  ctx.restore();
 },
 result(P){return `見切り ${P.stats.good}回（会心 ${P.stats.perfect}）`;},
 qa(){return {phase:this.phase,t:this.t,win:this.sp?.win,wind:this.sp?.wind,feint:!!this.feint};}
};
startProto(combat);
