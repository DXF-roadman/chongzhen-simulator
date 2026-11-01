import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as g from '../engine.mjs';
import {StateStore,restoreState,snapshotState,assertLedger} from '../state-store.mjs';
import {claimStory,completeStory,recommendationContext,captureRecommendation} from '../civil-service.mjs';
import {localCounsel,executeCommands} from '../counsel.mjs';
import {saveMemo,claimReminder} from '../records.mjs';
import {isPaid} from '../monthly-ledger.mjs';
const json=s=>JSON.parse(JSON.stringify(s));
const rich=()=>({...g.createGame({mode:'sandbox',seed:7300}),money:50000,grain:50000,army:85});
const exact=s=>{assert.deepEqual(snapshotState(s),json(s));assert.deepEqual(g.forecast(restoreState(s,{recover:false})),g.forecast(s));};

test('所有现有预设行动和自由诏令的批准结果均能无损存读',()=>{
 for(const a of g.ACTIONS)exact(g.doAction(rich(),a.id,a.target?'shaanxi':null));
 let s=g.createGame({seed:7301});s.unlocks.diplomacy=true;
 s=g.applyEdict(s,g.normalizeEdict({title:'海务试验',narrative:'三月后核验',domain:'naval',cost:{money:3},project:{months:3,effects:{navy:9,frontier:-4}}},s,'试办海务'));
 const restored=restoreState(s);assert.deepEqual(restored.projects,s.projects);assert.equal(restored.projects[0].effects.navy,9);exact(s);
});

test('待批奏报保留签发时的选择，已批记录、月报和结局保留',()=>{
 let s=rich();s.institutions=[{id:'legacy-0',name:'海务试点',domain:'naval',date:'正月',turn:0}];s.eventSerial=2;s.event={id:'legacy',title:'新政回响：海务试点',text:'此前已签发的海务试点回访。',category:'新法试点续报',historical:'架空分支',domain:'naval',leader:null,options:[{label:'核验',cost:{money:6},effects:{legitimacy:1}},{label:'暂缓',cost:{},effects:{}}]};assert.equal(s.event.id,'legacy');
 const event=json(s.event);s.institutions.unshift({id:'legacy-1',name:'后来农政',domain:'agriculture',date:'二月',turn:1});assert.deepEqual(restoreState(s).event,event);
 s=g.resolveEvent(s,1);exact(s);assert.deepEqual(restoreState(s).resolvedEvents,s.resolvedEvents);
 s=g.advance(s);exact(s);assert.deepEqual(restoreState(s).monthlyResults,s.monthlyResults);assert.deepEqual(restoreState(s).notices,s.notices);
 s.ended={title:'山河失守',text:'实际结局原因'};assert.deepEqual(restoreState(s).ended,s.ended);
});

test('正在生成的续报与提醒正常保存，仅加载时恢复中断请求，不自动执行',()=>{
 const s=rich();s.turn=3;s.month=4;s.institutions=[{id:'legacy-1',name:'财政试点',domain:'finance',date:'二月',turn:1}];claimStory(s);saveMemo(s,{title:'修渠复议',horizon:'short',dueMonths:0});claimReminder(s);
 assert.equal(s.service.story.pending,true);exact(s);assert.equal(snapshotState(s).planningReminders[0].status,'pending');
 const next=restoreState(s);assert.equal(next.service.story.pending,false);assert.equal(next.service.story.lastTurn,null);assert.equal(next.planningReminders[0].status,'ready');assert.equal(next.money,s.money);assert.deepEqual(next.projects,s.projects);assert.deepEqual(restoreState(next),next);
});

test('连续两年逐月保存和不中断推进得出相同国势、工程、税源、俸禄及年度账',()=>{
 let original=rich();original=g.assignOfficeLeader(original,'revenue','bi');original=g.intervene(original,{type:'war',operation:'governor',province:'liaodong',official:'yuan'});
 original=g.applyEdict(original,g.localEdict(original,'泉州开海，设税关抽分'));original=g.applyEdict(original,g.localEdict(original,'宋应星整训前线，每月拨银五万两，长期施行'),'song');saveMemo(original,{title:'来年整备',horizon:'long'});
 let loaded=restoreState(original);
 for(let n=0;n<24;n++){
  if(n===5){const p=original.monthlyPolicies[0];if(p){original=g.setMonthly(original,{kind:'policy',target:p.id,monthly:{money:2,grain:0}});loaded=g.setMonthly(loaded,{kind:'policy',target:p.id,monthly:{money:2,grain:0}});}}
  if(original.event){original=g.resolveEvent(original,1);loaded=g.resolveEvent(loaded,1);}
  original=g.advance(original);loaded=restoreState(g.advance(loaded));exact(original);assert.deepEqual(loaded,json(original));assertLedger(original);
 }
 assert.equal(original.annualReports.length,2);assert.ok(original.economy.customs.length);assert.equal(original.monthlyPolicies[0].monthly.money,2);
});

test('缺失的拨款条目不视为已付款，无主官机构仍按属员能力运作',()=>{
 assert.equal(isPaid({entries:[]},'missing'),false);
 let s=rich();s=g.applyEdict(s,g.specialPlan(s,[{operation:'create_agency',name:'试务署',domain:'education',powers:['research'],budget:4}],null,'设试务署'));
 for(let n=0;n<3;n++)s=g.advance({...s,event:null});assert.equal(s.agencies[0].funded,true);assert.equal(s.agencies[0].status,'active');assert.ok(s.technology.education>0);exact(s);
});

test('探航、生产、荐举差遣、发展续报和新领地逐阶段无损存档',()=>{
 let s=rich();s=g.intervene(s,{type:'arsenal',operation:'modernize',scope:'all'});s=g.intervene(s,{type:'arsenal',operation:'create_unit',name:'新编守军',template:'garrison'});s=g.intervene(s,{type:'horizon',operation:'voyage',route:'west'});exact(s);
 const input='找人负责陕西水利',context=recommendationContext(s,'office:works',input),r=captureRecommendation(s,'office:works',input,[],context)[0];exact(s);s=g.serviceCommand(s,{operation:'delegate',recommendation:r.id});exact(s);
 for(let n=0;n<3;n++){s=g.advance({...s,event:null});exact(s);}completeStory(s,null);exact(s);s=g.advance({...s,event:null});exact(s);
 assert.ok(s.atlas.segments.length);assert.ok(s.militaryState.lines.some(l=>l.lastOutput>0));
 s=executeCommands(rich(),localCounsel(rich(),{id:'council',name:'御前议政'},'打开虫洞，掏出高达给辽东军').commands).state;s=g.intervene(s,{type:'war',operation:'attack',target:'liaoshen',unit:'liaodong-army',tactic:'encircle'});exact(s);
 for(let n=0;n<2;n++){s=g.advance({...s,event:null});exact(s);}assert.equal(s.campaignState.control.liaoshen,'ming');s=g.intervene(s,{type:'war',operation:'governor',province:'occupied-liaoshen',official:'lu'});s=g.doAction(s,'relief','occupied-liaoshen');exact(s);
});

test('统一存储：自动档、槽位、导入往返一致；不一致写入保留原档和内存',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'chongzhen-state-'));
 try{const store=new StateStore(dir);let s=await store.open();s=g.doAction(s,'irrigation','shaanxi');await store.commit(s);await store.saveSlot(1,s);assert.deepEqual(await store.loadSlot(1),json(s));assert.deepEqual(await new StateStore(dir).open(),json(s));
  const before=await fs.readFile(store.file,'utf8'),bad=json(s);bad.accidentalShadowMoney=400;await assert.rejects(store.commit(bad),/无法完整保存/);assert.equal(await fs.readFile(store.file,'utf8'),before);assert.deepEqual(store.current,json(s));
  assert.throws(()=>restoreState(bad),/无法完整保存/,'当前格式的导入也不能悄悄丢字段');await fs.writeFile(store.slotFile(2),'{broken');assert.equal((await store.slotSummary(2)).invalid,true);assert.equal((await store.slotSummary(3)).empty,true);
  const unbalanced=g.advance({...s,event:null});unbalanced.ledger.endingMoney+=1;await assert.rejects(store.commit(unbalanced),/收支不平/);assert.equal(await fs.readFile(store.file,'utf8'),before);
  assert.ok(JSON.parse(await fs.readFile(store.previous,'utf8')).id);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});

test('坏档、未来格式及丢失主档不会悄悄新建游戏；旧档升级幂等',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'chongzhen-corrupt-'));
 try{const file=path.join(dir,'autosave.json');await fs.writeFile(file,'{broken');await assert.rejects(new StateStore(dir).open(),/原文件已保留/);assert.equal(await fs.readFile(file,'utf8'),'{broken');
  await fs.writeFile(file,JSON.stringify({...rich(),stateSchema:999}));await assert.rejects(new StateStore(dir).open(),/较新/);await fs.rename(file,path.join(dir,'autosave.previous.json'));await assert.rejects(new StateStore(dir).open(),/停止新建/);
  const old=rich();delete old.stateSchema;delete old.monthlyAuditVersion;const next=restoreState(old);assert.deepEqual(restoreState(next),next);assert.equal(next.money,old.money);assert.equal(next.month,old.month);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
