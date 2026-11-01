import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as g from '../engine.mjs';
import {executeCommands,localCounsel} from '../counsel.mjs';
import {armory,atlas} from '../public/frontiers.js';

function explored(){
 let s=g.intervene(g.createGame({mode:'traveler'}),{type:'horizon',operation:'voyage',route:'west'});
 for(let i=0;i<3;i++){if(s.event)s=g.resolveEvent(s,2);s=g.advance(s);}
 return s;
}
test('撤销误点只收回卫星视野、返还能量，真实航迹、政务和身份保持',()=>{
 const prior=g.validateSave(explored()),launched=g.intervene(prior,{type:'horizon',operation:'satellite'}),before=structuredClone(launched);
 const restored=g.undoSatellite(g.validateSave(launched));
 assert.deepEqual(launched,before);assert.equal(restored.traveler.energy,prior.traveler.energy);assert.equal(restored.traveler.satellites,0);assert.equal(restored.traveler.interventions,prior.traveler.interventions);assert.equal(restored.atlas.allVisible,false);
 assert.deepEqual(restored.atlas,prior.atlas);assert.deepEqual(restored.unlocks,prior.unlocks);
 for(const key of ['money','grain','year','month','turn','projects','affairs','campaignState','provinces','militaryState','government','agencies'])assert.deepEqual(restored[key],prior[key],key);
 assert.equal(restored.traveler.identity,prior.traveler.identity);assert.equal(restored.history[0].title,'撤销误点卫星开图');assert.equal(restored.revision,launched.revision+1);
 assert.deepEqual(g.validateSave(restored).atlas,restored.atlas);assert.throws(()=>g.undoSatellite(restored),/只能撤销/);
});
test('旧档需明确的开图前记录，过期撤销被拦截，多颗卫星仅撤回最后一颗',()=>{
 const old=g.intervene(explored(),{type:'horizon',operation:'satellite'});delete old.traveler.satelliteUndo;
 assert.throws(()=>g.undoSatellite(old),/缺少开图前/);const restored=g.undoSatellite(old,{previousUnlocks:{diplomacy:true,global:false}});assert.equal(restored.atlas.allVisible,false);assert.equal(restored.unlocks.global,false);
 const changed=g.doAction(old,'train');assert.throws(()=>g.undoSatellite(changed,{previousUnlocks:{diplomacy:true,global:false}}),/只能撤销/);
 const two=g.intervene(old,{type:'horizon',operation:'satellite'}),one=g.undoSatellite(two);assert.equal(one.traveler.satellites,1);assert.equal(one.atlas.allVisible,true);assert.equal(one.unlocks.global,true);assert.deepEqual(one.atlas.discoveries,old.atlas.discoveries);
});
test('界面不展示卫星发射按钮，撤销后不再提示卫星；明确自然语言仍可发射',async()=>{
 const s=g.createGame({mode:'traveler'}),cat={equipment:g.equipmentCatalog(s),officials:g.officialCatalog(s),categories:g.CATEGORIES,templates:g.TEMPLATES,places:g.PLACES,seaRoutes:g.SEA_ROUTES,regions:g.REGIONS};
 for(const html of [armory(s,cat),atlas(s,cat,null)])assert.doesNotMatch(html,/卫星|operation&quot;:&quot;satellite/);
 const reply=localCounsel(s,{id:'council',name:'御前议政'},'发射卫星打开全球地图'),launched=executeCommands(s,reply.commands).state;assert.equal(launched.atlas.allVisible,true);
 const html=armory(launched,cat);assert.match(html,/在轨卫星/);assert.doesNotMatch(html,/operation&quot;:&quot;satellite/);
});
