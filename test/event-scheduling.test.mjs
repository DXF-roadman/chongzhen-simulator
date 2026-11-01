import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../engine.mjs';
import {snapshotState,restoreState} from '../state-store.mjs';
import {claimStory,completeStory,needsStory} from '../civil-service.mjs';
import {eventCondition,equivalentReport,primeEventMemory} from '../event-rules.mjs';
import {calm,freshProgress,firstReport} from './event-schedule-fixture.mjs';
const month=s=>g.advance(s.event?g.resolveEvent(s,2):s);
test('安定且实拨充足时可连续平静月份，eventSerial轮到pay也不无故催饷',()=>{
 let s=calm();s.eventSerial=0;for(let i=0;i<8;i++){s=g.advance(s);assert.equal(s.event,null);assert.equal(eventCondition(s,'pay').eligible,false);assert.deepEqual(restoreState(s),s);}assert.equal(s.turn,8);assert.ok(s.ledger.expenses>0);assert.ok(s.money>0);
});
test('真正欠供才递催饷，留中保留原案且不按月重立；补足后旧债不会自动重报',()=>{
 let s=g.setFiscal(calm(),{scope:'rates',values:{militaryBase:0}});s=g.advance(s);assert.equal(s.event.id,'pay');assert.match(s.event.text,/银缺 24/);s=g.resolveEvent(s,-1);const id=s.affairs.find(a=>a.petition).id;for(let i=0;i<4;i++){s=g.advance(s);assert.notEqual(s.event?.id,'pay');assert.equal(s.affairs.filter(a=>a.petition?.id==='pay').length,1);}s=g.setFiscal(s,{scope:'rates',values:{militaryBase:24}});s=g.advance(s);assert.equal(eventCondition(s,'pay').eligible,false);assert.ok(s.affairs.some(a=>a.id===id));snapshotState(s);
});
test('新成果统一走发展续报，不再另起固定的推广回访；秘密项目不自动泛化成普通推广奏报',()=>{
 let s=calm();s.institutions.unshift({id:'canal',name:'水渠试点',domain:'agriculture',turn:0,date:'正月'});for(let i=0;i<6;i++){s=g.advance(s);assert.equal(s.event,null);}assert.ok(claimStory(s));const report=completeStory(s,firstReport,'ai');s=g.advance(s);assert.equal(s.event.id,report.id);s=g.resolveEvent(s,1);for(let i=0;i<5;i++){s=g.advance(s);assert.notEqual(s.event?.id,'legacy');}s.institutions.unshift({id:'secret',name:'密营扩编与辽沈侦察',domain:'military',turn:s.turn,date:'今月'});for(let i=0;i<3;i++){s=month(s);assert.ok(!s.event?.title.includes('密营'));}snapshotState(s);
});
test('发展故事须有新成果；同义改标题的重复段落拒收且核验点保存，不每三个月重试旧题',()=>{
 let s=freshProgress();assert.ok(claimStory(s));const first=completeStory(s,firstReport,'ai');assert.ok(first);assert.equal(s.service.story.reviewedTurn,2);s=g.advance(s);assert.equal(s.event.id,first.id);s=g.resolveEvent(s,1);s=g.advance(s);s=g.advance(s);assert.equal(s.turn,6);assert.equal(needsStory(s),false);assert.equal(claimStory(s),null);s.history.unshift({type:'project',turn:5,date:'七月',title:'竣工 · 新水轮',text:'已验收'});assert.ok(claimStory(s));assert.equal(completeStory(s,{...firstReport,title:'灌渠轮灌次序再请核议'},'ai'),null);assert.equal(s.service.story.queue.length,0);assert.equal(s.service.story.chapters.length,1);assert.equal(s.service.story.reviewedTurn,5);assert.deepEqual(restoreState(s),s);s.turn=9;s.month=10;assert.equal(claimStory(s),null);s.history.unshift({type:'project',turn:8,date:'九月',title:'竣工 · 火炮标准化',text:'炮坊已验收'});s.institutions.unshift({id:'cannon-new',name:'火炮标准化',domain:'industry',turn:8,date:'九月'});assert.ok(claimStory(s));assert.ok(completeStory(s,{...firstReport,title:'炮坊火药配比抽验',text:'炮坊新定尺寸完成，地方须核查火药配比与试射规程，尚未形成统一程式。'},'ai'));assert.equal(s.service.story.chapters.length,2);
});
test('AI可以明确无新奏报，不强塞兜底危机；实质不同的新议题不会被误判为重复',()=>{
 const s=freshProgress(),money=s.money;assert.ok(claimStory(s));assert.equal(completeStory(s,{noNewReport:true},'ai'),null);assert.equal(s.money,money);assert.equal(s.service.story.queue.length,0);assert.equal(s.service.story.reviewedTurn,2);assert.equal(equivalentReport(firstReport,{title:'泉州税关船籍核验',text:'海商新抵外港，船籍与货单须逐项比勘后验放。'}),false);snapshotState(s);
});
test('旧存档原样可读，新增冷却记录无损保存且拒绝未来或重复触发记录',()=>{
 const old=calm();delete old.eventMemory;assert.deepEqual(restoreState(old),old);primeEventMemory(old);snapshotState(old);let bad=structuredClone(old);bad.eventMemory=[{key:'pay',turn:1000,signature:'x'}];assert.throws(()=>g.validateSave(bad),/奏报触发记录/);bad=structuredClone(old);bad.eventMemory=[{key:'pay',turn:0,signature:'x'},{key:'pay',turn:0,signature:'x'}];assert.throws(()=>g.validateSave(bad),/奏报触发记录/);
});
test('最新已足饷的重复警报可撤下而不代选，不改钱粮或追退款，已执行记录保留',()=>{
 let s=g.advance(calm());s.event={...structuredClone(g.EVENTS.find(e=>e.id==='pay')),leader:null};s.resolvedEvents.push('pay');delete s.eventMemory;const before=structuredClone(s),n=g.reviewPetitions(s);assert.equal(n.event,null);assert.equal(n.money,s.money);assert.equal(n.grain,s.grain);assert.deepEqual(n.ledger,s.ledger);assert.deepEqual(n.resolvedEvents,s.resolvedEvents);assert.ok(n.history.some(h=>h.title==='奏报去重核验'));assert.deepEqual(s,before);snapshotState(n);
});
