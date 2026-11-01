import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../engine.mjs';
import {restoreState} from '../state-store.mjs';
import {saveMemo,capturePlanning,extractDeferredPlanning,gameMonth,duePlans,claimReminder,completeReminder,setMemoStatus,startMemo,beginYear} from '../records.mjs';
import {counselTargets,executeCommands,readCounselReply,buildCounselMessages} from '../counsel.mjs';
import {appendDiscussion,discussionRevision,cutDiscussion} from '../dialogues.mjs';
import {decodeAIOutput} from '../ai-output.mjs';
const target={id:'council',name:'御前议政'};
test('人物名字旁的职务来自实际任命，兼任、裁撤、离职及旧答复称谓可追溯',()=>{
 let s=g.createGame();const person=()=>g.officialCatalog(s).find(o=>o.id==='bi');assert.equal(person().positionLabel,'未委任朝职');
 s=g.assignOfficeLeader(s,'revenue','bi');assert.deepEqual(person().currentPosts,['户部尚书']);assert.match(counselTargets(s).find(t=>t.id==='person:bi').displayName,/毕自严 · 户部尚书/);
 const t=appendDiscussion(s,counselTargets(s).find(t=>t.id==='person:bi'),'请问','臣请核账',[],{status:'discussed',text:'商议'},'ai',g.dateLabel(s));assert.equal(t.messages.at(-1).speakerLabel,'毕自严 · 户部尚书');
 s=g.assignOfficeLeader(s,'cabinet','bi');s=g.doAction(s,'audit',null,'bi');assert.equal(person().currentPosts.length,3);assert.match(person().positionLabel,/等 3 项差遣/);
 s=g.applyEdict(s,g.localEdict(s,'废内阁'));assert.equal(person().currentPosts.includes('内阁首辅'),false);s=g.assignOfficeLeader(s,'revenue',null);assert.deepEqual(person().currentPosts,['清查亏空督办']);assert.equal(g.validateSave(s).discussions[0].messages.at(-1).speakerLabel,'毕自严 · 户部尚书');
});
test('AI 待缓规划单独入册且不改变钱粮、人事和时间，日期默认或显式记录',()=>{
 const s=g.createGame(),before=structuredClone(s),saved=capturePlanning(s,[{title:'筹备陕西水利',horizon:'short',body:'待粮储充足后先修一县',reason:'缺粮',requirements:['存粮300万石'],dueMonths:2},{title:'建立远洋补给',horizon:'long'}],'',{source:{thread:'council',messageId:'a'}});
 assert.equal(saved.length,2);assert.equal(saved[0].deadline,gameMonth(s)+2);assert.equal(saved[0].estimated,false);assert.equal(saved[1].deadline,gameMonth(s)+36);assert.equal(saved[1].estimated,true);
 for(const k of ['money','grain','month','turn','officials','projects'])assert.deepEqual(s[k],before[k]);
 const first=saved[0];capturePlanning(s,[{id:first.id,title:first.title,horizon:'short',dueMonths:10,status:'done'}],'');assert.equal(first.deadline,gameMonth(s)+2);assert.equal(first.status,'deferred');assert.equal(s.planning.length,2);
 capturePlanning(s,[{id:first.id,title:first.title,horizon:'short',dueMonths:10}],'',{input:'把期限延期到十个月后'});assert.equal(first.deadline,gameMonth(s)+10);
 assert.deepEqual(capturePlanning(s,[{title:'无须记录',horizon:'long'}],'',{input:'只是假设，不要记录'}),[]);
 assert.deepEqual(capturePlanning(s,[null,{title:'x'},{title:'有效目标',horizon:'short',dueYear:1629,dueMonth:2}],'').map(p=>p.title),['有效目标']);
 assert.deepEqual(g.validateSave(s).planning,s.planning);
});
test('规划 JSON 只保留回复与备忘，讨论中的命令不会越过执行流程；纯文本可兜底',()=>{
 const raw=decodeAIOutput({choices:[{message:{content:JSON.stringify({reply:'短期先筹银，水利暂缓。',commands:[{type:'office',office:'revenue',official:'bi'}],planning:[{title:'修复水渠',horizon:'short'}]})},finish_reason:'stop'}]},{plain:true}),answer=readCounselReply(raw);
 assert.deepEqual(answer.commands,[]);assert.equal(answer.planning[0].title,'修复水渠');
 const text='短期：修陕西水渠，钱粮不足暂缓。\n中期：整备海船，待工匠齐备再启动。\n长期：筹备远洋基地，尚不具备条件。';assert.equal(extractDeferredPlanning(text).length,3);
 const prompt=buildCounselMessages(g.createGame(),target,'请拟短期和中期规划',[],true);assert.match(prompt[0].content,/planning/);assert.match(prompt[0].content,/dueMonths/);
});
test('提醒按游戏月份触发、每个期限一次，手动延期或恢复会重新安排，绝不自动颁令',()=>{
 const s=g.createGame(),p=saveMemo(s,{title:'储粮后开工',horizon:'short',dueMonths:1});assert.equal(claimReminder(s),null);s.month=2;assert.equal(duePlans(s).length,1);
 const before={money:s.money,grain:s.grain,projects:structuredClone(s.projects)},r=claimReminder(s);assert.ok(r);assert.equal(claimReminder(s),null);completeReminder(s,r.id,'条件仍不足，请筹银再议。','ai');assert.equal(s.planningReminders[0].source,'ai');assert.equal(p.status,'deferred');assert.deepEqual({money:s.money,grain:s.grain,projects:s.projects},before);
 setMemoStatus(s,p.id,'done');assert.equal(duePlans(s).length,0);setMemoStatus(s,p.id,'deferred');assert.ok(claimReminder(s));
 saveMemo(s,{...p,dueMonths:3,deadline:gameMonth(s)+3},{manual:true});assert.equal(claimReminder(s),null);s.month=5;assert.ok(claimReminder(s));startMemo(s,p.id,['p1']);assert.equal(p.status,'started');assert.equal(duePlans(s).length,0);assert.deepEqual(g.validateSave(s).planningReminders,s.planningReminders,'正常写档不改变正在生成的复议');assert.deepEqual(restoreState(s).planningReminders,s.planningReminders.map(r=>({...r,status:'ready'})),'重启时遗留的未完成 AI 复议保留系统提醒，不会重复扣费请求');
});
test('删除未执行对话清理其自动待缓规划，手动整理或已启动的目标保留',()=>{
 const s=g.createGame(),thread=appendDiscussion(s,target,'请规划','臣请暂缓',[],{status:'discussed',text:'商议'},'ai',g.dateLabel(s)),id=thread.messages.at(-1).id;
 const plans=capturePlanning(s,[{title:'自动暂缓目标',horizon:'short'},{title:'手动调整目标',horizon:'medium'},{title:'已启动目标',horizon:'long'}],'',{source:{thread:'council',messageId:id}});saveMemo(s,plans[1],{manual:true});startMemo(s,plans[2].id);claimReminder({...s,month:12});
 cutDiscussion(s,discussionRevision(s,'council',id));assert.deepEqual(s.planning.map(p=>p.title),['手动调整目标','已启动目标']);assert.equal(s.discussions.length,0);
});
test('年末总结在十二月工程竣工后生成，保留全年真实收支和来年目标且跨年只记一次',()=>{
 let s=g.createGame({mode:'sandbox',seed:124});s.money=50000;s.grain=50000;beginYear(s);const opening=structuredClone(s.yearRecord.opening),flows={revenue:0,expenses:0,harvest:0,grainUse:0};
 saveMemo(s,{title:'来年远洋储备',horizon:'long'});s=g.assignOfficeLeader(s,'revenue','bi');
 for(let i=0;i<12;i++){if(i===10)s=g.doAction(s,'audit');const f=g.forecast(s);for(const k of Object.keys(flows))flows[k]+=f[k];s=g.advance({...s,event:null});}
 assert.equal(s.year,1629);assert.equal(s.month,1);const r=s.annualReports[0];assert.equal(r.year,1628);assert.equal(r.complete,true);assert.equal(r.months,12);assert.deepEqual(r.opening,opening);for(const k of Object.keys(flows))assert.equal(r[k],flows[k]);assert.equal(r.closing.stats.money,Math.round(s.money*10)/10);assert.ok(r.events.some(e=>e.type==='project'&&e.title.includes('清查亏空')));assert.equal(r.pendingProjects.length,0);assert.equal(r.pendingPlans[0].title,'来年远洋储备');assert.ok(r.closing.people.some(o=>o.name==='毕自严'&&o.posts.includes('户部尚书')));assert.equal(s.yearRecord.year,1629);assert.equal(s.yearRecord.months,0);
 s=g.validateSave(JSON.parse(JSON.stringify(s)));assert.deepEqual(s.annualReports[0],r);s=g.advance({...s,event:null});assert.equal(s.annualReports.length,1);
});
test('旧档年度统计从实际月份起记，坏备忘和非法年度快照被拒绝',()=>{
 const raw=g.createGame();Object.assign(raw,{month:3,turn:2,money:196,grain:130});for(const k of ['planning','planningReminders','annualReports','yearRecord'])delete raw[k];let s=g.validateSave(raw);assert.equal(s.yearRecord.startMonth,3);assert.equal(s.yearRecord.opening.stats.money,196);
 s.money=50000;s.grain=50000;for(let i=0;i<10;i++)s=g.advance({...s,event:null});assert.equal(s.annualReports[0].complete,false);assert.equal(s.annualReports[0].months,10);assert.equal(s.annualReports[0].startMonth,3);
 const bad=structuredClone(s);saveMemo(bad,{title:'测试规划',horizon:'short'});bad.planning[0].deadline=NaN;assert.throws(()=>g.validateSave(bad),/备忘字段/);
 const corrupt=structuredClone(s);corrupt.annualReports[0].closing.stats.money=-1;assert.throws(()=>g.validateSave(corrupt),/年度统计/);
});
