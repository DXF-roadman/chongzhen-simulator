import {randomUUID} from 'node:crypto';
import {chineseNumber} from './fiscal-rules.mjs';
export const HORIZONS={short:'短期',medium:'中期',long:'长期'};
const defaults={short:3,medium:12,long:36},statuses=['deferred','started','done','cancelled'];
const metrics=['money','grain','stability','army','legitimacy','corruption','tech','navy','frontier'];
const clean=(v,n=500)=>String(v??'').trim().slice(0,n),key=v=>clean(v).replace(/[“”「」\s]/g,'');
const integer=v=>Number.isSafeInteger(v),validDate=v=>integer(v)&&v>=1628*12&&v<=3000*12+11;
export const gameMonth=s=>s.year*12+s.month-1;
export const monthLabel=v=>Math.floor(v/12)+'年'+(v%12+1)+'月';
function snapshot(s,people=[]){return {stats:Object.fromEntries(metrics.map(k=>[k,Math.round(s[k]*10)/10])),territories:s.provinces.map(p=>({id:p.id,name:p.name})),places:Object.keys(s.atlas?.discoveries||{}),agencies:(s.agencies||[]).map(a=>a.name),people:people.filter(o=>o.currentPosts?.length).slice(0,40).map(o=>({name:o.name,posts:o.currentPosts.slice(0,10)}))};}
const newYear=s=>({year:s.year,startMonth:s.month,opening:snapshot(s),months:0,revenue:0,expenses:0,harvest:0,grainUse:0,counts:{},events:[]});
export function initializeRecords(s){s.planning=[];s.planningReminders=[];s.annualReports=[];s.yearRecord=newYear(s);}
function yearRecord(s){if(!s.yearRecord||s.yearRecord.year!==s.year)s.yearRecord=newYear(s);return s.yearRecord;}
export function saveMemo(s,raw,{manual=false,source=null,allowDeadlineChange=false}={}){
 s.planning||=[];const title=clean(raw?.title,90),horizon=Object.hasOwn(HORIZONS,raw?.horizon)?raw.horizon:'medium';
 if(title.length<2)throw Error('规划目标至少需要两个字。');
 let old=raw.id?s.planning.find(p=>p.id===raw.id):s.planning.find(p=>key(p.title)===key(title)&&p.horizon===horizon&&p.status!=='cancelled');
 if(manual&&raw.id&&!old)throw Error('该备忘已变化，请刷新后重试。');
 if(!old&&s.planning.length>=120)throw Error('备忘录已满，请先整理已完成或搁置的规划。');
 if(raw.dueMonths!==undefined&&(!integer(raw.dueMonths)||raw.dueMonths<0||raw.dueMonths>1200)||raw.deadline!==undefined&&!validDate(raw.deadline)||raw.dueYear!==undefined&&(!integer(raw.dueYear)||!integer(raw.dueMonth)||raw.dueMonth<1||raw.dueMonth>12))throw Error('规划提醒日期无效。');
 const explicit=validDate(raw.deadline)||integer(raw.dueMonths)||integer(raw.dueYear)&&integer(raw.dueMonth);
 let deadline=validDate(raw.deadline)?raw.deadline:integer(raw.dueYear)&&integer(raw.dueMonth)&&raw.dueMonth>=1&&raw.dueMonth<=12?raw.dueYear*12+raw.dueMonth-1:gameMonth(s)+(integer(raw.dueMonths)&&raw.dueMonths>=0&&raw.dueMonths<=1200?raw.dueMonths:defaults[horizon]);
 if(!validDate(deadline))throw Error('规划提醒日期无效。');
 if(old&&!manual&&!allowDeadlineChange)deadline=old.deadline;
 const requirements=(Array.isArray(raw.requirements)?raw.requirements:clean(raw.requirements,800).split(/[\n；;]/)).map(v=>clean(v,140)).filter(Boolean).slice(0,6);
 const memo={id:old?.id||randomUUID(),title,horizon,body:clean(raw.body??raw.description??old?.body,800),reason:clean(raw.reason||old?.reason||'条件尚需落实，届期重新核验。',320),requirements:manual?requirements:requirements.length?requirements:old?.requirements||[],deadline,estimated:old&&deadline===old.deadline?old.estimated:!explicit,status:old?.status||'deferred',createdAt:old?.createdAt??gameMonth(s),updatedAt:gameMonth(s),source:old?.source||source,touched:manual||old?.touched||false,lastRemindedDeadline:old&&old.deadline===deadline?old.lastRemindedDeadline:null,linkedProjects:old?.linkedProjects||[]};
 if(old)Object.assign(old,memo);else s.planning.push(memo);return old||memo;
}

export const planningRequest=input=>/(?:规划|计划|目标|备忘|短期|中期|长期)/.test(input)&&/(?:制定|建立|设立|明定|记录|记入|存入|录入|纳入|列入|保存|定下)/.test(input)&&!/不要.{0,6}(?:制定|记录|备忘)|只是假设/.test(input);
export const planningSaveRequest=input=>/(?:存入|记入|录入|纳入|列入|保存|写入).{0,12}(?:规划|计划|备忘)|(?:规划|计划|待办).{0,12}(?:入册|存档|保存)/.test(input)&&!/不要|暂不/.test(input);
const horizonOf=v=>({short:'short',medium:'medium',long:'long',短期:'short',中期:'medium',长期:'long','short-term':'short','mid-term':'medium','long-term':'long'}[v]);
function normalizedMemo(raw){
 const r={...raw,title:raw.title||raw.name||raw.goal,horizon:horizonOf(raw.horizon||raw.phase||raw.period)||'medium'};
 for(const k of ['dueMonths','dueYear','dueMonth'])if(typeof r[k]==='string'){const m=r[k].match(/[零〇一二两三四五六七八九十百千万\d]+/);if(m)r[k]=chineseNumber(m[0]);}
 if(!r.title&&r.body)r.title=clean(r.body,70);if(!r.body&&r.description)r.body=r.description;
 if(!Array.isArray(r.requirements)&&typeof r.conditions==='string')r.requirements=r.conditions.split(/[；;\n]/);
 return r;
}
export function extractDeferredPlanning(reply,{explicit=false}={}){
 const text=clean(reply,5000).replace(/\*\*|__/g,'').replace(/^[ \t]*[#>*-]+\s*/gm,''),result=[],headings=[...text.matchAll(/(?:^|\n)\s*(?:[一二三四1234][、.．]\s*)?[【（(]?\s*(短期|中期|长期)[】）)]?(?:[（(][^\n）)]{0,25}[）)])?\s*[：:、]/g)];
 const waiting=/暂缓|暂时|待.{0,35}(?:再|方|后)|尚不|不能.{0,10}立即|条件不足|钱粮不足|以后|将来|先不|须待|需.{0,10}(?:积累|准备)/;
 function add(body,phase,title){
  if(!explicit&&!waiting.test(body))return;title=clean(title,90).replace(/一项.*$|(?:定作|定为|属|作为|列为).*$/,'').replace(/为[三四五六七八九十\d]+.{0,3}年.*$/,'').trim();
  if(title.length<2||/^(?:臣请|臣另|陛下|至于|诸项|此项|另立|将方才)/.test(title))return;
  const due=body.match(/([零〇一二两三四五六七八九十\d]+)个?月(?:为期|内(?:复议|检验|核验|结|完成))|(?:限|期限为?|复议期为?)\s*([零〇一二两三四五六七八九十\d]+)个?月/);
  result.push({title,horizon:horizonOf(phase)||'long',body:clean(body,800),reason:body.match(/(?:须待|待|尚需|条件不足|钱粮不足)[^。；\n]{2,180}/)?.[0]||'按议定期限与条件复议，尚未自动颁令。',...(due?{dueMonths:chineseNumber(due[1]||due[2])}:{})});
 }
 for(let i=0;i<headings.length;i++){const h=headings[i],body=text.slice(h.index,headings[i+1]?.index??text.length).trim(),detail=text.slice(h.index+h[0].length,headings[i+1]?.index??text.length).trim();add(body,h[1],detail.split(/[。；\n]/)[0]);}
 for(const body of text.split(/[；;]|\n\s*\n/).map(x=>x.trim()).filter(Boolean)){
  if(/^(?:[一二三四1234][、.．]\s*)?[【（(]?\s*(短期|中期|长期)[】）)]?\s*[：:、（(]/.test(body))continue;
  const phase=body.match(/短期|中期|长期/),years=body.match(/为[三四五六七八九十\d]+.{0,3}年之(?:图|计)/);if(!phase&&!years)continue;
  const prefix=body.slice(0,(phase||years).index).replace(/(?:一项[，,]?|定作|定为|作为|列为|属|为)\s*$/,'');add(body,phase?.[0]||'long',prefix);
 }
 return result.filter((p,i,a)=>a.findIndex(q=>key(q.title)===key(p.title)&&q.horizon===p.horizon)===i).slice(0,6);
}
const workKey=t=>key(t).replace(/^竣工[·：:]?/,'').replace(/以工代赈|试修|试点|筹备|一项|工程/g,'');
function linkRecordedWork(s,memo){
 if(memo.touched||memo.status==='cancelled')return;const title=workKey(memo.title);if(title.length<4)return;
 const match=name=>{const nameKey=workKey(name);return nameKey.includes(title)||title.includes(nameKey)&&nameKey.length>=4;};
 const projects=s.projects.filter(p=>match(p.name));if(projects.length){memo.status='started';memo.linkedProjects=projects.map(p=>p.id);return;}
 if(s.history.some(h=>h.title.startsWith('竣工')&&match(h.title)))memo.status='done';
}
export function capturePlanning(s,raw,reply,{source=null,input='',history=[]}={}){
 if(/不要.{0,5}(?:记录|备忘)|不加入备忘|只是假设|不要制定/.test(input))return [];
 const explicit=planningRequest(input),entries=Array.isArray(raw)&&raw.length?raw.slice(0,6):extractDeferredPlanning(reply,{explicit});
 if(!entries.length&&planningSaveRequest(input)){const previous=history.findLast(m=>m.role==='assistant'&&extractDeferredPlanning(m.content,{explicit:true}).length);if(previous)entries.push(...extractDeferredPlanning(previous.content,{explicit:true}));}
 const saved=[],warnings=[];for(const item of entries){try{if(!item||typeof item!=='object')continue;const memo=saveMemo(s,normalizedMemo(item),{source,allowDeadlineChange:/延期|推迟|改到|调整.{0,8}期限/.test(input)});linkRecordedWork(s,memo);saved.push(memo);}catch(e){warnings.push(e.message);}}
 Object.defineProperty(saved,'warnings',{value:warnings});return saved;
}
export function restoreRecordedPlanning(s){
 const restored=[];for(const thread of s.discussions||[])for(let i=1;i<thread.messages.length;i++){const message=thread.messages[i],input=thread.messages[i-1];if(message.role!=='assistant'||input.role!=='user'||!planningSaveRequest(input.content))continue;
  const base=gameMonth(s)-Math.max(0,s.turn-message.turn),context={...s,year:Math.floor(base/12),month:base%12+1};
  const entries=capturePlanning(context,null,message.content,{source:{thread:thread.id,messageId:message.id},input:input.content,history:thread.messages.slice(0,i-1)});s.planning=context.planning;for(const p of entries){p.updatedAt=gameMonth(s);if(!restored.some(x=>x.id===p.id))restored.push(p);}
 }return restored;
}

export function prunePlanningSources(s,removedIds){
 const removed=new Set(removedIds);s.planning=(s.planning||[]).filter(p=>!(p.status==='deferred'&&!p.touched&&removed.has(p.source?.messageId)));
 const valid=new Set(s.planning.map(p=>p.id));for(const r of s.planningReminders||[]){r.planIds=r.planIds.filter(id=>valid.has(id));if(!r.planIds.length)r.status='cancelled';}
}
export function setMemoStatus(s,id,status){const p=s.planning.find(p=>p.id===id);if(!p)throw Error('规划备忘不存在。');if(!statuses.includes(status))throw Error('规划状态无效。');p.status=status;p.touched=true;p.updatedAt=gameMonth(s);if(status==='deferred')p.lastRemindedDeadline=null;return p;}
export function startMemo(s,id,projectIds=[]){const p=s.planning.find(p=>p.id===id);if(!p)return;p.status='started';p.linkedProjects=[...new Set([...p.linkedProjects,...projectIds])].slice(0,12);p.updatedAt=gameMonth(s);}
export const duePlans=s=>(s.planning||[]).filter(p=>p.status==='deferred'&&p.deadline<=gameMonth(s));
export const unremindedPlans=s=>duePlans(s).filter(p=>p.lastRemindedDeadline!==p.deadline);
export function claimReminder(s){
 const plans=unremindedPlans(s);if(!plans.length)return null;
 for(const p of plans)p.lastRemindedDeadline=p.deadline;
 const notice={id:randomUUID(),at:gameMonth(s),planIds:plans.map(p=>p.id),status:'pending',source:'system',text:'到期规划：'+plans.map(p=>p.title).join('、')+'。仍需核验条件并由陛下决定是否实施，尚未自动颁令。'};
 s.planningReminders||=[];s.planningReminders.unshift(notice);s.planningReminders=s.planningReminders.slice(0,24);return notice;
}
export function completeReminder(s,id,text,source='system'){const r=s.planningReminders.find(r=>r.id===id);if(!r||r.status==='cancelled')return null;r.text=clean(text,3500);r.source=source==='ai'?'ai':'system';r.status='ready';return r;}
export function recordYearEvent(s,entry){
 const r=yearRecord(s);if(entry.type==='month')return;r.counts[entry.type]=(r.counts[entry.type]||0)+1;r.events.push({date:entry.date,title:clean(entry.title,100),text:clean(entry.text,240),type:entry.type});r.events=r.events.slice(-60);
}
export function settleYear(s,forecast,people=[]){
 const r=yearRecord(s);r.months++;for(const [k,f]of [['revenue','revenue'],['expenses','expenses'],['harvest','harvest'],['grainUse','grainUse']])r[k]+=forecast[f]||0;
 if(s.month!==12)return null;
 const report={year:s.year,startMonth:r.startMonth,months:r.months,complete:r.startMonth===1&&r.months===12,opening:r.opening,closing:snapshot(s,people),revenue:r.revenue,expenses:r.expenses,harvest:r.harvest,grainUse:r.grainUse,counts:r.counts,events:r.events.filter(e=>e.type!=='system').slice(-14),pendingProjects:s.projects.slice(0,16).map(p=>({name:p.name,remaining:p.remaining})),pendingPlans:(s.planning||[]).filter(p=>['deferred','started'].includes(p.status)).slice(0,20).map(p=>({title:p.title,horizon:p.horizon,deadline:p.deadline,status:p.status}))};
 s.annualReports||=[];s.annualReports=[report,...s.annualReports.filter(x=>x.year!==report.year)].slice(0,40);return report;
}
export function beginYear(s){s.yearRecord=newYear(s);}
function assertSnapshot(v){if(!v||!v.stats)throw Error('年度统计快照无效。');for(const k of metrics)if(!Number.isFinite(v.stats[k])||v.stats[k]<0||(!['money','grain'].includes(k)&&v.stats[k]>100))throw Error('年度统计数值无效。');if(!Array.isArray(v.territories)||v.territories.length>60||!Array.isArray(v.places)||v.places.length>60||!Array.isArray(v.agencies)||v.agencies.length>8||!Array.isArray(v.people)||v.people.length>40)throw Error('年度统计名录无效。');return {stats:Object.fromEntries(metrics.map(k=>[k,v.stats[k]])),territories:v.territories.map(x=>({id:clean(x.id,80),name:clean(x.name,80)})),places:v.places.map(x=>clean(x,80)),agencies:v.agencies.map(x=>clean(x,80)),people:v.people.map(x=>({name:clean(x.name,40),posts:(Array.isArray(x.posts)?x.posts:[]).slice(0,10).map(x=>clean(x,100))}))};}
function assertFlow(v){for(const k of ['year','startMonth','months'])if(!integer(v[k]))throw Error('年度统计日期无效。');if(v.year<1628||v.year>3000||v.startMonth<1||v.startMonth>12||v.months<0||v.months>12)throw Error('年度统计日期无效。');for(const k of ['revenue','expenses','harvest','grainUse'])if(!Number.isFinite(v[k])||v[k]<0)throw Error('年度收支无效。');if(!Array.isArray(v.events)||v.events.length>60||!v.counts||typeof v.counts!=='object'||Array.isArray(v.counts)||Object.values(v.counts).some(n=>!integer(n)||n<0))throw Error('年度纪事无效。');return {year:v.year,startMonth:v.startMonth,months:v.months,revenue:v.revenue,expenses:v.expenses,harvest:v.harvest,grainUse:v.grainUse,counts:Object.fromEntries(Object.entries(v.counts).slice(0,20).map(([k,n])=>[clean(k,30),n])),events:v.events.map(e=>({date:clean(e.date,40),title:clean(e.title,100),text:clean(e.text,240),type:clean(e.type,30)}))};}
export function validateRecords(raw,s){
 const plans=raw.planning||[];if(!Array.isArray(plans)||plans.length>120||new Set(plans.map(p=>p.id)).size!==plans.length)throw Error('规划备忘列表无效。');
 s.planning=plans.map(p=>{if(typeof p.id!=='string'||!/^[\w-]{1,80}$/.test(p.id)||!(Object.hasOwn(HORIZONS,p.horizon))||!statuses.includes(p.status)||!validDate(p.deadline)||!validDate(p.createdAt)||!validDate(p.updatedAt)||p.lastRemindedDeadline!==null&&!validDate(p.lastRemindedDeadline)||!Array.isArray(p.requirements)||p.requirements.length>6||!Array.isArray(p.linkedProjects)||p.linkedProjects.length>12)throw Error('规划备忘字段无效。');return {id:p.id,title:clean(p.title,90),horizon:p.horizon,body:clean(p.body,800),reason:clean(p.reason,320),requirements:p.requirements.map(x=>clean(x,140)),deadline:p.deadline,estimated:p.estimated===true,status:p.status,createdAt:p.createdAt,updatedAt:p.updatedAt,source:p.source?{thread:clean(p.source.thread,80),messageId:clean(p.source.messageId,80)}:null,touched:p.touched===true,lastRemindedDeadline:p.lastRemindedDeadline,linkedProjects:p.linkedProjects.map(x=>clean(x,90))};});
 const notices=raw.planningReminders||[];if(!Array.isArray(notices)||notices.length>24||new Set(notices.map(r=>r.id)).size!==notices.length)throw Error('规划提醒列表无效。');s.planningReminders=notices.map(r=>{if(typeof r.id!=='string'||!/^[\w-]{1,80}$/.test(r.id)||!validDate(r.at)||!['pending','ready','cancelled'].includes(r.status)||!Array.isArray(r.planIds)||r.planIds.length>120)throw Error('规划提醒无效。');return {id:r.id,at:r.at,planIds:r.planIds.map(x=>clean(x,80)).filter(id=>s.planning.some(p=>p.id===id)),status:r.status,source:r.source==='ai'?'ai':'system',text:clean(r.text,3500)};});
 if(raw.yearRecord){const v=raw.yearRecord;s.yearRecord={...assertFlow(v),opening:assertSnapshot(v.opening)};if(s.yearRecord.year!==s.year)s.yearRecord=newYear(s);}else s.yearRecord=newYear(s);
 const reports=raw.annualReports||[];if(!Array.isArray(reports)||reports.length>40||new Set(reports.map(r=>r.year)).size!==reports.length)throw Error('年度总结列表无效。');
 s.annualReports=reports.map(v=>({...assertFlow(v),complete:v.complete===true,opening:assertSnapshot(v.opening),closing:assertSnapshot(v.closing),pendingProjects:(Array.isArray(v.pendingProjects)?v.pendingProjects:[]).slice(0,16).map(p=>({name:clean(p.name,100),remaining:Math.max(0,Math.min(12,Number(p.remaining)||0))})),pendingPlans:(Array.isArray(v.pendingPlans)?v.pendingPlans:[]).slice(0,20).map(p=>({title:clean(p.title,90),horizon:Object.hasOwn(HORIZONS,p.horizon)?p.horizon:'medium',deadline:validDate(p.deadline)?p.deadline:gameMonth(s),status:statuses.includes(p.status)?p.status:'deferred'}))}));
}
