import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../engine.mjs';
const rich=()=>({...g.createGame({seed:106}),money:50000,grain:50000,frontier:65}),month=s=>g.advance({...s,event:null});
test('前线任将与实际配装降低日常边防净压力；库存和内地驻军不冒充前线装备',()=>{
 let s=rich();const before=g.forecast(s).border.net;s=g.intervene(s,{type:'war',operation:'commander',unit:'liaodong-army',official:'yuan'});assert.ok(g.forecast(s).border.net<before);const assigned=g.forecast(s).border.net,stock=structuredClone(s);stock.militaryState.stock.cannon=99999;assert.equal(g.forecast(stock).border.net,assigned);
 s.militaryState.units.find(u=>u.id==='liaodong-army').equipment.cannon=120;s.militaryState.units.find(u=>u.id==='liaodong-army').equipment.matchlock=6000;assert.ok(g.forecast(s).border.net<assigned);assert.ok(g.forecast(s).border.net<0);const n=month(s);assert.ok(n.frontier<s.frontier);assert.ok(n.ledger.border.items.some(r=>r.name.includes('统帅指挥')));assert.ok(n.ledger.frontierActual<0);assert.equal(g.validateSave(n).militaryState.units[0].commander,'yuan');
});
test('断饷断粮失去前线部署加成，战场实控和敌方兵力减少会反映到外部压力',()=>{
 let s=rich();s=g.intervene(s,{type:'war',operation:'commander',unit:'liaodong-army',official:'yuan'});const healthy=g.forecast(s).border.net;s.money=0;s.grain=0;const n=month(s);assert.ok(!n.ledger.border.items.some(r=>r.name.includes('统帅指挥')));assert.ok(n.ledger.border.net>healthy);
 s=rich();const old=g.forecast(s).border.items[0].value;for(const r of g.REGIONS.filter(r=>['jin','mongol'].includes(r.owner)))s.campaignState.control[r.id]='ming';assert.ok((g.forecast(s).border.items.find(r=>r.name==='边外动员与时代压力')?.value||0)<old);
});
test('原旨督师蓟辽补为持续前线军职，沿用旧饷不多收费，未批准的月拨仍只留建议',()=>{
 let s=rich();s.monthlyAuditVersion=0;s.edicts=[{title:'辽东整兵核饷',turn:0,input:'着袁崇焕以督师蓟辽衔赴辽东前锋，边饷仍由户部按辽饷旧例调拨，本差概不拨银粮。'}];s.service.recommendations=[{id:'recommendation-1',person:'civil-head-war',institution:'office:war',task:'派人去辽东整兵，月拨5万两',status:'proposed',turn:0,mission:{type:'edict',text:'派人去辽东整兵，月拨5万两',domain:'military',plan:'辽东整兵核饷'}}];const f=g.forecast(s),next=g.restoreMonthlyState(s);assert.equal(next.militaryState.units[0].commander,'yuan');assert.equal(next.militaryState.units[0].commanderIncludedInBase,true);assert.equal(g.forecast(next).expenses,f.expenses);assert.ok(g.forecast(next).border.net<f.border.net);assert.equal(next.service.recommendations[0].mission.monthly.money,5);assert.equal(next.service.recommendations[0].status,'proposed');assert.equal(next.projects.length,0);assert.equal(next.money,s.money);assert.deepEqual(g.restoreMonthlyState(next),next);assert.equal(g.validateSave(next).militaryState.units[0].commanderIncludedInBase,true);
});
test('后续明确解除军权的原旨优先，不因旧督师记录而自动复任',()=>{
 const s=rich();s.monthlyAuditVersion=0;s.edicts=[{title:'解除军权',turn:1,input:'命袁崇焕交出辽东兵权，解除督师差遣。'},{title:'原任督师',turn:0,input:'命袁崇焕以督师蓟辽衔赴任，沿用辽饷旧例。'}];const next=g.restoreMonthlyState(s);assert.equal(next.militaryState.units[0].commander??null,null);assert.equal(next.militaryState.units[0].commanderIncludedInBase,undefined);
});
