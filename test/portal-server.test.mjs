import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import * as g from '../engine.mjs';
import {appendDiscussion} from '../dialogues.mjs';
import {batch} from './portal-fixture.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('旧失败方案可原案重试且只执行一次；卫星撤销接口防过期并持久化',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'chongzhen-portal-')),origin='http://127.0.0.1:18637',child=spawn(process.execPath,[path.join(root,'server.mjs')],{cwd:root,windowsHide:true,env:{...process.env,PORT:'18637',GAME_DATA_DIR:dir,DEEPSEEK_API_KEY:''},stdio:['ignore','ignore','pipe']});let errors='';child.stderr.on('data',d=>errors+=d);
 try{
  let boot;for(let i=0;i<60;i++){try{boot=await fetch(origin+'/api/bootstrap').then(r=>r.json());break;}catch{await new Promise(r=>setTimeout(r,100));}}assert.ok(boot,errors);
  const post=async(route,data={})=>{const r=await fetch(origin+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-App-Token':boot.token},body:JSON.stringify(data)});return {status:r.status,body:await r.json()};};
  let s=g.createGame({mode:'traveler'});Object.assign(s,{money:0,grain:38,month:6,turn:5});delete s.yearRecord;
  for(let eventSerial=0;eventSerial<12;eventSerial++){const next=g.validateSave({...s,eventSerial,event:structuredClone(g.EVENTS[eventSerial%g.EVENTS.length])});if(next.event?.id==='border'){s=next;break;}}assert.equal(s.event.id,'border');
  appendDiscussion(s,{id:'office:guards',name:'锦衣卫'},'从门中取钱，边防与试作所均照前议办理','遵旨，试作所料由门中另拨，不占官帑。',batch,{status:'blocked',text:'国库需要 36 万两，目前只有 0 万两。整批未执行。'},'ai',g.dateLabel(s));
  assert.equal((await post('import',{state:s})).status,200);let r=await post('counsel',{target:'office:guards',text:'照办',mode:'auto',offline:true});assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.thread.messages.at(-1).result.status,'executed');assert.equal(r.body.config.usage.requests,0);assert.equal(r.body.state.money,0);assert.equal(r.body.state.grain,44);assert.equal(r.body.state.projects[0].funding,'portal');assert.equal((await post('counsel',{target:'office:guards',text:'照办',offline:true})).status,400);
  await post('save',{slot:1});r=await post('load',{slot:1});assert.equal(r.body.state.projects[0].funding,'portal');s=r.body.state;
  r=await post('intervene',{command:{type:'horizon',operation:'satellite'}});const launched=r.body.state;assert.equal(launched.atlas.allVisible,true);
  const stale=await post('undo-satellite',{gameId:s.id,revision:s.revision});assert.equal(stale.status,400);assert.match(stale.body.error,/局势已改变/);
  r=await post('undo-satellite',{gameId:launched.id,revision:launched.revision});assert.equal(r.status,200,JSON.stringify(r.body));const restored=r.body.state;assert.equal(restored.atlas.allVisible,false);assert.equal(restored.traveler.satellites,0);assert.equal(restored.traveler.energy,s.traveler.energy);assert.deepEqual(restored.atlas,s.atlas);assert.equal(restored.money,s.money);assert.equal(restored.grain,s.grain);assert.equal(restored.projects[0].funding,'portal');
  assert.equal((await post('undo-satellite',{gameId:restored.id,revision:restored.revision})).status,400);assert.deepEqual(JSON.parse(await fs.readFile(path.join(dir,'autosave.json'),'utf8')).atlas,restored.atlas);assert.equal(errors,'');
 }finally{if(child.exitCode===null){child.kill();await new Promise(resolve=>child.once('exit',resolve));}await fs.rm(dir,{recursive:true,force:true});}
},{timeout:20000});
