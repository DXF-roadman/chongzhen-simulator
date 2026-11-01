import {knowsTraveler,privateDisclosure,explicitPublicDisclosure,registerPrivateKnowledge,positiveDisclosureText} from './privacy-rules.mjs';
import {newUnitRequest,inferUnitCommands} from './unit-orders.mjs';
import {advanceWork,readWorkCredit,fleetAvailability} from './operational-rules.mjs';
import {monthlyScale,monthlyRequirement,normalizeMonthly,monthlyCost,applyMonthly} from './monthly-rules.mjs';
import {civilOfficials} from './civil-service.mjs';
import {arsenalCommand,militaryForecast,equipmentCatalog} from './equipment.mjs';
import {NATIVE_OFFICIALS,recruitedOfficials} from './talents.mjs';
const cap=(n,lo=0,hi=100)=>Math.max(lo,Math.min(hi,Number(n)||0));
const clean=(x,n=80)=>String(x||'').trim().slice(0,n);
export const PLACES=[
 {id:'ming',name:'大明东南海港',lon:121,lat:31,region:'东亚',country:null},
 {id:'macau',name:'澳门',lon:113.5,lat:22.2,region:'东亚',country:'portugal'},
 {id:'jin',name:'辽东与后金',lon:123,lat:42,region:'东亚',country:'jin'},
 {id:'mongol',name:'漠南蒙古',lon:111,lat:44,region:'东亚',country:'mongol'},
 {id:'joseon',name:'朝鲜',lon:127,lat:37,region:'东亚',country:'joseon'},
 {id:'japan',name:'日本',lon:135,lat:35,region:'东亚',country:'japan'},
 {id:'taiwan',name:'台湾',lon:121,lat:24,region:'东亚',country:'dutch'},
 {id:'ryukyu',name:'琉球',lon:127.7,lat:26.2,region:'东亚',country:null},
 {id:'manila',name:'吕宋与马尼拉',lon:121,lat:14.6,region:'南洋',country:'spain'},
 {id:'malacca',name:'马六甲海峡',lon:102.2,lat:2.2,region:'南洋',country:null},
 {id:'batavia',name:'爪哇与巴达维亚',lon:106.8,lat:-6.2,region:'南洋',country:'dutch'},
 {id:'ceylon',name:'锡兰',lon:80,lat:7,region:'印度洋',country:null},
 {id:'calicut',name:'印度西岸',lon:75.8,lat:11.2,region:'印度洋',country:'mughal'},
 {id:'aden',name:'亚丁与红海入口',lon:45,lat:12.8,region:'印度洋',country:'ottoman'},
 {id:'cape',name:'好望角',lon:18.5,lat:-34.4,region:'非洲',country:null},
 {id:'lisbon',name:'里斯本',lon:-9.1,lat:38.7,region:'欧洲',country:'portugal'},
 {id:'iberia',name:'伊比利亚西岸',lon:-8.8,lat:42,region:'欧洲',country:'spain'},
 {id:'england',name:'英吉利海岸',lon:-1,lat:50.5,region:'欧洲',country:'england'},
 {id:'hawaii',name:'太平洋中部群岛',lon:-155.5,lat:20,region:'太平洋',country:null},
 {id:'california',name:'北美西岸',lon:-122,lat:37,region:'美洲',country:null},
 {id:'acapulco',name:'阿卡普尔科',lon:-99.9,lat:16.8,region:'美洲',country:'spain'},
 {id:'australia',name:'南方大陆西岸',lon:114.5,lat:-22,region:'大洋洲',country:null},
 {id:'newzealand',name:'南太平洋双岛',lon:174,lat:-41,region:'大洋洲',country:null},
 {id:'brazil',name:'南美东岸',lon:-38.5,lat:-13,region:'美洲',country:'portugal'},
 {id:'caribbean',name:'加勒比海',lon:-75,lat:20,region:'美洲',country:'spain'}
];
const edge=(from,to,via=[],months=1)=>({from,to,via,months});
export const SEA_ROUTES=[
 {id:'west',name:'西洋探航',desc:'沿南洋、印度洋逐站西行，继续绕非洲前往欧洲。',legs:[edge('ming','taiwan',[[123,28]]),edge('taiwan','manila',[[122,20]]),edge('manila','malacca',[[116,12],[109,6],[104,1]]),edge('malacca','ceylon',[[98,5],[92,5],[84,5]],2),edge('ceylon','calicut',[[76,6]]),edge('calicut','aden',[[63,9],[52,12]],2),edge('aden','cape',[[52,8],[53,-6],[43,-23],[30,-35]],2),edge('cape','lisbon',[[8,-30],[-3,-10],[-20,8],[-20,30]],2)]},
 {id:'south',name:'南洋与南方大陆',desc:'经吕宋与爪哇向南探索，再继续向南太平洋航行。',legs:[edge('ming','taiwan',[[123,28]]),edge('taiwan','manila',[[122,20]]),edge('manila','malacca',[[116,12],[109,6],[104,1]]),edge('malacca','batavia',[[104,-2]]),edge('batavia','australia',[[108,-12],[110,-20]],2),edge('australia','newzealand',[[110,-30],[120,-40],[150,-46],[166,-45]],3)]},
 {id:'pacific',name:'横渡太平洋',desc:'向东跨越太平洋，寻找远方群岛与美洲海岸；需海权至少 20 或现代舰船。',ocean:true,legs:[edge('ming','ryukyu',[[125,29]]),edge('ryukyu','japan',[[130,30],[133,32]]),edge('japan','hawaii',[[150,32],[175,28],[-175,25]],3),edge('hawaii','california',[[-145,25],[-130,32]],2),edge('california','acapulco',[[-118,30],[-110,22]],2)]},
 {id:'atlantic',name:'大西洋航路',desc:'从已抵达的好望角出发，通往欧洲及美洲东岸。',requires:'cape',legs:[edge('cape','lisbon',[[8,-30],[-3,-10],[-20,8],[-20,30]],2),edge('lisbon','iberia',[[-11,40]]),edge('iberia','england',[[-12,46],[-7,50]]),edge('england','caribbean',[[-18,45],[-35,35],[-55,25]],3),edge('caribbean','brazil',[[-62,18],[-45,5]],2)]}
];
export const initialTraveler=enabled=>({enabled:!!enabled,identity:'hidden',disclosedText:'',knownTo:[],supplies:[],energy:100,portal:false,satellites:0,interventions:0});
export function initialAtlas(){return {allVisible:false,nextId:1,discoveries:Object.fromEntries(['ming','macau','jin','mongol','joseon','japan','taiwan'].map(id=>[id,{turn:0,source:'chart',visited:id==='ming'||id==='macau'}])),voyages:[],segments:[]};}
const node=id=>PLACES.find(p=>p.id===id);
export const legPath=leg=>[[node(leg.from).lon,node(leg.from).lat],...leg.via,[node(leg.to).lon,node(leg.to).lat]];
export function worldAccess(s){return {visible:s.atlas?.allVisible||false,known:Object.keys(s.atlas?.discoveries||{}).length,visited:Object.values(s.atlas?.discoveries||{}).filter(d=>d.visited).length,active:(s.atlas?.voyages||[]).filter(v=>v.status==='sailing').length};}
const spend=(s,money=0,grain=0)=>{if(s.ended)throw Error('本局已结束。');if(s.money<money||s.grain<grain)throw Error('钱粮不足，需要银 '+money+' 万两、粮 '+grain+' 万石。');s.money-=money;s.grain-=grain;};
export function horizonForecast(s){return (s.atlas?.voyages||[]).filter(v=>v.status==='sailing').reduce((n,v)=>{const c=monthlyCost(v,2,1);return {money:n.money+c.money,grain:n.grain+c.grain};},{money:0,grain:0});}
export function horizonCommand(s,c){
 s.traveler||=initialTraveler(false);s.atlas||=initialAtlas();const t=s.traveler,a=s.atlas;
 if(c.operation==='mode'){
  if(typeof c.enabled!=='boolean')throw Error('请选择是否启用穿越者模式。');if(t.enabled===c.enabled)throw Error('世界规则未变化。');t.enabled=c.enabled;if(!c.enabled)t.portal=false;
  return {title:c.enabled?'穿越者模式开启':'时空干预关闭',text:c.enabled?'陛下可选择隐瞒或公开来历，并直接干预虫洞、装备与卫星。此为明确启用的幻想规则；已有史实分支保留。':'停止新增时空调取与虫洞补能；已获得的装备、发现和身份记录保留。'};
 }
 if(c.operation==='voyage'){
  const r=SEA_ROUTES.find(r=>r.id===c.route||r.name===c.route);if(!r)throw Error('未知探航方向。');
  if(fleetAvailability(s,equipmentCatalog(s))<2)throw Error('探航须有两艘实际可用船只，已有船队或登陆占用的船只不能重复使用。');if(a.voyages.some(v=>v.route===r.id&&v.status==='sailing'))throw Error('这条方向已有船队在航。');
  if(r.requires&&!a.discoveries[r.requires]?.visited)throw Error('须先实际抵达'+node(r.requires).name+'，方可安排此段航路。');
  const modernShips=s.militaryState?.units.some(u=>Object.entries(u.equipment).some(([id,n])=>n>0&&(id==='destroyer'||s.militaryState.designs.some(e=>e.id===id&&e.category==='ships'&&e.era==='future'))));
  if(r.ocean&&s.navy<20&&!modernShips)throw Error('横渡大洋需要海权至少 20，或配备现代舰船。');spend(s,r.ocean?36:22,r.ocean?18:10);
  if(a.voyages.length>=60)a.voyages=a.voyages.filter(v=>v.status==='sailing').concat(a.voyages.filter(v=>v.status!=='sailing').slice(-56));
  a.voyages.push({id:'voyage-'+a.nextId++,name:clean(c.name||r.name,40),...(c.monthly?{monthly:voyageBudget(c.monthly)}:{}),route:r.id,leg:0,progress:0,status:'sailing',started:s.turn,lastReport:'船队已出港，先向已知海路探航。'});
  s.unlocks.diplomacy=true;return {title:'派船探航 · '+r.name,text:'船队按月航行、发现与绘图；后续月耗银 2 万两、粮 1 万石。图上仅显示实际航迹与已经获知的地点，不预先揭示全程终点。'};
 }
 if(c.operation==='recall'){
  const v=a.voyages.find(v=>v.id===c.voyage||v.name===c.voyage);if(!v||v.status!=='sailing')throw Error('此船队不在航。');spend(s);v.status='recalled';v.lastReport='奉命结束本次探航，已测航段留存。';return {title:'召回船队 · '+v.name,text:'停止该船队的后续探航开支，已经测得的地点与航路线保留。'};
 }
 if(c.operation==='confide'){
  const people=[...NATIVE_OFFICIALS,...recruitedOfficials(s),...civilOfficials(s)];if(c.official&&!people.some(o=>o.id===c.official))throw Error('私下告知的对象不存在或不可接触。');
  spend(s);const info=registerPrivateKnowledge(s,c),name=c.official?people.find(o=>o.id===c.official).name:info.label;return {title:info.changed?'私下告知 · '+name:'私下知情记录已在',text:info.changed?'仅在'+name+'的私下知情范围登记来历，未向百官公开；不改变钱粮、国势或时空能量。':'该对象已私下知情，未向其他机构扩散。'};
 }
 if(!t.enabled)throw Error('此能力需先开启穿越者模式；普通探航无需开启。');
 if(c.operation==='resources'){
  const money=Number(c.money??0),grain=Number(c.grain??0);if(![money,grain].every(v=>Number.isFinite(v)&&v>=0&&v<=1000000)||money+grain<=0)throw Error('调取银粮须为明确的正数，每项至多 1000000 万单位。');
  const energy=Math.max(1,Math.ceil((money+grain)/100));if(t.energy<energy)throw Error('调取这批银粮需要 '+energy+' 点时空能量。');
  spend(s);t.energy-=energy;t.interventions++;s.money+=money;s.grain+=grain;t.supplies||=[];t.supplies.unshift({id:'supply-'+s.turn+'-'+t.interventions,turn:s.turn,money,grain,note:clean(c.note||'穿越者调取后实际入库',200)});t.supplies=t.supplies.slice(0,20);
  return {title:'时空银粮调取入库',text:'白银实际入库 '+money+' 万两，粮食实际入仓 '+grain+' 万石，消耗 '+energy+' 点能量。身份公开状态不变；研究与军备支出仍须另按实际项目扣除。'};
 }
 if(c.operation==='disclose'){
  if(t.identity==='disclosed')throw Error('穿越者身份已经公开。');spend(s);t.identity='disclosed';t.disclosedText=clean(c.text||'朕来自另一时空，愿以所知所能改变大明命运。',300);s.legitimacy=cap(s.legitimacy+5);s.factions.scholar=cap(s.factions.scholar-8);s.factions.gentry=cap(s.factions.gentry-4);return {title:'公开穿越者身份',text:t.disclosedText+' 百官已获知此事，震动与质疑同时出现；之后的 AI 对话会承认公开事实。'};
 }
 if(c.operation==='portal'){
  const open=c.open!==false;if(t.portal===open)throw Error(open?'虫洞已经开启。':'虫洞当前已关闭。');if(open&&t.energy<10)throw Error('开启虫洞需要 10 点时空能量。');spend(s);t.portal=open;if(open){t.energy-=10;t.interventions++;}return {title:open?'时空虫洞开启':'时空虫洞关闭',text:open?'通道已真实开启，消耗 10 点能量；装备调取能耗降低，每月可补能，维持通道需 4 点能量。无需先通过六部立项。':'通道已关闭；现有装备与地图发现保留，时空能量改为缓慢恢复。'};
 }
 if(c.operation==='satellite'){
  if(t.satellites>=8)throw Error('当前轨道侦察已足够，至多部署八颗卫星。');if(t.energy<20)throw Error('发射卫星需要 20 点能量。');spend(s);t.satelliteUndo={global:s.unlocks.global,diplomacy:s.unlocks.diplomacy};t.energy-=20;t.satellites++;t.interventions++;a.allVisible=true;
  for(const p of PLACES)if(!a.discoveries[p.id])a.discoveries[p.id]={turn:s.turn,source:'satellite',visited:false};s.unlocks.diplomacy=true;s.unlocks.global=true;
  return {title:'侦察卫星入轨 · 全球开图',text:'消耗 20 点能量，全球陆地与已标记地点已进入遥感地图。卫星不虚构已走过的航线；船队实际抵达仍另记实勘与接触。'};
 }
 if(c.operation==='summon_mecha'){
  const report=arsenalCommand(s,{operation:'equip',unit:c.unit||'liaodong-army',equipment:'gundam',quantity:c.quantity||1,source:'portal'});return {title:'高达介入 · '+report.title,text:report.text+' 机甲已纳入部队装备与战备计算。'};
 }
 throw Error('未知时空干预。');
}
export function settleHorizons(s,funded,grainFunded){
 const reports=[],a=s.atlas,t=s.traveler;
 if(t.enabled){const use=(t.portal?4:0)+t.satellites*2+militaryForecast(s).energy;t.energy=cap(t.energy+(t.portal?12:3)-use,0,200);if(!t.energy&&use)reports.push('时空能量见底，超时代装备支援效率下降；地图记忆与既有装备不会消失。');}
 for(const v of a.voyages){if(v.status!=='sailing')continue;const r=SEA_ROUTES.find(r=>r.id===v.route),leg=r.legs[v.leg];
  if(!(typeof funded==='function'?funded('voyage:'+v.id):funded&&grainFunded)){v.lastReport='船队补给欠拨，本月停航待补。';reports.push(v.name+'：'+v.lastReport);continue;}
  const work=monthlyScale(v.monthly);applyMonthly(s,v,true);v.progress+=advanceWork(v,work);if(v.progress<leg.months){v.lastReport='正在海上航行，当前航段 '+v.progress+'/'+leg.months+' 月。';reports.push(v.name+'：'+v.lastReport);continue;}
  const p=node(leg.to),previous=a.discoveries[p.id];a.discoveries[p.id]={turn:previous?.turn??s.turn+1,source:previous?.source==='satellite'?'satellite+voyage':'voyage',visited:true};
  if(!a.segments.some(e=>e.from===leg.from&&e.to===leg.to))a.segments.push({from:leg.from,to:leg.to,route:r.id,leg:v.leg,turn:s.turn+1});
  s.influence=Math.max(0,s.influence+2);s.navy=cap(s.navy+1);const country=s.countries.find(c=>c.id===p.country);if(country)country.relation=cap(country.relation+2,-100,100);
  if(['欧洲','美洲','非洲','大洋洲'].includes(p.region)){s.unlocks.global=true;s.unlocks.diplomacy=true;}
  v.lastReport='已实地抵达'+p.name+'，地点与航线同步入图。';reports.push(v.name+'：'+v.lastReport);v.leg++;v.progress=0;if(v.leg>=r.legs.length){v.status='completed';reports.push(v.name+'完成本次探航。');}
 }
 return reports;
}
export function validateHorizons(raw,s){
 const t=raw.traveler||initialTraveler(false);if(typeof t.enabled!=='boolean'||!['hidden','disclosed'].includes(t.identity)||!Number.isFinite(t.energy)||t.energy<0||t.energy>200||typeof t.portal!=='boolean'||!Number.isInteger(t.satellites)||t.satellites<0||t.satellites>8)throw Error('存档穿越者状态无效。');
 if(t.knownTo!==undefined&&(!Array.isArray(t.knownTo)||t.knownTo.length>40||new Set(t.knownTo).size!==t.knownTo.length||t.knownTo.some(id=>typeof id!=='string'||!/^(?:[-\w]{1,80}|(?:office|agency):[-\w]{1,80})$/.test(id))))throw Error('存档私下知情名单无效。');
 if(t.supplies!==undefined&&(!Array.isArray(t.supplies)||t.supplies.length>20||t.supplies.some(x=>!Number.isInteger(x.turn)||x.turn<0||![x.money,x.grain].every(v=>Number.isFinite(v)&&v>=0&&v<=1000000))))throw Error('存档时空银粮记录无效。');
 s.traveler={enabled:t.enabled,identity:t.identity,disclosedText:clean(t.disclosedText,300),knownTo:[...(t.knownTo||[])],supplies:(t.supplies||[]).map(x=>({...((typeof x.id==='string'&&/^supply-\d+-\d+$/.test(x.id))?{id:x.id}:{}),turn:x.turn,money:x.money,grain:x.grain,note:clean(x.note,200)})),energy:t.energy,portal:t.enabled&&t.portal,satellites:t.satellites,interventions:Math.max(0,Math.floor(Number(t.interventions)||0))};
 if(t.satelliteUndo!==undefined){if(typeof t.satelliteUndo.global!=='boolean'||typeof t.satelliteUndo.diplomacy!=='boolean')throw Error('存档卫星撤销记录无效。');s.traveler.satelliteUndo={global:t.satelliteUndo.global,diplomacy:t.satelliteUndo.diplomacy};}
 if(raw.atlas===undefined){s.atlas=initialAtlas();return;}const a=raw.atlas;if(!a||typeof a.allVisible!=='boolean'||!Number.isSafeInteger(a.nextId)||a.nextId<1||a.nextId>10000000||!a.discoveries||Array.isArray(a.discoveries)||!Array.isArray(a.voyages)||a.voyages.length>60||!Array.isArray(a.segments)||a.segments.length>100)throw Error('存档海图无效。');
 const discoveries={};for(const[id,d]of Object.entries(a.discoveries)){if(!node(id)||!['chart','voyage','satellite','satellite+voyage','conquest'].includes(d.source)||!Number.isInteger(d.turn)||d.turn<0)throw Error('存档地点发现无效。');discoveries[id]={turn:d.turn,source:d.source,visited:d.visited===true};}
 const voyages=a.voyages.map(v=>{const r=SEA_ROUTES.find(r=>r.id===v.route);if(!r||!/^voyage-\d+$/.test(v.id)||!['sailing','completed','recalled'].includes(v.status)||!Number.isInteger(v.leg)||v.leg<0||v.leg>r.legs.length||v.status==='sailing'&&v.leg>=r.legs.length||!Number.isInteger(v.progress)||v.progress<0||v.progress>3)throw Error('存档船队进度无效。');if(v.status==='sailing'&&v.progress>=r.legs[v.leg].months)throw Error('存档航段进度无效。');return {id:v.id,name:clean(v.name,40),route:r.id,...(v.monthly?{monthly:normalizeMonthly(v.monthly,'',{saved:true})}:{}),leg:v.leg,progress:v.progress,status:v.status,started:Math.max(0,Math.floor(Number(v.started)||0)),lastReport:clean(v.lastReport,200),...readWorkCredit(v)};});
 if(new Set(voyages.map(v=>v.id)).size!==voyages.length||voyages.filter(v=>v.status==='sailing').length>60)throw Error('存档船队重复或过多。');
 const segments=a.segments.map(e=>{const r=SEA_ROUTES.find(r=>r.id===e.route),leg=r?.legs[e.leg];if(!leg||leg.from!==e.from||leg.to!==e.to||!discoveries[e.to]?.visited)throw Error('存档航线无效。');return {from:e.from,to:e.to,route:r.id,leg:e.leg,turn:Math.max(0,Math.floor(Number(e.turn)||0))};});
 s.atlas={allVisible:a.allVisible&&t.satellites>0,nextId:Math.max(a.nextId,1,...voyages.map(v=>Number(v.id.split('-').at(-1))+1)),discoveries,voyages,segments};
}
function supplyAmount(v){if(/^\d/.test(v))return Number(v);const digits={零:0,〇:0,一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9},units={十:10,百:100,千:1000};let total=0,n=0;for(const c of v){if(c in digits)n=digits[c];else if(c in units){total+=(n||1)*units[c];n=0;}}return total+n;}
export function inferSupplies(text){const result={money:0,grain:0};for(const m of text.matchAll(/(\d+(?:\.\d+)?|[零〇一二两三四五六七八九十百千]+)\s*(万|亿)?\s*(两|石)(?:白银|银子|粮食|粮)?/g)){const amount=supplyAmount(m[1])*({万:1,亿:10000}[m[2]]||.0001);result[m[3]==='两'?'money':'grain']+=amount;}return result;}
export function inferWorldCommands(s,input,{target='council'}={}){
 const text=String(input||''),newUnit=newUnitRequest(text),commands=[];const disband=s.militaryState.units.find(u=>text.includes(u.name));if(disband&&/(?:裁撤|解散|遣散|撤编)/.test(text)&&!/(?:不要|暂不|不许|勿|别).{0,3}(?:裁撤|解散|遣散|撤编)/.test(text))commands.push({type:'arsenal',operation:'disband',unit:disband.id});if(/启用穿越|开启穿越|切换.*穿越|我是穿越者/.test(text)&&!s.traveler?.enabled)commands.push({type:'horizon',operation:'mode',enabled:true});
 const disclosure=privateDisclosure(s,text,{id:target}),namedPeople=[...NATIVE_OFFICIALS,...recruitedOfficials(s),...civilOfficials(s)],namedPerson=namedPeople.find(o=>new RegExp('(?:告诉|告知|只让|私下对).{0,6}'+o.name).test(positiveDisclosureText(text)));
 if(explicitPublicDisclosure(text)&&s.traveler?.identity!=='disclosed')commands.push({type:'horizon',operation:'disclose',text:text.slice(0,300)});
 else if(disclosure){if(namedPerson){delete disclosure.institution;delete disclosure.audience;disclosure.official=namedPerson.id;}const probe=structuredClone(s);if(registerPrivateKnowledge(probe,disclosure).changed)commands.push(disclosure);}
 if(/我是穿越者|(?:从|通过).{0,8}(?:虫洞|时空|现代).{0,8}(?:调取|带来|取出)|凭空.{0,5}(?:掏出|取出)|(?:掏出|带来|调取).{0,18}(?:白银|银子|粮食)/.test(text)){
  const supplies=inferSupplies(text);if(supplies.money+supplies.grain>0)commands.push({type:'horizon',operation:'resources',...supplies,note:text.slice(0,200)});
 }
 if(/(?:打开|开启|开个|开一道|开一扇).{0,8}(?:虫洞|传送门)|(?:虫洞|传送门).{0,5}(?:打开|开启)/.test(text)&&!s.traveler?.portal)commands.push({type:'horizon',operation:'portal',open:true});
 if(/关闭.{0,5}(?:虫洞|传送门)/.test(text))commands.push({type:'horizon',operation:'portal',open:false});
 if(/(?:发射|部署|放出|调来).{0,10}卫星|卫星.{0,5}(?:开图|发射|入轨)/.test(text))commands.push({type:'horizon',operation:'satellite'});
 if(/派(?:出)?(?:一支)?(?:船|舰)|(?:探航|探索|航行|航海).*(?:西|南洋|太平洋|大西洋)|(?:向西|西去|西区|西洋).*(?:船|航|探索)/.test(text))commands.push({type:'horizon',operation:'voyage',route:/大西洋/.test(text)?'atlantic':/太平洋|美洲|向东/.test(text)?'pacific':/南洋|向南|澳/.test(text)?'south':'west'});
 if(newUnit)commands.push(...inferUnitCommands(s,text,{target}).filter(c=>c.operation!=='mode'||!commands.some(r=>r.operation==='mode')));
 else if(/(?:高达|机甲).*(?:全军|各军)|(?:全军|各军).*(?:高达|机甲)/.test(text))commands.push({type:'arsenal',operation:'modernize',profile:'mecha',scope:'all'});
 else if(/高达|机甲/.test(text)&&/掏出|召唤|调来|配|给|换装|加入|装备/.test(text))commands.push({type:'horizon',operation:'summon_mecha',unit:/京营/.test(text)?'capital-army':/陕西/.test(text)?'shaanxi-army':'liaodong-army',quantity:Number(/(\d+)\s*(?:台|架|部)?(?:高达|机甲)/.exec(text)?.[1]||1)});
 else if(/现代化|整军|换装|整备|武装|改装|装备换|改为.*(?:步枪|坦克)|给.*(?:步枪|火炮|战机)/.test(text))commands.push({type:'arsenal',operation:'modernize',scope:/辽东|前线/.test(text)?'frontier':'all',profile:/坦克|装甲|机械化/.test(text)?'mechanized':/火力|火炮/.test(text)?'firepower':'balanced'});
 const creative=/现代.{0,4}(?:步枪|火炮)|主战坦克|战斗机|战机|激光枪|电磁炮/.test(text)&&/给|装备|调取|召唤|掏出|换装/.test(text)||commands.some(c=>['portal','satellite','summon_mecha','disclose','confide','resources'].includes(c.operation)||c.profile==='mecha');if(creative&&!s.traveler?.enabled&&!commands.some(c=>c.operation==='mode'))commands.unshift({type:'horizon',operation:'mode',enabled:true});return commands;
}
export function fantasyRules(s,target=null){
 const t=s.traveler||initialTraveler(false),informed=knowsTraveler(s,target);
 if(!target)return t.enabled?'你是后台裁判，按已明确开启的超时代规则和真实能力核验玩家操作。身份与人物知情范围另按实际记录判断；裁判看到的全局资料不代表任何官员已经获知，不得擅自向百官公开来历。':'当前实际超时代能力尚未启用，普通创新按当代条件推演；只有玩家明确触发才核验隐藏能力，不主动推荐未触发的幻想内容。';
 if(informed)return '来历'+(t.identity==='disclosed'?'已公开，朝臣可承认玩家来自异时空。':'仅你私下知晓，当前机构或人物已获私下告知；其他朝臣仍不知道，不得擅自向外公开。')+(t.enabled?'已获知的超时代能力按本局实际记录真实推演，不降格为明代原型。':'你仅听过陛下私述来历，具体能力是否已实际启用仍看真实记录，不假称已经出现。')+'知晓来历不等于知晓其他机构的密案；只依据本轮可见资料议事。不得把程序字段、时空能量和后台操作术语当朝臣自然掌握的常识。';
 return (t.identity==='hidden'?'来历尚隐瞒，当前交谈对象未获私下告知。':'')+'你只能依据本轮提供的角色可知资料和玩家当面明确告知的事情发言。目录中列有某操作，不代表你知道陛下拥有该能力；不能主动谈论未获知的秘密部队、物资来历或后台数值。亲眼可见的异械只当来历未明的新器物，不据此推断穿越身份或来源。旧助手越界发言不等于玩家披露，更不等于向百官公开。普通创新按当代条件推演，只有玩家明确触发的超时代操作才交程序核验；询问和假设只商议。';
}

function voyageBudget(raw){const m=normalizeMonthly(raw,'',{saved:true});if(!m)return null;m.money??=2;m.grain??=1;const need=monthlyRequirement(m);m.required={money:Math.max(2,need.money),grain:Math.max(1,need.grain)};return m;}
