import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import * as g from '../engine.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('模拟DeepSeek按本署名册荐人，接受不再请求AI，存读档、拒绝重复与并发续报均生效',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'chongzhen-civil-')),origin='http://127.0.0.1:18639';await fs.writeFile(path.join(dir,'ai-config.json'),JSON.stringify({enabled:true,baseUrl:'https://civil-test.invalid',model:'mock-civil'}));
 const child=spawn(process.execPath,['--import',pathToFileURL(path.join(root,'test/civil-mock-ai.mjs')).href,'server.mjs'],{cwd:root,windowsHide:true,env:{...process.env,PORT:'18639',GAME_DATA_DIR:dir,DEEPSEEK_API_KEY:'civil-test-key'},stdio:['ignore','ignore','pipe']});let errors='';child.stderr.on('data',d=>errors+=d);
 try{
  let boot;for(let n=0;n<60;n++){try{boot=await fetch(origin+'/api/bootstrap').then(r=>r.json());break;}catch{await new Promise(r=>setTimeout(r,100));}}assert.ok(boot,errors);
  const post=async(route,data={})=>{const res=await fetch(origin+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-App-Token':boot.token},body:JSON.stringify(data)});return {status:res.status,body:await res.json()};};
  let r=await post('counsel',{target:'office:guards',text:'想找一个熟悉海路的人下南洋',mode:'auto'});assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.state.money,460);assert.equal(r.body.state.government.officeLeaders.war,'civil-head-war','模型混入的任命没有执行');assert.equal(r.body.state.atlas.voyages.length,0);assert.match(r.body.thread.messages.at(-1).result.text,/荐举已入/);assert.equal(r.body.thread.messages.at(-1).commands[0].type,'service');assert.equal(r.body.thread.messages.at(-1).orderText,undefined);const count=r.body.config.usage.requests;assert.equal(count,1);
  r=await post('counsel',{target:'office:guards',text:'让他去',mode:'auto'});assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.thread.messages.at(-1).result.status,'executed');assert.equal(r.body.config.usage.requests,count);assert.equal(r.body.state.money,438);assert.equal(r.body.state.grain,250);assert.equal(r.body.state.atlas.voyages.length,1);
  r=await post('counsel',{target:'office:guards',text:'让他去'});assert.equal(r.status,400);assert.match(r.body.error,/已经办理/);await post('save',{slot:1});r=await post('load',{slot:1});assert.equal(r.body.state.service.tasks[0].status,'active');assert.equal(r.body.state.atlas.voyages.length,1);
  const development=g.createGame();development.turn=3;development.month=4;development.institutions.unshift({id:'test',name:'灌渠试点',domain:'agriculture',date:'三月',turn:2});development.history.unshift({turn:2,type:'project',title:'竣工 · 灌渠试点',text:'已验收',date:'三月'});await post('import',{state:development});
  r=await post('development-story');assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.state.service.story.queue.length,1);assert.match(r.body.development.title,/轮灌/);assert.equal(r.body.state.event.id,'drought');assert.equal(r.body.state.money,460);const requests=r.body.config.usage.requests;
  r=await post('development-story');assert.equal(r.body.config.usage.requests,requests);assert.equal(r.body.state.service.story.queue.length,1);await post('save',{slot:1});r=await post('load',{slot:1});assert.equal(r.body.state.service.story.queue[0].id,'development-3');
  await post('event',{index:2});r=await post('advance');assert.equal(r.body.state.event,null);assert.equal(r.body.state.service.story.queue.length,1);r=await post('advance');assert.equal(r.body.state.event.id,'development-3');await post('save',{slot:1});r=await post('load',{slot:1});assert.equal(r.body.state.event.id,'development-3');
  const next={...development,turn:6,month:7};await post('import',{state:next});await post('config',{enabled:true,model:'slow-story',baseUrl:'https://civil-test.invalid'});const a=post('development-story');await new Promise(r=>setTimeout(r,50));const b=post('development-story');const [first,second]=await Promise.all([a,b]);assert.equal(first.status,200);assert.equal(second.status,200);boot=await fetch(origin+'/api/bootstrap').then(r=>r.json());assert.equal(boot.state.service.story.chapters.length,1);
  next.turn=9;next.month=10;await post('import',{state:next});const slow=post('development-story');await new Promise(r=>setTimeout(r,50));await post('action',{id:'audit'});r=await slow;assert.equal(r.body.stale,true);boot=await fetch(origin+'/api/bootstrap').then(r=>r.json());assert.equal(boot.state.projects.length,1);assert.equal(boot.state.service.story.chapters.length,0,'过期AI不得覆盖最新政务');assert.equal(errors,'');
 }finally{if(child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r));}await fs.rm(dir,{recursive:true,force:true});}
});
