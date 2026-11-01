import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('真实 API：AI 只估算，玩家预算主导，商议不收费、采纳不重问、读档和过期保护',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'chongzhen-petition-')),origin='http://127.0.0.1:18997';await fs.writeFile(path.join(dir,'ai-config.json'),JSON.stringify({enabled:true,baseUrl:'https://petition-test.invalid',model:'mock-petition'}));
 const child=spawn(process.execPath,['--import',pathToFileURL(path.join(root,'test/petition-mock-ai.mjs')).href,'server.mjs'],{cwd:root,windowsHide:true,env:{...process.env,PORT:'18997',GAME_DATA_DIR:dir,DEEPSEEK_API_KEY:'petition-test-only'},stdio:['ignore','ignore','pipe']});let errors='';child.stderr.on('data',d=>errors+=d);
 try{
  let boot;for(let n=0;n<70;n++){try{boot=await fetch(origin+'/api/bootstrap').then(r=>r.json());break;}catch{await new Promise(r=>setTimeout(r,100));}}assert.ok(boot,errors);
  const post=async(route,data={})=>{const r=await fetch(origin+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-App-Token':boot.token},body:JSON.stringify(data)});return {status:r.status,body:await r.json()};};
  const d={text:'先核查两县账册，余款另议',eventId:boot.state.event.id,eventTurn:boot.state.turn,gameId:boot.state.id,budget:{money:3,grain:0}},before=boot.state;
  let r=await post('counsel',{text:d.text,petitionDraft:d,mode:'discuss'});assert.equal(r.status,200,JSON.stringify(r.body)+errors);assert.equal(r.body.state.money,before.money);assert.deepEqual(r.body.state.event,before.event);assert.equal(r.body.config.usage.requests,1);let m=r.body.thread.messages.at(-1);assert.equal(m.commands[0].custom.draft.budget.money,3);assert.match(m.result.text,/首拨上限：银3/);await post('save',{slot:1});r=await post('load',{slot:1});assert.equal(r.body.state.discussions[0].messages.at(-1).commands[0].custom.draft.budget.money,3);
  r=await post('counsel',{text:d.text,rewrite:{action:'regenerate',messageId:m.id,lastMessageId:m.id}});assert.equal(r.status,200,JSON.stringify(r.body)+errors);assert.equal(r.body.config.usage.requests,2);assert.equal(r.body.thread.messages.at(-1).commands[0].custom.draft.budget.money,3);assert.equal(r.body.state.money,before.money);
  r=await post('counsel',{text:'首拨改为两万两，拨粮零万石',mode:'discuss'});assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.thread.messages.at(-1).commands[0].custom.draft.budget.money,2);assert.equal(r.body.state.money,before.money);assert.equal(r.body.config.usage.requests,2);
  r=await post('counsel',{text:'照此办理',mode:'auto'});assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.thread.messages.at(-1).result.status,'executed');assert.equal(r.body.state.money,before.money-2);assert.equal(r.body.state.event,null);assert.equal(r.body.config.usage.requests,2,'采纳确切方案不用再次询问 AI');assert.equal(r.body.state.projects[0].knowledgeGain,2);await post('save',{slot:2});const saved=r.body.state;r=await post('load',{slot:2});assert.deepEqual(r.body.state,saved);
  r=await post('counsel',{text:d.text,petitionDraft:d,mode:'auto'});assert.equal(r.status,400);assert.match(r.body.error,/已经批复/);const latest=await fetch(origin+'/api/bootstrap').then(r=>r.json());assert.deepEqual(latest.state,saved);assert.equal(latest.config.usage.requests,2);
  await post('fiscal',{command:{scope:'rates',values:{militaryBase:0}}});r=await post('advance');assert.equal(r.status,200);assert.equal(r.body.state.event.id,'pay','实际军饷零供给才产生新催饷');const s=r.body.state,direct={text:'依第一案缩小办理',eventId:s.event.id,eventTurn:s.turn,gameId:s.id,reference:0,budget:{money:1,grain:1}};r=await post('counsel',{text:direct.text,petitionDraft:direct,mode:'auto'});assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.thread.messages.at(-1).result.status,'executed');assert.ok(r.body.state.money>=s.money-1);assert.ok(r.body.state.grain>=s.grain-1);assert.equal(r.body.config.usage.requests,2,'参考方案自调预算使用确定规则');assert.equal(errors,'');
 }finally{if(child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r));}await fs.rm(dir,{recursive:true,force:true});}
},{timeout:20000});
