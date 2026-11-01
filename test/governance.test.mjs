import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../engine.mjs';
import {inferInstitutionChanges,agencyStrength} from '../governance.mjs';
const clean=s=>s.event?g.resolveEvent(s,s.event.options.findIndex(o=>Object.entries(o.cost||{}).every(([k,v])=>s[k]>=v))):s;
const create=(s,name,domain='education',powers=['research'])=>g.applyEdict(s,g.institutionPlan(s,[{operation:'create_agency',name,domain,powers,budget:8,mandate:'依诏办理相关事务'}],'设立'+name));
test('废阁立即改变制度、额度与支持；离线称谓跟随实际中枢',()=>{
 const s=g.createGame({seed:80});const plan=g.localEdict(s,'朕要废内阁，六部直接奏事');
 assert.equal(plan.institutionChanges[0].operation,'abolish_cabinet');assert.equal(s.government.cabinet,true);
 const t=g.applyEdict(s,plan);assert.equal(t.government.cabinet,false);assert.equal(t.actionsLeft,null);
 assert.equal(t.factions.scholar,44);assert.equal(t.legitimacy,66);assert.equal(g.administration(t).capacity,null);
 assert.match(g.localEdict(t,'陕西赈灾').narrative,/六部与受命官员/);
 assert.doesNotMatch(g.localEdict(t,'陕西赈灾').narrative,/内阁/);
 const u=g.advance(clean(t));assert.equal(u.actionsLeft,null);assert.equal(u.event,null,'交接负担会实际结算，但不强制每月再出一份改制危机');assert.ok(u.government.burden>t.government.burden);
 const restored=g.applyEdict(u,g.localEdict(u,'恢复内阁'));
 assert.equal(restored.government.cabinet,true);assert.equal(g.administration(restored).capacity,null);
});
test('任意新机构有独立名称、筹备、经费、人员与持续研究成效',()=>{
 let s=g.createGame({seed:81});
 s=create(s,'皇家科学院');assert.equal(s.agencies.length,1);assert.equal(s.projects.length,0);assert.equal(s.agencies[0].remaining,2);
 assert.equal(g.forecast(s).agencyExpenses,8);
 s=g.assignAgencyLeader(s,s.agencies[0].id,'xu');assert.equal(g.forecast(s).agencyExpenses,10);
 for(let i=0;i<2;i++)s=g.advance(clean(s));
 assert.equal(s.agencies[0].status,'active');assert.equal(s.tech,8);
 const old=s.tech;s=g.advance(clean(s));assert.ok(s.tech>old);assert.ok(s.technology.education>0);
});
test('废阁后可用新政务院接续协调，筹备或人手未齐时不会生效',()=>{
 let s=g.createGame({seed:82});
 const p=g.localEdict(s,'废内阁，另设政务院，统筹六部，每月拨银8万两');
 assert.equal(p.institutionChanges.length,2);
 s=g.applyEdict(s,p);assert.equal(s.agencies[0].name,'政务院');assert.equal(g.administration(s).capacity,null);
 const id=s.agencies[0].id;s=g.assignAgencyLeader(s,id,'bi');
 for(let i=0;i<2;i++)s=g.advance(clean(s));
 assert.equal(g.administration(s).name,'政务院统筹');assert.equal(s.actionsLeft,null);
 s=g.setAgencyBudget(s,id,0);assert.equal(g.administration(s).capacity,null);
 const saved=g.validateSave(s);assert.equal(saved.government.cabinet,false);assert.equal(saved.agencies[0].leader,'bi');assert.equal(saved.agencies[0].budget,0);
});
test('裁撤、改组、重复机构、兼任与欠拨均按规则处理',()=>{
 let s=create(g.createGame({seed:83}),'审计院','finance',['oversight','execution']);
 assert.throws(()=>create(s,'审计院'),/同名/);
 s=create(s,'皇家科学院');s=g.assignAgencyLeader(s,s.agencies[0].id,'xu');
 const shared=g.assignAgencyLeader({...s,actionsLeft:3},s.agencies[1].id,'xu');assert.equal(shared.agencies[1].leader,'xu');assert.equal(g.officialCatalog(shared).find(o=>o.id==='xu').workload,2);
 const id=s.agencies[0].id;
 s={...s,actionsLeft:3};s=g.applyEdict(s,g.institutionPlan(s,[{operation:'amend_agency',target:id,name:'国用审计院',domain:'governance',powers:['oversight'],budget:6}],'改组审计院'));
 assert.equal(s.agencies[0].name,'国用审计院');assert.equal(s.agencies[0].remaining,2);
 s={...s,money:0,tax:.8,event:null};s=g.advance(s);assert.equal(s.agencies[0].remaining,2);assert.equal(s.agencies[0].funded,false);
 s={...s,money:400,actionsLeft:3};s=g.applyEdict(s,g.localEdict(s,'裁撤国用审计院'));
 assert.equal(s.agencies.length,1);assert.equal(s.agencies[0].name,'皇家科学院');
});
test('预设知识积累与有权限的机构相互独立，空壳和重叠机构收益较弱',()=>{
 let s=create(g.createGame({seed:84}),'军工研究院','military',['research']);s.agencies[0].status='active';s.agencies[0].remaining=0;
 const empty=agencyStrength(s,s.agencies[0]);s.agencies[0].leader='song';assert.ok(agencyStrength(s,s.agencies[0])>empty);
 const full=agencyStrength(s,s.agencies[0]);s=create({...s,actionsLeft:3},'火器研究所','military',['research']);s.agencies[1].status='active';
 assert.ok(agencyStrength(s,s.agencies[0])<full);
});
test('旧存档自动补入常制，新制度和机构完整往返并拒绝无效数据',()=>{
 const old=g.createGame({seed:85});delete old.government;delete old.agencies;
 assert.equal(g.validateSave(old).government.cabinet,true);
 const s=create(g.createGame({seed:86}),'皇家科学院');const restored=g.validateSave(s);assert.deepEqual(restored.agencies,s.agencies);
 assert.throws(()=>g.validateSave({...s,government:{...s.government,cabinet:'no'}}),/制度/);
 assert.throws(()=>g.validateSave({...s,agencies:[...s.agencies,...s.agencies]}),/重复/);
});
test('AI 缺少结构字段时仍落实明确废阁/设署指令，且无法附赠任意收益',()=>{
 const s=g.createGame({seed:87});
 const p=g.normalizeEdict({title:'废阁',narrative:'遵旨',effects:{tech:999},project:{months:2,effects:{tech:999}},cost:{money:0}},s,'废内阁');
 assert.equal(p.cost.money,20);assert.equal(p.project,null);assert.deepEqual(p.effects,{});
 assert.equal(g.applyEdict(s,p).government.cabinet,false);
 assert.equal(inferInstitutionChanges(s,'不要废内阁，也不要新设皇家科学院').length,0);
 assert.equal(inferInstitutionChanges(s,'不要恢复内阁').length,0);
});
