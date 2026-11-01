import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../engine.mjs';
import {localCounsel,executeCommands,isOrder,cleanCommands,readCounselReply,counselTargets} from '../counsel.mjs';
import {appendDiscussion} from '../dialogues.mjs';
const target={id:'council',name:'御前议政'};
test('自然语言任命直接落入六部、工程与新署，不是额外研究奖励',()=>{
 let s=g.createGame({seed:50});let a=localCounsel(s,target,'任命毕自严为户部尚书');
 let result=executeCommands(s,a.commands);s=result.state;assert.equal(s.government.officeLeaders.revenue,'bi');assert.equal(s.actionsLeft,null);assert.equal(s.projects.length,0);assert.equal(s.money,452);
 a=localCounsel(s,target,'让宋应星督办火器工坊');s=executeCommands(s,a.commands).state;assert.equal(s.projects[0].leader,'song');assert.equal(s.projects[0].action,'arsenal');
 let base=g.createGame({seed:51});a=localCounsel(base,target,'设立皇家科学院，任命徐光启为主官');s=executeCommands(base,a.commands).state;assert.equal(s.agencies[0].name,'皇家科学院');assert.equal(s.agencies[0].leader,'xu');assert.equal(s.actionsLeft,null);assert.equal(s.money,base.money-36-g.officialCatalog(base).find(o=>o.id==='xu').cost);assert.equal(g.forecast(s).agencyExpenses,10);
});
test('假设、询问、否定不自动执行，明确请求与接受方案才办理',()=>{
 for(const t of ['如果任命毕自严管户部呢','是否废掉内阁','任命谁比较好','请问任命谁合适','不用加税','不要任命毕自严','不加税','先讨论开仓赈济','加税会不会激起民变'])assert.equal(isOrder(t),false,t);
 for(const t of ['任命毕自严为户部尚书','请帮我任命毕自严好吗','让宋应星督办火器工坊','就按刚才的方案办','照办','在陕西开仓赈济'])assert.equal(isOrder(t),true,t);
 assert.deepEqual(localCounsel(g.createGame(),target,'不加税').commands,[]);assert.deepEqual(localCounsel(g.createGame(),target,'照办').commands,[]);
});
test('照办沿用上次提案，执行后不会误把旧提案再执行一次',()=>{
 const s=g.createGame({seed:52});const a=localCounsel(s,target,'赈灾有什么建议？');
 const thread=appendDiscussion(s,target,'赈灾有什么建议？',a.reply,a.commands,{status:'discussed',text:'仅商议'},'offline',g.dateLabel(s));
 const accepted=localCounsel(s,target,'照办',thread.messages);assert.deepEqual(accepted.commands,a.commands);const applied=executeCommands(s,accepted.commands);
 const t=appendDiscussion(applied.state,target,'照办','已核验',accepted.commands,applied.result,'offline',g.dateLabel(s));assert.deepEqual(localCounsel(applied.state,target,'照办',t.messages).commands,[]);
});
test('多项下旨整批核验，资源或任职资格不足时不会半办半停',()=>{
 const s=g.createGame({seed:53});s.money=8;const original=structuredClone(s);
 assert.throws(()=>executeCommands(s,[{type:'office',office:'户部',official:'毕自严'},{type:'office',office:'兵部',official:'孙承宗'}]),/第 2 项.*整批未执行/);assert.deepEqual(s,original);
 assert.throws(()=>executeCommands(s,[{type:'office',office:'兵部',official:'talent-1'}]),/尚未归附/);
 assert.throws(()=>cleanCommands([{type:'shell',cmd:'anything'}]),/不支持/);
 assert.throws(()=>executeCommands(s,[{type:'policy',tax:9}]),/国策/);
});
test('自然语言可调整现有事务人选、预算与税率',()=>{
 let s=g.doAction(g.createGame({seed:54}),'arsenal');const a=localCounsel(s,target,'任命徐光启负责火器工坊');s=executeCommands(s,a.commands).state;assert.equal(s.projects[0].leader,'xu');
 const r=executeCommands(s,[{type:'policy',tax:.8,military:1}]);assert.equal(r.state.tax,.8);
});
test('议事随存档往返，旧档可迁移，非法角色与内容被拒绝',()=>{
 const s=g.createGame({seed:55});appendDiscussion(s,target,'问策','臣请先赈济',[{type:'action',action:'relief',target:'shaanxi'}],{status:'discussed',text:'未执行'},'ai',g.dateLabel(s));
 assert.deepEqual(g.validateSave(s).discussions,s.discussions);assert.equal(s.actionsLeft,null);assert.equal(s.money,460);
 const old=g.createGame();delete old.discussions;assert.deepEqual(g.validateSave(old).discussions,[]);
 const bad=structuredClone(s);bad.discussions[0].messages[0].role='system';assert.throws(()=>g.validateSave(bad),/议事内容/);
 const huge=structuredClone(s);huge.discussions[0].messages[1].commands=[{text:'a'.repeat(30001)}];assert.throws(()=>g.validateSave(huge),/过长/);
});
test('废阁、裁署和招安后的交谈对象跟随真实局势，记录可留存',()=>{
 let s=g.createGame({seed:56});assert.ok(counselTargets(s).some(t=>t.id==='office:cabinet'));assert.ok(counselTargets(s).some(t=>t.id==='person:talent-1'));
 s=g.applyEdict(s,g.localEdict(s,'废内阁'));assert.equal(counselTargets(s).some(t=>t.id==='office:cabinet'),false);
});
test('长期议事保留近期内容且仍可导出导入，过时奏报不会批错当前事件',()=>{
 const s=g.createGame({seed:57});for(let i=0;i<32;i++)appendDiscussion(s,{id:'person:visitor-'+i,name:'来客'+i},'问'.repeat(2000),'答'.repeat(5000),[],{status:'discussed',text:'记'.repeat(1800)},'ai',g.dateLabel(s));
 assert.ok(Buffer.byteLength(JSON.stringify(s))<1000000);assert.ok(s.discussions.length<=24);assert.equal(g.validateSave(s).discussions[0].name,'来客31');
 assert.throws(()=>executeCommands(s,[{type:'event',index:0,eventId:'pay',eventTurn:0}]),/奏报已变化/);assert.throws(()=>executeCommands(s,[{type:'event',index:0,eventId:'drought',eventTurn:2}]),/奏报已变化/);
});
test('兼容供应商仅返回操作数组，仍严格核验并说明答复形式',()=>{
 const reply=readCounselReply([{type:'office',office:'rites',official:'xu'}]);assert.match(reply.reply,/仅|本次返回/);assert.equal(reply.commands[0].official,'xu');
 assert.equal(executeCommands(g.createGame(),reply.commands).state.government.officeLeaders.rites,'xu');assert.throws(()=>readCounselReply([]),/未返回/);assert.throws(()=>readCounselReply([{type:'shell'}]),/不支持/);
});
test('献策结合局势且说明代价，政策执行反馈实际国势与朝堂反应',()=>{
 const s=g.createGame({seed:58}),a=localCounsel(s,target,'请群臣献策，给朕三条建议，本次仅作商议。');assert.match(a.reply,/16 万两/);assert.match(a.reply,/士绅/);assert.equal(a.commands.length,3);assert.equal(isOrder('请群臣献策，给朕三条建议，本次仅作商议。'),false);
 const r=executeCommands(s,[{type:'action',action:'train'}]);assert.match(r.result.text,/军备 \+9/);assert.match(r.result.text,/军中支持 \+4/);
 const invalid=localCounsel(s,target,'任命不存在的人为户部尚书');assert.deepEqual(invalid.commands,[]);assert.throws(()=>executeCommands(s,invalid.commands),/尚无明确/);
 const experiment=executeCommands(s,[{type:'edict',text:'试办公共卫生与洁净饮水',plan:{title:'公共卫生试点',narrative:'先在京畿检验净水与医学培训。',domain:'medicine',cost:{money:40},effects:{money:999999},project:{months:3,effects:{tech:6,stability:4}}}}]);assert.equal(experiment.state.money,420);assert.equal(experiment.state.projects[0].domain,'medicine');assert.equal(experiment.state.stability,s.stability);
});
