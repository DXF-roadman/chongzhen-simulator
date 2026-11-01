import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../engine.mjs';
import {economicPlan,canonicalDomain,activateEconomic,customsForecast} from '../economic-effects.mjs';
import {appendDiscussion} from '../dialogues.mjs';
import {isOrder} from '../counsel.mjs';
const input='着户部于泉州设市舶税关，颁通商许可，许商船往已探明海口市易。凡货利过千两者官抽其三，过万两者官抽其五。初次来市者减半抽分，只限一回。毕自严总核，福建地方官会同办理，按月报解。';
const raw={title:'泉州开海抽分',narrative:'设官秤、核税账，验放商船后按月报解。',feasibility:'设关后核验',cost:{money:8},domain:'财政',target:'zhemin',effects:{},regional:{},project:{months:3,effects:{navy:3}}};
const month=s=>g.advance({...s,event:null});
function ready(){let s=g.createGame({seed:202});s.money=1000;s.grain=1000;s.frontier=20;s=g.applyEdict(s,g.normalizeEdict(raw,s,input),'bi');for(let n=0;n<3&&s.projects.length;n++)s=month(s);return s;}

test('中文财政正确归类，已批准通商税令能从原文解析成真实税源，模型不能赠固定月银',()=>{
 assert.equal(isOrder('在民间颁布通商许可，以泉州为港口抽分'),true);assert.equal(isOrder('我们要颁布短中长期计划，争取国库半年后税收百万两'),false);
 const s=g.createGame(),p=g.normalizeEdict({...raw,economic:{port:'泉州',monthlyMoney:999999},effects:{money:999999}},s,input);assert.equal(canonicalDomain('财政'),'finance');assert.equal(canonicalDomain('文教'),'education');assert.equal(p.domain,'finance');assert.equal(p.economic.port,'泉州');assert.equal(p.economic.lowRate,.3);assert.equal(p.economic.highRate,.5);assert.equal(p.economic.firstTradeDiscount,.5);assert.equal(p.economic.monthlyMoney,undefined);assert.equal(p.effects.money,undefined);assert.equal(economicPlan({economic:{port:'泉州',monthlyMoney:999}},s,'整理朝廷文书'),null);
});
test('筹建不收税，验收后的月解持续到账；善后销案不会删除税关，入账可核对',()=>{
 let s=g.createGame({seed:203});s.money=1000;s.grain=1000;s.frontier=20;s=g.applyEdict(s,g.normalizeEdict(raw,s,input),'bi');assert.equal(g.forecast(s).customsRevenue,0);assert.equal(s.economy.customs.length,0);
 s=g.validateSave(s);assert.equal(s.projects[0].economic.lowRate,.3);s=month(s);assert.equal(g.forecast(s).customsRevenue,0);while(s.projects.length)s=month(s);assert.equal(s.economy.customs.length,1);assert.ok(g.forecast(s).customsRevenue>0);
 const f=g.forecast(s),money=s.money;s=month(s);assert.ok(Math.abs(s.money-money-f.net)<1e-9);assert.equal(s.ledger.customsRevenue,f.customsRevenue);assert.equal(Math.round(s.ledger.revenue*100),Math.round((f.ordinaryRevenue+f.customsRevenue)*100));assert.ok(s.history.some(h=>h.title==='海关月解 · 泉州'));assert.ok(s.institutionReports.some(r=>r.institution==='office:revenue'&&r.title==='海关月解 · 泉州'));
 const restored=g.validateSave(s);assert.deepEqual(restored.economy,s.economy);assert.deepEqual(restored.ledger,s.ledger);assert.equal(g.forecast(restored).customsRevenue,g.forecast(s).customsRevenue);for(let n=0;n<3;n++)s=month(s);assert.ok(g.forecast(s).customsRevenue>0);assert.equal(s.economy.customs.length,1);
});
test('没有工程的行政令也待善后核验后开征，存档不会丢失待办税源',()=>{
 let s=g.createGame();s.frontier=20;s=g.applyEdict(s,g.normalizeEdict({...raw,project:null},s,input));assert.equal(s.affairs[0].economic.port,'泉州');assert.equal(g.forecast(s).customsRevenue,0);s=g.validateSave(s);s=month(s);assert.equal(g.forecast(s).customsRevenue,0);s=month(s);assert.ok(g.forecast(s).customsRevenue>0);assert.equal(s.affairs.length,0);assert.equal(g.validateSave(s).economy.customs.length,1);
});
test('税源随实际海路、秩序与贪腐变化，卫星照亮未到达地点不会冒充通商',()=>{
 const s=ready(),base=customsForecast(s);const sea=structuredClone(s);sea.navy=90;assert.ok(customsForecast(sea).revenue>base.revenue);const clean=structuredClone(s);clean.corruption=0;assert.ok(customsForecast(clean).revenue>base.revenue);const discovered=structuredClone(s);discovered.atlas.discoveries.manila={visited:true,turn:s.turn,source:'voyage'};assert.ok(customsForecast(discovered).revenue>base.revenue);
 const satellite=structuredClone(s);satellite.atlas.allVisible=true;satellite.atlas.discoveries.manila={visited:false,turn:s.turn,source:'satellite'};assert.equal(customsForecast(satellite).revenue,base.revenue);const unrest=structuredClone(s);unrest.provinces.find(p=>p.id==='zhemin').unrest=90;assert.ok(customsForecast(unrest).revenue<base.revenue);
});
test('同港重拟章程只更新一个税源，停办后归零，未指定港口不能凭模型捏造收入',()=>{
 let s=ready();s.turn++;const p=economicPlan({},s,input);activateEconomic(s,{...p,edictTurn:s.turn},'泉州税例调整',s.turn-1);assert.equal(s.economy.customs.length,1);activateEconomic(s,{...p,operation:'close'},'关闭泉州税关');assert.equal(g.forecast(s).customsRevenue,0);assert.equal(economicPlan({economic:{port:'泉州',lowRate:1,highRate:1}},s,'请整理海贸利弊'),null);
});
test('复现旧档漏税：已执行并完工才能修复，文教积累移回财政，修复不扣钱不跳月也不重复',()=>{
 let s=g.createGame();s.turn=11;s.month=12;s.money=583;s.grain=335;s.technology.education=16;s.technology.finance=16.51;s.edicts=[{turn:6,title:raw.title,input}];s.institutions=[{id:'legacy-8-0',name:raw.title,domain:'education',turn:8,date:'九月'}];s.history.unshift({turn:8,date:'九月',title:'竣工 · '+raw.title,text:'已验收',type:'project'},{turn:9,date:'十月',title:'御批 · 新政回响：'+raw.title,text:'拨款推广，保存试验记录。',type:'event'});appendDiscussion(s,{id:'council',name:'御前议政'},input,'遵旨',[{type:'edict',text:input,plan:raw}],{status:'executed',text:'已办理'},'ai',g.dateLabel(s));delete s.economy;s=g.validateSave(s);
 const old=structuredClone(s),before=g.forecast(s),next=g.restoreEconomy(s),after=g.forecast(next);assert.equal(next.money,583);assert.equal(next.grain,335);assert.equal(next.turn,11);assert.equal(next.technology.education,0);assert.equal(next.technology.finance,32.51);assert.equal(next.institutions[0].domain,'finance');assert.ok(after.revenue>before.revenue);assert.equal(next.economy.customs[0].activeFromTurn,9);assert.deepEqual(g.restoreEconomy(next),next);assert.deepEqual(s,old);
 const discussionOnly=g.createGame();appendDiscussion(discussionOnly,{id:'council',name:'御前议政'},input,'拟议',[{type:'edict',text:input,plan:raw}],{status:'discussed',text:'仅商议'},'ai',g.dateLabel(s));assert.equal(g.restoreEconomy(discussionOnly).economy.customs.length,0);
});
test('错误税率和重复税源拒绝导入，预估不能靠伪造月银字段扩张',()=>{
 const s=ready(),negative=structuredClone(s);negative.economy.customs[0].highRate=-1;assert.throws(()=>g.validateSave(negative),/比例无效/);const repeat=structuredClone(s);repeat.economy.customs.push(repeat.economy.customs[0]);assert.throws(()=>g.validateSave(repeat),/持续税源/);const hacked=structuredClone(s);hacked.economy.customs[0].monthlyMoney=1e9;assert.equal(g.validateSave(hacked).economy.customs[0].monthlyMoney,undefined);
});
