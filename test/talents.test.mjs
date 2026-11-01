import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../engine.mjs';
import {settleTalents,inferRecruitment,talentExpenses,canServe} from '../talents.mjs';
const start=()=>g.createGame({seed:42});
function dispatch(s,terms={}){return g.applyEdict(s,g.recruitmentPlan(s,{target:'talent-1',grant:30,grain:15,amnesty:true,retainForces:true,...terms},'招安陕北流民首领'));}
function accepted(s=start(),terms={}){s=dispatch(s,terms);settleTalents(s,true,true,()=>0);return s;}
test('招安先遣使，未得回复不能任官，重复交涉不会覆盖条款',()=>{
 const s=start(),p=g.recruitmentPlan(s,{target:'talent-1'},'招安反民');assert.equal(s.money,460);assert.ok(p.recruitmentPreview.chance<100);
 const t=g.applyEdict(s,p);assert.equal(t.money,430);assert.equal(t.grain,245);assert.equal(t.actionsLeft,null);assert.equal(t.talents[0].status,'negotiating');assert.equal(g.officialCatalog(t).length,14);
 assert.throws(()=>g.appoint(t,'talent-1'),/尚未归附/);assert.throws(()=>dispatch(t),/交涉/);
});
test('受抚者进入人才库，可试任中枢或机构，保留忠诚与整编折扣',()=>{
 let s=accepted();assert.equal(s.talents[0].status,'probation');assert.equal(g.officialCatalog(s).length,15);
 s=g.appoint(s,'talent-1');assert.equal(s.officials[0],'talent-1');assert.ok(g.officialCatalog(s).find(o=>o.id==='talent-1').efficiency<1);
 s={...s,actionsLeft:3};s=g.applyEdict(s,g.institutionPlan(s,[{operation:'create_agency',name:'招抚司',mandate:'安置受抚部众',domain:'governance',powers:['execution'],budget:8}],'设立招抚司'));
 s=g.assignAgencyLeader(s,s.agencies[0].id,'talent-1');const restored=g.validateSave(JSON.parse(JSON.stringify(s)));
 assert.equal(restored.agencies[0].leader,'talent-1');assert.equal(restored.talents[0].loyalty,s.talents[0].loyalty);assert.ok(canServe(restored,'talent-1'));
});
test('拒绝招安不会增加可用人才，已发生的使团准备支出不返还',()=>{
 const s=dispatch(start());settleTalents(s,true,true,()=>.999);assert.equal(s.talents[0].status,'independent');assert.equal(g.officialCatalog(s).length,14);assert.equal(s.money,430);
});
test('受抚部众有持续钱粮开支，守约后观察期结束，断饷会动摇忠诚',()=>{
 const base=start(),s=accepted();const cost=talentExpenses(s);assert.ok(cost.money>0);assert.ok(cost.grain>0);
 assert.equal(g.forecast(s).expenses-g.forecast(base).expenses,cost.money);
 const before=s.talents[0].loyalty;settleTalents(s,true,true,()=>0);settleTalents(s,true,true,()=>0);assert.equal(s.talents[0].status,'available');assert.ok(s.talents[0].loyalty>before);
 settleTalents(s,false,true,()=>0);assert.ok(s.talents[0].loyalty<before);assert.equal(s.talents[0].missedPay,1);
});
test('保留部众且忠诚崩溃会再叛，中央及机构差遣同步清空',()=>{
 const s=accepted();s.officials=['talent-1'];s.agencies=[{id:'agency-1',name:'地方统筹署',leader:'talent-1'}];
 s.talents[0].loyalty=25;const army=s.army,unrest=s.provinces.find(p=>p.id==='shaanxi').unrest;
 const reports=settleTalents(s,false,false,()=>0);assert.equal(s.talents[0].status,'rebelled');assert.equal(s.officials.length,0);assert.equal(s.agencies[0].leader,null);assert.equal(g.officialCatalog(s).length,14);assert.ok(s.army<army);assert.ok(s.provinces.find(p=>p.id==='shaanxi').unrest>unrest);assert.ok(reports.some(r=>r.title.startsWith('再叛')));
});
test('不保留旧部的失信结果为离散，招安成功并非永久忠诚',()=>{
 const s=accepted(start(),{retainForces:false});s.talents[0].loyalty=25;
 settleTalents(s,false,true,()=>0);assert.equal(s.talents[0].status,'departed');assert.equal(g.officialCatalog(s).length,14);
});
test('自由政令支持新姓名及招安与设署联合颁行，AI不能直接赠送忠诚与兵力',()=>{
 let s=start();const p=g.localEdict(s,'招安高三虎所部，设立招抚司，负责安置流民');
 assert.equal(p.recruitment.name,'高三虎');assert.equal(p.institutionChanges[0].name,'招抚司');s=g.applyEdict(s,p);
 assert.equal(s.agencies.length,1);assert.equal(s.talents.length,4);assert.equal(s.talents[3].status,'negotiating');assert.equal(s.talents[3].origin,'player');
 const raw=g.normalizeEdict({title:'纳降',narrative:'立即效忠',recruitment:{target:'talent-1',grant:0,grain:0,chance:1000,loyalty:100,command:999,troops:1000},effects:{army:999}},start(),'招安反民');
 assert.equal(raw.cost.money,12);assert.ok(raw.recruitment.chance<=90);assert.equal(raw.effects.army,undefined);
 assert.equal(inferRecruitment(start(),'不要招安反民'),null);
});
test('旧档兼容新线索，导入拒绝虚假任用、重复人物与伪造条款',()=>{
 const old=start();delete old.talents;delete old.nextTalentId;assert.equal(g.validateSave(old).talents.length,3);
 assert.throws(()=>g.validateSave({...start(),officials:['talent-1']}),/人物/);
 const s=dispatch(start());assert.equal(g.validateSave(s).talents[0].negotiation.remaining,1);
 assert.throws(()=>g.validateSave({...s,talents:[...s.talents,...s.talents]}),/重复/);
 const tampered=structuredClone(s);tampered.talents[0].negotiation.chance=1000;assert.throws(()=>g.validateSave(tampered),/条款/);
});
