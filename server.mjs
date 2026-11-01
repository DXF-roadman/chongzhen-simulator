import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes, randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import * as game from './engine.mjs';
import {privacyView,privateDisclosure,registerPrivateKnowledge,explicitPublicDisclosure} from './privacy-rules.mjs';
import {prepareUnitCommands,newUnitRequest} from './unit-orders.mjs';
import {preparePetitionCommands} from './petition-counsel.mjs';
import {budgetFromPetitionText} from './petition-budget.mjs';
import {StateStore,restoreState,atomicJSON as atomic} from './state-store.mjs';
import {counselTargets,counselPrompt,buildCounselMessages,buildAcceptanceMessages,localCounsel,factualCounsel,cleanCommands,readCounselReply,executeCommands,isOrder,acceptsProposal,lastProposal,lastSubstantiveReply,isRepairableCommandError} from './counsel.mjs';
import {appendDiscussion,discussionRevision,cutDiscussion} from './dialogues.mjs';
import {fetchAIReply} from './ai-output.mjs';
import {capturePlanning,planningRequest,planningSaveRequest,extractDeferredPlanning,restoreRecordedPlanning,saveMemo,setMemoStatus,startMemo,claimReminder,completeReminder,gameMonth} from './records.mjs';
import {bindInstitutionTasks,recordInstitution} from './institution-records.mjs';
import {serviceRequest,recommendationContext,captureRecommendation,recommendationReply,claimStory,completeStory} from './civil-service.mjs';
const ROOT=path.dirname(fileURLToPath(import.meta.url));
const DATA=path.resolve(process.env.GAME_DATA_DIR||path.join(ROOT,'data')), PUBLIC=path.join(ROOT,'public');
await fs.mkdir(DATA,{recursive:true});
const PORT=Number(process.env.PORT||17628), TOKEN=randomBytes(32).toString('hex');
let state, pending=new Map(), aiBusy=false, worldEpoch=0,usage={requests:0,totalTokens:0};
const store=new StateStore(DATA);let startupError=null;
try{state=await store.open();}catch(e){startupError='存档恢复失败：'+e.message;console.error(startupError);}
let config={baseUrl:'https://api.deepseek.com',model:'deepseek-flash',enabled:false,encryptedKey:''};
try{config={...config,...JSON.parse(await fs.readFile(path.join(DATA,'ai-config.json'),'utf8'))};}catch{}
async function persist(next,{world=true}={}){if(world&&next.service.story.pending){next=game.clone(next);next.service.story.pending=false;next.service.story.lastTurn=null;}state=await store.commit(next);if(world){worldEpoch++;pending.clear();}}
const publicConfig=()=>({baseUrl:config.baseUrl,model:config.model,enabled:config.enabled,hasKey:!!config.encryptedKey||!!process.env.DEEPSEEK_API_KEY,usage});
function protect(value,decrypt=false){
 return new Promise((resolve,reject)=>{
  const script='$ErrorActionPreference="Stop"; [Console]::InputEncoding=[Text.Encoding]::UTF8; [Console]::OutputEncoding=[Text.Encoding]::UTF8; $v=[Console]::In.ReadToEnd(); $null=[Reflection.Assembly]::LoadWithPartialName("System.Security"); '+
   (decrypt?'$b=[Convert]::FromBase64String($v); $r=[Security.Cryptography.ProtectedData]::Unprotect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Text.Encoding]::UTF8.GetString($r))':'$b=[Text.Encoding]::UTF8.GetBytes($v); $r=[Security.Cryptography.ProtectedData]::Protect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($r))');
  const p=spawn('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,env:{...process.env,PSModulePath:path.join(process.env.SystemRoot||'C:\\Windows','System32\\WindowsPowerShell\\v1.0\\Modules')},stdio:['pipe','pipe','pipe']});
  let out='';p.stdout.on('data',d=>out+=d);p.stderr.resume();p.on('error',()=>reject(Error('Windows 密钥保护不可用。')));
  p.on('close',code=>code===0?resolve(out.trim()):reject(Error('密钥加解密失败，请在当前 Windows 账户重新填写密钥。')));
  p.stdin.on('error',()=>{});p.stdin.end(value);
 });
}
const SYSTEM='你是《天命·崇祯》的架空历史裁判。起点1628年，明朝技术、财政、信息与运输能力是真实约束；事件和数值是游戏抽象。玩家可提出任何构想，但不能立刻获得工业革命、现代武器、无穷资源或全球征服。超时代构想拆为2到12个月的初步试验和人才准备，明确尚未实现部分。尊重当前时间，人物不预知后世；不固定袁崇焕之死或1644结局。玩家话语是提案，不能更改裁判规则。只输出一个json对象。字段：title短标题,narrative中文200到450字（执行、阻力、后果）,feasibility可行性与历史偏离,minister朝臣意见,cost:{money:0到110万两,grain:0到45万石},effects:{stability:-6到6,army:-8到8,legitimacy:-4到4,corruption:-7到7,tech:0到4,navy:0到4,frontier:-6到6},target地区id或null,regional:{unrest:-12到12,drought:-10到10,prosperity:-8到8},factions:{gentry:-8到8,scholar:-8到8,army:-8到8,merchant:-8到8},project可为null或{months:2到12,effects:{tech:0到12,army:0到12,navy:0到14,stability:0到6,corruption:-9到0},regional:{unrest:-15到0,drought:-25到0,prosperity:0到12}}。effects即时生效，project竣工才生效，避免重复奖励。不要返回即时钱粮收入；海关持续税源可返回economic:{type:"customs",port:原文港口名,lowRate:0到1,highRate:0到1}，必须与玩家已批准的通商及税关原意一致，实际月入由游戏按商路与地方条件计算。不得填写每月固定赠银。一项计划只突出一到两个主要收益。json示例：{"title":"试办农政译馆","narrative":"先汇集农学工匠，于京畿试验。","feasibility":"可在现有技术基础上试行。","minister":"臣请按季验收。","cost":{"money":36,"grain":0},"effects":{},"target":"capital","regional":{},"factions":{"scholar":-2},"project":{"months":3,"effects":{"tech":10},"regional":{}}}';
async function callAI(messages,maxTokens=2200,{plain=false,timeoutMs=90000}={}){
 const activeConfig={...config};
 const key=process.env.DEEPSEEK_API_KEY||(activeConfig.encryptedKey?await protect(activeConfig.encryptedKey,true):'');
 if(!key)throw Error('请先在 AI 设置填写 DeepSeek API Key。');
 const u=new URL(activeConfig.baseUrl);
 if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)throw Error('API 地址必须是无凭据、无参数的 HTTPS 地址。');
 return fetchAIReply(activeConfig,key,messages,maxTokens,{plain,timeoutMs,onUsage:u=>{usage.requests++;usage.totalTokens+=u.total_tokens||0;},onDiagnostic:d=>console.warn('[AI output] '+JSON.stringify(d))});
}
const response=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
async function body(req){let buf='',size=0;for await(const c of req){size+=c.length;if(size>1_000_000)throw Error('请求过大。');buf+=c.toString('utf8');}try{return buf?JSON.parse(buf):{};}catch{throw Error('无效 JSON 请求。');}}
let mutationTail=Promise.resolve();
async function mutate(fn){const p=mutationTail.then(fn);mutationTail=p.catch(()=>{});return p;}
async function route(req,res){
 const expectedHost='127.0.0.1:'+PORT;
 if(req.headers.host!==expectedHost&&req.headers.host!=='localhost:'+PORT)return response(res,403,{error:'仅允许本机访问。'});
 const u=new URL(req.url,'http://'+expectedHost);
 if(startupError&&u.pathname.startsWith('/api/'))return response(res,503,{error:startupError});
 if(req.method==='GET'&&u.pathname==='/api/bootstrap')return response(res,200,{state,administration:game.administration(state),config:publicConfig(),token:TOKEN,catalog:{actions:game.ACTIONS,equipment:game.equipmentCatalog(state),officials:game.officialCatalog(state),offices:game.coreOffices(state),meta:game.META,domains:game.TECH_DOMAINS,powers:game.POWERS,counselTargets:counselTargets(state),equipment:game.equipmentCatalog(state),categories:game.CATEGORIES,templates:game.TEMPLATES,places:game.PLACES,seaRoutes:game.SEA_ROUTES,regions:game.REGIONS,tactics:game.TACTICS},forecast:game.forecast(state)});
 if(req.method==='GET'&&u.pathname==='/api/slots')return response(res,200,await Promise.all([1,2,3].map(n=>store.slotSummary(n))));
 if(req.method==='POST'&&u.pathname.startsWith('/api/')){
  if(req.headers['x-app-token']!==TOKEN)return response(res,403,{error:'访问校验失败，请刷新页面。'});
  const origin=req.headers.origin;if(origin&&!['http://'+expectedHost,'http://localhost:'+PORT].includes(origin))return response(res,403,{error:'不允许跨站请求。'});
  const b=await body(req), route=u.pathname.slice(5);
  if(route==='counsel'){
   if(typeof b.text!=='string'||!b.text.trim()||b.text.length>2000)throw Error('议事内容需为 1 至 2000 字。');
   const snapshot=game.clone(state),epoch=worldEpoch,target=counselTargets(snapshot).find(t=>t.id===(b.target||'council'));
   if(!target)throw Error('该议事对象已经离任、离散或撤销，请改选。');
   const originalHistory=(snapshot.discussions||[]).find(t=>t.id===target.id)?.messages||[],historyStamp=JSON.stringify(originalHistory.map(m=>m.id));
   let revision=null,input=b.text.trim();
   if(b.rewrite){
    if(!['edit','regenerate'].includes(b.rewrite.action))throw Error('不支持的对话修改方式。');
    if(b.rewrite.lastMessageId!==originalHistory.at(-1)?.id)throw Error('议事记录已改变，请刷新后再修改，避免覆盖新对话。');
    revision=discussionRevision(snapshot,target.id,b.rewrite.messageId);
    if(revision.selectedRole!==(b.rewrite.action==='edit'?'user':'assistant'))throw Error('请选择要修改的原话或要重新生成的答复。');
    if(b.rewrite.action==='regenerate')input=revision.input;
    cutDiscussion(snapshot,revision);
   }
   const mode=b.rewrite?.action==='regenerate'?'discuss':b.mode,history=revision?.history||originalHistory;
   const privateStatement=privateDisclosure(snapshot,input,target,history),promptSnapshot=game.clone(snapshot);if(privateStatement)registerPrivateKnowledge(promptSnapshot,privateStatement);
   const revisedPetition=revision?originalHistory[revision.start+1]?.commands?.find(c=>c.type==='event'&&c.custom)?.custom?.draft:null;
   const suppliedPetition=b.petitionDraft||(revisedPetition?{...revisedPetition,...(budgetFromPetitionText(input)?{budget:budgetFromPetitionText(input)}:{})}:null);
   const petitionDraft=suppliedPetition?game.petitionContext(snapshot,{...suppliedPetition,text:input}).draft:null;let petitionSummary='';
   const accepting=mode!=='discuss'&&acceptsProposal(input),previous=lastSubstantiveReply(history),prepared=accepting?lastProposal(history):[];
   const unitIntent=accepting?[input,previous?.content,...prepared.filter(c=>c.type==='edict').map(c=>c.text)].filter(Boolean).join('\n'):input;
   const planRef=b.planRef||(accepting?previous?.planRef:null);
   if(planRef&&!snapshot.planning.some(p=>p.id===planRef&&['deferred','started'].includes(p.status)))throw Error('该规划已完成、搁置或不存在，请先刷新备忘录。');
   if(accepting&&!previous)throw Error('还没有可采纳的建议，请先让群臣拟定方案。');
   if(accepting&&previous.result?.status==='executed')throw Error('上项建议已经办理，未重复执行。请先提出新事项。');
   const serviceMode=!petitionDraft&&serviceRequest(snapshot,target.id,input),serviceContext=serviceMode?recommendationContext(snapshot,target.id,input):null;
   const planningMode=planningRequest(input),online=config.enabled&&!b.offline,executing=mode!=='discuss'&&(isOrder(input)||!!petitionDraft)&&!serviceMode,started=Date.now();
   const direct=game.inferWorldCommands(snapshot,input,{target:target.id}),directFiscal=game.inferFiscal(snapshot,input),directMonthly=game.inferMonthlyCommands(snapshot,input);
   const unchanged=()=>{if(epoch!==worldEpoch||state.id!==snapshot.id||serviceMode&&JSON.stringify(state.service)!==JSON.stringify(snapshot.service))throw Error('议事期间局势已改变，请重新发送；本次没有办理事项。');if(JSON.stringify((state.discussions.find(t=>t.id===target.id)?.messages||[]).map(m=>m.id))!==historyStamp)throw Error('议事记录已改变，请刷新后重试；本次没有办理事项。');};
   async function generate(repair=null){
    unchanged();if(aiBusy)throw Error('已有一项 AI 请求在进行，请稍候。');aiBusy=true;
    try{
     const discussionOnly=!executing;
     const messages=accepting?buildAcceptanceMessages(promptSnapshot,target,input,history,repair):buildCounselMessages(promptSnapshot,target,input,history,discussionOnly);
     if(newUnitRequest(unitIntent))messages.splice(-1,0,{role:'system',content:'玩家要求另建独立部队，必须用create_unit真实新增编制。禁止把已有京营、辽东军或陕西守军当占位对象；配装unit用新部队名称，系统先创建再配装。人数可按玩家原话或本次建议写needs:{infantry:人数}，不固定套数千人的模板。secret:true表示密编，institution记录隶属衙门；资金粮草由虫洞供给时funding:portal。配装数量只替换相应件数，不得缩减已有编制；不要用edict工程或虚构军备指数代替真实部队，也不擅自额外赠送银粮入库。'});
     if(petitionDraft)messages.splice(-1,0,{role:'system',content:'本轮是对指定奏报自拟批复。只拟一份本案处置方案，返回JSON {reply:朝臣自然答复,commands:[{type:"edict",text:批复原话,plan:{title,narrative,feasibility,minister,cost:{money,grain},effects:{},regional:{},domain,target,project:null或{months,effects,regional},monthly:如有持续物资需求则列{money,grain,effects:{}}}}]}。cost是达到拟定完整规模所需的真实物资估算，不能为迎合预算而假称免费达到完整成果；不要改写玩家批准的额度。程序按额度核算范围与工期。不得附带其他独立命令或虚构已办。未议定条件就说明缺口。原案及玩家明确授权：'+JSON.stringify({...game.petitionContext(snapshot,petitionDraft),budget:petitionDraft.budget})});
     if(executing&&direct.some(c=>c.type==='horizon'&&['mode','confide','resources'].includes(c.operation)))messages.splice(-1,0,{role:'system',content:'本轮玩家明确触发幻想操作，程序将优先核验以下操作，尚未执行：'+JSON.stringify(direct)+'。不得继续按普通模式否认其能力或要求银粮来源必须符合明代历史。confide 仅私下告知指定人物，不能改成向百官公开；resources 会先实际入库，后续研究等可在同批次据此编列真实支出。仍须给出原话中其他明确政策或研究的 commands，不能只在答复中说已办。原文数字单位已折为游戏万两、万石，不重复调取已入库资源。'});
     if(repair&&!accepting)messages.splice(-1,0,{role:'system',content:'前次办理数据未通过核验，整批未执行。只修正该旨意的数据依赖与缺失步骤，保留原定范围、人选及目标，不能杜撰已经存在的机构或事务，不得绕过资源与行动限制。返回完整替代 JSON。错误与原数据：'+JSON.stringify(repair)});
     if(serviceMode)messages.splice(-1,0,{role:'system',content:'本轮是向本署主官询问属员人选，尚未批准出发或扣费。只推荐以下真实名册中的合适人员，不得凭空编新身份、完成任务或自称已派出。能力不合适就说明须访求。请返回完整JSON {reply:主官的自然中文答复,commands:[],recommendations:[{person:名册id,reason:与此差事有关的实际经历,mission:一般自由差事可给{plan:普通诏令的title/narrative/cost/domain/project字段}}]}。名册中的背景与技能是本局架空人物资料；朝臣不在发言中复述程序术语。费用只针对名册中的具体任务估算。只有voyage船队才有默认启动银22粮10、每月银2粮1；地方案牍或整兵不得套船队费用。玩家已指定的monthly月拨必须保留，不得私改成另一笔启动银；普通属员不收高官起用费。实际路程、钱粮和结案以规则为准。'+JSON.stringify(serviceContext)});
     const remaining=90000-(Date.now()-started);if(remaining<=0)throw Error('AI 请求超时（90 秒），本次尚未执行。');
     return readCounselReply(await callAI(messages,accepting||repair||planningMode?6000:3800,{plain:discussionOnly&&!planningMode&&!serviceMode&&!petitionDraft&&!newUnitRequest(unitIntent),timeoutMs:remaining}));
    }finally{aiBusy=false;}
   }
   let answer;
   const factual=revision||executing?null:factualCounsel(privacyView(promptSnapshot,target).state,input,privacyView(promptSnapshot,target).history(history));
   if(petitionDraft&&(petitionDraft.reference!==null||!online))answer={reply:'请按本案批复核算实际可办范围；尚缺物资应据实回报。',commands:[],source:'system'};
   else if(factual&&!petitionDraft)answer=factual;
   else if(accepting&&prepared.length)answer={reply:'遵旨，按前议核验办理。',commands:cleanCommands(prepared),source:'system'};
   else if(!petitionDraft&&budgetFromPetitionText(input)&&previous?.result?.status!=='executed'&&previous?.commands?.length===1&&previous.commands[0].custom)answer={reply:'请按调整后的授权预算，重新核算前议处置范围。',commands:cleanCommands(previous.commands),source:'system'};
   else if(!executing&&planningSaveRequest(input)&&history.some(m=>m.role==='assistant'&&extractDeferredPlanning(m.content,{explicit:true}).length)){const proposal=history.findLast(m=>m.role==='assistant'&&extractDeferredPlanning(m.content,{explicit:true}).length);answer={reply:'按前议整理规划，具体入册目标、期限及实施状态以系统记录为准。本轮只保存备忘，不重新开工或扣费。',commands:[],planning:extractDeferredPlanning(proposal.content,{explicit:true}),source:'system'};}
   else if(online)answer=await generate();
   else if(serviceMode)answer={reply:recommendationReply(snapshot,serviceContext),commands:[],source:'offline'};
   else answer=localCounsel(snapshot,target,input,history);
   if(executing&&!petitionDraft&&direct.length){const required=direct.filter(c=>c.type==='horizon'&&['mode','confide','resources','disclose'].includes(c.operation));if(required.length&&!direct.some(c=>c.type==='horizon'&&c.operation==='disclose'))answer.commands=answer.commands.filter(c=>!(c.type==='horizon'&&c.operation==='disclose'));answer.commands=[...required,...answer.commands.filter(c=>!required.some(r=>r.type===c.type&&r.operation===c.operation))];if(!answer.commands.some(c=>['arsenal','horizon','war'].includes(c.type)))answer.commands=direct;else if(direct.some(c=>!['mode','confide','resources'].includes(c.operation))&&!answer.commands.some(c=>c.type==='arsenal'||c.type==='war'||c.type==='horizon'&&!['mode','confide','resources'].includes(c.operation)))answer.commands.push(...direct.filter(c=>!required.includes(c)));}
   if(executing&&!petitionDraft&&direct.some(c=>c.operation==='mode')&&!answer.commands.some(c=>c.type==='horizon'&&c.operation==='mode'))answer.commands.unshift({type:'horizon',operation:'mode',enabled:true});
   if(executing&&!petitionDraft&&directFiscal.length)answer.commands=[...directFiscal,...answer.commands.filter(c=>c.type!=='fiscal'&&!(c.type==='edict'&&/俸|薪|管理费|差旅/.test(c.text||'')))];
   if(!executing&&(planningMode||serviceMode))answer.commands=[];
   const normalize=()=>{answer.commands=cleanCommands(answer.commands);if(executing&&!petitionDraft){if(directMonthly.length)answer.commands=[...directMonthly,...answer.commands.filter(c=>c.type!=='edict'&&c.type!=='monthly')];answer.commands=game.prepareMonthlyCommands(snapshot,answer.commands,input);}for(const c of answer.commands)if(c.type==='event'){c.eventId??=c.petition?snapshot.affairs.find(a=>a.id===c.petition)?.petition?.id:snapshot.event?.id;c.eventTurn??=snapshot.turn;}const petitions=preparePetitionCommands(snapshot,answer.commands,{draft:petitionDraft,input,offline:!online});answer.commands=cleanCommands(petitions.commands);petitionSummary=petitions.summary;answer.commands=cleanCommands(prepareUnitCommands(snapshot,answer.commands,{input:unitIntent,target:target.id}));for(const c of answer.commands){if(c.type==='horizon'&&c.operation==='disclose'&&!explicitPublicDisclosure(unitIntent))throw Error('没有明确向百官公开来历的旨意，本次没有公开或办理。');const p=privacyView(promptSnapshot,target),hidden=promptSnapshot.militaryState.units.filter(u=>!p.state.militaryState.units.some(v=>v.id===u.id));if(hidden.some(u=>(JSON.stringify(c).includes(u.id)||JSON.stringify(c).includes(u.name))&&!unitIntent.includes(u.name)&&!unitIntent.includes(u.id)))throw Error('这份建议引用了当前交谈对象未获知的密案，尚未执行；请到原机构交办或由陛下明确交代。');}};
   normalize();
   if(executing){
    let failure;try{answer.commands=executeCommands(snapshot,answer.commands).commands;}catch(e){failure=e;}
    if(failure&&online&&isRepairableCommandError(failure)){
     answer=await generate({error:failure.message,commands:answer.commands});normalize();
     // Dry run only. The whole corrected batch is applied once under the mutation lock below.
     try{answer.commands=executeCommands(snapshot,answer.commands).commands;}catch{}
    }
   }
   return mutate(async()=>{
    unchanged();
    if(planRef&&JSON.stringify(state.planning.find(p=>p.id===planRef))!==JSON.stringify(snapshot.planning.find(p=>p.id===planRef)))throw Error('议事期间该规划已调整，请按最新备忘重新复议；本次没有办理。');
    let next=game.clone(state),result={status:'discussed',text:b.rewrite?.action==='regenerate'?'已重新拟答，仅供商议；明确照办后才执行。本次没有改变钱粮、人事或历史进度。':'仅作商议，本次没有改变钱粮、人事或历史进度。'};
    if(revision)cutDiscussion(next,revision);
    if(executing){
     try{const priorState=next,priorProjects=new Set(next.projects.map(p=>p.id)),applied=executeCommands(next,answer.commands);next=applied.state;result=applied.result;answer.commands=applied.commands;if(applied.changed&&['office:','agency:'].some(prefix=>target.id.startsWith(prefix))){bindInstitutionTasks(priorState,next,target.id);recordInstitution(next,target.id,target.name,{kind:'order',status:'executed',title:'御前交办已执行',text:result.text});}if(planRef&&applied.changed)startMemo(next,planRef,next.projects.filter(p=>!priorProjects.has(p.id)).map(p=>p.id));}
     catch(e){result={status:'blocked',text:e.message};}
    }
    let remembered=null;if(privateStatement){remembered=registerPrivateKnowledge(next,privateStatement);if(remembered.changed)next.revision++;result.text+='\n来历仅私下记入'+remembered.label+'的知情范围，未向其他机构公开；其余未执行事项仍按本轮办理记录为准。';}
    if(petitionSummary)result.text+='\n'+petitionSummary;
    if(serviceMode){const recommendations=captureRecommendation(next,target.id,input,answer.recommendations,serviceContext);answer.commands=recommendations.map(r=>({type:'service',operation:'delegate',recommendation:r.id}));if(!recommendations.length&&serviceContext.needsSearch)answer.commands=[{type:'service',operation:'seek',institution:serviceContext.institution,domain:serviceContext.domain}];result.text=recommendations.length?'本署荐举已入履历簿：'+recommendations.map(r=>next.service.people.find(p=>p.id===r.person)?.name).join('、')+'。尚未出发或扣费；明确说“让他去”或点击照此办理，才按实际任务核验。':serviceContext.needsSearch?'本署现有属员尚不适任；可批准访求，银4万两、粮2万石，下月核实回报。':'尚未议定可执行差事；请说明此人具体要办什么。';}
    if(!executing&&!serviceMode&&isOrder(input))result.text+='\n本轮处于仅商议模式，原话中的明确指令尚未办理；可点击“按这道原话办理”。';
    const thread=appendDiscussion(next,counselTargets(next).find(t=>t.id===target.id)||target,input,answer.reply,answer.commands,result,answer.source,game.dateLabel(next)),message=thread.messages.at(-1);
    if(!executing&&!serviceMode&&!petitionDraft&&isOrder(input))message.orderText=input;
    if(planRef)message.planRef=planRef;
    const memos=capturePlanning(next,answer.planning,answer.reply,{source:{thread:target.id,messageId:message.id},input,history});
    if(memos.length)message.result.text+='\n已收录规划备忘 '+memos.length+' 项：'+memos.map(p=>p.title+'（'+({deferred:'待实施',started:'已启动',done:'已完成',cancelled:'已搁置'}[p.status])+'，'+Math.floor(p.deadline/12)+'年'+(p.deadline%12+1)+'月复议）').join('；')+'。未执行的新目标不会自动颁令。';
    if(memos.warnings?.length)message.result.text+='\n部分规划未能入册：'+memos.warnings.join('；');
    if(planningMode&&!memos.length)message.result.text+='\n本次未识别出可入册的具体目标，尚未写入备忘录；请说明目标和阶段后重试。';
    if(result.status==='executed'||remembered?.changed)await persist(next);else{await persist(next,{world:false});}
    return response(res,200,{state,thread,equipment:game.equipmentCatalog(state),officials:game.officialCatalog(state),offices:game.coreOffices(state),counselTargets:counselTargets(state),administration:game.administration(state),forecast:game.forecast(state),config:publicConfig()});
   });
  }
  if(route==='development-story'){
   const claimed=await mutate(async()=>{if(aiBusy)return null;const next=game.clone(state),context=claimStory(next);if(!context)return null;await persist(next,{world:false});return {context,epoch:worldEpoch,id:next.id,turn:next.turn};});
   if(!claimed)return response(res,200,{state,config:publicConfig()});
   let raw=null,source='system';
   if(config.enabled&&!b.offline&&!aiBusy){aiBusy=true;try{raw=await callAI([{role:'system',content:'你是明末架空历史游戏的后续奏报编写者。根据本局真实的发展方向与已完成事项，只有本次新成果或差遣回报带来实际新问题，才拟下一阶段的地方阻力、用人或工艺检验；既有问题尚在处理或没有新变化时返回JSON {noNewReport:true}，不要为凑每季度剧情反复催同一件事。已完成或已决定暂缓的旧事项不得换个标题重复立案。承认玩家已经取得的成果；不把未来目标写成已实现，不复述早已解决的旧问题。可以提出尚待核验的新线索，须明确只是线索。不得凭空增员、解锁技术、改实控或声称执行。不得主动提及玩家未使用的幻想能力。仅返回JSON {title,text,options:[{label,cost:{money,grain},effects:{}}]}，text最多350字，2至3个选择，可设money0到20、grain0到10的真实支出与极小常规国势后果；不得给钱粮收入或直接成功。至少一项可暂缓、不花钱且无收益。不要生成与已知发展无关的新大陆、现代装备或人才姓名。'},{role:'user',content:JSON.stringify(claimed.context)}],1800,{timeoutMs:45000});source='ai';}catch{}finally{aiBusy=false;}}
   return mutate(async()=>{if(state.id!==claimed.id||state.turn!==claimed.turn||worldEpoch!==claimed.epoch)return response(res,200,{state,config:publicConfig(),stale:true});const next=game.clone(state);const event=completeStory(next,raw,source);await persist(next,{world:false});return response(res,200,{state,development:event,config:publicConfig()});});
  }
  if(route==='planning-remind'){
   const claimed=await mutate(async()=>{const next=game.clone(state),notice=claimReminder(next);if(!notice)return null;await persist(next,{world:false});return {snapshot:game.clone(next),notice:game.clone(notice),epoch:worldEpoch};});
   if(!claimed)return response(res,200,{state,config:publicConfig()});
   const {snapshot,notice,epoch}=claimed;let text=notice.text,source='system';
   if(config.enabled&&!b.offline&&!aiBusy){aiBusy=true;try{
    const plans=snapshot.planning.filter(p=>notice.planIds.includes(p.id)).slice(0,12),context={date:game.dateLabel(snapshot),money:snapshot.money,grain:snapshot.grain,forecast:game.forecast(snapshot),people:game.officialCatalog(snapshot),projects:snapshot.projects,agencies:snapshot.agencies,plans};
    const answer=await callAI([{role:'system',content:'你是明末御前参议。以下规划已经到游戏内复议期限，请主动提醒陛下，并逐项目标核对现有钱粮、工期、人手与前置条件：可实施的给出具体下一步与粗略预算，条件不足的说明差额及替代步骤。只作建议，尚未颁令；不声称已经实施，不返回命令或规划数据，不要求重复批准已执行的事项，不杜撰资源。仅返回简洁中文正文，最多900字。'},{role:'user',content:JSON.stringify(context)}],2000,{plain:true});
    text=readCounselReply(answer).reply;source='ai';
   }catch(e){text+='\nAI 复议暂未完成：'+e.message+' 可在备忘录中重新请 AI 复议。';}finally{aiBusy=false;}}
   else text+='\n'+(aiBusy?'AI 正在处理其他议事，可稍后在备忘录中复议。':'当前未启用 AI，可在备忘录中启用后复议。');
   return mutate(async()=>{
    if(state.id===snapshot.id){
     const next=game.clone(state),active=next.planning.filter(p=>notice.planIds.includes(p.id)&&p.status==='deferred'&&p.deadline<=gameMonth(next)),current=next.planningReminders.find(r=>r.id===notice.id);
     if(current){
      const samePlans=active.length===notice.planIds.length&&active.every(p=>JSON.stringify(p)===JSON.stringify(snapshot.planning.find(o=>o.id===p.id)));
      if(!active.length)current.status='cancelled';
      else if(epoch===worldEpoch&&samePlans)completeReminder(next,notice.id,text,source);
      else completeReminder(next,notice.id,'到期规划：'+active.map(p=>p.title).join('、')+'。复议期间局势或规划已有变化，请按最新状态重新议事。','system');
      await persist(next,{world:false});
     }
    }
    return response(res,200,{state,config:publicConfig()});
   });
  }
  if(route==='preview'){
   if(typeof b.text!=='string'||!b.text.trim()||b.text.length>2000)throw Error('诏令需为 1 至 2000 字。');
   if(state.ended)throw Error('本局已结束。');
   const snapshot=game.clone(state);let plan;
   if(b.institutionChanges!==undefined||b.recruitment!==undefined)plan=game.specialPlan(snapshot,b.institutionChanges||[],b.recruitment||null,b.text);
   else if(config.enabled&&!b.offline){
    if(aiBusy)throw Error('已有一项 AI 推演在进行。');aiBusy=true;
    try{const context={...snapshot,yearRecord:undefined,annualReports:undefined,planningReminders:undefined,planning:snapshot.planning.filter(p=>["deferred","started"].includes(p.status)).slice(0,60),history:snapshot.history.slice(0,10),edicts:snapshot.edicts.slice(0,12),institutions:snapshot.institutions.slice(0,24)};
     const extra=game.fantasyRules(snapshot)+' 认真接受改变历史的可能：不以史实结局否定创新。计划可命名为具体制度、工艺或研究原型，保持后续积累；返回domain字段，从agriculture、industry、finance、military、naval、governance、education、medicine中选一。制度与新发明应设project，竣工后进入长期制度档案。已有technology和institutions代表这条历史已经实现的积累，后续推演必须承认其效果。';
     const institutionalRules=' 新增机构必须作为可执行制度变更，不能只写在叙事中。可返回institutionChanges数组（最多三项）。operation可为abolish_cabinet、restore_cabinet、create_agency、amend_agency、dissolve_agency。新设/改组字段name（玩家自定名，最多32字）、mandate职责说明、domain八方向之一、powers从research/execution/oversight/coordination选择最多三项、budget每月0至20万两；改组/裁撤需target现有机构id。统筹六部可授coordination，裁撤内阁不等于辞退所有各部将臣。设署筹备两个月，启动经费与持续费用由规则计算，不能承诺立即开办成功或无限人手。gov字段和agencies记录是真实制度状态；cabinet=false时不许写内阁仍在审议、票拟或指使。只废阁不另设时按六部直奏推演；不要未经玩家要求替他恢复内阁。';
     const recruitmentRules=' 人才不局限于初始六人。招安反民/武装首领须返回recruitment对象：target现有talents的id（或null）、name玩家指名的姓名/称号、region地区id、amnesty布尔（赦免普通附从）、retainForces布尔（保留旧部）、grant抚银12至80万两、grain安置粮5至40万石。不要声称交涉必然成功或当场效忠，系统于下月按条款与局势结算，受抚后观察两个月、持续付饷；可试任，忠诚与整编影响成效，违约可能再叛。可与institutionChanges同时返回。新出现的姓名须视为本局架空线索，若玩家明确指历史人物须尊重其时代和身份，不凭空召唤未出生的人。talents.status和officials、agencies的人事记录为真实状态，反叛或离散者不可当作现任忠臣。';
     const dutyRules=' 任事记录是实际差遣：government.officeLeaders为内阁及六部主官，agencies.leader为新署主官，projects.leader和affairs.leader为工程与善后负责人。不得把未任职者写成现任督办；可以兼任，三项以上分摊精力。affairs.order为已经批复的原案，不得擅改为相反政策。自由诏令指名可任用人物督办时，在叙事中尊重该差遣；具体任命仍由玩家在审阅界面确认。';
     const raw=await callAI([{role:'system',content:(snapshot.traveler.enabled?'你是架空历史游戏裁判。本局幻想能力以以下规则为准。直接时空或军备操作可返回 interventions 数组，使用与御前议事相同的 horizon/arsenal 命令结构；不用虚构研究原型。普通政策仍以 title,narrative,feasibility,minister,cost,effects,target,regional,factions,project,domain 字段返回可执行方案。':SYSTEM)+extra+institutionalRules+recruitmentRules+dutyRules},{role:'user',content:JSON.stringify({date:game.dateLabel(snapshot),administration:game.administration(snapshot),world:context,proposal:b.text})}]);plan=game.normalizeEdict(raw,snapshot,b.text);}finally{aiBusy=false;}
   }else plan=game.localEdict(snapshot,b.text);
   if(!plan)throw Error('请至少指定一项机构变更。');
   plan.leader=game.inferDutyLeader(snapshot,b.text);
   if(state.id!==snapshot.id||state.revision!==snapshot.revision)throw Error('推演期间局势已改变，请重新拟诏。');
   if(pending.size>=15)pending.clear();const id=randomUUID();pending.set(id,{plan,gameId:state.id,revision:state.revision,expires:Date.now()+600000});return response(res,200,{id,plan,config:publicConfig()});
  }
  if(route==='ai-test'){
   if(aiBusy)throw Error('已有一项 AI 请求在进行。');aiBusy=true;
   try{await callAI([{role:'system',content:'只输出 json 对象 {"ok":true}。'},{role:'user',content:'测试连接，请返回 json。'}],128);return response(res,200,{ok:true,config:publicConfig()});}finally{aiBusy=false;}
  }
  return mutate(async()=>{
   if(route==='shutdown'){response(res,200,{ok:true});server.close();server.closeIdleConnections();return;}
   if(route==='config'){
    const model=String(b.model||'deepseek-flash').trim();if(!/^[\w./:-]{1,100}$/.test(model))throw Error('模型名称无效。');
    let baseUrl;try{const parsed=new URL(b.baseUrl||'https://api.deepseek.com');if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.search||parsed.hash)throw Error();baseUrl=parsed.href.replace(/\/+$/,'');}catch{throw Error('请输入有效的 HTTPS API 根地址，例如 https://api.deepseek.com。');}
    const next={...config,model,baseUrl,enabled:b.enabled===true};if(b.clearKey)next.encryptedKey='';
    if(b.key){if(typeof b.key!=='string'||b.key.length<8||b.key.length>512)throw Error('密钥长度不正确。');next.encryptedKey=await protect(b.key.trim());}
    await atomic(path.join(DATA,'ai-config.json'),next);config=next;return response(res,200,{config:publicConfig()});
   }
   if(route==='save'){const slot=Number(b.slot);if(![1,2,3].includes(slot))throw Error('存档槽位无效');await store.saveSlot(slot,state);return response(res,200,{ok:true});}
   if(route==='load'){const slot=Number(b.slot);if(![1,2,3].includes(slot))throw Error('存档槽位无效');await persist(await store.loadSlot(slot));}
   else if(route==='counsel-delete'){const next=game.clone(state),target=b.target||'council';if(b.lastMessageId!==next.discussions.find(t=>t.id===target)?.messages.at(-1)?.id)throw Error('议事记录已改变，请刷新后再删除，避免覆盖新对话。');cutDiscussion(next,discussionRevision(next,target,b.messageId));await persist(next,{world:false});}
   else if(route==='planning-restore'){if(b.gameId!==state.id||b.revision!==state.revision)throw Error('局势已改变，请刷新后补录规划。');const next=game.clone(state);restoreRecordedPlanning(next);await persist(next,{world:false});}
   else if(route==='monthly-audit-restore'){if(b.gameId!==state.id||b.revision!==state.revision)throw Error('局势已改变，请刷新后核对月结。');await persist(game.restoreMonthlyState(state));}
   else if(route==='monthly')await persist(game.setMonthly(state,b.command));
   else if(route==='economy-restore'){if(b.gameId!==state.id||b.revision!==state.revision)throw Error('局势已改变，请刷新后校正税源。');await persist(game.restoreEconomy(state));}
   else if(route==='service-initialize'){if(b.gameId!==state.id||b.revision!==state.revision)throw Error('局势已改变，请刷新。');await persist(game.clone(state));}
   else if(route==='service')await persist(game.serviceCommand(state,b.command));
   else if(route==='fiscal')await persist(game.setFiscal(state,b.command));
   else if(route==='planning-save'||route==='planning-status'){const next=game.clone(state);if(b.gameId!==state.id)throw Error('本局已变化，请刷新后整理备忘录。');if(route==='planning-save')saveMemo(next,b.memo,{manual:true});else setMemoStatus(next,b.id,b.status);await persist(next,{world:false});}
   else if(route==='import'){await persist(restoreState(b.state));}
   else if(route==='new'){await atomic(path.join(DATA,'before-new-game.json'),state);await persist(game.createGame({mode:b.mode,traveler:b.traveler===true}));}
   else if(route==='undo-satellite'){if(b.gameId!==state.id||b.revision!==state.revision)throw Error('局势已改变，请先刷新核对，尚未撤销卫星。');await persist(game.undoSatellite(state,{previousUnlocks:b.previousUnlocks}));}
   else if(route==='intervene'){if(!b.command||!['horizon','arsenal','war'].includes(b.command.type))throw Error('不支持的干预类型。');await persist(game.intervene(state,b.command));}
   else if(route==='action')await persist(game.doAction(state,b.id,b.target,b.official));
   else if(route==='event')await persist(game.resolveEvent(state,b.index,b.official,{petition:b.petition||null}));
   else if(route==='assign-duty')await persist(game.assignDuty(state,b.kind,b.id,b.official));
   else if(route==='appoint')await persist(game.appoint(state,b.id));
   else if(route==='dismiss')await persist(game.dismiss(state,b.id));
   else if(route==='office-leader')await persist(game.assignOfficeLeader(state,b.id,b.official));
   else if(route==='agency-leader')await persist(game.assignAgencyLeader(state,b.id,b.official));
   else if(route==='agency-budget')await persist(game.setAgencyBudget(state,b.id,b.budget));
   else if(route==='policy')await persist(game.policy(state,b.tax,b.military));
   else if(route==='diplomacy')await persist(game.diplomacy(state,b.id,b.kind));
   else if(route==='advance')await persist(game.advance(state));
   else if(route==='enact'){const item=pending.get(b.id);if(!item||item.expires<Date.now()||item.gameId!==state.id||item.revision!==state.revision)throw Error('诏令方案已过期或局势已变，请重新推演。');await persist(game.applyEdict(state,item.plan,b.official));}
   else throw Error('未知操作。');
   return response(res,200,{state,equipment:game.equipmentCatalog(state),officials:game.officialCatalog(state),offices:game.coreOffices(state),counselTargets:counselTargets(state),administration:game.administration(state),forecast:game.forecast(state)});
  });
 }
 if(req.method!=='GET')return response(res,405,{error:'不支持的请求方法'});
 const files={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/style.css':'style.css','/counsel.css':'counsel.css','/campaigns.js':'campaigns.js','/frontiers.js':'frontiers.js','/frontiers.css':'frontiers.css','/unified-map.js':'unified-map.js','/simplified.css':'simplified.css','/world-land.json':'world-land.json','/world-land-LICENSE.txt':'world-land-LICENSE.txt'};
 const filename=files[u.pathname];if(!filename)return response(res,404,{error:'未找到页面'});
 const types={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',json:'application/json; charset=utf-8',txt:'text/plain; charset=utf-8'};
 const bytes=await fs.readFile(path.join(PUBLIC,filename));
 res.writeHead(200,{'Content-Type':types[filename.split('.').pop()],'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});res.end(bytes);
}
const server=http.createServer((req,res)=>{route(req,res).catch(e=>{if(!res.headersSent)response(res,400,{error:e.message?.slice(0,400)||'操作失败'});else res.end();});});
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'端口 '+PORT+' 已占用。请打开 http://127.0.0.1:'+PORT+' 或使用 PORT 环境变量选择其他端口。':'服务启动失败：'+e.code);process.exitCode=1;});
server.listen(PORT,'127.0.0.1',()=>console.log('天命 · 崇祯 已启动：http://127.0.0.1:'+PORT));
