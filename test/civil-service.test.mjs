import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../engine.mjs';
import {serviceRequest,recommendationContext,captureRecommendation,settleService,claimStory,completeStory,developmentContext} from '../civil-service.mjs';
import {executeCommands,acceptsProposal,buildCounselMessages} from '../counsel.mjs';
import {counselTargets} from '../dialogues.mjs';
import {voyagePanel} from '../public/frontiers.js';
const recommend=(s,input='想找一个熟悉海路的人下南洋',target='office:guards')=>captureRecommendation(s,target,input,[],recommendationContext(s,target,input))[0];
const month=s=>g.advance({...s,event:null});

test('开局八署有原任主官、无额外工资和重复日常加成，人物对话可找到主官',()=>{
 const s=g.createGame();assert.equal(Object.keys(s.government.officeLeaders).length,8);assert.equal(g.forecast(s).expenses,49);assert.equal(g.officialCatalog(s).length,14);
 for(const [office,id]of Object.entries(s.government.officeLeaders)){assert.ok(counselTargets(s).some(t=>t.id==='person:'+id));const o=g.officialCatalog(s).find(o=>o.id===id);assert.ok(o.coveredPay);assert.equal(o.monthlyPay,0);assert.ok(o.currentPosts.length);assert.ok(counselTargets(s).find(t=>t.id==='office:'+office).bio.includes(o.name));}
 const guards=s.service.people.find(p=>p.id==='civil-head-guards');assert.equal(guards.historical,false);assert.match(guards.background,/架空/);assert.deepEqual(g.validateSave(s).service,s.service);
});
test('旧档补缺保留玩家任免、撤阁和财税世界数据，不重新任用已经解除者',()=>{
 const s=g.validateSave(g.createGame());delete s.service;s.government.officeLeaders={revenue:'bi',war:'sun',justice:null};s.government.cabinet=false;s.history.unshift({turn:0,date:'元月',type:'personnel',title:'工部 · 主官',text:'解除专任主官，由常设属官维持原有部务。'});
 const next=g.validateSave(s);assert.equal(next.government.officeLeaders.revenue,'bi');assert.equal(next.government.officeLeaders.war,'sun');assert.equal(next.government.officeLeaders.justice,null);assert.equal(next.government.officeLeaders.works,null);assert.equal(next.government.officeLeaders.cabinet,undefined);
 for(const k of ['money','grain','year','month','turn','revision','provinces','technology','militaryState','atlas','fiscal'])assert.deepEqual(next[k],s[k],k);assert.equal(g.forecast(next).expenses,g.forecast(s).expenses);assert.deepEqual(g.validateSave(next).government,next.government);
});
test('锦衣卫从本署真实属员荐海路人选，询问不出发不扣费，不适任不能硬荐',()=>{
 const s=g.createGame(),money=s.money,ctx=recommendationContext(s,'office:guards','想找一个熟悉海路的人下南洋');assert.equal(s.service.people.length,8,'读取推荐上下文不改变世界');assert.ok(ctx.choice);const r=recommend(s);assert.ok(r);assert.equal(s.money,money);assert.equal(s.atlas.voyages.length,0);const p=s.service.people.find(p=>p.id===r.person);assert.ok(p.revealed);assert.equal(p.institution,'office:guards');assert.match(p.background,/海商|通事/);assert.ok(g.officialCatalog(s).some(o=>o.id===p.id));assert.equal(recommend(s).id,r.id,'同一建议不重复入册');
 const nofit=recommendationContext(s,'office:justice','找一个熟悉海路的人下南洋');assert.equal(nofit.needsSearch,true);assert.equal(captureRecommendation(s,'office:justice','找人下南洋',[{person:nofit.roster[0].id}],nofit).length,0);
 assert.equal(serviceRequest(s,'office:guards','不要派人下南洋'),false);assert.ok(acceptsProposal('让他去'));assert.ok(acceptsProposal('就让他去！'));
});
test('批准属员差遣只开实际船队，目的地旧已发现也必须重走，不重扣高官起用费',()=>{
 let s=g.createGame(),r=recommend(s);s.atlas.discoveries.manila={turn:0,source:'voyage',visited:true};const oldMoney=s.money,oldGrain=s.grain;
 s=executeCommands(s,[{type:'service',operation:'delegate',recommendation:r.id}]).state;assert.equal(s.money,oldMoney-22);assert.equal(s.grain,oldGrain-10);assert.equal(s.atlas.voyages.length,1);assert.equal(s.service.tasks[0].goalLeg,2);assert.equal(s.service.tasks[0].status,'active');
 s=month(s);assert.equal(s.service.tasks[0].status,'active');assert.equal(s.atlas.voyages[0].leg,1);s=month(s);assert.equal(s.atlas.voyages[0].leg,2);assert.equal(s.service.tasks[0].status,'completed');assert.equal(s.atlas.voyages[0].status,'recalled');const p=s.service.people.find(p=>p.id===r.person);assert.equal(p.experience,1);assert.ok(p.records.length);assert.ok(s.atlas.segments.length);assert.ok(s.institutionReports.some(r=>r.title==='差遣考成 · '+p.name));assert.deepEqual(s.officials,[],'办成差事不会自动提拔高官');
 const text=voyagePanel(s,{seaRoutes:g.SEA_ROUTES});assert.match(text,/就地候旨/);assert.match(text,new RegExp(p.name));assert.doesNotMatch(text,/已召回/);assert.deepEqual(g.validateSave(s).service,s.service);assert.throws(()=>g.serviceCommand(s,{operation:'delegate',recommendation:r.id}),/已办理/);
});
test('钱粮不足整批不执行，差遣已有同路在航时不偷建第二艘',()=>{
 let s=g.createGame(),r=recommend(s);s.money=20;const old=structuredClone(s);assert.throws(()=>executeCommands(s,[{type:'service',operation:'delegate',recommendation:r.id}]),/未能办理/);assert.deepEqual(s,old);
 s.money=100;s=g.intervene(s,{type:'horizon',operation:'voyage',route:'south'});const before=structuredClone(s);assert.throws(()=>g.serviceCommand(s,{operation:'delegate',recommendation:r.id}),/已|同/);assert.deepEqual(s,before);
});
test('水利交给本署承办官，工程结案才有履历，提前停办不记功',()=>{
 let s=g.createGame(),r=recommend(s,'找一个人负责陕西水利','office:works');assert.ok(r);s=g.serviceCommand(s,{operation:'delegate',recommendation:r.id});assert.equal(s.projects[0].institution,'office:works');assert.equal(s.projects[0].leader,r.person);
 for(let n=0;n<3&&s.service.tasks[0].status==='active';n++)s=month(s);assert.equal(s.service.tasks[0].status,'completed');assert.equal(s.service.people.find(p=>p.id===r.person).experience,1);
 let canceled=g.createGame();r=recommend(canceled,'找一个人负责陕西水利','office:works');canceled=g.serviceCommand(canceled,{operation:'delegate',recommendation:r.id});canceled.projects=[];settleService(canceled,true,true);assert.equal(canceled.service.tasks[0].status,'closed');assert.equal(canceled.service.people.find(p=>p.id===r.person).experience,0);
});
test('本署能力以外可访贤、核验、试差，普通人才没有招安兵粮与部众',()=>{
 let s=g.createGame();s=g.serviceCommand(s,{operation:'seek',institution:'office:personnel',domain:'naval'});assert.equal(s.money,456);assert.equal(s.grain,258);assert.throws(()=>g.serviceCommand(s,{operation:'seek',institution:'office:personnel',domain:'naval'}),/访求/);s=month(s);let p=s.service.people.find(p=>p.origin==='external');assert.equal(p.status,'candidate');assert.ok(!g.officialCatalog(s).some(o=>o.id===p.id));s=g.serviceCommand(s,{operation:'engage',person:p.id});assert.equal(s.service.people.find(x=>x.id===p.id).status,'interview');s=month(s);p=s.service.people.find(x=>x.id===p.id);assert.equal(p.status,'available');assert.ok(g.officialCatalog(s).some(o=>o.id===p.id));assert.equal(g.forecast(s).talentExpenses,0);assert.ok(recommendationContext(s,'office:personnel','找个人下南洋').roster.some(x=>x.id===p.id));assert.deepEqual(g.validateSave(s).service,s.service);
});
test('自由差事接入已有诏令工程，不限于预设水利和探航，也不会顺手增设衙门',()=>{
 let s=g.createGame();const input='找个人负责整理京城户籍',context=recommendationContext(s,'office:guards',input),person=context.choice;
 const r=captureRecommendation(s,'office:guards',input,[{person,reason:'熟悉案牍',mission:{plan:{title:'京城户籍复核',narrative:'核实户籍与坊册，先查三坊。',cost:{money:2},project:{months:2,effects:{corruption:-1}}}}}],context)[0];assert.equal(r.mission.type,'edict');const money=s.money;s=g.serviceCommand(s,{operation:'delegate',recommendation:r.id});assert.equal(s.money,money-2);assert.equal(s.agencies.length,0);assert.equal(s.projects[0].name,'京城户籍复核');assert.equal(s.projects[0].leader,person);assert.equal(s.projects[0].institution,'office:guards');assert.deepEqual(g.validateSave(s).service,s.service);
 for(let n=0;n<2;n++)s=month(s);assert.equal(s.service.tasks[0].status,'completed');assert.equal(s.service.people.find(p=>p.id===person).experience,1);
 assert.equal(recommendationContext(g.createGame(),'office:guards','找人负责访察京城风俗').mission.type,'edict','内地访察不会误开南洋船队');
});
test('国家稳定并有持续经费时从实际发展方向荐才，欠饷不会凭空举办盛世访贤',()=>{
 const s=g.createGame();s.turn=3;s.stability=70;s.service.stableMonths=1;s.institutions.unshift({domain:'industry',name:'工艺试验'});settleService(s,true,true);const p=s.service.people.find(p=>p.origin==='external');assert.equal(p.domain,'industry');assert.equal(p.status,'candidate');
 const poor=g.createGame();poor.turn=3;poor.stability=70;poor.service.stableMonths=3;settleService(poor,false,true);assert.equal(poor.service.people.length,8);
});
test('发展续报据真实新政生成，成本后果受规则约束，待批选择和队列完整保存',()=>{
 let s=g.createGame();s.turn=3;s.month=4;s.institutions.unshift({id:'x',name:'灌渠试点',domain:'agriculture',turn:2,date:'三月'});s.history.unshift({turn:2,type:'project',title:'竣工 · 灌渠试点',text:'陕西验收'});const ctx=claimStory(s);assert.equal(ctx.direction,'agriculture');assert.match(ctx.completed[0].title,/灌渠/);assert.equal(claimStory(s),null);
 const e=completeStory(s,{domain:'military',title:'渠成后的用水争议',text:'渠成之后，邻里请订轮灌章程。',options:[{label:'试行轮灌',cost:{money:-999,grain:999},effects:{money:999,tech:999,army:999}},{label:'强行推广',cost:{money:999},effects:{stability:999}}]},'ai');assert.equal(e.domain,'agriculture');assert.equal(e.options[0].cost.money,0);assert.equal(e.options[0].cost.grain,10);assert.equal(e.options[0].effects.money,undefined);assert.equal(e.options[0].effects.tech,2);assert.deepEqual(e.options[1].effects,{});assert.equal(e.options[1].cost.money,undefined,'必须有可免费暂缓而无收益的选项');
 s=g.validateSave(s);assert.equal(s.service.story.queue[0].title,e.title);assert.equal(s.event.id,'drought','生成续报不覆盖眼前待批奏报');s=month(s);assert.equal(s.event.id,'development-3');const restored=g.validateSave(s);assert.deepEqual(restored.event,s.event);assert.equal(restored.service.story.queue.length,0);
});
test('急迫历史节点先批，再递交发展续报；普通议事不泄露隐藏属员名册',()=>{
 let s=g.createGame();s.year=1629;s.month=10;s.turn=21;completeStory(s,null);s=month(s);assert.equal(s.event.id,'jisi');assert.equal(s.service.story.queue.length,1);s=month(s);assert.equal(s.event,null);assert.equal(s.service.story.queue.length,1);s=month(s);assert.ok(s.event.id.startsWith('development-'));
 const fresh=g.createGame(),ctx=recommendationContext(fresh,'office:guards','找人下南洋');const person=ctx.roster[1];captureRecommendation(fresh,'office:guards','找人下南洋',[],ctx);const hidden=fresh.service.people.find(p=>!p.revealed);const messages=JSON.stringify(buildCounselMessages(fresh,{id:'council'},'有什么建议'));assert.ok(!messages.includes(hidden.name));assert.ok(messages.includes(person.name));
});
