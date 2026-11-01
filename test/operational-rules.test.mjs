import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../engine.mjs';
import {snapshotState,restoreState} from '../state-store.mjs';
import {monthlyScale} from '../monthly-rules.mjs';
import {agencyStrength} from '../governance.mjs';
import {battlePower,settleCampaign} from '../campaigns.mjs';
import {refreshMilitary} from '../equipment.mjs';
import {compensationSupport} from '../fiscal-rules.mjs';
import {executeCommands} from '../counsel.mjs';
const rich=()=>({...g.createGame({mode:'sandbox',seed:1701}),money:50000,grain:50000,frontier:30}),month=s=>g.advance({...s,event:null}),near=(a,b)=>assert.ok(Math.abs(a-b)<.00001,`${a} != ${b}`);
function agency(s,name,domain='finance',mandate=name,powers=['execution']){s=g.applyEdict(s,g.institutionPlan(s,[{operation:'create_agency',name,domain,mandate,powers,budget:8}],'设'+name));const a=s.agencies.at(-1);a.status='active';a.remaining=0;return s;}

test('空库、有全付费选项也能过月；留中原案不收费、不消失，之后可重批且保留新奏报',()=>{
 let s=rich();s.event={...s.event,options:s.event.options.map(o=>({...o,cost:{money:100}}))};s.money=0;const next=g.advance(s),held=next.affairs.find(a=>a.petition);assert.ok(held);assert.equal(next.month,2);assert.equal(next.affairs.filter(a=>a.petition).length,1);assert.ok(!next.ledger.entries.some(e=>e.id==='affair:'+held.id));
 let loaded=restoreState(next);const current=structuredClone(loaded.event);loaded.money=500;loaded=g.resolveEvent(loaded,1,null,{petition:held.id});assert.deepEqual(loaded.event,current);assert.ok(!loaded.affairs.some(a=>a.id===held.id));snapshotState(loaded);
});

test('自由议事可免费留中后另下政令，留中案卷可由 AI 指定批复且不重复执行',()=>{
 let s=rich();s=executeCommands(s,[{type:'event',index:-1},{type:'edict',text:'令各县呈报灾民名册',plan:{title:'灾民名册',narrative:'先报数，不擅拨款。',cost:{money:0},effects:{}}}]).state;const held=s.affairs.find(a=>a.petition);assert.ok(held);s=executeCommands(s,[{type:'event',petition:held.id,index:1}]).state;assert.ok(!s.affairs.some(a=>a.id===held.id));assert.throws(()=>executeCommands(s,[{type:'event',petition:held.id,index:1}]),/没有待批/);snapshotState(s);
});

test('削款降低效果及工程推进量，增拨不超原规模，基准与进度余量可无损存读',()=>{
 let s=rich();s=g.applyEdict(s,g.normalizeEdict({title:'边报核验',narrative:'按月核验',domain:'military',cost:{money:0},project:{months:4,effects:{army:1}},monthly:{money:5,effects:{frontier:-1,army:.25},retain:true}},s,'核验边报，每月拨5万两'));
 const p=s.projects[0],cut=g.setMonthly(s,{kind:'project',target:p.id,monthly:{money:.0001}});near(monthlyScale(cut.projects[0].monthly),.00002);const after=month(cut);assert.equal(after.projects[0].remaining,4);assert.ok(after.projects[0].workCredit>0&&after.projects[0].workCredit<.001);assert.deepEqual(restoreState(after),after);
 const full=g.setMonthly(s,{kind:'project',target:p.id,monthly:{money:10}});assert.equal(monthlyScale(full.projects[0].monthly),1);assert.equal(g.forecast(full).entries.find(e=>e.id==='project:'+p.id).money,5);const paid=month(s);assert.equal(paid.projects[0].remaining,3);assert.ok(paid.frontier<after.frontier);snapshotState(paid);
});

test('零基础经费不能保持完整征解与军政；欠俸支持度持续降低，补足后逐月恢复',()=>{
 const s=rich(),normal=month(s),zero=month(g.setFiscal(s,{scope:'rates',values:{administrationBase:0,militaryBase:0}}));assert.equal(zero.ledger.expenses,0);assert.ok(zero.army<normal.army);assert.ok(zero.legitimacy<normal.legitimacy);assert.ok(zero.ledger.revenue<normal.ledger.revenue);
 let low=g.assignOfficeLeader(rich(),'revenue','bi');low=g.setFiscal(low,{scope:'person',official:'bi',monthly:0});for(let n=0;n<10;n++)low=month(low);assert.equal(compensationSupport(low,'bi'),0);low=g.setFiscal(low,{scope:'person',official:'bi',monthly:null});low=month(low);assert.ok(compensationSupport(low,'bi')>0&&compensationSupport(low,'bi')<1);snapshotState(low);
});

test('同一人兼任和复任不再重复起用收费，首次起用及实际月俸仍保留',()=>{
 let s=rich(),cash=s.money;s=g.assignOfficeLeader(s,'revenue','bi');assert.equal(s.money,cash-8);const once=s.money;s=g.appoint(s,'bi');s=g.intervene(s,{type:'war',operation:'commander',unit:'liaodong-army',official:'bi'});assert.equal(s.money,once);assert.equal(g.officialCatalog(s).find(o=>o.id==='bi').hireCost,0);s=g.dismiss(s,'bi');s=g.appoint(s,'bi');assert.equal(s.money,once);snapshotState(s);
});

test('通商不即时刷收益，在途重复派遣失败，回航一次入账且期间存读不重结',()=>{
 let s=rich(),cash=s.money,tech=s.tech;s=g.diplomacy(s,'joseon','trade');assert.equal(s.money,cash-28);assert.equal(s.tech,tech);assert.throws(()=>g.diplomacy(s,'joseon','trade'),/尚未回航/);s=restoreState(s);const payout=s.affairs.find(a=>a.trade).trade.payout;s=month(s);assert.ok(s.affairs.some(a=>a.trade));s=month(restoreState(s));assert.ok(!s.affairs.some(a=>a.trade));assert.equal(s.ledger.adjustments.money,payout);const before=s.money;s=month(restoreState(s));near(s.money-before,s.ledger.net);assert.ok(s.history.some(h=>h.text.includes('商队实际回航')));
});

test('机构只按承办能力实拨，超额留库；互补职责及欠拨机构不受同领域重复惩罚',()=>{
 let s=agency(rich(),'清丈专办','finance','清丈田亩'),a=s.agencies[0],original=agencyStrength(s,a);s=agency(s,'商务专办','finance','管理通商贸易');near(agencyStrength(s,s.agencies[0]),original);
 let duplicates=agency(rich(),'国用审计署','finance','审计税账');const one=agencyStrength(duplicates,duplicates.agencies[0]);duplicates=agency(duplicates,'税账审计局','finance','审计税账');assert.ok(agencyStrength(duplicates,duplicates.agencies[0])<one);duplicates.agencies[1].funded=false;near(agencyStrength(duplicates,duplicates.agencies[0]),one);
 s=g.setAgencyBudget(s,a.id,20);const f=g.forecast(s);assert.equal(f.entries.find(e=>e.id==='agency:'+a.id).money,12);const advanced=month(s);assert.equal(advanced.ledger.entries.find(e=>e.id==='agency:'+a.id).actualMoney,12);snapshotState(advanced);
});

test('机构收入按当月实际供给计算，不能先用未生效增收支付本机构；无隐藏强制扣银',()=>{
 let s=agency(rich(),'财政执行署','finance','财政组织');s=g.setAgencyBudget(s,s.agencies[0].id,12);s.money=0;s.grain=0;const quote=g.forecast(s),next=month(s),row=next.ledger.entries.find(e=>e.id==='agency:'+s.agencies[0].id);assert.equal(row.paid,false);const off=structuredClone(s);off.agencies=[];assert.equal(quote.revenue,g.forecast(off).revenue);assert.equal(next.ledger.revenue,quote.revenue);
 const danger=rich();danger.frontier=90;danger.factions.merchant=100;const n=month(danger);assert.equal(n.ledger.adjustments.money,0);assert.ok(n.notices.some(t=>t.includes('未自动追加扣银')));snapshotState(n);
});

test('本军战力取决于本军攻击防御可靠性，空装为零，外军装备不重复抬高本军战力',()=>{
 const s=rich(),u=s.militaryState.units[0],base=battlePower(s,u),empty={...u,equipment:{}};assert.equal(battlePower(s,empty),0);const more=structuredClone(s);more.militaryState.units[1].equipment.gundam=1;more.militaryState.units[1].needs.mecha=1;refreshMilitary(more);assert.equal(battlePower(more,more.militaryState.units[0]),base);
 const weak=structuredClone(s);weak.militaryState.designs.push({...g.EQUIPMENT[0],id:'design-99',name:'低可靠鸟铳',reliability:10});weak.militaryState.units[0].equipment={'design-99':4800,cannon:80};assert.ok(battlePower(weak,weak.militaryState.units[0])<base);
});

test('新增部队和重装备有维护，海上进军须实际运输船；少量装备累积损伤而非永久免损',()=>{
 let s=rich();s=g.intervene(s,{type:'arsenal',operation:'create_unit',name:'新军',template:'field'});assert.ok(g.forecast(s).entries.some(e=>e.id==='unit:'+s.militaryState.units.at(-1).id&&e.money>0&&e.grain>0));assert.throws(()=>g.intervene(s,{type:'war',operation:'attack',target:g.REGIONS.find(r=>r.place==='taiwan').id,unit:'liaodong-army'}),/运输船/);
 s=g.intervene(rich(),{type:'war',operation:'attack',target:'liaoshen',unit:'liaodong-army'});const u=s.militaryState.units[0];u.equipment={matchlock:1};u.needs={infantry:1};u.preferred={infantry:'matchlock'};for(let n=0;n<30&&u.equipment.matchlock;n++){const b=s.campaignState.battles[0];b.status='active';b.progress=0;s.campaignState.enemies.find(e=>e.region==='liaoshen').strength=150;settleCampaign(s,()=>true,true);}assert.equal(u.equipment.matchlock,0);snapshotState(s);
});

test('解除旧玩法名额：第四名专任、第九机构、第十三工程与第四十一案卷均能存档',()=>{
 let s=rich();for(const id of ['xu','bi','yuan','sun'])s=g.appoint(s,id);for(let n=0;n<9;n++)s=agency(s,'试务署'+n,'education','第'+n+'项专务');for(let n=0;n<13;n++)s=g.applyEdict(s,g.normalizeEdict({title:'试点'+n,narrative:'有据可验',cost:{money:1},project:{months:2,effects:{}}},s,'试点'+n));for(let n=0;n<42;n++)s=g.applyEdict(s,g.localEdict(s,'记录第'+n+'项行政交办'));assert.equal(s.officials.length,4);assert.equal(s.agencies.length,9);assert.equal(s.projects.length,13);assert.ok(s.affairs.length>=42);snapshotState(s);
});

test('缩编或裁撤真实降低后续需求，装备退库，战场中的部队须先撤军，旧月账保留',()=>{
 let s=month(rich()),ledger=structuredClone(s.ledger),original=g.forecast(s).expenses,stock=s.militaryState.stock.matchlock||0,assigned=s.militaryState.units[0].equipment.matchlock;s=g.intervene(s,{type:'arsenal',operation:'disband',unit:'liaodong-army'});assert.ok(g.forecast(s).expenses<original);assert.equal(s.militaryState.stock.matchlock,stock+assigned);assert.deepEqual(s.ledger,ledger);snapshotState(s);
 s=g.intervene(rich(),{type:'war',operation:'attack',target:'liaoshen',unit:'liaodong-army'});assert.throws(()=>g.intervene(s,{type:'arsenal',operation:'disband',unit:'liaodong-army'}),/先撤军/);s=g.intervene(s,{type:'war',operation:'retreat',battle:s.campaignState.battles[0].id});s=g.intervene(s,{type:'arsenal',operation:'disband',unit:'liaodong-army'});snapshotState(s);
});

test('政务需求可随制度工矿改进而下降，页面报价含需求与实拨覆盖率',()=>{
 const s=rich(),before=g.forecast(s),better=structuredClone(s);better.technology.governance=60;better.technology.industry=40;const after=g.forecast(better);assert.ok(after.baseAdministrationNeed<before.baseAdministrationNeed);assert.ok(after.entries.find(e=>e.id==='base:administration').money<before.entries.find(e=>e.id==='base:administration').money);assert.equal(after.administrationCoverage,1);snapshotState(month(better));
});

test('船只占用在探航和登陆间统一，补造船才可增加并行活动，取消后释放占用',()=>{
 let s=rich();s=g.intervene(s,{type:'horizon',operation:'voyage',route:'west'});assert.throws(()=>g.intervene(s,{type:'horizon',operation:'voyage',route:'south'}),/实际可用船只/);s.militaryState.stock.junk+=2;s=g.intervene(s,{type:'horizon',operation:'voyage',route:'south'});assert.equal(s.atlas.voyages.filter(v=>v.status==='sailing').length,2);s=g.intervene(s,{type:'horizon',operation:'recall',voyage:s.atlas.voyages[0].id});assert.equal(g.forecast(s).explorationExpenses,2);snapshotState(s);
});

test('无钱兑现的月拨不冒充预计边防成果，长期零俸也不会保留免费的全局工程加速',()=>{
 let s=rich();s=g.applyEdict(s,g.localEdict(s,'辽东整兵，每月拨5万两'));s.money=0;s.grain=0;const name=s.projects[0].name;assert.ok(!g.forecast(s).border.items.some(i=>i.name===name+'月度落实'));
 s=g.appoint(rich(),'song');s=g.setFiscal(s,{scope:'person',official:'song',monthly:0});for(let n=0;n<10;n++)s=month(s);assert.equal(compensationSupport(s,'song'),0);s=g.applyEdict(s,g.normalizeEdict({title:'待验工艺',narrative:'按期检查',cost:{money:1},project:{months:4,effects:{}}},s,'待验工艺'));s=month(s);assert.equal(s.projects[0].remaining,3);snapshotState(s);
});

test('现有整训政务改变实际部队训练，新军有供给时逐月训练，断供不凭空成长',()=>{
 let s=rich(),old=s.militaryState.units[0].training;s=g.doAction(s,'train');assert.equal(s.militaryState.units[0].training,old+6);s=g.intervene(s,{type:'arsenal',operation:'create_unit',template:'garrison',name:'待训新军'});const id=s.militaryState.units.at(-1).id,trained=month(s);assert.ok(trained.militaryState.units.find(u=>u.id===id).training>40);s.money=0;s.grain=0;const unpaid=month(s);assert.equal(unpaid.militaryState.units.find(u=>u.id===id).training,40);snapshotState(trained);snapshotState(unpaid);
});
