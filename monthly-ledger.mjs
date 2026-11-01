import {fiscalRules,payroll} from './fiscal-rules.mjs';
import {administrationNeed,militaryNeed,agencyAllocation,unitMaintenance,ratio} from './operational-rules.mjs';
import {monthlyCost} from './monthly-rules.mjs';
const round=n=>Math.round(n*10000)/10000;
export function monthlyEntries(s,{people,catalog,grainBase}){
 const r=fiscalRules(s),rows=[];const add=(id,name,group,money=0,grain=0,funding='treasury',priority=5)=>rows.push({id,name,group,money:round(money),grain:round(grain),funding,priority});
 add('base:administration','朝廷常设经费','base',Math.min(r.administrationBase,administrationNeed(s)),0,'treasury',0);rows.at(-1).requiredMoney=administrationNeed(s);add('base:military','基础军费','base',Math.min(r.militaryBase,militaryNeed(s))*s.military,0,'treasury',1);rows.at(-1).requiredMoney=militaryNeed(s)*s.military;add('base:grain','军民基础官粮','base',0,grainBase,'treasury',0);
 for(const o of people)for(const p of payroll(s,o.id)){add('pay:'+p.kind+':'+(p.kind==='central'?o.id:p.key),o.name+' · '+({central:'中枢',office:'部务',agency:'署务',governor:'地方',commander:'统帅'}[p.kind])+'月俸','salary',p.amount,0,p.kind==='commander'?s.militaryState.units.find(u=>u.id===p.key)?.funding||'treasury':'treasury',2);Object.assign(rows.at(-1),{person:o.id,requiredMoney:p.standard});}
 for(const a of s.agencies)add('agency:'+a.id,a.name+'业务预算','agency',agencyAllocation(a),0,'treasury',3);
 for(const kind of ['project','affair'])for(const a of s[kind==='project'?'projects':'affairs']){if(a.petition)continue;const cost=monthlyCost(a,a.leader&&!a.expensesIncluded?r.dutyFee:0);add(kind+':'+a.id,a.name+' · '+(a.monthly?'月拨':'督办差旅'),kind,cost.money,cost.grain,a.funding||'treasury',4);rows.at(-1).paused=!!a.monthly?.paused||a.monthly?.remaining===0;}
 for(const a of s.monthlyPolicies||[]){const c=monthlyCost(a);add('policy:'+a.id,a.name+' · 持续月拨','policy',c.money,c.grain,a.funding||'treasury',4);rows.at(-1).paused=!!a.monthly.paused||a.monthly.remaining===0;}
 for(const v of s.atlas.voyages.filter(v=>v.status==='sailing')){const c=monthlyCost(v,2,1);add('voyage:'+v.id,v.name+'船队补给','voyage',c.money,c.grain,'treasury',4);rows.at(-1).paused=!!v.monthly?.paused||v.monthly?.remaining===0;}
 for(const l of s.militaryState.lines.filter(l=>l.active))add('production:'+l.id,(catalog.find(e=>e.id===l.equipment)?.name||l.equipment)+'生产线','production',(catalog.find(e=>e.id===l.equipment)?.cost||0)*l.factories,0,'treasury',5);
 for(const u of s.militaryState.units){const cost=unitMaintenance(u);if(cost.money||cost.grain)add('unit:'+u.id,u.name+'新增编制与弹药油料维护','maintenance',cost.money,cost.grain,u.funding||'treasury',2);}
 for(const b of s.campaignState.battles.filter(b=>b.status==='active'))add('battle:'+b.id,'战役 '+b.target,'battle',8,4,'treasury',2);
 for(const p of s.provinces.filter(p=>p.foreign))add('occupation:'+p.id,p.name+'驻治费用','occupation',3,0,'treasury',3);
 for(const t of s.talents.filter(t=>['probation','available'].includes(t.status)))add('talent:'+t.id,t.name+'部众安置','talent',t.upkeep,Math.ceil(t.troops*.6),'treasury',2);
 return rows.sort((a,b)=>a.priority-b.priority);
}
export function allocateMonth(entries,money,grain){
 let cash=round(money),food=round(grain);const rows=entries.map(r=>{if(r.funding==='portal'||r.paused)return {...r,paid:false,actualMoney:0,actualGrain:0};const enough=cash+1e-8>=r.money&&food+1e-8>=r.grain,mandatory=r.group==='base',actualMoney=enough?r.money:mandatory?Math.min(cash,r.money):0,actualGrain=enough?r.grain:mandatory?Math.min(food,r.grain):0;cash=round(cash-actualMoney);food=round(food-actualGrain);return {...r,paid:enough,actualMoney,actualGrain};});
 return {entries:rows,money:cash,grain:food,expenses:round(rows.reduce((n,r)=>n+r.actualMoney,0)),grainUse:round(rows.reduce((n,r)=>n+r.actualGrain,0))};
}
export const fundingLevel=(book,id)=>{const e=book.entries.find(e=>e.id===id);if(!e||e.paused)return 0;return Math.min(ratio(e.actualMoney,e.requiredMoney??e.money),ratio(e.actualGrain,e.requiredGrain??e.grain));};
export const isPaid=(book,id)=>id.startsWith('base:')?fundingLevel(book,id)>=.9999:book.entries.find(e=>e.id===id)?.paid===true;
export function validateBill(raw,s){
 const v=raw.ledger;if(!s.ledger||!v)return;
 if(v.monthlyWork!==undefined){if(!Array.isArray(v.monthlyWork)||v.monthlyWork.length>1024)throw Error('月拨工作量清单无效。');s.ledger.monthlyWork=v.monthlyWork.map(r=>{if(typeof r.id!=='string'||typeof r.name!=='string'||!['project','affair','policy','voyage'].includes(r.kind)||['requiredMoney','requiredGrain','authorizedMoney','authorizedGrain','ratio'].some(k=>!Number.isFinite(r[k])||r[k]<0||r[k]>(k==='ratio'?1:1000)))throw Error('月拨工作量字段无效。');return {...r};});}
for(const k of ['monthlyPolicyExpenses','plannedExpenses','plannedGrainUse','openingMoney','openingGrain','endingMoney','endingGrain','frontierActual','fundingRevenue','fundingHarvest','baseAdministrationNeed','baseMilitaryNeed','administrationCoverage','militaryCoverage'])if(v[k]!==undefined){if(!Number.isFinite(v[k])||Math.abs(v[k])>1e9)throw Error('月结清单金额无效。');s.ledger[k]=v[k];}
 if(v.entries!==undefined){if(!Array.isArray(v.entries)||v.entries.length>2048||new Set(v.entries.map(e=>e.id)).size!==v.entries.length)throw Error('月结拨款清单无效。');s.ledger.entries=v.entries.map(e=>{if(typeof e.id!=='string'||!['treasury','portal'].includes(e.funding)||['money','grain','actualMoney','actualGrain'].some(k=>!Number.isFinite(e[k])||e[k]<0||e[k]>1e7))throw Error('月结项目金额无效。');return {...e,id:e.id.slice(0,150),name:String(e.name).slice(0,150)};});}
 if(v.adjustments){if(['money','grain'].some(k=>!Number.isFinite(v.adjustments[k])||Math.abs(v.adjustments[k])>1e9))throw Error('月结变动记录无效。');s.ledger.adjustments={...v.adjustments};}
 if(v.border){if(!Array.isArray(v.border.items)||v.border.items.length>100||!Number.isFinite(v.border.net))throw Error('边防月报无效。');s.ledger.border={...v.border,items:v.border.items.map(i=>{if(!Number.isFinite(i.value)||Math.abs(i.value)>1000)throw Error('边防因素无效。');return {name:String(i.name).slice(0,150),value:i.value};})};}
}
