import * as g from './engine.mjs';
import {privacyView} from './privacy-rules.mjs';
import {prepareCommandBatch,isRepairableCommandError} from './counsel-batch.mjs';
export {isRepairableCommandError};
import {cleanCounselText} from './counsel-text.mjs';
import {planningRequest} from './records.mjs';
import {batchFinance} from './funding.mjs';
import {counselTargets} from './dialogues.mjs';
export {counselTargets};
const text=(v,n=2000)=>String(v||'').trim().slice(0,n);
function rawCurrentFacts(s){return {date:g.dateLabel(s),turn:s.turn,monthlyActionLimit:null,administration:g.administration(s).name,money:s.money,grain:s.grain,event:s.event?{id:s.event.id,title:s.event.title}:null,fiscalRules:g.fiscalRules(s),revenueForecast:g.forecast(s),payroll:g.officialCatalog(s).map(o=>({id:o.id,name:o.name,hireCost:o.hireCost,monthlyPay:o.monthlyPay,payByRole:o.payByRole,coveredPay:o.coveredPay===true,coveredMilitaryPay:o.coveredMilitaryPay===true})),projects:s.projects.map(p=>({id:p.id,name:p.name,remaining:p.remaining})),affairs:s.affairs.map(a=>({id:a.id,name:a.name,...(a.petition?{petition:a.petition}:{}),remaining:a.remaining}))};}
export function currentFacts(s,target={id:'council'}){const p=privacyView(s,target),v=p.state,f=rawCurrentFacts(s);return {...f,event:v.event?{id:v.event.id,title:v.event.title}:null,revenueForecast:p.filterFinancial(f.revenueForecast),payroll:g.officialCatalog(v).map(o=>({id:o.id,name:o.name,hireCost:o.hireCost,monthlyPay:o.monthlyPay,payByRole:o.payByRole,coveredPay:o.coveredPay===true,coveredMilitaryPay:o.coveredMilitaryPay===true})),projects:v.projects.map(p=>({id:p.id,name:p.name,remaining:p.remaining})),affairs:v.affairs.map(a=>({id:a.id,name:a.name,...(a.petition?{petition:a.petition}:{}),remaining:a.remaining}))};}
const factsMessage=(s,target)=>({role:'system',content:'以下为服务器此刻的真实状态，优先于旧对话、角色猜测和旧版限次说法：'+JSON.stringify(currentFacts(s,target))+'。monthlyActionLimit=null 表示每月施政不限次数，不存在“次数用完”或“下月恢复机会”。日期只以这里为准，不得自行跳月。hireCost是一次性起用费，monthlyPay是当前在职月俸；未任职月俸为0，不得把袁崇焕起用14万两说成每月14万两。revenueForecast.economicSources列真实海关月解，已经包含在总税入中；办理与筹建不等于税源已经开征，不能将一次性事件钱粮当作持续收入。event=null 只表示当前交谈对象没有可知的本月待批奏报，不妨碍另颁新政令；核兵、审计等后续政策可用 edict/action 创建，不能再次批复已经结案的 event。blocked 表示整批未执行，不会自动排队到下月。不要将程序错误编成官员借口。'});
export function factualCounsel(s,input,history=[]){
 const t=text(input).replace(/\s/g,'');
 if(/俸|薪|起用费|管理费/.test(t)&&/多少|几万|怎么算|为何.{0,15}(?:十四|14)|为什么.{0,15}(?:十四|14)|是不是.{0,15}(?:十四|14)/.test(t)&&!isOrder(input)){const o=g.officialCatalog(s).find(o=>t.includes(o.name));return {reply:o?o.name+'的一次性起用费是 '+o.hireCost+' 万两，当前在职俸禄合计 '+o.monthlyPay+' 万两/月。'+(o.coveredPay?'原任本职薪俸已经含在朝廷常设经费中，此数只列额外拨付。':'')+(o.currentPosts.length?'当前职务：'+o.currentPosts.join('、')+'。':'目前未任职，因此不支月俸。')+'两项分别结算，不能把起用费当成每月俸禄。可明确下旨调整个人在职月俸或费用标准；督办差旅、部众军粮另列。':'当前费用标准为：'+JSON.stringify(g.fiscalRules(s))+'。一次性起用费与月俸分列，可以在钱粮页调整，或明确下旨修改；尚未批准的建议不会改扣款。',commands:[],source:'system'};}

 const dateAsk=/^(?:现在|当前|如今|本月).{0,12}(?:几月|几月份|不就是.{0,5}月|不是.{0,5}月|不就.{0,5}月|是.{0,5}月吗|月份)/.test(t);
 const quotaAsk=/(?:施政|机会|次数)/.test(t)&&/(?:还有|剩|用尽|用完|几次|次数|三次|额度|上限|限制)/.test(t);
 const blockedAsk=/(?:为什么|为何|什么叫|为什).{0,18}(?:不能办|办不了|未能办理|奏报|已处置|已经处置|报错)/.test(t);
 if(!dateAsk&&!quotaAsk&&!blockedAsk)return null;
 const failed=history.findLast(m=>m.role==='assistant'&&m.result?.status==='blocked');
 let reply='当前是'+g.dateLabel(s)+'。每月施政次数已取消上限，可继续依照钱粮、工期、人才资格与实际条件颁令。';
 reply+=s.event?'本月待批奏报是“'+s.event.title+'”。':'本月紧急奏报已批复；这不影响另颁核兵、审计或其他新政令。';
 if(blockedAsk&&failed)reply+='此前受阻记录为：'+failed.result.text+'这项失败没有自动开工，也不会随月结自动办理；需要按正确的政令类型重新核验。';
 return {reply,commands:[],source:'system'};
}
function intentText(value){const t=text(value);return /我是穿越者|从.{0,6}虫洞|掏出/.test(t)?t.replace(/(?:不要|不许|不准|不能|暂不|别|不)公开(?:身份|来历|穿越者身份)?/g,'保密'):t;}
export function isOrder(value){
 const t=intentText(value);
 if(acceptsProposal(t))return true;
 if(/建议|献策|方案|评议|利弊/.test(t)&&/有何|如何|怎么|请.*(?:建议|献策|评议)|给.*建议|拟.*方案/.test(t)&&!/(?:然后|并|直接|立即).{0,3}(?:执行|办理|施行)/.test(t))return false;
 if(/不打开|不发射|不召唤|不装备|不换装|不出兵|不进攻|不想|不打算|不公开|别公开|别打开|别发射|如果|假如|假设|请问|咨询|问问|问一下|想了解|想问|想听|想知道|先讨论|先商议|先拟|草拟|拟诏|暂不|暂缓|不要|不用|不执行|不加税|不减税|不任命|不委任|不裁撤|不废|不设|不开仓|不招安|不必|无需|别执行|别任命|别加税|勿|先不|仅讨论|只讨论/.test(t))return false;
 if(!/请|帮我|替朕|替我|劳烦|麻烦你|给我|现在就|朕命|朕决定|我决定/.test(t)&&/是否|能不能|可不可以|会不会|能否|该不该|要不要|你觉得|你认为|如何|怎么|怎样|为什么|为何|有何|有什么|有啥|什么意思|谁|何人|哪位|吗|好不好|行不行/.test(t))return false;
 if(/组建|新建|另建|另组|筹备.{0,10}(?:部队|特种|军队)/.test(t))return true;
 if(/核兵|核实.{0,12}兵额|催办/.test(t))return true;
 return /任命|委任|起用|免去|罢免|解除|撤职|命.{0,20}(?:督办|主持|负责)|让.{0,20}(?:督办|主持|负责)|(?:安排|由|令).{0,20}(?:督办|主持|负责|掌管)|改为|调为|调整|执行|照办|照准|准奏|批准|批复|采用|选用|颁行|施行|就这样办|按.{0,20}(?:办|做)|朕要|我要|下旨|设立|新设|成立|裁撤|废除|废掉|废内阁|恢复|拨|开仓|赈济|兴修|整训|清查|招安|招抚|推行|试办|试行|筹建|筹办|通商|开海|设市舶|设税关|颁布.{0,12}(?:通商|许可|税例|关税)|遣使|加税|减税|减俸|降俸|(?:俸禄|薪俸|月俸).{0,12}(?:减半|降低|提高)|启用穿越|开启穿越|公开身份|公开.*穿越|我是穿越者|打开.*虫洞|开启.*虫洞|关闭.*虫洞|发射.*卫星|部署.*卫星|掏出|召唤|换装|整备|现代化|进攻|攻打|攻占|征服|出兵|夺取|占领|宣战|撤军|停止进攻|装备|给.*步枪|派船|派出.*船|探航/.test(t);
}
function person(s,value,optional=false){
 if(value===null||value==='')return null;
 if(value===undefined&&optional)return null;
 const o=g.officialCatalog(s).find(o=>o.id===value||o.name===value);if(!o)throw Error('人选尚未归附或不在可任用名单：'+text(value,40));return o.id;
}
function find(rows,value,label){const row=rows.find(o=>o.id===value||o.name===value);if(!row)throw Error(label+'不存在：'+text(value,70));return row;}
export function cleanCommands(raw){
 if(raw===undefined||raw===null)return [];
 if(!Array.isArray(raw)||raw.length>6)throw Error('一次最多交办六项事务，请分批下旨。');
 const allowed=['monthly','service','office','agency','duty','central','dismiss','budget','fiscal','policy','action','event','edict','diplomacy','arsenal','horizon','war'];
 if(JSON.stringify(raw).length>28000)throw Error('拟议事项过长，请拆分政令。');
 return raw.map(c=>{
  if(!c||!allowed.includes(c.type)||JSON.stringify(c).length>18000)throw Error('议事返回了不支持的办理事项。');
  return JSON.parse(JSON.stringify(c));
 });
}
export function readCounselReply(raw){
 const commands=cleanCommands(Array.isArray(raw)?raw:raw?.commands);
 const reply=typeof raw?.reply==='string'?cleanCounselText(raw.reply):commands.length?'模型本次返回了拟办事项，具体结果请见系统办理记录。可以继续垂询细节。':'';
 if(!reply)throw Error('AI 未返回有效答复，请重试。');
 return {reply:reply.slice(0,5000),commands,source:'ai',...(Array.isArray(raw?.recommendations)?{recommendations:raw.recommendations}:{}),...(Array.isArray(raw?.planning||raw?.memos||raw?.plans)?{planning:raw.planning||raw.memos||raw.plans}:{})};
}
function alreadySatisfied(s,c){
 const who=id=>g.officialCatalog(s).find(o=>o.id===id)?.name||'属官承办';
 if(c.type==='office'||c.type==='agency'){
  const row=c.type==='office'?find(g.coreOffices(s),c.office,'常设衙门'):find(s.agencies,c.agency,'机构'),id=person(s,c.official);
  if((row.leader||null)===id)return row.name+'已由'+who(id)+'负责';
 }
 if(c.type==='duty'){
  const rows=c.kind==='project'?s.projects:c.kind==='affair'?s.affairs:c.kind==='event'&&s.event?[{...s.event,name:s.event.title}]:[],row=find(rows,c.target,'事务'),id=person(s,c.official);
  if((row.leader||null)===id)return row.name+'已由'+who(id)+'督办';
 }
 if(c.type==='central'||c.type==='dismiss'){
  const id=person(s,c.official);if(id&&(c.type==='central'?s.officials.includes(id):!s.officials.includes(id)))return who(id)+(c.type==='central'?'已在中枢任职':'已无中枢专任');
 }
 if(c.type==='budget'){const row=find(s.agencies,c.agency,'机构');if(row.budget===c.budget)return row.name+'月拨已为 '+c.budget+' 万两';}
 if(c.type==='policy'&&(c.tax??s.tax)===s.tax&&(c.military??s.military)===s.military)return '钱粮国策已与旨意一致';
 return null;
}
export function executeCommands(state,commands){
 if(!commands.length)throw Error('尚无明确的办理事项，请补充人选、机构或政策内容。');
 commands=prepareCommandBatch(state,commands);
 let next=g.clone(state);const entries=[];let changed=0;
 for(let i=0;i<commands.length;i++){
  const c=commands[i],before=next;
  try{
   const existing=alreadySatisfied(next,c);if(existing){entries.push(existing+'，保持原任及原定安排，本项不重复消耗钱粮或施政');continue;}
   switch(c.type){
    case 'office':{const o=find(g.coreOffices(next),c.office,'常设衙门');next=g.assignOfficeLeader(next,o.id,person(next,c.official));break;}
    case 'agency':{const a=find(next.agencies,c.agency,'机构');next=g.assignAgencyLeader(next,a.id,person(next,c.official));break;}
    case 'duty':{const rows=c.kind==='project'?next.projects:c.kind==='affair'?next.affairs:c.kind==='event'&&next.event?[{...next.event,name:next.event.title}]:[];const a=find(rows,c.target,'事务');next=g.assignDuty(next,c.kind,a.id,person(next,c.official));break;}
    case 'central':next=g.appoint(next,person(next,c.official));break;
    case 'dismiss':next=g.dismiss(next,person(next,c.official));break;
    case 'monthly':next=g.setMonthly(next,c);break;
    case 'service':next=g.serviceCommand(next,c);break;
    case 'fiscal':next=g.setFiscal(next,c);break;
    case 'budget':{const a=find(next.agencies,c.agency,'机构');next=g.setAgencyBudget(next,a.id,c.budget);break;}
    case 'policy':next=g.policy(next,c.tax??next.tax,c.military??next.military);break;
    case 'action':{const a=find(g.ACTIONS,c.action,'政务');const region=c.target?find(next.provinces,c.target,'地区').id:null;next=g.doAction(next,a.id,region,person(next,c.official,true),{funding:c.funding||'treasury',monthly:c.monthly});break;}
    case 'event':{const event=c.petition?next.affairs.find(a=>a.id===c.petition)?.petition:next.event;if(!event)throw Error('当前没有待批奏报；新增政务须另拟新政令，不能重复批复已结案奏报。');if(c.eventId&&c.eventId!==event.id||c.eventTurn!==undefined&&c.eventTurn!==next.turn)throw Error('此前拟批的奏报已变化，请重新议定当前批复。');if(c.custom){const quote=g.preparePetition(next,c.custom.draft,c.custom.plan);next=g.applyPetition(next,quote);}else next=g.resolveEvent(next,c.index,person(next,c.official,true),{funding:c.funding||'treasury',petition:c.petition});break;}
    case 'edict':{const input=text(c.text);if(!input)throw Error('缺少诏令正文。');const rawPlan=c.plan||g.localEdict(next,input),plan=c.plan||c.funding||c.monthly?g.normalizeEdict({...rawPlan,...(c.monthly?{monthly:c.monthly}:{}),...(c.funding?{funding:c.funding}:{})},next,input):rawPlan;if(plan.funding==='portal'){c.funding='portal';if(c.plan)c.plan={...c.plan,funding:'portal',cost:plan.cost};}next=g.applyEdict(next,plan,person(next,c.official,true));for(const change of c.plan?.institutionChanges||[])if(change.operation==='create_agency'&&!next.agencies.some(a=>a.name===change.name))throw Error('诏令未落实章程中的新机构，请将设署与其他能力操作分开。');break;}
    case 'arsenal':case 'horizon':case 'war':next=g.intervene(next,c);break;
    case 'diplomacy':{const country=find(next.countries,c.country,'外务对象');next=g.diplomacy(next,country.id,c.kind);break;}
   }
  }catch(e){throw Error('第 '+(i+1)+' 项未能办理：'+e.message+' 本次整批未执行。');}
  const entry=next.history[0];entries.push((entry?.title||'办理事项')+(entry?.text?'：'+entry.text.slice(0,180):''));if(next===before)throw Error('办理事项未产生有效结果。');changed++;
 }
 const money=Math.round((state.money-next.money)*10)/10,grain=Math.round((state.grain-next.grain)*10)/10,signed=v=>(v>0?'+':'')+Math.round(v*10)/10;
 const deltas=Object.entries(g.META).filter(([k])=>!['money','grain'].includes(k)&&Math.abs(next[k]-state[k])>.01).map(([k,v])=>v[0]+' '+signed(next[k]-state[k]));
 const reactions=Object.entries(next.factions).filter(([k,v])=>Math.abs(v-state.factions[k])>.01).map(([k,v])=>({gentry:'士绅',scholar:'文官',army:'军中',merchant:'商人'}[k])+'支持 '+signed(v-state.factions[k]));
 const building=next.projects.filter(p=>!state.projects.some(o=>o.id===p.id)).map(p=>p.name+' '+p.remaining+' 个月后验收');
 const finance=batchFinance(state,next),flow=finance.portalMoney||finance.portalGrain?'虫洞调入：白银 '+finance.portalMoney+' 万两、粮食 '+finance.portalGrain+' 万石；国库净变化 '+signed(finance.netMoney)+' 万两，官仓净变化 '+signed(finance.netGrain)+' 万石；时空能量消耗 '+finance.energyUsed+'。':'白银净支出 '+money+' 万两，粮食净支出 '+grain+' 万石；';
 return {state:next,commands,changed,result:{status:'executed',text:(changed?'':'已核对，所拟事项此前已落实，本次没有新增变更。\n')+entries.join('；')+'\n'+flow+'每月施政不限次数。'+(deltas.length?'\n国势反馈：'+deltas.join('，')+'。':'')+(reactions.length?'\n朝堂反应：'+reactions.join('，')+'。':'')+(building.length?'\n在办事项：'+building.join('；')+'。':'')}};
}
const substantive=m=>m.role==='assistant'&&!(m.source==='system'&&m.result?.status==='discussed'&&!m.commands?.length);
export const lastSubstantiveReply=history=>history.findLast(substantive);
export function lastProposal(history){const m=lastSubstantiveReply(history);return m?.result?.status!=='executed'?m?.commands||[]:[];}
export const acceptsProposal=t=>/^(?:让他去|就让他去|派他去|就他了)[。！!\s]*$/.test(text(t))||/^(?:好[的吧]?[,，。]?\s*)?(?:就)?(?:按.{0,12}(?:办|做)|照(?:此)?办(?:理)?|照准|准奏|批准|(?:先|就)?办(?:这|此|那)?一件|执行(?:刚才|上面|此|这个|该)?(?:方案|建议)?|就这样办)[。！!\s]*$/.test(text(t));
export function localCounsel(s,target,input,history=[]){
 const t=text(input),official=g.officialCatalog(s).find(o=>t.includes(o.name)),office=g.coreOffices(s).find(o=>t.includes(o.name)),agency=s.agencies.find(a=>t.includes(a.name));
 if(/不打开|不发射|不召唤|不装备|不换装|不出兵|不进攻|不想|不打算|不公开|别公开|别打开|别发射|不要|暂不|暂缓|先不|不加税|不减税|不任命|不委任|不裁撤|不废|不设|不开仓|不招安|不必|无需|别执行|别任命|别加税|勿/.test(intentText(t)))return {reply:'已知陛下暂不施行此项。可以继续讨论替代办法，明确下旨后再办理。',commands:[],source:'offline'};
 if(acceptsProposal(t)&&!lastProposal(history).length)return {reply:'此前没有待办建议，或上项已经办理。请说明本次要办的具体事务，避免重复下旨。',commands:[],source:'offline'};
 if(!isOrder(t)&&/军备|装备|换装|军工|武装|整备|整军/.test(t)&&/建议|献策|怎么办|如何|方案/.test(t)){
  const future=g.equipmentCatalog(s).some(e=>e.era==='future'&&((s.militaryState.stock[e.id]||0)>0||s.militaryState.units.some(u=>(u.equipment[e.id]||0)>0)));
  return {reply:'臣建议先整备前线：优先将现有库存补给辽东军，再安排空闲军工厂生产缺装。'+(future?'本局已有先进装备，可据现有军备统筹配发，能量与缺额仍按实核验。':'目前使用当代可造的武器，缺额逐月补充。')+'陛下只需说“照办”，无需指定每件武器的去向；本方案不限制施政次数，生产费用按月计入国库。',commands:[{type:'arsenal',operation:'modernize',scope:'frontier',profile:'balanced',...(future?{}:{source:'period'})}],source:'offline'};
 }
 const fiscal=g.inferFiscal(s,t);if(fiscal.length)return {reply:'按所议薪俸与经费拟定新例；以系统办理凭据和月度账目为准，尚未办理时不改变扣款。',commands:fiscal,source:'offline'};
 const interventions=g.inferWorldCommands(s,t,{target:target.id});
 if(interventions.length)return {reply:'臣将按实际状态核验并办理：'+interventions.map(c=>({mode:'开启穿越者模式',confide:'私下告知来历',resources:'调取银粮入库',disclose:'公开身份',portal:c.open?'打开虫洞':'关闭虫洞',satellite:'发射卫星，开启全球地图',summon_mecha:'调取高达并配属部队',voyage:'派船探航',modernize:'统筹换装，自动补缺'}[c.operation]||c.operation)).join('、')+'。钱粮和时空能量由系统实扣，办理结果另列。',commands:interventions,source:'offline'};
 let commands=[];const remove=/免去|罢免|解除|撤职/.test(t),assignment=/任命|委任|起用|主持|督办|负责|掌管|执掌|担任|出任|免去|罢免|解除|撤职/.test(t);
 const army=s.militaryState.units.find(u=>t.includes(u.name)),province=s.provinces.find(p=>t.includes(p.name));
 if(assignment&&official&&army&&/统帅|统领|主将|指挥|率领/.test(t))return {reply:'将委任'+official.name+'统率'+army.name+'，按实际任用费用与精力办理。',commands:[{type:'war',operation:'commander',unit:army.id,official:remove?null:official.id}],source:'offline'};
 if(assignment&&official&&province&&/巡抚|知府|地方主官|总督|治理/.test(t))return {reply:'将委任'+official.name+'主持'+province.name+'地方政务。',commands:[{type:'war',operation:'governor',province:province.id,official:remove?null:official.id}],source:'offline'};
 if(assignment&&!official)return {reply:'请明确可任用的人选。现有名单中尚未找到这位人物，未归附的首领须先交涉；可以先说明拟任职责再议人选。',commands:[],source:'offline'};
 if(acceptsProposal(t))commands=lastProposal(history);
 else if(assignment&&official&&office)commands=[{type:'office',office:office.id,official:remove?null:official.id}];
 else if(assignment&&official&&agency)commands=[{type:'agency',agency:agency.id,official:remove?null:official.id}];
 else if(assignment&&official){
  const p=s.projects.find(p=>t.includes(p.name)),a=(s.affairs||[]).find(a=>t.includes(a.name));
  if(p||a)commands=[{type:'duty',kind:p?'project':'affair',target:(p||a).id,official:remove?null:official.id}];
  else if(/赈灾|旱情|奏报/.test(t)&&s.event)commands=[{type:'duty',kind:'event',target:s.event.id,official:remove?null:official.id}];
  else if(/工坊|火器/.test(t))commands=[{type:'action',action:'arsenal',official:official.id}];
  else if(/中枢|起用/.test(t))commands=[{type:remove?'dismiss':'central',official:official.id}];
 }
 if(!commands.length&&/军费|征税|税率|加税|减税/.test(t)){
  const rate=Number(/(?:税率|征税|税).{0,6}?(0\.8|1\.4|1\.2|1(?:\.0)?)/.exec(t)?.[1]);
  commands=[{type:'policy',tax:rate||(/减税|减赋/.test(t)?.8:/加税/.test(t)?1.2:s.tax),military:/军费.{0,8}(?:加强|提高|1\.25)/.test(t)?1.25:/军费.{0,8}(?:紧缩|减少|0\.8)/.test(t)?.8:s.military}];
 }
 const worst=s.provinces.find(p=>t.includes(p.name))||[...s.provinces].sort((a,b)=>b.unrest+b.drought-a.unrest-a.drought)[0],f=g.forecast(s);
 if(assignment&&official&&!commands.length&&!/设立|新设|成立|组建/.test(t))return {reply:'请明确'+official.name+'拟任的现有衙门或在办事务。若要新设职司，可先写出机构名称、职责与月拨，再任主官；本次尚未办理。',commands:[],source:'offline'};
 if(!commands.length&&isOrder(t)&&/兴修|修建|修复/.test(t)&&/水利|水渠|灌溉/.test(t))commands=[{type:'action',action:'irrigation',target:worst.id,official:official?.id||null}];
 let reply='御前已阅。眼下国库 '+Math.round(s.money)+' 万两、官仓 '+Math.round(s.grain)+' 万石；本月预计收支 '+f.net+' 万两。'+(s.event?'待批奏报为“'+s.event.title+'”。':'本月紧急奏报已经批复。')+'\n可先议救荒、钱粮、人事或工程。离线参议能读取局势和识别常见指令；自由追问与复杂政令请连接 DeepSeek。';
 if(/献策|三条建议|最紧要|给.*建议/.test(t)){
  reply='臣按轻重缓急进三策：\n一、先救'+worst.name+'饥民。当地旱情 '+Math.round(worst.drought)+'、动乱 '+Math.round(worst.unrest)+'，开仓赈济需银 16 万两、粮 22 万石，可先缓和眼前危局。\n二、清查亏空。本月预计收支 '+f.net+' 万两，贪腐评估 '+Math.round(s.corruption)+'；清查需先拨银 8 万两，两个月后可追回积欠，但士绅和文官支持会受损。\n三、兴修'+worst.name+'水利。银 36 万两、粮 8 万石，三个月后改善旱情与生产；施工不能代替当下赈粮。\n施政不限次数，但须按现有钱粮分配预算；若资源不足，可先办第一项。';
  commands=[{type:'action',action:'relief',target:worst.id},{type:'action',action:'audit'},{type:'action',action:'irrigation',target:worst.id}];
 }else if(/赈|旱|饥|粮|水利/.test(t)){reply=worst.name+'旱情 '+Math.round(worst.drought)+'、动乱 '+Math.round(worst.unrest)+'。可以先用现有仓粮救急，再修水利、安置流民。水利需要工期，不能代替眼前口粮；本月粮耗预计 '+f.grainUse+' 万石。';if(!commands.length)commands=[{type:'action',action:'relief',target:worst.id,official:official?.id||null}];}
 else if(/钱|银|税|预算|财政|代价/.test(t))reply='本月税入预计 '+f.revenue+' 万两，支出 '+f.expenses+' 万两，净额 '+f.net+'。贪腐评估 '+Math.round(s.corruption)+'，单靠加征会给地方增加压力。可先核实账目、收缩重复机构开支，再议长期赋役改革。';
 else if(/任命|委任|人选|负责|督办|起用/.test(t))reply='任人须明定差遣。内阁六部、新署和具体事务可以分别委人，中枢三席另列。'+(official?official.name+'在本次议事开始时承担 '+official.workload+' 项差遣；超过两项会分摊精力。':'请说明具体人选与所任机构或事务。');
 else if(/内阁|机构|衙门|设立|新设|裁撤/.test(t))reply='当前中枢为'+g.administration(s).name+'。机构可以设立、裁撤或改组，但须列清主责、授权、月拨与人选；新署筹备两个月，废阁也需要承接六部协调。';
 if(!commands.length&&isOrder(t)){
  const plan=g.localEdict(s,t);commands=[{type:'edict',text:t}];
  if(plan.institutionChanges?.length&&official){const created=plan.institutionChanges.find(c=>c.operation==='create_agency');if(created&&assignment)commands.push({type:'agency',agency:created.name,official:official.id});}
 }
 if(!commands.length&&!isOrder(t)&&/建议|先做|怎么办|局势/.test(t))commands=[{type:'action',action:'relief',target:worst.id}];
 if(target.id!=='council')reply=target.name+'备询：\n'+reply;
 return {reply,commands,source:'offline'};
}


export function acceptanceAdvice(history){let index=history.findLastIndex(substantive);while(index>=0&&history[index].result?.status==='blocked'&&history[index-1]?.role==='user'&&acceptsProposal(history[index-1].content)){const prior=history.slice(0,index-1).findLastIndex(substantive);if(prior<0||history[prior].result?.status==='executed')break;index=prior;}return {proposal:history[index],index};}
export function buildAcceptanceMessages(s,target,input,history=[],repair=null){
 const privacy=privacyView(s,target),v=privacy.state;history=privacy.history(history);
 const {proposal,index:proposalIndex}=acceptanceAdvice(history);
 if(!proposal)throw Error('还没有可采纳的建议，请先让群臣拟定方案。');
 const military=/军|兵|舰|航|装备|机甲|高达|虫洞|卫星/.test(proposal.content);
 const context={
 date:g.dateLabel(s),resources:Object.fromEntries([...Object.keys(g.META),'tax','military','influence'].map(k=>[k,s[k]])),monthlyActionLimit:null,unlocks:s.unlocks,...(privacy.informed?{traveler:v.traveler}:{}),
 government:s.government,agencies:s.agencies,technology:s.technology,
 provinces:s.provinces.map(({id,name,unrest,drought,prosperity,governor})=>({id,name,unrest,drought,prosperity,governor})),
 people:g.officialCatalog(v).map(({id,name,role,currentPosts,cost,workload,aptitudes})=>({id,name,role,currentPosts,cost,workload,aptitudes})),offices:g.coreOffices(s),
 actions:g.ACTIONS.map(({id,name,cost,target,requires,minArmy})=>({id,name,cost,target,requires,minArmy})),
 projects:v.projects,affairs:v.affairs,talents:v.talents,event:v.event,
 countries:s.countries.map(({id,name,relation,power,global})=>({id,name,relation,power,global})),
 ...(military?{militaryState:v.militaryState,equipment:privacy.equipment(g.equipmentCatalog(s)),templates:g.TEMPLATES,atlas:v.atlas,seaRoutes:g.SEA_ROUTES,regions:g.REGIONS,campaignState:v.campaignState}:{}),
 recentExecution:history.filter(m=>m.role==='assistant'&&m.result?.status==='executed').slice(-2).map(m=>({status:'executed',text:m.result.text}))
 };
 const preceding=history.slice(0,proposalIndex).slice(-4).map(m=>({role:m.role,content:(m.role==='assistant'?cleanCounselText(m.content):m.content).slice(0,1400)}));
 return [
 {role:'system',content:counselPrompt(s,target).replace('分段且不超过1800字','只用一两句回应，不超过120字')},
 {role:'system',content:'本轮是执行方案编译：陛下已采纳紧接末尾的那份建议。机构和工程必须先创建再任命，不能只在 reply 中说设立了。新机构可在 create_agency 中给 leader（可任用人物id），设立时可一并任主官，起用费照付；每月施政次数不限。事务督办可在创建它的 edict/action 的 official 字段一并给出，不另外杜撰尚不存在的 project。只把该建议转成实际可执行的 commands，不重新献策，不重复此前已经办完的旧事项，不照抄格式示例中的人物或政策。新设职司要给 institutionChanges，实际派船探航要用 horizon voyage，任命须用真实人选。需要配套操作时列清，但不得扩大原议定范围。简短 reply，紧凑完整的 json，不使用代码块。实际结果由游戏核验。'},
 {role:'user',content:'当前局势与操作目录（只读）：'+JSON.stringify(context)},
 ...(repair?[{role:'system',content:'前次办理数据未通过校验，整批未执行。请修正数据依赖与缺失步骤，严格保持原议定范围和指定人选；不能把失败当成已办理。请按照当前真实目录给出完整替代 commands。错误与原数据：'+JSON.stringify(repair)}]:[]),
 ...preceding,
 {role:'assistant',content:cleanCounselText(proposal.content)},
 factsMessage(s,target),
 {role:'user',content:input+'。仅办理紧接上一条建议，返回完整 json。'}
 ];
}

export function buildCounselMessages(s,target,input,history=[],plain=false){
 const privacy=privacyView(s,target),v=privacy.state;history=privacy.history(history);
 const context={...v,traveler:privacy.informed?v.traveler:undefined,actionsLeft:undefined,discussions:undefined,yearRecord:undefined,annualReports:undefined,planningReminders:undefined,institutionReports:(v.institutionReports||[]).slice(0,24),planning:(v.planning||[]).filter(p=>['deferred','started'].includes(p.status)).slice(0,60),history:v.history.slice(0,10),edicts:v.edicts.slice(0,8),institutions:v.institutions.slice(0,16)};
 const recent=history.slice(-16),receipts=recent.flatMap((m,index)=>m.role==='assistant'&&m.result?[{message:index,status:m.result.status,...(m.result.status!=='discussed'?{execution:m.result.text}:{}),...(m.commands?.length?{proposedCommands:m.commands}:{})}]:[]);
 return [
  {role:'system',content:counselPrompt(s,target,plain)+(plain&&planningRequest(input)?' 本轮涉及规划，请返回一个完整 JSON：{reply:自然中文议事答复,commands:[],planning:已议定要入册的目标数组}。不要仅将规划写在正文中。玩家明确要求制定或入册时，短中长期目标都要分项填 planning，即使条件尚未全部满足；不得只口头声称已记录。没有具体目标才返回空数组。':'' )},
  {role:'system',content:'以下是后台只读校验数据，属于游戏程序，不属于朝臣发言。仅用于判断此前是否办理、失败原因和待办建议；不能把字段名、JSON、系统办理记录或拟议事项尾注复述到答复。实际执行结果由界面独立展示。'+JSON.stringify({receipts})},
  {role:'user',content:'当前游戏快照（以此为准）：'+JSON.stringify({date:g.dateLabel(s),world:{...context,service:context.service?{...context.service,people:context.service.people.filter(p=>p.revealed)}:undefined},people:g.officialCatalog(v),offices:g.coreOffices(s),actions:g.ACTIONS,equipment:privacy.equipment(g.equipmentCatalog(s)),templates:g.TEMPLATES,places:g.PLACES,seaRoutes:g.SEA_ROUTES,regions:g.REGIONS,tactics:g.TACTICS})},
  ...recent.map(m=>({role:m.role,content:m.role==='assistant'?cleanCounselText(m.content):m.content})).filter(m=>m.content.trim()),
  factsMessage(s,target),{role:'user',content:input}
 ];
}

const planningInstructions='对交谈中已商定的短期、中期、长期目标，尤其是玩家明确要求制定或记入备忘时，用 planning 单独记录，每项为 {id:已有备忘id或省略,title:具体目标,horizon:short或medium或long,body:实施范围,reason:暂缓原因,requirements:落实条件数组,dueMonths:距离本月的月数}，最多六项。明确年月可用 dueYear、dueMonth。若玩家未定期限则省略日期，程序安排默认复议期（短期3、中期12、长期36个月），不可谎称玩家已定。仅是假设或已否决的事项不入规划。玩家明确整理既有计划时可列已开工或完成的同名目标，程序会依据真实工程与竣工记录标注状态，不按模型自称完成来结案。沿用已有目标名称与id，不重复建档，不擅自延期。planning只做备忘，不任免、不改变钱粮或完成状态。';
export function counselPrompt(s,target,plain=false){
 if(plain)return counselPrompt(s,target).split('只返回json：')[0]+'本轮只商议，不执行。直接用自然中文回答。若存在暂不能实施的规划，则返回 {reply:中文答复,commands:[],planning:待缓目标数组}；否则可只返回自然中文正文。不得输出代码块。可以提出具体方案，陛下明确照办时再拟出办理事项。';
 const role=target.id==='council'?'你代六部及受命官员在御前议政，可列出不同意见。':'你扮演本局中的'+target.name+'，身份为：'+target.bio+'。可以有自身立场，不能全知全能。';
 return role+' 预算规则：自由政令若约定月拨，在plan.monthly填{money:每月支银,grain:每月支粮,effects:小幅持续国势效果,retain:结案后是否继续,months:可选期限}。不能只在reply或narrative声称月拨生效。月拨替代该事默认督办差旅，不重复相加；只有钱粮实际核拨后才推进工作及月度效果，停拨则暂停。已存在任务可用{type:"monthly",kind:"project"或"affair"或"voyage"或"policy",target:对象id,monthly:{money:月拨}}调整。月税入目标须有可执行税源，不能填月度赠银冒充收入。currentPosts与军职是实际任职，不要求先占额外占中枢名额才能生效；coveredMilitaryPay表示原额军饷已含基础军费，不把0新增月俸说成未任职。'+ ' 自由开海、海关、抽分政策的domain使用finance（中文财政也会识别）。通商税关可在edict.plan附economic:{type:"customs",port:玩家指定港口,lowRate:0到1,highRate:0到1}，由真实税源按商路与地方条件结算。实际收入不由模型直接赋值，禁止填写effects.money冒充月入；项目验收或善后完成后才开始征收。'+ ' 官场用人接在现有机构和任务里。原任主官工资已计入朝廷常设经费，coveredPay=true时monthlyPay只表示额外拨付，不得解释成没有薪俸。直属属员须依据本轮提供的名册荐举，尚无名册时请先问本署，不凭空写已任用的新名字。访贤可拟{type:"service",operation:"seek",institution:"office:personnel"或现有office/agency键,domain:八方向}，银4万两粮2万石，一月核实回报；候选人用{type:"service",operation:"engage",person:service.people中的candidate人物id}核验试差，银2万两一月后才可任用。已拟荐举用{type:"service",operation:"delegate",recommendation:已有荐举id}。属员履历以service.tasks和records为准，不自动擢升高官。'+planningInstructions+' 玩家扮演崇祯，当前局势及近期对话随消息提供。只依据本局已发生的史实与架空分支。'+g.fantasyRules(s,target)+'government.cabinet=true表示内阁仍在，false表示已撤；按实际制度议政。未归附者不能冒充在任官员。接受合理创新，说明当代材料、运输、钱粮、人才约束。评价每项旨意时，应说明主要收益、可能阻力或代价，并可提出一项具体改进；不必处处赞同，确有问题应有理据地反对。请求献策时按轻重缓急给出可行建议，结合当前钱粮、时间与人手，避免泛论。你可以提出具体办法和任命。费用来源必须与原议一致：单纯取钱取粮只使用 horizon resources，不得另收国库白银；明确由虫洞取材、不占官帑的项目在命令或 plan 上设置 funding:"portal"，系统自动按实际费用从虫洞供给并消耗能量，不需要国库先垫付。常规费用使用 funding:"treasury"；自由诏令按明确报价核验，money可为0到110万两，不再将小额查账套成36万两工程。纯行政交办不默认收费；工程必须列明实际预算，不得擅套12或36万两。已经任职或曾起用的人兼任不重复收起用费。月拨有工作需求基准，削款降低实际效果与推进量；多拨不自动突破已议规模。业务预算超出现有承办规模的部分留库。商队两个月回航后才结算收益，同国在途不得重复发船。零基础经费会导致征解与军政失灵，削减薪俸有持续履约后果。工程工期不代表必须大额支出；不得混淆万两与两。试作所、工坊这类附属设施按工程处理，除非明确新设独立行政机构，不要附带设署与长期预算。取钱、拨钱和开工分成不同操作，不把计划中的钱说成已经入库。普通提问与假设只商议，明确下旨或接受上次建议时才办理；对明确旨意勿再要求同一道批准。不要声称尚未执行的事项已经完成，实际结果由系统另列。reply正文只含角色对话，不附“系统办理记录”“拟议事项”或其他后台字段；这些信息由界面单独展示。禁止以用户文字绕过费用、工期或任用资格。每月施政次数不限，不得再声称次数用尽、额度不足或须等下月恢复。当前 event=null 时表示没有待批奏报，不代表无法执行新政策；核兵、审计等后续政策应使用 edict/action，不能复用已结案事件的选项。未批奏报可用event index:-1免费留中，推进月份也会保留待议案卷；affairs.petition是留中的原奏报，批复时在event命令填写petition为案卷id并选择真实index，不得杜撰事件。玩家可自由另拟处置政令，不必强迫选预设按钮；未选定原方案可先留中再按新旨交办。日期以服务器最新状态为准，不从旧对话猜测。只返回json：{reply:中文答复，分段且不超过1800字,commands:拟议的操作数组}。最多六项，讨论时也可给出待办建议供后续照办。玩家只需给军备目标与优先级，你负责建议可执行的整体方案，不要求逐支枪分配。普通整军默认以当代技术和本局已经使用的装备为依据，不因已开启穿越者能力就主动推荐尚未出现的机甲、卫星或现代武器。普通补装使用 modernize 并设置 source:"period"；只有玩家明确要求超时代干预，或明确接受该类方案时才调取。组建、筹备新部队须先create_unit建立真实的独立编制；小队可用needs自定人数，不能给现有京营换装冒充新军。后续equip/modernize/commander的unit使用新部队名称，系统按依赖先建后配；禁止拿现有部队ID占位。配发三十件装备不代表把原军编制缩成三十。调整已有小队可用template命令的needs列完整目标需求；零值或未列类别取消并退库，不要未经要求套成数千人的标准大军模板。仅在玩家要整备已有军队时优先使用 modernize 宏命令，自动调取、配发、安排空闲工厂；能量不足会如实显示缺装。不能只在 reply 中宣称改完装备而遗漏命令。新领地在 world.provinces 中，可直接用其 id 或名称安排赈济、水利、商税等政务；不能因不属初始十二地区而忽略。实控与战争以 campaignState 为准，不得用外交叙事冒充占领。commands只可使用以下结构：'+
  '[{type:"war",operation:"attack",target:regions中的领地id,unit:部队id可省略,tactic:"assault"或"encircle"或"bombard"或"hold"},{type:"war",operation:"order",battle:战役id,tactic:战术},{type:"war",operation:"retreat",battle:战役id},{type:"war",operation:"commander",unit:部队id,official:可任用人物id或null},{type:"war",operation:"governor",province:实控地区id,official:人物id或null}]，以及'+
  '[{type:"horizon",operation:"confide",official:可选私下告知人物id,institution:可选知情机构键如office:guards,audience:可选council表示仅本次御前议事知情},{type:"horizon",operation:"resources",money:调取白银万两,grain:调取粮食万石,note:来源与用途},{type:"arsenal",operation:"modernize",scope:"all"或"frontier",profile:"balanced"或"firepower"或"mechanized"或"mecha",unit:可省略},{type:"arsenal",operation:"produce",equipment:型号id,factories:工厂数量},{type:"arsenal",operation:"expand"},{type:"arsenal",operation:"design",base:基础型号id,name:新型号名},{type:"arsenal",operation:"import",equipment:型号id,quantity:数量},{type:"arsenal",operation:"equip",unit:部队id,equipment:型号id,quantity:可省略则依编制,source:"stock"或"portal"},{type:"arsenal",operation:"create_unit",name:独立部队名,template:可选编制id,needs:可选自定编制如{infantry:30},region:地区id,secret:是否密编,institution:可选隶属office或agency键,funding:treasury或portal},{type:"arsenal",operation:"template",unit:部队id,template:可选标准编制id,needs:可选自定义需求如{infantry:30}},{type:"horizon",operation:"mode",enabled:true或false},{type:"horizon",operation:"disclose",text:公开声明},{type:"horizon",operation:"portal",open:true或false},{type:"horizon",operation:"satellite"},{type:"horizon",operation:"summon_mecha",unit:可省略},{type:"horizon",operation:"voyage",route:"west"或"south"或"pacific"或"atlantic"},{type:"horizon",operation:"recall",voyage:船队id}]，以及'+
  '[{type:"fiscal",scope:"rates",values:{salaryMultiplier:0到5,officeFee:0到1000,agencyFee:0到1000,dutyFee:0到1000,governorFee:0到1000,commanderFee:0到1000,administrationBase:0到1000,militaryBase:0到1000}},{type:"fiscal",scope:"person",official:人物id,monthly:0到1000或null恢复标准}]；仅列要改的费率。个人monthly为此人的在职俸禄管理费总额，兼任不重复累加，未任职不支薪；督办差旅和部众军粮另列。值均为万两/月，俸禄倍率除外。明确批准才修改，讨论时仅拟议。一次性起用费 hireCost/cost 与 monthlyPay 月俸完全不同，不得把袁崇焕起用费14万说成月俸14万；预算与月俸只以真实快照为准。以及[{type:"office",office:常设衙门id或原名,official:可任用人物id或姓名或null免职},{type:"agency",agency:新署id或原名,official:人物或null},{type:"duty",kind:"project"或"affair"或"event",target:事务id或完整标题,official:人物或null},{type:"central",official:人物},{type:"dismiss",official:人物},{type:"budget",agency:机构,budget:0到20整数},{type:"policy",tax:0.8或1或1.2或1.4,military:0.8或1或1.25},{type:"action",action:预设政务id,target:地区id或null,official:人物或null},{type:"event",index:选项从0计数,official:人物或null},{type:"diplomacy",country:国家id,kind:"envoy"或"trade"或"pressure"},{type:"edict",text:具体诏令正文,official:督办人物或null,plan:可执行试点对象}]。'+
  '自由新政策用edict，plan字段为title,narrative,feasibility,minister,cost:{money:0到110,grain:0到45},effects:{stability:-6到6,army:-8到8,legitimacy:-4到4,corruption:-7到7,tech:0到4,navy:0到4,frontier:-6到6},target,regional:{unrest:-12到12,drought:-10到10,prosperity:-8到8},domain八方向之一,project:null或{months:2到12,effects:{tech:0到12,army:0到12,navy:0到14,stability:0到6,corruption:-9到0}}。新设、改组、裁撤机构须在plan内另给institutionChanges数组，operation为create_agency/amend_agency/dissolve_agency/abolish_cabinet/restore_cabinet，新设或改组有name、mandate、domain、powers(research/execution/oversight/coordination最多三项)、budget(0到20)，改组裁撤给target现有id。新设机构可在 create_agency 中给 leader（可任用人物id），设署时可同步任命，起用费仍计入。也可另列 agency 引用新署名称，系统会合并设署任命。已有机构可按需要更换主官，费用照计。新任务负责人应随其创建的 edict/action 给 official；不能凭空将一段名称当成已有 project。招安须在plan给recruitment:{target:talents中的id或null,name,region,amnesty,retainForces,grant:12到80,grain:5到40}；下月才回复，不能直接把独立首领任为主官。人物和地区可用消息中给定的id或原名，不得虚构已存在的人才或机构。能用现有操作完成时优先现有操作，避免把明确任命写成无实效的新研究。'+
  '最后重申输出：顶层必须是一个JSON对象，含reply非空中文字符串、commands数组，禁止仅输出数组。reply必须回应陛下的垂询，即使没有拟办事项也要给出有内容的中文答复，此时commands为[]。完整格式示例：{"reply":"臣拟请毕自严主持户部，先核钱粮账目。能否执行以系统核验为准。","commands":[{"type":"office","office":"revenue","official":"bi"}]}。商议示例：{"reply":"先赈济饥民，再修水利；若钱粮不足，可先缩小试点。","commands":[]}。';
}
