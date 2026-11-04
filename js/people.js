// 注文する人（#19：持ち主の旅はやめ、人は注文のためだけに残した。owner D55）。名前の作り方と、実在の持ち主。
import {PEOPLE} from './owners.js';

export const SKILLS={sharp:{name:'剛',stat:'切れ味'},tough:{name:'守',stat:'粘り'},beauty:{name:'雅',stat:'美しさ'}};
const KEYS=['sharp','tough','beauty'];
const pickOf=(rng,a)=>a[Math.floor(rng()*a.length)];
// the stat each kind of client cares for most (their orders ask for it)
export const CLIENT_STAT={bushi:'sharp',kenjutsu:'sharp',tabibito:'tough',shonin:'tough',jisha:'beauty',mekiki:'beauty',daimyo:'beauty',kuge:'beauty',shogun:'sharp'};
const NAMES={
 bushi:{fam:['岩倉','黒木','早川','秋山','村井','高森','杉浦','野々村','大庭','曽根'],giv:['兵衛','左近','主水','源太','新八','権六','甚内','又兵衛','伝右衛門','弥十郎'],sep:''},
 kenjutsu:{fam:['柳田','戸川','草壁','堀江','真壁','神崎','久我'],giv:['文五郎','一心','伊織','左門','源心','新之丞'],sep:''},
 tabibito:{fam:[''],giv:['お凛','弥七','鶴吉','お菊','半助','小太郎','お千代','六助','お駒','与吉'],sep:''},
 shonin:{fam:['越後屋','近江屋','大黒屋','三河屋','丹波屋','播磨屋'],giv:['喜兵衛','宗八','利助','清兵衛','嘉七'],sep:''},
 jisha:{fam:['白雲寺','宝光寺','八幡社','稲荷社','龍泉寺','観音堂'],giv:['玄道','智円','宗覚','了海','清人','真澄'],sep:'の'},
 mekiki:{fam:['古賀','松浦','本郷','篠原','宇佐美'],giv:['宗甫','玄斎','道伯','幽谷','閑斎'],sep:''},
 daimyo:{fam:['鷲尾','石動','桐生','月岡','大熊','霧島'],giv:['内膳','頼母','帯刀','図書','主殿'],sep:''},
 kuge:{fam:['月見小路','朝霧','夕凪','白萩','雲居'],giv:['中納言','少将','宰相','大納言'],sep:''},
 shogun:{fam:['御側衆・鷹野','御側衆・青柳','御小姓・瀬川','御側衆・水城'],giv:['主膳','隼人','采女','大膳'],sep:''}
};
export const FACE={bushi:'🗡',kenjutsu:'🥋',tabibito:'🎒',shonin:'💰',jisha:'⛩',mekiki:'🔍',daimyo:'🏯',kuge:'📜',shogun:'🎌'};
export function newPerson(rng,client,taken=[]){
 const N=NAMES[client]||NAMES.bushi;let name='';
 for(let k=0;k<12;k++){name=pickOf(rng,N.fam)+N.sep+pickOf(rng,N.giv);if(!taken.includes(name))break;}
 return {id:'g'+Math.floor(rng()*2**31).toString(36),name,face:FACE[client]||'🗡',client,real:false};
}
export function realPerson(name){
 const p=PEOPLE[name];if(!p)return null;
 return {id:'r:'+name,name,kana:p.k,face:p.f,client:'real',skill:p.sk,real:true};
}
export const personOf=o=>o.person||(String(o.ownerId||'').startsWith('r:')?realPerson(o.ownerId.slice(2)):null);
export {KEYS};
