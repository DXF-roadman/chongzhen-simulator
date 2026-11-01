import {unitNeeds,unitMetadata} from './unit-metadata.mjs';
import {unitMaintenance} from './operational-rules.mjs';
// Equipment quantities, factories and combat values are gameplay abstractions.
export const CATEGORIES={infantry:'步兵武器',artillery:'火炮',armor:'装甲车辆',aircraft:'航空器',ships:'舰船',mecha:'机甲'};
export const EQUIPMENT=[
 {id:'matchlock',name:'制式鸟铳',category:'infantry',era:'period',attack:1,defense:1,reliability:80,rate:600,cost:4,quantum:1000,energy:1},
 {id:'musket',name:'改良燧发枪',category:'infantry',era:'improved',attack:1.6,defense:1.5,reliability:88,rate:400,cost:5,quantum:1000,energy:1},
 {id:'cannon',name:'红夷炮',category:'artillery',era:'period',attack:8,defense:6,reliability:78,rate:12,cost:5,quantum:30,energy:1},
 {id:'rifle',name:'现代制式步枪',category:'infantry',era:'future',attack:4,defense:3,reliability:95,rate:500,cost:6,quantum:1000,energy:1},
 {id:'howitzer',name:'现代榴弹炮',category:'artillery',era:'future',attack:24,defense:16,reliability:92,rate:8,cost:9,quantum:20,energy:2},
 {id:'tank',name:'主战坦克',category:'armor',era:'future',attack:80,defense:100,reliability:90,rate:3,cost:12,quantum:10,energy:5},
 {id:'fighter',name:'多用途战机',category:'aircraft',era:'future',attack:100,defense:60,reliability:88,rate:2,cost:14,quantum:10,energy:6},
 {id:'junk',name:'远洋帆船',category:'ships',era:'period',attack:5,defense:5,reliability:80,rate:1,cost:8,quantum:3,energy:2},
 {id:'destroyer',name:'现代驱逐舰',category:'ships',era:'future',attack:100,defense:80,reliability:92,rate:.4,cost:18,quantum:2,energy:10},
 {id:'gundam',name:'高达',category:'mecha',era:'future',attack:1500,defense:1500,reliability:98,rate:.1,cost:20,quantum:1,energy:20}
];
export const TEMPLATES=[{id:'field',name:'野战军',needs:{infantry:6000,artillery:120}},{id:'garrison',name:'守备军',needs:{infantry:2000,artillery:20}},{id:'armored',name:'合成装甲旅',needs:{infantry:3000,artillery:40,armor:20}},{id:'mecha',name:'机甲独立队',needs:{mecha:1}},{id:'fleet',name:'远洋舰队',needs:{ships:6}}];
const cap=(n,lo=0,hi=100)=>Math.max(lo,Math.min(hi,Number(n)||0));
const int=(n,lo,hi,label)=>{if(!Number.isInteger(n)||n<lo||n>hi)throw Error(label+'须为 '+lo+' 至 '+hi+' 的整数。');return n;};
const clean=(n,max=60)=>String(n||'').trim().slice(0,max);
const find=(rows,id,label)=>{const row=rows.find(r=>r.id===id||r.name===id);if(!row)throw Error(label+'不存在：'+clean(id));return row;};
const spend=(s,money=0)=>{if(s.ended)throw Error('本局已结束。');if(s.money<money)throw Error('国库不足，需要 '+money+' 万两。');s.money-=money;};
export function initialMilitary(){return {factoryCapacity:3,nextId:1,appliedBonus:0,designs:[],stock:{matchlock:1800,cannon:40,junk:2},lines:[],construction:[],units:[
 {id:'liaodong-army',name:'辽东军',region:'liaodong',needs:{infantry:6000,artillery:120},equipment:{matchlock:4800,cannon:80},preferred:{infantry:'matchlock',artillery:'cannon'},priority:3,training:65},
 {id:'capital-army',name:'京营',region:'capital',needs:{infantry:4000,artillery:60},equipment:{matchlock:3200,cannon:40},preferred:{infantry:'matchlock',artillery:'cannon'},priority:2,training:60},
 {id:'shaanxi-army',name:'陕西守军',region:'shaanxi',needs:{infantry:2000,artillery:20},equipment:{matchlock:1400,cannon:12},preferred:{infantry:'matchlock',artillery:'cannon'},priority:1,training:50}
 ]};}
export const equipmentCatalog=s=>[...EQUIPMENT,...(s.militaryState?.designs||[])];
export function equipmentUnlocked(s,e){return e.era==='period'||e.era==='improved'&&(s.tech>=20||s.technology?.military>=20)||e.era==='future'&&(s.traveler?.enabled||s.technology?.industry>=80&&s.technology?.military>=80);}
function energyCost(s,e,n){return Math.ceil(n/e.quantum)*e.energy*(s.traveler?.portal?1:1.5);}
function importGear(s,e,n){
 if(!s.traveler?.enabled)throw Error('跨时代调取装备需启用穿越者模式；普通军备可安排生产。');
 const cost=Math.ceil(energyCost(s,e,n));if(s.traveler.energy<cost)throw Error('时空能量不足，需要 '+cost+' 点，可等待虫洞补能或缩小调取规模。');
 s.traveler.energy-=cost;s.militaryState.stock[e.id]=(s.militaryState.stock[e.id]||0)+n;s.traveler.interventions++;
}
export function unitStatus(s,u){
 const catalog=equipmentCatalog(s),byCat={};for(const[id,n]of Object.entries(u.equipment)){const e=catalog.find(e=>e.id===id);if(e)byCat[e.category]=(byCat[e.category]||0)+n;}
 const categories=Object.keys(u.needs),readiness=categories.length?categories.reduce((n,c)=>n+Math.min(1,(byCat[c]||0)/Math.max(1,u.needs[c])),0)/categories.length:0;
 return {readiness:Math.round(readiness*100),shortages:Object.fromEntries(categories.map(c=>[c,Math.max(0,u.needs[c]-(byCat[c]||0))])),byCategory:byCat};
}
export function unitCapability(s,u){
 let attack=0,defense=0;const scales={infantry:1200,artillery:120,armor:12,aircraft:8,ships:4,mecha:8},catalog=equipmentCatalog(s);
 for(const[id,n]of Object.entries(u.equipment)){const e=catalog.find(e=>e.id===id);if(!e)continue;const effective=Math.max(0,n-(u.lossCredit?.[id]||0)),energy=e.era==='future'&&s.traveler?.enabled&&s.traveler.energy<=0?.3:1;attack+=effective*e.attack*e.reliability/100/scales[e.category]*energy;defense+=effective*e.defense*e.reliability/100/scales[e.category]*energy;}
 attack*=u.supplied??1;defense*=u.supplied??1;return {attack,defense,readiness:unitStatus(s,u).readiness/100,training:.5+u.training/200};
}
function power(s){return s.militaryState.units.reduce((n,u)=>{const c=unitCapability(s,u);return n+(c.attack*.7+c.defense*.3)*c.training;},0);}
const BASE_POWER=(()=>{const m=initialMilitary();return power({militaryState:m});})();
export function refreshMilitary(s){const m=s.militaryState,base=cap(s.army-m.appliedBonus),bonus=cap((power(s)-BASE_POWER)*.8,-20,45);s.army=cap(base+bonus);m.appliedBonus=s.army-base;}
function equip(s,u,e,quantity,source,resize=false){
 int(quantity,1,1000000,'配装数量');const m=s.militaryState,need=resize?quantity:(u.needs[e.category]??quantity);
 if(!resize&&quantity>need)throw Error('配发数量超过现有编制，请先明确调整编制；配发装备不会自动增减人数。');
 if(resize)u.needs[e.category]=quantity;else u.needs[e.category]??=quantity;
 const old=Object.entries(u.equipment).filter(([id])=>equipmentCatalog(s).find(x=>x.id===id)?.category===e.category),same=u.equipment[e.id]||0,missing=Math.max(0,quantity-same-(m.stock[e.id]||0));
 if(source==='portal'&&missing)importGear(s,e,missing);
 const added=Math.min(Math.max(0,quantity-same),m.stock[e.id]||0);let retire=Math.max(0,old.reduce((n,[,q])=>n+q,0)+added-need);
 for(const[id,n]of old.filter(([id])=>id!==e.id)){const returned=Math.min(n,retire);if(returned){u.equipment[id]-=returned;if(!u.equipment[id])delete u.equipment[id];m.stock[id]=(m.stock[id]||0)+returned;retire-=returned;}}
 if(retire){const returned=Math.min(same,retire);u.equipment[e.id]=same-returned;m.stock[e.id]=(m.stock[e.id]||0)+returned;}
 m.stock[e.id]=(m.stock[e.id]||0)-added;u.equipment[e.id]=(u.equipment[e.id]||0)+added;u.preferred[e.category]=e.id;return u.equipment[e.id]||0;
}

function reinforce(s){const m=s.militaryState;for(const u of [...m.units].sort((a,b)=>b.priority-a.priority))for(const[category,need]of Object.entries(u.needs)){
 const id=u.preferred[category],e=equipmentCatalog(s).find(e=>e.id===id);if(!e)continue;
 const same=u.equipment[id]||0,old=Object.entries(u.equipment).filter(([key])=>key!==id&&equipmentCatalog(s).find(e=>e.id===key)?.category===category),current=same+old.reduce((n,[,q])=>n+q,0),n=Math.min(Math.max(0,need-same),m.stock[id]||0);let retire=Math.max(0,n-Math.max(0,need-current));
 for(const[key,q]of old){const returned=Math.min(q,retire);if(returned){u.equipment[key]-=returned;m.stock[key]=(m.stock[key]||0)+returned;retire-=returned;}}m.stock[id]=(m.stock[id]||0)-n;if(n)u.equipment[id]=(u.equipment[id]||0)+n;
 }}
export function militaryForecast(s){const m=s.militaryState||initialMilitary(),catalog=equipmentCatalog(s);return {cost:m.lines.filter(l=>l.active).reduce((n,l)=>n+(catalog.find(e=>e.id===l.equipment)?.cost||0)*l.factories,0),energy:m.units.reduce((n,u)=>n+Object.entries(u.equipment).reduce((a,[id,q])=>a+(catalog.find(e=>e.id===id)?.category==='mecha'?q*4:catalog.find(e=>e.id===id)?.category==='ships'&&catalog.find(e=>e.id===id)?.era==='future'?q:0),0),0)};}
export function arsenalCommand(s,c){
 s.militaryState||=initialMilitary();const m=s.militaryState,operation=c.operation;
 if(operation==='disband'){
  const u=find(m.units,c.unit,'部队');if(s.campaignState.battles.some(b=>b.status==='active'&&b.unit===u.id))throw Error('此军仍在战场，先撤军再裁撤。');spend(s);for(const[id,n]of Object.entries(u.equipment))m.stock[id]=(m.stock[id]||0)+n;m.units=m.units.filter(v=>v.id!==u.id);refreshMilitary(s);return {title:'裁撤部队 · '+u.name,text:'编制已经撤销，现存装备全部退库，之后不再收取该编制维护与统帅月俸，既往费用不回改。'};
 }
 if(operation==='produce'){

  const e=find(equipmentCatalog(s),c.equipment,'装备');if(!equipmentUnlocked(s,e))throw Error('现有工业无法生产此装备，需技术积累或穿越者工业支援。');
  const factories=int(c.factories??1,0,30,'工厂数'),old=m.lines.find(l=>l.equipment===e.id),used=m.lines.filter(l=>l!==old&&l.active).reduce((n,l)=>n+l.factories,0);
  if(used+factories>m.factoryCapacity)throw Error('军工厂不足，当前共 '+m.factoryCapacity+' 座，已分配 '+used+' 座。');spend(s);
  if(old){old.factories=factories;old.active=factories>0;}else if(factories)m.lines.push({id:'line-'+m.nextId++,equipment:e.id,factories,efficiency:.35,credit:0,active:true,lastOutput:0});
  return {title:'军工生产 · '+e.name,text:'分配 '+factories+' 座军工厂；每月工厂费用 '+e.cost*factories+' 万两，初期效率 35%，逐月爬升。产出按部队优先级补缺，余量入库。'};
 }
 if(operation==='expand'){if(m.factoryCapacity+m.construction.reduce((n,p)=>n+p.count,0)>=30)throw Error('军工厂已达当前规模上限。');spend(s,36);m.construction.push({id:'factory-'+m.nextId++,count:Math.min(2,30-m.factoryCapacity-m.construction.reduce((n,p)=>n+p.count,0)),remaining:3});return {title:'扩建军工厂',text:'拨银 36 万两，三个月后增加至多两座军工厂（规模上限三十座）。'};}
 if(operation==='design'){
  if(m.designs.length>=20)throw Error('自定义型号已达二十种。');const base=find(EQUIPMENT,c.base||'gundam','基础型号'),name=clean(c.name,40);if(name.length<2||equipmentCatalog(s).some(e=>e.name===name))throw Error('型号名称无效或重复。');if(!equipmentUnlocked(s,base))throw Error('尚无该类别的设计能力。');spend(s,base.era==='future'?0:12);const e={...base,id:'design-'+m.nextId++,name};m.designs.push(e);return {title:'登记新型号 · '+name,text:'按'+base.name+'的装备类别和性能建档；登记不等于已有库存，仍需生产或调取。'};
 }
 if(operation==='import'){
  const e=find(equipmentCatalog(s),c.equipment,'装备'),n=int(c.quantity??1,1,1000000,'调取数量');spend(s);importGear(s,e,n);return {title:'时空调取 · '+e.name,text:'已将 '+n+' 件'+e.name+'调入军械库，消耗时空能量 '+Math.ceil(energyCost(s,e,n))+' 点。库存可由系统统一配发。'};
 }
 if(operation==='create_unit'){
  if(m.units.length>=256)throw Error('部队记录过多。');const t=find(TEMPLATES,c.template||'garrison','编制'),name=clean(c.name||t.name,40),region=s.provinces.find(p=>p.id===c.region||p.name===c.region)?.id||'capital';if(m.units.some(u=>u.name===name))throw Error('已有同名部队。');const needs=c.needs?unitNeeds(c.needs):structuredClone(t.needs),meta=unitMetadata(c);if(meta.funding==='portal'&&!s.traveler?.enabled)throw Error('虫洞供给费用须先明确开启穿越者能力。');spend(s,12);m.units.push({id:'unit-'+m.nextId++,name,region,needs,equipment:{},preferred:{},priority:2,training:40,commander:null,...meta});refreshMilitary(s);return {title:'组建部队 · '+name,text:'独立建立'+Object.entries(needs).map(([k,n])=>CATEGORIES[k]+' '+n).join('、')+'编制；'+(meta.secret?'密编，':'')+(meta.funding==='portal'?'启动物资由虫洞供给，不扣国库。':'启动拨银 12 万两。')+'实际装备与训练另按本军记录核验。'};
 }
 if(operation==='equip'){
  const u=find(m.units,c.unit,'部队'),e=find(equipmentCatalog(s),c.equipment,'装备');spend(s);const n=int(c.quantity??u.needs[e.category]??(e.category==='mecha'?1:20),1,1000000,'配装数量'),assigned=equip(s,u,e,n,c.source||'stock');refreshMilitary(s);return {title:'换装 · '+u.name,text:e.name+'需求 '+n+'，已配发 '+assigned+'；本军编制保留，实际替换的旧械退库，缺额 '+Math.max(0,n-assigned)+'。后续同型产出优先补齐。'};
 }
 if(operation==='template'){
  const u=find(m.units,c.unit,'部队'),t=c.needs?{name:'自定义装备需求',needs:unitNeeds(c.needs)}:find(TEMPLATES,c.template,'编制');spend(s);for(const[id,n]of Object.entries(u.equipment))if(!t.needs[find(equipmentCatalog(s),id,'装备').category]){m.stock[id]=(m.stock[id]||0)+n;delete u.equipment[id];}u.needs=structuredClone(t.needs);for(const[category,need]of Object.entries(u.needs)){let left=need;for(const[id,n]of Object.entries(u.equipment).filter(([id])=>find(equipmentCatalog(s),id,'装备').category===category)){const kept=Math.min(n,left);left-=kept;m.stock[id]=(m.stock[id]||0)+n-kept;u.equipment[id]=kept;}}for(const k of Object.keys(u.preferred))if(!u.needs[k])delete u.preferred[k];refreshMilitary(s);return {title:'调整编制 · '+u.name,text:'改为'+t.name+'：'+Object.entries(u.needs).map(([k,n])=>CATEGORIES[k]+' '+n).join('、')+'；不再需要的装备已退库，缺额由后续配发补齐。'};
 }
 if(operation==='modernize'){
  const profile=['balanced','firepower','mechanized','mecha'].includes(c.profile)?c.profile:'balanced';const units=c.unit?[find(m.units,c.unit,'部队')]:c.scope==='frontier'?[...m.units].sort((a,b)=>b.priority-a.priority).slice(0,1):[...m.units].sort((a,b)=>b.priority-a.priority);
  spend(s);const reports=[],future=!!s.traveler?.enabled&&c.source!=='period';
  for(const u of units){const categories=profile==='mecha'?['mecha']:profile==='mechanized'?['infantry','artillery','armor']:Object.keys(u.needs);
   for(const category of categories){const id=c.source==='period'&&u.preferred[category]?u.preferred[category]:category==='mecha'?'gundam':category==='armor'?'tank':category==='infantry'?(future?'rifle':equipmentUnlocked(s,EQUIPMENT[1])?'musket':'matchlock'):category==='artillery'?(future?'howitzer':'cannon'):category==='ships'?(future?'destroyer':'junk'):category==='aircraft'?'fighter':u.preferred[category];if(!id)continue;const e=find(equipmentCatalog(s),id,'装备'),quantity=category==='mecha'?1:category==='armor'?20:category==='artillery'&&profile==='firepower'?Math.ceil((u.needs[category]||60)*1.5):u.needs[category]||10;
    let source=future&&c.source!=='stock'?'portal':'stock';const missing=Math.max(0,quantity-(m.stock[e.id]||0)-(u.equipment[e.id]||0));if(source==='portal'&&energyCost(s,e,missing)>s.traveler.energy)source='stock';
    let assigned;if(source==='stock'&&(m.stock[e.id]||0)+(u.equipment[e.id]||0)<quantity){u.needs[category]=quantity;u.preferred[category]=e.id;reinforce(s);assigned=u.equipment[e.id]||0;}else assigned=equip(s,u,e,quantity,source,true);reports.push(u.name+'：'+e.name+' '+assigned+'/'+quantity);
   }
  }
  // Allocate spare workshops automatically; the player gives priorities, not individual rifles.
  let free=m.factoryCapacity-m.lines.filter(l=>l.active).reduce((n,l)=>n+l.factories,0);
  while(free>0){
   const candidates=units.flatMap(u=>Object.entries(u.needs).map(([category,need])=>{const id=u.preferred[category],e=equipmentCatalog(s).find(e=>e.id===id),gap=need-(u.equipment[id]||0);return {id,e,gap,priority:u.priority};})).filter(x=>x.gap>0&&x.e&&equipmentUnlocked(s,x.e));
   candidates.sort((a,b)=>b.priority-a.priority||b.gap/(b.e.rate*((m.lines.find(l=>l.equipment===b.id)?.factories||0)+1))-a.gap/(a.e.rate*((m.lines.find(l=>l.equipment===a.id)?.factories||0)+1)));
   const chosen=candidates[0];if(!chosen)break;let line=m.lines.find(l=>l.equipment===chosen.id);if(!line){line={id:'line-'+m.nextId++,equipment:chosen.id,factories:0,efficiency:.35,credit:0,active:true,lastOutput:0};m.lines.push(line);}line.factories++;line.active=true;free--;
  }
  refreshMilitary(s);return {title:'统筹整备 · '+(c.scope==='frontier'?'前线优先':'全军'),text:reports.join('；')+'。不足部分已列缺额并尽可分配空闲工厂补充；不会虚报满编。'};
 }
 throw Error('未知军备操作。');
}
export function settleMilitary(s,funded){
 const m=s.militaryState,reports=[],catalog=equipmentCatalog(s);for(const u of m.units){const cost=unitMaintenance(u);if(cost.money||cost.grain)u.supplied=(typeof funded==='function'?funded('unit:'+u.id):funded)?1:0;else if(u.supplied!==undefined)u.supplied=1;}
 for(const u of m.units)if(u.supplied!==0&&(typeof funded==='function'?(u.funding==='portal'?funded('unit:'+u.id):funded('base:military')&&funded('base:grain')):funded))u.training=cap(u.training+.5);
 for(const p of m.construction)if(typeof funded==='function'?funded('base:administration'):funded){p.remaining--;if(!p.remaining){m.factoryCapacity+=p.count;reports.push('军工扩建完成，新增 '+p.count+' 座工厂。');}}m.construction=m.construction.filter(p=>p.remaining>0);
 for(const l of m.lines){l.lastOutput=0;if(!l.active)continue;const e=catalog.find(e=>e.id===l.equipment);if(!(typeof funded==='function'?funded('production:'+l.id):funded)){reports.push(e.name+'生产线欠拨，本月停工。');continue;}l.credit+=e.rate*l.factories*l.efficiency;const n=Math.floor(l.credit);l.credit-=n;l.lastOutput=n;m.stock[e.id]=(m.stock[e.id]||0)+n;l.efficiency=Math.min(1,l.efficiency+.08);if(n)reports.push(e.name+'入库 '+n+' 件。');}
 reinforce(s);refreshMilitary(s);return reports;
}
export function validateMilitary(raw,s){
 if(raw.militaryState===undefined){s.militaryState=initialMilitary();return;}
 const r=raw.militaryState,m=initialMilitary();int(r.factoryCapacity,1,30,'军工厂');int(r.nextId,1,10000000,'军备编号');if(!Number.isFinite(r.appliedBonus)||r.appliedBonus< -20||r.appliedBonus>45)throw Error('存档装备战力无效。');
 if(!Array.isArray(r.designs)||r.designs.length>20)throw Error('存档装备型号无效。');m.designs=r.designs.map(d=>{const base=EQUIPMENT.find(e=>e.category===d.category&&e.era===d.era);if(!base||!/^design-\d+$/.test(d.id)||typeof d.name!=='string'||d.name.length<2||d.name.length>40)throw Error('存档装备设计无效。');return {...base,id:d.id,name:d.name};});
 const catalog=[...EQUIPMENT,...m.designs],validId=id=>catalog.some(e=>e.id===id);if(new Set(catalog.map(e=>e.id)).size!==catalog.length)throw Error('存档装备型号重复。');
 const cleanCounts=o=>{if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).some(id=>!validId(id)))throw Error('存档装备库存无效。');return Object.fromEntries(Object.entries(o).map(([id,n])=>[id,int(n,0,10000000,'库存') ]));};
 m.stock=cleanCounts(r.stock);if(!Array.isArray(r.units)||r.units.length>256||new Set(r.units.map(u=>u.id)).size!==r.units.length)throw Error('存档部队无效。');
 m.units=r.units.map(u=>{if(typeof u.id!=='string'||!/^[\w-]{1,60}$/.test(u.id)||typeof u.name!=='string'||u.name.length>40||!s.provinces.some(p=>p.id===u.region)||!u.needs||Object.keys(u.needs).some(k=>!(k in CATEGORIES)))throw Error('存档编制无效。');const needs=Object.fromEntries(Object.entries(u.needs).map(([k,n])=>[k,int(n,1,1000000,'编制需求')]));const preferred={};for(const[k,id]of Object.entries(u.preferred||{})){if(!needs[k]||catalog.find(e=>e.id===id)?.category!==k)throw Error('存档配装偏好无效。');preferred[k]=id;}return {id:u.id,name:u.name,region:u.region,needs,equipment:cleanCounts(u.equipment),preferred,priority:int(u.priority,1,3,'补充优先级'),training:cap(u.training),...unitMetadata(u),...(u.lossCredit?{lossCredit:validateLossCredit(u.lossCredit,validId)}:{}),...(u.supplied!==undefined?{supplied:validateSupply(u.supplied)}:{})};});
 if(!Array.isArray(r.lines)||r.lines.length>30)throw Error('存档生产线无效。');m.lines=r.lines.map(l=>{if(!validId(l.equipment)||!Number.isFinite(l.efficiency)||l.efficiency<.35||l.efficiency>1||!Number.isFinite(l.credit)||l.credit<0||l.credit>=1)throw Error('存档生产进度无效。');return {id:clean(l.id),equipment:l.equipment,factories:int(l.factories,0,30,'工厂分配'),efficiency:l.efficiency,credit:l.credit,active:l.active===true,lastOutput:Math.max(0,Math.floor(Number(l.lastOutput)||0))};});if(new Set(m.lines.map(l=>l.equipment)).size!==m.lines.length||m.lines.filter(l=>l.active).reduce((n,l)=>n+l.factories,0)>r.factoryCapacity)throw Error('存档工厂重复或超额分配。');
 if(!Array.isArray(r.construction)||r.construction.length>15)throw Error('存档工厂建设无效。');m.construction=r.construction.map(p=>({id:clean(p.id),count:int(p.count,1,2,'建设数量'),remaining:int(p.remaining,1,3,'建设工期')}));
 if(r.factoryCapacity+m.construction.reduce((n,p)=>n+p.count,0)>30)throw Error('存档军工建设超出上限。');const maxId=Math.max(0,...[...m.designs,...m.units,...m.lines,...m.construction].map(x=>Number(x.id.split('-').at(-1))||0));Object.assign(m,{factoryCapacity:r.factoryCapacity,nextId:Math.max(r.nextId,maxId+1),appliedBonus:r.appliedBonus});s.militaryState=m;
}

function validateLossCredit(v,validId){if(!v||Object.entries(v).some(([id,n])=>!validId(id)||!Number.isFinite(n)||n<0||n>=1))throw Error('装备累计损伤无效。');return {...v};}

function validateSupply(v){if(!Number.isFinite(v)||v<0||v>1)throw Error('部队实供状态无效。');return v;}
