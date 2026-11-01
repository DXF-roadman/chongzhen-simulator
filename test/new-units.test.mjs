import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../engine.mjs';
import {initialMilitary} from '../equipment.mjs';
import {executeCommands,localCounsel,isOrder} from '../counsel.mjs';
import {prepareCommandBatch} from '../counsel-batch.mjs';
import {prepareUnitCommands,newUnitRequest} from '../unit-orders.mjs';
import {snapshotState,restoreState} from '../state-store.mjs';
import {armory} from '../public/frontiers.js';
const text='朕有一虫洞直接连接未来，命你秘密筹备一支特种部队，使用现代装备，资金粮草装备由虫洞提供',target={id:'office:guards',name:'锦衣卫'},fresh=()=>g.createGame({seed:2410}),totals=s=>{const a={...s.militaryState.stock};for(const u of s.militaryState.units)for(const[k,n]of Object.entries(u.equipment))a[k]=(a[k]||0)+n;return a;};
const faulty=()=>[{type:'arsenal',operation:'equip',unit:'capital-army',equipment:'rifle',quantity:30,source:'portal'},{type:'edict',official:'civil-head-guards',text:'于蓟镇边外秘密设立缉探别营，择三十人持现代火器，粮饷械弹由门中供给。',plan:{title:'蓟镇边外密营',narrative:'密设三十人别营',cost:{money:0},effects:{army:3},domain:'military',project:{months:2,effects:{army:5}}}}];
test('实际截图批次：三十人别营独立建军并定向配装，不改京营、不用假工程加军备',()=>{
 const s=fresh(),before=structuredClone(s.militaryState.units),commands=prepareUnitCommands(s,faulty(),{input:text,target:target.id}),r=executeCommands(s,commands),n=r.state,u=n.militaryState.units.at(-1);assert.equal(u.name,'蓟镇边外密营');assert.deepEqual(u.needs,{infantry:30});assert.equal(u.equipment.rifle,30);assert.equal(u.commander,'civil-head-guards');assert.equal(u.funding,'portal');assert.equal(u.secret,true);assert.equal(u.institution,'office:guards');assert.equal(n.money,s.money);assert.equal(n.grain,s.grain);assert.deepEqual(n.militaryState.units.slice(0,3),before);assert.equal(n.projects.length,0);assert.equal(n.affairs.length,0);assert.ok(!r.commands.some(c=>c.type==='edict'));assert.deepEqual(restoreState(n),n);
});
test('给京营配三十支新枪保留四千人编制和其余旧枪，少配不等于裁军，超配须先改编制',()=>{
 let s=g.intervene(fresh(),{type:'horizon',operation:'mode',enabled:true}),before=totals(s);s=g.intervene(s,{type:'arsenal',operation:'equip',unit:'capital-army',equipment:'rifle',quantity:30,source:'portal'});const u=s.militaryState.units[1];assert.equal(u.needs.infantry,4000);assert.equal(u.equipment.matchlock,3200);assert.equal(u.equipment.rifle,30);assert.equal(totals(s).matchlock,before.matchlock);snapshotState(s);assert.throws(()=>g.intervene(s,{type:'arsenal',operation:'equip',unit:u.id,equipment:'rifle',quantity:5000,source:'portal'}),/调整编制/);
 const full=fresh();full.traveler.enabled=true;full.militaryState.units[1].equipment.matchlock=4000;const n=g.intervene(full,{type:'arsenal',operation:'equip',unit:u.id,equipment:'rifle',quantity:30,source:'portal'});assert.equal(n.militaryState.units[1].equipment.matchlock,3970);assert.equal(n.militaryState.stock.matchlock,full.militaryState.stock.matchlock+30);
});
test('批处理可先写配装和任将，执行前按新军名称排成先建后配；失败不半办',()=>{
 const s=fresh(),cmds=[{type:'arsenal',operation:'equip',unit:'夜不收别营',equipment:'rifle',quantity:30,source:'portal'},{type:'war',operation:'commander',unit:'夜不收别营',official:'civil-head-guards'},{type:'arsenal',operation:'create_unit',name:'夜不收别营',needs:{infantry:30},region:'liaodong',funding:'portal',secret:true},{type:'horizon',operation:'mode',enabled:true}],ordered=prepareCommandBatch(s,cmds);assert.equal(ordered[0].operation,'mode');assert.equal(ordered[1].operation,'create_unit');const n=executeCommands(s,cmds).state;assert.equal(n.militaryState.units[3].equipment.rifle,30);snapshotState(n);
 const low={...s,traveler:{...s.traveler,enabled:true,energy:0}},copy=structuredClone(low);assert.throws(()=>executeCommands(low,cmds.filter(c=>c.operation!=='mode')),/能量/);assert.deepEqual(low,copy);
});
test('新军自然语言不再推断全军换装，普通新军不主动调现代装备，问题和否定不执行',()=>{
 assert.equal(newUnitRequest(text),true);const direct=g.inferWorldCommands(fresh(),text,{target:target.id});assert.ok(direct.some(c=>c.operation==='create_unit'));assert.ok(direct.every(c=>c.operation!=='modernize'||c.unit&&!c.scope));
 const normal=localCounsel(fresh(),target,'组建三十人侦察队');assert.equal(isOrder('组建三十人侦察队'),true);assert.equal(normal.commands.find(c=>c.operation==='create_unit').needs.infantry,30);assert.equal(normal.commands.at(-1).source,'period');assert.ok(!normal.commands.some(c=>c.operation==='mode'));assert.equal(isOrder('不要组建特种部队'),false);assert.equal(newUnitRequest('不要组建特种部队'),false);assert.equal(isOrder('如果组建一支特种部队呢'),false);
});
test('原军变更须单独明确，只有新军要求时全军换装被定向到新军',()=>{
 const s=fresh(),commands=prepareUnitCommands(s,[{type:'arsenal',operation:'modernize',scope:'all'}],{input:'另建三十人特种部队，使用现代装备，不要动京营',target:target.id});assert.equal(commands.find(c=>c.operation==='modernize').unit,commands.find(c=>c.operation==='create_unit').name);assert.ok(commands.every(c=>c.scope!=='all'));
 const both=prepareUnitCommands(s,[{type:'arsenal',operation:'modernize',unit:'capital-army'}],{input:'新建三十人特种部队，同时给京营换装',target:target.id});assert.ok(both.some(c=>c.operation==='modernize'&&c.unit==='capital-army'));assert.ok(both.some(c=>c.operation==='modernize'&&c.unit!=='capital-army'));
});
test('外部供给的小队与统帅俸禄不转扣国库，断供停训且存读档不丢隶属',()=>{
 let s=executeCommands(fresh(),prepareUnitCommands(fresh(),faulty(),{input:text,target:target.id})).state,id=s.militaryState.units[3].id;const f=g.forecast(s),rows=f.entries.filter(e=>e.id==='unit:'+id||e.id==='pay:commander:'+id);assert.equal(rows.length,2);assert.ok(rows.every(e=>e.funding==='portal'));s.money=0;s.grain=0;const training=s.militaryState.units[3].training;s=g.advance({...s,event:null});assert.ok(s.militaryState.units[3].training>training);assert.ok(s.ledger.entries.filter(e=>e.id==='unit:'+id||e.id==='pay:commander:'+id).every(e=>e.paid&&e.funding==='portal'));assert.deepEqual(restoreState(s),s);
 const no={...s,traveler:{...s.traveler,enabled:false,energy:0}},n=g.advance({...no,event:null});assert.equal(n.militaryState.units[3].training,s.militaryState.units[3].training);assert.equal(n.militaryState.units[3].supplied,0);snapshotState(n);
});
test('密营在原军械簿中显示独立卡片、隶属、主官与供给，不额外开新页面',()=>{
 const s=executeCommands(fresh(),prepareUnitCommands(fresh(),faulty(),{input:text,target:target.id})).state,html=armory(s,{equipment:g.equipmentCatalog(s),categories:g.CATEGORIES,officials:g.officialCatalog(s),offices:g.coreOffices(s)});assert.match(html,/蓟镇边外密营 · 密编/);assert.match(html,/隶属锦衣卫/);assert.match(html,/赵廷弼/);assert.match(html,/外部供给/);assert.match(html,/30 \/ 30/);
});
