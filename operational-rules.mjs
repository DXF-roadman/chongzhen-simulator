// Resource requirements are separate from the amount the player authorizes.
export const STORAGE_LIMIT=256;
export const round=n=>Math.round(n*10000)/10000;
export const ratio=(actual,needed)=>needed>0?Math.max(0,Math.min(1,actual/needed)):1;
export const agencyAllocation=a=>Math.min(12,a.budget);
export function administrationNeed(s){const workload=25+Math.max(0,s.provinces.length-12)*.4+Math.max(0,s.officials.length-3)*.5,efficiency=Math.max(.6,1-(s.technology?.governance||0)/250-(s.technology?.industry||0)/1000);return round(workload*efficiency*(1+(s.government?.burden||0)/500));}
const original={ 'liaodong-army':{infantry:6000,artillery:120},'capital-army':{infantry:4000,artillery:60},'shaanxi-army':{infantry:2000,artillery:20}};
export function militaryNeed(s){let covered=0;for(const u of s.militaryState.units){const b=original[u.id];if(b)covered+=Math.min(b.infantry,u.needs.infantry||0)*.001+Math.min(b.artillery,u.needs.artillery||0)*.02;}return round(3+covered/16*21);}
export function unitMaintenance(u){
 const base=original[u.id]||{},money={infantry:.001,artillery:.02,armor:.12,aircraft:.2,ships:.8,mecha:2},grain={infantry:.0006,artillery:.003,armor:.003,aircraft:.003,ships:.03,mecha:.001};let cash=0,food=0;
 for(const [kind,n]of Object.entries(u.needs)){const extra=Math.max(0,n-(base[kind]||0));cash+=extra*(money[kind]||0);food+=extra*(grain[kind]||0);}
 return {money:round(cash),grain:round(food)};
}
export function alreadyEngaged(s,id){return !!(s.fiscal?.hired?.includes(id)||s.officials.includes(id)||Object.values(s.government?.officeLeaders||{}).includes(id)||s.agencies.some(a=>a.leader===id)||s.provinces.some(p=>p.governor===id)||s.militaryState.units.some(u=>u.commander===id)||[...s.projects,...s.affairs].some(p=>p.leader===id));}
export const mobilizationCost=(s,o)=>alreadyEngaged(s,o.id)||s.history.some(h=>h.title==='起用 · '+o.name||/人事|主官|委任统帅|地方主官|调整班底/.test(h.title)&&h.text.includes(o.name))?0:o.cost||0;
export function rememberHire(s,id){if(!id)return;s.fiscal.hired||=[];if(!s.fiscal.hired.includes(id))s.fiscal.hired.push(id);}
export function advanceWork(entity,amount=1){
 if(amount===1&&!entity.workCredit)return 1;
 entity.workCredit=(entity.workCredit||0)+amount;const steps=Math.floor(entity.workCredit+1e-9);entity.workCredit=Math.max(0,entity.workCredit-steps);return steps;
}
export function readWorkCredit(raw){if(raw.workCredit===undefined)return {};if(!Number.isFinite(raw.workCredit)||raw.workCredit<0||raw.workCredit>=1)throw Error('工作进度余量无效。');return {workCredit:raw.workCredit};}
export function fleetAvailability(s,catalog){const ships=Object.entries(s.militaryState.stock).reduce((n,[id,q])=>n+(catalog.find(e=>e.id===id)?.category==='ships'?q:0),0)+s.militaryState.units.filter(u=>u.supplied!==0).reduce((n,u)=>n+Object.entries(u.equipment).reduce((v,[id,q])=>v+(catalog.find(e=>e.id===id)?.category==='ships'?q:0),0),0);return ships-s.atlas.voyages.filter(v=>v.status==='sailing').length*2-s.campaignState.battles.filter(b=>b.status==='active').reduce((n,b)=>n+(b.transports||0),0);}
