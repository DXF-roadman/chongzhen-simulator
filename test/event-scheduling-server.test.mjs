import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {calm,freshProgress} from './event-schedule-fixture.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('真实 API：无新进展不调用AI，重复故事不入案，断供才告急；读档和重启保留冷却',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'chongzhen-events-')),origin='http://127.0.0.1:19000';await fs.writeFile(path.join(dir,'ai-config.json'),JSON.stringify({enabled:true,baseUrl:'https://event-story-test.invalid',model:'mock-event-story'}));let child,errors='';
 function start(){child=spawn(process.execPath,['--import',pathToFileURL(path.join(root,'test/event-story-mock-ai.mjs')).href,'server.mjs'],{cwd:root,windowsHide:true,env:{...process.env,PORT:'19000',GAME_DATA_DIR:dir,DEEPSEEK_API_KEY:'event-story-test-only'},stdio:['ignore','ignore','pipe']});child.stderr.on('data',d=>errors+=d);}
 const stop=async()=>{if(child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r));}},boot=async()=>{for(let i=0;i<70;i++){try{return await fetch(origin+'/api/bootstrap').then(r=>r.json());}catch{await new Promise(r=>setTimeout(r,100));}}throw Error(errors);};
 try{start();let b=await boot(),token=b.token;const post=async(route,data={})=>{const r=await fetch(origin+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-App-Token':token},body:JSON.stringify(data)});return {status:r.status,body:await r.json()};};
  let r=await post('import',{state:freshProgress()});assert.equal(r.status,200,JSON.stringify(r.body));r=await post('development-story');assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.config.usage.requests,1);assert.equal(r.body.state.service.story.queue.length,1);r=await post('advance');assert.equal(r.body.state.event.id,'development-3');await post('event',{index:1});await post('advance');r=await post('advance');assert.equal(r.body.state.event,null);assert.equal(r.body.state.turn,6);r=await post('development-story');assert.equal(r.body.config.usage.requests,1,'旧工程不每季度重复调用');
  r=await post('action',{id:'irrigation',target:'shaanxi'});assert.equal(r.status,200);for(let i=0;i<3;i++)r=await post('advance');assert.equal(r.body.state.turn,9);r=await post('development-story');assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.development,null,'模型重复同一段轮灌故事被拦截');assert.equal(r.body.config.usage.requests,2);assert.equal(r.body.state.service.story.queue.length,0);assert.equal(r.body.state.service.story.chapters.length,1);await post('save',{slot:1});const saved=r.body.state;await stop();start();b=await boot();token=b.token;assert.deepEqual(b.state,saved);r=await post('load',{slot:1});assert.deepEqual(r.body.state,saved);for(let i=0;i<3;i++)r=await post('advance');r=await post('development-story');assert.equal(r.body.config.usage.requests,0,'重启后无需再请求相同旧进展');
  await post('import',{state:calm()});r=await post('advance');assert.equal(r.body.state.event,null);await post('fiscal',{command:{scope:'rates',values:{militaryBase:0}}});r=await post('advance');assert.equal(r.body.state.event.id,'pay');await post('event',{index:-1});const pending=(await boot()).state.affairs.find(a=>a.petition).id;for(let i=0;i<3;i++){r=await post('advance');assert.notEqual(r.body.state.event?.id,'pay');}assert.equal(r.body.state.affairs.filter(a=>a.petition?.id==='pay').length,1);assert.ok(r.body.state.affairs.some(a=>a.id===pending));assert.equal(errors,'');
 }finally{await stop();await fs.rm(dir,{recursive:true,force:true});}
},{timeout:20000});
