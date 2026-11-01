import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../engine.mjs';
import {inferSupplies} from '../horizons.mjs';
import {localCounsel,executeCommands,isOrder,counselPrompt} from '../counsel.mjs';
const sample='其实我是穿越者 这300万两白银 300万石粮食你先偷偷拿去补足亏空 让国家继续运行 同时这另有50万两白银 你拿去命人研究蒸汽机与现代火炮补充军备';
test('玩家原句能识别明确行动，向孙承宗私下告知不会自动公开百官，银粮按万单位实际入库',()=>{
 const s=g.createGame();s.money=0;s.grain=0;const input=g.inferWorldCommands(s,sample,{target:'person:sun'});assert.equal(isOrder(sample),true);assert.deepEqual(input.map(c=>c.operation),['mode','confide','resources']);assert.equal(input[1].official,'sun');assert.equal(input[2].money,350);assert.equal(input[2].grain,300);
 const applied=executeCommands(s,input).state;assert.equal(applied.traveler.enabled,true);assert.equal(applied.traveler.identity,'hidden');assert.deepEqual(applied.traveler.knownTo,['sun']);assert.equal(applied.money,350);assert.equal(applied.grain,300);assert.equal(applied.traveler.energy,93);assert.equal(applied.traveler.supplies.length,1);assert.equal(applied.projects.length,0,'入库与研究开工分别记录，不伪称已研究成功');assert.deepEqual(g.validateSave(applied).traveler,applied.traveler);
 assert.match(counselPrompt(applied,{id:'person:sun',name:'孙承宗',bio:'首辅'}),/仅你私下知晓/);assert.match(counselPrompt(applied,{id:'person:bi',name:'毕自严',bio:'户部'}),/尚隐瞒/);assert.doesNotMatch(counselPrompt(applied,{id:'person:bi',name:'毕自严',bio:'户部'}),/仅你私下知晓/);
});
test('私下与公开分开处理，普通拨款不凭空增加资源，保密句不误取消其他明确行动',()=>{
 const s=g.createGame();assert.equal(isOrder('我是穿越者，但不要公开，掏出300万两白银'),true);assert.equal(isOrder('不要公开穿越者身份'),false);assert.equal(isOrder('如果我是穿越者能给你300万两吗'),false);
 const privateReply=localCounsel(s,{id:'person:sun',name:'孙承宗'},'我是穿越者，但不要公开，掏出300万两白银');assert.ok(privateReply.commands.some(c=>c.operation==='confide'));assert.equal(privateReply.commands.some(c=>c.operation==='disclose'),false);
 const open=g.inferWorldCommands(s,'向百官公开我是穿越者',{target:'person:sun'});assert.ok(open.some(c=>c.operation==='disclose'));assert.equal(open.some(c=>c.operation==='confide'),false);
 const ordinary=g.inferWorldCommands({...s,traveler:{...s.traveler,enabled:true}},'拨银50万两给工部研究蒸汽机',{target:'person:sun'});assert.equal(ordinary.some(c=>c.operation==='resources'),false);
 assert.deepEqual(inferSupplies('三百万两白银、三百万石粮食，另有五十万两白银'),{money:350,grain:300});assert.deepEqual(inferSupplies('20000两白银'),{money:2,grain:0});
});
test('银粮调取仍核验模式、数量与能量，失败不会半途更改状态',()=>{
 const s=g.createGame();assert.throws(()=>g.intervene(s,{type:'horizon',operation:'resources',money:300}),/先开启/);const active=g.intervene(s,{type:'horizon',operation:'mode',enabled:true}),before=structuredClone(active);
 for(const money of [NaN,-1,1000001])assert.throws(()=>g.intervene(active,{type:'horizon',operation:'resources',money}),/调取银粮/);assert.throws(()=>g.intervene(active,{type:'horizon',operation:'resources',money:50000}),/能量/);assert.deepEqual(active,before);
 const bad=structuredClone(active);bad.traveler.knownTo=['sun','sun'];assert.throws(()=>g.validateSave(bad),/知情名单/);
});
