import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../engine.mjs';
import {payroll,personPay,rolePay} from '../fiscal-rules.mjs';
import {monthlyAmount,normalizeMonthly} from '../monthly-rules.mjs';
import {executeCommands} from '../counsel.mjs';
const month=s=>g.advance({...s,event:null}),rich=()=>({...g.createGame({seed:104}),money:50000,grain:50000,frontier:30});
const militaryOrder='派人去辽东整兵，每月拨5万两，压制边患';

test('同人兼原任本职及另一部职逐岗计俸，个人总额跨同类岗位分摊后仍严格相等',()=>{
 let s=g.createGame(),id='civil-head-revenue';s=g.assignOfficeLeader(s,'war',id);assert.equal(rolePay(s,'office',id,'revenue'),0);assert.equal(rolePay(s,'office',id,'war'),2);assert.equal(personPay(s,id),2);assert.equal(g.forecast(s).salaryTotal,2);
 s=g.setFiscal(s,{scope:'person',official:id,monthly:1.2345});assert.equal(rolePay(s,'office',id,'revenue'),0);assert.equal(rolePay(s,'office',id,'war'),1.2345);assert.equal(personPay(s,id),1.2345);assert.equal(g.forecast(s).entries.filter(r=>r.id.startsWith('pay:office:')).reduce((n,r)=>n+r.money,0),1.2345);assert.equal(g.validateSave(s).fiscal.salaries[id],1.2345);
});
test('一句月拨五万落实到实际月账，替代默认差旅，不提前给完成奖励，结案后停止收费',()=>{
 let s=rich();const p=g.localEdict(s,militaryOrder),before=s.money;s=g.applyEdict(s,p,'yuan');assert.equal(s.money,before);assert.equal(s.army,49,'启动未预支整训成效');assert.equal(s.projects[0].monthly.money,5);const id=s.projects[0].id;assert.equal(g.forecast(s).entries.find(e=>e.id==='project:'+id).money,5);
 let spent=0;for(let n=0;n<4;n++){const quote=g.forecast(s),start=s.money;s=month(s);spent+=s.ledger.entries.find(e=>e.id==='project:'+id)?.actualMoney||0;assert.ok(Math.abs(s.money-start-quote.net-s.ledger.adjustments.money)<.00001);assert.deepEqual(g.validateSave(s).ledger,s.ledger);}
 assert.equal(spent,10);assert.equal(s.projects.length,0);assert.ok(!g.forecast(s).entries.some(e=>e.id==='project:'+id));assert.ok(s.army>49);
});
test('欠拨项目不扣虚账、不施工、不发成果，年度累计使用实拨支出而非应拨预算',()=>{
 let s=g.createGame({seed:105});s=g.applyEdict(s,g.localEdict(s,militaryOrder),'yuan');s.money=0;const id=s.projects[0].id,remaining=s.projects[0].remaining;s=month(s);const row=s.ledger.entries.find(e=>e.id==='project:'+id);assert.equal(row.paid,false);assert.equal(row.actualMoney,0);assert.equal(s.projects[0].remaining,remaining);assert.equal(s.projects[0].workCredit,0);assert.ok(s.ledger.expenses<s.ledger.plannedExpenses);assert.equal(s.yearRecord.expenses,s.ledger.expenses);assert.equal(s.money,s.ledger.openingMoney+s.ledger.revenue-s.ledger.expenses+s.ledger.adjustments.money);
});
test('持续政令结案后只保留一份月度安排，停拨后不花钱也不产生持续效果',()=>{
 let s=rich(),p=g.normalizeEdict({title:'常设边务点验',narrative:'清核边报',domain:'军事',cost:{money:0},project:{months:2,effects:{}},monthly:{money:3,effects:{frontier:-.5},retain:true}},s,'常设边务点验，每月拨3万两');s=g.applyEdict(s,p);s=month(s);s=month(s);assert.equal(s.projects.length,0);assert.equal(s.monthlyPolicies.length,1);assert.equal(g.forecast(s).monthlyPolicyExpenses,3);const id=s.monthlyPolicies[0].id;
 s=g.setMonthly(s,{kind:'policy',target:id,monthly:{money:0}});assert.equal(g.forecast(s).monthlyPolicyExpenses,0);assert.equal(s.monthlyPolicies[0].monthly.paused,true);const control=structuredClone(s);control.monthlyPolicies=[];assert.equal(month(s).frontier,month(control).frontier);assert.equal(g.validateSave(s).monthlyPolicies[0].monthly.paused,true);
});
test('拨款期限耗尽即暂停，追加期限后恢复，金额单位、暂停状态与剩余期限存读档完整',()=>{
 assert.equal(monthlyAmount('每月拨五千两').money,.5);assert.equal(monthlyAmount('月拨改为2万两').money,2);let s=rich(),p=g.normalizeEdict({title:'限期边报核验',narrative:'按月核验',domain:'military',cost:{money:0},project:{months:5,effects:{}},monthly:{money:2,months:2}},s,'核验边报，每月拨2万两，为期两个月');s=g.applyEdict(s,p);s=month(s);s=month(s);const id=s.projects[0].id,r=s.projects[0].remaining;s=month(s);assert.equal(s.projects[0].remaining,r);assert.equal(s.ledger.entries.find(e=>e.id==='project:'+id).paid,false);assert.equal(g.validateSave(s).projects[0].monthly.remaining,0);
 s=g.setMonthly(s,{kind:'project',target:id,monthly:{money:2,months:3,paused:false}});s=month(s);assert.ok(s.projects[0].remaining<r);
});
test('不同任务、船队和工厂的钱粮各按一份清单扣付，取消航行或生产不会继续收费',()=>{
 let s=rich();s=g.intervene(s,{type:'horizon',operation:'voyage',route:'west',monthly:{money:4,grain:2,effects:{},retain:false}});s=g.intervene(s,{type:'arsenal',operation:'produce',equipment:'matchlock',factories:1});s=g.doAction(s,'audit',null,'bi');s=g.assignOfficeLeader(s,'revenue','bi');
 for(let n=0;n<4;n++){const f=g.forecast(s);assert.ok(Math.abs(f.entries.filter(r=>r.funding==='treasury').reduce((v,r)=>v+r.money,0)-f.expenses)<1e-8);const start=s.money;s=month(s);assert.ok(Math.abs(s.money-start-s.ledger.net-s.ledger.adjustments.money)<1e-8);assert.ok(Math.abs(s.ledger.entries.filter(e=>e.funding==='treasury').reduce((v,e)=>v+e.actualMoney,0)-s.ledger.expenses)<1e-8);}
 const v=s.atlas.voyages[0];s=g.intervene(s,{type:'horizon',operation:'recall',voyage:v.id});s=g.intervene(s,{type:'arsenal',operation:'produce',equipment:'matchlock',factories:0});assert.equal(g.forecast(s).explorationExpenses,0);assert.equal(g.forecast(s).militaryExpenses,0);
});
test('明确财政收入目标不能混成每月赠款，整批失败不留下假固定收益',()=>{
 assert.throws(()=>normalizeMonthly({money:1,effects:{money:100}},'每月维护'),/实际税源/);const s=rich(),before=structuredClone(s);assert.throws(()=>executeCommands(s,[{type:'edict',text:'每月收入一百万',plan:{title:'增收目标',narrative:'尚无税源',monthly:{income:100},cost:{money:0}}}]),/实际税源/);assert.deepEqual(s,before);
});
test('预设整训经AI绑定月拨时也分期执行，不重收一次性整军费或提前送军备',()=>{
 const s=rich(),next=g.doAction(s,'train',null,'yuan',{monthly:{money:5,effects:{frontier:-1},retain:false}});assert.equal(next.money,s.money);assert.equal(next.army,s.army);assert.equal(next.projects[0].monthly.money,5);const loaded=g.validateSave(next);assert.equal(loaded.projects[0].effects.frontier,-3);assert.equal(loaded.projects[0].effects.army,9);assert.equal(month(loaded).ledger.entries.find(e=>e.group==='project').actualMoney,5);
});
test('多个外部供给项目汇总调取，不把每笔最低能耗重复扣收',()=>{
 let s={...g.createGame({traveler:true}),money:5000,grain:5000};for(const name of ['甲案核验','乙案核验'])s=g.applyEdict(s,g.normalizeEdict({title:name,narrative:'核验案牍',cost:{money:0},funding:'portal',domain:'governance',project:{months:4,effects:{}}},s,name+'材料由门中提供，不占官帑'),'bi');s.traveler.energy=1;const next=month(s),rows=next.ledger.entries.filter(e=>e.funding==='portal');assert.equal(rows.length,2);assert.ok(rows.every(e=>e.paid));assert.equal(next.traveler.supplies.filter(q=>q.note.includes('本月外部供给月拨')).length,1);assert.ok(next.projects.every(p=>p.remaining===3));
});
