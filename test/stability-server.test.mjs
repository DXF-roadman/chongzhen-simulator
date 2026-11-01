import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import * as g from '../engine.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),pause=ms=>new Promise(r=>setTimeout(r,ms));
async function start(dir,port,{mock=false}={}){
 const args=mock?['--import',pathToFileURL(path.join(root,'test/stability-mock-ai.mjs')).href]:[];
 const child=spawn(process.execPath,[...args,path.join(root,'server.mjs')],{cwd:root,windowsHide:true,env:{...process.env,PORT:String(port),GAME_DATA_DIR:dir,DEEPSEEK_API_KEY:mock?'mock-stability-key':''},stdio:['ignore','pipe','pipe']});let errors='';child.stdout.resume();child.stderr.on('data',d=>errors+=d);
 const origin='http://127.0.0.1:'+port;let boot,status;
 for(let n=0;n<80;n++){try{const r=await fetch(origin+'/api/bootstrap');status=r.status;boot=await r.json();break;}catch{await pause(100);}}
 assert.ok(boot,errors);const post=async(route,data={})=>{const r=await fetch(origin+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-App-Token':boot.token,Origin:origin},body:JSON.stringify(data)}),v=await r.json();assert.equal(r.status,200,JSON.stringify(v));return v;};
 return {boot,status,post,origin,stop:async()=>{child.kill();if(child.exitCode===null)await new Promise(r=>child.once('exit',r));}};
}
test('真实服务重启、保存槽和导入恢复同一局势，继续月结与不中断结果一致',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'chongzhen-restart-'));let server;
 try{server=await start(dir,18991);await server.post('action',{id:'irrigation',target:'shaanxi',official:'xu'});await server.post('counsel',{target:'council',text:'建议如何节用？',mode:'discuss',offline:true});await server.post('planning-save',{gameId:server.boot.state.id,memo:{title:'来年核验',horizon:'long'}});await server.post('event',{index:1});const current=(await server.post('advance')).state;await server.post('save',{slot:1});await server.stop();
  server=await start(dir,18991);assert.deepEqual(server.boot.state,current);assert.deepEqual(server.boot.forecast,g.forecast(current));assert.deepEqual((await server.post('load',{slot:1})).state,current);assert.deepEqual((await server.post('import',{state:current})).state,current);
  assert.equal(current.event,null,'已批奏报后允许平静月');let expected=g.advance(current);assert.deepEqual((await server.post('advance')).state,expected);assert.deepEqual(JSON.parse(await fs.readFile(path.join(dir,'autosave.json'),'utf8')),expected);
 }finally{if(server)await server.stop();await fs.rm(dir,{recursive:true,force:true});}
},{timeout:20000});

test('服务启动遇到坏档显示明确错误，保留原文件并阻止写入',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'chongzhen-bad-start-'));let server;
 try{await fs.writeFile(path.join(dir,'autosave.json'),'{broken');server=await start(dir,18992);assert.equal(server.status,503);assert.match(server.boot.error,/存档恢复失败/);assert.equal(await fs.readFile(path.join(dir,'autosave.json'),'utf8'),'{broken');const r=await fetch(server.origin+'/api/new',{method:'POST',body:'{}'});assert.equal(r.status,503);assert.equal(await fs.readFile(path.join(dir,'autosave.json'),'utf8'),'{broken');}finally{if(server)await server.stop();await fs.rm(dir,{recursive:true,force:true});}
},{timeout:15000});

test('发展续报生成期间局势改变，旧回复不覆盖新状态，也不会卡死后续生成',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'chongzhen-story-race-'));let server;
 try{const s=g.createGame();Object.assign(s,{turn:3,month:4});s.institutions=[{id:'legacy-1',name:'财政试点',domain:'finance',turn:1,date:'二月'}];await fs.writeFile(path.join(dir,'autosave.json'),JSON.stringify(s));await fs.writeFile(path.join(dir,'ai-config.json'),JSON.stringify({enabled:true,model:'mock-stability',baseUrl:'https://stability-ai.invalid',encryptedKey:''}));server=await start(dir,18993,{mock:true});
  const pending=server.post('development-story');let observed=false;for(let n=0;n<30;n++){const b=await fetch(server.origin+'/api/bootstrap').then(r=>r.json());if(b.state.service.story.pending){observed=true;break;}await pause(20);}assert.equal(observed,true);const changed=await server.post('action',{id:'audit'});assert.equal(changed.state.service.story.pending,false);assert.equal((await pending).stale,true);const next=await server.post('development-story');assert.equal(next.state.service.story.pending,false);assert.equal(next.state.service.story.queue.length,1);assert.equal(next.state.money,changed.state.money);
 }finally{if(server)await server.stop();await fs.rm(dir,{recursive:true,force:true});}
},{timeout:15000});
