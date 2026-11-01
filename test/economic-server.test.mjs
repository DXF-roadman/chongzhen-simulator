import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('模拟DeepSeek开海令：从中文财政到验收入账，重启与存读档不丢月解、不重复收税',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'chongzhen-economy-')),origin='http://127.0.0.1:18640';await fs.writeFile(path.join(dir,'ai-config.json'),JSON.stringify({enabled:true,baseUrl:'https://economic-test.invalid',model:'mock-economy'}));
 let child,errors='';function start(){child=spawn(process.execPath,['--import',pathToFileURL(path.join(root,'test/economic-mock-ai.mjs')).href,'server.mjs'],{cwd:root,windowsHide:true,env:{...process.env,PORT:'18640',GAME_DATA_DIR:dir,DEEPSEEK_API_KEY:'economic-test-key'},stdio:['ignore','ignore','pipe']});child.stderr.on('data',d=>errors+=d);}
 async function boot(){for(let n=0;n<60;n++){try{return await fetch(origin+'/api/bootstrap').then(r=>r.json());}catch{await new Promise(r=>setTimeout(r,100));}}throw Error(errors||'No test server');}
 async function stop(){if(child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r));}}
 start();try{
  let b=await boot();const post=async(route,data={})=>{const res=await fetch(origin+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-App-Token':b.token},body:JSON.stringify(data)});return {status:res.status,body:await res.json()};};
  const before=b.state.money;let r=await post('counsel',{text:'在泉州开海，设市舶税关，千两抽三、万两抽五，毕自严总核',mode:'auto'});assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.thread.messages.at(-1).result.status,'executed');assert.equal(r.body.state.money,before-8);assert.equal(r.body.state.projects[0].domain,'finance');assert.equal(r.body.state.projects[0].economic.highRate,.5);assert.equal(r.body.forecast.customsRevenue,0);
  let state=r.body.state;for(let n=0;n<4&&state.projects.length;n++){if(state.event)await post('event',{index:2});r=await post('advance');assert.equal(r.status,200,JSON.stringify(r.body));state=r.body.state;}assert.equal(state.projects.length,0);assert.ok(r.body.forecast.customsRevenue>0);await post('save',{slot:1});r=await post('load',{slot:1});assert.equal(r.body.state.economy.customs.length,1);
  if(r.body.state.event)await post('event',{index:2});b=await boot();const startMoney=b.state.money,net=b.forecast.net,tax=b.forecast.customsRevenue,total=b.forecast.revenue;r=await post('advance');assert.equal(r.status,200);assert.ok(Math.abs(r.body.state.money-(startMoney+net))<.00001);assert.equal(r.body.state.ledger.customsRevenue,tax);assert.equal(r.body.state.ledger.revenue,total);assert.ok(r.body.state.notices.some(n=>n.includes('税关本月解部')));await post('save',{slot:2});
  const ledger=structuredClone(r.body.state.ledger);await stop();start();b=await boot();assert.deepEqual(b.state.ledger,ledger);assert.equal(b.state.economy.customs.length,1);r=await post('load',{slot:2});assert.deepEqual(r.body.state.ledger,ledger);const oldMoney=r.body.state.money;
  r=await post('economy-restore',{gameId:r.body.state.id,revision:r.body.state.revision});assert.equal(r.status,200);assert.equal(r.body.state.money,oldMoney);assert.equal(r.body.state.economy.customs.length,1);const restored=r.body.state;r=await post('economy-restore',{gameId:restored.id,revision:restored.revision});assert.equal(r.status,200);assert.deepEqual(r.body.state,restored);assert.equal((await post('economy-restore',{gameId:'old-game',revision:0})).status,400);assert.equal(errors,'');
 }finally{await stop();await fs.rm(dir,{recursive:true,force:true});}
});
