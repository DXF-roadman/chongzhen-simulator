import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('DeepSeek 结构化规划与空数组兜底真实入册；财政指令改月结，历史补录不扣钱',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'chongzhen-fiscal-')),origin='http://127.0.0.1:18638';await fs.writeFile(path.join(dir,'ai-config.json'),JSON.stringify({enabled:true,baseUrl:'https://ai-test.invalid',model:'mock-record-prose',encryptedKey:''}));
 const child=spawn(process.execPath,['--import',pathToFileURL(path.join(root,'test/mock-ai.mjs')).href,path.join(root,'server.mjs')],{cwd:root,windowsHide:true,env:{...process.env,PORT:'18638',GAME_DATA_DIR:dir,DEEPSEEK_API_KEY:'mock-key-for-local-test'},stdio:['ignore','ignore','pipe']});let errors='';child.stderr.on('data',d=>errors+=d);
 try{
  let boot;for(let i=0;i<60;i++){try{boot=await fetch(origin+'/api/bootstrap').then(r=>r.json());break;}catch{await new Promise(r=>setTimeout(r,100));}}assert.ok(boot,errors);
  const post=async(route,data={})=>{const r=await fetch(origin+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-App-Token':boot.token},body:JSON.stringify(data)});return {status:r.status,body:await r.json()};};
  let r=await post('counsel',{text:'如今天下凋敝，我们应先制定短期、中期与长期计划',mode:'discuss'});assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.state.planning.length,4);assert.equal(r.body.state.money,460);assert.equal(r.body.state.projects.length,0);assert.equal(r.body.state.government.officeLeaders.revenue,'civil-head-revenue');assert.equal(r.body.thread.messages.at(-1).commands.length,0,'仅规划即使模型混入任命也不会保留为照办事项');assert.match(r.body.thread.messages.at(-1).result.text,/已收录规划备忘 4 项/);
  const requests=r.body.config.usage.requests;r=await post('counsel',{text:'待办事项存入我们的规划备忘中'});assert.equal(r.status,200);assert.equal(r.body.state.planning.length,4);assert.equal(r.body.config.usage.requests,requests,'已议定目标直接入册，不额外请求 AI');
  const before=r.body.state;r=await post('planning-restore',{gameId:before.id,revision:before.revision});assert.equal(r.status,200);assert.equal(r.body.state.money,460);assert.equal(r.body.state.planning.length,4);assert.equal((await post('planning-restore',{gameId:'wrong',revision:0})).status,400);
  r=await post('office-leader',{id:'revenue',official:'bi'});const money=r.body.state.money,oldExpenses=r.body.forecast.expenses;assert.equal(r.body.officials.find(o=>o.id==='bi').monthlyPay,2);await post('config',{enabled:true,baseUrl:'https://ai-test.invalid',model:'mock-fiscal-order'});
  r=await post('counsel',{text:'将毕自严月俸改为一万两',mode:'auto'});assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.thread.messages.at(-1).result.status,'executed');assert.equal(r.body.state.fiscal.salaries.bi,1);assert.equal(r.body.state.money,money);assert.equal(r.body.forecast.expenses,oldExpenses-1);assert.match(r.body.thread.messages.at(-1).result.text,/月度支出预估/);
  const fact=await post('counsel',{text:'袁崇焕的俸禄到底是多少？',offline:true});assert.equal(fact.body.thread.messages.at(-1).source,'system');assert.match(fact.body.thread.messages.at(-1).content,/起用费是 14 万两，当前在职俸禄合计 0/);
  await post('save',{slot:1});r=await post('load',{slot:1});assert.equal(r.body.state.fiscal.salaries.bi,1);assert.equal(r.body.state.planning.length,4);assert.equal(r.body.forecast.expenses,oldExpenses-1);assert.equal(errors,'');
 }finally{if(child.exitCode===null){child.kill();await new Promise(resolve=>child.once('exit',resolve));}await fs.rm(dir,{recursive:true,force:true});}
});
