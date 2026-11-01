import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../engine.mjs';
import {settleInstitutions} from '../governance.mjs';
import {bindInstitutionTasks,recordInstitution} from '../institution-records.mjs';
const createAgency=()=>{let s=g.createGame({seed:160});s=g.applyEdict(s,g.specialPlan(s,[{operation:'create_agency',name:'试行审计署',mandate:'稽核账册并开展审计研究',domain:'governance',powers:['research','oversight'],budget:8,leader:'bi'}],null,'设立试行审计署'));return s;};
test('锦衣卫为常设机构，旧档可见且未任命时不增开支，任命后职务与月报可保存',()=>{
 const old=g.createGame(),base=g.forecast(old).agencyExpenses;assert.ok(g.coreOffices(g.validateSave(old)).some(o=>o.id==='guards'&&o.name==='锦衣卫'));let s=g.assignOfficeLeader(old,'guards','lu');assert.equal(g.officialCatalog(s).find(o=>o.id==='lu').positionLabel,'锦衣卫指挥使');assert.equal(g.forecast(s).agencyExpenses,base+2);settleInstitutions(s,true);assert.ok(s.institutionReports.some(r=>r.institution==='office:guards'));assert.equal(g.validateSave(s).government.officeLeaders.guards,'lu');
});
test('机构月报记录本署实际增益，指标达上限不报告虚假成果',()=>{
 let s=createAgency();Object.assign(s.agencies[0],{status:'active',remaining:0});const before={tech:s.tech,corruption:s.corruption,knowledge:s.technology.governance};settleInstitutions(s,true);const r=s.institutionReports.find(r=>r.institution==='agency:agency-1');
 assert.equal(r.status,'active');assert.equal(r.budget,10);assert.equal(r.leader,'bi');assert.equal(r.effects.tech,Math.round((s.tech-before.tech)*1000)/1000);assert.equal(r.effects.corruption,Math.round((s.corruption-before.corruption)*1000)/1000);assert.equal(r.knowledge.governance,Math.round((s.technology.governance-before.knowledge)*1000)/1000);assert.ok(r.effects.corruption<0);assert.ok(r.knowledge.governance>0);
 s.tech=100;s.corruption=0;s.technology.governance=100;settleInstitutions(s,true);const capped=s.institutionReports[0];assert.deepEqual(capped.effects,{});assert.deepEqual(capped.knowledge,{});assert.equal(s.tech,100);
});
test('筹备与欠拨月报如实显示停滞，不赠送收益，机构记录可存读并有上限',()=>{
 const s=createAgency(),baseline=s.tech;settleInstitutions(s,true);assert.equal(s.agencies[0].remaining,1);assert.equal(s.institutionReports[0].status,'forming');assert.deepEqual(s.institutionReports[0].knowledge,{});settleInstitutions(s,false);assert.equal(s.agencies[0].remaining,1);assert.equal(s.institutionReports[0].status,'unfunded');assert.equal(s.tech,baseline);
 for(let i=0;i<20;i++)recordInstitution(s,'agency:agency-1','试行审计署',{kind:'month',status:'unfunded',title:'本月停拨',text:'无增益',budget:10});assert.equal(s.institutionReports.filter(r=>r.institution==='agency:agency-1').length,8);assert.deepEqual(g.validateSave(s).institutionReports,s.institutionReports);
 const bad=structuredClone(s);bad.institutionReports[0].effects={money:Infinity};assert.throws(()=>g.validateSave(bad),/机构成效数值/);const invalid=structuredClone(s);invalid.institutionReports[0].institution='script:bad';assert.throws(()=>g.validateSave(invalid),/机构月报字段/);
});
test('向机构交办的新工程和善后持久保存归属，真正结案后才成为本署成果',()=>{
 const before=g.createGame();let s=g.doAction(before,'irrigation','shaanxi','xu');s=g.doAction(s,'relief','henan');bindInstitutionTasks(before,s,'office:works');assert.equal(s.projects[0].institution,'office:works');assert.equal(s.affairs[0].institution,'office:works');assert.equal(s.institutionReports.filter(r=>r.kind==='completion').length,0);
 s=g.validateSave(s);assert.equal(s.projects[0].institution,'office:works');assert.equal(s.affairs[0].institution,'office:works');for(let i=0;i<3;i++)s=g.advance({...s,event:null});const results=s.institutionReports.filter(r=>r.kind==='completion');assert.ok(results.some(r=>r.title==='竣工 · 兴修水利'&&r.institution==='office:works'&&r.knowledge.agriculture===12));assert.ok(results.some(r=>r.title==='销案 · 开仓赈济'));assert.equal(s.projects.length,0);assert.deepEqual(g.validateSave(s).institutionReports,s.institutionReports);
 const old=g.doAction(g.createGame(),'arsenal',null,'song'),next=g.assignOfficeLeader(old,'works','song');bindInstitutionTasks(old,next,'office:works');assert.equal(next.projects[0].institution,undefined,'兼任关系不能把已有工程自动认领成本署新交办成果');
 const bad=structuredClone(next);bad.projects[0].institution='office:unknown';assert.throws(()=>g.validateSave(bad),/承办机构/);
});
