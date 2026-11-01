import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../engine.mjs';
import {executeCommands,acceptanceAdvice,buildAcceptanceMessages,isRepairableCommandError} from '../counsel.mjs';
import {prepareCommandBatch} from '../counsel-batch.mjs';
import {advice,invalidBatch,failedHistory,correctedBatch} from './batch-fixture.mjs';
test('截图中的缺机构和虚构工程不能假装办理，失败整批保留原局势',()=>{
 const s=g.createGame(),original=structuredClone(s);s.actionsLeft=2;original.actionsLeft=2;
 assert.throws(()=>executeCommands(s,invalidBatch),e=>isRepairableCommandError(e)&&/机构不存在/.test(e.message));assert.deepEqual(s,original);
 assert.throws(()=>executeCommands(s,[{type:'duty',kind:'project',target:'并不存在的宗禄工程',official:'bi'}]),/事务不存在/);assert.equal(s.projects.length,0);
});
test('新署任命与新案督办随创建合并，可处理任命排在设署前的 AI 数据',()=>{
 const s=g.createGame();s.actionsLeft=2;const original=structuredClone(correctedBatch),batch=prepareCommandBatch(s,correctedBatch);
 assert.equal(batch.length,2);assert.equal(batch[0].type,'edict');assert.equal(batch[0].plan.institutionChanges[0].leader,'bi');assert.equal(batch[0].official,'bi');assert.deepEqual(correctedBatch,original);
 const {state,commands}=executeCommands(s,correctedBatch);assert.equal(state.actionsLeft,null);assert.equal(state.agencies[0].leader,'bi');assert.equal(state.agencies[0].name,'宗禄清核使');assert.equal(state.affairs.at(-1).leader,'bi');assert.equal(state.projects.length,0);assert.equal(state.atlas.voyages.length,1);assert.equal(commands.length,2);assert.equal(g.forecast(state).agencyExpenses,4);
 assert.equal(g.validateSave(state).agencies[0].leader,'bi');assert.equal(s.agencies.length,0);
});
test('已有真实事务可纠正项目与善后类型，不能臆造同名对象',()=>{
 const s=g.applyEdict(g.createGame(),g.localEdict(g.createGame(),'设立宗禄清核使'));const affair=s.affairs.at(-1);
 const plan=prepareCommandBatch(s,[{type:'duty',kind:'project',target:affair.name,official:'bi'}]);assert.equal(plan[0].kind,'affair');assert.equal(plan[0].target,affair.id);
 assert.equal(executeCommands(s,plan).state.affairs.find(a=>a.id===affair.id).leader,'bi');
});
test('新署先创建再拨款，任用冲突与资源不足不会半办半停',()=>{
 const s=g.createGame(),creation=correctedBatch[2];const batch=prepareCommandBatch(s,[{type:'budget',agency:'宗禄清核使',budget:4},creation]);assert.equal(batch[0].type,'edict');assert.equal(executeCommands(s,batch).state.agencies[0].budget,4);
 assert.throws(()=>prepareCommandBatch(s,[{...creation,plan:{...creation.plan,institutionChanges:[{...creation.plan.institutionChanges[0],leader:'xu'}]}},correctedBatch[0]]),/人选互相冲突/);
 s.money=32;const original=structuredClone(s);assert.throws(()=>executeCommands(s,correctedBatch),e=>!isRepairableCommandError(e)&&/不足/.test(e.message));assert.deepEqual(s,original);
 s.actionsLeft=2;s.money=1;assert.throws(()=>executeCommands(s,correctedBatch),e=>!isRepairableCommandError(e)&&/国库/.test(e.message));assert.equal(s.agencies.length,0);
});
test('连续失败的照办向前找回原议，不把遵旨空话当成新方案，也不跨越已办理项',()=>{
 const history=[...structuredClone(failedHistory),...structuredClone(failedHistory.slice(-2))];assert.equal(acceptanceAdvice(history).proposal.content,advice);
 const messages=buildAcceptanceMessages(g.createGame(),{id:'council'},'照办',history,{error:'机构不存在',commands:invalidBatch});assert.equal(messages.findLast(m=>m.role==='assistant').content,advice);assert.match(messages.find(m=>m.role==='system'&&m.content.includes('错误与原数据')).content,/宗禄清核使/);assert.doesNotMatch(messages.findLast(m=>m.role==='assistant').content,/臣遵旨/);
 history[1].result.status='executed';assert.equal(acceptanceAdvice(history).proposal.content,failedHistory[3].content);
});
test('机构与探航不能混写而丢失设署效果',()=>{
 assert.throws(()=>executeCommands(g.createGame(),[{...correctedBatch[2],text:'设立宗禄清核使并派船西洋探航'}]),/未落实章程/);
});
test('已任命毕自严督办的方案可继续赈济，不被重复任命挡住且不多扣施政',()=>{
 let s=g.doAction(g.createGame(),'train',null,'bi');s.actionsLeft=1;const affair=s.affairs[0],original=structuredClone(s);
 const r=executeCommands(s,[{type:'duty',kind:'affair',target:affair.id,official:'毕自严'},{type:'action',action:'relief',target:'shaanxi',official:'lu'}]);
 assert.equal(r.state.actionsLeft,null);assert.equal(r.state.money,s.money-16);assert.equal(r.state.grain,s.grain-22);assert.equal(r.state.affairs[0].leader,'bi');assert.equal(r.state.affairs.at(-1).leader,'lu');assert.match(r.result.text,/本项不重复消耗/);assert.deepEqual(s,original);
});
test('全部已落实的任命及国策在零施政时只回报现状，不消耗也不重新办理',()=>{
 let s=g.assignOfficeLeader(g.createGame(),'revenue','bi');s=g.applyEdict(s,g.institutionPlan(s,[{operation:'create_agency',name:'宗禄清核使',budget:2,leader:'bi'}],'设立宗禄清核使'));s.actionsLeft=0;const original=structuredClone(s);
 const r=executeCommands(s,[{type:'office',office:'户部',official:'毕自严'},{type:'agency',agency:'宗禄清核使',official:'bi'},{type:'budget',agency:'宗禄清核使',budget:2},{type:'policy',tax:1,military:1}]);
 assert.deepEqual(r.state,original);assert.equal(r.result.status,'executed');assert.match(r.result.text,/本次没有新增变更/);assert.match(r.result.text,/白银净支出 0/);
});
test('相同人选按批次执行当时的状态判定，中途换任不能被提前当成重复',()=>{
 let s=g.assignOfficeLeader(g.createGame(),'revenue','bi');s.actionsLeft=2;const r=executeCommands(s,[{type:'office',office:'revenue',official:'xu'},{type:'office',office:'revenue',official:'bi'}]);assert.equal(r.state.government.officeLeaders.revenue,'bi');assert.equal(r.state.actionsLeft,null);assert.ok(r.state.money<s.money);
 const original=structuredClone(s);assert.throws(()=>executeCommands(s,[{type:'office',office:'revenue',official:'bi'},{type:'action',action:'relief',target:'shaanxi'},{type:'agency',agency:'不存在的署',official:'xu'}]),/机构不存在/);assert.deepEqual(s,original);
});
