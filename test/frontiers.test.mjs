import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../engine.mjs';
import {militaryForecast,settleMilitary} from '../equipment.mjs';
import {settleHorizons} from '../horizons.mjs';
import {localCounsel,executeCommands,isOrder,counselPrompt} from '../counsel.mjs';
const cmd=(s,c)=>g.intervene(s,c),target={id:'council',name:'御前议政'};
const fresh=()=>g.createGame({mode:'traveler',seed:321});
const month=s=>{if(s.event)s=g.resolveEvent(s,0);return g.advance(s);};
test('穿越能力需明确开启，开关不重置能量，开虫洞无需诏令项目',()=>{
 let s=g.createGame();assert.equal(s.traveler.enabled,false);assert.throws(()=>cmd(s,{type:'horizon',operation:'summon_mecha'}),/穿越/);
 s=cmd(s,{type:'horizon',operation:'mode',enabled:true});assert.equal(s.actionsLeft,null);
 s=cmd(s,{type:'horizon',operation:'portal',open:true});assert.equal(s.traveler.energy,90);assert.equal(s.projects.length,0);
 s=cmd(s,{type:'horizon',operation:'mode',enabled:false});s=cmd(s,{type:'horizon',operation:'mode',enabled:true});assert.equal(s.traveler.energy,90);assert.equal(s.traveler.portal,false);
 assert.throws(()=>cmd(s,{type:'bogus',operation:'satellite'}),/不支持/);
});
test('高达真实进入编制与战力，身份可继续隐藏或明确公开',()=>{
 let s=fresh(),old=s.army;s=cmd(s,{type:'horizon',operation:'summon_mecha'});assert.equal(s.militaryState.units[0].equipment.gundam,1);assert.equal(s.militaryState.units[0].needs.mecha,1);assert.ok(s.army>old);assert.equal(s.traveler.energy,70);assert.equal(s.traveler.identity,'hidden');assert.match(counselPrompt(s,target),/尚隐瞒/);
 s=cmd(s,{type:'horizon',operation:'disclose'});assert.equal(s.traveler.identity,'disclosed');assert.match(counselPrompt(s,target),/已公开/);s=g.validateSave(s);assert.equal(s.militaryState.units[0].equipment.gundam,1);assert.equal(s.traveler.identity,'disclosed');
});
test('卫星全球开图保留实际探航区别，不伪造走过的航线',()=>{
 let s=fresh();s=cmd(s,{type:'horizon',operation:'voyage',route:'west'});s=month(s);assert.equal(s.atlas.segments.length,1);assert.equal(s.atlas.discoveries.taiwan.visited,true);assert.equal(s.atlas.discoveries.manila,undefined);
 s=cmd(s,{type:'horizon',operation:'satellite'});assert.equal(s.atlas.allVisible,true);assert.equal(Object.keys(s.atlas.discoveries).length,g.PLACES.length);assert.equal(s.atlas.discoveries.england.visited,false);assert.equal(s.atlas.segments.length,1);assert.equal(g.validateSave(s).atlas.allVisible,true);
});
test('西洋航行按月抵达并测绘，远洋有门槛，缺补给停航',()=>{
 let s=g.createGame();assert.throws(()=>cmd(s,{type:'horizon',operation:'voyage',route:'pacific'}),/海权/);assert.throws(()=>cmd(s,{type:'horizon',operation:'voyage',route:'atlantic'}),/好望角/);
 s=cmd(s,{type:'horizon',operation:'voyage',route:'west'});assert.equal(g.forecast(s).explorationExpenses,2);assert.equal(s.atlas.segments.length,0);
 settleHorizons(s,false,true);assert.equal(s.atlas.voyages[0].leg,0);s=month(s);s=month(s);assert.equal(s.atlas.discoveries.manila.visited,true);assert.equal(s.atlas.segments.length,2);
 s=month(s);assert.equal(s.atlas.discoveries.malacca.visited,true);s=month(s);assert.equal(s.atlas.discoveries.ceylon,undefined);assert.equal(s.atlas.voyages[0].progress,1);s=g.validateSave(s);s=month(s);assert.equal(s.atlas.discoveries.ceylon.visited,true);
});
test('整体换装无需逐枪指派，时空能耗与旧装备退库守恒',()=>{
 const start=fresh();let s=cmd(start,{type:'arsenal',operation:'modernize',scope:'frontier'}),u=s.militaryState.units[0];
 assert.equal(u.equipment.rifle,6000);assert.equal(u.equipment.howitzer,120);assert.equal(s.militaryState.stock.matchlock,6600);assert.equal(s.militaryState.stock.cannon,120);assert.equal(s.actionsLeft,null);assert.ok(s.traveler.energy<100);assert.deepEqual(start.militaryState.units[0].equipment,{matchlock:4800,cannon:80});
});
test('普通整备按优先级分库存，生产按共享工厂、费用与效率结算',()=>{
 let s=cmd(g.createGame(),{type:'arsenal',operation:'modernize',scope:'all'});assert.equal(s.militaryState.units[0].equipment.matchlock,6000);assert.equal(s.militaryState.units[0].equipment.cannon,120);assert.ok(s.militaryState.lines.length>0);assert.ok(g.forecast(s).militaryExpenses>0);
 const used=s.militaryState.lines.filter(l=>l.active).reduce((n,l)=>n+l.factories,0);assert.ok(used<=3);assert.throws(()=>cmd(s,{type:'arsenal',operation:'produce',equipment:'junk',factories:4}),/军工厂不足/);
 const l=s.militaryState.lines[0],eff=l.efficiency;settleMilitary(s,false);assert.equal(l.lastOutput,0);assert.equal(l.efficiency,eff);settleMilitary(s,true);assert.ok(l.efficiency>eff);assert.ok(l.lastOutput>0);
});
test('军工扩建三月完成，定义新型号不凭空加库存，保存不伪造性能',()=>{
 let s=cmd(fresh(),{type:'arsenal',operation:'expand'});for(let i=0;i<2;i++)s=month(s);assert.equal(s.militaryState.factoryCapacity,3);s=month(s);assert.equal(s.militaryState.factoryCapacity,5);
 s=cmd(s,{type:'arsenal',operation:'design',base:'gundam',name:'大明一式机甲'});const e=s.militaryState.designs[0];assert.equal(s.militaryState.stock[e.id],undefined);
 s=cmd(s,{type:'arsenal',operation:'equip',unit:'liaodong-army',equipment:e.id,source:'portal'});assert.equal(militaryForecast(s).energy,4);
 s.militaryState.designs[0].attack=999999;assert.equal(g.validateSave(s).militaryState.designs[0].attack,1500);
});
test('自然语言直接操作、献策照办和整批失败保护贯通',()=>{
 for(const t of ['打开虫洞','我掏出一台高达给辽东军','发射卫星','全军换装','派船向西探索'])assert.equal(isOrder(t),true,t);
 for(const t of ['如果打开虫洞呢','不要发射卫星','我想知道能否换装'])assert.equal(isOrder(t),false,t);
 let s=fresh();const a=localCounsel(s,target,'打开虫洞，掏出高达给辽东军');assert.equal(a.commands.length,2);s=executeCommands(s,a.commands).state;assert.equal(s.traveler.portal,true);assert.equal(s.militaryState.units[0].equipment.gundam,1);
 const advice=localCounsel(s,target,'军备如何整备，有什么建议？');assert.equal(advice.commands[0].type,'arsenal');
 const before=g.clone(s);assert.throws(()=>executeCommands(s,[{type:'horizon',operation:'satellite'},{type:'arsenal',operation:'produce',equipment:'tank',factories:30}]),/整批未执行/);assert.deepEqual(s,before);
 const plan=g.localEdict(fresh(),'打开虫洞，掏出一台高达');assert.equal(plan.interventions.length,2);assert.equal(g.applyEdict(fresh(),plan).militaryState.units[0].equipment.gundam,1);
});
test('缺能换装保留旧枪，新武器逐月替换并退库，不要求逐件配发',()=>{
 let s=fresh();s.traveler.energy=0;s.militaryState.units[0].equipment.matchlock=6000;s=cmd(s,{type:'arsenal',operation:'modernize',scope:'frontier'});
 const u=s.militaryState.units[0];assert.ok(u.equipment.matchlock>0);assert.equal(u.preferred.infantry,'rifle');assert.equal(s.militaryState.lines.filter(l=>l.active).reduce((n,l)=>n+l.factories,0),3);
 const old=u.equipment.matchlock,stock=s.militaryState.stock.matchlock;settleMilitary(s,true);assert.ok(u.equipment.rifle>0);assert.ok(u.equipment.matchlock<old);assert.ok(s.militaryState.stock.matchlock>stock);
 assert.equal(u.equipment.rifle+u.equipment.matchlock,6000);assert.ok(g.validateSave(s));
});
test('旧档迁移，新系统存档拒绝伪造库存、超配工厂和航线',()=>{
 const old=g.createGame();delete old.militaryState;delete old.atlas;delete old.traveler;const s=g.validateSave(old);assert.equal(s.traveler.enabled,false);assert.equal(s.militaryState.factoryCapacity,3);
 let bad=g.clone(s);bad.militaryState.stock.matchlock=-1;assert.throws(()=>g.validateSave(bad),/库存/);
 bad=g.clone(s);bad.militaryState.lines=[{id:'line-1',equipment:'cannon',factories:4,efficiency:.35,credit:0,active:true}];assert.throws(()=>g.validateSave(bad),/超额/);
 bad=g.clone(s);bad.atlas.segments=[{route:'west',leg:1,from:'ming',to:'england',turn:1}];assert.throws(()=>g.validateSave(bad),/航线/);
});
