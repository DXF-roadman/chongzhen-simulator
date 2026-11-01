import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../engine.mjs';
import {capturePlanning,extractDeferredPlanning,restoreRecordedPlanning,gameMonth,planningRequest} from '../records.mjs';
import {personPay,rolePay,inferFiscal} from '../fiscal-rules.mjs';
import {appendDiscussion} from '../dialogues.mjs';
import {executeCommands,factualCounsel} from '../counsel.mjs';
import {recordedPlans} from './planning-fixture.mjs';
test('实际漏记原文的自然段和分号能拆成四项目标，空 planning 字段也不会丢失',()=>{
 const s=g.createGame(),entries=extractDeferredPlanning(recordedPlans,{explicit:true});assert.deepEqual(entries.map(p=>p.title),['清查亏空','陕西水利','江南商税试点','北方推广水利屯田']);
 const saved=capturePlanning(s,[],recordedPlans,{input:'待办事项存入我们的规划备忘中'});assert.equal(saved.length,4);assert.equal(saved[0].deadline,gameMonth(s)+2);assert.equal(saved[1].deadline,gameMonth(s)+12);assert.equal(saved[3].deadline,gameMonth(s)+36);assert.equal(s.money,460);assert.equal(s.projects.length,0);assert.equal(planningRequest('如今天下凋敝，应该先设立短期中期与长期计划'),true);
 const alias=capturePlanning(s,[{name:'新目标',phase:'短期',dueMonths:'6个月',conditions:'核实粮储；安排主官'}],'',{input:'记录规划'});assert.equal(alias[0].horizon,'short');assert.equal(alias[0].deadline,gameMonth(s)+6);assert.equal(alias[0].requirements.length,2);
});
test('历史补录只恢复明确要求入册的目标，真实完工标完成，北方远图不会因陕西完工而误结案',()=>{
 const s=g.createGame();appendDiscussion(s,{id:'council',name:'御前议政'},'待办事项存入我们的规划备忘中',recordedPlans,[],{status:'discussed',text:'仅商议'},'ai',g.dateLabel(s));s.turn=6;s.month=7;
 for(const title of ['清查亏空','陕西以工代赈试修水利','江南商税试点'])s.history.unshift({turn:2,title:'竣工 · '+title,text:'已验收',date:'崇祯元年 · 三月',type:'project'});
 const before={money:s.money,grain:s.grain,history:structuredClone(s.history),projects:structuredClone(s.projects)},restored=restoreRecordedPlanning(s);assert.equal(restored.length,4);assert.deepEqual(restored.map(p=>p.status),['done','done','done','deferred']);assert.equal(restored[0].createdAt,1628*12);assert.equal(restored[3].deadline,1631*12);assert.deepEqual({money:s.money,grain:s.grain,history:s.history,projects:s.projects},before);assert.equal(restoreRecordedPlanning(s).length,4);assert.equal(s.planning.length,4);assert.deepEqual(g.validateSave(s).planning,s.planning);
});
test('无延期擅自改期仍被阻止，格式错误有可见原因，纯假设不会自动入册',()=>{
 const s=g.createGame(),p=capturePlanning(s,[{title:'修水渠',horizon:'short',dueMonths:3}],'')[0];s.month=2;capturePlanning(s,[{title:'修水渠',horizon:'short',dueMonths:10}],'');assert.equal(p.deadline,1628*12+3);
 const bad=capturePlanning(s,[{title:'期限错误',dueMonths:-2}],'',{input:'请记录规划'});assert.equal(bad.length,0);assert.match(bad.warnings[0],/日期无效/);assert.equal(capturePlanning(s,[],recordedPlans,{input:'只是假设，不要记录'}).length,0);
});
test('个人俸禄按兼任总额结算，一次性起用费不会被当作月俸，未任职不扣款',()=>{
 let s=g.createGame();s.money=1000;s.grain=1000;s=g.appoint(s,'bi');s=g.assignOfficeLeader(s,'revenue','bi');s=g.intervene(s,{type:'war',operation:'commander',unit:'liaodong-army',official:'bi'});assert.equal(personPay(s,'bi'),5.44);
 const money=s.money,previous=g.forecast(s),next=g.setFiscal(s,{scope:'person',official:'bi',monthly:1}),f=g.forecast(next);assert.equal(next.money,money);assert.equal(personPay(next,'bi'),1);assert.ok(Math.abs(rolePay(next,'central','bi')+rolePay(next,'office','bi')+rolePay(next,'commander','bi')-1)<1e-9);assert.equal(Math.round((previous.expenses-f.expenses)*100)/100,4.44);assert.equal(g.officialCatalog(next).find(o=>o.id==='bi').hireCost,0);
 const advanced=g.advance({...next,event:null});assert.ok(Math.abs(advanced.money-(money+f.net))<.011);assert.equal(g.validateSave(advanced).fiscal.salaries.bi,1);
 const unemployed=g.setFiscal(g.createGame(),{scope:'person',official:'yuan',monthly:14});assert.equal(personPay(unemployed,'yuan'),0);assert.equal(g.forecast(unemployed).expenses,g.forecast(g.createGame()).expenses);
});
test('率、个人免俸、恢复标准和无效值都实际核验，整批失败不留下半个财政新例',()=>{
 let s=g.assignOfficeLeader(g.createGame(),'revenue','bi');s=g.setFiscal(s,{scope:'rates',values:{officeFee:.5,dutyFee:0,salaryMultiplier:.5}});assert.equal(personPay(s,'bi'),.5);s=g.setFiscal(s,{scope:'person',official:'bi',monthly:0});assert.equal(personPay(s,'bi'),0);s=g.setFiscal(s,{scope:'person',official:'bi',monthly:null});assert.equal(personPay(s,'bi'),.5);
 const before=structuredClone(s);assert.throws(()=>executeCommands(s,[{type:'fiscal',scope:'rates',values:{officeFee:1}},{type:'fiscal',scope:'person',official:'bi',monthly:-1}]),/未能办理/);assert.deepEqual(s,before);
 for(const values of [{officeFee:-1},{salaryMultiplier:9},{money:9999}])assert.throws(()=>g.setFiscal(s,{scope:'rates',values}),/费率无效/);
 const invalid=structuredClone(s);invalid.fiscal.salaries.unknown=3;assert.throws(()=>g.validateSave(invalid),/月俸约定无效/);
});
test('中文金额、减半自然语言都转成财政新例，不再编成没有实际作用的普通诏令',()=>{
 const s=g.assignOfficeLeader(g.createGame(),'revenue','bi');for(const [text,expected]of [['将毕自严月俸改为一万两',1],['将毕自严月俸改为五千两',.5],['将毕自严月俸改为0.5万两',.5],['将毕自严月俸改为两万两',2]]){const commands=inferFiscal(s,text);assert.equal(commands[0].monthly,expected,text);assert.equal(personPay(executeCommands(s,commands).state,'bi'),expected);}
 const half=inferFiscal(s,'所有官员俸禄减半');assert.equal(half[0].values.officeFee,1);assert.equal(personPay(executeCommands(s,half).state,'bi'),1);
});
test('小额查账工程按明确2万两报价，0成本行政令也可办理，缺省工程须补明确预算',()=>{
 const s=g.createGame(),raw={title:'盘验京通二仓实储',narrative:'遣三五书吏核验两仓',cost:{money:2,grain:0},project:{months:2,effects:{corruption:-2}}},p=g.normalizeEdict(raw,s,'盘验京通二仓');assert.equal(p.cost.money,2);assert.equal(g.applyEdict(s,p).money,458);
 const free=g.normalizeEdict({...raw,project:null,cost:{money:0}},s,'公布对账章程');assert.equal(g.applyEdict(s,free).money,460);assert.throws(()=>g.normalizeEdict({...raw,cost:undefined},s,'修仓'),/预算/);
});
