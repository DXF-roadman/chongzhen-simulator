import test from 'node:test';
import {claimStory,completeStory} from '../civil-service.mjs';
import assert from 'node:assert/strict';
import * as g from '../engine.mjs';
const clean=s=>s.event?g.resolveEvent(s,Math.max(0,s.event.options.findIndex(o=>Object.entries(o.cost||{}).every(([k,v])=>s[k]>=v)))):s;
test('开局与不可变更新，同月超过三项施政仍可按钱粮继续办理',()=>{
 const s=g.createGame({seed:1});assert.equal(s.year,1628);assert.equal(s.actionsLeft,null);
 const next=g.doAction(s,'relief','shaanxi');assert.equal(s.money,460);assert.equal(next.money,444);assert.equal(next.actionsLeft,null);
 let a=g.doAction(next,'audit');a=g.doAction(a,'train');a=g.doAction(a,'rest');assert.equal(a.money,382);assert.equal(a.month,1);assert.equal(a.actionsLeft,null);assert.equal(a.projects.find(p=>p.action==='audit').remaining,2);assert.equal(s.money,460);
});
test('奏报可免费留中；钱粮不足不能行动，状态保持原样',()=>{
 const s=g.createGame({seed:2});assert.ok(g.advance(s).affairs.some(a=>a.petition));assert.ok(s.event);const p={...s,money:0};
 assert.throws(()=>g.doAction(p,'arsenal'),/不足/);assert.equal(p.actionsLeft,null);
 const r=g.resolveEvent(s,0);assert.equal(r.actionsLeft,null);assert.equal(r.event,null);
});
test('工程延迟竣工，积累进入后续历史，存档往返保留',()=>{
 let s=g.doAction(g.createGame({seed:3}),'academy');assert.equal(s.tech,8);assert.equal(s.projects[0].remaining,3);
 for(let n=0;n<3;n++)s=g.advance(clean(s));
 assert.equal(s.projects.length,0);assert.equal(s.tech,20);assert.equal(s.institutions.length,1);assert.equal(s.technology.education,12);
 assert.equal(g.validateSave(s).institutions[0].name,'农政译馆');
});
test('任命能力逐月生效，超过三人仍按经费安排',()=>{
 let s=g.createGame({seed:4});for(const id of ['xu','yuan','bi'])s=g.appoint(s,id);
 const expanded=g.appoint({...s,actionsLeft:3},'sun');assert.equal(expanded.officials.length,4);
 const t=g.advance(clean(s));assert.equal(t.tech,10);assert.ok(t.frontier<s.frontier);
});
test('月历跨年，粮收与税收对系统状态作出响应',()=>{
 const s=g.createGame({seed:5});s.month=12;
 const t=g.advance(clean(s));assert.equal(t.year,1629);assert.equal(t.month,1);
 assert.ok(g.forecast({...s,corruption:10}).revenue>g.forecast(s).revenue);
 assert.ok(g.forecast({...s,month:6}).harvest>0);assert.equal(g.forecast({...s,month:5}).harvest,0);
});
test('钱粮断流与失守有后果',()=>{
 const s={...g.createGame({seed:6}),money:0,grain:0,tax:.8,stability:10};
 const t=g.advance({...s,event:null});assert.ok(t.army<s.army);assert.ok(t.stability<s.stability);assert.equal(t.money,0);assert.equal(t.grain,0);
});
test('外交与全球解锁，并有关系和军事门槛',()=>{
 let s=g.createGame({seed:7});assert.throws(()=>g.diplomacy(s,'joseon','envoy'),/解锁/);
 s=g.doAction({...s,tech:20,stability:45},'audit');assert.equal(s.unlocks.diplomacy,true);
 assert.throws(()=>g.diplomacy(s,'jin','trade'),/关系/);
 let t=g.diplomacy(s,'joseon','trade');assert.equal(t.countries.find(c=>c.id==='joseon').relation,46);t=g.advance({...t,event:null});t=g.advance({...t,event:null});assert.ok(t.countries.find(c=>c.id==='joseon').relation>46);
 const u=g.doAction({...t,tech:35,navy:35},'rest');assert.equal(u.unlocks.global,true);
 assert.throws(()=>g.diplomacy({...u,actionsLeft:3},'ottoman','pressure'),/军备/);
});
test('AI 不能制造无限资源、越过上限或写入任意属性',()=>{
 const s=g.createGame({seed:8});
 const p=g.normalizeEdict({title:'试验',narrative:'谨慎试点',cost:{money:2,grain:0},effects:{money:99999,stability:9999,army:9999,tech:9999,unlocks:1},regional:{unrest:-1000},project:{months:-1,effects:{tech:9999,navy:9999}},target:'shaanxi'},s,'造机床');
 assert.equal(p.cost.money,2);assert.throws(()=>g.normalizeEdict({title:'无报价',narrative:'先议预算',project:{months:2}},s,'试办'),/预算/);assert.equal(p.cost.grain,0);assert.equal(p.effects.money,undefined);
 assert.ok(p.effects.army<=8);assert.equal(p.project.months,2);assert.ok(p.project.effects.tech<=12);
 assert.equal(p.project.effects.navy,undefined);assert.equal(p.domain,'industry');
});
test('自由政令先花资源后竣工，形成持续制度与新政续报',()=>{
 let s=g.createGame({seed:9});const p=g.localEdict(s,'试办银行与预算制度');assert.equal(p.domain,'finance');
 s=g.applyEdict(s,p);assert.equal(s.money,415);assert.equal(s.institutions.length,0);
 for(let i=0;i<4;i++)s=g.advance(clean(s));
 assert.equal(s.institutions.length,1);assert.equal(s.technology.finance,12);
 const before=g.forecast(s).revenue;s.technology.finance=40;assert.ok(g.forecast(s).revenue>before);
 while(s.turn%3)s=g.advance(clean(s));assert.ok(claimStory(s));completeStory(s,{title:'银行试点账务核验',text:'票号账册已经具备，地方请议清算章程。',options:[{label:'核验清算',cost:{money:2},effects:{}},{label:'暂缓',cost:{},effects:{}}]});s=g.advance(clean(s));assert.ok(s.event.id.startsWith('development-'));assert.match(s.event.title,/银行/);
 const restored=g.validateSave(s);assert.equal(restored.event.domain,'finance');s=g.advance(clean(s));assert.notEqual(s.event?.id,'legacy','固定的新政推广不再另起一套重复回访');
});
test('1629 年边警会根据玩家改变的国力分支',()=>{
 let a={...g.createGame({seed:10}),year:1629,month:10,army:75,frontier:20,event:null};
 let b={...a,army:30,frontier:80};
 a=g.advance(a);b=g.advance(b);assert.match(a.event.title,/有备/);assert.match(b.event.title,/急报/);
 assert.equal(g.validateSave(a).event.id,'jisi');
});
test('导入拒绝重复地区、未知人物、任意工程和无效日期',()=>{
 const s=g.createGame({seed:11});
 assert.throws(()=>g.validateSave({...s,month:99}),/日期/);
 assert.throws(()=>g.validateSave({...s,officials:['hacker']}),/人物/);
 assert.throws(()=>g.validateSave({...s,provinces:Array(12).fill(s.provinces[0])}),/地区/);
 assert.throws(()=>g.validateSave({...s,projects:[{action:'hack',remaining:2,total:2}]}),/种类/);
 assert.equal(g.validateSave(JSON.parse(JSON.stringify(s))).money,s.money);
});
test('多种种子长期月结保持数值有效，不强制于1644年结束',()=>{
 for(let seed=1;seed<=20;seed++){
  let s=g.createGame({mode:'sandbox',seed});s.year=1643;s.money=20000;s.grain=20000;s.stability=85;s.legitimacy=85;s.army=90;s.frontier=15;s.officials=['yuan','xu'];s.tax=.8;
  for(let i=0;i<24&&!s.ended;i++){s=g.advance(clean(s));for(const k of Object.keys(g.META)){assert.ok(Number.isFinite(s[k]));assert.ok(s[k]>=0);if(!['money','grain'].includes(k))assert.ok(s[k]<=100);}}
  assert.ok(s.year>=1645);assert.equal(s.ended,null);
 }
});
