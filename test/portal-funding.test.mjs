import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../engine.mjs';
import {executeCommands} from '../counsel.mjs';
import {inferInstitutionChanges} from '../governance.mjs';
import {batchFinance} from '../funding.mjs';
import {trial,batch} from './portal-fixture.mjs';
export function emptyTreasury(){const s=g.createGame({mode:'traveler'});Object.assign(s,{money:0,grain:38,month:6,turn:5});delete s.yearRecord;for(let eventSerial=0;eventSerial<12;eventSerial++){const next=g.validateSave({...s,eventSerial,event:structuredClone(g.EVENTS[eventSerial%g.EVENTS.length])});if(next.event?.id==='border')return next;}throw Error('border event unavailable');}
test('复现实际失败批次：先调入24万两支边，再由虫洞供试作所6万两，不向空国库要36万',()=>{
 const s=emptyTreasury(),before=structuredClone(s),r=executeCommands(s,batch),next=r.state;
 assert.deepEqual(s,before);assert.equal(next.money,0);assert.equal(next.grain,44);assert.equal(next.traveler.energy,97);assert.equal(next.traveler.supplies.length,3);assert.equal(next.projects.length,1);assert.equal(next.projects[0].funding,'portal');assert.equal(next.agencies.length,0);assert.equal(next.event,null);
 assert.equal(r.commands.at(-1).plan.cost.money,6);assert.equal(r.commands.at(-1).funding,'portal');assert.match(r.result.text,/虫洞调入：白银 30 万两、粮食 18 万石/);assert.match(r.result.text,/国库净变化 0 万两，官仓净变化 \+6 万石/);assert.doesNotMatch(r.result.text,/白银净支出 -/);
 assert.deepEqual(batchFinance(s,next),{portalMoney:30,portalGrain:18,netMoney:0,netGrain:6,energyUsed:3});assert.equal(g.validateSave(next).projects[0].funding,'portal');assert.deepEqual(g.validateSave(next).traveler.supplies,next.traveler.supplies);
});
test('纯取钱只入库不扣白银，转给项目是另一项，能量不足时整批保持原状',()=>{
 const s=emptyTreasury(),r=executeCommands(s,[{type:'horizon',operation:'resources',money:10,grain:0}]);assert.equal(r.state.money,10);assert.equal(r.state.traveler.energy,99);assert.match(r.result.text,/国库净变化 \+10/);assert.equal(r.state.projects.length,0);
 const low={...s,traveler:{...s.traveler,energy:2}},before=structuredClone(low);assert.throws(()=>executeCommands(low,batch),/第 4 项.*能量/);assert.deepEqual(low,before);
});
test('附属工坊按工程处理，明确独立机构仍可设署；普通项目继续受国库预算约束',()=>{
 const s=emptyTreasury();assert.equal(inferInstitutionChanges(s,trial.text).length,0);assert.equal(inferInstitutionChanges(s,'设立皇家试验所，作为独立机构，授予独立职权').length,1);
 const p=g.normalizeEdict(trial.plan,s,trial.text);assert.equal(p.cost.money,6);assert.equal(p.cost.grain,2);assert.equal(p.funding,'portal');assert.equal(p.project.months,4);assert.equal(p.institutionChanges,undefined);
 const ordinary=g.normalizeEdict({...trial.plan,feasibility:'由现有国库按预算试行。'},s,trial.text);assert.equal(ordinary.cost.money,6);assert.throws(()=>g.applyEdict(s,ordinary),/国库需要 6/);
 const normal=g.createGame();assert.throws(()=>g.normalizeEdict({...trial.plan,funding:'portal'},normal,trial.text),/先明确开启/);
});
test('明确虫洞支付的行动可以先入库再支付，出入库账目能分清，调取操作会先于开支',()=>{
 const s=emptyTreasury(),ordered=executeCommands(s,[{type:'event',index:0},{type:'horizon',operation:'resources',money:24,grain:10}]);assert.equal(ordered.commands[0].operation,'resources');assert.equal(ordered.state.money,0);
 const r=executeCommands(s,[{type:'event',index:0,funding:'portal'}]);assert.equal(r.state.money,0);assert.equal(r.state.grain,38);assert.equal(r.state.traveler.supplies[0].money,24);assert.equal(r.state.affairs[0].funding,'portal');
});
test('虫洞供给工程的月度督办费不会重新记入国库，存读档保留来源，断能不改从国库扣',()=>{
 let s=executeCommands(emptyTreasury(),[trial]).state;s=g.validateSave(s);assert.equal(g.forecast(s).dutyExpenses,0);assert.equal(g.forecast(s).portalDutyExpenses,1);const energy=s.traveler.energy;
 s=g.advance({...s,event:null});assert.equal(s.traveler.energy,energy-1+3,'闭门月度补能3点，督办另耗1点');assert.ok(s.projects[0].workCredit>0);assert.equal(s.money,0);assert.equal(s.projects[0].funding,'portal');
 const noPower={...s,traveler:{...s.traveler,enabled:false,portal:false}},n=g.advance({...noPower,event:null});assert.match(n.notices.join(' '),/未转向国库扣款/);assert.equal(g.forecast(n).dutyExpenses,0);assert.equal(n.money,0);
});
