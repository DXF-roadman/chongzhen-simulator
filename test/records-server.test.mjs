import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import * as g from '../engine.mjs';
import {saveMemo} from '../records.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('规划 API 贯通：议事入册、游戏内到期、AI 提醒去重、采纳实施、存档及失败兜底',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'chongzhen-records-')),origin='http://127.0.0.1:18632';
 await fs.writeFile(path.join(dir,'ai-config.json'),JSON.stringify({baseUrl:'https://ai-test.invalid',model:'mock-planning',enabled:true,encryptedKey:''}));
 const child=spawn(process.execPath,['--import',pathToFileURL(path.join(root,'test/mock-ai.mjs')).href,path.join(root,'server.mjs')],{cwd:root,windowsHide:true,env:{...process.env,PORT:'18632',GAME_DATA_DIR:dir,DEEPSEEK_API_KEY:'mock-key-for-local-test'},stdio:['ignore','pipe','pipe']});let errors='';child.stderr.on('data',d=>errors+=d);child.stdout.resume();
 try{
  let boot;for(let i=0;i<60;i++){try{boot=await fetch(origin+'/api/bootstrap').then(r=>r.json());break;}catch{await new Promise(r=>setTimeout(r,100));}}assert.ok(boot,errors);
  const post=async(route,data={})=>{const r=await fetch(origin+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-App-Token':boot.token},body:JSON.stringify(data)});return {status:r.status,body:await r.json()};},get=()=>fetch(origin+'/api/bootstrap').then(r=>r.json());
  let a=await post('counsel',{text:'请制定短期水利规划，钱粮不足先记入备忘。',mode:'discuss'});assert.equal(a.status,200,JSON.stringify(a.body));let s=a.body.state,p=s.planning[0];assert.equal(p.status,'deferred');assert.equal(p.deadline,1628*12+1);assert.equal(s.money,460);assert.equal(s.projects.length,0);
  assert.equal((await post('planning-remind')).body.config.usage.requests,1,'未到期不请求 AI');
  const view=await post('preview',{text:'陕西赈灾',offline:true});const note=await post('planning-save',{gameId:s.id,memo:{id:p.id,title:p.title,horizon:'short',dueYear:1628,dueMonth:2,requirements:[],body:''}});assert.equal(note.status,200);assert.equal(note.body.state.revision,s.revision);assert.equal(note.body.state.planning[0].body,'');assert.deepEqual(note.body.state.planning[0].requirements,[]);
  assert.equal((await post('enact',{id:view.body.id})).status,200,'整理备忘不会使正在审阅的诏令失效');
  await post('event',{index:0});a=await post('advance');assert.equal(a.status,200);s=a.body.state;assert.equal(s.month,2);const world={money:s.money,grain:s.grain,turn:s.turn,revision:s.revision,projects:structuredClone(s.projects)};
  const [first,second]=await Promise.all([post('planning-remind'),post('planning-remind')]);assert.equal(first.status,200);assert.equal(second.status,200);boot=await get();s=boot.state;assert.equal(boot.config.usage.requests,2,'并发提醒只请求一次');assert.equal(s.planningReminders.length,1);assert.equal(s.planningReminders[0].source,'ai');assert.match(s.planningReminders[0].text,/到复议之期/);for(const k of Object.keys(world))assert.deepEqual(s[k],world[k]);assert.equal(s.planning[0].status,'deferred');
  const again=await post('planning-remind');assert.equal(again.body.config.usage.requests,2);await post('save',{slot:1});assert.equal((await post('load',{slot:1})).body.state.planningReminders[0].source,'ai');assert.equal((await post('planning-remind')).body.config.usage.requests,2);
  const review=await post('counsel',{text:'请复议陕西水利筹备，本次先商议',mode:'discuss',planRef:p.id});assert.equal(review.status,200);assert.equal(review.body.thread.messages.at(-1).planRef,p.id);
  const accepted=await post('counsel',{text:'照办',mode:'auto'});assert.equal(accepted.status,200,JSON.stringify(accepted.body));s=accepted.body.state;assert.equal(s.planning[0].status,'started');assert.equal(s.projects.find(q=>q.id===s.planning[0].linkedProjects[0]).action,'irrigation');assert.equal((await post('counsel',{text:'照办',mode:'auto'})).status,400);
  const ready=await post('planning-status',{gameId:s.id,id:p.id,status:'done'});assert.equal(ready.body.state.planning[0].status,'done');assert.equal(ready.body.state.money,s.money);assert.equal((await post('planning-save',{gameId:'different',memo:{title:'新目标'}})).status,400);
  const raw=g.createGame();saveMemo(raw,{title:'陕西水利筹备',horizon:'short',dueMonths:0});await post('import',{state:raw});await post('config',{baseUrl:'https://ai-test.invalid',model:'mock-planning-fail',enabled:true});const failed=await post('planning-remind');assert.equal(failed.status,200);assert.equal(failed.body.state.planningReminders[0].source,'system');assert.match(failed.body.state.planningReminders[0].text,/AI 复议暂未完成/);assert.equal(failed.body.state.money,raw.money);
  await post('config',{baseUrl:'https://ai-test.invalid',model:'mock-planning-slow',enabled:true});const id=failed.body.state.planning[0].id,pending=post('counsel',{text:'请重新复议此规划',mode:'discuss',planRef:id});await new Promise(r=>setTimeout(r,80));await post('planning-status',{gameId:raw.id,id,status:'cancelled'});const stale=await pending;assert.equal(stale.status,400);assert.match(stale.body.error,/规划已调整/);assert.equal((await get()).state.planning[0].status,'cancelled');
  await post('config',{baseUrl:'https://ai-test.invalid',model:'mock-traveler-intent',enabled:true});const fresh=g.createGame();fresh.money=0;fresh.grain=0;await post('import',{state:fresh});
  const fantasy=await post('counsel',{target:'person:sun',text:'其实我是穿越者 这300万两白银 300万石粮食你先偷偷拿去补足亏空 同时另有50万两白银 命人研究蒸汽机与现代火炮',mode:'auto'});assert.equal(fantasy.status,200,JSON.stringify(fantasy.body));assert.equal(fantasy.body.thread.messages.at(-1).result.status,'executed');assert.equal(fantasy.body.state.money,300,'350万两入库后另扣50万两研究费');assert.equal(fantasy.body.state.grain,300);assert.equal(fantasy.body.state.traveler.identity,'hidden','AI 误拟公开命令时仍按原意仅私下告知');assert.deepEqual(fantasy.body.state.traveler.knownTo,['sun']);assert.equal(fantasy.body.state.projects[0].name,'蒸汽动力与炮具试验');assert.equal(fantasy.body.state.projects[0].leader,'song');
  assert.equal(errors.includes('Error:'),false,errors);
 }finally{child.kill();await new Promise(r=>child.once('exit',r));await fs.rm(dir,{recursive:true,force:true});}
});
