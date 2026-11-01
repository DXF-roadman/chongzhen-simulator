import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import * as g from '../engine.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('真实API：免费留中、过月重批、过期案卷保护、贸易回航和读档不重复结算',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'chongzhen-operations-')),port=18996,origin='http://127.0.0.1:'+port;const child=spawn(process.execPath,[path.join(root,'server.mjs')],{cwd:root,windowsHide:true,env:{...process.env,PORT:String(port),GAME_DATA_DIR:dir,DEEPSEEK_API_KEY:''},stdio:['ignore','pipe','pipe']});child.stdout.resume();let errors='';child.stderr.on('data',d=>errors+=d);
 try{let boot;for(let n=0;n<70;n++){try{boot=await fetch(origin+'/api/bootstrap').then(r=>r.json());break;}catch{await new Promise(r=>setTimeout(r,100));}}assert.ok(boot,errors);
  const post=async(route,data={})=>{const r=await fetch(origin+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-App-Token':boot.token,Origin:origin},body:JSON.stringify(data)});return {status:r.status,data:await r.json()};};
  let r=await post('event',{index:-1});assert.equal(r.status,200,JSON.stringify(r.data));const id=r.data.state.affairs.find(a=>a.petition).id;r=await post('advance');assert.equal(r.status,200,JSON.stringify(r.data));const current=r.data.state.event;await post('save',{slot:1});r=await post('load',{slot:1});assert.ok(r.data.state.affairs.some(a=>a.id===id));
  r=await post('event',{petition:'affair-0-99999',index:1});assert.equal(r.status,400);let check=await fetch(origin+'/api/bootstrap').then(r=>r.json());assert.deepEqual(check.state.event,current);
  r=await post('event',{petition:id,index:1});assert.equal(r.status,200,JSON.stringify(r.data));assert.deepEqual(r.data.state.event,current);assert.ok(!r.data.state.affairs.some(a=>a.id===id));
  const rich={...g.createGame({mode:'sandbox',seed:1996}),money:2000,grain:2000};r=await post('import',{state:rich});assert.equal(r.status,200);r=await post('diplomacy',{id:'joseon',kind:'trade'});assert.equal(r.status,200);assert.equal(r.data.state.money,1972);assert.equal((await post('diplomacy',{id:'joseon',kind:'trade'})).status,400);await post('advance');r=await post('advance');assert.equal(r.status,200,JSON.stringify(r.data));assert.ok(!r.data.state.affairs.some(a=>a.trade));await post('save',{slot:2});const settled=r.data.state;r=await post('load',{slot:2});assert.deepEqual(r.data.state,settled);assert.equal(errors,'');
 }finally{child.kill();if(child.exitCode===null)await new Promise(r=>child.once('exit',r));await fs.rm(dir,{recursive:true,force:true});}
},{timeout:20000});
