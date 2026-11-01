// Institutional capabilities are game rules; names and mandates are player-defined.
import {civilOfficials} from './civil-service.mjs';
import {agencyAllocation,mobilizationCost,rememberHire} from './operational-rules.mjs';
import {rolePay} from './fiscal-rules.mjs';
import {canServe,NATIVE_OFFICIALS,recruitedOfficials} from './talents.mjs';
import {CORE_OFFICES,coreOffices,leaderEfficiency,officeEfficiency} from './assignments.mjs';
import {recordInstitution,institutionSnapshot,institutionDelta} from './institution-records.mjs';
const cap=(v,lo=0,hi=100)=>Math.max(lo,Math.min(hi,Number(v)||0));
const copy=x=>structuredClone(x);
const officialFor=(s,value)=>[...NATIVE_OFFICIALS,...recruitedOfficials(s),...civilOfficials(s)].find(o=>o.id===value||o.name===value);
export const POWERS=[{id:'research',name:'研究与咨询'},{id:'execution',name:'执行政务'},{id:'oversight',name:'监察审计'},{id:'coordination',name:'统筹中枢'}];
const domains=['agriculture','industry','finance','military','naval','governance','education','medicine'];
export const initialGovernment=()=>({cabinet:true,transition:0,burden:0,nextAgencyId:1,officeLeaders:{}});
export function administration(s,paid=null){
 const g=s.government||initialGovernment();
 const coordinator=(s.agencies||[]).find(a=>a.status==='active'&&a.budget>=6&&a.leader&&(paid?paid('agency:'+a.id)&&paid('pay:agency:'+a.id):a.funded!==false)&&a.powers.includes('coordination'));
 const coordinated=g.cabinet||!!coordinator;
 return {cabinet:g.cabinet,name:g.cabinet?'内阁票拟':coordinator?coordinator.name+'统筹':'六部直奏',
  deliberation:g.cabinet?'内阁与六部':coordinator?coordinator.name+'与六部':'六部与受命官员',
  coordinator:coordinator?.id||null,capacity:null,unlimitedActions:true,coordinated,burden:g.burden,transition:g.transition,
  revenueMultiplier:(coordinated?1:.92)*(g.transition>0?.96:1)};
}
export function agencyStrength(s,a,{paid=null,administration=1}={}){
 const eligible=b=>b.status==='active'&&b.budget>0&&(paid?paid('agency:'+b.id)&&(!b.leader||paid('pay:agency:'+b.id)):b.funded!==false);
 if(!eligible(a))return 0;const overlap=s.agencies.filter(b=>b!==a&&eligible(b)&&sameRemit(a,b)).length;
 return agencyAllocation(a)/8*(a.leader?leaderEfficiency(s,a.leader,a.domain):.4)/(1+overlap*.5)*administration;
}
function sameRemit(a,b){if(a.domain!==b.domain||!a.powers.some(p=>b.powers.includes(p)))return false;
 const tags=x=>{const t=x.name+' '+x.mandate;return [/清丈|田亩|宗禄|宗藩|土地/.test(t)?'land':'',/海关|商务|通商|贸易|市舶/.test(t)?'trade':'',/审计|查账|核账|稽核/.test(t)?'audit':''].filter(Boolean);};
 const x=tags(a),y=tags(b);return x.length&&y.length?x.some(t=>y.includes(t)):a.mandate===b.mandate||a.domain==='military'&&a.powers.includes('research')&&b.powers.includes('research');
}
export function agencyEconomy(s,paid=null,level=()=>1){
 let revenueBonus=0,harvestBonus=0;
 for(const a of s.agencies||[]){const k=agencyStrength(s,a,{paid,administration:level('base:administration')}),execute=a.powers.includes('execution')||a.powers.includes('coordination');if(execute&&a.domain==='finance')revenueBonus+=k*.04;if(execute&&a.domain==='industry')revenueBonus+=k*.02;if(execute&&a.domain==='agriculture')harvestBonus+=k*6;}
 const heads=coreOffices(s).filter(o=>o.leader);revenueBonus+=heads.filter(o=>o.domain==='finance'&&(!paid||paid('pay:office:'+o.id))).reduce((n,o)=>n+.025*officeEfficiency(s,o)*level('base:administration'),0);
 return {expenses:heads.reduce((n,o)=>n+rolePay(s,'office',o.leader,o.id),0)+(s.agencies||[]).reduce((n,a)=>n+agencyAllocation(a)+(a.budget>0?rolePay(s,'agency',a.leader,a.id):0),0),revenueBonus,harvestBonus};
}
function domainFor(t){
 if(/审计|财政|税|金融|银行|预算/.test(t))return 'finance';
 if(/科学院|学堂|教育|科研|学会|大学/.test(t))return 'education';
 if(/农|水利|赈/.test(t))return 'agriculture';
 if(/卫生|医|防疫/.test(t))return 'medicine';
 if(/造船|航海|海事|水师/.test(t))return 'naval';
 if(/军|兵|参谋/.test(t))return 'military';
 if(/工|矿|制造/.test(t))return 'industry';
 return 'governance';
}
function inferredPowers(name,t){
 const p=[];
 if(/科学|研究|学堂|译|教育/.test(name))p.push('research');
 if(/监察|审计|稽查|反贪/.test(name))p.push('oversight');
 if(/政务院|议政院|军机处|统筹|协调六部|总理六部|取代内阁|代替内阁/.test(name+' '+t))p.push('coordination');
 return p.length?p:['execution'];
}
export function inferInstitutionChanges(s,text){
 const changes=[];
 const negative=/(?:不|别|勿|莫|不能|不要|暂不|不准)\s*(?:再|予以)?\s*(?:废除|废止|废掉|废|裁撤|撤销|取消|撤掉)\s*内阁/.test(text);
 if(!negative&&/(?:废除|废止|废掉|裁撤|撤销|取消|撤掉|废)\s*(?:现有)?\s*内阁|内阁.{0,4}(?:废除|废掉|裁撤|撤销)/.test(text))changes.push({operation:'abolish_cabinet'});
 if(/(?:恢复|重设|重建|重新设立|重新设置)\s*内阁/.test(text)&&!/(?:不|勿|别|不要|暂不)\s*(?:恢复|重设|重建|重新设立|重新设置)\s*内阁/.test(text))changes.push({operation:'restore_cabinet'});
 const pattern=/(?:新设|设立|成立|组建|另设|创设|建立|设)\s*(?:一个名为|一所|一个|名为)?[“「《"]?([\p{Script=Han}A-Za-z0-9·]{2,26}?(?:衙门|院|局|署|部|司|会|馆|监|府|处|所|社|厂|使))(?=[”」》"\s，。；：、]|负责|专|掌|用|来|并|负|统筹|协调|$)/gu;
 for(const m of text.matchAll(pattern)){
  const name=m[1];if(name==='内阁'||/(?:不|不要|勿|暂不|别)\s*$/.test(text.slice(Math.max(0,m.index-8),m.index)))continue;
  if(/(?:试作所|试验所|试验场|试验田|工坊|作坊)$/.test(name)&&!/(?:独立机构|行政机构|新设衙门|独立职权|单列编制)/.test(text))continue;
  const tail=text.slice(m.index+m[0].length,m.index+m[0].length+180);
  const budget=/每月(?:经费|预算|拨银|拨款|拨)?\s*(\d+(?:\.\d+)?)\s*万/.exec(tail);
  changes.push({operation:'create_agency',name,mandate:tail.replace(/^[”」》"\s，。；：、]+/,'').slice(0,180)||'依诏办理专门事务，向皇帝负责。',domain:domainFor(name+' '+tail),budget:budget?Number(budget[1]):8,powers:inferredPowers(name,tail)});
 }
 for(const a of s.agencies||[]){
  const escaped=a.name.replace(/[.*+?^\u0024{}()|[\]\\]/g,'\\$&');
  if(new RegExp('(?:裁撤|撤销|撤掉|废除|解散)\\s*[“「《"]?'+escaped).test(text)&&!new RegExp('(?:不|勿|不要|暂不)(?:裁撤|撤销|撤掉|废除|解散)\\s*'+escaped).test(text))changes.push({operation:'dissolve_agency',target:a.id});
 }
 if(changes.length>3)throw Error('本诏涉及三项以上机构变更，请分步颁行。');return changes;
}
export function normalizeInstitutionChanges(raw,s){
 if(!Array.isArray(raw)||raw.length>3)throw Error('一份机构诏令最多处理三项变更，请分步施行。');
 const changes=[];
 for(const r of raw){
  if(!r||typeof r!=='object')throw Error('机构变更格式无效。');
  const operation=r.operation;
  if(['abolish_cabinet','restore_cabinet'].includes(operation)){changes.push({operation});continue;}
  if(operation==='dissolve_agency'){
   const a=(s.agencies||[]).find(a=>a.id===r.target||a.name===r.target);
   if(!a)throw Error('拟裁撤的机构不存在。');changes.push({operation,target:a.id,name:a.name});continue;
  }
  if(!['create_agency','amend_agency'].includes(operation))throw Error('不支持的机构变更，请用设立、改组或裁撤。');
  const old=operation==='amend_agency'?(s.agencies||[]).find(a=>a.id===r.target||a.name===r.target):null;
  if(operation==='amend_agency'&&!old)throw Error('拟改组的机构不存在。');
  const name=String(r.name||old?.name||'').trim().slice(0,32);
  if(name.length<2||/[\u0000-\u001f<>]/.test(name)||name==='内阁')throw Error('机构名称需为 2 至 32 字；恢复内阁请另下复阁诏令。');
  const mandate=String(r.mandate||old?.mandate||'依诏办理专门事务。').trim().slice(0,500);
  const domain=domains.includes(r.domain)?r.domain:old?.domain||domainFor(name+' '+mandate);
  const powers=[...new Set((Array.isArray(r.powers)?r.powers:old?.powers||inferredPowers(name,mandate)).filter(p=>POWERS.some(x=>x.id===p)))].slice(0,3);
  if(!powers.length)throw Error('新机构至少需要一项权限。');
  const budget=Math.round(cap(r.budget??old?.budget??8,0,20));
  let leader;if(operation==='create_agency'&&r.leader!==undefined){const o=r.leader?officialFor(s,r.leader):null;if(r.leader&&(!o||!canServe(s,o.id)))throw Error('新机构负责人尚未归附或不可任用。');leader=o?.id||null;}
  changes.push({operation,...(old?{target:old.id}:{}),name,mandate,domain,powers,budget,...(leader!==undefined?{leader}:{})});
 }
 if(changes.filter(c=>['abolish_cabinet','restore_cabinet'].includes(c.operation)).length>1)throw Error('同一道诏令不能同时废阁和复阁。');
 return changes;
}
function applyChanges(s,changes){
 s.government||=initialGovernment();s.agencies||=[];
 for(const c of changes){
  const g=s.government;
  if(c.operation==='abolish_cabinet'){
   if(!g.cabinet)throw Error('内阁已经裁撤，现由'+administration(s).name+'。');
   g.cabinet=false;if(g.officeLeaders)delete g.officeLeaders.cabinet;g.transition=Math.max(g.transition,3);g.burden=cap(g.burden+20);
   s.legitimacy=cap(s.legitimacy+4);s.factions.scholar=cap(s.factions.scholar-12);continue;
  }
  if(c.operation==='restore_cabinet'){
   if(g.cabinet)throw Error('内阁仍在，无需重复恢复。');
   g.cabinet=true;g.transition=Math.max(g.transition,2);g.burden=cap(g.burden-10);s.factions.scholar=cap(s.factions.scholar+6);continue;
  }
  if(c.operation==='dissolve_agency'){
   const a=s.agencies.find(a=>a.id===c.target);if(!a)throw Error('此机构已不存在。');
   s.agencies=s.agencies.filter(a=>a.id!==c.target);g.transition=Math.max(g.transition,1);s.factions.scholar=cap(s.factions.scholar-2);continue;
  }
  if(s.agencies.some(a=>a.name===c.name&&a.id!==c.target))throw Error('已有同名机构，请改组或使用其他名称。');
  if(c.operation==='create_agency'){
   if(s.agencies.length>=256)throw Error('机构记录过多，请先整理已有案卷。');
   if(c.leader)rememberHire(s,c.leader);s.agencies.push({id:'agency-'+g.nextAgencyId++,name:c.name,mandate:c.mandate,domain:c.domain,powers:copy(c.powers),budget:c.budget,leader:c.leader||null,status:'forming',remaining:2,funded:c.budget>0,createdTurn:s.turn});
  }else{
   const a=s.agencies.find(a=>a.id===c.target);if(!a)throw Error('此机构已不存在。');
   const restructured=a.domain!==c.domain||JSON.stringify(a.powers)!==JSON.stringify(c.powers);
   Object.assign(a,{name:c.name,mandate:c.mandate,domain:c.domain,powers:copy(c.powers),budget:c.budget});
   if(restructured){a.status='forming';a.remaining=2;}if(!a.budget)a.funded=false;
  }
 }
}
function upfront(changes,s){return changes.reduce((n,c)=>n+(c.operation==='create_agency'&&c.leader?mobilizationCost(s,officialFor(s,c.leader)):0)+({abolish_cabinet:20,restore_cabinet:30,dissolve_agency:10,amend_agency:15}[c.operation]??20+agencyAllocation(c)*2),0);}
export function institutionPlan(s,raw,input,source='local',flavor={}){
 const changes=normalizeInstitutionChanges(raw,s);if(!changes.length)return null;
 const after=copy(s);applyChanges(after,changes);
 const summary=changes.map(c=>c.operation==='abolish_cabinet'?'裁撤内阁，六部直接向皇帝奏事；皇权 +4，文官支持 −12。中枢交接三个月，缺少协调会影响征税与御案负担，施政次数不设上限。':c.operation==='restore_cabinet'?'恢复内阁票拟，文官支持 +6；中枢交接两个月。':c.operation==='dissolve_agency'?'裁撤'+c.name+'，停止其预算与职能；其负责人解除该机构差遣。':(c.operation==='amend_agency'?'改组':'筹设')+c.name+'，专司'+c.mandate+'；月拨 '+c.budget+' 万两。'+(c.operation==='create_agency'?'筹备两个月，之后按经费、负责人及职权持续生效。':'改变职权或方向需重新筹备两个月。')).join('\n');
 return {title:changes.length===1?({abolish_cabinet:'裁撤内阁 · 六部直奏',restore_cabinet:'恢复内阁票拟',create_agency:'筹设 · '+changes[0].name,amend_agency:'改组 · '+changes[0].name,dissolve_agency:'裁撤 · '+changes[0].name}[changes[0].operation]):'中枢与机构改制',
  narrative:summary,feasibility:'诏令颁行即改变制度状态。新衙门仍须筹备、拨款和委任；统筹中枢另需筹备完成、负责人到任且每月预算至少 6 万两。权限重叠会降低机构成效。'+(flavor.feasibility?'\n'+String(flavor.feasibility).slice(0,400):''),
  minister:String(flavor.minister||'臣等奉旨交割印信与案牍。旧制可以撤，新制须有人接手，军饷、救荒和部务不可无人统摄。').slice(0,600),
  cost:{money:upfront(changes,s),grain:0},effects:{},regional:{},target:null,project:null,domain:'governance',factions:{},source,input,institutionChanges:changes,
  governmentPreview:{before:administration(s),after:administration(after),monthlyBudget:agencyEconomy(after).expenses,monthlyBudgetChange:agencyEconomy(after).expenses-agencyEconomy(s).expenses}};
}
export function enactInstitutionChanges(s,changes){
 applyChanges(s,normalizeInstitutionChanges(changes,s));
}
export function settleInstitutions(s,funded,level=()=>1){
 if(typeof funded!=='function'){const available=!!funded;funded=()=>available;}
 const notices=[],g=s.government,admin=administration(s,funded);
 for(const o of coreOffices(s)){
  const before=institutionSnapshot(s),k=o.leader?officeEfficiency(s,o):0,key=({governance:'corruption',education:'tech',military:'army',industry:'tech'}[o.domain]);
  const officePaid=typeof funded==='function'?level('base:administration')>0&&(!o.leader||funded('pay:office:'+o.id)):funded;
  if(officePaid&&key&&o.leader)s[key]=cap(s[key]+(key==='corruption'?-.3:.4)*k*level('base:administration'));
  recordInstitution(s,'office:'+o.id,o.name,{kind:'month',status:officePaid?'active':'unfunded',title:'部务月报',text:!officePaid?'经费未足额拨付，本月无专任主官加成。':o.leader?(s.service?.people.some(p=>p.id===o.leader&&p.origin==='incumbent'&&p.institution==='office:'+o.id)?'原任主官办理常务；日常职能已计入国家基数，不重复追加奖励。':'按职责办理常务；专任主官的实际追加成效列于下方。'):'常设属官维持原有部务，尚无专任主官的追加成效。',leader:o.leader,budget:rolePay(s,'office',o.leader,o.id),...institutionDelta(before,s),revenueRate:officePaid&&o.domain==='finance'?.025*k*level('base:administration'):0});
 }
 g.burden=cap(g.burden+(admin.coordinated?-10:12));if(g.transition>0)g.transition--;
 if(!admin.coordinated){notices.push('六部直奏：缺少中枢协调，本月税收效率降低，御案负担累积。');if(g.burden>=60){s.legitimacy=cap(s.legitimacy-1);notices.push('御案负担过重，皇权 −1；可委托有统筹权限的新机构承接政务。');}}
 for(const a of s.agencies){
  const before=institutionSnapshot(s),key='agency:'+a.id;
  a.funded=(typeof funded==='function'?funded('agency:'+a.id)&&(!a.leader||funded('pay:agency:'+a.id)):funded)&&a.budget>0&&level('base:administration')>0;
  const report=(status,text,extra={})=>recordInstitution(s,key,a.name,{kind:'month',status,title:'署务月报',text,leader:a.leader,budget:agencyAllocation(a)+(a.budget>0?rolePay(s,'agency',a.leader,a.id):0),...institutionDelta(before,s),...extra});
  if(!a.funded){const text=a.name+'的业务或主官经费未足额落实，本月筹备与职能暂停。';notices.push(text);report('unfunded',text);continue;}
  if(a.status==='forming'){a.remaining--;if(a.remaining<=0){a.status='active';a.remaining=0;notices.push(a.name+'筹备完成，职能从下月起结算。');}report('forming',a.remaining?'筹备推进，尚需 '+a.remaining+' 月；尚未计入日常职能产出。':'筹备完成，下月开始结算日常职能。');continue;}
  const k=agencyStrength(s,a,{paid:funded,administration:level('base:administration')});
  const effect={education:{tech:.65*k},industry:{tech:.35*k},military:{army:.5*k,frontier:-.2*k},naval:{navy:.5*k},governance:{corruption:-.45*k},medicine:{stability:.35*k},finance:{},agriculture:{}}[a.domain];
  const execute=a.powers.includes('execution')||a.powers.includes('coordination');
  for(const[key,v]of Object.entries(effect))if(execute||['education','industry'].includes(a.domain))s[key]=cap(s[key]+v);
  if(a.powers.includes('research')&&!['education','industry'].includes(a.domain))s.tech=cap(s.tech+.25*k);
  if(a.powers.includes('oversight'))s.corruption=cap(s.corruption-.2*k);
  if(execute&&a.domain==='agriculture')s.provinces.forEach(p=>{p.drought=cap(p.drought-.2*k);p.prosperity=cap(p.prosperity+.15*k);});
  s.technology[a.domain]=cap(s.technology[a.domain]+(a.powers.includes('research')?.8:.4)*k);
  report('active','按授权办理'+POWERS.filter(p=>a.powers.includes(p.id)).map(p=>p.name).join('、')+'；本期实际成效已计入国势与方向积累。'+(!a.leader?'暂缺主官，按属员能力运作。':''),{revenueRate:execute?(a.domain==='finance'?.04*k:a.domain==='industry'?.02*k:0):0,harvestBonus:execute&&a.domain==='agriculture'?6*k:0});
 }
 return notices;
}
export function institutionalEvent(s){
 const admin=administration(s);
 return {id:'institutions',category:'中枢交接续报',historical:'架空制度分支',title:'改制余波：谁来接手案牍',text:'当前中枢为'+admin.name+'。'+(s.agencies.length?'新设或保留的衙门有：'+s.agencies.map(a=>a.name).join('、')+'。':'尚未设置替代衙门。')+'部臣请明定行文、签押与责任归属，地方也在观察新制能否持续。',options:[
  {label:'拨款交接，整理权责清单',cost:{money:15},effects:{legitimacy:1},burden:-12,factions:{scholar:2}},
  {label:'责成六部分头承办',effects:{legitimacy:1},burden:5,factions:{scholar:-3}},
  {label:'听取部臣意见，暂稳人心',effects:{legitimacy:-1},burden:-4,factions:{scholar:5}}
 ]};
}
export function validateInstitutions(raw,s){
 const g=raw.government||initialGovernment();
 if(typeof g.cabinet!=='boolean'||!Number.isInteger(g.transition)||g.transition<0||g.transition>3||!Number.isFinite(g.burden)||g.burden<0||g.burden>100)throw Error('存档中枢制度无效。');
 if(g.nextAgencyId!==undefined&&(!Number.isSafeInteger(g.nextAgencyId)||g.nextAgencyId<1||g.nextAgencyId>1000000))throw Error('存档机构编号无效。');
 s.government={cabinet:g.cabinet,transition:g.transition,burden:g.burden,nextAgencyId:Math.max(1,Math.floor(Number(g.nextAgencyId)||1))};
 if(g.officeLeaders!==undefined&&(!g.officeLeaders||typeof g.officeLeaders!=='object'||Array.isArray(g.officeLeaders)||Object.keys(g.officeLeaders).some(id=>!CORE_OFFICES.some(o=>o.id===id))))throw Error('存档常设衙门无效。');
 s.government.officeLeaders={};for(const o of CORE_OFFICES){const leader=g.officeLeaders?.[o.id];if(leader&&!canServe(s,leader))throw Error('存档常设衙门主官无效。');if(Object.hasOwn(g.officeLeaders||{},o.id)&&(o.id!=='cabinet'||g.cabinet))s.government.officeLeaders[o.id]=leader||null;}
 if(raw.agencies!==undefined&&!Array.isArray(raw.agencies))throw Error('存档机构列表无效。');
 const agencies=raw.agencies||[];if(agencies.length>256||new Set(agencies.map(a=>a.id)).size!==agencies.length||new Set(agencies.map(a=>a.name)).size!==agencies.length)throw Error('存档机构重复或过多。');
 s.agencies=agencies.map(a=>{
  const n=normalizeInstitutionChanges([{...a,operation:'create_agency'}],s)[0];
  if(!/^agency-\d+$/.test(a.id)||!['forming','active'].includes(a.status)||!Number.isInteger(a.remaining)||a.remaining<0||a.remaining>2||a.status==='forming'&&a.remaining<1)throw Error('存档机构进度无效。');
  if(a.leader!==null&&!canServe(s,a.leader))throw Error('存档机构负责人无效。');
  return {id:a.id,name:n.name,mandate:n.mandate,domain:n.domain,powers:n.powers,budget:n.budget,leader:a.leader,status:a.status,remaining:a.status==='active'?0:a.remaining,funded:a.funded!==false,createdTurn:Math.max(0,Math.floor(Number(a.createdTurn)||0))};
 });
 s.government.nextAgencyId=Math.max(s.government.nextAgencyId,...s.agencies.map(a=>Number(a.id.slice(7))+1));
}
