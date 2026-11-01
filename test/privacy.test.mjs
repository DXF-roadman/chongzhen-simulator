import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../engine.mjs';
import {privacyView,knowsTraveler,privateDisclosure,explicitPublicDisclosure} from '../privacy-rules.mjs';
import {buildCounselMessages,buildAcceptanceMessages,currentFacts} from '../counsel.mjs';
import {snapshotState,restoreState} from '../state-store.mjs';
import {privacyGame,secretName,guard,council} from './privacy-fixture.mjs';
import {armory} from '../public/frontiers.js';
test('私述来历记给机构与当前主官，不会默认向百官公开，否定和假设不泄密',()=>{
 const s=g.createGame(),text='仅由锦衣卫所知，朕其实是穿越者，锦衣卫即日起仅为我负责',commands=g.inferWorldCommands(s,text,{target:guard.id});assert.ok(commands.some(c=>c.operation==='confide'&&c.institution===guard.id));assert.ok(!commands.some(c=>c.operation==='disclose'));let n=g.intervene(s,{type:'horizon',operation:'confide',institution:guard.id});assert.equal(n.traveler.enabled,false,'私下说话不自动开启实际能力');assert.equal(n.traveler.identity,'hidden');assert.deepEqual(n.traveler.knownTo,[guard.id,'civil-head-guards']);assert.equal(knowsTraveler(n,guard),true);assert.equal(knowsTraveler(n,{id:'person:civil-head-guards'}),true);assert.equal(knowsTraveler(n,council),false);assert.equal(knowsTraveler(n,{id:'office:revenue'}),false);assert.deepEqual(restoreState(n),n);
 const c=g.inferWorldCommands(s,'我是穿越者，但不要告诉毕自严，也不要公开',{target:guard.id});assert.ok(c.some(c=>c.institution===guard.id));assert.ok(!c.some(c=>c.official==='bi'||c.operation==='disclose'));assert.equal(privateDisclosure(s,'如果我是穿越者，只有你知道',guard),null);assert.equal(explicitPublicDisclosure('公开穿越者身份，但不要加税'),true);assert.equal(explicitPublicDisclosure('不要公开穿越者身份'),false);snapshotState(n);
});
test('公开会议的快照、目录、月账、人事与旧越界答复都不含密营或真实能量',()=>{
 const s=privacyGame();s.notices.push(secretName+'补给已落实，供给来自虫洞。');const before=structuredClone(s),history=s.discussions.find(t=>t.id==='council').messages,messages=buildCounselMessages(s,council,'请据正常军务献策',history),json=JSON.stringify(messages);assert.doesNotMatch(json,new RegExp(secretName));assert.doesNotMatch(json,/"energy":137|\\"energy\\":137|能量137/);assert.doesNotMatch(json,/supply-\d+-\d+/);assert.doesNotMatch(json,/"equipment":"rifle"|\\"equipment\\":\\"rifle\\"/);assert.match(json,/此前这条答复引用了/);assert.deepEqual(s,before);
 const p=privacyView(s,council),f=currentFacts(s,council);assert.ok(!p.state.militaryState.units.some(u=>u.secret));assert.ok(!f.revenueForecast.entries.some(e=>e.funding==='portal'||e.name.includes(secretName)));assert.equal(f.money,s.money);assert.equal(f.revenueForecast.revenue,g.forecast(s).revenue);assert.equal(f.revenueForecast.expenses,g.forecast(s).expenses);assert.ok(!f.payroll.find(p=>p.id==='civil-head-guards').payByRole.commander);
});
test('锦衣卫与知情主官可议自己的密营，别署和仅私知身份的外人看不到该营',()=>{
 let s=privacyGame();for(const target of [guard,{id:'person:civil-head-guards'}]){const json=JSON.stringify(buildCounselMessages(s,target,'核对本署军备',[]));assert.match(json,new RegExp(secretName));assert.match(json,/137/);assert.match(json,/仅你私下知晓/);}
 s=g.intervene(s,{type:'horizon',operation:'confide',official:'sun'});assert.equal(knowsTraveler(s,{id:'person:sun'}),true);assert.doesNotMatch(JSON.stringify(buildCounselMessages(s,{id:'person:sun'},'议军务',[])),new RegExp(secretName));assert.doesNotMatch(JSON.stringify(buildCounselMessages(s,{id:'office:war'},'议军务',[])),new RegExp(secretName));
});
test('采纳编译也使用相同知情范围，真实公开才让其他人物获知身份，密营不会随身份自动公开',()=>{
 let s=privacyGame(),history=[{role:'user',content:'如何整军'},{role:'assistant',content:'先让辽东军核对现有鸟铳。',commands:[],result:{status:'discussed',text:'仅商议'}}],json=JSON.stringify(buildAcceptanceMessages(s,council,'照办',history));assert.doesNotMatch(json,new RegExp(secretName));assert.doesNotMatch(json,/\\"energy\\":137/);s=g.intervene(s,{type:'horizon',operation:'disclose',text:'向百官公开穿越者来历'});assert.equal(knowsTraveler(s,council),true);assert.match(g.fantasyRules(s,council),/已公开/);assert.doesNotMatch(JSON.stringify(buildCounselMessages(s,council,'议军务',[])),new RegExp(secretName));snapshotState(s);
});
test('私密对象按完整编号隔离，不会因 unit-1 而误藏公开的 unit-10',()=>{
 let s=privacyGame();s=g.intervene(s,{type:'arsenal',operation:'create_unit',name:'公开侦骑队',needs:{infantry:20}});const u=s.militaryState.units.at(-1);u.id='unit-10';s.militaryState.nextId=11;const p=privacyView(s,council);assert.equal(p.protectedValue({unit:'unit-10'}),false);assert.ok(p.state.militaryState.units.some(u=>u.id==='unit-10'));snapshotState(s);
});
test('玩家可见状态明确显示尚未公开及锦衣卫知情，机构和经手主官不重复列为两组',()=>{
 const s=privacyGame(),html=armory(s,{equipment:g.equipmentCatalog(s),categories:g.CATEGORIES,officials:g.officialCatalog(s),offices:g.coreOffices(s)});assert.match(html,/尚未公开/);assert.match(html,/知情范围 <b>锦衣卫<\/b>/);assert.doesNotMatch(html,/锦衣卫、赵廷弼/);
});
