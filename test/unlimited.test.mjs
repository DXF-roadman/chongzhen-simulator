import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../engine.mjs';
import {executeCommands,isOrder,acceptsProposal,isRepairableCommandError,currentFacts,factualCounsel,buildCounselMessages,lastProposal} from '../counsel.mjs';
import {appendDiscussion} from '../dialogues.mjs';
const target={id:'council',name:'御前议政'};
test('旧存档剩余零到三次均迁移为无限，不跳月、不改钱粮和任职',()=>{
 for(const actionsLeft of [0,1,2,3,null,undefined]){const raw=g.createGame({seed:94});Object.assign(raw,{month:3,turn:2,money:316,grain:148,actionsLeft});raw.government.officeLeaders.cabinet='sun';const s=g.validateSave(raw);assert.equal(s.actionsLeft,null);assert.equal(g.administration(s).unlimitedActions,true);for(const field of ['id','month','turn','money','grain'])assert.equal(s[field],raw[field]);assert.equal(s.government.officeLeaders.cabinet,'sun');assert.equal(g.validateSave(JSON.parse(JSON.stringify(s))).actionsLeft,null);}
});
test('无限施政下六部任职、军械、探航、出征仍可办理，资源不足仍原子失败',()=>{
 let s=g.createGame();s.money=1000;s.grain=1000;
 for(const office of ['personnel','revenue','rites','war','justice','works'])s=g.assignOfficeLeader(s,office,'bi');
 s=g.intervene({...s,actionsLeft:0},{type:'arsenal',operation:'modernize',scope:'frontier'});s=g.intervene({...s,actionsLeft:0},{type:'horizon',operation:'voyage',route:'west'});s=g.intervene({...s,actionsLeft:0},{type:'war',operation:'attack',target:'liaoshen'});assert.equal(s.month,1);assert.equal(s.actionsLeft,null);assert.equal(s.atlas.voyages.length,1);assert.equal(s.campaignState.battles.length,1);assert.ok(s.money<1000);
 const poor={...s,money:0},original=structuredClone(poor);assert.throws(()=>executeCommands(poor,[{type:'action',action:'relief',target:'shaanxi'}]),/不足/);assert.deepEqual(poor,original);
});
test('清查亏空先付费用、按工期结案回款，不能同月连点即时刷银',()=>{
 let s=g.doAction(g.createGame(),'audit');assert.equal(s.money,452);assert.equal(s.projects[0].remaining,2);assert.equal(s.projects[0].action,'audit');assert.throws(()=>g.doAction(s,'audit'),/相同工程/);s=g.validateSave(s);assert.equal(s.projects[0].domain,'governance');assert.equal(s.projects[0].effects.money,28);
 s=g.advance({...s,event:null});assert.equal(s.projects[0].remaining,1);const expected=s.money+g.forecast(s).net+28;s=g.advance({...s,event:null});assert.equal(s.projects.length,0);assert.equal(s.money,expected);
});
test('没有待批奏报时不能复批旧事件，该错误可交由 AI 修成新增政令',()=>{
 const s={...g.createGame(),month:3,turn:2,event:null},original=structuredClone(s);
 assert.throws(()=>executeCommands(s,[{type:'event',index:0,official:'lu',eventTurn:2}]),e=>isRepairableCommandError(e)&&/新增政务须另拟新政令/.test(e.message));assert.deepEqual(s,original);
 const r=executeCommands(s,[{type:'edict',text:'核实辽镇兵额，命卢象升抽点督办',official:'lu',plan:{title:'辽镇核兵稽核',narrative:'复核兵籍并抽点实员。',cost:{money:36},domain:'military',effects:{},project:{months:2,effects:{corruption:-3,army:2}}}}]);assert.equal(r.state.projects[0].leader,'lu');assert.equal(r.state.projects[0].remaining,2);assert.equal(r.state.money,s.money-36);assert.equal(r.state.month,3);
});
test('日期、次数和失败原因问答使用实时状态，不复述 AI 编造的四月和额度',()=>{
 const s={...g.createGame(),month:3,turn:2,event:null,money:316,grain:148},history=[{role:'assistant',content:'如今四月，次数已经用完。',source:'ai',commands:[],result:{status:'discussed',text:'商议'}}];
 for(const input of ['现在不就是三月吗','不是还有2次机会吗','为什么不能办，什么叫奏报已经处置']){const r=factualCounsel(s,input,history);assert.equal(r.source,'system');assert.match(r.reply,/崇祯元年 · 三月/);assert.match(r.reply,/取消上限/);assert.doesNotMatch(r.reply,/如今四月|次数已用尽/);}
 assert.equal(currentFacts(s).monthlyActionLimit,null);const messages=buildCounselMessages(s,target,'如何核兵？',history,true);assert.equal(messages.at(-2).role,'system');assert.match(messages.at(-2).content,/"date":"崇祯元年 · 三月"/);assert.match(messages.at(-2).content,/"event":null/);
});
test('好先办此一件属于明确采纳，状态问答不会丢失待办提案',()=>{
 for(const input of ['好 先办此一件','好，先办这一件','先办这一件']){assert.equal(isOrder(input),true,input);assert.equal(acceptsProposal(input),true,input);}
 for(const input of ['核兵','立即核实辽镇兵额','催办辽饷'])assert.equal(isOrder(input),true,input);for(const input of ['核兵有什么好处','核兵有何利弊','核兵怎样进行','不要核兵'])assert.equal(isOrder(input),false,input);
 assert.equal(isOrder('如果先办这一件会怎样？'),false);const s=g.createGame(),commands=[{type:'office',office:'revenue',official:'bi'}];appendDiscussion(s,target,'请拟人选','臣请毕自严主持户部',commands,{status:'discussed',text:'商议'},'ai',g.dateLabel(s));const r=factualCounsel(s,'还有几次施政？');appendDiscussion(s,target,'还有几次施政？',r.reply,r.commands,{status:'discussed',text:'状态核对'},r.source,g.dateLabel(s));assert.deepEqual(lastProposal(s.discussions[0].messages),commands);
});
test('保存重载保留工程编号与进度版本，后续督办和新工程不会串号',()=>{
 const original=g.doAction(g.createGame(),'academy'),restored=g.validateSave(original);assert.equal(restored.projects[0].id,original.projects[0].id);assert.equal(restored.revision,original.revision);let next=g.assignDuty(restored,'project',original.projects[0].id,'xu');next=g.doAction(next,'arsenal');assert.equal(new Set(next.projects.map(p=>p.id)).size,2);assert.throws(()=>g.validateSave({...next,projects:[next.projects[0],next.projects[0]]}),/工程编号/);
});
