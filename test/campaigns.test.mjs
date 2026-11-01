import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../engine.mjs';
import {localCounsel,executeCommands,isOrder} from '../counsel.mjs';
import {armory,atlas,frontierForm} from '../public/frontiers.js';
const cat=s=>({equipment:g.equipmentCatalog(s),categories:g.CATEGORIES,templates:g.TEMPLATES,places:g.PLACES,seaRoutes:g.SEA_ROUTES,regions:g.REGIONS,tactics:g.TACTICS,officials:g.officialCatalog(s)});
const cmd=(s,c)=>g.intervene(s,c),month=s=>{if(s.event)s=g.resolveEvent(s,0);return g.advance(s);},target={id:'council',name:'御前议政'};
function expedition(){
 let s=g.createGame({seed:99});const a=localCounsel(s,target,'打开虫洞，掏出高达给辽东军');s=executeCommands(s,a.commands).state;return cmd(s,{type:'war',operation:'attack',target:'liaoshen',unit:'liaodong-army',tactic:'encircle'});
}
test('普通玩家菜单、装备表单与海图不泄漏隐藏幻想内容',()=>{
 const s=g.createGame(),c=cat(s),html=armory(s,c)+atlas(s,c,null)+frontierForm('equip',s,c).html+frontierForm('create_unit',s,c).html;
 assert.doesNotMatch(html,/高达|虫洞|穿越|卫星|时空|机甲/);
 assert.equal(s.traveler.enabled,false);assert.equal(s.campaignState.battles.length,0);
});
test('主动幻想指令才隐式触发能力，假设与否定不会执行',()=>{
 let s=g.createGame();const a=localCounsel(s,target,'打开虫洞，掏出一台高达给辽东军');assert.equal(a.commands[0].operation,'mode');s=executeCommands(s,a.commands).state;assert.equal(s.traveler.enabled,true);assert.equal(s.traveler.identity,'hidden');assert.equal(s.militaryState.units[0].equipment.gundam,1);
 for(const t of ['如果打开虫洞呢','不打开虫洞','不想召唤高达','不要出兵后金'])assert.equal(isOrder(t),false,t);
});
test('战役按月交战，敌方应对与损耗可见，占领才改变实控与地区政务',()=>{
 let s=expedition();assert.equal(s.campaignState.control.liaoshen,'jin');assert.equal(s.provinces.length,12);assert.equal(g.forecast(s).campaignExpenses,8);
 s=month(s);assert.equal(s.campaignState.battles[0].status,'won');assert.equal(s.provinces.length,13);assert.equal(s.campaignState.battles[0].enemyTactic,'hold');assert.match(s.campaignState.battles[0].lastReport,/敌军|损耗/);
 s=month(s);assert.equal(s.campaignState.battles[0].status,'won');assert.equal(s.campaignState.control.liaoshen,'ming');assert.equal(s.provinces.length,13);assert.equal(s.atlas.discoveries.jin.source,'conquest');
 const p=s.provinces.find(p=>p.id==='occupied-liaoshen'),before=p.unrest;s=g.doAction(s,'relief',p.id);assert.ok(s.provinces.find(x=>x.id===p.id).unrest<=before);
 s=cmd(s,{type:'war',operation:'governor',province:p.id,official:'lu'});assert.equal(s.provinces.find(x=>x.id===p.id).governor,'lu');assert.ok(g.officialCatalog(s).find(o=>o.id==='lu').workload>0);
 s=g.validateSave(s);assert.equal(s.provinces.length,13);assert.equal(s.provinces.find(x=>x.id===p.id).governor,'lu');assert.equal(s.campaignState.control.liaoshen,'ming');assert.equal(s.militaryState.units[0].region,p.id);
});
test('改令、撤军、缺补给、未知目标和海运约束都有实际结果',()=>{
 let s=g.createGame({seed:111});assert.throws(()=>cmd(s,{type:'war',operation:'attack',target:'english-port'}),/海图/);
 s=cmd(s,{type:'war',operation:'attack',target:'liaoshen'});assert.throws(()=>cmd(s,{type:'war',operation:'attack',target:'steppe',unit:'liaodong-army'}),/已有战事/);
 s=cmd(s,{type:'war',operation:'order',battle:s.campaignState.battles[0].id,tactic:'hold'});assert.equal(s.campaignState.battles[0].tactic,'hold');
 const b=s.campaignState.battles[0];s=cmd(s,{type:'war',operation:'retreat',battle:b.id});assert.equal(s.campaignState.battles[0].status,'retreated');assert.equal(s.campaignState.control.liaoshen,'jin');assert.equal(g.forecast(s).campaignExpenses,0);
});
test('统帅、地方主官可自然语言任命且随存档保留',()=>{
 let s=g.createGame();const a=localCounsel(s,target,'任命袁崇焕为辽东军统帅');s=executeCommands(s,a.commands).state;assert.equal(s.militaryState.units[0].commander,'yuan');
 s=executeCommands(s,localCounsel(s,target,'任命卢象升为陕西巡抚').commands).state;assert.equal(s.provinces.find(p=>p.id==='shaanxi').governor,'lu');
 s=g.validateSave(s);assert.equal(s.militaryState.units[0].commander,'yuan');assert.equal(s.provinces.find(p=>p.id==='shaanxi').governor,'lu');assert.equal(g.forecast(s).campaignExpenses,4);
});
test('新领地存档与在途战役完整保留，并拒绝伪造地区及多重出征',()=>{
 let s=expedition();s=cmd(s,{type:'war',operation:'order',battle:s.campaignState.battles[0].id,tactic:'hold'});s=month(s);s=g.validateSave(s);assert.equal(s.campaignState.battles[0].months,1);
 const bad=g.clone(s);bad.campaignState.control.unknown='ming';assert.throws(()=>g.validateSave(bad),/领地/);
 const bad2=g.clone(s);bad2.provinces.push({...bad2.provinces[0],id:'fake'});assert.throws(()=>g.validateSave(bad2),/地区/);
 const bad3=g.clone(s);bad3.campaignState.battles.push({...bad3.campaignState.battles[0],id:'battle-9'});assert.throws(()=>g.validateSave(bad3),/重复/);
});
