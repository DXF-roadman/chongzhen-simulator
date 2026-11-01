import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../engine.mjs';
import {snapshotState,restoreState} from '../state-store.mjs';
import {executeCommands} from '../counsel.mjs';
import {preparePetitionCommands} from '../petition-counsel.mjs';
import {budgetFromPetitionText,petitionBudget} from '../petition-budget.mjs';
const rich=()=>({...g.createGame({seed:991}),money:5000,grain:5000}),month=s=>g.advance({...s,event:null}),near=(a,b)=>assert.ok(Math.abs(a-b)<.0001,`${a} != ${b}`);
function draft(s,extra={}){return {text:'先办最急之事，余款待议',eventId:s.event.id,eventTurn:s.turn,gameId:s.id,budget:{money:3,grain:5},...extra};}
test('参考方案可少拨、自定钱粮，无自动督办差旅、全额成果或重复批复',()=>{
 let s=rich();s.event.options[0]={label:'原案救急',cost:{money:18,grain:25},effects:{stability:6,legitimacy:-2},regional:{unrest:-12},region:'shaanxi',knowledge:6};
 const q=g.preparePetition(s,draft(s,{reference:0,official:'bi'}));near(q.coverage,1/6);assert.equal(q.actual.money,3);const n=g.applyPetition(s,q);near(n.money,s.money-3);near(n.grain,s.grain-5);near(n.stability,s.stability+1);near(n.legitimacy,s.legitimacy-2);const a=n.affairs.at(-1);assert.equal(a.expensesIncluded,true);assert.equal(g.forecast(n).entries.find(e=>e.id==='affair:'+a.id)?.money||0,0);assert.deepEqual(restoreState(n),n);assert.throws(()=>g.applyPetition(n,q),/已经批复/);s=month(n);snapshotState(s);
});
test('零预算批复不产生实物成果、免费研究积累或隐藏月费',()=>{
 const s=rich(),q=g.preparePetition(s,draft(s,{budget:{money:0,grain:0}}),{title:'查灾后赈济',narrative:'先核灾，再按物资救急。',cost:{money:12,grain:10},effects:{stability:3},domain:'agriculture',project:{months:2,effects:{stability:5}}});
 let n=g.applyPetition(s,q);assert.equal(n.money,s.money);assert.equal(n.grain,s.grain);assert.equal(n.stability,s.stability);assert.equal(n.projects.length,0);assert.equal(n.affairs.at(-1).scopeScale,0);assert.match(q.summary,/不会自动追扣/);n=month(month(n));assert.equal(n.technology.agriculture,0);snapshotState(n);
});
test('自拟新办法按批准金额缩小成果，工程积累按比例且存档不丢失',()=>{
 const s=rich(),q=g.preparePetition(s,draft(s,{budget:{money:1,grain:0}}),{title:'核查账册',narrative:'只核两县',cost:{money:2},effects:{},domain:'finance',project:{months:2,effects:{corruption:-4}}});let n=g.applyPetition(s,q);near(n.projects[0].effects.corruption,-2);near(n.projects[0].knowledgeGain,6);assert.deepEqual(restoreState(n),n);n=month(month(n));assert.equal(n.projects.length,0);assert.equal(n.technology.finance,6);snapshotState(n);
});
test('月拨可代替首拨，按缺口推进、期限到期停办且不再扣费',()=>{
 const s=rich();s.event.options[0]={label:'分月赈济',cost:{money:20,grain:10},effects:{stability:6}};const q=g.preparePetition(s,draft(s,{reference:0,workMonths:2,budget:{money:0,grain:0,monthly:{money:5,grain:2.5},months:2}}));let n=g.applyPetition(s,q),id=n.projects[0].id;assert.equal(n.money,s.money);assert.equal(n.stability,s.stability);near(n.projects[0].monthly.required.money,10);n=month(n);near(n.ledger.entries.find(e=>e.id==='project:'+id).actualMoney,5);assert.ok(n.projects[0].remaining>0);n=month(n);assert.equal(n.projects[0].monthly.remaining,0);const remaining=n.projects[0].remaining;n=month(n);assert.equal(n.projects[0].remaining,remaining);near(n.ledger.entries.find(e=>e.id==='project:'+id).actualMoney,0);assert.deepEqual(restoreState(n),n);
});
test('首拨与经常月费的需求相加，结案不会把建设费永久当月费扣',()=>{
 const s=rich(),q=g.preparePetition(s,draft(s,{workMonths:2,budget:{money:0,grain:0,monthly:{money:20,grain:0},retain:true}}),{title:'核账',narrative:'清点后日常查核',cost:{money:10},domain:'finance',project:{months:2,effects:{corruption:-2}},monthly:{money:2,effects:{corruption:-.2},retain:true}});
 near(q.plan.monthly.required.money,7);let n=g.applyPetition(s,q);n=month(month(n));assert.equal(n.projects.length,0);near(n.monthlyPolicies[0].monthly.required.money,2);near(g.forecast(n).entries.find(e=>e.group==='policy').money,2);snapshotState(n);
});
test('留中旧案自拟批复不会覆盖当月新奏报，过期旨意不动状态',()=>{
 let s=g.advance(g.resolveEvent(rich(),-1));s.event={...structuredClone(g.EVENTS.find(e=>e.id==='border')),leader:null};const held=s.affairs.find(a=>a.petition),current=structuredClone(s.event);const d={text:'先记名册',budget:{money:0,grain:0},petition:held.id,eventId:held.petition.id,eventTurn:s.turn,reference:1};
 const q=g.preparePetition(s,d);s=g.applyPetition(s,q);assert.deepEqual(s.event,current);assert.ok(!s.affairs.some(a=>a.id===held.id));snapshotState(s);assert.throws(()=>g.preparePetition(s,d),/已经批复/);assert.throws(()=>g.preparePetition(s,{...d,petition:null,eventId:current.id,eventTurn:s.turn-1}),/局势已改变/);
});
test('指定参考预算从自然语言解析，AI 附带费用和无关操作不能越权',()=>{
 const s=rich(),b=budgetFromPetitionText('第一方案首拨三万两，拨粮五万石；每月拨二万两，为期三个月');assert.deepEqual(b,{money:3,grain:5,monthly:{money:2,grain:0},months:3,retain:false});assert.throws(()=>petitionBudget({monthly:'随便'}),/格式/);
 const r=preparePetitionCommands(s,[{type:'event',index:0}],{input:'第一方案改为先拨三万两，拨粮五万石'});assert.equal(r.commands[0].custom.draft.budget.money,3);const n=executeCommands(s,r.commands).state;assert.ok(n.money>=s.money-3);snapshotState(n);assert.throws(()=>preparePetitionCommands(s,[{type:'edict'},{type:'office'}],{draft:draft(s)}),/独立事项/);
});
test('自拟预算不足不会把完整开海税源重新推断回来',()=>{
 const s=rich(),q=g.preparePetition(s,draft(s,{text:'泉州开海通商征税，千两官抽其三，万两官抽其五',budget:{money:1,grain:0}}));assert.ok(q.source.economic);assert.ok(!q.plan.economic);let n=g.applyPetition(s,q);assert.ok(!n.projects[0].economic);for(let i=0;i<4;i++)n=month(n);assert.equal(n.economy.customs.length,0);snapshotState(n);
});
test('新机构的经常费用须在本案月拨授权内；模型不能伪造零需求月费',()=>{
 const s=rich(),d=draft(s,{text:'设立赈务专办，负责赈济灾民',budget:{money:0,grain:0}}),p={institutionChanges:[{operation:'create_agency',name:'赈务专办',domain:'agriculture',mandate:'赈济灾民',powers:['execution'],budget:2}]};
 const q=g.preparePetition(s,d,p);assert.equal(q.canExecute,false);assert.match(q.blocked.join(' '),/新增月费/);assert.throws(()=>g.applyPetition(s,q),/新增月费/);assert.equal(s.agencies.length,0);
 const paid=g.preparePetition(s,{...d,budget:{money:0,grain:0,monthly:{money:10,grain:0}}},p);assert.equal(paid.canExecute,true,paid.blocked.join(' '));const n=g.applyPetition(s,paid);assert.equal(n.agencies.at(-1).name,'赈务专办');assert.equal(n.money,s.money);snapshotState(n);
 const routine=g.preparePetition(s,draft(s,{budget:{money:0,grain:0,monthly:{money:1,grain:0}}}),{title:'日常核查',narrative:'逐月核验',cost:{money:0},effects:{},monthly:{money:10,effects:{corruption:-1},required:{money:0,grain:0}}});assert.equal(routine.plan.monthly.required.money,10);
});
test('完全缺少必需粮款时不空扣另一项月费，明确补拨后才开工',()=>{
 const s=rich();s.event.options[0]={label:'救济',cost:{money:20,grain:10},effects:{stability:6}};const q=g.preparePetition(s,draft(s,{reference:0,budget:{money:0,grain:0,monthly:{money:5,grain:0}}}));assert.match(q.summary,/暂不支用月费/);let n=g.applyPetition(s,q),id=n.projects[0].id;n=month(n);assert.equal(n.projects[0].remaining,2);assert.equal(n.ledger.entries.find(e=>e.id==='project:'+id).actualMoney,0);n=g.setMonthly(n,{kind:'project',target:id,monthly:{grain:2.5}});assert.equal(n.projects[0].monthly.paused,false);n=month(n);assert.ok(n.projects[0].workCredit>0);assert.equal(n.ledger.entries.find(e=>e.id==='project:'+id).actualMoney,5);snapshotState(n);
});
