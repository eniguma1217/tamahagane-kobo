// #54. Presentation only: logical coordinates, adjacency, prices and production stay in machi.html.
(() => {
 const oldYard=yard;
 let scene=null,frame=0,names=false,overview=false,cameraY=0;
 const key=(x,y)=>y*GW+x;
 const xy=i=>({x:i%GW,y:Math.floor(i/GW)});
 const point=i=>{const p=xy(i);return{x:(GW-p.x-.5)*100,y:(p.y+.82)*100};};
 const neighbours=i=>{const p=xy(i);return near4(p.x,p.y).map(([x,y])=>key(x,y));};
 const gate=key(...GATE);
 // Paths use the same unoccupied, unlocked tiles as the board. A house is approached from outside.
 function graph(){
  const pass=new Set(G.yard.map((t,i)=>i).filter(i=>{const t=G.yard[i],ter=terrain(t.x,t.y);return isOpen(t)&&!t.b&&ter!=='river'&&ter!=='forest';}));
  pass.add(gate);
  const prev=new Map([[gate,null]]),queue=[gate];
  for(let n=0;n<queue.length;n++)for(const j of neighbours(queue[n]))if(pass.has(j)&&!prev.has(j)){prev.set(j,queue[n]);queue.push(j);}
  const route=i=>{if(!prev.has(i))return[];const r=[];for(let j=i;j!==null;j=prev.get(j))r.push(j);return r.reverse();};
  const stops=[];
  for(const [i,t] of G.yard.entries()){
   if(!t.b)continue;
   if(t.b==='honden'&&(T(t.x-1,t.y)?.b==='honden'||(t.y&&T(t.x,t.y-1)?.b==='honden')))continue;
   const cells=t.b==='honden'?[i,i+1,i+GW,i+GW+1]:[i];
   const edges=[...new Set(cells.flatMap(neighbours))].filter(j=>prev.has(j)&&!cells.includes(j));
   const front=edges.filter(j=>xy(j).y>t.y+(t.b==='honden'?1:0));
   const options=(front.length?front:edges).sort((a,b)=>route(a).length-route(b).length);
   if(options.length)stops.push({i,b:t.b,door:options[0],route:route(options[0])});
  }
  return{pass,prev,route,stops};
 }
 const line=ids=>ids.map(i=>{const p=point(i);return`${p.x},${p.y}`;}).join(' ');
 function scenery(g){
  const paths=new Set([gate]);g.stops.forEach(s=>s.route.forEach(i=>paths.add(i)));
  // The existing permanent entrance path remains visible even before the first house is visited.
  for(const s of ROAD){const [x,y]=s.split(',').map(Number);if(g.prev.has(key(x,y)))g.route(key(x,y)).forEach(i=>paths.add(i));}
  const segments=[...paths].filter(i=>g.prev.get(i)!=null&&paths.has(g.prev.get(i))).map(i=>`<polyline points="${line([g.prev.get(i),i])}"/>`).join('');
  const doors=g.stops.map(s=>{const p=point(s.door),t=G.yard[s.i],x=(GW-t.x-(t.b==='honden'?1:.5))*100,y=(t.y+(t.b==='honden'?2:1))*100-8;return `<path d="M${p.x} ${p.y} L${x} ${p.y} L${x} ${y}"/>`;}).join('');
  let fence='';for(let x=10;x<610;x+=26){if(x>270&&x<400)continue;fence+=`<path d="M${x} 867v25"/>`;}
  return `<svg class="yard-scenery" viewBox="0 ${cameraY*100} 700 ${(GH-cameraY)*100}" preserveAspectRatio="none" aria-hidden="true">
   <defs><pattern id="yardWater" width="130" height="130" patternUnits="userSpaceOnUse"><image href="../assets/dojo-v2/tile-water.png" width="130" height="130"/></pattern></defs>
   <g fill="none" stroke="#809b51" stroke-width="3" opacity=".5">${Array.from({length:160},(_,n)=>{const x=12+(n*137%600),y=10+(n*83%865);return `<path d="M${x} ${y}l-2-4m2 4l3-5"/>`;}).join('')}</g>
   <path d="M665 -20Q615 120 665 235T655 465T660 695T635 930" fill="none" stroke="#82836b" stroke-width="94"/>
   <path d="M665 -20Q615 120 665 235T655 465T660 695T635 930" fill="none" stroke="#d6c9a0" stroke-width="78"/>
   <path d="M665 -20Q615 120 665 235T655 465T660 695T635 930" fill="none" stroke="url(#yardWater)" stroke-width="61"/>
   <g fill="none" stroke="#c6aa71" stroke-width="30" stroke-linecap="round" stroke-linejoin="round">${segments}${doors}</g>
   <g fill="none" stroke="#edcf8e" stroke-width="25" stroke-linecap="round" stroke-linejoin="round">${segments}${doors}<path d="M350 880v25"/></g>
   <path d="M605 812q45-23 88-2v38q-45-17-88 2z" fill="#bd9155" stroke="#6b4a29" stroke-width="6"/>
   <g stroke="#805a31" stroke-width="3">${[616,632,648,664,680].map(x=>`<path d="M${x} 809v34"/>`).join('')}</g>
   <g fill="none" stroke="#c5a45d" stroke-width="9">${fence}<path d="M0 877h277m125 0h206"/></g>
   <g stroke="#694d2c" stroke-width="2" fill="none">${fence}</g>
  </svg>`;
 }
 yard=function(){
  oldYard();
  const grid=$('#yardGrid'),wrap=grid?.parentElement;if(!grid||!wrap)return;
  cameraY=overview?0:Math.max(0,Math.min(...G.yard.filter(isOpen).map(t=>t.y))-1);
  grid.style.gridTemplateRows=`repeat(${GH-cameraY},minmax(0,1fr))`;
  grid.style.aspectRatio=`7 / ${GH-cameraY}`;
  for(const el of grid.querySelectorAll('[data-i]')){
   const i=+el.dataset.i,t=G.yard[i],wide=t.b==='honden'?2:1;
   el.style.display=t.y<cameraY?'none':'';
   el.style.gridColumn=`${GW-t.x-wide+1} / span ${wide}`;el.style.gridRow=`${t.y-cameraY+1} / span ${wide}`;
   el.style.zIndex=String(t.y*2+1);
   // Crop transparent padding in CSS while retaining the supplied PNG unchanged.
   // This keeps each image's actual layout box inside its buildable tile.
   for(const im of el.querySelectorAll('img')){
    const asset=im.getAttribute('src').split('/').pop().replace('.png','');
    const bb=BBOX[asset]||(asset==='bld-honden'?[45,270,1210,1047]:asset==='bld-honden-big'?[57,186,1198,1087]:null);
    if(bb&&CSS.supports('object-view-box','inset(10%)')){
     im.classList.remove('fit');im.removeAttribute('style');im.style.cssText='position:absolute;width:100%;height:100%;left:0;top:0;margin:0;object-fit:contain;object-position:center bottom;object-view-box:inset('+[bb[1],1254-bb[2],1254-bb[3],bb[0]].map(v=>(v/1254*100).toFixed(3)+'%').join(' ')+')';
    }
   }
   if(el.tagName==='BUTTON')el.setAttribute('aria-label',t.b?(t.b==='honden'?'本堂':BUILD[t.b].name):!isOpen(t)?DIST[t.d].name:`空き地 ${t.x+1}列 ${t.y+1}段`);
   if(el.classList.contains('closed')){
    const first=G.yard.find(u=>u.d===t.d)===t,D=DIST[t.d];
    el.innerHTML=(terrain(t.x,t.y)==='forest'?pimg('tile-forest'):'')+(first&&overview?`<span class="land-sign">${D.name}<br>${D.deed?'権利証で広げる':yen(D.cost)+'文で広げる'}</span>`:'');
   }
  }
  const g=graph();grid.insertAdjacentHTML('afterbegin',scenery(g));
  wrap.classList.toggle('names-on',names);
  wrap.insertAdjacentHTML('beforebegin','<div class="yard-land">'+Object.entries(DIST).filter(([id])=>!G.open[id]).map(([id,d])=>`<button type="button" data-land="${id}">${d.name} ＋<small>${d.deed?'権利証':yen(d.cost)+'文'}</small></button>`).join('')+'</div>');
  view.querySelectorAll('[data-land]').forEach(b=>b.onclick=()=>tapTile(G.yard.findIndex(t=>t.d===b.dataset.land)));
  wrap.insertAdjacentHTML('afterend','<div class="yard-toolbar"><span>草地を押して建築</span><button type="button" id="yardOverview" aria-pressed="'+overview+'">'+(overview?'暮らし':'全景')+'</button><button type="button" id="yardNames" aria-pressed="'+names+'">建物名</button></div>');
  $('#yardOverview').onclick=()=>{overview=!overview;render();};
  $('#yardNames').onclick=()=>{names=!names;wrap.classList.toggle('names-on',names);$('#yardNames').setAttribute('aria-pressed',String(names));};
  launch(g);
 };
 // Stop the earlier straight-line walkers; the new ones follow visible, connected paths.
 WK=null;
 startWalkers=function(){if($('#yardGrid'))launch(graph());};
 function launch(g){
  cancelAnimationFrame(frame);const cv=$('#walk');if(!cv)return;
  const targets=g.stops.filter(s=>['honden','nagaya','keiko','kaji','chaya','katanaya','sumi','satetsu'].includes(s.b));
  const routes=targets.length?targets.map(s=>s.route):[[gate]];
  scene={cv,idle:econ().idle,people:Array.from({length:Math.min(7,Math.max(3,Math.ceil(G.pupils/4)+2))},(_,n)=>({route:routes[n%routes.length],step:n%Math.max(1,routes[n%routes.length].length-1),progress:(n*.23)%1,back:false,wait:n*.3,visitor:n%3===0})),last:performance.now()};
  frame=requestAnimationFrame(animate);
 }
 function animate(now){
  const s=scene;if(!s||!document.body.contains(s.cv)||G.tab!=='yard')return;
  const dt=Math.min(.06,(now-s.last)/1000);s.last=now;
  const {ctx,W,H}=sharp(s.cv);ctx.clearRect(0,0,W,H);ctx.imageSmoothingEnabled=false;
  for(const p of s.people){
   if(p.wait>0)p.wait-=dt;
   else if(p.route.length>1){p.progress+=dt*.62;if(p.progress>=1){p.progress=0;p.step++;if(p.step>=p.route.length-1){p.route=[...p.route].reverse();p.step=0;p.wait=1.5+Math.random()*2;}}}
   const a=point(p.route[p.step]),b=point(p.route[Math.min(p.step+1,p.route.length-1)]),v=p.wait>0?0:p.progress;
   const x=lerp(a.x,b.x,v)/700*W,y=(lerp(a.y,b.y,v)-cameraY*100)/((GH-cameraY)*100)*H,h=Math.max(19,W*.072);
   if(p.visitor)chibi(ctx,x,y,h/23,'#bd8b4c',null,1,{hakama:'#40576b'});
   // pupils are the #55 sprite (it faces left; turned round when walking right)
   else if(!sprite(ctx,'chibi-monka',x,y,h*0.95,b.x>a.x))chibi(ctx,x,y,h/23,'#f1ead1',null,1,{hakama:'#283e63',band:'#d3b567'});
  }
  const fire=G.yard.filter(t=>t.b==='kaji'||t.b==='sumi');
  for(const t of fire){if(s.idle[key(t.x,t.y)])continue;const c=point(key(t.x,t.y)),x=c.x/700*W,y=(c.y-60-cameraY*100)/((GH-cameraY)*100)*H;
   ctx.fillStyle='#fff2d080';for(let n=0;n<2;n++){const q=(now/1500+n*.5)%1;ctx.globalAlpha=(1-q)*.55;ctx.fillRect(x+Math.sin(q*5)*3,y-q*18,4+q*3,4+q*3);}ctx.globalAlpha=1;
  }
  frame=requestAnimationFrame(animate);
 }
 render();
})();
