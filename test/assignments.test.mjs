import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../engine.mjs';
import {leaderEfficiency,workload} from '../assignments.mjs';
const month=s=>g.advance({...s,event:null});
test('中枢满三人仍可任六部主官、机构主官及逐项督办',()=>{
 let s=g.createGame({seed:20});for(const id of ['sun','yuan','bi'])s=g.appoint(s,id);
 s=month(s);s=g.assignOfficeLeader(s,'revenue','bi');
 s=g.doAction(s,'irrigation','shaanxi','xu');s=g.doAction(s,'train',null,'lu');
 assert.equal(s.officials.length,3);assert.equal(s.government.officeLeaders.revenue,'bi');assert.equal(s.projects[0].leader,'xu');assert.equal(s.affairs[0].leader,'lu');
 assert.equal(g.forecast(s).dutyExpenses,2);assert.equal(g.coreOffices(s).length,8);
 const h=g.applyEdict({...s,actionsLeft:3},g.localEdict(s,'废内阁'));assert.equal(g.coreOffices(h).length,7);assert.equal(h.government.officeLeaders.revenue,'bi');
});
test('紧急事件可在零施政时随批复派人，善后保留原批复并追加落实成效',()=>{
 const base={...g.createGame({seed:21}),actionsLeft:0};
 let a=g.resolveEvent(base,0,'xu'),b=g.resolveEvent(base,0);
 assert.equal(a.actionsLeft,null);assert.equal(a.money,b.money);assert.equal(a.stability,b.stability);assert.equal(a.affairs[0].leader,'xu');assert.match(a.affairs[0].order,/拨粮/);
 assert.throws(()=>g.resolveEvent(base,0,'talent-1'),/负责人/);assert.equal(base.event.id,'drought');
 for(let i=0;i<2;i++){a=month(a);b=month(b);}
 assert.equal(a.affairs.length,0);assert.ok(a.stability>b.stability);assert.ok(a.provinces[3].unrest<b.provinces[3].unrest);assert.ok(a.history.some(h=>h.title.startsWith('销案')&&h.text.includes('徐光启')));
});
test('工程督办积累进度、按适配加速，可中途换人与解除',()=>{
 let a=g.doAction(g.createGame({seed:22}),'arsenal',null,'song');let b=g.doAction(g.createGame({seed:22}),'arsenal');
 for(let i=0;i<2;i++){a=month(a);b=month(b);}
 assert.ok(a.projects[0].workCredit>0);assert.equal(a.projects[0].remaining,2);
 a=month(a);b=month(b);assert.equal(a.projects.length,0);assert.equal(b.projects.length,1);
 b=g.assignDuty(b,'project',b.projects[0].id,'xu');assert.equal(b.actionsLeft,null);assert.equal(b.projects[0].leader,'xu');
 b=g.assignDuty(b,'project',b.projects[0].id,null);assert.equal(b.projects[0].leader,null);
 assert.throws(()=>g.assignDuty(b,'project','missing','sun'),/结束/);
});
test('三项以上兼任同时削弱主官和中枢能力，解除后恢复',()=>{
 let s=g.assignOfficeLeader(g.createGame({seed:23}),'revenue','bi');s=g.appoint(s,'bi');
 const efficient=leaderEfficiency(s,'bi','finance'),tax=g.forecast(s).revenue;
 s=g.doAction(s,'irrigation','shaanxi','bi');assert.equal(workload(s,'bi'),3);assert.ok(leaderEfficiency(s,'bi','finance')<efficient);assert.ok(g.forecast(s).revenue<tax);
 s=g.assignDuty({...s,actionsLeft:1},'project',s.projects[0].id,null);assert.equal(workload(s,'bi'),2);assert.equal(leaderEfficiency(s,'bi','finance'),efficient);
});
test('欠督办差旅暂停额外推进，已预付工程继续基础施工',()=>{
 let s=g.doAction(g.createGame({seed:24}),'arsenal',null,'song');s=g.resolveEvent(s,2,'xu');
 s=month({...s,money:0,tax:.8});assert.equal(s.affairs[0].remaining,2);assert.equal(s.projects[0].workCredit,0);assert.equal(s.projects[0].remaining,3);assert.ok(s.notices.some(n=>n.includes('欠拨')));
});
test('指名督办落实到自由诏令，前端可覆盖；旧档迁移并校验完整人事',()=>{
 let s=g.createGame({seed:25});const p=g.localEdict(s,'命宋应星督办火器工坊');s=g.applyEdict(s,p);assert.equal(s.projects[0].leader,'song');
 s=g.assignOfficeLeader(s,'works','song');s=g.resolveEvent(s,0,'xu');s=month(s);
 const restored=g.validateSave(JSON.parse(JSON.stringify(s)));assert.equal(restored.projects[0].leader,'song');assert.equal(restored.projects[0].workCredit,s.projects[0].workCredit);assert.deepEqual(restored.affairs,s.affairs);assert.deepEqual(restored.government.officeLeaders,s.government.officeLeaders);
 const old=g.createGame({seed:26});delete old.affairs;delete old.government.officeLeaders;assert.deepEqual(g.validateSave(old).affairs,[]);
 assert.throws(()=>g.validateSave({...s,projects:[{...s.projects[0],leader:'intruder'}]}),/负责人/);
 assert.throws(()=>g.validateSave({...s,affairs:[{...s.affairs[0],remaining:-1}]}),/事务/);
 assert.throws(()=>g.validateSave({...s,government:{...s.government,officeLeaders:{works:'intruder'}}}),/主官/);
 assert.equal(g.inferDutyLeader(s,'不要任命宋应星督办'),null);
 assert.equal(g.applyEdict({...s,actionsLeft:1},p,'xu').projects.at(-1).leader,'xu');
 const first=g.doAction(g.createGame({seed:28}),'train',null,'sun');const again=g.doAction(g.validateSave(first),'rest',null,'bi');assert.equal(new Set(again.affairs.map(a=>a.id)).size,2);assert.equal(g.validateSave(again).affairs.length,2);
});
test('受抚者离散或再叛同时清空常设主官、工程和善后差遣',()=>{
 let s=g.createGame({seed:27});Object.assign(s.talents[0],{status:'available',loyalty:1,integration:20,upkeep:5,retainForces:true});
 s=g.assignOfficeLeader(s,'war','talent-1');s=g.doAction(s,'arsenal',null,'talent-1');s=g.resolveEvent(s,2,'talent-1');
 s=month({...s,money:0,grain:0,tax:.8});assert.equal(s.talents[0].status,'rebelled');assert.equal(s.government.officeLeaders.war,undefined);assert.equal(s.projects[0].leader,null);assert.equal(s.affairs[0].leader,null);
});
