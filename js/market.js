// 客と評判（#12・#15・#17）。注文だけにしぼったので（owner D43）、店先の値段交渉・競り・蔵・売り払いはやめた。
// 評判（もとの名声）は7段。上がると格の高い客が来て、新しい素材と形が使えるようになる（D45）。数字は Claude の案（GAME_SPEC G16）。
import * as R from './rules.js';
import * as J from './journey.js';

// fame: the 評判 level (index) from which they come; pay: how much more they pay for an order
export const CLIENTS={
 bushi:{name:'武士',face:'🗡',hello:'腕のいい鍛冶がいると聞いた。',fame:0,pay:1},
 shonin:{name:'商人',face:'💰',hello:'よい品なら、いくらでも。……いや、ほどほどに。',fame:0,pay:1},
 tabibito:{name:'旅人',face:'🎒',hello:'道中の守りに、一振りほしいのだが。',fame:0,pay:0.9},
 kenjutsu:{name:'剣術家',face:'🥋',hello:'道場で使う、折れぬ刀がほしい。',fame:1,pay:1.05},
 jisha:{name:'寺社の使い',face:'⛩',hello:'神前に納める一振りを探しております。',fame:2,pay:1.1},
 mekiki:{name:'目利き',face:'🔍',hello:'名のある刀はないかね。',fame:3,pay:1.15},
 daimyo:{name:'大名の使い',face:'🏯',hello:'殿のお目にかなう刀を。',fame:4,pay:1.25},
 kuge:{name:'公家の使い',face:'📜',hello:'都の宴に、雅な一振りを。',fame:5,pay:1.35},
 shogun:{name:'将軍家の使い',face:'🎌',hello:'上様への献上の品を探しておる。',fame:6,pay:1.5}
};
export const clientsFor=level=>Object.keys(CLIENTS).filter(k=>CLIENTS[k].fame<=level);

export const FAME_LEVELS=[
 {name:'無名の鍛冶場',min:0,reward:1,gift:0.3},
 {name:'町の鍛冶屋',min:50,reward:1.05,gift:0.33},
 {name:'評判の店',min:200,reward:1.1,gift:0.36},
 {name:'城下一の店',min:500,reward:1.15,gift:0.4},
 {name:'大名家御用達',min:1100,reward:1.2,gift:0.43},
 {name:'京に名高い店',min:2200,reward:1.3,gift:0.46},
 {name:'天下一の鍛冶場',min:4000,reward:1.4,gift:0.5}
];
const lvClamp=level=>Math.max(0,Math.min(FAME_LEVELS.length-1,level));
export function fameLevel(fame=0){
 let i=0;FAME_LEVELS.forEach((l,k)=>{if(fame>=l.min)i=k;});
 const L=FAME_LEVELS[i],next=FAME_LEVELS[i+1]||null;
 return {index:i,lv:i+1,...L,fame,next:next?.name||null,toNext:next?next.min-fame:0,progress:next?(fame-L.min)/(next.min-L.min):1};
}
export const fameReward=level=>FAME_LEVELS[lvClamp(level)].reward;
export const fameGift=level=>FAME_LEVELS[lvClamp(level)].gift;
// what a level brings, for the notice when it rises
export function fameNews(from,to){
 const out=[];
 for(let i=from+1;i<=to;i++){
  const U=R.UNLOCKS[i]||{forms:[],materials:[]};
  for(const k of Object.keys(CLIENTS))if(CLIENTS[k].fame===i)out.push(`${CLIENTS[k].face} ${CLIENTS[k].name}が来るようになった`);
  if(U.forms.length)out.push(`新しい形：${U.forms.map(f=>R.form(f).name).join('・')}`);
  if(U.materials.length)out.push(`新しい素材：${U.materials.map(m=>R.material(m).name).join('・')}`);
  if(FAME_LEVELS[i].reward>FAME_LEVELS[i-1].reward)out.push(`注文のお礼が×${FAME_LEVELS[i].reward}に`);
 }
 if(J.BASE_STAR[lvClamp(to)]>J.BASE_STAR[lvClamp(from)])out.push('むずかしい注文が増え、評判も大きく上がるように');
 return out;
}
