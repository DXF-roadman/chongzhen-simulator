import {rolePay} from './fiscal-rules.mjs';
import {PLACES} from './horizons.mjs';
import {equipmentCatalog,unitStatus,refreshMilitary,unitCapability} from './equipment.mjs';
import {mobilizationCost,rememberHire,unitMaintenance,fleetAvailability} from './operational-rules.mjs';
const clamp=(n,a=0,b=100)=>Math.max(a,Math.min(b,Number(n)||0));
const box=(w,s,e,n)=>[[w,s],[e,s],[e,n],[w,n],[w,s]];
const core=[
 ['capital','京畿',116.4,39.5,box(113.5,36.5,119,41.5)],['liaodong','辽东防区',120.2,40.6,box(119,39,122,41.5)],['shanxi','山西',112,37.5,box(110,34.5,113.5,40.5)],['shaanxi','陕西',108.4,35.8,box(105.5,32.5,110,39.5)],['shandong','山东',118.5,36.3,box(116,34.5,122,38)],['henan','河南',113.2,33.8,box(110,31.5,116,36.5)],['jiangnan','南直隶',119,32,box(116,29,122,34.5)],['huguang','湖广',112,28.8,box(108,25,116,31.5)],['sichuan','四川',103.8,30.5,box(99,28,108,32.5)],['zhemin','浙闽',119,26.3,box(116,23,122,29)],['liangguang','两广',112,23,box(108,20,116,25)],['yungui','云贵',103.8,25,box(98,21,108,28)]
];
const foreign=[
 ['liaoshen','辽沈地区','jin','jin',72,'皇太极',box(122,40,126,44.5),false],
 ['steppe','漠南草原','mongol','mongol',58,'蒙古部众统领',box(106,41,119,45),false],
 ['joseon-north','朝鲜北道','joseon','joseon',54,'当地守将',box(124.3,39,129.5,42.5),false],
 ['kyushu','九州沿岸','japan','japan',65,'藩军统领',box(129.5,30.8,132.1,33.9),true],
 ['tainan','台南沿岸','taiwan','dutch',35,'荷方驻军官',box(120.05,22.65,120.65,23.25),true],
 ['macau-port','澳门商港','macau','portugal',32,'商港守备官',box(113.45,22.12,113.6,22.25),true],
 ['luzon','吕宋中部','manila','spain',57,'西班牙驻军官',box(119.6,13.5,122.4,17.5),true],
 ['malacca-port','马六甲沿岸','malacca','portugal',57,'海峡驻军官',box(101.6,1.6,103,3.3),true],
 ['java-port','爪哇西岸','batavia','dutch',71,'荷方驻军官',box(105.2,-7.3,108.1,-5.7),true],
 ['ceylon-port','锡兰沿岸','ceylon','portugal',60,'海港守将',box(79.5,5.8,81.6,8.6),true],
 ['india-port','印度西岸港区','calicut','mughal',75,'当地军政统领',box(74.8,10.1,76.6,12.2),true],
 ['aden-port','亚丁港区','aden','ottoman',70,'港口守将',box(44.3,12.3,46,13.7),true],
 ['cape-port','好望角沿岸','cape','local',42,'当地武装统领',box(17.5,-35,20,-32.8),true],
 ['lisbon-port','里斯本周边','lisbon','portugal',76,'葡方守备官',box(-9.5,38,-8.5,39.5),true],
 ['iberia-port','伊比利亚西岸港区','iberia','spain',78,'王室驻军官',box(-9.3,41,-7.8,43),true],
 ['english-port','英吉利南岸','england','england',82,'英方驻军官',box(-5.5,50,-.5,52),true],
 ['hawaii-islands','太平洋中部群岛','hawaii','local',30,'群岛武装统领',box(-161,18,-154,23),true],
 ['california-port','北美西岸据点','california','spain',47,'据点守将',box(-124,35,-120,39),true],
 ['acapulco-port','阿卡普尔科港区','acapulco','spain',65,'港口守将',box(-101.2,16,-99,18),true],
 ['australia-west','南方大陆西岸','australia','local',35,'当地武装统领',box(113,-25,116,-20),true],
 ['newzealand-coast','南太平洋双岛沿岸','newzealand','local',40,'当地武装统领',box(172,-43,177,-38),true],
 ['brazil-port','南美东岸港区','brazil','portugal',65,'葡方驻军官',box(-40.5,-15,-37,-11),true],
 ['caribbean-port','加勒比海据点','caribbean','spain',70,'西班牙驻军官',box(-78,18,-72,22.5),true]
];
export const REGIONS=[...core.map(([id,name,lon,lat,polygon])=>({id,name,lon,lat,polygon,home:true,owner:'ming',place:'ming',sea:false,base:0,commander:''})),...foreign.map(([id,name,place,owner,base,commander,polygon,sea])=>{const p=PLACES.find(p=>p.id===place);return {id,name,place,owner,base,commander,polygon,sea,home:false,lon:(Math.min(...polygon.map(p=>p[0]))+Math.max(...polygon.map(p=>p[0])))/2,lat:(Math.min(...polygon.map(p=>p[1]))+Math.max(...polygon.map(p=>p[1])))/2,area:p.region};})];
export const TACTICS={assault:'正面进攻',encircle:'迂回包围',bombard:'火力压制',hold:'固守待援'};
export const initialCampaign=()=>({nextId:1,control:Object.fromEntries(REGIONS.map(r=>[r.id,r.owner])),battles:[],enemies:REGIONS.filter(r=>!r.home).map(r=>({id:'enemy-'+r.id,region:r.id,name:(r.owner==='local'?'地方':({jin:'后金',mongol:'蒙古',joseon:'朝鲜',japan:'日本',dutch:'荷方',portugal:'葡方',spain:'西班牙',mughal:'印度',ottoman:'西亚',england:'英方'}[r.owner]))+'守军',commander:r.commander,strength:r.base,tactic:'hold',status:'deployed'}))});
export const foreignProvince=r=>({id:'occupied-'+r.id,name:r.name,subtitle:'新附领地 · 驻军与地方善后',foreign:true,territory:r.id,governor:null,x:0,y:0,polygon:'',prosperity:35,unrest:65,drought:20});
const spend=(s,money=0,grain=0)=>{if(s.ended)throw Error('本局已结束。');if(s.money<money||s.grain<grain)throw Error('出征钱粮不足。');s.money-=money;s.grain-=grain;};
const region=(id)=>REGIONS.find(r=>r.id===id||r.name===id);
export function battlePower(s,u,tactic='assault'){
 const c=unitCapability(s,u),organization=Math.max(0,Math.min(100,s.army-(s.militaryState.appliedBonus||0)));
 return Math.round((c.attack*.65+c.defense*.35)*8*c.training*(.55+c.readiness*.45)*(.9+organization/500)*(tactic==='hold'?.65:tactic==='bombard'?1.08:tactic==='encircle'?1.03:1));
}
function transportNeed(u){return Math.max(1,Math.ceil((u.needs.infantry||0)/3000+(u.needs.armor||0)/10+(u.needs.artillery||0)/200));}
function transportAvailable(s){return fleetAvailability(s,equipmentCatalog(s));}
export function warCommand(s,c,officials=[]){
 s.campaignState||=initialCampaign();const w=s.campaignState;
 if(c.operation==='commander'||c.operation==='governor'){
  const o=c.official?officials.find(o=>o.id===c.official||o.name===c.official):null;if(c.official&&!o)throw Error('此人尚不可任用。');
  const entity=c.operation==='commander'?s.militaryState.units.find(u=>u.id===c.unit||u.name===c.unit):s.provinces.find(p=>p.id===c.province||p.name===c.province);
  if(!entity)throw Error('未找到部队或领地。');if((entity[c.operation==='commander'?'commander':'governor']||null)===(o?.id||null))return {title:'任职保持 · '+entity.name,text:'原任命已生效，本次不重复扣费。'};if(c.operation==='commander')delete entity.commanderIncludedInBase;spend(s,o?mobilizationCost(s,o):0);if(o)rememberHire(s,o.id);entity[c.operation==='commander'?'commander':'governor']=o?.id||null;
  return {title:'委任'+(c.operation==='commander'?'统帅':'地方主官')+' · '+entity.name,text:o?o.name+'受命主持；兼任会纳入精力分摊，月俸按本局现行经费规则结算。':'解除专任，改由属官维持。'};
 }
 if(c.operation==='attack'){
  const r=region(c.target);if(!r||r.home||w.control[r.id]==='ming')throw Error('目标不存在或已经实控。');
  if(!s.atlas.discoveries[r.place])throw Error('目标尚未进入海图，请先探航获知。');
  const u=c.unit?s.militaryState.units.find(u=>u.id===c.unit||u.name===c.unit):[...s.militaryState.units].sort((a,b)=>b.priority-a.priority)[0];if(!u)throw Error('没有可出征部队。');
  if(w.battles.some(b=>b.status==='active'&&(b.unit===u.id||b.target===r.id)))throw Error('该军或目标已有战事，请先处理当前战役。');
  const distant=r.sea&&!['taiwan','macau','japan'].includes(r.place);if(r.sea&&s.navy<(distant?20:5)&&!s.traveler.portal)throw Error('海运补给不足：近海需海权 5、远洋需 20；先建设水师。');
  if(distant&&!s.atlas.discoveries[r.place]?.visited&&!s.traveler.portal)throw Error('远洋登陆须先实际探航抵达目标，建立补给航路。');
  if(battlePower(s,u)<=0)throw Error('该部队没有可用装备，先整备再出征。');const transports=r.sea&&!s.traveler.portal?transportNeed(u):0;if(transports>transportAvailable(s))throw Error('实际运输船不足，所需 '+transports+' 艘；请生产舰船或等待占用船只返航。');
  spend(s,28,16);const tactic=Object.hasOwn(TACTICS,c.tactic)?c.tactic:'assault';
  w.battles.push({id:'battle-'+w.nextId++,target:r.id,unit:u.id,origin:region(u.region)?.id||s.provinces.find(p=>p.id===u.region)?.territory||'liaodong',tactic,enemyTactic:'hold',progress:0,months:0,status:'active',lastReport:'部队已受命出征，当前尚未占领目标。',started:s.turn,...(transports?{transports}:{})});
  if(w.battles.length>80)w.battles=w.battles.filter(b=>b.status==='active').concat(w.battles.filter(b=>b.status!=='active').slice(-60));
  const enemy=w.enemies.find(e=>e.region===r.id);enemy.status='deployed';enemy.strength=Math.max(enemy.strength,r.base*.7);
  return {title:'出征 · '+r.name,text:u.name+'采取'+TACTICS[tactic]+'，敌方为'+enemy.name+'，指挥官'+enemy.commander+'。需按月交战，战果才改变控制区。每月战费银 8、粮 4。'};
 }
 const b=w.battles.find(b=>b.id===c.battle&&b.status==='active');if(!b)throw Error('战役已结束或不存在。');
 if(c.operation==='retreat'){spend(s);b.status='retreated';b.lastReport='奉命撤军，未取得实控领土。';return {title:'撤军 · '+region(b.target).name,text:b.lastReport};}
 if(c.operation==='order'){if(!Object.hasOwn(TACTICS,c.tactic))throw Error('未知战术。');spend(s);b.tactic=c.tactic;return {title:'军令 · '+region(b.target).name,text:'改用'+TACTICS[c.tactic]+'，下月按新军令与敌军应对结算。'};}
 throw Error('未知军事指令。');
}
export function campaignForecast(s){const w=s.campaignState||initialCampaign(),extra=s.provinces.filter(p=>p.foreign),leaders=s.provinces.reduce((n,p)=>n+rolePay(s,'governor',p.governor,p.id),0)+(s.militaryState?.units||[]).reduce((n,u)=>n+rolePay(s,'commander',u.commander,u.id),0);return {cost:w.battles.filter(b=>b.status==='active').length*8+extra.length*3+leaders,grain:w.battles.filter(b=>b.status==='active').length*4,revenue:extra.reduce((n,p)=>n+p.prosperity*.15*(1-p.unrest/150),0),harvest:extra.reduce((n,p)=>n+p.prosperity*.25,0)};}
export function settleCampaign(s,funded,grainFunded,efficiency=()=>1){
 const w=s.campaignState,reports=[];if(!w)return reports;
 for(const p of s.provinces)if(p.governor&&(typeof funded==='function'?funded('pay:governor:'+p.id):funded)){const e=efficiency(p.governor);p.unrest=clamp(p.unrest-1.5*e);p.prosperity=clamp(p.prosperity+.5*e);}
 for(const b of w.battles){if(b.status!=='active')continue;const r=region(b.target),u=s.militaryState.units.find(u=>u.id===b.unit),enemy=w.enemies.find(e=>e.region===b.target);
  if(!u){b.status='retreated';continue;}if(!(typeof funded==='function'?funded('battle:'+b.id)&&funded('base:military')&&funded('base:grain')&&(!(unitMaintenance(u).money||unitMaintenance(u).grain)||funded('unit:'+u.id)):funded&&grainFunded)){b.lastReport='军饷或粮运欠拨，暂停进军，敌方据险固守。';b.enemyTactic='hold';reports.push(r.name+'：'+b.lastReport);continue;}
  const commanderPaid=u.commander&&(typeof funded==='function'?funded('pay:commander:'+u.id):funded);
  b.months++;const power=battlePower(s,u,b.tactic)*(commanderPaid?1+.15*efficiency(u.commander):1),ratio=power/Math.max(15,enemy.strength);
  enemy.tactic=ratio>1.25?'hold':b.tactic==='assault'?'encircle':'assault';b.enemyTactic=enemy.tactic;
  let delta=b.tactic==='hold'?-2:clamp(25*ratio-(enemy.tactic==='encircle'?8:3),-12,100);if(b.tactic==='encircle'&&enemy.tactic==='hold')delta+=7;
  b.progress=clamp(b.progress+delta,-40,100);enemy.strength=clamp(enemy.strength-Math.max(1,power/15),0,150);
  const protection=unitCapability(s,u).defense,loss=clamp(.012/Math.max(.2,ratio)*(b.tactic==='assault'?1.3:b.tactic==='hold'?.3:.8)/(1+protection/60),.001,.06);let lost=0;u.lossCredit||={};for(const[id,q]of Object.entries(u.equipment)){if(!q)continue;const damage=(u.lossCredit[id]||0)+q*loss,n=Math.min(q,Math.floor(damage));u.equipment[id]-=n;u.lossCredit[id]=u.equipment[id]>0?damage-n:0;lost+=n;}
  b.lastReport='我军'+TACTICS[b.tactic]+'，敌军'+TACTICS[enemy.tactic]+'；攻势 '+Math.round(b.progress)+'%，敌军战力 '+Math.round(enemy.strength)+'，本月损耗装备 '+lost+' 件。';
  if(b.progress>=100){b.status='won';w.control[r.id]='ming';enemy.status='defeated';const p=foreignProvince(r);if(!s.provinces.some(x=>x.id===p.id))s.provinces.push(p);u.region=p.id;s.atlas.discoveries[r.place]={turn:s.turn+1,source:'conquest',visited:true};s.influence+=12;s.legitimacy=clamp(s.legitimacy+2);if(r.owner==='jin')s.frontier=clamp(s.frontier-12);b.lastReport+=' 已建立实控，'+r.name+'纳入地方政务，可赈济、建设、任主官。';}
  else if(b.progress<=-30){b.status='lost';s.army=clamp(s.army-4);b.lastReport+=' 战役失利，部队退回原防区。';}
  reports.push(r.name+'：'+b.lastReport);
 }
 refreshMilitary(s);return reports;
}
export function inferCampaignCommands(s,text){
 if(/撤军|撤回.*军|停止进攻/.test(text)){const b=s.campaignState?.battles.find(b=>b.status==='active'&&(text.includes(region(b.target).name)||!s.campaignState.battles.some(x=>x!==b&&x.status==='active')));return b?[{type:'war',operation:'retreat',battle:b.id}]:[];}
 if(!/进攻|攻打|攻占|征服|出兵|夺取|占领|宣战/.test(text))return [];
 const r=REGIONS.find(r=>!r.home&&(text.includes(r.name)||text.includes(PLACES.find(p=>p.id===r.place)?.name)))||REGIONS.find(r=>!r.home&&({jin:'后金',mongol:'蒙古',joseon:'朝鲜',japan:'日本',dutch:'荷兰',portugal:'葡萄牙',spain:'西班牙',england:'英国'}[r.owner])&&text.includes(({jin:'后金',mongol:'蒙古',joseon:'朝鲜',japan:'日本',dutch:'荷兰',portugal:'葡萄牙',spain:'西班牙',england:'英国'}[r.owner])));
 if(!r)return [];const u=s.militaryState.units.find(u=>text.includes(u.name));return [{type:'war',operation:'attack',target:r.id,unit:u?.id,tactic:/包围|迂回/.test(text)?'encircle':/炮击|火力/.test(text)?'bombard':'assault'}];
}
export function validateCampaign(raw,s){
 const base=initialCampaign(),r=raw.campaignState;if(r===undefined){s.campaignState=base;return;}
 if(!r||!Number.isInteger(r.nextId)||r.nextId<1||!r.control||!Array.isArray(r.battles)||r.battles.length>80||!Array.isArray(r.enemies))throw Error('存档战场状态无效。');
 for(const key of Object.keys(r.control))if(!region(key))throw Error('存档领地无效。');
 for(const z of REGIONS){const owner=r.control[z.id];if(![z.owner,'ming'].includes(owner))throw Error('存档控制区无效。');base.control[z.id]=owner;if(!z.home&&owner==='ming')s.provinces.push(foreignProvince(z));}
 base.enemies=base.enemies.map(e=>{const v=r.enemies.find(x=>x.id===e.id);if(!v||!Number.isFinite(v.strength)||v.strength<0||v.strength>150||!['deployed','defeated'].includes(v.status)||!Object.hasOwn(TACTICS,v.tactic))throw Error('存档敌军无效。');return {...e,strength:v.strength,status:v.status,tactic:v.tactic};});
 base.battles=r.battles.map(b=>{const z=region(b.target);if(!z||z.home||typeof b.id!=='string'||!/^battle-\d+$/.test(b.id)||!['active','won','lost','retreated'].includes(b.status)||!Object.hasOwn(TACTICS,b.tactic)||!Object.hasOwn(TACTICS,b.enemyTactic)||!Number.isFinite(b.progress)||b.progress< -40||b.progress>100||!Number.isInteger(b.months)||b.months<0||!region(b.origin))throw Error('存档战役无效。');return {id:b.id,target:z.id,unit:String(b.unit),origin:b.origin,tactic:b.tactic,enemyTactic:b.enemyTactic,progress:b.progress,months:b.months,status:b.status,lastReport:String(b.lastReport||'').slice(0,500),started:Math.max(0,Math.floor(b.started||0)),...(b.transports!==undefined?{transports:validateTransports(b.transports)}:{})};});
 if(new Set(base.battles.map(b=>b.id)).size!==base.battles.length||new Set(base.battles.filter(b=>b.status==='active').map(b=>b.unit)).size!==base.battles.filter(b=>b.status==='active').length)throw Error('存档战役重复。');
 base.nextId=Math.max(r.nextId,1,...base.battles.map(b=>Number(b.id.split('-').at(-1))+1));s.campaignState=base;
}

function validateTransports(n){if(!Number.isInteger(n)||n<0||n>10000)throw Error('战役运输船数无效。');return n;}
