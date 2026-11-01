import {decisionFields} from './petition-budget.mjs';
import {storedEvent} from './saved-payloads.mjs';
import {validateEconomicPlan} from './economic-effects.mjs';
import {normalizeMonthly,monthlyCost,applyMonthly,retainMonthly,monthlyScale} from './monthly-rules.mjs';
import {fiscalRules,rolePay,compensationSupport} from './fiscal-rules.mjs';
import {canServe,talentEfficiency} from './talents.mjs';
import {institutionOwner,institutionSnapshot,institutionDelta} from './institution-records.mjs';
import {advanceWork,readWorkCredit} from './operational-rules.mjs';
const domains=['agriculture','industry','finance','military','naval','governance','education','medicine'];
export const CORE_OFFICES=[{id:'cabinet',name:'内阁',domain:'governance',mandate:'票拟与六部协调。'},{id:'personnel',name:'吏部',domain:'governance',mandate:'铨选考核，整饬吏治。'},{id:'revenue',name:'户部',domain:'finance',mandate:'钱粮征解与财政核验。'},{id:'rites',name:'礼部',domain:'education',mandate:'礼制、学校与人才培养。'},{id:'war',name:'兵部',domain:'military',mandate:'军政、训练与边防文移。'},{id:'justice',name:'刑部',domain:'governance',mandate:'刑名复核与司法吏治。'},{id:'works',name:'工部',domain:'industry',mandate:'工程营造与工匠组织。'},{id:'guards',name:'锦衣卫',domain:'governance',mandate:'宫廷宿卫、侦缉与治安线索呈报；情报以已知局势和实际案卷为据。'}];
export const coreOffices=s=>CORE_OFFICES.filter(o=>o.id!=='cabinet'||s.government?.cabinet!==false).map(o=>({...o,leader:s.government?.officeLeaders?.[o.id]||null,monthlyFee:rolePay(s,'office',s.government?.officeLeaders?.[o.id],o.id)}));
export function currentPosts(s,id){
 const titles={cabinet:'内阁首辅',personnel:'吏部尚书',revenue:'户部尚书',rites:'礼部尚书',war:'兵部尚书',justice:'刑部尚书',works:'工部尚书',guards:'锦衣卫指挥使'};
 return [...coreOffices(s).filter(o=>o.leader===id).map(o=>titles[o.id]),...(s.agencies||[]).filter(a=>a.leader===id).map(a=>a.name+'主官'),...(s.provinces||[]).filter(p=>p.governor===id).map(p=>p.name+'地方主官'),...(s.militaryState?.units||[]).filter(u=>u.commander===id).map(u=>u.name+'统帅'),...((s.officials||[]).includes(id)?['中枢专任']:[]),...(s.projects||[]).filter(p=>p.leader===id).map(p=>p.name+'督办'),...(s.affairs||[]).filter(a=>a.leader===id).map(a=>a.name+'善后督办'),...(s.event?.leader===id?[s.event.title+'承办']:[]),...(s.service?.tasks||[]).filter(t=>t.person===id&&t.kind==='voyage'&&t.status==='active').map(t=>t.entityName+'差使')];
}
export const postLabel=posts=>posts.length?posts.slice(0,2).join('、')+(posts.length>2?'等 '+posts.length+' 项差遣':''):'未委任朝职';
// Aptitudes and workload are gameplay abstractions, not historical measurements.
const profiles={sun:{military:95,governance:80},yuan:{military:95,naval:70},xu:{agriculture:95,education:95,medicine:80,industry:80},bi:{finance:95,governance:90},lu:{military:90,governance:80,agriculture:75},song:{industry:95,agriculture:90,naval:85,education:85,military:80}};
export function aptitude(s,id,domain){
 const civil=s.service?.people.find(p=>p.id===id);if(civil)return civil.skills[domain]||42;
 const t=(s.talents||[]).find(t=>t.id===id);
 if(t)return ['military','naval'].includes(domain)?t.command:['industry','education'].includes(domain)?t.craft:t.governance;
 return profiles[id]?.[domain]||60;
}
export function workload(s,id){
 return (s.officials||[]).filter(x=>x===id).length+coreOffices(s).filter(o=>o.leader===id).length+(s.agencies||[]).filter(a=>a.leader===id).length+(s.projects||[]).filter(p=>p.leader===id).length+(s.affairs||[]).filter(a=>a.leader===id).length+(s.provinces||[]).filter(p=>p.governor===id).length+(s.militaryState?.units||[]).filter(u=>u.commander===id).length+(s.event?.leader===id?1:0)+(s.service?.tasks||[]).filter(t=>t.person===id&&t.kind==='voyage'&&t.status==='active').length;
}
export const workloadFactor=(s,id)=>1/(1+Math.max(0,workload(s,id)-2)*.35);
export const leaderEfficiency=(s,id,domain)=>canServe(s,id)?talentEfficiency(s,id)*(.55+aptitude(s,id,domain)/200)*workloadFactor(s,id)*compensationSupport(s,id):0;
export const officeEfficiency=(s,o)=>s.service?.people.some(p=>p.id===o.leader&&p.origin==='incumbent'&&p.institution==='office:'+o.id)?0:leaderEfficiency(s,o.leader,o.domain);
export function checkLeader(s,id){if(id!==null&&id!==undefined&&id!==''&&!canServe(s,id))throw Error('负责人尚未归附或不可任用。');return id||null;}
export const dutyExpenses=s=>[...(s.projects||[]),...(s.affairs||[])].filter(p=>p.leader&&p.funding!=='portal').length*fiscalRules(s).dutyFee;
export const portalDutyExpenses=s=>[...(s.projects||[]),...(s.affairs||[])].filter(p=>p.leader&&p.funding==='portal').length*fiscalRules(s).dutyFee;
export function affairDomain(event){
 if(domains.includes(event.domain))return event.domain;
 return ({drought:'agriculture',flood:'agriculture',pay:'military',border:'military',jisi:'military',gentry:'finance',craft:'industry',trade:'naval',institutions:'governance'}[event.id])||'governance';
}
export function addAffair(s,{name,domain='governance',target=null,leader=null,order='',funding='treasury'}){
 s.affairs||=[];
 let serial=s.revision;while(s.affairs.some(a=>a.id==='affair-'+s.turn+'-'+serial))serial++;
 s.affairs.push({id:'affair-'+s.turn+'-'+serial,name:String(name).slice(0,100),domain:domains.includes(domain)?domain:'governance',target,leader:checkLeader(s,leader),order:String(order).slice(0,300),total:2,remaining:2,...(funding==='portal'?{funding}:{})});
}
export function settleAffairs(s,paid,portalPaid=false){
 const reports=[];
 for(const a of s.affairs||[]){
  if(a.petition)continue;const before=institutionSnapshot(s);
  if(!(typeof paid==='function'?paid('affair:'+a.id):!a.leader||(a.funding==='portal'?portalPaid:paid))){reports.push({title:'督办停滞 · '+a.name,text:'督办经费欠拨，本月暂缓验收。'});continue;}
  const scale=monthlyScale(a.monthly);applyMonthly(s,a,true);a.remaining-=advanceWork(a,scale);if(a.remaining>0)continue;retainMonthly(s,a);
  const k=(a.leader?leaderEfficiency(s,a.leader,a.domain):0)*(a.scopeScale??1);
  if(a.trade){const c=s.countries.find(c=>c.id===a.trade.country);s.money+=a.trade.payout;s.tech=Math.min(100,s.tech+2);s.navy=Math.min(100,s.navy+2);s.influence+=2;if(c)c.relation=Math.min(100,c.relation+4);}
  const effects={agriculture:{stability:1.5*k},industry:{tech:1.5*k},finance:{corruption:-1.5*k},military:{army:1.5*k},naval:{navy:1.5*k},governance:{corruption:-1.5*k},education:{tech:1.5*k},medicine:{stability:1.5*k}}[a.domain];
  for(const[key,v]of Object.entries(effects))s[key]=Math.max(0,Math.min(100,s[key]+v));
  const p=s.provinces.find(p=>p.id===a.target);if(p&&k)p.unrest=Math.max(0,p.unrest-2*k);
  reports.push({title:'销案 · '+a.name,text:a.trade?'商队实际回航，解银 '+a.trade.payout+' 万两已计入国库，本轮交流成果一次结算。':a.leader?'受命督办完成后续核验，按职责适配、忠诚与兼任负担追加落实成效。':'六部按原批复完成后续备案，无专人督办加成。',leader:a.leader,institution:a.institution,...(a.economic?{economic:a.economic}:{}),...institutionDelta(before,s)});
 }
 s.affairs=(s.affairs||[]).filter(a=>a.remaining>0);return reports;
}
export function validateDuties(raw,s){
 if(raw.affairs!==undefined&&!Array.isArray(raw.affairs))throw Error('存档事务列表无效。');
 const affairs=raw.affairs||[];
 if(affairs.length>256||new Set(affairs.map(a=>a.id)).size!==affairs.length)throw Error('存档事务过多或编号重复。');
 s.affairs=affairs.map(a=>{
  if(a.funding!==undefined&&!['portal','treasury'].includes(a.funding))throw Error('存档事务费用来源无效。');
  if(typeof a.id!=='string'||!/^affair-\d+-\d+$/.test(a.id)||typeof a.name!=='string'||!domains.includes(a.domain)||a.total!==2||!Number.isInteger(a.remaining)||a.remaining<1||a.remaining>2)throw Error('存档事务进度无效。');
  return {id:a.id,name:a.name.slice(0,100),domain:a.domain,target:s.provinces.some(p=>p.id===a.target)?a.target:null,leader:checkLeader(s,a.leader),order:String(a.order||'').slice(0,300),...(a.monthly?{monthly:normalizeMonthly(a.monthly,'',{saved:true})}:{}),...(a.economic?{economic:validateEconomicPlan(a.economic,s)}:{}),total:2,remaining:a.remaining,...readWorkCredit(a),...decisionFields(a),...(a.petition?{petition:{...storedEvent(a.petition),leader:checkLeader(s,a.petition.leader)}}:{}),...(a.trade?{trade:validateTrade(a.trade,s)}:{}),...(a.institution?{institution:institutionOwner(a.institution)}:{}),...(a.funding==='portal'?{funding:'portal'}:{})};
 });
 for(let i=0;i<s.projects.length;i++){
  const p=s.projects[i],r=raw.projects[i];p.leader=checkLeader(s,r.leader);if(r.institution)p.institution=institutionOwner(r.institution);
  if(r.funding!==undefined&&!['portal','treasury'].includes(r.funding))throw Error('存档工程费用来源无效。');if(r.funding==='portal')p.funding='portal';
  if(r.workCredit!==undefined&&(!Number.isFinite(r.workCredit)||r.workCredit<0||r.workCredit>=1))throw Error('存档工程督办进度无效。');
  Object.assign(p,decisionFields(r));p.workCredit=r.workCredit||0;if(r.monthly)p.monthly=normalizeMonthly(r.monthly,'',{saved:true});if(r.economic)p.economic=validateEconomicPlan(r.economic,s);
 }
 if(s.event)s.event.leader=checkLeader(s,raw.event?.leader);
}

function validateTrade(t,s){if(!s.countries.some(c=>c.id===t.country)||!Number.isFinite(t.payout)||t.payout<0||t.payout>100||!Number.isInteger(t.started)||t.started<0)throw Error('商队回款记录无效。');return {country:t.country,payout:t.payout,started:t.started};}
